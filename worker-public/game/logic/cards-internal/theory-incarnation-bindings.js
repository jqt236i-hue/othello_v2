'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./theory-incarnation-bindings.ts')
    : require('../../../dist/game/logic/cards-internal/theory-incarnation-bindings');
