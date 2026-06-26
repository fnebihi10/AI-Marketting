"use strict";

// Importojmë libraritë për menaxhimin e skedarëve dhe shtigjeve (paths) të tyre
const fs = require("node:fs/promises");
const path = require("node:path");

// Importojmë modelin e të dhënave, konfigurimet dhe shërbimet e progresit
const { PhotoJob } = require("../models/PhotoJob");
const { config } = require("../config");
const { ensureDir, uniqueFile } = require("../utils/files");
const { publishJobProgress } = require("./jobProgressService");

/**
 * Gjeneron udhëzimet artistike (prompt + caption) nëpërmjet OpenAI.
 * Vetë gjenerimi i imazhit menaxhohet nga frontend-i përmes Puter.js.
 */
const generatePhotoArtDirection = async (description, style, category, isRedesign) => {
    // Këtu ndërtohet Prompti i fshehur për OpenAI
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

    // Dërgimi i kërkesës zyrtare te API i OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify({
            model: config.openAiModel,
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: 'json_object' }, // E detyron AI të kthejë format të pastër JSON
            max_tokens: 600,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[PhotoJob] OpenAI Error:', errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
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
 * FAZA 1: processPhotoJob
 * Krijon dosjen e punës në server dhe gjeneron idenë/promptin përmes OpenAI.
 * Pasi mbaron, njofton Frontend-in që "Prompti është gati, tani gjenero foton".
 */
const processPhotoJob = async (jobId) => {
    // Gjejmë punën në databazë sipas ID-së
    const job = await PhotoJob.findById(jobId);
    if (!job) return;

    const jobDir = path.join(config.workingDir, `photo-${job._id}`);
    await ensureDir(jobDir);

    // Ruajmë kohën e nisjes dhe rrugën e dosjes te të dhënat e punës
    job.metadata = { ...(job.metadata || {}), jobFolder: jobDir, startedAt: new Date() };

    try {
        const isRedesign = job.source === 'upload' && !!job.imagePath;

        await publishJobProgress(jobId, {
            status: 'processing',
            stage: 'writing-brief',
            progress: 20,
            message: 'Writing visual brief and image prompt...',
        });

        // Gjenerojmë udhëzimet artistike nëpërmjet OpenAI
        let artDirection;
        try {
            artDirection = await generatePhotoArtDirection(job.description, job.style, job.productCategory, isRedesign);
        } catch (apiError) {
            // FALLBACK: Nëse API dështon, krijojmë një prompt automatik të thjeshtë që të mos bllokohet sistemi
            console.warn('[PhotoJob] Falling back to manual prompt due to:', apiError);
            artDirection = {
                imagePrompt: `Professional marketing photography for ${job.description}, style: ${job.style}, category: ${job.productCategory}, high resolution, commercial lighting.`,
                caption: `Check out our new ${job.productCategory}! #marketing #ai #business`,
                audience: '',
                offer: '',
                proof: ''
            };
        }

        // Ruajmë të gjitha tekstet e gjeneruara në databazë
        job.prompt = artDirection.imagePrompt;
        job.caption = artDirection.caption;
        job.audience = artDirection.audience;
        job.offer = artDirection.offer;
        job.proof = artDirection.proof;
        await job.save();

        // Njoftojmë Frontend-in që jemi në 50%. Radhën e ka Frontend-i të thërrasë Puter AI për foton
        await publishJobProgress(jobId, {
            status: 'processing',
            stage: 'pending-image-generation',
            progress: 50,
            message: 'Prompt ready — generating image with Puter AI...',
            imagePrompt: artDirection.imagePrompt,
        });

    } catch (error) {
        // Nëse ndodh ndonjë gabim i rëndë gjatë rrugës, e shënojmë punën si "Dështuar" (failed)
        console.error('[PhotoJob] Orchestrator failure:', error.message);
        job.status = 'failed';
        job.error = error.message;
        await job.save();

        await publishJobProgress(jobId, {
            status: 'failed',
            stage: 'failed',
            progress: 0,
            message: `Error: ${error.message}`,
        });
    }
};

/**
 * FAZA 2: completePhotoJobWithImage
 * Ky funksion thirret nga Frontend-i pasi Puter AI ka mbaruar gjenerimin e fotos.
 * Merr foton e krijuar si `imageBuffer` (kod binar), e ruan në server dhe mbyll punën.
 */
const completePhotoJobWithImage = async (jobId, imageBuffer, mimeType) => {
    const job = await PhotoJob.findById(jobId);
    if (!job) throw new Error('Job not found.');

    // Sigurohemi që dosja ekziston
    const jobDir = path.join(config.workingDir, `photo-${job._id}`);
    await ensureDir(jobDir);

    // Gjejmë prapashtesën e duhur (.png ose .jpg) bazuar në llojin e skedarit (Mime Type)
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = uniqueFile('puter-generated', extension);
    const localPath = path.join(jobDir, fileName);

    // Shkruajmë skedarin në diskun lokal të serverit
    await fs.writeFile(localPath, imageBuffer);

    // Ndërtojmë URL-në publike se ku mund të aksesohet kjo foto nga interneti
    const variantUrl = `${config.backendUrl}/storage/work/photo-${job._id}/${fileName}`;
    const variant = {
        url: variantUrl,
        localPath,
        provider: 'puter',
        key: `photo/${job._id}/${fileName}`,
    };

    // Vendosim foton te rezultatet përfundimtare (output) të punës
    job.output = {
        ...job.output,
        variants: [variant],
        final: variant,
    };

    // Përditësojmë statuset finale
    job.status = 'completed';
    job.stage = 'completed';
    job.progress = 100;
    job.message = 'Image generated successfully with Puter AI.';
    job.metadata = { ...(job.metadata || {}), completedAt: new Date() };

    // Ruajmë ndryshimet përfundimtare në databazë dhe njoftojmë websocket-in
    await job.save();

    await publishJobProgress(jobId, {
        status: 'completed',
        stage: 'completed',
        progress: 100,
        message: 'Image generated successfully with Puter AI.',
        variants: job.output.variants,
    });

    return job;
};

// Eksportojmë funksionet në mënyrë standarde CommonJS
module.exports = {
    processPhotoJob,
    completePhotoJobWithImage
};