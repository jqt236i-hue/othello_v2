module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-turn-move-phase.ts')
    : require('../dist/game/cpu-turn-move-phase');
