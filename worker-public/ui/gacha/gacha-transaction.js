const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./gacha-transaction.ts') : require(path.join(process.cwd(), 'dist', 'ui', 'gacha', 'gacha-transaction.js'));
