"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./animation-engine.ts') : require('../dist/ui/animation-engine');
