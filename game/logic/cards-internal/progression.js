"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./progression.ts') : require('../../../dist/game/logic/cards-internal/progression');
