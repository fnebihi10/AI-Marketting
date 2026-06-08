"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completePhotoJobWithImage = exports.processPhotoJob = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const PhotoJob_1 = require("../models/PhotoJob");
const config_1 = require("../config");
const files_1 = require("../utils/files");
const jobProgressService_1 = require("./jobProgressService");
/**
 * Generates art direction (prompt + caption) via OpenRouter.
 * Image generation itself is handled by the frontend via Puter.js.
 */
const generatePhotoArtDirection = async (description, style, category, isRedesign) => {
    const prompt = `Act as a high-end commercial photographer and social media strategist.
  Generate a professional "Visual Brief" and "AI Image Prompt" for a marketing photo, AND a catchy social media caption.
  Product: ${description}
  Category: ${category}
  Creative Style: ${style}
  Task: ${isRedesign ? 'Redesign environment while keeping product recognizable.' : 'Create fresh marketing photo.'}
  Requirements:
  - imagePrompt: 8k commercial photography, premium lighting, cinematic composition. NO TEXT. Keep it under 200 characters.
  - caption: A persuasive social media post (hook + CTA) including 4-6 relevant hashtags.
  - audience: Primary buyer persona (concise, 10-15 words).
  - offer: The core deal or promise (concise, 10-15 words).
  - proof: Why trust this product (concise, 10-15 words).
  Return ONLY a JSON object with keys: "imagePrompt", "caption", "audience", "offer", "proof".`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config_1.config.openAiApiKey}`,
        },
        body: JSON.stringify({
            model: config_1.config.openAiModel,
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: 600,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[PhotoJob] OpenRouter Error:', errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
    }
    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return {
        imagePrompt: content.imagePrompt || '',
        caption: content.caption || '',
        audience: content.audience || '',
        offer: content.offer || '',
        proof: content.proof || '',
    };
};
/**
 * Phase 1: Create job record and generate art direction prompt.
 * The frontend then calls Puter.js with the prompt and uploads the result.
 */
const processPhotoJob = async (jobId) => {
    const job = await PhotoJob_1.PhotoJob.findById(jobId);
    if (!job)
        return;
    const jobDir = node_path_1.default.join(config_1.config.workingDir, `photo-${job._id}`);
    await (0, files_1.ensureDir)(jobDir);
    job.metadata = { ...(job.metadata || {}), jobFolder: jobDir, startedAt: new Date() };
    try {
        const isRedesign = job.source === 'upload' && !!job.imagePath;
        await (0, jobProgressService_1.publishJobProgress)(jobId, {
            status: 'processing',
            stage: 'writing-brief',
            progress: 20,
            message: 'Writing visual brief and image prompt...',
        });
        // Generate art direction via OpenRouter
        let artDirection;
        try {
            artDirection = await generatePhotoArtDirection(job.description, job.style, job.productCategory, isRedesign);
        }
        catch (apiError) {
            console.warn('[PhotoJob] Falling back to manual prompt due to:', apiError);
            artDirection = {
                imagePrompt: `Professional marketing photography for ${job.description}, style: ${job.style}, category: ${job.productCategory}, high resolution, commercial lighting.`,
                caption: `Check out our new ${job.productCategory}! #marketing #ai #business`
            };
        }
        job.prompt = artDirection.imagePrompt;
        job.caption = artDirection.caption;
        job.audience = artDirection.audience;
        job.offer = artDirection.offer;
        job.proof = artDirection.proof;
        await job.save();
        // Emit "pending-image-generation" — frontend will call Puter.js
        await (0, jobProgressService_1.publishJobProgress)(jobId, {
            status: 'processing',
            stage: 'pending-image-generation',
            progress: 50,
            message: 'Prompt ready — generating image with Puter AI...',
            imagePrompt: artDirection.imagePrompt,
        });
    }
    catch (error) {
        console.error('[PhotoJob] Orchestrator failure:', error.message);
        job.status = 'failed';
        job.error = error.message;
        await job.save();
        await (0, jobProgressService_1.publishJobProgress)(jobId, {
            status: 'failed',
            stage: 'failed',
            progress: 0,
            message: `Error: ${error.message}`,
        });
    }
};
exports.processPhotoJob = processPhotoJob;
/**
 * Phase 2: Called by the frontend after Puter image generation is complete.
 * Accepts the generated image buffer and finalises the job.
 */
const completePhotoJobWithImage = async (jobId, imageBuffer, mimeType) => {
    const job = await PhotoJob_1.PhotoJob.findById(jobId);
    if (!job)
        throw new Error('Job not found.');
    const jobDir = node_path_1.default.join(config_1.config.workingDir, `photo-${job._id}`);
    await (0, files_1.ensureDir)(jobDir);
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = (0, files_1.uniqueFile)('puter-generated', extension);
    const localPath = node_path_1.default.join(jobDir, fileName);
    await promises_1.default.writeFile(localPath, imageBuffer);
    const variantUrl = `${config_1.config.backendUrl}/storage/work/photo-${job._id}/${fileName}`;
    const variant = {
        url: variantUrl,
        localPath,
        provider: 'puter',
        key: `photo/${job._id}/${fileName}`,
    };
    job.output = {
        ...job.output,
        variants: [variant],
        final: variant,
    };
    job.status = 'completed';
    job.stage = 'completed';
    job.progress = 100;
    job.message = 'Image generated successfully with Puter AI.';
    job.metadata = { ...(job.metadata || {}), completedAt: new Date() };
    await job.save();
    await (0, jobProgressService_1.publishJobProgress)(jobId, {
        status: 'completed',
        stage: 'completed',
        progress: 100,
        message: 'Image generated successfully with Puter AI.',
        variants: job.output.variants,
    });
    return job;
};
exports.completePhotoJobWithImage = completePhotoJobWithImage;
