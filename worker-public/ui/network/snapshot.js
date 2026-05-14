"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./snapshot.ts') : require('../../dist/ui/network/snapshot');
