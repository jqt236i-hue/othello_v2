"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./selection.ts') : require('../../dist/ui/hand-skin/selection');
