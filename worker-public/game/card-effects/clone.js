module.exports = process.env.JEST_WORKER_ID ? require('./clone.ts') : require("../../dist/game/card-effects/clone");
