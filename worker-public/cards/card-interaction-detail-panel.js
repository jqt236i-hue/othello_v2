module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-interaction-detail-panel.ts')
    : require('../dist/cards/card-interaction-detail-panel');
