"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./board-renderer.ts')
  : require('../dist/ui/board-renderer');
