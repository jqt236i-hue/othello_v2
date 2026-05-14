"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./turn_pipeline_phase_helpers.ts') : require('../../dist/game/turn/turn_pipeline_phase_helpers');
