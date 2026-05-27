module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-decision-pending-onnx.ts')
    : require('../dist/game/cpu-decision-pending-onnx');
