'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-identity-contract.ts')
  : require('../dist/shared/player-identity-contract');
