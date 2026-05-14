module.exports = process.env.JEST_WORKER_ID ? require('./living-will.ts') : require("../../dist/game/card-effects/living-will");
