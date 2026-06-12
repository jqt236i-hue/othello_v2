module.exports = process.env.JEST_WORKER_ID
    ? require('./generate-selfplay-data.ts')
    : require('../../dist/training/scripts/generate-selfplay-data');
