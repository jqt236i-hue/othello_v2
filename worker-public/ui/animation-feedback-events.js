"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./animation-feedback-events.ts') : require('../dist/ui/animation-feedback-events');
