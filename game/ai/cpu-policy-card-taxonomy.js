module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-policy-card-taxonomy.ts')
    : require('../../dist/game/ai/cpu-policy-card-taxonomy');
