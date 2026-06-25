'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-profile-contract.ts')
  : require('../dist/shared/player-profile-contract');
