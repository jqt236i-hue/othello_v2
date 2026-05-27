module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./target-access.ts')
    : require('../../../dist/game/logic/cards-internal/target-access');
