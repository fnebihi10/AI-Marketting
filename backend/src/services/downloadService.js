"use strict";

// Importojmë modulet e Node.js për menaxhimin e skedarëve, rrugëve dhe të dhënave
const fs = require("node:fs");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const path = require("node:path");

// Importojmë funksionet ndihmëse për krijimin e emrave unikë të skedarëve
const { ensureDir, uniqueFile } = require("../utils/files");

/**
 * Shërben për të shkarkuar skedarë nga interneti dhe për t'i ruajtur lokalisht në server
 */
const downloadToFile = async ({ url, outputDir, label, extension, retries = 3 }) => {
    // Sigurohemi që ekziston dosja ku do të ruhet skedari, nëse nuk ekziston e krijon
    await ensureDir(outputDir);
    
    // Cikli që tregon sa herë provuam të shkarkojmë (Retry mechanism)
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Download] Attempt ${attempt}/${retries} for ${label}: ${url}`);
            
            // Bëjmë kërkesën HTTP për të marrë skedarin nga interneti
            const response = await fetch(url);
            
            // Kontrollojmë nëse dështoi ose nëse trupi i përgjigjes është i zbrazët
            if (!response.ok || !response.body) {
                throw new Error(`Failed to download asset: ${response.status} ${url}`);
            }
            
            // Krijojmë rrugën përfundimtare duke bashkuar dosjen me emrin unik të gjeneruar
            const outputPath = path.join(outputDir, uniqueFile(label, extension));
            
            // Ruajmë skedarin në disk duke përdorur streams për efikasitet memorie
            await pipeline(
                Readable.fromWeb(response.body), 
                fs.createWriteStream(outputPath)
            );
            
            return outputPath;
        }
        catch (error) {
            if (attempt === retries) throw error;
            
            // Nëse kemi ende tentativa të mbetura, afishojmë një paralajmërim dhe presim 2 sekonda
            console.warn(`[Download] Attempt ${attempt} failed: ${error.message}. Retrying in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Gabim i përgjithshëm nëse cikli përfundon pa sukses
    throw new Error('Download failed after multiple attempts.');
};

// Eksportojmë funksionin në mënyrë standarde të Node.js në fund të skedarit
module.exports = { downloadToFile };