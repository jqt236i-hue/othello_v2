"use strict";
(function (root) {
  var isRealJest;
  function createClassicBootstrap(target) {
    var uiGlobals = {};
    function installGameDI() {
      var flow = target && target.PendingSelectionFlow;
      if (flow && typeof flow.setSignalBridge === 'function') {
        var getPlaybackStateManager = function () {
          return target && target.PlaybackStateManager ? target.PlaybackStateManager : null;
        };
        flow.setSignalBridge({
          readMatchMode: function () {
            if (target && typeof target.getCurrentMatchMode === 'function') return target.getCurrentMatchMode();
            return target ? target.MATCH_MODE : null;
          },
          readHumanVsHumanMode: function () {
            return !!(target && target.DEBUG_HUMAN_VS_HUMAN === true);
          },
          isCardRuntimeIntegrityBlocked: function () {
            var integrity = target && target.CardRuntimeIntegrity;
            if (!integrity || typeof integrity.isCardRuntimeIntegrityBlocked !== 'function') return false;
            try { return integrity.isCardRuntimeIntegrityBlocked() === true; } catch (_error) { return true; }
          },
          getPlaybackStateManager: getPlaybackStateManager,
          acquireSelectionSettlementLock: function (meta) {
            var playbackState = getPlaybackStateManager();
            if (playbackState && typeof playbackState.acquireSelectionSettlementLock === 'function') {
              return playbackState.acquireSelectionSettlementLock(meta);
            }
            return null;
          },
          releaseSelectionSettlementLock: function (token) {
            var playbackState = getPlaybackStateManager();
            if (playbackState && typeof playbackState.releaseSelectionSettlementLock === 'function') {
              playbackState.releaseSelectionSettlementLock(token);
              return true;
            }
            return false;
          },
          setSelectionProcessing: function (next) {
            var playbackState = getPlaybackStateManager();
            var normalized = next === true;
            if (playbackState && typeof playbackState.setBusyState === 'function') {
              playbackState.setBusyState({ processing: normalized });
              return true;
            }
            if (playbackState && typeof playbackState.setProcessing === 'function') {
              playbackState.setProcessing(normalized);
              return true;
            }
            return false;
          },
          setSelectionCardAnimating: function (next) {
            var playbackState = getPlaybackStateManager();
            var normalized = next === true;
            if (playbackState && typeof playbackState.setBusyState === 'function') {
              playbackState.setBusyState({ cardAnimating: normalized });
              return true;
            }
            if (playbackState && typeof playbackState.setCardAnimating === 'function') {
              playbackState.setCardAnimating(normalized);
              return true;
            }
            return false;
          },
          setSelectionBusy: function (next) {
            var playbackState = getPlaybackStateManager();
            var normalized = next === true;
            if (playbackState && typeof playbackState.setBusyState === 'function') {
              playbackState.setBusyState({ processing: normalized, cardAnimating: normalized });
              return true;
            }
            return false;
          },
          readSelectionBusyState: function (payload) {
            var playbackState = getPlaybackStateManager();
            var settlementLocked = payload && payload.settlementLocked === true;
            var localState = payload && payload.localSelectionBusyState ? payload.localSelectionBusyState : {};
            var processing = localState.processing === true;
            var cardAnimating = localState.cardAnimating === true;
            if (playbackState && typeof playbackState.getProcessing === 'function') {
              processing = playbackState.getProcessing() === true;
            }
            if (playbackState && typeof playbackState.getCardAnimating === 'function') {
              cardAnimating = playbackState.getCardAnimating() === true;
            }
            return {
              processing: settlementLocked || processing,
              cardAnimating: settlementLocked || cardAnimating
            };
          },
          shouldAllowSelectionEntryDuringPlayback: function (payload) {
            var playbackState = getPlaybackStateManager();
            if (playbackState && typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function') {
              return playbackState.shouldAllowSelectionEntryDuringPlayback(payload || {}) === true;
            }
            return false;
          },
          clearSelectionEntryPlaybackContext: function () {
            var playbackState = getPlaybackStateManager();
            if (playbackState && typeof playbackState.clearSelectionEntryPlaybackContext === 'function') {
              playbackState.clearSelectionEntryPlaybackContext();
              return true;
            }
            return false;
          },
          armSelectionBoardUpdateContext: function (context) {
            var playbackState = getPlaybackStateManager();
            if (playbackState && typeof playbackState.armBoardUpdateContext === 'function') {
              playbackState.armBoardUpdateContext(context);
              return true;
            }
            return false;
          },
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
    if (module.exports && typeof module.exports.initializeUIBootstrapRuntime === 'function') {
      module.exports.initializeUIBootstrapRuntime(typeof window !== 'undefined' ? window : root);
    }
    return;
  }

  if (root && !root.UIBootstrap) {
    root.UIBootstrap = createClassicBootstrap(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
