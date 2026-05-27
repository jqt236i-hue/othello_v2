"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./bomb-phase.ts') : require('../../../dist/game/turn/turn-start/bomb-phase');
