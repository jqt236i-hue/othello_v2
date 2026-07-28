import type {
    AppliedMatchCommandExecution,
    MatchCommandAuthorityCapabilities,
    MatchCommandAuthorityContext,
    MatchCommandExecutionCapabilities,
    MatchCommandExecutionFailure,
    MatchCommandExecutionResult,
    MatchCommandPlayerKey,
    MatchCommandPrepareResult,
    MatchCommandPrng,
    MatchCommandRecord,
    MatchCommandSnapshot,
    PreparedMatchCommandExecution,
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

function hasFunction(value: unknown, key: string): boolean {
    return !!(
        value
        && typeof value === 'object'
        && typeof (value as MatchCommandRecord)[key] === 'function'
    );
}

function toFailure(
    rejectedReason: string,
    errorMessage?: unknown,
    rawEvents?: readonly unknown[]
): MatchCommandExecutionFailure {
    const result: MatchCommandExecutionFailure = {
        ok: false,
        rejectedReason
    };
    if (typeof errorMessage !== 'undefined') {
        result.errorMessage = errorMessage === null
            ? null
            : String(errorMessage);
    }
    if (rawEvents) result.rawEvents = rawEvents;
    return result;
}

function toRawEvents(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

function isDebugFillCommand(
    body: MatchCommandRecord,
    capabilities: MatchCommandExecutionCapabilities | null | undefined
): boolean {
    const bodyAction = asRecord(body.action);
    const commandType = String(body.actionType || bodyAction.type || '').trim().toLowerCase();
    if (commandType === 'debug_fill_hand' || commandType === 'fill_debug_hand') return true;
    const debug = capabilities && capabilities.debug;
    return !!(
        debug
        && typeof debug.isDebugFillHandPayload === 'function'
        && debug.isDebugFillHandPayload(body)
    );
}

function isAutoCommand(
    body: MatchCommandRecord,
    capabilities: MatchCommandExecutionCapabilities | null | undefined
): boolean {
    const bodyAction = asRecord(body.action);
    const commandType = String(body.actionType || bodyAction.type || '').trim().toLowerCase();
    if (commandType === 'auto_turn') return true;
    const autoCommand = capabilities && capabilities.autoCommand;
    return !!(
        autoCommand
        && typeof autoCommand.isAutoTurnPublishBody === 'function'
        && autoCommand.isAutoTurnPublishBody(body)
    );
}

function validateSharedCapabilityGroups(
    body: MatchCommandRecord,
    capabilities: MatchCommandExecutionCapabilities | null | undefined
): MatchCommandExecutionFailure | null {
    if (!capabilities || !hasFunction(capabilities.schema, 'buildAction')) {
        return toFailure('COMMAND_SCHEMA_UNAVAILABLE');
    }
    if (
        !capabilities.snapshot
        || !hasFunction(capabilities.snapshot, 'cloneSnapshot')
        || !hasFunction(capabilities.snapshot, 'stripTransientChargeDeltaState')
        || !hasFunction(capabilities.snapshot, 'stripTransientPresentationState')
        || !capabilities.authority
        || !hasFunction(capabilities.authority, 'parseHiddenHandToken')
    ) {
        return toFailure('COMMAND_PIPELINE_UNAVAILABLE');
    }

    const debugFill = isDebugFillCommand(body, capabilities);
    if (debugFill) {
        if (
            !capabilities.debug
            || !hasFunction(capabilities.debug, 'isDebugFillHandPayload')
            || !hasFunction(capabilities.debug, 'resolveDebugFillHandOptions')
            || !hasFunction(capabilities.debug, 'fillDebugHand')
        ) {
            return toFailure('DEBUG_ACTIONS_UNAVAILABLE');
        }
        return null;
    }

    if (
        !capabilities.random
        || !hasFunction(capabilities.random, 'fromState')
        || !hasFunction(capabilities.random, 'createPrng')
        || !hasFunction(capabilities.random, 'deriveSeed')
        || !capabilities.pipeline
        || !hasFunction(capabilities.pipeline, 'applyTurnSafe')
        || !capabilities.turnStart
        || !hasFunction(capabilities.turnStart, 'isGameOver')
        || !hasFunction(capabilities.turnStart, 'createCardState')
        || !hasFunction(capabilities.turnStart, 'mergeWithDefaultShape')
        || !hasFunction(capabilities.turnStart, 'applyTurnStartPhase')
        || !capabilities.presentation
        || !hasFunction(capabilities.presentation, 'collectActionPlaybackEvents')
        || !capabilities.authority
        || !hasFunction(capabilities.authority, 'normalizePlayerKey')
        || !hasFunction(capabilities.authority, 'getCurrentPlayerKey')
        || !hasFunction(capabilities.authority, 'validatePendingSelectionPublish')
        || !hasFunction(capabilities.authority, 'sanitizePendingSelectionActionForAuthority')
        || !hasFunction(capabilities.authority, 'validateAuthoritativePendingSelectionResult')
    ) {
        return toFailure('COMMAND_PIPELINE_UNAVAILABLE');
    }

    if (isAutoCommand(body, capabilities)) {
        if (
            !capabilities.autoCommand
            || !hasFunction(capabilities.autoCommand, 'isAutoTurnPublishBody')
            || !hasFunction(capabilities.autoCommand, 'resolveAutoTurnPublishBody')
        ) {
            return toFailure('AUTO_COMMAND_PLANNER_UNAVAILABLE');
        }
    }
    return null;
}

export function validateCanonicalMatchCommandSnapshot(
    snapshotValue: unknown,
    authority: Pick<MatchCommandAuthorityCapabilities, 'parseHiddenHandToken'>
): snapshotValue is MatchCommandSnapshot {
    if (!snapshotValue || typeof snapshotValue !== 'object') return false;
    const snapshot = snapshotValue as MatchCommandRecord;
    if (!snapshot.gameState || typeof snapshot.gameState !== 'object') return false;
    if (!snapshot.cardState || typeof snapshot.cardState !== 'object') return false;

    const metadata = asRecord(snapshot._meta);
    if (
        Object.prototype.hasOwnProperty.call(metadata, 'projectedForSeat')
        || Object.prototype.hasOwnProperty.call(metadata, 'viewerRole')
    ) {
        return false;
    }

    if (!authority || typeof authority.parseHiddenHandToken !== 'function') return false;
    const cardState = asRecord(snapshot.cardState);
    const hands = asRecord(cardState.hands);
    for (const playerKey of ['black', 'white'] as const) {
        const hand = hands[playerKey];
        if (!Array.isArray(hand)) continue;
        if (hand.some((entry) => !!authority.parseHiddenHandToken(entry))) {
            return false;
        }
    }
    return true;
}

function createCommandPrng(
    context: MatchCommandAuthorityContext,
    snapshot: MatchCommandSnapshot,
    capabilities: MatchCommandExecutionCapabilities
): MatchCommandPrng {
    const cardState = asRecord(snapshot.cardState);
    const savedState = asRecord(cardState.prngState);
    if (
        Number.isFinite(Number(savedState.seed))
        && Number.isFinite(Number(savedState.calls))
    ) {
        try {
            return capabilities.random.fromState({
                seed: Math.trunc(Number(savedState.seed)),
                calls: Math.max(0, Math.trunc(Number(savedState.calls)))
            });
        } catch (_error) {
            // Invalid serialized state falls through to the deterministic seed.
        }
    }
    return capabilities.random.createPrng(
        capabilities.random.deriveSeed(context, snapshot, context.playerKey)
    );
}

export function prepareMatchCommandExecution(
    context: MatchCommandAuthorityContext,
    bodyValue: unknown,
    capabilities: MatchCommandExecutionCapabilities
): MatchCommandPrepareResult {
    const body = asRecord(bodyValue);
    const capabilityFailure = validateSharedCapabilityGroups(body, capabilities);
    if (capabilityFailure) {
        return { kind: 'terminal', result: capabilityFailure };
    }
    if (
        !capabilities.authority
        || !validateCanonicalMatchCommandSnapshot(context && context.snapshot, capabilities.authority)
    ) {
        return {
            kind: 'terminal',
            result: toFailure('INVALID_SNAPSHOT')
        };
    }

    const currentSnapshot = capabilities.snapshot.cloneSnapshot(context.snapshot);
    capabilities.snapshot.stripTransientChargeDeltaState(currentSnapshot);

    if (isDebugFillCommand(body, capabilities)) {
        if (context.networkDebugEnabled !== true) {
            return {
                kind: 'terminal',
                result: toFailure('NETWORK_DEBUG_DISABLED')
            };
        }
        const debug = capabilities.debug!;
        const applied = debug.fillDebugHand(
            asRecord(currentSnapshot.cardState),
            Object.assign(
                { playerKey: context.playerKey },
                debug.resolveDebugFillHandOptions(body)
            )
        );
        if (applied !== true) {
            return {
                kind: 'terminal',
                result: toFailure('DEBUG_FILL_HAND_FAILED')
            };
        }
        capabilities.snapshot.stripTransientPresentationState(currentSnapshot);
        return {
            kind: 'terminal',
            result: {
                ok: true,
                snapshot: currentSnapshot,
                rawEvents: [],
                playbackEvents: [],
                playbackDiagnostics: null,
                effectLogs: [],
                action: body.action || {
                    type: 'debug_fill_hand',
                    playerKey: context.playerKey
                },
                pendingEffectId: null
            }
        };
    }

    let commandBody = body;
    if (isAutoCommand(body, capabilities)) {
        if (context.networkAutoEnabled !== true) {
            return {
                kind: 'terminal',
                result: toFailure('AUTO_COMMAND_DISABLED')
            };
        }
        let autoCommand;
        try {
            autoCommand = capabilities.autoCommand!.resolveAutoTurnPublishBody({
                body,
                snapshot: currentSnapshot,
                playerKey: context.playerKey,
                planningPlayerKey: capabilities.authority.getCurrentPlayerKey(currentSnapshot.gameState)
            });
        } catch (error) {
            return {
                kind: 'terminal',
                result: toFailure(
                    'AUTO_COMMAND_PLANNER_UNAVAILABLE',
                    error instanceof Error ? error.message : String(error || '')
                )
            };
        }
        if (!autoCommand || autoCommand.ok !== true) {
            return {
                kind: 'terminal',
                result: toFailure(
                    typeof autoCommand?.rejectedReason === 'string' && autoCommand.rejectedReason
                        ? autoCommand.rejectedReason
                        : 'AUTO_COMMAND_REQUIRED'
                )
            };
        }
        commandBody = asRecord(autoCommand.body || body);
    }

    const preparedAction = prepareMatchCommandAction({
        snapshot: currentSnapshot,
        body: commandBody,
        playerKey: context.playerKey,
        networkDebugEnabled: context.networkDebugEnabled,
        buildAction: (input, _fallbackActor, fallbackTurnIndex) => capabilities.schema.buildAction(
            input,
            context.playerKey,
            Number.isFinite(Number(fallbackTurnIndex))
                ? Number(fallbackTurnIndex)
                : 0
        ),
        normalizePlayerKey: capabilities.authority.normalizePlayerKey,
        validatePendingSelectionPublish: (snapshot, playerKey, action) => (
            capabilities.authority.validatePendingSelectionPublish(
                snapshot as MatchCommandSnapshot,
                playerKey as MatchCommandPlayerKey,
                action
            )
        ),
        sanitizePendingSelectionActionForAuthority: (snapshot, playerKey, action) => (
            capabilities.authority.sanitizePendingSelectionActionForAuthority(
                snapshot as MatchCommandSnapshot,
                playerKey as MatchCommandPlayerKey,
                action
            )
        )
    });
    if (preparedAction.ok !== true) {
        return {
            kind: 'terminal',
            result: preparedAction
        };
    }

    const skipTurnStart = shouldSkipMatchCommandTurnStart({
        cardState: preparedAction.currentCardState,
        playerKey: context.playerKey,
        resolvedAction: preparedAction.resolvedAction,
        isSubPlacementTurnActive: capabilities.authority.isSubPlacementTurnActive
            ? (cardState, playerKey) => capabilities.authority.isSubPlacementTurnActive!(
                cardState,
                playerKey as MatchCommandPlayerKey
            )
            : undefined
    });
    return {
        kind: 'prepared',
        value: {
            context,
            preActionSnapshot: currentSnapshot,
            commandBody,
            currentTurnIndex: preparedAction.currentTurnIndex,
            currentCardState: preparedAction.currentCardState,
            resolvedAction: preparedAction.resolvedAction,
            pendingValidation: preparedAction.pendingValidation,
            prng: createCommandPrng(context, currentSnapshot, capabilities),
            skipTurnStart
        }
    };
}

export function applyPreparedMatchCommandExecution(
    prepared: PreparedMatchCommandExecution,
    capabilities: MatchCommandExecutionCapabilities
): AppliedMatchCommandExecution | MatchCommandExecutionFailure {
    const result = capabilities.pipeline.applyTurnSafe(
        prepared.currentCardState,
        prepared.preActionSnapshot.gameState,
        prepared.context.playerKey,
        prepared.resolvedAction,
        prepared.prng,
        {
            currentStateVersion: prepared.currentTurnIndex,
            prngState: prepared.currentCardState.prngState,
            skipTurnStart: prepared.skipTurnStart
        }
    );
    const rawEvents = toRawEvents(result && result.events);
    if (!result || result.ok !== true) {
        return toFailure(
            typeof result?.rejectedReason === 'string' && result.rejectedReason
                ? result.rejectedReason
                : 'COMMAND_REJECTED',
            result && Object.prototype.hasOwnProperty.call(result, 'errorMessage')
                ? result.errorMessage
                : null,
            rawEvents
        );
    }

    const pendingResult = capabilities.authority.validateAuthoritativePendingSelectionResult(
        prepared.resolvedAction,
        rawEvents
    );
    if (!pendingResult || pendingResult.ok !== true) {
        return toFailure(
            typeof pendingResult?.rejectedReason === 'string' && pendingResult.rejectedReason
                ? pendingResult.rejectedReason
                : 'INVALID_PENDING_SELECTION_TARGET'
        );
    }

    const gameState = asRecord(result.gameState);
    const cardState = asRecord(result.cardState);
    return {
        ...prepared,
        pipelineResult: result,
        nextSnapshot: {
            gameState,
            cardState
        },
        rawEvents
    };
}
