'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./playback-flip-marker.ts')
    : require('../dist/ui/playback-flip-marker');
