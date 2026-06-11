'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-opponent-startup-options.ts')
    : require('../dist/shared/cpu-opponent-startup-options');
