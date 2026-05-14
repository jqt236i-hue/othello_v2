module.exports = process.env.JEST_WORKER_ID ? require('./swap.ts') : require("../../dist/game/card-effects/swap");
