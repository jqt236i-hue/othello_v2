module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./ribo-time-stop.ts')
    : require('../../../dist/game/logic/cards-internal/ribo-time-stop');
