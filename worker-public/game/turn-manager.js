"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./turn-manager.ts') : require('../dist/game/turn-manager');
