type BoardEffectsStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    prng: any;
    events: any[];
    pending: any;
};

function readRequiredTarget(options: BoardEffectsStageOptions, types: string[], field: string, errorMessage: string): any {
    const pendingType = options.pending && options.pending.type;
    if (!types.includes(pendingType)) return null;
    const target = options.action && options.action[field];
    if (target == null) throw new Error(errorMessage);
    return { matched: true, target };
}

function unresolvedTarget(selection: any): any {
    return selection && !selection.target ? { matched: true, result: false } : null;
}

function resolveBoardExpansionSelection(options: BoardEffectsStageOptions): any {
    const pending = options.pending;
    const selection = readRequiredTarget(options, ['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD'], 'expansionTarget', `${pending && pending.type} requires expansionTarget before placement`);
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const isGodExpansion = pending.type === 'BOARD_EXPANSION_GOD';
    const applyFn = (isGodExpansion && typeof options.CardLogic.applyBoardExpansionGod === 'function')
        ? options.CardLogic.applyBoardExpansionGod
        : options.CardLogic.applyBoardExpansionWill;
    const result = applyFn(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    if (isGodExpansion && result && result.applied && result.completed === false) {
        options.events.push({
            type: 'board_expansion_first_selected', player: options.playerKey, cardType: pending.type, target: selection.target,
            selectedCount: Number(result.selectedCount) || 1, maxSelections: Number(result.maxSelections) || 2,
            remainingSelections: Number(result.remainingSelections) || 1, selectedTargets: Array.isArray(result.selectedTargets) ? result.selectedTargets : null,
            applied: true, completed: false
        });
    } else {
        options.events.push({
            type: 'board_expansion_selected', player: options.playerKey, cardType: pending.type, target: selection.target,
            side: result && result.side ? result.side : null, row: result && Number.isInteger(result.row) ? result.row : null,
            added: (result && Array.isArray(result.added)) ? result.added : null,
            selectedTargets: (result && Array.isArray(result.selectedTargets)) ? result.selectedTargets : null,
            sources: (result && Array.isArray(result.sources)) ? result.sources : null,
            applied: !!(result && result.applied), completed: !(result && result.completed === false)
        });
    }
    return { matched: true, result: true };
}

function resolveBoardShrinkSelection(options: BoardEffectsStageOptions): any {
    const pending = options.pending;
    const selection = readRequiredTarget(options, ['BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD'], 'shrinkTarget', `${pending && pending.type} requires shrinkTarget before placement`);
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const isGodShrink = pending.type === 'BOARD_SHRINK_GOD';
    const applyFn = (isGodShrink && typeof options.CardLogic.applyBoardShrinkGod === 'function')
        ? options.CardLogic.applyBoardShrinkGod
        : options.CardLogic.applyBoardShrinkWill;
    const result = applyFn(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({
        type: 'board_shrink_selected', player: options.playerKey, cardType: pending.type, target: selection.target,
        firstTarget: result && result.firstTarget ? result.firstTarget : null,
        selectedCount: Number.isFinite(Number(result && result.selectedCount)) ? Number(result.selectedCount) : null,
        maxSelections: Number.isFinite(Number(result && result.maxSelections)) ? Number(result.maxSelections) : null,
        remainingSelections: Number.isFinite(Number(result && result.remainingSelections)) ? Number(result.remainingSelections) : null,
        selectedTargets: (result && Array.isArray(result.selectedTargets)) ? result.selectedTargets : null,
        lineTargets: (result && Array.isArray(result.lineTargets)) ? result.lineTargets : null,
        changedTargets: (result && Array.isArray(result.changedTargets)) ? result.changedTargets : null,
        skippedTargets: (result && Array.isArray(result.skippedTargets)) ? result.skippedTargets : null,
        applied: !!(result && result.applied), completed: !(result && result.completed === false)
    });
    return { matched: true, result: true };
}

function resolveBlockadeSelection(options: BoardEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['BLOCKADE_WILL'], 'blockadeTarget', 'BLOCKADE_WILL requires blockadeTarget before placement');
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const result = options.CardLogic.applyBlockadeWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'blockade_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveMeteorSelection(options: BoardEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['METEOR_WILL'], 'meteorTarget', 'METEOR_WILL requires meteorTarget before placement');
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const result = options.CardLogic.applyMeteorWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col, options.prng || undefined);
    options.events.push({ type: 'meteor_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied), destroyed: !!(result && result.destroyed) });
    return { matched: true, result: true };
}

function resolveCausalReplaySelection(options: BoardEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['CAUSAL_REPLAY_WILL'], 'causalReplayTarget', 'CAUSAL_REPLAY_WILL requires causalReplayTarget before placement');
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const result = options.CardLogic.applyCausalReplayWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'causal_replay_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied), restored: !!(result && result.restored) });
    return { matched: true, result: true };
}

function resolveFreezeSelection(options: BoardEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['FREEZE_WILL'], 'freezeTarget', 'FREEZE_WILL requires freezeTarget before placement');
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const result = options.CardLogic.applyFreezeWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'freeze_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveSeedSelection(options: BoardEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['SEED_WILL'], 'seedTarget', 'SEED_WILL requires seedTarget before placement');
    if (!selection) return null;
    if (unresolvedTarget(selection)) return unresolvedTarget(selection);
    const result = options.CardLogic.applySeedWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'seed_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveBoardEffectsSelection(options: BoardEffectsStageOptions): any {
    return resolveBoardExpansionSelection(options)
        || resolveBoardShrinkSelection(options)
        || resolveBlockadeSelection(options)
        || resolveMeteorSelection(options)
        || resolveCausalReplaySelection(options)
        || resolveFreezeSelection(options)
        || resolveSeedSelection(options);
}

export = {
    resolveBoardEffectsSelection
};
