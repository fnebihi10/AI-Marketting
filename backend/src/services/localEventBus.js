"use strict";

// Importojmë klasën standarde EventEmitter nga Node.js core
const { EventEmitter } = require("node:events");

// Krijojmë instancën e menaxhuesit lokal të eventeve per me tregu nekohe reale
//se ku gjendet vidoe 10%,20% shiriti i progres barit
const localJobEvents = new EventEmitter();

// Rrisim limitin maksimal të dëgjuesve (listeners) për të shmangur paralajmërimet për memory leak
localJobEvents.setMaxListeners(200);

// Eksportojmë instancën në mënyrë standarde të Node.js
module.exports = {
    localJobEvents
};