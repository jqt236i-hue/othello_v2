(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));
    } else {
        root.NetworkActionBridgeModule = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    var cardLogicModule = null;
    var networkActionSchemaModule = null;
    var pendingCoordinatorModule = null;
    var playbackEventHelpersModule = null;

    function resolveCardLogicModule(override) {
        if (override && typeof override === 'object') return override;
        if (cardLogicModule) return cardLogicModule;
        if (typeof require === 'function') {
            try { cardLogicModule = require('../../game/logic/cards'); } catch (e) { /* ignore */ }
        }
        if (!cardLogicModule && root && root.CardLogic) {
            cardLogicModule = root.CardLogic;
        }
        return cardLogicModule;
    }

    function resolvePendingCoordinatorModule(override) {
        if (override && typeof override === 'object') return override;
        if (pendingCoordinatorModule) return pendingCoordinatorModule;
        if (typeof require === 'function') {
            try { pendingCoordinatorModule = require('../../game/turn/pending-coordinator'); } catch (e) { /* ignore */ }
        }
        if (!pendingCoordinatorModule && root && root.PendingCoordinator) {
            pendingCoordinatorModule = root.PendingCoordinator;
        }
        return pendingCoordinatorModule;
    }

    function resolveNetworkActionSchemaModule() {
        if (networkActionSchemaModule) return networkActionSchemaModule;
        if (typeof require === 'function') {
            try { networkActionSchemaModule = require('../../shared/network-action-schema'); } catch (e) { /* ignore */ }
        }
        if (!networkActionSchemaModule && root && root.NetworkActionSchema) {
            networkActionSchemaModule = root.NetworkActionSchema;
        }
        return networkActionSchemaModule;
    }

    function resolvePlaybackEventHelpersModule(override) {
        if (override && typeof override === 'object') return override;
        if (playbackEventHelpersModule) return playbackEventHelpersModule;
        if (typeof require === 'function') {
            try { playbackEventHelpersModule = require('../../shared/playback-event-helpers'); } catch (e) { /* ignore */ }
        }
        if (!playbackEventHelpersModule && root && root.PlaybackEventHelpers) {
            playbackEventHelpersModule = root.PlaybackEventHelpers;
        }
        return playbackEventHelpersModule;
    }

    function defaultNormalizePlayerKey(value, fallback) {
        var normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        var fallbackNormalized = (fallback === null || typeof fallback === 'undefined')
            ? ''
            : String(fallback).trim().toLowerCase();

        if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
        if (value === 1 || normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (fallback === -1 || fallbackNormalized === 'white' || fallbackNormalized === '-1') return 'white';
        return 'black';
    }

    function normalizePlayerKey(value, fallback, override) {
        if (typeof override === 'function') {
            try {
                return override(value, fallback);
            } catch (e) { /* ignore */ }
        }
        var schema = resolveNetworkActionSchemaModule();
        if (schema && typeof schema.normalizePlayerKey === 'function') {
            return schema.normalizePlayerKey(value, fallback);
        }
        return defaultNormalizePlayerKey(value, fallback);
    }

    function resolveCardTypeForId(cardId, options) {
        if (!cardId) return null;
        var opts = (options && typeof options === 'object') ? options : {};
        var cardLogic = resolveCardLogicModule(opts.cardLogicModule);
        if (!cardLogic || typeof cardLogic.getCardDef !== 'function') return null;
        var def = cardLogic.getCardDef(cardId);
        return (def && def.type) ? String(def.type) : null;
    }

    function hasCardInHand(cardStateValue, playerKey, cardId, fallbackNormalizePlayerKey) {
        if (!cardStateValue || !cardId) return false;
        var normalizedPlayerKey = normalizePlayerKey(playerKey, 'black', fallbackNormalizePlayerKey);
        var hands = cardStateValue && cardStateValue.hands && typeof cardStateValue.hands === 'object'
            ? cardStateValue.hands
            : null;
        var hand = hands && Array.isArray(hands[normalizedPlayerKey]) ? hands[normalizedPlayerKey] : null;
        if (!hand) return false;
        for (var index = 0; index < hand.length; index += 1) {
            if (String(hand[index]) === String(cardId)) {
                return true;
            }
        }
        return false;
    }

    function buildPendingCardUsePlaybackEvents(playerKey, cardId, cardType, options) {
        if (!cardId) return [];

        var opts = (options && typeof options === 'object') ? options : {};
        var normalizedPlayerKey = normalizePlayerKey(playerKey, 'black', opts.normalizePlayerKey);
        var cardLogic = resolveCardLogicModule(opts.cardLogicModule);
        var playbackEventHelpers = resolvePlaybackEventHelpersModule(opts.playbackEventHelpersModule);
        var cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
            ? cardLogic.getCardDef(cardId)
            : null;
        var resolvedCardType = cardType || (cardDef && cardDef.type ? String(cardDef.type) : null);
        var cost = (cardDef && Number.isFinite(Number(cardDef.cost)))
            ? Number(cardDef.cost)
            : null;
        var name = (cardDef && cardDef.name)
            ? String(cardDef.name)
            : null;
        var costTier = (cardDef && cardDef.costTier)
            ? String(cardDef.costTier)
            : null;
        var visualDescriptor = (playbackEventHelpers && typeof playbackEventHelpers.createCardVisualDescriptor === 'function')
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

    function buildSkippedLocalExecutionResult(publishPromise) {
        return {
            ok: true,
            skippedLocalExecution: true,
            playbackEvents: [],
            publishPromise: publishPromise
        };
    }

    function getPendingEffectType(pendingCoordinator, cardStateValue, playerKey, fallbackNormalizePlayerKey) {
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

    function createNetworkActionBridge(config) {
        var cfg = (config && typeof config === 'object') ? config : {};
        var rootRef = cfg.root || root;
        var installed = false;
        var originalRunTurnWithAdapter = null;

        function queueCommandPublish(playerKey, action, options) {
            if (typeof cfg.queueCommandPublish !== 'function') {
                throw new Error('queueCommandPublish_unavailable');
            }
            return cfg.queueCommandPublish(playerKey, action, options);
        }

        function shouldDeferNetworkPublishForPendingType(cardType) {
            if (typeof cfg.shouldDeferNetworkPublishForPendingType === 'function') {
                return cfg.shouldDeferNetworkPublishForPendingType(cardType) === true;
            }
            var pendingCoordinator = resolvePendingCoordinatorModule(cfg.pendingCoordinatorModule);
            if (pendingCoordinator && typeof pendingCoordinator.shouldDeferNetworkPublishForPendingType === 'function') {
                return pendingCoordinator.shouldDeferNetworkPublishForPendingType(cardType) === true;
            }
            return false;
        }

        function install() {
            if (installed) return true;
            if (!rootRef.TurnPipelineUIAdapter || typeof rootRef.TurnPipelineUIAdapter.runTurnWithAdapter !== 'function') {
                return false;
            }

            originalRunTurnWithAdapter = rootRef.TurnPipelineUIAdapter.runTurnWithAdapter;
            rootRef.TurnPipelineUIAdapter.runTurnWithAdapter = function wrappedRunTurnWithAdapter(cardStateArg, gameStateArg, playerKey, action, turnPipeline) {
                if (typeof cfg.isActive === 'function' && cfg.isActive() === true) {
                    var actionType = action && (action.type || action.actionType) ? String(action.type || action.actionType) : '';
                    var shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
                    var isBoardPlacement = action && Number.isFinite(action.row) && Number.isFinite(action.col);
                    var isPass = actionType === 'pass';
                    if (!shouldDeferNetworkPublish && (isBoardPlacement || isPass)) {
                        return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, {
                            actionType: isBoardPlacement ? 'place' : 'pass'
                        }));
                    }

                    if (!shouldDeferNetworkPublish && (actionType === 'cancel_card' || actionType === 'destroy_hand_card')) {
                        return buildSkippedLocalExecutionResult(queueCommandPublish(playerKey, action, { actionType: actionType }));
                    }

                    if (actionType === 'use_card') {
                        var cardId = action && (action.useCardId || action.cardId);
                        var cardType = resolveCardTypeForId(cardId, {
                            cardLogicModule: cfg.cardLogicModule
                        });
                        if (!cardType && !hasCardInHand(cardStateArg, playerKey, cardId, cfg.normalizePlayerKey)) {
                            return {
                                ok: false,
                                rejectedReason: 'PENDING_CARD_TYPE_UNRESOLVED',
                                cardId: cardId || null
                            };
                        }

                        if (!shouldDeferNetworkPublishForPendingType(cardType)) {
                            var immediateResult = originalRunTurnWithAdapter.call(
                                rootRef.TurnPipelineUIAdapter,
                                cardStateArg,
                                gameStateArg,
                                playerKey,
                                action,
                                turnPipeline
                            );
                            if (!immediateResult || immediateResult.ok === false) {
                                return immediateResult;
                            }
                            immediateResult.publishPromise = queueCommandPublish(playerKey, action, {
                                actionType: 'use_card',
                                playbackEvents: Array.isArray(immediateResult.playbackEvents) ? immediateResult.playbackEvents : [],
                                usedSnapshotFallback: true
                            });
                            return immediateResult;
                        }

                        return {
                            ok: true,
                            pendingSelectionActive: true,
                            skippedLocalExecution: true,
                            publishPromise: queueCommandPublish(playerKey, action, { actionType: 'use_card' }),
                            playbackEvents: [],
                            nextCardState: cardStateArg,
                            nextGameState: gameStateArg
                        };
                    }
                }

                var result = originalRunTurnWithAdapter.call(rootRef.TurnPipelineUIAdapter, cardStateArg, gameStateArg, playerKey, action, turnPipeline);

                if (typeof cfg.isActive === 'function' && cfg.isActive() === true && result && result.ok !== false) {
                    var pendingCoordinatorForResult = resolvePendingCoordinatorModule(cfg.pendingCoordinatorModule);
                    var deferredByAction = !!(action && action.deferNetworkPublish === true);
                    var pendingType = getPendingEffectType(
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

        function teardown() {
            if (!installed) return;
            if (rootRef.TurnPipelineUIAdapter && originalRunTurnWithAdapter) {
                rootRef.TurnPipelineUIAdapter.runTurnWithAdapter = originalRunTurnWithAdapter;
            }
            originalRunTurnWithAdapter = null;
            installed = false;
        }

        return {
            install: install,
            teardown: teardown,
            isInstalled: function () { return installed; }
        };
    }

    return {
        buildPendingCardUsePlaybackEvents: buildPendingCardUsePlaybackEvents,
        createNetworkActionBridge: createNetworkActionBridge
    };
}));
