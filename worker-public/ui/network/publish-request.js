module.exports = process.env.JEST_WORKER_ID
  ? require('./publish-request.ts')
  : require('../../dist/ui/network/publish-request');
