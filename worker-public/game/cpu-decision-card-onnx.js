module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-decision-card-onnx.ts')
    : require('../dist/game/cpu-decision-card-onnx');
