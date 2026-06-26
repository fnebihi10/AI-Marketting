"use strict";

// Importojmë modulin e Node.js për menaxhimin e rrugëve (paths)
const path = require("node:path");

// Importojmë konfigurimet e sistemit dhe funksionin ndihmës për kontrollin e skedarëve
const { config } = require("../config");
const { fileExists } = require("../utils/files");

/**
 * Kontrollon nëse është caktuar një rrugë për muzikë lokale dhe nese skedari fizik ekziston në disk
 */
const selectBackgroundMusic = async () => {
    const configured = path.isAbsolute(config.localMusicPath)
        ? config.localMusicPath
        : path.join(config.rootDir, config.localMusicPath);
        
    // Kontrollojmë fizikisht në disk nëse ky skedar muzike ekziston vërtet
    if (await fileExists(configured)) {
        // Nëse ekziston, kthejmë burimin si 'local' dhe rrugën e plotë të skedarit audio
        return { source: 'local', path: configured };
    }
    
    // Nëse skedari nuk gjendet ose nuk është konfiguruar, kthejmë 'none' (videoja do të bëhet pa muzikë sfondi)
    return { source: 'none', path: '' };
};

// Eksportojmë funksionin në mënyrë standarde të Node.js (CommonJS)
module.exports = {
    selectBackgroundMusic
};