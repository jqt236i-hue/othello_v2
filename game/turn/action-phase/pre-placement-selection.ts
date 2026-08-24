import DestroySelectionStage = require('./pre-placement-selection-destroy-stage');
import BoardEffectsSelectionStage = require('./pre-placement-selection-board-effects-stage');
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

    const boardEffectsSelection = BoardEffectsSelectionStage.resolveBoardEffectsSelection(opts);
    if (boardEffectsSelection && boardEffectsSelection.matched) return boardEffectsSelection.result;

    return false;
}

const ActionPhasePrePlacementSelectionModule = {
    resolvePrePlacementSelectionAction
};

export = ActionPhasePrePlacementSelectionModule;
