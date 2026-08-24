'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

import CardRuntimeIntegrity = require('../card-runtime-integrity');

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let networkActionSchemaModule: any = null;
let playbackEventHelpersModule: any = null;
const PlayerKeyHelpers = _require('./player-key');

function resolveCardLogicModule(override?: any): any {
  if (override && typeof override === 'object') return override;
  return null;
}

function resolveNetworkActionSchemaModule(): any {
  if (networkActionSchemaModule) return networkActionSchemaModule;
  try {
    networkActionSchemaModule = _require('../../shared/network-action-schema');
  } catch (e) { /* ignore */ }
  if (!networkActionSchemaModule && typeof globalThis !== 'undefined' && (globalThis as any).NetworkActionSchema) {
    networkActionSchemaModule = (globalThis as any).NetworkActionSchema;
  }
  return networkActionSchemaModule;
}

function resolvePlaybackEventHelpersModule(override?: any): any {
  if (override && typeof override === 'object') return override;
  if (playbackEventHelpersModule) return playbackEventHelpersModule;
  try {
    playbackEventHelpersModule = _require('../../shared/playback-event-helpers');
  } catch (e) { /* ignore */ }
  if (!playbackEventHelpersModule && typeof globalThis !== 'undefined' && (globalThis as any).PlaybackEventHelpers) {
    playbackEventHelpersModule = (globalThis as any).PlaybackEventHelpers;
  }
  return playbackEventHelpersModule;
}

function normalizePlayerKey(value: any, fallback?: any, override?: any): string {
  return PlayerKeyHelpers.normalizePlayerKey(value, fallback, {
    override,
    schema: resolveNetworkActionSchemaModule()
  });
}

function resolveCardTypeForId(cardId: string, options?: any): string | null {
  if (!cardId) return null;
  const opts = (options && typeof options === 'object') ? options : {};
  if (typeof opts.resolveCardTypeForId === 'function') {
    const resolved = opts.resolveCardTypeForId(cardId);
    return resolved ? String(resolved) : null;
  }
  const cardLogic = resolveCardLogicModule(opts.cardLogicModule);
  if (!cardLogic || typeof cardLogic.getCardDef !== 'function') return null;
  const def = cardLogic.getCardDef(cardId);
  return (def && def.type) ? String(def.type) : null;
}

function hasCardInHand(cardStateValue: any, playerKey: any, cardId: string, fallbackNormalizePlayerKey?: any): boolean {
  if (!cardStateValue || !cardId) return false;
  const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black', fallbackNormalizePlayerKey);
  const hands = cardStateValue && cardStateValue.hands && typeof cardStateValue.hands === 'object'
    ? cardStateValue.hands
    : null;
  const hand = hands && Array.isArray(hands[normalizedPlayerKey]) ? hands[normalizedPlayerKey] : null;
  if (!hand) return false;
  for (let index = 0; index < hand.length; index += 1) {
    if (String(hand[index]) === String(cardId)) {
      return true;
    }
  }
  return false;
}

function buildPendingCardUsePlaybackEvents(playerKey: any, cardId: string, cardType?: string, options?: any): any[] {
  if (!cardId) return [];

  const opts = (options && typeof options === 'object') ? options : {};
  const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black', opts.normalizePlayerKey);
  const cardLogic = resolveCardLogicModule(opts.cardLogicModule);
  const playbackEventHelpers = resolvePlaybackEventHelpersModule(opts.playbackEventHelpersModule);
  const cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
    ? cardLogic.getCardDef(cardId)
    : null;
  const resolvedCardType = cardType || (cardDef && cardDef.type ? String(cardDef.type) : null);
  const cost = (cardDef && Number.isFinite(Number(cardDef.cost)))
    ? Number(cardDef.cost)
    : null;
  const name = (cardDef && cardDef.name)
    ? String(cardDef.name)
    : null;
  const costTier = (cardDef && cardDef.costTier)
    ? String(cardDef.costTier)
    : null;
  const visualDescriptor = (playbackEventHelpers && typeof playbackEventHelpers.createCardVisualDescriptor === 'function')
    ? playbackEventHelpers.createCardVisualDescriptor(cardId, {
      name: name,
      cost: cost,
      costTier: costTier
    })
    : null;

  return [
    {
      type: 'card_use_animation',
      phase: 1,
      meta: {
        sourceType: 'card_used',
        localPendingPreview: true
      },
      targets: [{
        player: normalizedPlayerKey,
        owner: normalizedPlayerKey,
        cardId: cardId,
        cardType: resolvedCardType,
        cost: cost,
        name: name,
        visualDescriptor: visualDescriptor
      }]
    },
    {
      type: 'sound_effect',
      phase: 1,
      targets: [{ soundKey: 'card_use_button' }],
      meta: {
        sourceType: 'card_used',
        localPendingPreview: true
      }
    }
  ];
}

function buildSkippedLocalExecutionResult(publishPromise: any): any {
  return {
    ok: true,
    skippedLocalExecution: true,
    playbackEvents: [],
    publishPromise: publishPromise
  };
}

function buildRuntimeIntegrityRejection(): any {
  return {
    ok: false,
    rejectedReason: 'RUNTIME_UNAVAILABLE',
    events: [],
    playbackEvents: []
  };
}

function isCardRuntimeIntegrityBlocked(): boolean {
  try {
    return !!(CardRuntimeIntegrity
      && typeof CardRuntimeIntegrity.isCardRuntimeIntegrityBlocked === 'function'
      && CardRuntimeIntegrity.isCardRuntimeIntegrityBlocked() === true);
  } catch (_error) {
    return true;
  }
}

function isRuntimeUnavailableResult(result: any): boolean {
  if (!result || typeof result !== 'object') return false;
  const reason = String(result.reason || result.rejectedReason || '').trim().toUpperCase();
  if (reason === 'RUNTIME_UNAVAILABLE') return true;
  const nested = result.result;
  if (!nested || typeof nested !== 'object') return false;
  return String(nested.reason || nested.rejectedReason || '').trim().toUpperCase() === 'RUNTIME_UNAVAILABLE';
}

function getPendingEffectType(cardStateValue: any, playerKey: any, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  try {
    if (typeof opts.getPendingEffectType === 'function') {
      return opts.getPendingEffectType(
        cardStateValue,
        normalizePlayerKey(playerKey, 'black', opts.normalizePlayerKey)
      );
    }
  } catch (e) { /* ignore */ }
  return null;
}

function createNetworkActionBridge(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : {});
  let installed = false;
  let originalRunTurnWithAdapter: any = null;

  function queueCommandPublish(playerKey: any, action: any, options?: any): any {
    if (typeof cfg.queueCommandPublish !== 'function') {
      throw new Error('queueCommandPublish_unavailable');
    }
    return cfg.queueCommandPublish(playerKey, action, options);
  }

  function shouldDeferNetworkPublishForPendingType(cardType: string): boolean {
    if (typeof cfg.shouldDeferNetworkPublishForPendingType === 'function') {
      return cfg.shouldDeferNetworkPublishForPendingType(cardType) === true;
    }
    return false;
  }

  function beginPlacementFeedback(playerKey: any, action: any): any {
    if (typeof cfg.beginPlacementFeedback !== 'function') return null;
    return cfg.beginPlacementFeedback(action, playerKey);
  }

  function settlePlacementFeedback(token: any, result: any): void {
    if (token == null || typeof cfg.settlePlacementFeedback !== 'function') return;
    cfg.settlePlacementFeedback(token, result);
  }

  function cancelPlacementFeedback(token: any): void {
    if (token == null) return;
    if (typeof cfg.cancelPlacementFeedback === 'function') {
      cfg.cancelPlacementFeedback(token);
      return;
    }
    // Compatibility fallback for embedders that have not yet supplied the
    // silent cleanup port. The production client always supplies it.
    settlePlacementFeedback(token, { ok: false, reason: 'RUNTIME_UNAVAILABLE', silent: true });
  }

  function queueBoardPlacementPublish(playerKey: any, action: any, showPlacementFeedback: boolean): any {
    const feedbackToken = showPlacementFeedback ? beginPlacementFeedback(playerKey, action) : null;
    let publishPromise: any;
    try {
      publishPromise = queueCommandPublish(playerKey, action, {
        actionType: 'place',
        placementFeedbackToken: feedbackToken
      });
    } catch (error) {
      if (isCardRuntimeIntegrityBlocked()) {
        cancelPlacementFeedback(feedbackToken);
      } else {
        settlePlacementFeedback(feedbackToken, { ok: false, reason: 'PUBLISH_START_FAILED' });
      }
      throw error;
    }
    if (feedbackToken != null) {
      void Promise.resolve(publishPromise).then(
        (result) => {
          if (isCardRuntimeIntegrityBlocked() || isRuntimeUnavailableResult(result)) cancelPlacementFeedback(feedbackToken);
          else settlePlacementFeedback(feedbackToken, result);
        },
        () => {
          if (isCardRuntimeIntegrityBlocked()) cancelPlacementFeedback(feedbackToken);
          else settlePlacementFeedback(feedbackToken, { ok: false, reason: 'PUBLISH_ERROR' });
        }
      );
    }
    return buildSkippedLocalExecutionResult(publishPromise);
  }

  function install(): boolean {
    if (installed) return true;
    if (!rootRef.TurnPipelineUIAdapter || typeof rootRef.TurnPipelineUIAdapter.runTurnWithAdapter !== 'function') {
      return false;
    }

    originalRunTurnWithAdapter = rootRef.TurnPipelineUIAdapter.runTurnWithAdapter;
    rootRef.TurnPipelineUIAdapter.runTurnWithAdapter = function wrappedRunTurnWithAdapter(cardStateArg: any, gameStateArg: any, playerKey: any, action: any, turnPipeline: any) {
      if (isCardRuntimeIntegrityBlocked()) return buildRuntimeIntegrityRejection();
      if (typeof cfg.isActive === 'function' && cfg.isActive() === true) {
        const actionType = action && (action.type || action.actionType) ? String(action.type || action.actionType) : '';
        const shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
        const isBoardPlacement = action && Number.isFinite(action.row) && Number.isFinite(action.col);
        const pendingTypeForBoardPlacement = isBoardPlacement
          ? getPendingEffectType(cardStateArg, playerKey, {
            getPendingEffectType: cfg.getPendingEffectType,
            normalizePlayerKey: cfg.normalizePlayerKey
          })
          : null;
        const isPass = actionType === 'pass';
        if (!shouldDeferNetworkPublish && isBoardPlacement) {
          return queueBoardPlacementPublish(playerKey, action, !pendingTypeForBoardPlacement);
        }

        if (!shouldDeferNetworkPublish && isPass) {
          return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, { actionType: 'pass' }));
        }

        if (!shouldDeferNetworkPublish && (actionType === 'cancel_card' || actionType === 'destroy_hand_card')) {
          return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, { actionType: actionType }));
        }

        if (actionType === 'use_card') {
          const cardId = action && (action.useCardId || action.cardId);
          const cardType = resolveCardTypeForId(cardId, {
            resolveCardTypeForId: cfg.resolveCardTypeForId
          });
          if (typeof cfg.resolveCardTypeForId === 'function' && cardId && !cardType) {
            return {
              ok: false,
              rejectedReason: 'PENDING_CARD_TYPE_UNRESOLVED',
              cardId: cardId || null
            };
          }

          return {
            ok: true,
            pendingSelectionActive: shouldDeferNetworkPublishForPendingType(cardType || ''),
            skippedLocalExecution: true,
            publishPromise: queueCommandPublish(playerKey, action, { actionType: 'use_card' }),
            playbackEvents: [],
            nextCardState: cardStateArg,
            nextGameState: gameStateArg
          };
        }
      }

      const result = originalRunTurnWithAdapter.call(rootRef.TurnPipelineUIAdapter, cardStateArg, gameStateArg, playerKey, action, turnPipeline);

      if (typeof cfg.isActive === 'function' && cfg.isActive() === true && result && result.ok !== false) {
        const deferredByAction = !!(action && action.deferNetworkPublish === true);
        const pendingType = getPendingEffectType(
          result.nextCardState || cardStateArg,
          playerKey,
          {
            getPendingEffectType: cfg.getPendingEffectType,
            normalizePlayerKey: cfg.normalizePlayerKey
          }
        );
        if (!deferredByAction && !shouldDeferNetworkPublishForPendingType(pendingType)) {
          queueCommandPublish(playerKey, action, {
            actionType: action && (action.type || action.actionType) ? String(action.type || action.actionType) : 'action',
            playbackEvents: Array.isArray(result.playbackEvents) ? result.playbackEvents : [],
            localPlaybackEmitted: Array.isArray(result.playbackEvents) && result.playbackEvents.length > 0
          });
        }
      }

      return result;
    };

    installed = true;
    return true;
  }

  function teardown(): void {
    if (!installed) return;
    if (rootRef.TurnPipelineUIAdapter && originalRunTurnWithAdapter) {
      rootRef.TurnPipelineUIAdapter.runTurnWithAdapter = originalRunTurnWithAdapter;
    }
    originalRunTurnWithAdapter = null;
    installed = false;
  }

  return {
    install,
    teardown,
    isInstalled: function () { return installed; }
  };
}

const ActionBridge = {
  buildPendingCardUsePlaybackEvents,
  createNetworkActionBridge
};

export = ActionBridge;
