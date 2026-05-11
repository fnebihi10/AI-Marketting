import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const rootDir = path.resolve(__dirname, '..');
const defaultFontPath =
  process.platform === 'win32'
    ? 'C:/Windows/Fonts/ARIALBD.TTF'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`,
  backendUrl: process.env.APP_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-marketing-studio',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  queueMode: process.env.QUEUE_MODE || 'memory',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  openAiApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  deepgramTtsModel: process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY === 'your_elevenlabs_api_key' ? '' : (process.env.ELEVENLABS_API_KEY || ''),
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
  pexelsApiKey: process.env.PEXELS_API_KEY === 'your_pexels_api_key' ? '' : (process.env.PEXELS_API_KEY || ''),
  replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
  replicateModel: process.env.REPLICATE_MODEL || '',
  replicatePollIntervalMs: Number(process.env.REPLICATE_POLL_INTERVAL_MS || 1500),
  stabilityApiKey: process.env.STABILITY_API_KEY || '',
  stabilityEngineId: process.env.STABILITY_ENGINE_ID || 'stable-diffusion-xl-1024-v1-0',
  pixabayApiKey: process.env.PIXABAY_API_KEY || '',
  localMusicPath: process.env.LOCAL_MUSIC_PATH || path.join(rootDir, 'assets/music/default-bed.mp3'),
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  s3PublicUrl: process.env.S3_PUBLIC_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || '',
  ffmpegPath: process.env.FFMPEG_PATH || path.join(rootDir, 'bin/ffmpeg.exe'),
  ffprobePath: process.env.FFPROBE_PATH || path.join(rootDir, 'bin/ffprobe.exe'),
  ffmpegFontPath: process.env.FFMPEG_FONT_PATH || defaultFontPath,
  cacheTtlHours: Number(process.env.CACHE_TTL_HOURS || 24),
  jobConcurrency: Number(process.env.JOB_CONCURRENCY || 2),
  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@ai-marketing.com',
  },
  rootDir,
  uploadsDir: path.join(rootDir, 'storage/uploads'),
  workingDir: path.join(rootDir, 'storage/work'),
  cacheDir: path.join(rootDir, 'storage/cache'),
  outputDir: path.join(rootDir, 'storage/exports'),
};

export const requiredAtBoot = ['MONGODB_URI'] as const;

module.exports = Object.assign(config, {
  config,
  requiredAtBoot,
});
