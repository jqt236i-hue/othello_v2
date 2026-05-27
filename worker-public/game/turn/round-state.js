module.exports = process.env.JEST_WORKER_ID
    ? require('./round-state.ts')
    : require('../../../dist/game/turn/round-state');
