"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./policy-feature-vector.ts')
    : require('../../dist/game/ai/policy-feature-vector');
