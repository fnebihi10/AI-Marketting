"use strict";

// Importojmë radhët e punës (queue), modelet e databazës dhe sistemet e eventeve
const { progressPublisher } = require("../queue");
const { VideoJob } = require("../models/VideoJob");
const { PhotoJob } = require("../models/PhotoJob");
const { config } = require("../config");
const { localJobEvents } = require("./localEventBus");

/**
 * Krijon një emër unik kanali bazuar në ID-në e punës (job)
 */
const channelForJob = (jobId) => `job-progress:${jobId}`;

/**
 * Përditëson progresin e punës në databazë dhe njofton sistemin e eventeve
 */
const publishJobProgress = async (jobId, payload) => {
    // Përgatitim të dhënat e reja që do të ruhen në DB
    const updateData = {
        status: payload.status,       // Statusi i ri (processing, completed, failed)
        stage: payload.stage,         // Faza aktuale (writing-script, rendering-video, etj.)
        progress: payload.progress,   // Përqindja e progresit (0-100)
        message: payload.message,     // Mesazhi shoqërues për frontend-in
        error: payload.error || '',   // Mesazhi i gabimit nëse ka dështuar punimi

        // Shtohen në objekt vetëm nëse ekzistojnë në kërkesë (URL-të e rezultateve finale)
        ...(payload.videoUrl ? { 'output.video.url': payload.videoUrl } : {}),
        ...(payload.previewUrl ? { 'output.preview.url': payload.previewUrl } : {}),
        ...(payload.trimUrl ? { 'output.trim.asset.url': payload.trimUrl } : {}),
        ...(payload.variants ? { 'output.variants': payload.variants } : {}),
    };

    // Provon të gjejë dhe përditësojë punën si VideoJob
    let updated = await VideoJob.findByIdAndUpdate(jobId, updateData);
    
    // Nëse nuk gjendet si VideoJob, provon ta gjejë dhe përditësojë si PhotoJob
    if (!updated) {
        updated = await PhotoJob.findByIdAndUpdate(jobId, updateData);
    }

    // Njofton sistemin lokal të eventeve (për proceset e brendshme të Node.js)
    localJobEvents.emit(channelForJob(jobId), payload);

    // Nëse aplikacioni është konfiguruar me Redis/BullMQ, publikon progresin për WebSockets
    if (config.queueMode === 'bullmq' && progressPublisher) {
        await progressPublisher.publish(channelForJob(jobId), JSON.stringify(payload));
    }
};

// Eksportojmë funksionet në mënyrë standarde të Node.js
module.exports = {
    publishJobProgress,
    getJobChannel: channelForJob
};