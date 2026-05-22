declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// Imports replacing globalThis references
const PendingSelectionFlow = (function() {
    try { return _require('./selection-flow'); } catch (e) { return null; }
})();
const DestroyOutcomeContract = (function() {
    try { return _require('../../shared/destroy-outcome-contract'); } catch (e) { return null; }
})();
const ControllerEvents = _require('../controller-events');
function getEmitLogAdded(): ((message: string) => void) | null {
    if (__uiImpl_destroy && typeof __uiImpl_destroy.emitLogAdded === 'function') return __uiImpl_destroy.emitLogAdded;
    return ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function' ? ControllerEvents.emitLogAdded : null;
}
function getLogMessages(): any {
    if (__uiImpl_destroy && typeof __uiImpl_destroy.getLogMessages === 'function') {
        const messages = __uiImpl_destroy.getLogMessages();
        if (messages) return messages;
    }
    return _require('../log-messages');
}
const GameControllerSlim = _require('../game-controller-slim');
const CardSystem = _require('../../card-system');

let __uiImpl_destroy: any = {};

function setUIImpl(obj: any): void {
    __uiImpl_destroy = (obj && typeof obj === 'object') ? obj : {};
}

const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
    DESTROYED: 'destroyed',
    REGENERATED: 'regenerated',
    LIVING_WILL_RESTORED: 'living_will_restored',
    GHOST_BLOCKED: 'ghost_blocked',
    PROLIFERATED: 'proliferated',
    EVADED_MOVE: 'evaded_move'
});

function getDestroyOutcomeKind(result: any): string | null {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
        return DestroyOutcomeContract.getDestroyOutcomeKind(result);
    }
    if (!result || typeof result !== 'object') return null;
    if (result.livingWillRevived === true) return DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED;
    if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
    if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
    if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
    if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
    if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
    return null;
}

function isDestroyOutcomeResolved(result: any): boolean {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
        return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
    }
    return getDestroyOutcomeKind(result) !== null;
}

function getDestroySelectPrompt(): string {
    const LOG_MESSAGES = getLogMessages();
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroySelectPrompt === 'function') {
        return LOG_MESSAGES.destroySelectPrompt();
    }
    return '破壊する石を選んでください';
}

function getDestroyRejectedMessage(context: any): string {
    const LOG_MESSAGES = getLogMessages();
    if (context && context.result && context.result.ok === false && typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroyFailed === 'function') {
        return LOG_MESSAGES.destroyFailed();
    }
    return getDestroySelectPrompt();
}

function wasDestroySelectionApplied(result: any): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'destroy_selected')
        : null;
    return !!(selected && (selected.applied === true || isDestroyOutcomeResolved(selected)));
}

function emitDestroyAppliedLog(context: any, playerKey: string, row: number, col: number): void {
    const emitLogAdded = getEmitLogAdded();
    const LOG_MESSAGES = getLogMessages();
    if (typeof emitLogAdded !== 'function') return;
    const selected = context && context.result && Array.isArray(context.result.rawEvents)
        ? context.result.rawEvents.find((event: any) => event && event.type === 'destroy_selected')
        : null;
    const outcomeKind = getDestroyOutcomeKind(selected);
    const playerLabel = playerKey === 'black' ? '黒' : '白';
    const injectedPosToNotation = __uiImpl_destroy && typeof __uiImpl_destroy.posToNotation === 'function'
        ? __uiImpl_destroy.posToNotation
        : null;
    const posText = injectedPosToNotation
        ? injectedPosToNotation(row, col)
        : GameControllerSlim.posToNotation(row, col);
    if (outcomeKind === DESTROY_OUTCOME_KINDS.PROLIFERATED) {
        emitLogAdded(LOG_MESSAGES.destroyProliferated(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.REGENERATED) {
        emitLogAdded(LOG_MESSAGES.destroyRegenerated(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED) {
        emitLogAdded(LOG_MESSAGES.destroyLivingWillRestored(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED) {
        emitLogAdded(LOG_MESSAGES.destroyGhostBlocked(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.EVADED_MOVE) {
        emitLogAdded(LOG_MESSAGES.destroyEvaded(playerLabel, posText));
        return;
    }
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroyApplied === 'function') {
        emitLogAdded(LOG_MESSAGES.destroyApplied(playerLabel, posText));
        return;
    }
    emitLogAdded(LOG_MESSAGES.destroyDefault(playerLabel, posText));
}

async function handleDestroySelection(row: number, col: number, playerKey: string): Promise<any> {
    const cardLogic = __uiImpl_destroy && typeof __uiImpl_destroy.getCardLogic === 'function'
        ? __uiImpl_destroy.getCardLogic()
        : null;
    if (cardLogic && typeof cardLogic.getSelectableTargets === 'function') {
        const gameState = __uiImpl_destroy && typeof __uiImpl_destroy.getGameState === 'function'
            ? __uiImpl_destroy.getGameState()
            : null;
        const targets = cardLogic.getSelectableTargets(CardSystem.cardState, gameState, playerKey) || [];
        const allowed = targets.some((target: any) => target && target.row === row && target.col === col);
        if (!allowed) {
            const emitLogAdded = getEmitLogAdded();
            if (typeof emitLogAdded === 'function') emitLogAdded(getDestroySelectPrompt());
            return;
        }
    }
    return executeDestroy(row, col, playerKey);
}

async function executeDestroy(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'DESTROY_ONE_STONE',
        actionPayload: { destroyTarget: { row, col } },
        invalidMessage: getDestroyRejectedMessage,
        validateResult: ({ result }: any) => wasDestroySelectionApplied(result),
        buildPlaybackMeta: () => ({ row, col, cause: 'DESTROY' }),
        afterStateChange: (context: any) => {
            emitDestroyAppliedLog(context, playerKey, row, col);
        }
    });
}

const DestroyEffects = {
    setUIImpl,
    handleDestroySelection,
    executeDestroy
};

export = DestroyEffects;
