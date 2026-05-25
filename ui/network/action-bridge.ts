'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let cardLogicModule: any = null;
let networkActionSchemaModule: any = null;
let pendingCoordinatorModule: any = null;
let playbackEventHelpersModule: any = null;
const PlayerKeyHelpers = _require('./player-key');

function resolveCardLogicModule(override?: any): any {
  if (override && typeof override === 'object') return override;
  if (cardLogicModule) return cardLogicModule;
  try {
    cardLogicModule = _require('../../game/logic/cards.js');
  } catch (e) { /* ignore */ }
  if (!cardLogicModule && typeof globalThis !== 'undefined' && (globalThis as any).CardLogic) {
    cardLogicModule = (globalThis as any).CardLogic;
  }
  return cardLogicModule;
}

function resolvePendingCoordinatorModule(override?: any): any {
  if (override && typeof override === 'object') return override;
  if (pendingCoordinatorModule) return pendingCoordinatorModule;
  try {
    pendingCoordinatorModule = _require('../../game/turn/pending-coordinator.js');
  } catch (e) { /* ignore */ }
  if (!pendingCoordinatorModule && typeof globalThis !== 'undefined' && (globalThis as any).PendingCoordinator) {
    pendingCoordinatorModule = (globalThis as any).PendingCoordinator;
  }
  return pendingCoordinatorModule;
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

function getPendingEffectType(pendingCoordinator: any, cardStateValue: any, playerKey: any, fallbackNormalizePlayerKey?: any): any {
  try {
    if (pendingCoordinator && typeof pendingCoordinator.getPendingEffectType === 'function') {
      return pendingCoordinator.getPendingEffectType(
        cardStateValue,
        normalizePlayerKey(playerKey, 'black', fallbackNormalizePlayerKey)
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
    const pendingCoordinator = resolvePendingCoordinatorModule(cfg.pendingCoordinatorModule);
    if (pendingCoordinator && typeof pendingCoordinator.shouldDeferNetworkPublishForPendingType === 'function') {
      return pendingCoordinator.shouldDeferNetworkPublishForPendingType(cardType) === true;
    }
    return false;
  }

  function install(): boolean {
    if (installed) return true;
    if (!rootRef.TurnPipelineUIAdapter || typeof rootRef.TurnPipelineUIAdapter.runTurnWithAdapter !== 'function') {
      return false;
    }

    originalRunTurnWithAdapter = rootRef.TurnPipelineUIAdapter.runTurnWithAdapter;
    rootRef.TurnPipelineUIAdapter.runTurnWithAdapter = function wrappedRunTurnWithAdapter(cardStateArg: any, gameStateArg: any, playerKey: any, action: any, turnPipeline: any) {
      if (typeof cfg.isActive === 'function' && cfg.isActive() === true) {
        const actionType = action && (action.type || action.actionType) ? String(action.type || action.actionType) : '';
        const shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
        const isBoardPlacement = action && Number.isFinite(action.row) && Number.isFinite(action.col);
        const isPass = actionType === 'pass';
        if (!shouldDeferNetworkPublish && (isBoardPlacement || isPass)) {
          return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, {
            actionType: isBoardPlacement ? 'place' : 'pass'
          }));
        }

        if (!shouldDeferNetworkPublish && (actionType === 'cancel_card' || actionType === 'destroy_hand_card')) {
          return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, { actionType: actionType }));
        }

        if (actionType === 'use_card') {
          const cardId = action && (action.useCardId || action.cardId);
          const cardType = resolveCardTypeForId(cardId, {
            cardLogicModule: cfg.cardLogicModule
          });
          const pendingCoordinator = resolvePendingCoordinatorModule(cfg.pendingCoordinatorModule);
          if (pendingCoordinator && !cardType) {
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
        const pendingCoordinatorForResult = resolvePendingCoordinatorModule(cfg.pendingCoordinatorModule);
        const deferredByAction = !!(action && action.deferNetworkPublish === true);
        const pendingType = getPendingEffectType(
          pendingCoordinatorForResult,
          result.nextCardState || cardStateArg,
          playerKey,
          cfg.normalizePlayerKey
        );
        if (!deferredByAction && !shouldDeferNetworkPublishForPendingType(pendingType)) {
          queueCommandPublish(playerKey, action, {
            actionType: action && (action.type || action.actionType) ? String(action.type || action.actionType) : 'action',
            playbackEvents: Array.isArray(result.playbackEvents) ? result.playbackEvents : []
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
