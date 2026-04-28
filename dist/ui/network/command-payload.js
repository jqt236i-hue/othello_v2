'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const OMITTED_ACTION_KEYS = Object.freeze({
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
let networkActionSchemaModule = null;
let pendingCoordinatorModule = null;
function resolveNetworkActionSchemaModule() {
    if (networkActionSchemaModule)
        return networkActionSchemaModule;
    try {
        networkActionSchemaModule = _require('../../shared/network-action-schema');
    }
    catch (e) { /* ignore */ }
    if (!networkActionSchemaModule && typeof globalThis !== 'undefined' && globalThis.NetworkActionSchema) {
        networkActionSchemaModule = globalThis.NetworkActionSchema;
    }
    return networkActionSchemaModule;
}
function resolvePendingCoordinatorModule(override) {
    if (override && typeof override === 'object')
        return override;
    if (pendingCoordinatorModule)
        return pendingCoordinatorModule;
    try {
        pendingCoordinatorModule = _require('../../game/turn/pending-coordinator');
    }
    catch (e) { /* ignore */ }
    if (!pendingCoordinatorModule && typeof globalThis !== 'undefined' && globalThis.PendingCoordinator) {
        pendingCoordinatorModule = globalThis.PendingCoordinator;
    }
    return pendingCoordinatorModule;
}
function defaultNormalizePlayerKey(value, fallback) {
    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();
    const fallbackNormalized = (fallback === null || typeof fallback === 'undefined')
        ? ''
        : String(fallback).trim().toLowerCase();
    if (value === -1 || normalized === 'white' || normalized === '-1')
        return 'white';
    if (value === 1 || normalized === 'black' || normalized === '1' || normalized === '+1')
        return 'black';
    if (fallback === -1 || fallbackNormalized === 'white' || fallbackNormalized === '-1')
        return 'white';
    return 'black';
}
function normalizePlayerKey(value, fallback, override) {
    if (typeof override === 'function') {
        try {
            return override(value, fallback);
        }
        catch (e) { /* ignore */ }
    }
    const schema = resolveNetworkActionSchemaModule();
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
    }
    catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(value));
}
function serializeActionForCommandPayload(action, fallbackPlayerKey, options) {
    if (!action || typeof action !== 'object')
        return null;
    const opts = (options && typeof options === 'object') ? options : {};
    const schema = resolveNetworkActionSchemaModule();
    if (schema && typeof schema.serializeAction === 'function') {
        const serialized = schema.serializeAction(action, fallbackPlayerKey);
        if (serialized)
            return serialized;
    }
    const actionType = String(action.type || action.actionType || '').trim().toLowerCase();
    if (!actionType)
        return null;
    const payload = {
        actionType: actionType,
        actor: normalizePlayerKey(action.actor || action.playerKey || fallbackPlayerKey, 'black', opts.normalizePlayerKey),
        params: {}
    };
    if (action.actionId)
        payload.actionId = String(action.actionId);
    if (Number.isFinite(Number(action.turnIndex)))
        payload.turnIndex = Math.trunc(Number(action.turnIndex));
    const keys = Object.keys(action);
    for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (OMITTED_ACTION_KEYS[key])
            continue;
        if (typeof action[key] === 'undefined')
            continue;
        payload.params[key] = cloneData(action[key]);
    }
    return payload;
}
function applyPendingSelectionCardContext(params, actor, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const pendingCoordinator = resolvePendingCoordinatorModule(opts.pendingCoordinator);
    if (pendingCoordinator && typeof pendingCoordinator.applyPendingSelectionCardContext === 'function') {
        pendingCoordinator.applyPendingSelectionCardContext(params, actor, params && params.pendingSelectionState, {
            action: opts.action
        });
        return params;
    }
    return params;
}
function buildPublishCommandPayload(info, options) {
    const source = (info && typeof info === 'object') ? info : {};
    const opts = (options && typeof options === 'object') ? options : {};
    const playerKey = normalizePlayerKey(opts.playerKey, 'black', opts.normalizePlayerKey);
    const action = (source.action && typeof source.action === 'object') ? source.action : null;
    const schema = resolveNetworkActionSchemaModule();
    const actionType = String(source.actionType || (action && (action.type || action.actionType)) || '').trim().toLowerCase();
    if (action) {
        const serialized = serializeActionForCommandPayload(action, playerKey, opts);
        if (serialized) {
            const params = (serialized.params && typeof serialized.params === 'object')
                ? serialized.params
                : {};
            applyPendingSelectionCardContext(params, serialized.actor || playerKey, {
                pendingCoordinator: opts.pendingCoordinator,
                action: action
            });
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
const CommandPayload = {
    serializeActionForCommandPayload,
    buildPublishCommandPayload
};
module.exports = CommandPayload;
//# sourceMappingURL=command-payload.js.map