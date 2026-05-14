module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./clone.ts') : require('../../../dist/game/logic/cards/clone');
