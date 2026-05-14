module.exports = process.env.JEST_WORKER_ID ? require('./helpers.ts') : require("../../dist/game/card-effects/helpers");
