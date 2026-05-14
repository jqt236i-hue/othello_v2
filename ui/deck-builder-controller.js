"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID
  ? require('./deck-builder-controller.ts')
  : require('../dist/ui/deck-builder-controller');
