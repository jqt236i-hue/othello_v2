module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./offer-builders.ts')
    : require('../../../dist/game/logic/cards-internal/offer-builders');
