"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./turn_pipeline_phases.ts') : require('../../dist/game/turn/turn_pipeline_phases');
