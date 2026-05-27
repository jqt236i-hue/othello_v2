module.exports = process.env.JEST_WORKER_ID
    ? require('./place-resolution.ts')
    : require('../../../dist/game/turn/action-phase/place-resolution');
