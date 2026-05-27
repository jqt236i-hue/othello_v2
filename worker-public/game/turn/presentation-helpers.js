module.exports = process.env.JEST_WORKER_ID
    ? require('./presentation-helpers.ts')
    : require('../../../dist/game/turn/presentation-helpers');
