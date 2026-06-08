"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoiceSegments = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const config_1 = require("../config");
const cacheService_1 = require("./cacheService");
const files_1 = require("../utils/files");
fluent_ffmpeg_1.default.setFfmpegPath(config_1.config.ffmpegPath);
fluent_ffmpeg_1.default.setFfprobePath(config_1.config.ffprobePath);
const DEEPGRAM_TTS_BASE_URL = 'https://api.deepgram.com/v1/speak';
const getDuration = (filePath) => new Promise((resolve, reject) => {
    fluent_ffmpeg_1.default.ffprobe(filePath, (error, data) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(data.format.duration || 0);
    });
});
const groupWordsIntoCaptions = (words) => {
    const captions = [];
    let current = [];
    const flush = () => {
        if (current.length === 0)
            return;
        captions.push({
            text: current.map((word) => word.text).join(' '),
            start: current[0].start,
            end: current[current.length - 1].end
        });
        current = [];
    };
    for (const word of words) {
        current.push(word);
        const shouldFlush = current.length >= 4 || /[.!?,]$/.test(word.text) || word.end - current[0].start > 1.8;
        if (shouldFlush) {
            flush();
        }
    }
    flush();
    return captions;
};
const estimateAlignment = (text, duration) => {
    const words = text
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean);
    if (words.length === 0) {
        return [];
    }
    const step = duration / words.length;
    return words.map((word, index) => ({
        text: word,
        start: Number((index * step).toFixed(3)),
        end: Number(((index + 1) * step).toFixed(3))
    }));
};
const synthesizeSegment = async (text, cachePath) => {
    const response = await fetch(`${DEEPGRAM_TTS_BASE_URL}?model=${encodeURIComponent(config_1.config.deepgramTtsModel)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${config_1.config.deepgramApiKey}`
        },
        body: JSON.stringify({ text })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram TTS failed: ${response.status} ${errorText}`);
    }
    await (0, files_1.ensureDir)(node_path_1.default.dirname(cachePath));
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await promises_1.default.writeFile(cachePath, audioBuffer);
};
const generateVoiceSegments = async ({ texts, workingDir }) => {
    if (!config_1.config.deepgramApiKey) {
        throw new Error('DEEPGRAM_API_KEY is missing.');
    }
    await (0, files_1.ensureDir)(workingDir);
    const segments = [];
    for (const [index, text] of texts.entries()) {
        const hash = (0, files_1.sha256)(`${config_1.config.deepgramTtsModel}:${text}`);
        const cachedAudioPath = node_path_1.default.join(config_1.config.cacheDir, 'voice', `${hash}.mp3`);
        const cacheKey = `voice:${hash}`;
        const cached = await (0, cacheService_1.getCache)(cacheKey);
        if (!(await (0, files_1.fileExists)(cachedAudioPath))) {
            await synthesizeSegment(text, cachedAudioPath);
        }
        const outputPath = node_path_1.default.join(workingDir, `voice-segment-${index + 1}.mp3`);
        await promises_1.default.copyFile(cachedAudioPath, outputPath);
        let duration = cached?.duration || 0;
        if (!duration) {
            duration = await getDuration(cachedAudioPath);
        }
        const alignment = cached?.alignment?.length
            ? cached.alignment
            : estimateAlignment(text, duration);
        if (!cached?.alignment?.length || !cached?.duration) {
            await (0, cacheService_1.setCache)(cacheKey, { alignment, duration });
        }
        segments.push({
            text,
            path: outputPath,
            duration,
            alignment,
            captions: groupWordsIntoCaptions(alignment)
        });
    }
    return segments;
};
exports.generateVoiceSegments = generateVoiceSegments;
