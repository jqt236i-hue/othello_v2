module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-interaction-hand-dom.ts')
    : require('../dist/cards/card-interaction-hand-dom');
