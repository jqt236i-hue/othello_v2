"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./hand-animation-preferences.ts') : require('../dist/ui/hand-animation-preferences');
