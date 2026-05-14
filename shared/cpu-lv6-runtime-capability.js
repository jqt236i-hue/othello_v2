'use strict';

module.exports = process.env.JEST_WORKER_ID ? require('./cpu-lv6-runtime-capability.ts') : require('../dist/shared/cpu-lv6-runtime-capability');
