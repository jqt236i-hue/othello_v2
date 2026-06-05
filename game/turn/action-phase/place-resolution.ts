type ResolvePlacementActionOptions = {
    CardLogic: any;
    Core: any;
    BoardOps: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    prng: any;
    pendingType: any;
    resolveSafeCardContext: (CardLogic: any, cardState: any) => any;
    getActionCellOwner: (gameState: any, row: any, col: any) => any;
    getPendingEffectTypeForActionPhase: (CardLogic: any, cardState: any, playerKey: any) => any;
    applyTrapEffectsAfterSelection: () => void;
    handOffTurnAfterSelection: () => void;
    applyPlacementBoardBonusGain: (CardLogic: any, cardState: any, playerKey: any, row: any, col: any, bonus: any, flipCount: any) => any;
    applyPostFlipRevives: (CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) => any;
    isOthelloMode: () => boolean;
};

type ResolvePlacementActionResult = {
    boardBonusGained?: number;
    completedSelectionOnly: boolean;
    flipCount?: number;
    numberCellMultiplierConfig?: any;
    othelloMode?: boolean;
    preExtra?: number;
    turnNumberBeforePlace?: number;
};

function emitFlipEvadeEvents(events: any[], flipEvadeResult: any): void {
    if (!flipEvadeResult) return;
    const movedList = Array.isArray(flipEvadeResult.moved) ? flipEvadeResult.moved : [];
    const destroyedList = Array.isArray(flipEvadeResult.destroyed) ? flipEvadeResult.destroyed : [];

    const ultimateMoved = movedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
    const hyperMoved = movedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
    if (hyperMoved.length) {
        events.push({ type: 'hyperactive_moved_immediate', details: hyperMoved });
    }
    if (ultimateMoved.length) {
        events.push({ type: 'ultimate_hyperactive_moved_immediate', details: ultimateMoved });
    }

    const ultimateDestroyed = destroyedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
    const hyperDestroyed = destroyedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
    if (hyperDestroyed.length) {
        events.push({ type: 'hyperactive_destroyed_immediate', details: hyperDestroyed });
    }
    if (ultimateDestroyed.length) {
        events.push({ type: 'ultimate_hyperactive_destroyed_immediate', details: ultimateDestroyed });
    }
}

function buildNumberCellMultiplierConfig(pendingConfig: any): any {
    return pendingConfig || null;
}

function resolvePlacementAction(options: ResolvePlacementActionOptions): ResolvePlacementActionResult {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePlacementActionOptions);
    const action = opts.action || {};
    const p = opts.prng || undefined;
    const pendingType = opts.pendingType;

    if (
        opts.CardLogic &&
        typeof opts.CardLogic.isPlacementLockedForPlayer === 'function' &&
        opts.CardLogic.isPlacementLockedForPlayer(opts.cardState, opts.playerKey) === true
    ) {
        throw new Error('Illegal move: placement locked');
    }

    const ctx = opts.resolveSafeCardContext(opts.CardLogic, opts.cardState);
    const playerValue = opts.playerKey === 'black' ? opts.Core.BLACK : opts.Core.WHITE;

    const blockedCells = (ctx && Array.isArray(ctx.blockedCells)) ? ctx.blockedCells : [];
    const blockedSet = blockedCells.length ? new Set(blockedCells.map((pos: any) => `${pos.row},${pos.col}`)) : null;
    if (blockedSet && blockedSet.has(`${action.row},${action.col}`)) {
        throw new Error('Illegal move: blocked cell');
    }

    if (pendingType === 'SWAP_WITH_ENEMY') {
        const targetCell = opts.getActionCellOwner(opts.gameState, action.row, action.col);
        if (targetCell === -playerValue) {
            const swapped = opts.CardLogic.applySwapEffect(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col);
            opts.events.push({ type: 'swap_selected', player: opts.playerKey, row: action.row, col: action.col, swapped });
            if (!swapped) {
                throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
            }
            opts.applyTrapEffectsAfterSelection();
            opts.handOffTurnAfterSelection();
            return { completedSelectionOnly: true };
        }
        throw new Error('SWAP_WITH_ENEMY requires selecting an enemy stone before placement');
    }

    let flips = [];
    let tabooReverseApplied = false;
    let tabooReverseResult = null;

    if (pendingType === 'TABOO_REVERSE_WILL' && typeof opts.CardLogic.pickTabooReverseFlips === 'function') {
        const normalFlips = opts.Core.getFlipsWithContext(opts.gameState, action.row, action.col, playerValue, ctx);
        tabooReverseResult = opts.CardLogic.pickTabooReverseFlips(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, p);
        if (tabooReverseResult && tabooReverseResult.applied && Array.isArray(tabooReverseResult.flips) && tabooReverseResult.flips.length > 0) {
            flips = tabooReverseResult.flips.map((one: any) => [one.row, one.col]);
            tabooReverseApplied = true;
        } else {
            flips = normalFlips;
        }
    } else {
        flips = opts.Core.getFlipsWithContext(opts.gameState, action.row, action.col, playerValue, ctx);
    }
    let flipCount = flips.length;

    const freePlacement = !!(
        opts.CardLogic &&
        typeof opts.CardLogic.isFreePlacementPendingType === 'function' &&
        opts.CardLogic.isFreePlacementPendingType(pendingType)
    );
    if (flipCount === 0 && !freePlacement) {
        throw new Error('Illegal move: no flips and not free placement');
    }

    const preExtra = opts.cardState.extraPlaceRemainingByPlayer[opts.playerKey] || 0;
    const turnNumberBeforePlace = Number(opts.gameState.turnNumber || 0);

    let flipEvadeResult = null;

    if (opts.BoardOps && typeof opts.BoardOps.spawnAt === 'function') {
        const spawnCause = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'FREE_PLACEMENT' : 'SYSTEM';
        const spawnReason = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'free_placement_place' : 'standard_place';
        const spawnMeta: Record<string, any> = {};
        if (pendingType === 'GOLD_STONE') {
            spawnMeta.special = 'GOLD';
            spawnMeta.owner = opts.playerKey;
        } else if (pendingType === 'RAINBOW_STONE') {
            spawnMeta.special = 'RAINBOW';
            spawnMeta.owner = opts.playerKey;
        } else if (pendingType === 'SILVER_STONE') {
            spawnMeta.special = 'SILVER';
            spawnMeta.owner = opts.playerKey;
        } else if (pendingType === 'CROSS_BOMB') {
            spawnMeta.special = 'CROSS_BOMB';
            spawnMeta.owner = opts.playerKey;
        } else if (pendingType === 'X_BOMB') {
            spawnMeta.special = 'X_BOMB';
            spawnMeta.owner = opts.playerKey;
        }
        opts.BoardOps.spawnAt(opts.cardState, opts.gameState, action.row, action.col, opts.playerKey, spawnCause, spawnReason, spawnMeta);
        if (flipCount > 0 && typeof opts.CardLogic.resolveHyperactiveFlipEvasion === 'function') {
            flipEvadeResult = opts.CardLogic.resolveHyperactiveFlipEvasion(opts.cardState, opts.gameState, flips, opts.playerKey, p);
            if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
                flips = flipEvadeResult.remainingFlips.slice();
                flipCount = flips.length;
            }
        }
        const flipCause = tabooReverseApplied ? 'TABOO_REVERSE_WILL' : 'SYSTEM';
        const flipReason = tabooReverseApplied ? 'taboo_reverse_flip' : 'standard_flip';
        const appliedPrimaryFlips = [];
        for (const [fr, fc] of flips) {
            const changeMeta = tabooReverseApplied ? { allowGhostFlip: true } : undefined;
            const changeRes = opts.BoardOps.changeAt(opts.cardState, opts.gameState, fr, fc, opts.playerKey, flipCause, flipReason, changeMeta);
            if (changeRes && changeRes.changed) {
                if (tabooReverseApplied && opts.CardLogic && typeof opts.CardLogic.transferCellMarkerOwnership === 'function') {
                    opts.CardLogic.transferCellMarkerOwnership(opts.cardState, fr, fc, opts.playerKey);
                }
                appliedPrimaryFlips.push([fr, fc]);
            }
        }
        flips = appliedPrimaryFlips;
        flipCount = flips.length;
    } else {
        const newState = opts.Core.applyMove(opts.gameState, { row: action.row, col: action.col, flips });
        Object.assign(opts.gameState, newState);
    }

    emitFlipEvadeEvents(opts.events, flipEvadeResult);

    opts.events.push({ type: 'place', player: opts.playerKey, row: action.row, col: action.col, flips: flips.slice() });
    if (opts.CardLogic && typeof opts.CardLogic.applyObserverWillStoneReservation === 'function') {
        const observerStoneRes = opts.CardLogic.applyObserverWillStoneReservation(opts.cardState, opts.playerKey, action.row, action.col);
        if (observerStoneRes && observerStoneRes.applied) {
            opts.events.push({
                type: 'observer_will_marker_applied',
                player: opts.playerKey,
                row: action.row,
                col: action.col,
                markerId: observerStoneRes.marker && observerStoneRes.marker.id ? observerStoneRes.marker.id : null
            });
        }
    }
    if (opts.CardLogic && typeof opts.CardLogic.applyTheoryIncarnationStoneReservation === 'function') {
        const theoryStoneRes = opts.CardLogic.applyTheoryIncarnationStoneReservation(opts.cardState, opts.playerKey, action.row, action.col);
        if (theoryStoneRes && theoryStoneRes.applied) {
            opts.events.push({
                type: 'theory_incarnation_marker_applied',
                player: opts.playerKey,
                row: action.row,
                col: action.col,
                markerId: theoryStoneRes.marker && theoryStoneRes.marker.id ? theoryStoneRes.marker.id : null
            });
        }
    }
    if (tabooReverseApplied) {
        opts.events.push({
            type: 'taboo_reverse_flipped',
            details: (tabooReverseResult && Array.isArray(tabooReverseResult.flips)) ? tabooReverseResult.flips.slice() : [],
            direction: (tabooReverseResult && Array.isArray(tabooReverseResult.direction)) ? tabooReverseResult.direction.slice() : null
        });
    }

    const othelloMode = opts.isOthelloMode();
    const bonusKey = `${action.row},${action.col}`;
    const bonusMap = (opts.cardState && opts.cardState.boardBonusByCell && typeof opts.cardState.boardBonusByCell === 'object')
        ? opts.cardState.boardBonusByCell
        : null;
    const pendingPlacementType = opts.getPendingEffectTypeForActionPhase(opts.CardLogic, opts.cardState, opts.playerKey);
    const pendingNumberCellMultiplierConfig = (
        pendingPlacementType &&
        opts.CardLogic &&
        opts.CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS &&
        opts.CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS[pendingPlacementType]
    ) || null;
    const numberCellMultiplierConfig = buildNumberCellMultiplierConfig(
        pendingNumberCellMultiplierConfig
            ? Object.assign({}, pendingNumberCellMultiplierConfig, { boostedBy: pendingPlacementType })
            : null
    );
    let boardBonusGained = 0;
    if (!opts.cardState.boardBonusConsumedByCell || typeof opts.cardState.boardBonusConsumedByCell !== 'object') {
        opts.cardState.boardBonusConsumedByCell = {};
    }
    const consumedMap = opts.cardState.boardBonusConsumedByCell;
    const bonusValue = bonusMap ? Number(bonusMap[bonusKey] || 0) : 0;
    if (!othelloMode && bonusValue > 0 && consumedMap[bonusKey] !== true) {
        consumedMap[bonusKey] = true;
        if (opts.CardLogic && typeof opts.CardLogic.addNumberCellCollectedTotal === 'function') {
            opts.CardLogic.addNumberCellCollectedTotal(opts.cardState, opts.playerKey, bonusValue);
        }
        const appliedBonus = numberCellMultiplierConfig
            ? bonusValue * Number(numberCellMultiplierConfig.multiplier || 1)
            : bonusValue;
        const gained = opts.applyPlacementBoardBonusGain(
            opts.CardLogic,
            opts.cardState,
            opts.playerKey,
            action.row,
            action.col,
            appliedBonus,
            flipCount
        );
        boardBonusGained = gained;
        opts.events.push({
            type: 'board_bonus_gain',
            player: opts.playerKey,
            row: action.row,
            col: action.col,
            bonus: bonusValue,
            gained,
            multiplier: numberCellMultiplierConfig ? Number(numberCellMultiplierConfig.multiplier || 1) : 1,
            boostedBy: numberCellMultiplierConfig
                ? (numberCellMultiplierConfig.boostedBy || pendingPlacementType || null)
                : null
        });
    }

    if (!tabooReverseApplied && flips.length > 0 && typeof opts.CardLogic.clearBombAt === 'function') {
        for (const [row, col] of flips) {
            opts.CardLogic.clearBombAt(opts.cardState, row, col);
        }
    }
    if (!tabooReverseApplied && flips.length > 0 && typeof opts.CardLogic.clearHyperactiveAtPositions === 'function') {
        const flippedPositions = flips.map(([row, col]: [any, any]) => ({ row, col }));
        opts.CardLogic.clearHyperactiveAtPositions(opts.cardState, flippedPositions);
    }

    if (!tabooReverseApplied && flipCount > 0 && typeof opts.CardLogic.applyRegenAfterFlips === 'function') {
        const reviveRes = opts.applyPostFlipRevives(opts.CardLogic, opts.cardState, opts.gameState, flips, opts.playerKey);
        const regenRes = reviveRes.regenRes;
        const livingWillRes = reviveRes.livingWillRes;
        if (regenRes.regened && regenRes.regened.length) {
            opts.events.push({ type: 'regen_triggered', details: regenRes.regened });
        }
        if (regenRes.captureFlips && regenRes.captureFlips.length) {
            flips.push(...regenRes.captureFlips.map((pos: any) => [pos.row, pos.col]));
            flipCount = flips.length;
            opts.events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
        }
        if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
            opts.events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
        }
    }

    if (typeof opts.CardLogic.applyChainWillAfterMove === 'function') {
        const chainRes = opts.CardLogic.applyChainWillAfterMove(opts.cardState, opts.gameState, opts.playerKey, flips, p);
        if (chainRes && chainRes.flips && chainRes.flips.length) {
            flips.push(...chainRes.flips.map((pos: any) => [pos.row, pos.col]));
            flipCount = flips.length;
            opts.events.push({ type: 'chain_flipped', details: chainRes.flips });
        }

        if (chainRes && chainRes.flips && chainRes.flips.length && typeof opts.CardLogic.applyRegenAfterFlips === 'function') {
            const reviveRes2 = opts.applyPostFlipRevives(opts.CardLogic, opts.cardState, opts.gameState, chainRes.flips, opts.playerKey);
            const regenRes2 = reviveRes2.regenRes;
            const livingWillRes2 = reviveRes2.livingWillRes;
            if (regenRes2.regened && regenRes2.regened.length) {
                opts.events.push({ type: 'regen_triggered', details: regenRes2.regened });
            }
            if (regenRes2.captureFlips && regenRes2.captureFlips.length) {
                flips.push(...regenRes2.captureFlips.map((pos: any) => [pos.row, pos.col]));
                flipCount = flips.length;
                opts.events.push({ type: 'regen_capture_flipped', details: regenRes2.captureFlips });
            }
            if (livingWillRes2 && livingWillRes2.restored && livingWillRes2.restored.length) {
                opts.events.push({ type: 'living_will_triggered', details: livingWillRes2.restored });
            }
        }
    }

    return {
        completedSelectionOnly: false,
        flipCount,
        preExtra,
        turnNumberBeforePlace,
        othelloMode,
        boardBonusGained,
        numberCellMultiplierConfig
    };
}

const ActionPhasePlaceResolutionModule = {
    resolvePlacementAction
};

export = ActionPhasePlaceResolutionModule;
