module.exports = process.env.JEST_WORKER_ID
    ? require('./placement-effects.ts')
    : require('../../../dist/game/turn/action-phase/placement-effects');
