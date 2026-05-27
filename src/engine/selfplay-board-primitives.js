"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-board-primitives.ts')
    : require('../../dist/src/engine/selfplay-board-primitives');
