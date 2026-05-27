'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./animation-flip-events.ts')
    : require('../dist/ui/animation-flip-events');
