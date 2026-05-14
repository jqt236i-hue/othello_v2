"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./hand-skin.ts') : require('../../dist/ui/handlers/hand-skin');
