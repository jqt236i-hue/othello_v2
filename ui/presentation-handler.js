"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./presentation-handler.ts') : require('../dist/ui/presentation-handler');
