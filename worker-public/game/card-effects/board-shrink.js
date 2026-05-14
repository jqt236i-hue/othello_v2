module.exports = process.env.JEST_WORKER_ID ? require('./board-shrink.ts') : require("../../dist/game/card-effects/board-shrink");
