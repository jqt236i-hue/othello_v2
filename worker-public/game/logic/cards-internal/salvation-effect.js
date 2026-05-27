module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./salvation-effect.ts')
    : require('../../../dist/game/logic/cards-internal/salvation-effect');
