"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./special-stone-phase.ts') : require('../../../dist/game/turn/turn-start/special-stone-phase');
