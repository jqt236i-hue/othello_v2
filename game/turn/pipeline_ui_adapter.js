"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./pipeline_ui_adapter.ts') : require('../../dist/game/turn/pipeline_ui_adapter');
