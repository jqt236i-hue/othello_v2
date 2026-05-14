module.exports = process.env.JEST_WORKER_ID ? require('./teleport.ts') : require("../../dist/game/card-effects/teleport");
