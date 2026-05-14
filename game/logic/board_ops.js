"use strict";
/** @type {any} */
const isRealJest = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function';
const mod = isRealJest ? require('./board_ops.ts') : require('../../dist/game/logic/board_ops');
const exported = isRealJest ? mod : (mod && typeof mod === 'object' ? Object.assign({}, mod) : mod);
if (exported && typeof exported === 'object' && !Object.prototype.hasOwnProperty.call(exported, '__esModule')) {
  Object.defineProperty(exported, '__esModule', { value: true });
}
module.exports = exported;
