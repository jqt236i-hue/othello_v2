module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./runtime.ts') : require('../../dist/ui/font-skin/runtime');
