"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./animation-resolver.ts') : require('../dist/ui/animation-resolver');
