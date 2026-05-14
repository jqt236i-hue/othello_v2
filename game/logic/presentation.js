(function (root) {
  "use strict";
  /** @type {any} */
  var api = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    api = process.env.JEST_WORKER_ID ? require('./presentation.ts') : require('../../dist/game/logic/presentation');
    module.exports = api;
  } else {
    api = root.PresentationHelper || {
      emitPresentationEvent: function () { return false; },
      emitPlaybackBatch: function () { return false; },
      buildPresentationEvent: function (type, payload) { return { type: type, payload: payload || {} }; }
    };
  }
  root.PresentationHelper = api;
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this)));
