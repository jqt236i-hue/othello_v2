module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./pending-selection-ui-metadata.ts')
    : require('../dist/cards/pending-selection-ui-metadata');
