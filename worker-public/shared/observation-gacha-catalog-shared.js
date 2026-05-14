'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./observation-gacha-catalog-shared.ts') : require('../dist/shared/observation-gacha-catalog-shared');
