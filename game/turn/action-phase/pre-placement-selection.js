module.exports = process.env.JEST_WORKER_ID
    ? require('./pre-placement-selection.ts')
    : require('../../../dist/game/turn/action-phase/pre-placement-selection');
