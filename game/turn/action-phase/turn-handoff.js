module.exports = process.env.JEST_WORKER_ID
    ? require('./turn-handoff.ts')
    : require('../../../dist/game/turn/action-phase/turn-handoff');
