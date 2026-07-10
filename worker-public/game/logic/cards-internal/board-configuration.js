module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./board-configuration.ts')
    : require('../../../dist/game/logic/cards-internal/board-configuration');
