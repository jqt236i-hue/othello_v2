'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./player-profile.ts')
  : require('../dist/ui/player-profile');
