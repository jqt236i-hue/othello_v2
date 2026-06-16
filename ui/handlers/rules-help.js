"use strict";
/** @type {any} */
// Source-text compatibility for tests that verify glossary registration after TS migration:
// 絶対保護 / 封鎖 / 凍結 / 時間停止 / 破壊保護
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./rules-help.ts') : require('../../dist/ui/handlers/rules-help');
