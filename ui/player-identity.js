'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-identity.ts')
  : require('../dist/ui/player-identity');
