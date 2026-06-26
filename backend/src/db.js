"use strict";

// Importojmë librarinë Mongoose për komunikimin me MongoDB
const mongoose = require("mongoose");

// Marrim objektin e konfigurimit qendror për të gjetur adresën e databazës
const { config } = require("./config");

/**
 * FUNKSIONI KRYESOR: connectDatabase
 * Përpiqet të lidhë serverin me databazën MongoDB.
 * Pranon një parametër 'retryCount' që nis nga 0 dhe numëron sa herë ka dështuar lidhja.
 */
const connectDatabase = async (retryCount = 0) => {
    try {
        // Përdor adresën nga config për ta hapur lidhjen
        await mongoose.connect(config.mongodbUri);
        // Nëse lidhja ka sukses shfaq këtë mesazh
        console.log('MongoDB Connected successfully.');
    } catch (error) {
        // Numri maksimal i tentimeve për t'u rilidhur përpara se të dorëzohemi
        const maxRetries = 5;
        
        // Nëse kemi tentuar më pak se 5 herë, provohet rilidhja pas 5 sekondave
        if (retryCount < maxRetries) {
            console.warn(`Database connection failed (${error.message}). Retrying in 5s... (${retryCount + 1}/${maxRetries})`);
            
            // Pret 5 sekonda përpara tentimit të radhës
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Thirrje rekursive për të tentuar përsëri rilidhjen
            return connectDatabase(retryCount + 1);
        }
        
        console.error('Max database connection retries reached. Exiting...');
        process.exit(1);
    }
};

// Eksportojmë funksionin në stilin standard CommonJS
module.exports = {
    connectDatabase
};