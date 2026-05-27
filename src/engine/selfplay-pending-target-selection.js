"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./selfplay-pending-target-selection.ts')
    : require('../../dist/src/engine/selfplay-pending-target-selection');
