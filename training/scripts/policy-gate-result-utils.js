module.exports = process.env.JEST_WORKER_ID
    ? require('./policy-gate-result-utils.ts')
    : require('../../dist/training/scripts/policy-gate-result-utils');
