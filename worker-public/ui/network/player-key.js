"use strict";
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./player-key.ts') : require('../../dist/ui/network/player-key');
