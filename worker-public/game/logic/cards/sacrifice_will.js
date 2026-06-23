'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./sacrifice_will.ts')
    : require('../../../dist/game/logic/cards/sacrifice_will');
