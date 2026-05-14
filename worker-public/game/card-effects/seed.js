module.exports = process.env.JEST_WORKER_ID ? require('./seed.ts') : require("../../dist/game/card-effects/seed");
