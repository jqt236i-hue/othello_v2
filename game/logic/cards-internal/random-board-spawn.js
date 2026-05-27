module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./random-board-spawn.ts')
    : require('../../../dist/game/logic/cards-internal/random-board-spawn');
