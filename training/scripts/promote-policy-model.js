module.exports = process.env.JEST_WORKER_ID
    ? require('./promote-policy-model.ts')
    : require('../../dist/training/scripts/promote-policy-model');
