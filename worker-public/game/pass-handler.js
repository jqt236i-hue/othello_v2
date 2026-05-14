"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./pass-handler.ts') : require('../dist/game/pass-handler');
