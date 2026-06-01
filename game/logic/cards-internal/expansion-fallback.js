module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./expansion-fallback.ts')
    : require('../../../dist/game/logic/cards-internal/expansion-fallback');
