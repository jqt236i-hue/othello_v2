type BoardChargeDeps = {
    CardUtilsModule: any;
    chargeMax: number;
    emitBoardChargeBubblePresentation?: (CardLogic: any, cardState: any, payload: any) => void;
};

function buildBoardChargeDeltaMeta(row: any, col: any, sourceType: any) {
    const anchorRow = Number(row);
    const anchorCol = Number(col);
    if (!Number.isInteger(anchorRow) || !Number.isInteger(anchorCol)) {
        throw new Error('TurnPipelinePhases board charge popup requires integer anchorRow/anchorCol');
    }
    const meta: Record<string, any> = {
        popupKind: 'board',
        anchorRow,
        anchorCol
    };
    if (typeof sourceType === 'string' && sourceType.trim()) {
        meta.sourceType = sourceType.trim();
    }
    return meta;
}

function resolveBoardChargeAnchor(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const moved = Array.isArray(opts.moved) ? opts.moved : [];
    for (let index = moved.length - 1; index >= 0; index -= 1) {
        const entry = moved[index];
        const to = entry && entry.to;
        const row = Number(to && to.row);
        const col = Number(to && to.col);
        if (Number.isInteger(row) && Number.isInteger(col)) {
            return { row, col };
        }
    }

    const targetRow = Number(opts.targetRow);
    const targetCol = Number(opts.targetCol);
    if (Number.isInteger(targetRow) && Number.isInteger(targetCol)) {
        return { row: targetRow, col: targetCol };
    }

    const anchorRow = Number(opts.anchorRow);
    const anchorCol = Number(opts.anchorCol);
    if (Number.isInteger(anchorRow) && Number.isInteger(anchorCol)) {
        return { row: anchorRow, col: anchorCol };
    }

    throw new Error('TurnPipelinePhases board charge popup requires a resolved anchor');
}

function resolveBoardChargeGainContext(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const anchor = resolveBoardChargeAnchor(opts);
    return {
        anchor,
        reason: opts.reason || 'turn_start_effect',
        sourceType: opts.sourceType || null,
        text: opts.text || null,
        moved: opts.moved
    };
}

function addChargeWithTotal(cardState: any, playerKey: any, amount: any, options: any, deps: BoardChargeDeps) {
    if (!cardState || !amount) return 0;
    if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
    if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };
    const before = cardState.charge[playerKey] || 0;
    const chargeMax = Number.isFinite(Number(deps && deps.chargeMax)) && Number(deps.chargeMax) > 0
        ? Number(deps.chargeMax)
        : 99;
    const opts = (options && typeof options === 'object') ? options : null;
    const boardAnchor = (opts && opts.popupKind === 'board')
        ? resolveBoardChargeAnchor(opts)
        : null;
    const reason = (opts && typeof opts.reason === 'string' && opts.reason.trim())
        ? opts.reason.trim()
        : 'turn_start_effect';
    const deltaMeta = (opts && opts.popupKind === 'board')
        ? buildBoardChargeDeltaMeta(boardAnchor!.row, boardAnchor!.col, opts.sourceType)
        : null;
    const deltaRes = (deps && deps.CardUtilsModule && typeof deps.CardUtilsModule.addChargeWithDelta === 'function')
        ? deps.CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, reason, deltaMeta)
        : null;
    let added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
    if (!deltaRes || (Number(amount) > 0 && added <= 0 && before < chargeMax && (cardState.charge[playerKey] || 0) <= before)) {
        const after = Math.min(chargeMax, before + amount);
        cardState.charge[playerKey] = after;
        added = after - before;
    }
    if (added > 0) {
        cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
    }

    return added;
}

function applyResolvedBoardChargeGain(cardState: any, playerKey: any, amount: any, context: any, deps: BoardChargeDeps) {
    const ctx = (context && typeof context === 'object') ? context : {};
    const anchor = (ctx.anchor && Number.isInteger(Number(ctx.anchor.row)) && Number.isInteger(Number(ctx.anchor.col)))
        ? { row: Number(ctx.anchor.row), col: Number(ctx.anchor.col) }
        : resolveBoardChargeAnchor(ctx);
    const gained = addChargeWithTotal(cardState, playerKey, amount, {
        reason: ctx.reason || 'turn_start_effect',
        popupKind: 'board',
        sourceType: ctx.sourceType || null,
        moved: ctx.moved,
        targetRow: anchor.row,
        targetCol: anchor.col
    }, deps);
    return {
        anchor,
        gained,
        sourceType: ctx.sourceType || null,
        text: ctx.text || null
    };
}

function applyPlacementBoardBonusGain(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, amount: any, flipCount: any, deps: BoardChargeDeps) {
    const gained = addChargeWithTotal(cardState, playerKey, amount, {
        reason: 'board_bonus_gain',
        popupKind: 'board',
        sourceType: 'number_cell_gain',
        anchorRow: row,
        anchorCol: col
    }, deps);
    if (gained > 0 && !(flipCount > 0) && deps && typeof deps.emitBoardChargeBubblePresentation === 'function') {
        deps.emitBoardChargeBubblePresentation(CardLogic, cardState, {
            player: playerKey,
            row,
            col,
            gained,
            sourceType: 'number_cell_gain'
        });
    }
    return gained;
}

function buildPlacementChargeBubblePayload(playerKey: any, row: any, col: any, flipCount: any, boardBonusGained: any, effects: any) {
    const flipGain = Number(effects && effects.chargeGained) || 0;
    const mergedBoardBonus = flipCount > 0 ? (Number(boardBonusGained) || 0) : 0;
    const totalGain = flipGain + mergedBoardBonus;
    if (!(flipCount > 0) || !(totalGain > 0)) return null;
    return {
        player: playerKey,
        row,
        col,
        gained: totalGain,
        sourceType: mergedBoardBonus > 0 ? 'placement_action_gain' : 'placement_flip_gain'
    };
}

function awardBoardChargeGain(CardLogic: any, cardState: any, playerKey: any, amount: any, options: any, deps: BoardChargeDeps) {
    const context = resolveBoardChargeGainContext(options);
    const gainResult = applyResolvedBoardChargeGain(cardState, playerKey, amount, context, deps);
    if (gainResult.gained > 0 && deps && typeof deps.emitBoardChargeBubblePresentation === 'function') {
        deps.emitBoardChargeBubblePresentation(CardLogic, cardState, {
            player: playerKey,
            row: gainResult.anchor.row,
            col: gainResult.anchor.col,
            gained: gainResult.gained,
            sourceType: gainResult.sourceType,
            text: gainResult.text
        });
    }
    return gainResult.gained;
}

function transferChargeBetweenPlayers(cardState: any, fromPlayerKey: any, toPlayerKey: any, amount: any, reasonKey: any, deps: BoardChargeDeps) {
    if (!cardState || !amount) return 0;
    if (!cardState.charge) cardState.charge = { black: 0, white: 0 };

    const fromCharge = Math.max(0, Number(cardState.charge[fromPlayerKey] || 0));
    const toCharge = Math.max(0, Number(cardState.charge[toPlayerKey] || 0));
    const chargeMax = Number.isFinite(Number(deps && deps.chargeMax)) && Number(deps.chargeMax) > 0
        ? Number(deps.chargeMax)
        : 99;
    const toRoom = Math.max(0, chargeMax - toCharge);
    const requested = Math.max(0, Number(amount) || 0);
    const movable = Math.min(requested, fromCharge, toRoom);
    if (movable <= 0) return 0;

    const gained = addChargeWithTotal(cardState, toPlayerKey, movable, null, deps);
    if (gained <= 0) return 0;

    if (deps && deps.CardUtilsModule && typeof deps.CardUtilsModule.addChargeWithDelta === 'function') {
        deps.CardUtilsModule.addChargeWithDelta(cardState, fromPlayerKey, -gained, `${reasonKey || 'transfer'}_loss`);
    } else {
        cardState.charge[fromPlayerKey] = Math.max(0, fromCharge - gained);
    }
    return gained;
}

const TurnBoardChargeModule = {
    addChargeWithTotal,
    applyPlacementBoardBonusGain,
    buildPlacementChargeBubblePayload,
    awardBoardChargeGain,
    transferChargeBetweenPlayers
};

export = TurnBoardChargeModule;
