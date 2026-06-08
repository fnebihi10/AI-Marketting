"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobChannel = exports.publishJobProgress = void 0;
const queue_1 = require("../queue");
const VideoJob_1 = require("../models/VideoJob");
const PhotoJob_1 = require("../models/PhotoJob");
const config_1 = require("../config");
const localEventBus_1 = require("./localEventBus");
const channelForJob = (jobId) => `job-progress:${jobId}`;
const publishJobProgress = async (jobId, payload) => {
    const updateData = {
        status: payload.status,
        stage: payload.stage,
        progress: payload.progress,
        message: payload.message,
        error: payload.error || '',
        ...(payload.videoUrl ? { 'output.video.url': payload.videoUrl } : {}),
        ...(payload.previewUrl ? { 'output.preview.url': payload.previewUrl } : {}),
        ...(payload.trimUrl ? { 'output.trim.asset.url': payload.trimUrl } : {}),
        ...(payload.variants ? { 'output.variants': payload.variants } : {}),
    };
    // Try updating VideoJob first
    let updated = await VideoJob_1.VideoJob.findByIdAndUpdate(jobId, updateData);
    // If not found, try PhotoJob
    if (!updated) {
        updated = await PhotoJob_1.PhotoJob.findByIdAndUpdate(jobId, updateData);
    }
    localEventBus_1.localJobEvents.emit(channelForJob(jobId), payload);
    if (config_1.config.queueMode === 'bullmq' && queue_1.progressPublisher) {
        await queue_1.progressPublisher.publish(channelForJob(jobId), JSON.stringify(payload));
    }
};
exports.publishJobProgress = publishJobProgress;
exports.getJobChannel = channelForJob;
