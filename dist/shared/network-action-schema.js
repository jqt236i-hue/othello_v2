"use strict";
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    }
    else {
        root.NetworkActionSchema = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
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
    function cloneData(value) {
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        }
        catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }
    function parseSeatKeyOptional(value) {
        if (value === 1 || value === '1')
            return 'black';
        if (value === -1 || value === '-1')
            return 'white';
        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'black' || normalized === '1' || normalized === '+1')
            return 'black';
        if (normalized === 'white' || normalized === '-1')
            return 'white';
        return null;
    }
    function normalizePlayerKey(value, fallback) {
        return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallback) || 'black';
    }
    function normalizeActionType(value, fallback) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || String(fallback || '').trim().toLowerCase();
    }
    function serializeAction(action, fallbackActor) {
        if (!action || typeof action !== 'object')
            return null;
        const actionType = normalizeActionType(action.type || action.actionType, '');
        if (!actionType)
            return null;
        const payload = {
            actionType,
            actor: normalizePlayerKey(action.actor || action.playerKey, fallbackActor),
            params: {}
        };
        if (action.actionId) {
            payload.actionId = String(action.actionId);
        }
        if (Number.isFinite(Number(action.turnIndex))) {
            payload.turnIndex = Math.trunc(Number(action.turnIndex));
        }
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
    function shouldUseCommandPayload(actionOrPayload) {
        const normalized = (actionOrPayload &&
            typeof actionOrPayload === 'object' &&
            actionOrPayload.params &&
            actionOrPayload.actionType)
            ? actionOrPayload
            : serializeAction(actionOrPayload, actionOrPayload && actionOrPayload.actor);
        if (!normalized)
            return false;
        const actionType = normalizeActionType(normalized.actionType, '');
        if (!actionType)
            return false;
        if (actionType === 'action')
            return false;
        return true;
    }
    function buildAction(input, fallbackActor, fallbackTurnIndex) {
        const source = (input && typeof input === 'object') ? input : {};
        const explicitAction = (source.action && typeof source.action === 'object') ? source.action : null;
        const actionType = normalizeActionType(source.actionType || (explicitAction && (explicitAction.type || explicitAction.actionType)), '');
        if (!actionType)
            return null;
        const params = (source.params && typeof source.params === 'object')
            ? cloneData(source.params)
            : ((explicitAction && serializeAction(explicitAction, fallbackActor))
                ? serializeAction(explicitAction, fallbackActor).params
                : {});
        const action = Object.assign({ type: actionType }, params || {});
        const actor = normalizePlayerKey(source.actor || (explicitAction && explicitAction.playerKey), fallbackActor);
        const actionId = source.actionId || (explicitAction && explicitAction.actionId);
        const turnIndex = Number.isFinite(Number(source.turnIndex))
            ? Math.trunc(Number(source.turnIndex))
            : (Number.isFinite(Number(fallbackTurnIndex)) ? Math.trunc(Number(fallbackTurnIndex)) : null);
        if (actionId) {
            action.actionId = String(actionId);
        }
        if (turnIndex !== null) {
            action.turnIndex = turnIndex;
        }
        return { actor, action };
    }
    return {
        normalizePlayerKey,
        normalizeActionType,
        serializeAction,
        shouldUseCommandPayload,
        buildAction
    };
}));
//# sourceMappingURL=network-action-schema.js.map