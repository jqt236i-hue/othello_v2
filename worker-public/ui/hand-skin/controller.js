"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./controller.ts') : require('../../dist/ui/hand-skin/controller');
