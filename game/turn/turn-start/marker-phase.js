"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./marker-phase.ts') : require('../../../dist/game/turn/turn-start/marker-phase');
