"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID
  ? require('./deck-builder-renderer.ts')
  : require('../dist/ui/deck-builder-renderer');
