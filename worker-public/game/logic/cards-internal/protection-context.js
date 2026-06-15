module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./protection-context.ts')
    : require('../../../dist/game/logic/cards-internal/protection-context');
