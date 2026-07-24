import type {
    MatchCommandRuntimePort,
    MatchRuntimeCommand,
    MatchRuntimeCommandResult
} from './match-runtime-ports';

export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult>
): TResult;
export function executeMatchRuntimeCommand(
    command: MatchRuntimeCommand,
    port: null | undefined
): MatchRuntimeCommandResult;
export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult> | null | undefined
): TResult | MatchRuntimeCommandResult;
export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult> | null | undefined
): TResult | MatchRuntimeCommandResult {
    if (!port || typeof port.execute !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }
    return port.execute(command);
}

type MatchCommandRecord = Record<string, unknown>;

interface MatchCommandBuiltAction {
    actor?: unknown;
    action?: unknown;
}

interface MatchCommandPendingValidation {
    ok?: unknown;
    pendingEffectId?: unknown;
    rejectedReason?: unknown;
}

export interface PrepareMatchCommandActionOptions {
    snapshot: MatchCommandRecord;
    body: MatchCommandRecord;
    playerKey: string;
    networkDebugEnabled?: boolean;
    buildAction: (
        input: MatchCommandRecord,
        fallbackActor: unknown,
        fallbackTurnIndex: unknown
    ) => MatchCommandBuiltAction | null | undefined;
    normalizePlayerKey: (value: unknown) => unknown;
    validatePendingSelectionPublish: (
        snapshot: MatchCommandRecord,
        playerKey: string,
        action: unknown
    ) => MatchCommandPendingValidation | null | undefined;
    sanitizePendingSelectionActionForAuthority: (
        snapshot: MatchCommandRecord,
        playerKey: string,
        action: unknown
    ) => unknown;
}

export type PreparedMatchCommandAction =
    | {
        ok: false;
        rejectedReason: string;
    }
    | {
        ok: true;
        currentTurnIndex: number;
        currentCardState: MatchCommandRecord;
        resolvedAction: unknown;
        pendingValidation: MatchCommandPendingValidation;
    };

export interface MatchCommandTurnStartSkipOptions {
    cardState: MatchCommandRecord;
    playerKey: string;
    resolvedAction: unknown;
    isSubPlacementTurnActive?: (
        cardState: MatchCommandRecord,
        playerKey: string
    ) => unknown;
}

function asRecord(value: unknown): MatchCommandRecord {
    return value && typeof value === 'object' ? value as MatchCommandRecord : {};
}

type NetworkDebugActionValidation =
    | {
        ok: false;
        rejectedReason: string;
    }
    | {
        ok: true;
        action: MatchCommandRecord;
    };

function validateNetworkDebugOptions(
    actionValue: unknown,
    networkDebugEnabled: boolean
): NetworkDebugActionValidation {
    const action = asRecord(actionValue);
    if (!Object.prototype.hasOwnProperty.call(action, 'debugOptions')) {
        return { ok: true, action };
    }

    const debugOptions = action.debugOptions;
    const hasNoDebugOptions = (
        debugOptions === null
        || typeof debugOptions === 'undefined'
        || (
            typeof debugOptions === 'object'
            && !Array.isArray(debugOptions)
            && Object.keys(debugOptions as MatchCommandRecord).length === 0
        )
    );
    if (hasNoDebugOptions) {
        const normalizedAction = Object.assign({}, action);
        delete normalizedAction.debugOptions;
        return { ok: true, action: normalizedAction };
    }
    if (!networkDebugEnabled) {
        return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
    }
    if (!debugOptions || typeof debugOptions !== 'object' || Array.isArray(debugOptions)) {
        return { ok: false, rejectedReason: 'NETWORK_DEBUG_OPTIONS_INVALID' };
    }
    const debugRecord = debugOptions as MatchCommandRecord;
    const optionKeys = Object.keys(debugRecord).sort();
    if (
        optionKeys.length !== 2
        || optionKeys[0] !== 'ignoreCost'
        || optionKeys[1] !== 'noConsume'
        || debugRecord.ignoreCost !== true
        || debugRecord.noConsume !== true
    ) {
        return { ok: false, rejectedReason: 'NETWORK_DEBUG_OPTIONS_INVALID' };
    }

    return {
        ok: true,
        action: Object.assign({}, action, {
            debugOptions: {
                ignoreCost: true,
                noConsume: true
            }
        })
    };
}

export function prepareMatchCommandAction(
    options: PrepareMatchCommandActionOptions
): PreparedMatchCommandAction {
    const currentCardState = asRecord(options.snapshot.cardState);
    const currentTurnIndex = Number.isFinite(Number(currentCardState.turnIndex))
        ? Number(currentCardState.turnIndex)
        : 0;
    const builtAction = options.buildAction({
        actionType: options.body.actionType,
        actor: options.body.actor,
        params: options.body.params,
        actionId: options.body.actionId,
        turnIndex: options.body.turnIndex,
        action: options.body.action
    }, options.playerKey, currentTurnIndex);

    if (!builtAction || !builtAction.action) {
        return { ok: false, rejectedReason: 'COMMAND_REQUIRED' };
    }
    if (options.normalizePlayerKey(builtAction.actor) !== options.playerKey) {
        return { ok: false, rejectedReason: 'SEAT_MISMATCH' };
    }

    const debugValidation = validateNetworkDebugOptions(
        builtAction.action,
        options.networkDebugEnabled === true
    );
    if (debugValidation.ok !== true) {
        return debugValidation;
    }
    const authorityAction = debugValidation.action;

    const pendingValidation = options.validatePendingSelectionPublish(
        options.snapshot,
        options.playerKey,
        authorityAction
    );
    if (!pendingValidation || pendingValidation.ok !== true) {
        return {
            ok: false,
            rejectedReason: typeof pendingValidation?.rejectedReason === 'string' && pendingValidation.rejectedReason
                ? pendingValidation.rejectedReason
                : 'STALE_PENDING_SELECTION'
        };
    }

    return {
        ok: true,
        currentTurnIndex,
        currentCardState,
        resolvedAction: options.sanitizePendingSelectionActionForAuthority(
            options.snapshot,
            options.playerKey,
            authorityAction
        ),
        pendingValidation
    };
}

export function shouldSkipMatchCommandTurnStart(options: MatchCommandTurnStartSkipOptions): boolean {
    const skipTurnStartForSubPlacement = !!(
        typeof options.isSubPlacementTurnActive === 'function'
        && options.isSubPlacementTurnActive(options.cardState, options.playerKey)
    );
    const resolvedAction = asRecord(options.resolvedAction);
    const pendingByPlayer = asRecord(options.cardState.pendingEffectByPlayer);
    const expectedPendingForPlayer = asRecord(pendingByPlayer[options.playerKey]);
    const expectedPendingType = String(expectedPendingForPlayer.type || '').toUpperCase();
    const skipTurnStartForPendingSelection = !!(
        resolvedAction.pendingSelectionState
        && typeof resolvedAction.pendingSelectionState === 'object'
        && expectedPendingType
    );
    return skipTurnStartForSubPlacement || skipTurnStartForPendingSelection;
}
