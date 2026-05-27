module.exports = process.env.JEST_WORKER_ID
    ? require('./sub-placement-continuation.ts')
    : require('../../../dist/game/turn/sub-placement-continuation');
