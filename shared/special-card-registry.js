'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./special-card-registry.ts')
    : require('../dist/shared/special-card-registry');
