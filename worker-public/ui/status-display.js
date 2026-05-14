"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./status-display.ts') : require('../dist/ui/status-display');
