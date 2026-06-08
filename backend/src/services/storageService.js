"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAsset = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const mime_types_1 = __importDefault(require("mime-types"));
const client_s3_1 = require("@aws-sdk/client-s3");
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
const files_1 = require("../utils/files");
const uploadToLocal = async (sourcePath, key) => {
    const outputPath = node_path_1.default.join(config_1.config.outputDir, key);
    await (0, files_1.ensureDir)(node_path_1.default.dirname(outputPath));
    await promises_1.default.copyFile(sourcePath, outputPath);
    return {
        provider: 'local',
        key,
        localPath: outputPath,
        url: `${config_1.config.appUrl}/storage/${(0, files_1.normalizePathForUrl)(key)}`
    };
};
const uploadToS3 = async (sourcePath, key) => {
    const client = new client_s3_1.S3Client({
        region: config_1.config.s3Region,
        credentials: {
            accessKeyId: config_1.config.s3AccessKeyId,
            secretAccessKey: config_1.config.s3SecretAccessKey
        }
    });
    await client.send(new client_s3_1.PutObjectCommand({
        Bucket: config_1.config.s3Bucket,
        Key: key,
        Body: node_fs_1.default.createReadStream(sourcePath),
        ContentType: mime_types_1.default.lookup(sourcePath) || 'application/octet-stream'
    }));
    return {
        provider: 's3',
        key,
        url: config_1.config.s3PublicUrl
            ? `${config_1.config.s3PublicUrl.replace(/\/$/, '')}/${key}`
            : `https://${config_1.config.s3Bucket}.s3.${config_1.config.s3Region}.amazonaws.com/${key}`
    };
};
const uploadToSupabase = async (sourcePath, key) => {
    const client = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceRoleKey);
    const fileBuffer = await promises_1.default.readFile(sourcePath);
    const contentType = mime_types_1.default.lookup(sourcePath) || 'application/octet-stream';
    const { error } = await client.storage.from(config_1.config.supabaseBucket).upload(key, fileBuffer, {
        contentType,
        upsert: true
    });
    if (error) {
        throw error;
    }
    const { data } = client.storage.from(config_1.config.supabaseBucket).getPublicUrl(key);
    return {
        provider: 'supabase',
        key,
        url: data.publicUrl
    };
};
const uploadAsset = async (sourcePath, key) => {
    if (config_1.config.storageProvider === 's3') {
        return uploadToS3(sourcePath, key);
    }
    if (config_1.config.storageProvider === 'supabase') {
        return uploadToSupabase(sourcePath, key);
    }
    return uploadToLocal(sourcePath, key);
};
exports.uploadAsset = uploadAsset;
