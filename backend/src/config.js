"use strict";

// Importojmë mjetet për menaxhimin e rrugëve dhe skedarëve .env
const path = require("node:path");
const dotenv = require("dotenv");

// Ngarkon në memorie skedarin .env nga direktoria prind
dotenv.config({ path: path.join(__dirname, '../.env') });

// Gjen rrugën absolute të folderit rrënjë (root) të projektit
const rootDir = path.resolve(__dirname, '..');

// KONTROLLI I SISTEMIT OPERATIV: 
// Nëse serveri punon në Windows, përdor shkronjat Arial Bold. Nëse punon në Linux, përdor DejaVuSans.
// Kjo i duhet FFmpeg-ut që të dijë si të vizatojë tekstin e titrave mbi video.
const defaultFontPath = process.platform === 'win32'
    ? 'C:/Windows/Fonts/ARIALBD.TTF'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

// OBJEKTI QENDROR I KONFIGURIMIT
const config = {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 5000), // Porta ku ndizet serveri

    // URL-të e lidhjes mes Frontend-it dhe Backend-it
    appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`,
    backendUrl: process.env.APP_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // Databaza dhe Radha e Punëve (Queue)
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-marketing-studio',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    queueMode: process.env.QUEUE_MODE || 'memory',

    // Siguria e përdoruesve (Gjenerimi i Tokenave të Login-it)
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

    // INTEGRIMET E INTELEGJENCËS ARTIFIKALE (API Keys)
    // 1. OpenAI ose OpenRouter (për shkrimin e skenarit)
    openAiApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
    openAiModel: process.env.OPENAI_MODEL || 'gpt-4o',

    // 2. Deepgram (për leximin e zërit dhe titrat)
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
    deepgramTtsModel: process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',

    // KËRKIMI DHE GJENERIMI I PAMJEVE VIZUALE
    pexelsApiKey: process.env.PEXELS_API_KEY === 'your_pexels_api_key' ? '' : (process.env.PEXELS_API_KEY || ''),
    replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
    replicateModel: process.env.REPLICATE_MODEL || '',
    replicatePollIntervalMs: Number(process.env.REPLICATE_POLL_INTERVAL_MS || 1500),
    stabilityApiKey: process.env.STABILITY_API_KEY || '',
    stabilityEngineId: process.env.STABILITY_ENGINE_ID || 'stable-diffusion-xl-1024-v1-0',

    // Muzika e gatshme që vendoset në sfond nëse nuk ngarkohet një e re
    localMusicPath: process.env.LOCAL_MUSIC_PATH || path.join(rootDir, 'assets/music/default-bed.mp3'),

    // Binaries dhe Shtigjet për FFmpeg
    ffmpegPath: process.env.FFMPEG_PATH || path.join(rootDir, 'bin/ffmpeg.exe'),
    ffprobePath: process.env.FFPROBE_PATH || path.join(rootDir, 'bin/ffprobe.exe'),
    ffmpegFontPath: process.env.FFMPEG_FONT_PATH || defaultFontPath,
    cacheTtlHours: Number(process.env.CACHE_TTL_HOURS || 24),
    jobConcurrency: Number(process.env.JOB_CONCURRENCY || 2),

    // Shërbimi i dërgimit të emaileve (SMTP)
    email: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@ai-marketing.com',
    },

    // DOSJET/FOLDERAT LOKAL TË PUNËS SË SERVERIT
    rootDir,
    uploadsDir: path.join(rootDir, 'storage/uploads'),
    workingDir: path.join(rootDir, 'storage/work'),
    cacheDir: path.join(rootDir, 'storage/cache'),
    outputDir: path.join(rootDir, 'storage/exports'),

    // PAGESAT (STRIPE)
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

// KUSHTI JETIK: Gjatë ndezjes (Boot), serveri do të refuzojë të nisë nëse kjo vlerë mungon plotësisht!
const requiredAtBoot = ['MONGODB_URI'];

// Eksportohet i gjithë konfigurimi në stilin standard CommonJS
module.exports = {
    config,
    requiredAtBoot
};