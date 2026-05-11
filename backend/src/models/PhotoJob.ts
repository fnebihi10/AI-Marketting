import mongoose, { Schema } from 'mongoose';

const storageAssetSchema = new Schema(
  {
    provider: String,
    key: String,
    url: String,
    localPath: String,
  },
  { _id: false }
);

const photoJobSchema = new Schema(
  {
    status: { type: String, default: 'queued', index: true },
    stage: { type: String, default: 'queued' },
    progress: { type: Number, default: 0 },
    message: { type: String, default: 'Queued for design.' },
    error: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, required: true },
    productCategory: { type: String, default: 'general-product' },
    style: { type: String, required: true },
    source: { type: String, enum: ['upload', 'prompt'], default: 'upload' },
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePaths: { type: [String], default: [] },
    imageUrls: { type: [String], default: [] },
    prompt: { type: String, default: '' },
    caption: { type: String, default: '' },
    audience: { type: String, default: '' },
    offer: { type: String, default: '' },
    proof: { type: String, default: '' },
    output: {
      variants: [storageAssetSchema],
      final: storageAssetSchema,
    },
    metadata: {
      jobFolder: String,
      startedAt: Date,
      completedAt: Date,
      failedAt: Date,
      replicatePredictionId: String,
    },
  },
  { timestamps: true }
);

export const PhotoJob =
  mongoose.models.PhotoJob || mongoose.model('PhotoJob', photoJobSchema);
