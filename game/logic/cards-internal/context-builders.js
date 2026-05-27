module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./context-builders.ts')
    : require('../../../dist/game/logic/cards-internal/context-builders');
