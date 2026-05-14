module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./controller-events.ts') : require("../dist/game/controller-events");
