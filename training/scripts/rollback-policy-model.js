module.exports = process.env.JEST_WORKER_ID
    ? require('./rollback-policy-model.ts')
    : require('../../dist/training/scripts/rollback-policy-model');
