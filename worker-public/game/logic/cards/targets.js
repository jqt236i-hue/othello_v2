'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./targets.ts') : require('../../../dist/game/logic/cards/targets');
