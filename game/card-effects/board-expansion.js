module.exports = process.env.JEST_WORKER_ID ? require('./board-expansion.ts') : require("../../dist/game/card-effects/board-expansion");
