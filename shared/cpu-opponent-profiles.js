'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-opponent-profiles.ts')
    : require('../dist/shared/cpu-opponent-profiles');
