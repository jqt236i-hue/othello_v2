"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./is-env-capable.ts')
  : require('./dist/is-env-capable');
