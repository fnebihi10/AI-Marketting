"use strict";

// Importojmë mjetet kryesore të sistemit, kornizën Express dhe CORS
const path = require("node:path");
const express = require("express");
const cors = require("cors");

const { config } = require("./config");

// Importojmë rrugët (routes) të ndara sipas kategorive
const routes = require("./routes"); // Rrugët e përgjithshme
const authRoutes = require("./routes/authRoutes"); // Rrugët për login/regjistrim
const billingRoutes = require("./routes/billingRoutes"); // Rrugët e pagesave

/**
 * Ndërton dhe konfiguron të gjithë aplikacionin Express.
 */
const createApp = () => {
    const app = express();

    // CORS (Cross-Origin Resource Sharing):
    // Sigurohet që vetëm adresa e frontend-it tënd ka të drejtë të bëjë kërkesa në këtë API.
    app.use(cors({
        origin: config.frontendUrl
    }));

    // STRIPE WEBHOOK:
    // Për pagesat duhet të marrim të dhënat ekzaktësisht siç nisen ('raw' JSON) pa u modifikuar,
    // që të verifikohet firma e sigurisë e Stripe-it përpara se t'i rriten kreditë përdoruesit.
    app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));

    // KONFIGURIMI I SKEDARËVE STATIKË (Video/Audio/Foto):
    // Këto rregulla i tregojnë serverit si t'i dërgojë videot te përdoruesi.
    // 'acceptRanges: true' lejon përdoruesin të ecë para e mbrapa në video (Seek) pa e shkarkuar të gjithën nga fillimi.
    const staticOptions = {
        acceptRanges: true,
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    };

    app.use('/storage/uploads', express.static(path.join(config.rootDir, 'storage/uploads'), staticOptions));
    app.use('/storage/work', express.static(config.workingDir, staticOptions));
    app.use('/storage', express.static(path.join(config.rootDir, 'storage/exports'), staticOptions));

    // Rruga bazë për të kontrolluar gjendjen e serverit
    app.get('/', (_req, res) => {
        res.json({
            name: 'AI Marketing Studio MVP API',
            status: 'ok',
            health: `${config.appUrl}/api/health`,
            frontend: config.frontendUrl
        });
    });

    // Regjistrimi i rrugëve (Endpoints) në aplikacion
    app.use('/api/auth', authRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api', routes);

    // Middleware për menaxhimin global të gabimeve (Error Handler)
    app.use((error, _req, res, _next) => {
        const status = error.statusCode || 500;
        res.status(status).json({
            message: error.message || 'Unexpected server error.'
        });
    });

    return app;
};

// Eksportojmë funksionin në stilin standard CommonJS
module.exports = {
    createApp
};