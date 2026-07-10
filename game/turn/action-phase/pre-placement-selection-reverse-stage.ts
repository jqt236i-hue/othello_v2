type ReverseSelectionStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    pending: any;
    applyTrapEffectsAfterSelection: () => void;
};

function validateReverseWillSelection(options: ReverseSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'REVERSE_WILL') return null;

    const target = options.action && options.action.reverseWillTarget;
    if (target == null) {
        throw new Error('REVERSE_WILL requires reverseWillTarget before placement');
    }
    return target;
}

function applyReverseWillSelectionMutation(options: ReverseSelectionStageOptions, target: any): any {
    const result = options.CardLogic.applyReverseWill(
        options.cardState,
        options.gameState,
        options.playerKey,
        target.row,
        target.col
    );
    if (!result || result.applied !== true) {
        throw new Error('REVERSE_WILL: invalid target');
    }
    return result;
}

function buildReverseWillSelectedEvent(playerKey: any, target: any, result: any): any {
    return {
        type: 'reverse_will_flipped',
        player: playerKey,
        owner: result && result.owner ? result.owner : null,
        target,
        applied: !!(result && result.applied),
        details: result && Array.isArray(result.flipped) ? result.flipped.slice() : [],
        blocked: result && Array.isArray(result.blocked) ? result.blocked.slice() : [],
        blockedByGhost: !!(result && result.blockedByGhost),
        logicalFlipCount: Number.isInteger(result && result.logicalFlipCount) ? result.logicalFlipCount : 0,
        flipCount: Number.isInteger(result && result.flipCount) ? result.flipCount : 0
    };
}

function settleReverseWillSelection(options: ReverseSelectionStageOptions): void {
    options.applyTrapEffectsAfterSelection();
}

function resolveReverseWillSelection(options: ReverseSelectionStageOptions): any {
    const target = validateReverseWillSelection(options);
    if (!target) return null;

    const result = applyReverseWillSelectionMutation(options, target);
    options.events.push(buildReverseWillSelectedEvent(options.playerKey, target, result));
    settleReverseWillSelection(options);
    return true;
}

export = {
    resolveReverseWillSelection
};
