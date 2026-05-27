module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./deck-setup.ts')
    : require('../../../dist/game/logic/cards-internal/deck-setup');
