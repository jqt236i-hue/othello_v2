const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./timing-processor.ts')
  : require(path.join(process.cwd(), 'dist', 'game', 'cards', 'timing-processor.js'));
