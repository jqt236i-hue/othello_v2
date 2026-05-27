module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./loss-effect.ts')
    : require('../../../dist/game/logic/cards-internal/loss-effect');
