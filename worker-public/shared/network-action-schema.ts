(function (root: any, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkActionSchema = factory();
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function () {
    'use strict';

    interface OmittedActionKeys {
        [key: string]: boolean;
    }

    interface SerializedAction {
        actionType: string;
        actor: string;
        params: Record<string, unknown>;
        actionId?: string;
        turnIndex?: number;
    }

    interface BuiltAction {
        actor: string;
        action: Record<string, unknown>;
    }

    const OMITTED_ACTION_KEYS: OmittedActionKeys = Object.freeze({
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

    function cloneData<T>(value: T): T {
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function parseSeatKeyOptional(value: unknown): 'black' | 'white' | null {
        if (value === 1 || value === '1') return 'black';
        if (value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    function normalizePlayerKey(value: unknown, fallback: unknown): 'black' | 'white' {
        return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallback) || 'black';
    }

    function normalizeActionType(value: unknown, fallback: unknown): string {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized || String(fallback || '').trim().toLowerCase();
    }

    function serializeAction(action: unknown, fallbackActor: unknown): SerializedAction | null {
        if (!action || typeof action !== 'object') return null;

        const actionType = normalizeActionType((action as Record<string, unknown>).type || (action as Record<string, unknown>).actionType, '');
        if (!actionType) return null;

        const payload: SerializedAction = {
            actionType,
            actor: normalizePlayerKey((action as Record<string, unknown>).actor || (action as Record<string, unknown>).playerKey, fallbackActor),
            params: {}
        };

        if ((action as Record<string, unknown>).actionId) {
            payload.actionId = String((action as Record<string, unknown>).actionId);
        }
        if (Number.isFinite(Number((action as Record<string, unknown>).turnIndex))) {
            payload.turnIndex = Math.trunc(Number((action as Record<string, unknown>).turnIndex));
        }

        const keys = Object.keys(action as Record<string, unknown>);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (OMITTED_ACTION_KEYS[key]) continue;
            if (typeof (action as Record<string, unknown>)[key] === 'undefined') continue;
            payload.params[key] = cloneData((action as Record<string, unknown>)[key]);
        }

        return payload;
    }

    function shouldUseCommandPayload(actionOrPayload: unknown): boolean {
        const normalized = (
            actionOrPayload &&
            typeof actionOrPayload === 'object' &&
            (actionOrPayload as Record<string, unknown>).params &&
            (actionOrPayload as Record<string, unknown>).actionType
        )
            ? actionOrPayload as SerializedAction
            : serializeAction(actionOrPayload as Record<string, unknown>, (actionOrPayload as Record<string, unknown>) && (actionOrPayload as Record<string, unknown>).actor);
        if (!normalized) return false;

        const actionType = normalizeActionType(normalized.actionType, '');
        if (!actionType) return false;
        if (actionType === 'action') return false;
        return true;
    }

    function buildAction(input: unknown, fallbackActor: unknown, fallbackTurnIndex: unknown): BuiltAction | null {
        const source = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
        const explicitAction = (source.action && typeof source.action === 'object') ? source.action as Record<string, unknown> : null;
        const actionType = normalizeActionType(
            source.actionType || (explicitAction && (explicitAction.type || explicitAction.actionType)),
            ''
        );
        if (!actionType) return null;

        const params = (source.params && typeof source.params === 'object')
            ? cloneData(source.params as Record<string, unknown>)
            : ((explicitAction && serializeAction(explicitAction, fallbackActor))
                ? (serializeAction(explicitAction, fallbackActor) as SerializedAction).params
                : {});

        const action: Record<string, unknown> = Object.assign({ type: actionType }, params || {});
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
