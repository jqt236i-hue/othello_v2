module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./generated-spawn-flip-resolver.ts')
    : require('../../../dist/game/logic/cards-internal/generated-spawn-flip-resolver');
