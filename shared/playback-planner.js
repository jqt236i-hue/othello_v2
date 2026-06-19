'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./playback-planner.ts')
  : require('../dist/shared/playback-planner');
