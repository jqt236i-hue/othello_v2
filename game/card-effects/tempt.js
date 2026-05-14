module.exports = process.env.JEST_WORKER_ID ? require('./tempt.ts') : require("../../dist/game/card-effects/tempt");
