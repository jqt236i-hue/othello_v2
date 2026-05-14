const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./init-network.ts') : require(path.join(process.cwd(), 'dist', 'ui', 'bootstrap', 'init-network.js'));
