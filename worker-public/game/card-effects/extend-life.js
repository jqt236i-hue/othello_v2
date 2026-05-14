module.exports = process.env.JEST_WORKER_ID ? require('./extend-life.ts') : require("../../dist/game/card-effects/extend-life");
