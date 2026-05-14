"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./auto.ts') : require('../../dist/ui/handlers/auto');
