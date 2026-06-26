const dotenv = require('dotenv');//ngarkon librarin per lexuar varibalat nga env 
const path = require('path');//merret me menaxhimin e pathave te fileve

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });
 
// definon konfigurimin e appit duke marr vlerat nga env ose duke vendosur vlera default nese nuk jane te definuara
const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  backendUrl: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  pexelsApiKey: process.env.PEXELS_API_KEY,
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  deepgramTtsModel: process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  geminiTtsModel: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
  geminiTtsVoice: process.env.GEMINI_TTS_VOICE || 'Kore',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffmpegFontPath: process.env.FFMPEG_FONT_PATH || 'C:/Windows/Fonts/arial.ttf',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@ai-marketing.com',
  },
};

// validim per te siguruar qe variablat e rendishme jane
const requiredKeys = ['MONGODB_URI', 'JWT_SECRET', 'OPENAI_API_KEY'];
requiredKeys.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️ Warning: ${key} environment variable is missing!`);
  }
});

module.exports = config;
