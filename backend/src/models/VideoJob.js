"use strict";

// Importojmë mongoose për të bërë manipulime në DB
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Ruajmë videot që gjenden nga pexels
const mediaCandidateSchema = new Schema({
    kind: String,         // Lloji i videos
    source: String,       // Burimi që është pexels
    externalId: String,   // ID e videove që merren nga pexels
    url: String,          // Linku i videos origjinale
    thumbnailUrl: String,
    width: Number,        // Përmasat e videos
    height: Number,
    duration: Number,     // Kohëzgjatja e videos
    attribution: String,
    query: String,        // Fjala që përdoret nga AI për të kërkuar videon
    localPath: String,    // Ku u shkarkua videoja përkohësisht në serverin tonë
    selectionScore: Number,
    selectionReason: String,
}, { _id: false });

const wordAlignmentSchema = new Schema({
    text: String,
    start: Number,
    end: Number,
}, { _id: false });

const captionCueSchema = new Schema({
    text: String,
    start: Number,
    end: Number,
}, { _id: false });

const sceneSchema = new Schema({
    sceneNumber: Number,     // Numri i skenës
    headline: String,        // Titulli kryesor i skenës
    voiceover: String,       // Teksti që zeri i AI do ta lexojë me audio
    onScreenText: [String],  // Tekstet që shkruhen si caption
    pexelsKeywords: [String], // Fjalët kyçe për të gjetur videon
    visualBrief: String,     // Udhëzuesi vizual
    imagePrompt: String,     // Prompti për foto
    media: mediaCandidateSchema, // Videoja përfundimtare e zgjedhur nga pexels për këtë skenë
    voicePath: String,       // Ruajtja e audios
    voiceDuration: Number,   // Sa sekonda zgjat zëri në skenë
    alignment: [wordAlignmentSchema],
    captions: [captionCueSchema],
}, { _id: false });

const storageAssetSchema = new Schema({
    provider: String,
    key: String,
    url: String,
    localPath: String,
}, { _id: false });

const trimSchema = new Schema({
    startSeconds: { type: Number, default: 0 },
    endSeconds: { type: Number, default: 0 },
    asset: storageAssetSchema,
}, { _id: false });

const videoJobSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    status: { type: String, default: 'queued', index: true },
    stage: { type: String, default: 'queued' }, // Faza: "writing_script", "generate_voice", "rendering_video"
    progress: { type: Number, default: 0 },     // Përqindja e progresit 0-100
    message: { type: String, default: 'Queued for generation.' },
    error: { type: String, default: '' },
    // Inputet nga përdoruesi
    title: { type: String, default: '' },
    description: { type: String, required: true },
    productCategory: { type: String, default: 'general-product' },
    style: { type: String, required: true },
    // Foto të produktit nëse përdoruesi ka vendosur t'i vendosë në video
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imagePaths: { type: [String], default: [] },
    imageUrls: { type: [String], default: [] },
    // Të dhënat e marketingut
    audience: { type: String, default: '' },
    offer: { type: String, default: '' },
    proof: { type: String, default: '' },
    caption: { type: String, default: '' },
    script: {
        title: String,
        hook: String,
        cta: String,
        hashtags: [String],
        musicMood: String,
        scenes: [sceneSchema],
    },
    // Outputi përfundimtar
    output: {
        video: storageAssetSchema,
        preview: storageAssetSchema,
        voiceover: storageAssetSchema,
        trim: trimSchema,
        sceneFiles: [storageAssetSchema],
    },
    // Metadata teknike për sistemin e rradhës
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
}, { timestamps: true });

// Krijojmë dhe eksportojmë modelin në mënyrë standarde të Node.js
const VideoJob = mongoose.models.VideoJob || mongoose.model('VideoJob', videoJobSchema);

module.exports = { VideoJob };