module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./card-interaction-click-buffer.ts')
    : require('../dist/cards/card-interaction-click-buffer');
