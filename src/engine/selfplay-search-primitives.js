"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-search-primitives.ts')
    : require('../../dist/src/engine/selfplay-search-primitives');
