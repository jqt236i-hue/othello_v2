module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./hand-access.ts')
    : require('../../../dist/game/logic/cards-internal/hand-access');
