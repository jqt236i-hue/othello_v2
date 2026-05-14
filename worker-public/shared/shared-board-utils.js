'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./shared-board-utils.ts')
  : require('../dist/shared/shared-board-utils');
