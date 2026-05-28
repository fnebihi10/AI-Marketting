import express from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { protect } from '../middleware/authMiddleware';
import User from '../models/User';

const router = express.Router();
const stripe = new Stripe(config.stripeSecretKey, {} as any);

interface PackageDetails {
  name: string;
  credits: number;
  priceAmount: number; // in cents
}

const PACKAGES: Record<string, PackageDetails> = {
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
 * Idempotently adds credits to the user for a specific checkout session
 */
async function creditUserForSession(sessionId: string, userId: string, creditsToAdd: number): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  // Initialize array if undefined
  if (!user.creditedSessions) {
    user.creditedSessions = [];
  }

  // Check if session has already been credited
  if (user.creditedSessions.includes(sessionId)) {
    return false; // already credited
  }

  user.creditedSessions.push(sessionId);
  user.credits = (user.credits || 0) + creditsToAdd;
  await user.save();
  return true;
}

// 1. Create Checkout Session
router.post('/create-checkout-session', protect, async (req: any, res, next) => {
  try {
    const { packageId } = req.body;
    const pkg = PACKAGES[packageId];

    if (!pkg) {
      res.status(400).json({ message: 'Invalid package selection.' });
      return;
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
  } catch (error) {
    next(error);
  }
});

// 2. Direct Session Verification (Client fallback for local dev)
router.get('/verify-session', protect, async (req: any, res, next) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) {
      res.status(400).json({ message: 'Missing session_id parameter.' });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      res.status(400).json({ message: 'Session is not paid or invalid.' });
      return;
    }

    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits || 0);

    if (!userId || !credits) {
      res.status(400).json({ message: 'Invalid session metadata.' });
      return;
    }

    // Verify session belongs to the requesting user
    if (userId !== req.user.userId) {
      res.status(403).json({ message: 'Unauthorized session verification.' });
      return;
    }

    const wasCredited = await creditUserForSession(sessionId, userId, credits);

    res.json({
      success: true,
      wasCredited,
      credits,
      message: wasCredited ? `Successfully credited ${credits} credits!` : 'Credits already applied for this session.'
    });
  } catch (error) {
    next(error);
  }
});

// 3. Webhook listener (standard production flow)
router.post('/webhook', async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event: any;

  try {
    if (!sig) {
      res.status(400).send('Webhook Error: Missing stripe-signature header');
      return;
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripeWebhookSecret
    );
  } catch (err: any) {
    // If webhook secret is not configured or signature fails, fallback to unsafe local parsing ONLY if in development
    if (config.env === 'development' && !config.stripeWebhookSecret) {
      console.warn('⚠️ Stripe Webhook signature validation skipped in development (no STRIPE_WEBHOOK_SECRET set)');
      try {
        const payload = JSON.parse(req.body.toString());
        event = payload;
      } catch (parseErr) {
        res.status(400).send(`Webhook parsing failed: ${err.message}`);
        return;
      }
    } else {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits || 0);

    if (userId && credits && session.payment_status === 'paid') {
      try {
        await creditUserForSession(session.id, userId, credits);
        console.log(`✅ Credited ${credits} credits to user ${userId} via Webhook for session ${session.id}`);
      } catch (err: any) {
        console.error(`❌ Failed to credit user via Webhook: ${err.message}`);
      }
    }
  }

  res.json({ received: true });
});

export default router;
