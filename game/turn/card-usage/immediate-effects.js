module.exports = process.env.JEST_WORKER_ID
    ? require('./immediate-effects.ts')
    : require('../../../dist/game/turn/card-usage/immediate-effects');
