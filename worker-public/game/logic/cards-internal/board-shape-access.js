module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./board-shape-access.ts')
    : require('../../../dist/game/logic/cards-internal/board-shape-access');
