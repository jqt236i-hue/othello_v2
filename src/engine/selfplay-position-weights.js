"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-position-weights.ts')
    : require('../../dist/src/engine/selfplay-position-weights');
