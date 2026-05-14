module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./selectors.ts') : require('../../../dist/game/logic/cards/selectors');
