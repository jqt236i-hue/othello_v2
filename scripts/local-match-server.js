"use strict";
const DIST_PATH = '../dist/scripts/local-match-server';

/** @type {any} */
let distModule;

try {
  distModule = require(DIST_PATH);
} catch (error) {
  const isMissingDist = error && error.code === 'MODULE_NOT_FOUND' && String(error.message || '').includes(DIST_PATH);
  if (!isMissingDist) {
    throw error;
  }
  if (require.main === module) {
    console.error('Run npm run build:ts before node scripts/local-match-server.js');
    process.exit(1);
  }
  throw error;
}

module.exports = distModule;

if (require.main === module) {
  distModule.startLocalMatchServerFromCli();
}
