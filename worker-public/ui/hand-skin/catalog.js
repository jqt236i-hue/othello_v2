"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./catalog.ts') : require('../../dist/ui/hand-skin/catalog');
