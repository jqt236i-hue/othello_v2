module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./will_hunter_king.ts') : require('../../../dist/game/logic/cards/will_hunter_king');
