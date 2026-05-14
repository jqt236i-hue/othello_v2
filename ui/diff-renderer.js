"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./diff-renderer.ts') : require('../dist/ui/diff-renderer');
