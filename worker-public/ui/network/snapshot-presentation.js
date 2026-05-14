const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
  ? require('./snapshot-presentation.ts')
  : require(path.join(process.cwd(), 'dist', 'ui', 'network', 'snapshot-presentation.js'));
