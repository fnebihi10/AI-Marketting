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
exports.PhotoJob = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const storageAssetSchema = new mongoose_1.Schema({
    provider: String,
    key: String,
    url: String,
    localPath: String,
}, { _id: false });
const photoJobSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.PhotoJob = mongoose_1.default.models.PhotoJob || mongoose_1.default.model('PhotoJob', photoJobSchema);
