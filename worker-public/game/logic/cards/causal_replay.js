module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./causal_replay.ts')
    : require('../../../dist/game/logic/cards/causal_replay');
