FROM node:22-bookworm-slim

ENV NODE_ENV=production

# Install FFmpeg and FFprobe together with their shared codec/runtime libraries.
# Keeping these in the image avoids App Platform's Aptfile runtime-library gaps.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        fonts-dejavu \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY assets ./assets

RUN mkdir -p storage/uploads storage/work storage/cache storage/exports \
    && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["npm", "start"]
