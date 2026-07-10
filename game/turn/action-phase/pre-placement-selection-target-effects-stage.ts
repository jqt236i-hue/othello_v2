type TargetEffectsStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    prng: any;
    events: any[];
    pending: any;
    applyTrapEffectsAfterSelection: () => void;
    handOffTurnAfterSelection: () => void;
    emitDurationSelectionStatusTick: (target: any, reason: any, highlightTone: any) => void;
};

function readRequiredTarget(options: TargetEffectsStageOptions, types: string[], field: string, errorMessage: string): any {
    const pendingType = options.pending && options.pending.type;
    if (!types.includes(pendingType)) return null;
    const target = options.action && options.action[field];
    if (target == null) throw new Error(errorMessage);
    return { matched: true, target };
}

function resolvedOrFalse(selection: any): any {
    return selection && !selection.target ? { matched: true, result: false } : null;
}

function resolveTemptSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['TEMPT_WILL'], 'temptTarget', 'TEMPT_WILL requires temptTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyTemptWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'tempt_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied), blockedByGhost: !!(result && result.blockedByGhost) });
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveCaptureSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['CAPTURE_WILL'], 'captureTarget', 'CAPTURE_WILL requires captureTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyCaptureWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({
        type: 'capture_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied),
        blockedByGhost: !!(result && result.blockedByGhost), capturedCardId: (result && result.capturedCardId) ? result.capturedCardId : null,
        capturedCardType: (result && result.capturedCardType) ? result.capturedCardType : null,
        capturedCardName: (result && result.capturedCardName) ? result.capturedCardName : null,
        sourceSpecialType: (result && result.sourceSpecialType) ? result.sourceSpecialType : null,
        insertIndex: (result && Number.isInteger(result.insertIndex)) ? result.insertIndex : null
    });
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveSwapSelection(options: TargetEffectsStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'SWAP_WITH_ENEMY') return null;
    const target = options.action && options.action.swapTarget;
    if (target == null) {
        const hasLegacyBoardClickTarget = Number.isInteger(options.action && options.action.row) && Number.isInteger(options.action && options.action.col);
        if (!hasLegacyBoardClickTarget) throw new Error('SWAP_WITH_ENEMY requires swapTarget before placement');
        return { matched: true, result: false };
    }
    if (!target) return { matched: true, result: false };
    const swapped = options.CardLogic.applySwapEffect(options.cardState, options.gameState, options.playerKey, target.row, target.col);
    options.events.push({ type: 'swap_selected', player: options.playerKey, row: target.row, col: target.col, swapped });
    if (!swapped) throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
    options.applyTrapEffectsAfterSelection();
    options.handOffTurnAfterSelection();
    return { matched: true, result: true };
}

function resolvePositionSwapSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['POSITION_SWAP_WILL'], 'positionSwapTarget', 'POSITION_SWAP_WILL requires positionSwapTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyPositionSwapWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({
        type: result && result.completed ? 'position_swap_selected' : 'position_swap_first_selected', player: options.playerKey, target: selection.target,
        from: result && result.from ? result.from : (result && result.firstTarget ? result.firstTarget : null), to: result && result.to ? result.to : null,
        applied: !!(result && result.applied), completed: !!(result && result.completed)
    });
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveTrapSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['TRAP_WILL'], 'trapTarget', 'TRAP_WILL requires trapTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyTrapWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'trap_selected', player: options.playerKey, applied: !!(result && result.applied) });
    if (result && result.applied) options.handOffTurnAfterSelection();
    return { matched: true, result: true };
}

function resolveGuardSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['GUARD_WILL', 'GUARDIAN_GOD'], 'guardTarget', 'GUARD-like card requires guardTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyGuardWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'guard_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveLivingSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['LIVING_WILL'], 'livingWillTarget', 'LIVING_WILL requires livingWillTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyLivingWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'living_will_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveExtendLifeSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD'], 'extendTarget', `${options.pending && options.pending.type} requires extendTarget before placement`);
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const applyExtendLife = options.pending.type === 'EXTEND_LIFE_GOD' ? options.CardLogic.applyExtendLifeGod : options.CardLogic.applyExtendLifeWill;
    const result = applyExtendLife(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({
        type: 'extend_life_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied), cardType: options.pending.type,
        multiplier: result && Number.isFinite(result.multiplier) ? Number(result.multiplier) : (options.pending.type === 'EXTEND_LIFE_GOD' ? 4 : 2),
        details: result ? { previous: result.previousRemainingOwnerTurns, current: result.newRemainingOwnerTurns } : null
    });
    if (result && result.applied) options.emitDurationSelectionStatusTick(selection.target, 'extend_life_applied', 'positive');
    return { matched: true, result: true };
}

function resolveCorrosionSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['CORROSION_WILL'], 'corrosionTarget', 'CORROSION_WILL requires corrosionTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyCorrosionWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({
        type: 'corrosion_will_resolved', player: options.playerKey, target: selection.target, applied: !!(result && result.applied),
        affectedCount: Number(result && result.affectedCount) || 0, details: Array.isArray(result && result.details) ? result.details : []
    });
    if (result && result.applied && Number(result.affectedCount) > 0) options.emitDurationSelectionStatusTick(selection.target, 'corrosion_applied', 'negative');
    return { matched: true, result: true };
}

function resolveTimeBombSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['TIME_BOMB'], 'bombTarget', 'TIME_BOMB requires bombTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyTimeBombWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col);
    options.events.push({ type: 'time_bomb_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied) });
    return { matched: true, result: true };
}

function resolveCloneSelection(options: TargetEffectsStageOptions): any {
    const selection = readRequiredTarget(options, ['CLONE_WILL'], 'cloneTarget', 'CLONE_WILL requires cloneTarget before placement');
    if (!selection) return null;
    if (resolvedOrFalse(selection)) return resolvedOrFalse(selection);
    const result = options.CardLogic.applyCloneWill(options.cardState, options.gameState, options.playerKey, selection.target.row, selection.target.col, options.prng || undefined);
    options.events.push({
        type: 'clone_selected', player: options.playerKey, target: selection.target, applied: !!(result && result.applied),
        details: (result && Array.isArray(result.spawned)) ? result.spawned : [], spawned: (result && Array.isArray(result.spawned)) ? result.spawned : [],
        flipped: (result && Array.isArray(result.flipped)) ? result.flipped : []
    });
    return { matched: true, result: { handled: true, immediateFlipResult: result, immediateFlipSourceType: 'clone_will_selection' } };
}

function resolveTargetEffectsSelection(options: TargetEffectsStageOptions): any {
    return resolveTemptSelection(options)
        || resolveCaptureSelection(options)
        || resolveSwapSelection(options)
        || resolvePositionSwapSelection(options)
        || resolveTrapSelection(options)
        || resolveGuardSelection(options)
        || resolveLivingSelection(options)
        || resolveExtendLifeSelection(options)
        || resolveCorrosionSelection(options)
        || resolveTimeBombSelection(options)
        || resolveCloneSelection(options);
}

export = {
    resolveTargetEffectsSelection
};
