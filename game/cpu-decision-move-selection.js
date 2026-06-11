module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-decision-move-selection.ts')
    : require('../dist/game/cpu-decision-move-selection');
