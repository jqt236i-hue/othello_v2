"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./cpu-lv6-lookahead-profile.ts') : require('../../dist/game/ai/cpu-lv6-lookahead-profile');
