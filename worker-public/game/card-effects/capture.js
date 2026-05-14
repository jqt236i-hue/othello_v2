module.exports = process.env.JEST_WORKER_ID ? require('./capture.ts') : require("../../dist/game/card-effects/capture");
