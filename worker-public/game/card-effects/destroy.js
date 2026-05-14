const path = require('path');
module.exports = process.env.JEST_WORKER_ID
  ? require('./destroy.ts')
  : require(path.join(process.cwd(), 'dist', 'game', 'card-effects', 'destroy.js'));
