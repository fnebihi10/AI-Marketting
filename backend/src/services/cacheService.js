"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCache = exports.getCache = void 0;
const CacheEntry_1 = require("../models/CacheEntry");
const config_1 = require("../config");
const getCache = async (key) => {
    const entry = await CacheEntry_1.CacheEntry.findOne({ key }).lean();
    return entry?.value || null;
};
exports.getCache = getCache;
const setCache = async (key, value) => {
    const expiresAt = new Date(Date.now() + config_1.config.cacheTtlHours * 60 * 60 * 1000);
    await CacheEntry_1.CacheEntry.findOneAndUpdate({ key }, { key, value, expiresAt }, { upsert: true, new: true, setDefaultsOnInsert: true });
};
exports.setCache = setCache;
