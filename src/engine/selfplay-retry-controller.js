"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-retry-controller.ts')
    : require('../../dist/src/engine/selfplay-retry-controller');
