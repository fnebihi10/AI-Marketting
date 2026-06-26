"use strict";

// Importojmë klasën Worker nga BullMQ për menaxhimin e radhës së punëve
const { Worker } = require("bullmq");

// Importojmë konfigurimet, lidhjet dhe shërbimet lokale
const { connectDatabase } = require("./db");
const { config } = require("./config");
const { redisConnection, VIDEO_QUEUE_NAME, ensureRedisConnection, closeRedisConnections } = require("./queue");
const { processVideoJob } = require("./services/jobOrchestrator");
const { publishJobProgress } = require("./services/jobProgressService");
const { ensureDir } = require("./utils/files");

/**
 * Funksioni kryesor asinkron që ndez dhe konfiguron Worker-in
 */
const bootWorker = async () => {
    // 1. Kontrollon nëse modaliteti i radhës është 'inline' (lokal/direkt)
    // Nëse po, Worker-i nuk është i nevojshëm dhe funksioni ndalet këtu.
    if (config.queueMode !== 'bullmq') {
        console.log('QUEUE_MODE is inline. Worker is not required in this mode.');
        return;
    }

    // 2. Kontrollon nëse ekziston një konfigurim aktiv për lidhjen me Redis
    if (!redisConnection) {
        throw new Error('Redis connection is not configured for BullMQ mode.');
    }

    // 3. Krijon në mënyrë paralele të gjitha direktoritë (dosjet) e nevojshme lokale për skedarët
    await Promise.all([
        ensureDir(config.uploadsDir),
        ensureDir(config.workingDir),
        ensureDir(config.cacheDir),
        ensureDir(config.outputDir)
    ]);

    // 4. Siguron që lidhjet me Redis dhe Databazën (MongoDB) janë aktive përpara se të nisë puna
    await ensureRedisConnection();
    await connectDatabase();

    // 5. Krijimi i një instance të re të Worker-it nga BullMQ
    // Ky worker dëgjon te kanali i specifikuar te VIDEO_QUEUE_NAME
    const worker = new Worker(VIDEO_QUEUE_NAME, async (queueJob) => {
        try {
            // Provon të ekzekutojë procesimin e videos duke marrë ID-në e punës nga të dhënat e radhës
            return await processVideoJob(String(queueJob.data.jobId));
        } catch (error) {
            // Nëse procesimi dështon, dërgon një njoftim në kohë reale (Pub/Sub) që puna dështoi
            await publishJobProgress(String(queueJob.data.jobId), {
                status: 'failed',
                stage: 'failed',
                progress: 100,
                message: 'Generation failed.',
                error: error.message || 'Unknown worker error.'
            });
            // Rilëshon gabimin (throw) në mënyrë që BullMQ ta shënojë punën si të dështuar zyrtarisht
            throw error;
        }
    }, {
        // Konfigurimet e Worker-it: lidhja me Redis dhe numri i punëve paralele (concurrency)
        connection: redisConnection,
        concurrency: config.jobConcurrency
    });

    // Event listener: Shfaqet në konsolë kur një punë përfundon me sukses
    worker.on('completed', (job) => {
        console.log(`Completed video job ${job.data.jobId}`);
    });

    // Event listener: Shfaqet në konsolë kur një punë dështon
    worker.on('failed', (job, error) => {
        console.error(`Failed video job ${job?.data?.jobId}:`, error.message);
    });
};

// Nisja e ekzekutimit të funksionit bootWorker
bootWorker().catch(async (error) => {
    // Nëse dështon nisja fillestare e Worker-it, kapet gabimi, mbyllen lidhjet me Redis dhe mbyllet procesi (exit 1)
    console.error(error);
    await closeRedisConnections();
    process.exit(1);
});