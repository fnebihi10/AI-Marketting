"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadToFile = void 0;
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const promises_1 = require("node:stream/promises");
const node_path_1 = __importDefault(require("node:path"));
const files_1 = require("../utils/files");
const downloadToFile = async ({ url, outputDir, label, extension, retries = 3 }) => {
    await (0, files_1.ensureDir)(outputDir);
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Download] Attempt ${attempt}/${retries} for ${label}: ${url}`);
            const response = await fetch(url);
            if (!response.ok || !response.body) {
                throw new Error(`Failed to download asset: ${response.status} ${url}`);
            }
            const outputPath = node_path_1.default.join(outputDir, (0, files_1.uniqueFile)(label, extension));
            await (0, promises_1.pipeline)(node_stream_1.Readable.fromWeb(response.body), (0, node_fs_1.createWriteStream)(outputPath));
            return outputPath;
        }
        catch (error) {
            if (attempt === retries)
                throw error;
            console.warn(`[Download] Attempt ${attempt} failed: ${error.message}. Retrying in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('Download failed after multiple attempts.');
};
exports.downloadToFile = downloadToFile;
