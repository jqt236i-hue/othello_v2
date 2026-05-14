module.exports = process.env.JEST_WORKER_ID ? require('./guard.ts') : require("../../dist/game/card-effects/guard");
