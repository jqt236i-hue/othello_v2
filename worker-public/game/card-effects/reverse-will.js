module.exports = process.env.JEST_WORKER_ID ? require('./reverse-will.ts') : require("../../dist/game/card-effects/reverse-will");
