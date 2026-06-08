"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const db_1 = require("./db");
const config_1 = require("./config");
const queue_1 = require("./queue");
const jobOrchestrator_1 = require("./services/jobOrchestrator");
const jobProgressService_1 = require("./services/jobProgressService");
const files_1 = require("./utils/files");
const bootWorker = async () => {
    if (config_1.config.queueMode !== 'bullmq') {
        console.log('QUEUE_MODE is inline. Worker is not required in this mode.');
        return;
    }
    if (!queue_1.redisConnection) {
        throw new Error('Redis connection is not configured for BullMQ mode.');
    }
    await Promise.all([
        (0, files_1.ensureDir)(config_1.config.uploadsDir),
        (0, files_1.ensureDir)(config_1.config.workingDir),
        (0, files_1.ensureDir)(config_1.config.cacheDir),
        (0, files_1.ensureDir)(config_1.config.outputDir)
    ]);
    await (0, queue_1.ensureRedisConnection)();
    await (0, db_1.connectDatabase)();
    const worker = new bullmq_1.Worker(queue_1.VIDEO_QUEUE_NAME, async (queueJob) => {
        try {
            return await (0, jobOrchestrator_1.processVideoJob)(String(queueJob.data.jobId));
        }
        catch (error) {
            await (0, jobProgressService_1.publishJobProgress)(String(queueJob.data.jobId), {
                status: 'failed',
                stage: 'failed',
                progress: 100,
                message: 'Generation failed.',
                error: error.message || 'Unknown worker error.'
            });
            throw error;
        }
    }, {
        connection: queue_1.redisConnection,
        concurrency: config_1.config.jobConcurrency
    });
    worker.on('completed', (job) => {
        console.log(`Completed video job ${job.data.jobId}`);
    });
    worker.on('failed', (job, error) => {
        console.error(`Failed video job ${job?.data?.jobId}:`, error.message);
    });
};
bootWorker().catch(async (error) => {
    console.error(error);
    await (0, queue_1.closeRedisConnections)();
    process.exit(1);
});
