import DestroySelectionStage = require('./pre-placement-selection-destroy-stage');
import HandSelectionStage = require('./pre-placement-selection-hand-stage');
import MovementSelectionStage = require('./pre-placement-selection-movement-stage');
import ReverseSelectionStage = require('./pre-placement-selection-reverse-stage');
import TargetEffectsSelectionStage = require('./pre-placement-selection-target-effects-stage');

type ResolvePrePlacementSelectionActionOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    prng: any;
    pending: any;
    createDestroyOutcome: (kindOrResult: any, details: any) => any;
    isDestroyOutcomeResolved: (result: any) => boolean;
    applyTrapEffectsAfterSelection: () => void;
    handOffTurnAfterSelection: () => void;
    emitDurationSelectionStatusTick: (target: any, reason: any, highlightTone: any) => void;
    emitHandRemovePresentation: (payload: any) => void;
    emitHandAddPresentation?: (payload: any) => void;
};

function resolvePrePlacementSelectionAction(options: ResolvePrePlacementSelectionActionOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePrePlacementSelectionActionOptions);
    const pending = opts.pending;
    const action = opts.action || {};
    const p = opts.prng || undefined;

    const destroySelectionResult = DestroySelectionStage.resolveDestroyOneStoneSelection(opts);
    if (destroySelectionResult) return destroySelectionResult;

    const reverseWillSelectionResult = ReverseSelectionStage.resolveReverseWillSelection(opts);
    if (reverseWillSelectionResult) return reverseWillSelectionResult;

    const movementSelection = MovementSelectionStage.resolveMovementSelection(opts);
    if (movementSelection && movementSelection.matched) return movementSelection.result;

    const handSelection = HandSelectionStage.resolveHandSelection(opts);
    if (handSelection && handSelection.matched) return handSelection.result;

    const targetEffectsSelection = TargetEffectsSelectionStage.resolveTargetEffectsSelection(opts);
    if (targetEffectsSelection && targetEffectsSelection.matched) return targetEffectsSelection.result;

    if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget) {
        const isGodExpansion = pending.type === 'BOARD_EXPANSION_GOD';
        const applyFn = (isGodExpansion && typeof opts.CardLogic.applyBoardExpansionGod === 'function')
            ? opts.CardLogic.applyBoardExpansionGod
            : opts.CardLogic.applyBoardExpansionWill;
        const res = applyFn(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.expansionTarget.row,
            action.expansionTarget.col
        );
        if (isGodExpansion && res && res.applied && res.completed === false) {
            opts.events.push({
                type: 'board_expansion_first_selected',
                player: opts.playerKey,
                cardType: pending.type,
                target: action.expansionTarget,
                selectedCount: Number(res.selectedCount) || 1,
                maxSelections: Number(res.maxSelections) || 2,
                remainingSelections: Number(res.remainingSelections) || 1,
                selectedTargets: Array.isArray(res.selectedTargets) ? res.selectedTargets : null,
                applied: true,
                completed: false
            });
        } else {
            opts.events.push({
                type: 'board_expansion_selected',
                player: opts.playerKey,
                cardType: pending.type,
                target: action.expansionTarget,
                side: res && res.side ? res.side : null,
                row: res && Number.isInteger(res.row) ? res.row : null,
                added: (res && Array.isArray(res.added)) ? res.added : null,
                selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
                sources: (res && Array.isArray(res.sources)) ? res.sources : null,
                applied: !!(res && res.applied),
                completed: !(res && res.completed === false)
            });
        }
        return true;
    } else if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget == null) {
        throw new Error(`${pending.type} requires expansionTarget before placement`);
    }

    if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget) {
        const isGodShrink = pending.type === 'BOARD_SHRINK_GOD';
        const applyFn = (isGodShrink && typeof opts.CardLogic.applyBoardShrinkGod === 'function')
            ? opts.CardLogic.applyBoardShrinkGod
            : opts.CardLogic.applyBoardShrinkWill;
        const res = applyFn(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.shrinkTarget.row,
            action.shrinkTarget.col
        );
        opts.events.push({
            type: 'board_shrink_selected',
            player: opts.playerKey,
            cardType: pending.type,
            target: action.shrinkTarget,
            firstTarget: res && res.firstTarget ? res.firstTarget : null,
            selectedCount: Number.isFinite(Number(res && res.selectedCount)) ? Number(res.selectedCount) : null,
            maxSelections: Number.isFinite(Number(res && res.maxSelections)) ? Number(res.maxSelections) : null,
            remainingSelections: Number.isFinite(Number(res && res.remainingSelections)) ? Number(res.remainingSelections) : null,
            selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
            lineTargets: (res && Array.isArray(res.lineTargets)) ? res.lineTargets : null,
            changedTargets: (res && Array.isArray(res.changedTargets)) ? res.changedTargets : null,
            skippedTargets: (res && Array.isArray(res.skippedTargets)) ? res.skippedTargets : null,
            applied: !!(res && res.applied),
            completed: !(res && res.completed === false)
        });
        return true;
    } else if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget == null) {
        throw new Error(`${pending.type} requires shrinkTarget before placement`);
    }

    if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget) {
        const res = opts.CardLogic.applyBlockadeWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.blockadeTarget.row,
            action.blockadeTarget.col
        );
        opts.events.push({ type: 'blockade_selected', player: opts.playerKey, target: action.blockadeTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget == null) {
        throw new Error('BLOCKADE_WILL requires blockadeTarget before placement');
    }

    if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget) {
        const res = opts.CardLogic.applyMeteorWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.meteorTarget.row,
            action.meteorTarget.col,
            p
        );
        opts.events.push({
            type: 'meteor_selected',
            player: opts.playerKey,
            target: action.meteorTarget,
            applied: !!(res && res.applied),
            destroyed: !!(res && res.destroyed)
        });
        return true;
    } else if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget == null) {
        throw new Error('METEOR_WILL requires meteorTarget before placement');
    }

    if (pending && pending.type === 'CAUSAL_REPLAY_WILL' && action.causalReplayTarget) {
        const res = opts.CardLogic.applyCausalReplayWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.causalReplayTarget.row,
            action.causalReplayTarget.col
        );
        opts.events.push({
            type: 'causal_replay_selected',
            player: opts.playerKey,
            target: action.causalReplayTarget,
            applied: !!(res && res.applied),
            restored: !!(res && res.restored)
        });
        return true;
    } else if (pending && pending.type === 'CAUSAL_REPLAY_WILL' && action.causalReplayTarget == null) {
        throw new Error('CAUSAL_REPLAY_WILL requires causalReplayTarget before placement');
    }

    if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget) {
        const res = opts.CardLogic.applyFreezeWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.freezeTarget.row,
            action.freezeTarget.col
        );
        opts.events.push({ type: 'freeze_selected', player: opts.playerKey, target: action.freezeTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget == null) {
        throw new Error('FREEZE_WILL requires freezeTarget before placement');
    }

    if (pending && pending.type === 'SEED_WILL' && action.seedTarget) {
        const res = opts.CardLogic.applySeedWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.seedTarget.row,
            action.seedTarget.col
        );
        opts.events.push({ type: 'seed_selected', player: opts.playerKey, target: action.seedTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'SEED_WILL' && action.seedTarget == null) {
        throw new Error('SEED_WILL requires seedTarget before placement');
    }

    return false;
}

const ActionPhasePrePlacementSelectionModule = {
    resolvePrePlacementSelectionAction
};

try {
    const root = (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null)) as any;
    if (root && !root.TurnActionPhasePrePlacementSelection) {
        root.TurnActionPhasePrePlacementSelection = ActionPhasePrePlacementSelectionModule;
    }
} catch (e) { /* ignore global registration fallback */ }

export = ActionPhasePrePlacementSelectionModule;
