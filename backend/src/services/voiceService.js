"use strict";

// Importimi i librarive native të Node.js
const fsPromises = require("node:fs/promises");
const path = require("node:path");

// Importimi i librarive të palëve të treta
const ffmpeg = require("fluent-ffmpeg");

// Importimi i konfigurimeve dhe shërbimeve lokale
const { config } = require("../config");
const { getCache, setCache } = require("./cacheService");
const { ensureDir, fileExists, sha256 } = require("../utils/files");

// Konfigurimi i shtigjeve për ffmpeg dhe ffprobe
ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

// Adresa bazë e komunikimit me Deepgram API (Text-to-Speech)
const DEEPGRAM_TTS_BASE_URL = 'https://api.deepgram.com/v1/speak';

/**
 * FUNKSIONI NDIHMËS: getDuration
 * Mat saktësisht se sa sekonda zgjat skedari audio .mp3 i gjeneruar.
 */
const getDuration = (filePath) => new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(data.format.duration || 0);
    });
});

/**
 * FUNKSIONI: groupWordsIntoCaptions
 * Merr fjalët e njëpasnjëshme dhe i paketon në grupe të vogla titrash (Captions).
 * Ndarja bëhet nëse:
 * 1. Janë bërë më shumë se 4 fjalë rresht.
 * 2. Ka një shenjë pikësimi (. ! ? ,).
 * 3. Kohëzgjatja e fjalisë kalon 1.8 sekonda.
 */
const groupWordsIntoCaptions = (words) => {
    const captions = [];
    let current = [];

    const flush = () => {
        if (current.length === 0) return;
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

/**
 * FUNKSIONI: estimateAlignment
 * Nëse Deepgram nuk na kthen kohën e saktë për çdo fjalë, ky funksion bën një llogaritje matematike:
 * Pjesëton kohën totale të audios me numrin e fjalëve për të gjetur përafërsisht sekondat e çdo fjale.
 */
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

/**
 * FUNKSIONI: synthesizeSegment
 * Lidhet me Deepgram API, i dërgon tekstin dhe ruan audion e kthyer në server.
 */
const synthesizeSegment = async (text, cachePath) => {
    const response = await fetch(`${DEEPGRAM_TTS_BASE_URL}?model=${encodeURIComponent(config.deepgramTtsModel)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${config.deepgramApiKey}`
        },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram TTS failed: ${response.status} ${errorText}`);
    }

    await ensureDir(path.dirname(cachePath));
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await fsPromises.writeFile(cachePath, audioBuffer);
};

/**
 * ORKESTRUESI KRYESOR: generateVoiceSegments
 * Merr një listë me tekste (për çdo skenë) dhe kthen objektet audio të gatshme dhe të sinkronizuara.
 */
const generateVoiceSegments = async ({ texts, workingDir }) => {
    if (!config.deepgramApiKey) {
        throw new Error('DEEPGRAM_API_KEY is missing.');
    }

    await ensureDir(workingDir);
    const segments = [];

    for (const [index, text] of texts.entries()) {
        // Krijon një kod unik (Hash SHA256) bazuar te teksti dhe modeli i zërit
        const hash = sha256(`${config.deepgramTtsModel}:${text}`);
        const cachedAudioPath = path.join(config.cacheDir, 'voice', `${hash}.mp3`);
        const cacheKey = `voice:${hash}`;

        // Kontrollon nëse ky segment ekziston në cache
        const cached = await getCache(cacheKey);

        // Nëse skedari audio nuk ekziston fizikisht në server, thërret Deepgram-in
        if (!(await fileExists(cachedAudioPath))) {
            await synthesizeSegment(text, cachedAudioPath);
        }

        // Kopjon audion nga folderi i cache-it te folderi i punës aktuale
        const outputPath = path.join(workingDir, `voice-segment-${index + 1}.mp3`);
        await fsPromises.copyFile(cachedAudioPath, outputPath);

        // Gjen kohëzgjatjen e audios (nga cache ose duke e matur direkt me ffprobe)
        let duration = cached?.duration || 0;
        if (!duration) {
            duration = await getDuration(cachedAudioPath);
        }

        // Sinkronizon kohën e fjalëve (përdor të dhënat e cache-it ose llogaritjen e përafërt)
        const alignment = cached?.alignment?.length
            ? cached.alignment
            : estimateAlignment(text, duration);

        // Nëse nuk ka qenë në cache, e ruan tani për herët e tjera
        if (!cached?.alignment?.length || !cached?.duration) {
            await setCache(cacheKey, { alignment, duration });
        }

        segments.push({
            text,
            path: outputPath,
            duration,
            alignment,
            captions: groupWordsIntoCaptions(alignment) // Këtu krijohen grupet e titrave
        });
    }

    return segments;
};

// Eksportojmë funksionin në stilin standard CommonJS
module.exports = {
    generateVoiceSegments
};