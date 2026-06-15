"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./performance-monitor.ts')
  : require('../dist/ui/performance-monitor');
