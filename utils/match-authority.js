module.exports = (process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function')
  ? require('./match-authority.ts')
  : require('../dist/utils/match-authority');
