"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-simple-simulation-choosers.ts')
    : require('../../dist/src/engine/selfplay-simple-simulation-choosers');
