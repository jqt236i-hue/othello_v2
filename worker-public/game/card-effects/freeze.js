module.exports = process.env.JEST_WORKER_ID ? require('./freeze.ts') : require("../../dist/game/card-effects/freeze");
