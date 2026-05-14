"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./stone-visuals.ts') : require('../dist/ui/stone-visuals');
