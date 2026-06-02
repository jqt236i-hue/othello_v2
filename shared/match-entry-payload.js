'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./match-entry-payload.ts')
  : require('../dist/shared/match-entry-payload');
