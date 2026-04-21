(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));
    } else {
        root.NetworkCommandPayloadModule = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    var networkActionSchemaModule = null;
    var pendingCoordinatorModule = null;
    var OMITTED_ACTION_KEYS = Object.freeze({
        type: true,
        actionType: true,
        actor: true,
        playerKey: true,
        actionId: true,
        turnIndex: true,
        deferNetworkPublish: true,
        snapshot: true,
        playbackEvents: true
    });

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

    function cloneData(value) {
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function serializeActionForCommandPayload(action, fallbackPlayerKey, options) {
        if (!action || typeof action !== 'object') return null;

        var opts = (options && typeof options === 'object') ? options : {};
        var schema = resolveNetworkActionSchemaModule();
        if (schema && typeof schema.serializeAction === 'function') {
            var serialized = schema.serializeAction(action, fallbackPlayerKey);
            if (serialized) return serialized;
        }

        var actionType = String(action.type || action.actionType || '').trim().toLowerCase();
        if (!actionType) return null;

        var payload = {
            actionType: actionType,
            actor: normalizePlayerKey(action.actor || action.playerKey || fallbackPlayerKey, 'black', opts.normalizePlayerKey),
            params: {}
        };
        if (action.actionId) payload.actionId = String(action.actionId);
        if (Number.isFinite(Number(action.turnIndex))) payload.turnIndex = Math.trunc(Number(action.turnIndex));

        var keys = Object.keys(action);
        for (var index = 0; index < keys.length; index += 1) {
            var key = keys[index];
            if (OMITTED_ACTION_KEYS[key]) continue;
            if (typeof action[key] === 'undefined') continue;
            payload.params[key] = cloneData(action[key]);
        }
        return payload;
    }

    function applyPendingSelectionCardContext(params, actor, options) {
        var opts = (options && typeof options === 'object') ? options : {};
        var pendingCoordinator = resolvePendingCoordinatorModule(opts.pendingCoordinator);
        if (pendingCoordinator && typeof pendingCoordinator.applyPendingSelectionCardContext === 'function') {
            pendingCoordinator.applyPendingSelectionCardContext(params, actor, params && params.pendingSelectionState, {
                action: opts.action
            });
            return params;
        }

        var pendingSelectionState = (params && params.pendingSelectionState && typeof params.pendingSelectionState === 'object')
            ? params.pendingSelectionState
            : null;
        var deferredCardId = pendingSelectionState && typeof pendingSelectionState.cardId === 'string'
            ? String(pendingSelectionState.cardId).trim()
            : '';
        if (!deferredCardId) return params;
        if (!params.useCardId) {
            params.useCardId = deferredCardId;
        }
        if (!params.useCardOwnerKey) {
            params.useCardOwnerKey = actor;
        }
        return params;
    }

    function buildPublishCommandPayload(info, options) {
        var source = (info && typeof info === 'object') ? info : {};
        var opts = (options && typeof options === 'object') ? options : {};
        var playerKey = normalizePlayerKey(opts.playerKey, 'black', opts.normalizePlayerKey);
        var action = (source.action && typeof source.action === 'object') ? source.action : null;
        var schema = resolveNetworkActionSchemaModule();
        var actionType = String(source.actionType || (action && (action.type || action.actionType)) || '').trim().toLowerCase();

        if (action) {
            var serialized = serializeActionForCommandPayload(action, playerKey, opts);
            if (serialized) {
                var params = (serialized.params && typeof serialized.params === 'object')
                    ? serialized.params
                    : {};
                applyPendingSelectionCardContext(
                    params,
                    serialized.actor || playerKey,
                    {
                        pendingCoordinator: opts.pendingCoordinator,
                        action: action
                    }
                );
                serialized.params = params;
                if (!schema || typeof schema.shouldUseCommandPayload !== 'function' || schema.shouldUseCommandPayload(serialized)) {
                    return serialized;
                }
            }
        }

        if (actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart') {
            return {
                actionType: actionType,
                actor: playerKey,
                params: {}
            };
        }

        return null;
    }

    return {
        serializeActionForCommandPayload: serializeActionForCommandPayload,
        buildPublishCommandPayload: buildPublishCommandPayload
    };
}));
