module.exports = process.env.JEST_WORKER_ID ? require('./causal-replay.ts') : require("../../dist/game/card-effects/causal-replay");
