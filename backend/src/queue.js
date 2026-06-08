"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedisConnections = exports.ensureRedisConnection = exports.videoQueue = exports.VIDEO_QUEUE_NAME = exports.progressPublisher = exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const bullmq_1 = require("bullmq");
const config_1 = require("./config");
const createRedisClient = (label) => {
    let hasReportedFailure = false;
    const client = new ioredis_1.default(config_1.config.redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
    });
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
exports.redisConnection = config_1.config.queueMode === 'bullmq' ? createRedisClient('queue') : null;
exports.progressPublisher = config_1.config.queueMode === 'bullmq' ? createRedisClient('publisher') : null;
exports.VIDEO_QUEUE_NAME = 'video-generation';
exports.videoQueue = config_1.config.queueMode === 'bullmq' && exports.redisConnection
    ? new bullmq_1.Queue(exports.VIDEO_QUEUE_NAME, {
        connection: exports.redisConnection,
    })
    : null;
const ensureRedisConnection = async () => {
    if (!exports.redisConnection || !exports.progressPublisher) {
        return;
    }
    await Promise.all([exports.redisConnection.connect(), exports.progressPublisher.connect()]);
    await Promise.all([exports.redisConnection.ping(), exports.progressPublisher.ping()]);
};
exports.ensureRedisConnection = ensureRedisConnection;
const closeRedisConnections = async () => {
    const closers = [];
    if (exports.redisConnection) {
        closers.push(exports.redisConnection.quit());
    }
    if (exports.progressPublisher) {
        closers.push(exports.progressPublisher.quit());
    }
    await Promise.allSettled(closers);
};
exports.closeRedisConnections = closeRedisConnections;
