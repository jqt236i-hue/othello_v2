"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID
  ? require('./session-seat.ts')
  : require('../../dist/ui/network/session-seat');
