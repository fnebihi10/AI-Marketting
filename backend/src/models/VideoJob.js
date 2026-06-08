"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoJob = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const mediaCandidateSchema = new mongoose_1.Schema({
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
}, { _id: false });
const wordAlignmentSchema = new mongoose_1.Schema({
    text: String,
    start: Number,
    end: Number,
}, { _id: false });
const captionCueSchema = new mongoose_1.Schema({
    text: String,
    start: Number,
    end: Number,
}, { _id: false });
const sceneSchema = new mongoose_1.Schema({
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
}, { _id: false });
const storageAssetSchema = new mongoose_1.Schema({
    provider: String,
    key: String,
    url: String,
    localPath: String,
}, { _id: false });
const trimSchema = new mongoose_1.Schema({
    startSeconds: { type: Number, default: 0 },
    endSeconds: { type: Number, default: 0 },
    asset: storageAssetSchema,
}, { _id: false });
const videoJobSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.VideoJob = mongoose_1.default.models.VideoJob || mongoose_1.default.model('VideoJob', videoJobSchema);
