module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./observer_will.ts')
    : require('../../../dist/game/logic/cards/observer_will');
