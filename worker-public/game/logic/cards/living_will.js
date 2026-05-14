module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./living_will.ts') : require('../../../dist/game/logic/cards/living_will');
