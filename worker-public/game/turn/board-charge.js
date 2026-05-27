module.exports = process.env.JEST_WORKER_ID
    ? require('./board-charge.ts')
    : require('../../../dist/game/turn/board-charge');
