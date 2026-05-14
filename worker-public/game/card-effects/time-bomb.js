module.exports = process.env.JEST_WORKER_ID ? require('./time-bomb.ts') : require("../../dist/game/card-effects/time-bomb");
