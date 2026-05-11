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

const photoAdSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    title: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true },
    aspectRatio: { type: String, default: '1:1' },
    productCategory: { type: String, default: 'general-product' },
    style: { type: String, default: 'minimal' },
    source: { type: String, default: 'puter' },
    images: {
      type: [storageAssetSchema],
      default: []
    }
  },
  { timestamps: true }
);

photoAdSchema.index({ owner: 1, createdAt: -1 });

export const PhotoAd =
  mongoose.models.PhotoAd || mongoose.model('PhotoAd', photoAdSchema);
