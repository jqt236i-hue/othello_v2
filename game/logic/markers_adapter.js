/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./markers_adapter.ts')
    : require('../../dist/game/logic/markers_adapter');
