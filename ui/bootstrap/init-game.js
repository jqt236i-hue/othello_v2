module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./init-game.ts') : require("../../dist/ui/bootstrap/init-game");
