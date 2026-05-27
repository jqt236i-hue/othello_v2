module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./animation-destroy-source-events.ts')
    : require('../dist/ui/animation-destroy-source-events');
