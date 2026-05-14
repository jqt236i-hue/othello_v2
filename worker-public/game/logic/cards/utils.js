"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./utils.ts') : require('../../../dist/game/logic/cards/utils');
