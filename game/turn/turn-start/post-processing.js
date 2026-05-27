module.exports = process.env.JEST_WORKER_ID
    ? require('./post-processing.ts')
    : require('../../../dist/game/turn/turn-start/post-processing');
