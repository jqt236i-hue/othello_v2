const path = require('path');
module.exports = process.env.JEST_WORKER_ID
  ? require('./command-payload.ts')
  : require(path.join(process.cwd(), 'dist', 'ui', 'network', 'command-payload.js'));
