"use strict";

// Importojmë modulet për menaxhimin e skedarëve (file system) dhe rrugëve në mënyrë standarde
const fs = require("node:fs/promises");
const path = require("node:path");

// Importojmë konfigurimet e projektit dhe funksionet ndihmëse
const { config } = require("../config");
const { uniqueFile, ensureDir } = require("../utils/files");
const { sleep } = require("../utils/sleep");

/**
 * Shkarkon një imazh nga një URL e jashtme dhe e ruan si PNG në server
 */
const saveRemoteImage = async (url, outputDir, label) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Image download failed: ${response.status}`);
    }
    
    // Krijojmë rrugën e skedarit dhe e shkruajmë buffer-in e të dhënave në disk
    const outputPath = path.join(outputDir, uniqueFile(label, 'png'));
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    return outputPath;
};

/**
 * 1. GJENERIMI I IMAZHEVE ME REPLICATE
 * Gjeneron imazhe me një stil të caktuar duke krijuar sfonde marketingu premium
 */
const createReplicateStyledImages = async ({ productImagePath, prompt, style, outputDir }) => {
    if (!config.replicateApiToken || !config.replicateModel) {
        return [];
    }

    // Lexojmë imazhin ekzistues dhe e kthejmë në formatin Data URL (base64) që pranon API
    const imageBuffer = await fs.readFile(productImagePath);
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    // Nisim kërkesën për të krijuar një parashikim (prediction) të ri në Replicate
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${config.replicateApiToken}`
        },
        body: JSON.stringify({
            model: config.replicateModel,
            input: {
                // Ndërtojmë prompt-in duke i shtuar terma reklamimi premium
                prompt: `${prompt}. Premium ${style} brand campaign background, product hero composition.`,
                image: imageDataUrl
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Replicate request failed: ${response.status} ${errorText}`);
    }

    const initial = await response.json();
    let prediction = initial;

    // MEKANIZMI POLLING: Meqenëse gjenerimi i imazhit merr kohë, bëjmë kërkesa të përsëritura (poll)
    // çdo pak sekonda derisa statusi të ndryshojë nga 'starting/processing' në diçka tjetër.
    while (prediction.status === 'starting' || prediction.status === 'processing') {
        await sleep(config.replicatePollIntervalMs);
        
        const pollResponse = await fetch(prediction.urls.get, {
            headers: {
                Authorization: `Token ${config.replicateApiToken}`
            }
        });

        if (!pollResponse.ok) {
            throw new Error('Replicate polling failed.');
        }
        prediction = await pollResponse.json();
    }

    // Nëse procesi nuk përfundoi me sukses, kthejmë një listë boshe
    if (prediction.status !== 'succeeded') {
        return [];
    }

    // Sigurohemi që ekziston dosja ku do të ruhen imazhet e reja
    await ensureDir(outputDir);
    
    const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
    const candidates = [];

    // Marrim deri në 3 imazhet e para të gjeneruara dhe i ruajmë lokalisht
    for (const [index, output] of outputs.slice(0, 3).entries()) {
        const localPath = await saveRemoteImage(String(output), outputDir, `replicate-${index + 1}`);
        candidates.push({
            kind: 'generated-image',
            source: 'replicate',
            url: output,
            width: 1080,
            height: 1920,
            query: prompt,
            localPath
        });
    }

    return candidates;
};

/**
 * 2. GJENERIMI REZERVË ME STABILITY AI
 * Përdoret si plan rezervë (fallback) nëse Replicate dështon ose nuk është i konfiguruar.
 * Gjeneron një imazh të ri nga teksti (Text-to-Image) duke përdorur API-në e Stability AI.
 */
const createStabilityFallbackImage = async ({ prompt, outputDir }) => {
    if (!config.stabilityApiKey) {
        return null;
    }

    const formData = new FormData();
    formData.append('text_prompts[0][text]', `${prompt}. Vertical advertising background, polished motion graphics energy, premium lighting.`);
    formData.append('cfg_scale', '8');
    formData.append('clip_guidance_preset', 'FAST_BLUE');
    formData.append('height', '1536');
    formData.append('width', '1024');
    formData.append('samples', '1');
    formData.append('steps', '30');

    // Bëjmë kërkesën te serveri i Stability AI
    const response = await fetch(`https://api.stability.ai/v1/generation/${config.stabilityEngineId}/text-to-image`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.stabilityApiKey}`,
            Accept: 'application/json'
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stability request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const artifact = payload.artifacts?.[0];

    if (!artifact?.base64) {
        return null;
    }

    await ensureDir(outputDir);
    const outputPath = path.join(outputDir, uniqueFile('stability-fallback', 'png'));
    await fs.writeFile(outputPath, Buffer.from(artifact.base64, 'base64'));

    return {
        kind: 'generated-image',
        source: 'stability',
        url: '',
        width: 1024,
        height: 1536,
        query: prompt,
        localPath: outputPath
    };
};

// Eksportojmë funksionet në mënyrë standarde të Node.js
module.exports = {
    createReplicateStyledImages,
    createStabilityFallbackImage
};