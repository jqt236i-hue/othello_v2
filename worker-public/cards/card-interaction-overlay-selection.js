module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-interaction-overlay-selection.ts')
    : require('../dist/cards/card-interaction-overlay-selection');
