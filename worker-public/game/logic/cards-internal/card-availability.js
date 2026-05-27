module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-availability.ts')
    : require('../../../dist/game/logic/cards-internal/card-availability');
