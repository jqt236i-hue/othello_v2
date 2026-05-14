"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID
  ? require('./session-lifecycle.ts')
  : require('../../dist/ui/network/session-lifecycle');
