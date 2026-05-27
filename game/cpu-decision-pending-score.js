module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-decision-pending-score.ts')
    : require('../dist/game/cpu-decision-pending-score');
