module.exports = process.env.JEST_WORKER_ID
    ? require('./timer-phase.ts')
    : require('../../../dist/game/turn/turn-start/timer-phase');
