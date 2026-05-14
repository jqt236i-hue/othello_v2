"use strict";
/** @type {any} */
module.exports = process.env.JEST_WORKER_ID ? require('./debug.ts') : require('../../dist/ui/handlers/debug');
