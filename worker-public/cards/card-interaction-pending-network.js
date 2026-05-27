module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-interaction-pending-network.ts')
    : require('../dist/cards/card-interaction-pending-network');
