"use strict";

const express = require("express");
const Stripe = require("stripe");
const { config } = require("../config");
const { protect } = require("../middleware/authMiddleware");
const { User } = require("../models/User");

const router = express.Router();
const stripe = new Stripe(config.stripeSecretKey, {});

const PACKAGES = {
    standard: {
        name: '30 AI Marketing Credits',
        credits: 30,
        priceAmount: 2000 // €20.00
    },
    premium: {
        name: '50 AI Marketing Credits',
        credits: 50,
        priceAmount: 3500 // €35.00
    }
};

/**
 * Shton kreditë e përdoruesit në mënyrë idempotente për një sesion specifik checkout-i
 */
async function creditUserForSession(sessionId, userId, creditsToAdd) {
    const user = await User.findById(userId);
    if (!user) return false;

    // Inicializon array-n nëse është i papërcaktuar
    if (!user.creditedSessions) {
        user.creditedSessions = [];
    }

    // Kontrollon nëse ky sesion është kredituar një herë (shmang dyfishimin)
    if (user.creditedSessions.includes(sessionId)) {
        return false; // Ndalo, është kredituar më parë
    }

    user.creditedSessions.push(sessionId);
    user.credits = (user.credits || 0) + creditsToAdd;
    await user.save();
    return true;
}

// 1. Create Checkout Session
router.post('/create-checkout-session', protect, async (req, res, next) => {
    try {
        const { packageId } = req.body;
        const pkg = PACKAGES[packageId];
        
        if (!pkg) {
            return res.status(400).json({ message: 'Invalid package selection.' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: pkg.name,
                            description: `Purchase ${pkg.credits} high-converting generation credits for AI Marketing Studio`
                        },
                        unit_amount: pkg.priceAmount
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${config.frontendUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.frontendUrl}/dashboard?payment=cancel`,
            metadata: {
                userId: req.user.userId,
                credits: String(pkg.credits),
                packageId
            }
        });

        res.json({ url: session.url });
    }
    catch (error) {
        next(error);
    }
});

// 2. Direct Session Verification (Client fallback për local dev)
router.get('/verify-session', protect, async (req, res, next) => {
    try {
        const sessionId = String(req.query.session_id || '');
        if (!sessionId) {
            return res.status(400).json({ message: 'Missing session_id parameter.' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!session || session.payment_status !== 'paid') {
            return res.status(400).json({ message: 'Session is not paid or invalid.' });
        }

        const userId = session.metadata?.userId;
        const credits = Number(session.metadata?.credits || 0);

        if (!userId || !credits) {
            return res.status(400).json({ message: 'Invalid session metadata.' });
        }

        // Verifikon që sesioni i përket përdoruesit që po bën kërkesën
        if (userId !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized session verification.' });
        }

        const wasCredited = await creditUserForSession(sessionId, userId, credits);
        
        res.json({
            success: true,
            wasCredited,
            credits,
            message: wasCredited ? `Successfully credited ${credits} credits!` : 'Credits already applied for this session.'
        });
    }
    catch (error) {
        next(error);
    }
});

// 3. Webhook listener (Mënyra standarde për produksion)
router.post('/webhook', async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        if (!sig) {
            return res.status(400).send('Webhook Error: Missing stripe-signature header');
        }
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    }
    catch (err) {
        // Nëse webhook secret nuk është i konfiguruar, lejohet parsing lokal VETËM në zhvillim (development)
        if (config.env === 'development' && !config.stripeWebhookSecret) {
            console.warn('⚠️ Stripe Webhook signature validation skipped in development (no STRIPE_WEBHOOK_SECRET set)');
            try {
                const payload = JSON.parse(req.body.toString());
                event = payload;
            }
            catch (parseErr) {
                return res.status(400).send(`Webhook parsing failed: ${err.message}`);
            }
        }
        else {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    // Trajtojmë ngjarjen checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const credits = Number(session.metadata?.credits || 0);

        if (userId && credits && session.payment_status === 'paid') {
            try {
                await creditUserForSession(session.id, userId, credits);
                console.log(`✅ Credited ${credits} credits to user ${userId} via Webhook for session ${session.id}`);
            }
            catch (err) {
                console.error(`❌ Failed to credit user via Webhook: ${err.message}`);
            }
        }
    }

    res.json({ received: true });
});

module.exports = router;