"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./gacha-progress.ts') : require('../../dist/ui/storage/gacha-progress');
