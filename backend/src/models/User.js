"use strict"; // Detyron zbatimin e rregullave strikte në JavaScript për të shmangur gabimet

// Importojmë mongoose për të bërë manipulime në DB
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Skema për përdoruesit (User)
const userSchema = new Schema({
    // Emaili i përdoruesit
    email: {
        type: String,
        required: [true, 'Email is required'], // Është fushë e detyrueshme për plotësim
        unique: true,      // Nuk lejon dy user të kenë të regjistruar të njëjtin email
        lowercase: true,   // Kthehet emaili në lowercase nëse nuk është
        trim: true,        // Heq hapësirat boshe para dhe mbrapa nëse përdoruesi i vendos
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'], // Kontrollon nëse është email i saktë
    },
    // Fjalëkalimi i përdoruesit
    password: {
        type: String,
        required: [true, 'Password is required'], // Fushë e detyrueshme
        minlength: [6, 'Password must be at least 6 characters'], // Duhet të jetë më së paku 6 karaktere
        select: false,     // Nuk përfshihet automatikisht në kërkesa për arsye sigurie
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    // Kreditë e përdoruesit
    credits: {
        type: Number,
        default: 5,        // Vlera fillestare e kredive
        min: 0,            // Nuk lejon të ketë vlerë negative
    },
    resetPasswordToken: String,  // Tokeni për resetimin e passwordit
    resetPasswordExpires: Date,  // Data e skadimit të tokenit
    // Kreditë e blera
    creditedSessions: {
        type: [String],    // Array me ID e sesioneve të blera (p.sh. nga Stripe)
        default: []        // Shërben për të mbajtur mend cilat pagesa janë përpunuar
    },
}, { timestamps: true });

// Krijojmë modelin duke kontrolluar nëse ekziston paraprakisht
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Eksportojmë modelin në mënyrë standarde të Node.js
module.exports = { User };