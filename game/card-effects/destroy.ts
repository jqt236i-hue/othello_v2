// @ts-nocheck
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
const { emitLogAdded } = ControllerEvents;
const LOG_MESSAGES = _require('../log-messages');
const GameControllerSlim = _require('../game-controller-slim');
const CardLogic = _require('../logic/cards');
const CardSystem = _require('../../card-system');

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
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroySelectPrompt === 'function') {
        return LOG_MESSAGES.destroySelectPrompt();
    }
    return '破壊する石を選んでください';
}

function getDestroyRejectedMessage(context: any): string {
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
    if (typeof emitLogAdded !== 'function') return;
    const selected = context && context.result && Array.isArray(context.result.rawEvents)
        ? context.result.rawEvents.find((event: any) => event && event.type === 'destroy_selected')
        : null;
    const outcomeKind = getDestroyOutcomeKind(selected);
    const playerLabel = playerKey === 'black' ? '黒' : '白';
    const posText = GameControllerSlim.posToNotation(row, col);
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
    if (CardLogic && typeof CardLogic.getSelectableTargets === 'function') {
        // @compat - gameState is a runtime global set by game-controller-slim; no module export available
        const gameState = (typeof globalThis !== 'undefined' && (globalThis as any).gameState) ? (globalThis as any).gameState : null;
        const targets = CardLogic.getSelectableTargets(CardSystem.cardState, gameState, playerKey) || [];
        const allowed = targets.some((target: any) => target && target.row === row && target.col === col);
        if (!allowed) {
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
    handleDestroySelection,
    executeDestroy
};

export = DestroyEffects;
