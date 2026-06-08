"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const connectDatabase = async (retryCount = 0) => {
    try {
        await mongoose_1.default.connect(config_1.config.mongodbUri);
        console.log('MongoDB Connected successfully.');
    }
    catch (error) {
        const maxRetries = 5;
        if (retryCount < maxRetries) {
            console.warn(`Database connection failed (${error.message}). Retrying in 5s... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return (0, exports.connectDatabase)(retryCount + 1);
        }
        console.error('Max database connection retries reached. Exiting...');
        process.exit(1);
    }
};
exports.connectDatabase = connectDatabase;
