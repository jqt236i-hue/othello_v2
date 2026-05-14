/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./effect-timing.ts') : require('../../../dist/game/logic/cards-internal/effect-timing');
