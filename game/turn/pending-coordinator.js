"use strict";
/** @type {any} */
const isRealJest = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function';
const mod = isRealJest ? require('./pending-coordinator.ts') : require('../../dist/game/turn/pending-coordinator');
const exported = isRealJest ? mod : (mod && typeof mod === 'object' ? Object.assign({}, mod) : mod);
if (exported && typeof exported === 'object' && !Object.prototype.hasOwnProperty.call(exported, '__esModule')) {
  Object.defineProperty(exported, '__esModule', { value: true });
}
module.exports = exported;
