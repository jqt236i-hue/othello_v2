module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-decision-plan-pressure.ts')
    : require('../dist/game/cpu-decision-plan-pressure');
