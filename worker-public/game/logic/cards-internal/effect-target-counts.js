module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./effect-target-counts.ts')
    : require('../../../dist/game/logic/cards-internal/effect-target-counts');
