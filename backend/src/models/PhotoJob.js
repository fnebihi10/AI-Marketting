"use strict";

// Importojmë mongoose për manipulim me DB
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Ruajtja e të dhënave për foto sikurse tek photo ad
const storageAssetSchema = new Schema({
    provider: String,
    key: String,
    url: String,
    localPath: String,
}, { _id: false });

// Ndjekja e ecurisë së procesit të gjenerimit të fotos
const photoJobSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    // Statusi i punës që default është në queued, po ajo mund të jetë processing, failed, completed
    status: { type: String, default: 'queued', index: true },
    // Faza specifike se ku gjendet
    stage: { type: String, default: 'queued' },
    // Progresi nga 0 deri në 100
    progress: { type: Number, default: 0 },
    // Mesazhi informues se çfarë po bëhet aktualisht
    message: { type: String, default: 'Queued for design.' },
    // Errorri i dështimit
    error: { type: String, default: '' },
    // Të dhënat e inputit se çfarë kërkon useri
    title: { type: String, default: '' },
    description: { type: String, required: true },
    productCategory: { type: String, default: 'general-product' },
    style: { type: String, required: true },
    source: { type: String, enum: ['upload', 'prompt'], default: 'upload' },
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePaths: { type: [String], default: [] },
    imageUrls: { type: [String], default: [] },
    // Të dhënat për marketing: caption, audienca, proof, offer
    prompt: { type: String, default: '' },
    caption: { type: String, default: '' },
    audience: { type: String, default: '' },
    offer: { type: String, default: '' },
    proof: { type: String, default: '' },
    // Outputi se çfarë është krijuar
    output: {
        variants: [storageAssetSchema], // Foto që ka kthyer AI
        final: storageAssetSchema,
    },
    // Të dhënat e sistemit kur filloi, përfundoi, errori
    metadata: {
        jobFolder: String,
        startedAt: Date,
        completedAt: Date,
        failedAt: Date,
        replicatePredictionId: String,
    },
}, { timestamps: true });

// Krijojmë si dhe eksportojmë modelin në mënyrë standarde të Node.js
const PhotoJob = mongoose.models.PhotoJob || mongoose.model('PhotoJob', photoJobSchema);

module.exports = { PhotoJob };