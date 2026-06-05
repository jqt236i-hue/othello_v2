module.exports = process.env.JEST_WORKER_ID
    ? require('./debug-test-scenarios.ts')
    : require('../dist/ui/debug-test-scenarios');
