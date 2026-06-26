"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relativeFrom = exports.fileExists = exports.normalizePathForUrl = exports.sha256 = exports.uniqueFile = exports.slugify = exports.ensureDir = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const ensureDir = async (dirPath) => {
    await promises_1.default.mkdir(dirPath, { recursive: true });
};
exports.ensureDir = ensureDir;
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';
exports.slugify = slugify;
const uniqueFile = (baseName, extension) => `${(0, exports.slugify)(baseName)}-${node_crypto_1.default.randomUUID()}.${extension.replace(/^\./, '')}`;
exports.uniqueFile = uniqueFile;
const sha256 = (value) => node_crypto_1.default.createHash('sha256').update(value).digest('hex');
exports.sha256 = sha256;
const normalizePathForUrl = (value) => value.replace(/\\/g, '/');
exports.normalizePathForUrl = normalizePathForUrl;
const fileExists = async (filePath) => {
    try {
        await promises_1.default.access(filePath);
        return true;
    }
    catch {
        return false;
    }
};
exports.fileExists = fileExists;
const relativeFrom = (from, to) => (0, exports.normalizePathForUrl)(node_path_1.default.relative(from, to));
exports.relativeFrom = relativeFrom;
