'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./manifest-stone-registry.ts')
    : require('../dist/shared/manifest-stone-registry');
