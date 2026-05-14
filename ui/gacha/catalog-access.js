const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./catalog-access.ts') : require(path.join(process.cwd(), 'dist', 'ui', 'gacha', 'catalog-access.js'));
