module.exports = process.env.JEST_WORKER_ID ? require('./position-swap.ts') : require("../../dist/game/card-effects/position-swap");
