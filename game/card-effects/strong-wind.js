module.exports = process.env.JEST_WORKER_ID ? require('./strong-wind.ts') : require("../../dist/game/card-effects/strong-wind");
