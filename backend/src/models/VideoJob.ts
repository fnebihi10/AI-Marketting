import mongoose, { Schema } from 'mongoose';

const mediaCandidateSchema = new Schema(
  {
    kind: String,
    source: String,
    externalId: String,
    url: String,
    thumbnailUrl: String,
    width: Number,
    height: Number,
    duration: Number,
    attribution: String,
    query: String,
    localPath: String,
    selectionScore: Number,
    selectionReason: String,
  },
  { _id: false }
);

const wordAlignmentSchema = new Schema(
  {
    text: String,
    start: Number,
    end: Number,
  },
  { _id: false }
);

const captionCueSchema = new Schema(
  {
    text: String,
    start: Number,
    end: Number,
  },
  { _id: false }
);

const sceneSchema = new Schema(
  {
    sceneNumber: Number,
    headline: String,
    voiceover: String,
    onScreenText: [String],
    pexelsKeywords: [String],
    visualBrief: String,
    imagePrompt: String,
    media: mediaCandidateSchema,
    voicePath: String,
    voiceDuration: Number,
    alignment: [wordAlignmentSchema],
    captions: [captionCueSchema],
  },
  { _id: false }
);

const storageAssetSchema = new Schema(
  {
    provider: String,
    key: String,
    url: String,
    localPath: String,
  },
  { _id: false }
);

const trimSchema = new Schema(
  {
    startSeconds: { type: Number, default: 0 },
    endSeconds: { type: Number, default: 0 },
    asset: storageAssetSchema,
  },
  { _id: false }
);

const videoJobSchema = new Schema(
  {
    status: { type: String, default: 'queued', index: true },
    stage: { type: String, default: 'queued' },
    progress: { type: Number, default: 0 },
    message: { type: String, default: 'Queued for generation.' },
    error: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, required: true },
    productCategory: { type: String, default: 'general-product' },
    style: { type: String, required: true },
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePaths: { type: [String], default: [] },
    imageUrls: { type: [String], default: [] },
    script: {
      title: String,
      hook: String,
      cta: String,
      hashtags: [String],
      musicMood: String,
      scenes: [sceneSchema],
    },
    output: {
      video: storageAssetSchema,
      preview: storageAssetSchema,
      voiceover: storageAssetSchema,
      trim: trimSchema,
      sceneFiles: [storageAssetSchema],
    },
    metadata: {
      jobFolder: String,
      durationSeconds: Number,
      sceneCount: Number,
      musicSource: String,
      queueJobId: String,
      startedAt: Date,
      completedAt: Date,
      failedAt: Date,
    },
  },
  { timestamps: true }
);

export const VideoJob =
  mongoose.models.VideoJob || mongoose.model('VideoJob', videoJobSchema);
