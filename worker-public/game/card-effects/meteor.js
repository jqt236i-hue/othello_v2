module.exports = process.env.JEST_WORKER_ID ? require('./meteor.ts') : require("../../dist/game/card-effects/meteor");
