'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./leaderboard-client.ts')
  : require('../dist/ui/leaderboard-client');
