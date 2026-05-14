/** @type {any} */
const mod = require('../../dist/game/logic/core');
const exported = mod && typeof mod === 'object' ? Object.assign({}, mod) : mod;
if (exported && typeof exported === 'object') Object.defineProperty(exported, '__esModule', { value: true });
module.exports = exported;
