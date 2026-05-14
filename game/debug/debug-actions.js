"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./debug-actions.ts') : require('../../dist/game/debug/debug-actions');
