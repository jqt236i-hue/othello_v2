module.exports = process.env.JEST_WORKER_ID ? require('./trap.ts') : require("../../dist/game/card-effects/trap");
