'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./match-room-lobby.ts')
  : require('../dist/shared/match-room-lobby');
