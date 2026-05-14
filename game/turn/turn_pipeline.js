const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./turn_pipeline.ts') : require(path.join(process.cwd(), 'dist', 'game', 'turn', 'turn_pipeline.js'));
