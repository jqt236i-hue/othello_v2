"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./move-executor-visuals.ts') : require('../dist/ui/move-executor-visuals');
