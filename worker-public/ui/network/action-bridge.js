"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./action-bridge.ts') : require('../../dist/ui/network/action-bridge');
