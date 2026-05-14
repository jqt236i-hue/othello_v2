const path = require('path');
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./gacha.ts') : require(path.join(process.cwd(), 'dist', 'ui', 'handlers', 'gacha.js'));
