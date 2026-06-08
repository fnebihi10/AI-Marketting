"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStabilityFallbackImage = exports.createReplicateStyledImages = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const files_1 = require("../utils/files");
const sleep_1 = require("../utils/sleep");
const saveRemoteImage = async (url, outputDir, label) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Image download failed: ${response.status}`);
    }
    const outputPath = node_path_1.default.join(outputDir, (0, files_1.uniqueFile)(label, 'png'));
    const buffer = Buffer.from(await response.arrayBuffer());
    await promises_1.default.writeFile(outputPath, buffer);
    return outputPath;
};
const createReplicateStyledImages = async ({ productImagePath, prompt, style, outputDir }) => {
    if (!config_1.config.replicateApiToken || !config_1.config.replicateModel) {
        return [];
    }
    const imageBuffer = await promises_1.default.readFile(productImagePath);
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${config_1.config.replicateApiToken}`
        },
        body: JSON.stringify({
            model: config_1.config.replicateModel,
            input: {
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
    while (prediction.status === 'starting' || prediction.status === 'processing') {
        await (0, sleep_1.sleep)(config_1.config.replicatePollIntervalMs);
        const pollResponse = await fetch(prediction.urls.get, {
            headers: {
                Authorization: `Token ${config_1.config.replicateApiToken}`
            }
        });
        if (!pollResponse.ok) {
            throw new Error('Replicate polling failed.');
        }
        prediction = await pollResponse.json();
    }
    if (prediction.status !== 'succeeded') {
        return [];
    }
    await (0, files_1.ensureDir)(outputDir);
    const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
    const candidates = [];
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
exports.createReplicateStyledImages = createReplicateStyledImages;
const createStabilityFallbackImage = async ({ prompt, outputDir }) => {
    if (!config_1.config.stabilityApiKey) {
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
    const response = await fetch(`https://api.stability.ai/v1/generation/${config_1.config.stabilityEngineId}/text-to-image`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config_1.config.stabilityApiKey}`,
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
    await (0, files_1.ensureDir)(outputDir);
    const outputPath = node_path_1.default.join(outputDir, (0, files_1.uniqueFile)('stability-fallback', 'png'));
    await promises_1.default.writeFile(outputPath, Buffer.from(artifact.base64, 'base64'));
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
exports.createStabilityFallbackImage = createStabilityFallbackImage;
