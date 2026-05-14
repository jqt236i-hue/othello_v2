"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./target-resolver.ts') : require('../../dist/game/cards/target-resolver');
