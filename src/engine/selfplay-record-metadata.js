"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-record-metadata.ts')
    : require('../../dist/src/engine/selfplay-record-metadata');
