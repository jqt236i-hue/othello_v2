'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./playback-event-helpers.ts') : require('../dist/shared/playback-event-helpers');
