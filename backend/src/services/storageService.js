"use strict";

// Importojmë modulet native të Node.js për menaxhimin e skedarëve dhe shtigjeve
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

// Importojmë libraritë e palëve të treta
const mime = require("mime-types");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");

// Importojmë konfigurimet dhe funksionet ndihmëse lokale
const { config } = require("../config");
const { ensureDir, normalizePathForUrl } = require("../utils/files");

/**
 * Ngarkon skedarin në memorien lokale të serverit (Fallback)
 */
const uploadToLocal = async (sourcePath, key) => {
    const outputPath = path.join(config.outputDir, key);
    await ensureDir(path.dirname(outputPath));
    await fsPromises.copyFile(sourcePath, outputPath);
    
    return {
        provider: 'local',
        key,
        localPath: outputPath,
        url: `${config.appUrl}/storage/${normalizePathForUrl(key)}`
    };
};

/**
 * Ngarkon skedarin në AWS S3 Cloud Storage
 */
const uploadToS3 = async (sourcePath, key) => {
    const client = new S3Client({
        region: config.s3Region,
        credentials: {
            accessKeyId: config.s3AccessKeyId,
            secretAccessKey: config.s3SecretAccessKey
        }
    });

    await client.send(new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: fs.createReadStream(sourcePath),
        ContentType: mime.lookup(sourcePath) || 'application/octet-stream'
    }));

    return {
        provider: 's3',
        key,
        url: config.s3PublicUrl
            ? `${config.s3PublicUrl.replace(/\/$/, '')}/${key}`
            : `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${key}`
    };
};

/**
 * Ngarkon skedarin në Supabase Storage Bucket
 */
const uploadToSupabase = async (sourcePath, key) => {
    const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
    const fileBuffer = await fsPromises.readFile(sourcePath);
    const contentType = mime.lookup(sourcePath) || 'application/octet-stream';

    const { error } = await client.storage.from(config.supabaseBucket).upload(key, fileBuffer, {
        contentType,
        upsert: true
    });

    if (error) {
        throw error;
    }

    const { data } = client.storage.from(config.supabaseBucket).getPublicUrl(key);

    return {
        provider: 'supabase',
        key,
        url: data.publicUrl
    };
};

/**
 * ORKESTRUESI KRYESOR: uploadAsset
 * Përzgjedh automatikisht ofruesin e duhur të memories bazuar në konfigurimet e sistemit (.env)
 */
const uploadAsset = async (sourcePath, key) => {
    if (config.storageProvider === 's3') {
        return uploadToS3(sourcePath, key);
    }
    if (config.storageProvider === 'supabase') {
        return uploadToSupabase(sourcePath, key);
    }
    return uploadToLocal(sourcePath, key);
};

// Eksportojmë funksionin në stilin standard CommonJS
module.exports = {
    uploadAsset
};