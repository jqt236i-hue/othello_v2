'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./presentation-effect-profiles.ts') : require('../dist/shared/presentation-effect-profiles');
