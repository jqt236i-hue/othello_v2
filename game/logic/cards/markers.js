'use strict';

module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./markers.ts')
    : require('../../../dist/game/logic/cards/markers');
