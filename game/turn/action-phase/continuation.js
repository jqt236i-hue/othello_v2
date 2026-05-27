module.exports = process.env.JEST_WORKER_ID
    ? require('./continuation.ts')
    : require('../../../dist/game/turn/action-phase/continuation');
