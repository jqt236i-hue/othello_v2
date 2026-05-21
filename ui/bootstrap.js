"use strict";
(function (root) {
  var isRealJest;
  function createClassicBootstrap(target) {
    var uiGlobals = {};
    function installGameDI() {
      var flow = target && target.PendingSelectionFlow;
      if (flow && typeof flow.setSignalBridge === 'function') {
        flow.setSignalBridge({
          readMatchMode: function () {
            if (target && typeof target.getCurrentMatchMode === 'function') return target.getCurrentMatchMode();
            return target ? target.MATCH_MODE : null;
          },
          readHumanVsHumanMode: function () {
            return !!(target && target.DEBUG_HUMAN_VS_HUMAN === true);
          },
          getPlaybackStateManager: function () { return target.PlaybackStateManager || null; },
          emitPlaybackEvents: function (events, meta, cardStateRef) {
            var helper = target && target.PresentationHelper;
            if (!helper || typeof helper.emitPresentationEvent !== 'function') return false;
            return !!helper.emitPresentationEvent(cardStateRef || target.cardState || null, {
              type: 'PLAYBACK_EVENTS',
              events: Array.isArray(events) ? events : [],
              meta: meta || {}
            });
          },
          emitStateChanges: function () {
            if (typeof target.emitCardStateChange === 'function') target.emitCardStateChange();
            if (typeof target.emitBoardUpdate === 'function') target.emitBoardUpdate();
            if (typeof target.emitGameStateChange === 'function') target.emitGameStateChange();
            return true;
          },
          emitMessage: function (message) {
            if (typeof target.emitLogAdded !== 'function') return false;
            target.emitLogAdded(message);
            return true;
          },
          emitBoardUpdate: function () {
            if (typeof target.emitBoardUpdate !== 'function') return false;
            target.emitBoardUpdate();
            return true;
          }
        });
      }
      return uiGlobals;
    }
    return {
      installGameDI: installGameDI,
      getRegisteredUIGlobals: function () { return uiGlobals; },
      registerUIGlobals: function (next) {
        uiGlobals = Object.assign(uiGlobals, next || {});
        return uiGlobals;
      }
    };
  }

  if (typeof module === 'object' && module && module.exports) {
    isRealJest = typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function';
    module.exports = isRealJest ? require('./bootstrap.ts') : require('../dist/ui/bootstrap');
    return;
  }

  if (root && !root.UIBootstrap) {
    root.UIBootstrap = createClassicBootstrap(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
