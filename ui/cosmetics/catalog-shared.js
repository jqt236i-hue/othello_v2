"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./catalog-shared.ts') : require('../../dist/ui/cosmetics/catalog-shared.js');
