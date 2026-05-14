module.exports = process.env.JEST_WORKER_ID ? require('./blockade.ts') : require("../../dist/game/card-effects/blockade");
