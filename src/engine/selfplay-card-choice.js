"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-card-choice.ts')
    : require('../../dist/src/engine/selfplay-card-choice');
