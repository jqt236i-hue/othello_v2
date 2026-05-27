'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./animation-status-events.ts')
    : require('../dist/ui/animation-status-events');
