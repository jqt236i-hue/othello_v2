module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-turn-scheduler.ts')
    : require('../dist/game/cpu-turn-scheduler');
