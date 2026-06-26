"use strict";

// Importojmë modulin nativ HTTP të Node.js
const http = require("node:http");

// Importojmë modulet dhe konfigurimet lokale të projektit
const { connectDatabase } = require("./db"); // Ura e MongoDB
const { config, requiredAtBoot } = require("./config"); // Truri i kujtesës (.env)
const { ensureDir } = require("./utils/files"); // Mjetet e folderave
const { createApp } = require("./app"); // Portieri Express
const { ensureRedisConnection, closeRedisConnections } = require("./queue"); // Menaxhimi i radhëve

/**
 * FUNKSIONI ASINKRON: boot
 * Ky është sekuenca kryesore e ndezjes së të gjithë projektit tënd.
 */
const boot = async () => {
    // 1. KONTROLLI I PARË: Verifikon nëse variablat e detyrueshëm ekzistojnë në .env
    requiredAtBoot.forEach((key) => {
        if (!process.env[key]) {
            console.warn(`Missing required environment variable: ${key}`);
        }
    });

    // Nëse sistemi i videove është caktuar si 'bullmq' (profesional), por mungon Redis, jep paralajmërim
    if (config.queueMode === 'bullmq' && !process.env.REDIS_URL) {
        console.warn('Missing recommended environment variable: REDIS_URL');
    }

    // 2. KONTROLLI I DYTË: Krijon 4 folderat kryesorë të punës në të njëjtën kohë (Paralel)
    // Kjo parandalon që programi të bllokohet kur FFmpeg apo përdoruesi kërkon të ruajë një skedar.
    await Promise.all([
        ensureDir(config.uploadsDir),
        ensureDir(config.workingDir),
        ensureDir(config.cacheDir),
        ensureDir(config.outputDir)
    ]);

    // 3. KONTROLLI I TRETË: Lidhja me sistemin e radhës së videove (Redis)
    if (config.queueMode === 'bullmq') {
        await ensureRedisConnection();
    }

    // 4. KONTROLLI I KATËRT: Lidhja me databazën MongoDB
    await connectDatabase();

    // 5. NDEZJA E EXPRESS-IT: Merr konfigurimin e rrugëve, CORS-it dhe Webhook-eve nga app.js
    const app = createApp();

    // Krijon serverin fizik HTTP të bazuar mbi Express
    const server = http.createServer(app);

    // MENAXHUESI I GABIMEVE TË SERVERIT:
    // Nëse serveri dështon të ndizet, ky bllok kontrollon arsyen.
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${config.port} is already in use. Please clear it and try again.`);
        } else {
            console.error('Server error:', err);
        }
        process.exit(1); // Fik gjithçka me status gabimi
    });

    // 6. NISJA E TRANSMETIMIT (Listening): 
    // Serveri hap portat dhe bëhet gati të presë kërkesat e përdoruesve!
    server.listen(config.port, () => {
        console.log(`AI Marketing Studio backend listening on ${config.appUrl}`);
    });
};

// SIGURIA KONTRA RREZIKUT (Anti-Crash):
// Nëse dikur në kod ndodh një dështim i fshehtë asinkron (Promise Rejection) që nuk është kapur me try/catch,
// ky bllok e kap që serveri yt të mos fiket papritur në prodhim.
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// THIRRJA ZYRTARE E NDIZJES
boot().catch(async (error) => {
    console.error('Fatal boot error:', error);
    if (config.queueMode === 'bullmq') {
        await closeRedisConnections();
    }
    // Fikim procesin vetëm nëse gabimi ndodh gjatë sekuencës fillestare të ndezjes
    if (error.code === 'EADDRINUSE') {
        process.exit(1);
    }
});