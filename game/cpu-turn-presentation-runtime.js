module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-turn-presentation-runtime.ts')
    : require('../dist/game/cpu-turn-presentation-runtime');
