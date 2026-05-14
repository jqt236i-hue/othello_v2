module.exports = process.env.JEST_WORKER_ID ? require('./hyperactive-inherit.ts') : require("../../dist/game/card-effects/hyperactive-inherit");
