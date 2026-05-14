const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./placement.ts')
  : require(path.join(process.cwd(), 'dist', 'game', 'card-effects', 'placement.js'));
