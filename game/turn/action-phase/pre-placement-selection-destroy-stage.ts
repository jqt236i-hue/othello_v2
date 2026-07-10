type DestroySelectionStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    pending: any;
    createDestroyOutcome: (kindOrResult: any, details: any) => any;
    isDestroyOutcomeResolved: (result: any) => boolean;
    applyTrapEffectsAfterSelection: () => void;
};

function validateDestroySelection(options: DestroySelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'DESTROY_ONE_STONE') return null;

    const target = options.action && options.action.destroyTarget;
    if (target == null) {
        throw new Error('DESTROY_ONE_STONE requires destroyTarget before placement');
    }
    return target;
}

function applyDestroySelectionMutation(options: DestroySelectionStageOptions, target: any): any {
    return typeof options.CardLogic.applyDestroyEffectDetailed === 'function'
        ? options.CardLogic.applyDestroyEffectDetailed(
            options.cardState,
            options.gameState,
            options.playerKey,
            target.row,
            target.col
        )
        : {
            destroyed: !!options.CardLogic.applyDestroyEffect(
                options.cardState,
                options.gameState,
                options.playerKey,
                target.row,
                target.col
            )
        };
}

function buildDestroySelectedEvent(playerKey: any, target: any, result: any, applied: boolean): any {
    return {
        type: 'destroy_selected',
        player: playerKey,
        target,
        applied,
        kind: result && result.kind ? result.kind : null,
        destroyed: !!(result && result.destroyed),
        regenerated: !!(result && result.regenerated),
        evaded: !!(result && result.evaded),
        blockedByGhost: !!(result && result.blockedByGhost),
        proliferated: !!(result && result.proliferated),
        reason: result && result.reason ? result.reason : null,
        from: result && result.from ? result.from : null,
        to: result && result.to ? result.to : null
    };
}

function settleDestroySelection(options: DestroySelectionStageOptions): void {
    options.applyTrapEffectsAfterSelection();
}

function resolveDestroyOneStoneSelection(options: DestroySelectionStageOptions): any {
    const target = validateDestroySelection(options);
    if (!target) return null;

    const destroyResult = applyDestroySelectionMutation(options, target);
    const normalizedDestroyResult = options.createDestroyOutcome(destroyResult, null);
    const applied = options.isDestroyOutcomeResolved(normalizedDestroyResult);
    options.events.push(buildDestroySelectedEvent(options.playerKey, target, normalizedDestroyResult, applied));
    settleDestroySelection(options);
    return {
        handled: true,
        generatedSpawnFlipResults: Array.isArray(normalizedDestroyResult && normalizedDestroyResult.generatedSpawnFlipResults)
            ? normalizedDestroyResult.generatedSpawnFlipResults
            : []
    };
}

export = {
    resolveDestroyOneStoneSelection
};
