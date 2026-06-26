# AI Marketing Studio MVP

AI Marketing Studio turns a product image and short product description into a 30-45 second vertical marketing video built for TikTok, Reels, and Shorts. The backend writes a scene-based script, finds Pexels media, generates Deepgram voiceover with timing metadata, renders animated captioned scenes through FFmpeg, and returns a downloadable MP4.

## Stack

- Backend: Node.js + Express + TypeScript
- Frontend: React + Vite + TailwindCSS + Framer Motion
- Database: MongoDB
- Queue: BullMQ + Redis
- AI: OpenAI
- Voice: Deepgram
- Media: Pexels with Replicate/Stability fallback
- Rendering: FFmpeg + fluent-ffmpeg
- Storage: Local by default, with S3 and Supabase adapters included

## Features

- Drag-and-drop landing page for product image upload and product brief entry
- Real-time generation progress over Server-Sent Events
- 4-6 scene script structure with hook, body, CTA, and scene search keywords
- Pexels-first video search with image fallback and optional AI style-transfer fallback
- Deepgram voiceover caching with alignment metadata and phrase-based captions
- FFmpeg scene rendering with text overlays, transitions, music ducking, and final MP4 export
- Trim/export workflow for the rendered video

## Project Structure

- `backend/` API server, worker, queue, media/voice/render services
- `frontend/` React generator studio
- `docker-compose.yml` MongoDB, Redis, backend, worker, frontend
- `setup.sh` one-click local bootstrap script for Ubuntu/Debian/macOS

## Environment Setup

1. Copy `backend/.env.example` to `backend/.env`
2. Copy `frontend/.env.example` to `frontend/.env`
3. Fill in these keys:
   - `OPENAI_API_KEY`
   - `PEXELS_API_KEY`
   - Optional experimental image fallbacks: `REPLICATE_API_TOKEN`, `STABILITY_API_KEY`
   - Optional storage provider keys for S3 or Supabase

## Local Development

### One-click setup

```bash
chmod +x setup.sh
./setup.sh
```

### Manual setup

```bash
npm install
npm install --workspace backend
npm install --workspace frontend
```

Start infrastructure:

```bash
docker compose up -d mongodb redis
```

Start the backend API:

```bash
npm run dev --workspace backend
```

Start the BullMQ worker:

```bash
npm run worker:dev --workspace backend
```

Start the frontend:

```bash
npm run dev --workspace frontend
```

## FFmpeg Notes

- `FFMPEG_PATH` and `FFPROBE_PATH` can point to system binaries
- `FFMPEG_FONT_PATH` should point to a bold font file used by `drawtext`
- The render pipeline assumes portrait output at `1080x1920`, `30fps`, `libx264`, `crf 23`

## Storage Modes

- `STORAGE_PROVIDER=local` stores final exports under `backend/storage/exports`
- `STORAGE_PROVIDER=s3` uploads to S3-compatible storage
- `STORAGE_PROVIDER=supabase` uploads to Supabase Storage

## Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`

## Test With Sample Product

Use this brief in the UI:

Product description:

`A collagen peptide powder for busy women 30+ who want healthier hair and skin without adding another complicated routine. Strawberry flavor, 20 servings, subscribe-and-save available today. The goal is to get first-time buyers to start a subscription.`

Recommended category: `beauty-skincare`

Recommended style: `luxury`

Expected quality checks:

- Hook immediately frames the transformation or pain point
- Pexels media feels relevant to wellness/beauty lifestyle rather than random stock
- Voiceover sounds persuasive instead of generic
- Stock clip duration fits the voice better instead of obviously looping
- Captions track the spoken phrases closely
- Final output contains clear CTA and polished end frame

Expected runtime:

- Scripts are generated for 4-6 scenes
- The generator targets a total runtime of 30-45 seconds
- Script prompting asks the model not to produce videos shorter than 28 seconds, though final runtime still depends on generated voiceover timing

## Notes

- For background music, set `LOCAL_MUSIC_PATH` to a royalty-free MP3 on disk. The renderer ducks the track under voiceover automatically.
- Replicate and Stability fallbacks are experimental and should usually stay off unless stock media is unavailable.
- Generated scripts and voice metadata are cached for 24 hours by default.
