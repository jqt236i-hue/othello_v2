"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./smart.ts')
  : require("../../dist/ui/handlers/smart");
