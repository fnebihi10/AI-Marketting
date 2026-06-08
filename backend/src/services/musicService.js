"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectBackgroundMusic = void 0;
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const files_1 = require("../utils/files");
const selectBackgroundMusic = async () => {
    const configured = node_path_1.default.isAbsolute(config_1.config.localMusicPath)
        ? config_1.config.localMusicPath
        : node_path_1.default.join(config_1.config.rootDir, config_1.config.localMusicPath);
    if (await (0, files_1.fileExists)(configured)) {
        return { source: 'local', path: configured };
    }
    return { source: 'none', path: '' };
};
exports.selectBackgroundMusic = selectBackgroundMusic;
