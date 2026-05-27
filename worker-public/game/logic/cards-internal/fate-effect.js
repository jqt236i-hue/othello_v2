module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./fate-effect.ts')
    : require('../../../dist/game/logic/cards-internal/fate-effect');
