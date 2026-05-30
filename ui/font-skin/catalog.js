module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./catalog.ts') : require('../../dist/ui/font-skin/catalog');
