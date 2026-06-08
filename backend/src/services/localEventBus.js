"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localJobEvents = void 0;
const node_events_1 = require("node:events");
exports.localJobEvents = new node_events_1.EventEmitter();
exports.localJobEvents.setMaxListeners(200);
