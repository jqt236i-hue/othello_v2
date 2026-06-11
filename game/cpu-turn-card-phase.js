module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-turn-card-phase.ts')
    : require('../dist/game/cpu-turn-card-phase');
