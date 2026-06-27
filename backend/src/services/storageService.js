"use strict";

// Importojmë modulet native të Node.js për menaxhimin e skedarëve dhe shtigjeve
const fsPromises = require("node:fs/promises");
const path = require("node:path");

// Importojmë konfigurimet dhe funksionet ndihmëse lokale
const { config } = require("../config");
const { ensureDir, normalizePathForUrl } = require("../utils/files");

/**
 * Ngarkon skedarin në memorien lokale të serverit
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
 * ORKESTRUESI KRYESOR: uploadAsset
 * Ruan të dhënat në memorien lokale të serverit
 */
const uploadAsset = async (sourcePath, key) => {
    return uploadToLocal(sourcePath, key);
};

// Eksportojmë funksionin në stilin standard CommonJS
module.exports = {
    uploadAsset
};