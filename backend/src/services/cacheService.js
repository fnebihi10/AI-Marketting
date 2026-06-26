"use strict";

// Importojmë modelin e databazës për cache dhe konfigurimin në mënyrë të pastër
const { CacheEntry } = require("../models/CacheEntry");
const { config } = require("../config");

/**
 * Funksion për t'i marrë të dhënat e caktuara nga cache përmes një 'key'
 */
const getCache = async (key) => {
    const entry = await CacheEntry.findOne({ key }).lean();
    return entry?.value || null;
};

/**
 * Funksion për t'i vendosur në cache të dhënat e caktuara me 'key' dhe 'value' për një kohë të caktuar
 */
const setCache = async (key, value) => {
    const expiresAt = new Date(Date.now() + config.cacheTtlHours * 60 * 60 * 1000);
    await CacheEntry.findOneAndUpdate(
        { key }, 
        { key, value, expiresAt }, 
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

// Eksportojmë funksionet në mënyrë standarde të Node.js në fund të skedarit
module.exports = {
    getCache,
    setCache
};