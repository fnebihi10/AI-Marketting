"use strict";

// Importojmë librarinë ioredis dhe elementet e nevojshme nga bullmq
const Redis = require("ioredis");
const { Queue } = require("bullmq");

const { config } = require("./config");

/**
 * FUNKSIONI NDIHMËS: createRedisClient
 * Krijon një lidhje të re të personalizuar me serverin Redis.
 * Përdor një 'label' (etiketë) për të dalluar kush po lidhet.
 */
const createRedisClient = (label) => {
    let hasReportedFailure = false;
    
    // Krijojmë klientin e ri Redis duke marrë URL-në nga skedari config (.env)
    const client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
    });

    // Nëse ndodh një gabim gjatë lidhjes me Redis
    client.on('error', (error) => {
        if (!hasReportedFailure) {
            console.error(`Redis ${label} connection failed: ${error.message}`);
            hasReportedFailure = true;
        }
    });

    client.on('ready', () => {
        hasReportedFailure = false;
    });

    return client;
};

// Inicializojmë klientët Redis vetëm nëse radha është caktuar në 'bullmq'
const redisConnection = config.queueMode === 'bullmq' ? createRedisClient('queue') : null;
const progressPublisher = config.queueMode === 'bullmq' ? createRedisClient('publisher') : null;

const VIDEO_QUEUE_NAME = 'video-generation';

// Krijojmë radhën e BullMQ për përpunimin e videove
const videoQueue = config.queueMode === 'bullmq' && redisConnection
    ? new Queue(VIDEO_QUEUE_NAME, { connection: redisConnection })
    : null;

/**
 * Sigurohet që lidhjet me Redis janë aktive përpara se të nisë puna.
 */
const ensureRedisConnection = async () => {
    if (!redisConnection || !progressPublisher) {
        return;
    }
    await Promise.all([redisConnection.connect(), progressPublisher.connect()]);
    await Promise.all([redisConnection.ping(), progressPublisher.ping()]);
};

/**
 * Mbyll në mënyrë të sigurt të gjitha lidhjet aktive me Redis.
 */
const closeRedisConnections = async () => {
    const closers = [];
    if (redisConnection) {
        closers.push(redisConnection.quit());
    }
    if (progressPublisher) {
        closers.push(progressPublisher.quit());
    }
    await Promise.allSettled(closers);
};

// Eksportojmë variablat dhe funksionet në stilin standard CommonJS
module.exports = {
    redisConnection,
    progressPublisher,
    VIDEO_QUEUE_NAME,
    videoQueue,
    ensureRedisConnection,
    closeRedisConnections
};