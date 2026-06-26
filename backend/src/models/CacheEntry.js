"use strict"; // Detyron zbatimin e rregullave strikte në JavaScript për të shmangur gabimet

// Importojmë mongoose për t'u lidhur dhe komunikuar me MongoDB
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Krijojmë skemën për të dhënat tona të cache
const cacheEntrySchema = new Schema({
    // 'key' është e dhëna me të cilën i kërkojmë këto të dhëna
    key: { type: String, required: true, unique: true, index: true },
    
    // Informacioni që po ruajmë
    value: { type: Schema.Types.Mixed, required: true },
    
    // Koha kur skedari do të skadojë dhe do të fshihet automatikisht nga MongoDB
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

// Krijojmë dhe eksportojmë modelin në mënyrë standarde
const CacheEntry = mongoose.models.CacheEntry || mongoose.model('CacheEntry', cacheEntrySchema);

module.exports = { CacheEntry };