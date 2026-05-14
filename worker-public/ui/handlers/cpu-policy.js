"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID
  ? require('./cpu-policy.ts')
  : require('../../dist/ui/handlers/cpu-policy');
