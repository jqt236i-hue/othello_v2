"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./pending-target-selector.ts') : require('../../dist/game/turn-handlers/pending-target-selector');
