'use strict';

/** @type {any} */
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./cpu-profile-selection.ts')
    : require('../dist/ui/cpu-profile-selection');
