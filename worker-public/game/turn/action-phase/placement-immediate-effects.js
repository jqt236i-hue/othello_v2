module.exports = process.env.JEST_WORKER_ID
    ? require('./placement-immediate-effects.ts')
    : require('../../../dist/game/turn/action-phase/placement-immediate-effects');
