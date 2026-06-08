"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const db_1 = require("./db");
const config_1 = require("./config");
const files_1 = require("./utils/files");
const app_1 = require("./app");
const queue_1 = require("./queue");
const boot = async () => {
    config_1.requiredAtBoot.forEach((key) => {
        if (!process.env[key]) {
            console.warn(`Missing required environment variable: ${key}`);
        }
    });
    if (config_1.config.queueMode === 'bullmq' && !process.env.REDIS_URL) {
        console.warn('Missing recommended environment variable: REDIS_URL');
    }
    await Promise.all([
        (0, files_1.ensureDir)(config_1.config.uploadsDir),
        (0, files_1.ensureDir)(config_1.config.workingDir),
        (0, files_1.ensureDir)(config_1.config.cacheDir),
        (0, files_1.ensureDir)(config_1.config.outputDir)
    ]);
    if (config_1.config.queueMode === 'bullmq') {
        await (0, queue_1.ensureRedisConnection)();
    }
    await (0, db_1.connectDatabase)();
    const app = (0, app_1.createApp)();
    const server = (0, node_http_1.createServer)(app);
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${config_1.config.port} is already in use. Please clear it and try again.`);
        }
        else {
            console.error('Server error:', err);
        }
        process.exit(1);
    });
    server.listen(config_1.config.port, () => {
        console.log(`AI Marketing Studio backend listening on ${config_1.config.appUrl}`);
    });
};
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
boot().catch(async (error) => {
    console.error('Fatal boot error:', error);
    if (config_1.config.queueMode === 'bullmq') {
        await (0, queue_1.closeRedisConnections)();
    }
    // Only exit if the error happened during the actual boot sequence
    if (error.code === 'EADDRINUSE') {
        process.exit(1);
    }
});
