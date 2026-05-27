"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-policy-board-primitives.ts')
    : require('../../dist/game/ai/cpu-policy-board-primitives');
