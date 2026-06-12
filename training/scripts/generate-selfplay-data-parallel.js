module.exports = process.env.JEST_WORKER_ID
    ? require('./generate-selfplay-data-parallel.ts')
    : require('../../dist/training/scripts/generate-selfplay-data-parallel');
