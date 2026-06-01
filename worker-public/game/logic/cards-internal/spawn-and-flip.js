module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./spawn-and-flip.ts')
    : require('../../../dist/game/logic/cards-internal/spawn-and-flip');
