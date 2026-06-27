"use strict"; // Kontrollon strikt sintaksën se a është plotësuar mirë

// Importojmë mongoose për komunikim dhe manipulim me MongoDB
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Kjo tregon se ku ruhet fotoja e reklamës
const storageAssetSchema = new Schema({
    provider: String,
    key: String,       // ID unike e skedarit në serverin e fotove
    url: String,       // Linku i plotë ku mund të shihet fotoja
    localPath: String, // Vendndodhja brenda kompjuterit/serverit
}, { _id: false });

// Këtu përcaktohen të gjitha fushat që do të ketë një reklamë në DB
const photoAdSchema = new Schema({
    // Useri që e ka krijuar
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    // Titulli i reklamës
    title: { type: String, required: true, trim: true },
    // Teksti i dhënë në AI për të gjeneruar foton
    prompt: { type: String, required: true, trim: true },
    // Formati i fotos
    aspectRatio: { type: String, default: '1:1' },
    // Kategoria e produktit
    productCategory: { type: String, default: 'general-product' },
    // Stili i fotos (minimal, energjik, etj.)
    style: { type: String, default: 'minimal' },
    // Kërkesa ka ardhur nga puter
    source: { type: String, default: 'puter' },
    // Fotot e gjeneruara (secili gjenerim i ka 3 foto)
    images: {
        type: [storageAssetSchema],
        default: []
    },
    // Fushat për marketing si audienca, oferta dhe dëshmia
    caption: { type: String, default: '' },
    audience: { type: String, default: '' },
    offer: { type: String, default: '' },
    proof: { type: String, default: '' }
}, { timestamps: true });

// MongoDB t'i gjejë ato në kohë rekord pa pasur nevojë t'i skanojë të gjithë DB-në
photoAdSchema.index({ owner: 1, createdAt: -1 });

// Krijojmë dhe eksportojmë modelin në mënyrë standarde të Node.js
const PhotoAd = mongoose.models.PhotoAd || mongoose.model('PhotoAd', photoAdSchema);

module.exports = { PhotoAd };