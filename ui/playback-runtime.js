const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./playback-runtime.ts') : require(path.join(__dirname, '../dist', 'ui', 'playback-runtime'));
