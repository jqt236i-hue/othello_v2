'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./capture-source.ts')
    : require('../../../dist/game/logic/cards-internal/capture-source');
