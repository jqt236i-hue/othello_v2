(function (root) {
  "use strict";
  /** @type {any} */
  var api = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    api = process.env.JEST_WORKER_ID ? require('./selection-flow.ts') : require('../../dist/game/card-effects/selection-flow');
    module.exports = api;
  } else {
    api = root.PendingSelectionFlow || {
      PENDING_SELECTION_CONTRACTS: Object.freeze({}),
      resolvePendingSelectionContract: function () { return null; },
      isSelectionOnlyEndTurnPendingType: function () { return false; },
      shouldDeferNetworkPublishForPendingType: function () { return false; },
      shouldWaitForPlaybackIdleForPendingType: function () { return false; },
      setSelectionProcessing: function () {},
      setSelectionCardAnimating: function () {},
      setSelectionBusy: function () {},
      createPendingSelectionAction: function () { return null; },
      readPendingSelectionAction: function () { return null; },
      syncPendingSelectionActionCache: function () { return { cleared: [], retained: [] }; },
      waitForSelectionPlaybackIdle: function () { return Promise.resolve(); },
      finalizePendingSelectionFlow: function () { return Promise.resolve({ ok: false, reason: 'pending_selection_flow_unavailable' }); },
      setSignalBridge: function () { return null; },
      clearSignalBridge: function () { return true; },
      applySelectionStateResult: function () {},
      emitSelectionPlaybackEvents: function () {},
      executePendingSelection: function () { return Promise.resolve({ ok: false, reason: 'pending_selection_flow_unavailable' }); },
      capturePendingSelectionSnapshot: function () { return null; },
      publishPendingSelectionSnapshot: function () { return Promise.resolve(null); }
    };
  }
  root.PendingSelectionFlow = api;
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this)));
