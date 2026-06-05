'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./stone-status-snapshot.ts')
    : require('../dist/shared/stone-status-snapshot');
