export {};

type RiboTimeStopConstants = {
    RIBO_WILL_OWNER_TURNS: number;
    RIBO_WILL_INITIAL_GAIN: number;
    RIBO_WILL_REPAYMENT_AMOUNT: number;
    RIBO_WILL_SHORTAGE_DESTROY_COUNT: number;
    TIME_STOP_GOD_TURNS: number;
    TIME_STOP_GOD_CONSECUTIVE_TURNS: number;
    TIME_STOP_GOD_SELF_DESTROY_COUNT: number;
};

type RiboTimeStopDeps = {
    BLACK: any;
    WHITE: any;
    BoardOpsModule?: any;
    resolveCardBoardConfig: (gameState: any) => any;
    isGuardProtectedCell: (cardState: any, row: any, col: any) => boolean;
    isInviolableCell?: (cardState: any, row: any, col: any) => boolean;
    getCellValueForCard: (gameState: any, row: any, col: any) => any;
    isFrozenCellForCard: (cardState: any, row: any, col: any) => boolean;
    findSpecialMarkerAt: (cardState: any, row: any, col: any, type?: any, owner?: any) => any;
    getMarkers?: (cardState: any) => any[];
    EvasionStatus?: any;
    removeMarkerById: (cardState: any, markerId: any) => any;
    removeMarkersAt: (cardState: any, row: any, col: any, filter?: any) => any;
    sampleRandomPositions: (positions: any, count: any, prng: any) => any[];
    destroyCellWithPresentation: (cardState: any, gameState: any, row: any, col: any, cause: any, reason: any, meta: any) => any;
    revertSpecialStoneWithPresentation: (cardState: any, gameState: any, row: any, col: any, specialType: any, ownerKey: any, cause: any, reason: any, meta: any) => any;
    addChargeValue: (cardState: any, playerKey: any, amount: any, reason: any, meta?: any) => any;
    addChargeWithTotal: (cardState: any, playerKey: any, amount: any, meta?: any) => any;
    destroyAt: (cardState: any, gameState: any, row: any, col: any, meta?: any) => any;
    runBoardOpsDestroyBlock: (cardState: any, gameState: any, fn: any, meta?: any) => any;
    specialStoneKind: any;
    constants: RiboTimeStopConstants;
};

function ensureRiboRepaymentsByPlayer(cardState: any) {
    if (!cardState || typeof cardState !== 'object') {
        return { black: [], white: [] };
    }
    if (!cardState.riboRepaymentsByPlayer || typeof cardState.riboRepaymentsByPlayer !== 'object') {
        cardState.riboRepaymentsByPlayer = { black: [], white: [] };
    }
    if (!Array.isArray(cardState.riboRepaymentsByPlayer.black)) cardState.riboRepaymentsByPlayer.black = [];
    if (!Array.isArray(cardState.riboRepaymentsByPlayer.white)) cardState.riboRepaymentsByPlayer.white = [];
    return cardState.riboRepaymentsByPlayer;
}

function getRiboExpansionDescriptors(gameState: any, deps: RiboTimeStopDeps) {
    if (deps.BoardOpsModule && typeof deps.BoardOpsModule.getExpansionDescriptors === 'function') {
        return deps.BoardOpsModule.getExpansionDescriptors(gameState);
    }
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];
    const sourceCells = Array.isArray(expansion.cells)
        ? expansion.cells
        : (expansion.active ? [expansion] : []);
    const boardConfig = deps.resolveCardBoardConfig(gameState);
    const out = [];
    for (const cell of sourceCells) {
        if (!cell || typeof cell !== 'object') continue;
        const row = Number(cell.row);
        let col = null;
        if (Number.isInteger(cell.col)) {
            col = cell.col;
        } else if (cell.side === 'left') {
            col = boardConfig.outerBounds.minCol;
        } else if (cell.side === 'right') {
            col = boardConfig.outerBounds.maxCol;
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        out.push({ row, col, owner: cell.owner });
    }
    return out;
}

function isSelfStoneDestroyableForCost(cardState: any, row: number, col: number, deps: RiboTimeStopDeps, options: any = {}) {
    if (deps.isGuardProtectedCell(cardState, row, col)) return false;
    if (typeof deps.isInviolableCell === 'function' && deps.isInviolableCell(cardState, row, col)) return false;
    if (options.excludeFrozen === true && deps.isFrozenCellForCard(cardState, row, col)) return false;
    if (options.excludeDestroyEvade === true) {
        const markers = typeof deps.getMarkers === 'function'
            ? deps.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        for (const marker of markers) {
            if (!marker || marker.kind !== deps.specialStoneKind) continue;
            if (Number(marker.row) !== row || Number(marker.col) !== col) continue;
            const destroyEvadeRemaining = deps.EvasionStatus && typeof deps.EvasionStatus.readDestroyEvadeRemaining === 'function'
                ? deps.EvasionStatus.readDestroyEvadeRemaining(marker)
                : Number(marker && marker.data && marker.data.destroyEvadeRemaining);
            if (Number.isFinite(destroyEvadeRemaining) && destroyEvadeRemaining > 0) return false;
        }
    }
    return true;
}

function collectRiboDestroyableOwnStonePositions(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    const out = [];
    const playerValue = playerKey === 'black' ? deps.BLACK : deps.WHITE;
    const boardConfig = deps.resolveCardBoardConfig(gameState);
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];

    for (let row = 0; row < boardConfig.rows; row++) {
        const boardRow = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < boardConfig.cols; col++) {
            if (boardRow[col] !== playerValue) continue;
            if (!isSelfStoneDestroyableForCost(cardState, row, col, deps, { excludeFrozen: true })) continue;
            out.push({ row, col });
        }
    }

    const expansionCells = getRiboExpansionDescriptors(gameState, deps);
    for (const cell of expansionCells) {
        if (!cell || cell.owner !== playerValue) continue;
        if (!isSelfStoneDestroyableForCost(cardState, cell.row, cell.col, deps, { excludeFrozen: true })) continue;
        out.push({ row: cell.row, col: cell.col });
    }

    return out;
}

function collectTimeStopGodDestroyableOwnStonePositions(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey, deps).filter((pos: any) => {
        if (!pos) return false;
        return isSelfStoneDestroyableForCost(cardState, pos.row, pos.col, deps, {
            excludeFrozen: true,
            excludeDestroyEvade: true
        });
    });
}

function ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState: any) {
    if (!cardState.timeStopConsecutiveTurnsRemainingByPlayer || typeof cardState.timeStopConsecutiveTurnsRemainingByPlayer !== 'object') {
        cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
    }
    if (!Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black))) {
        cardState.timeStopConsecutiveTurnsRemainingByPlayer.black = 0;
    }
    if (!Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.white))) {
        cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = 0;
    }
    cardState.timeStopConsecutiveTurnsRemainingByPlayer.black = Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black)));
    cardState.timeStopConsecutiveTurnsRemainingByPlayer.white = Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.white)));
    return cardState.timeStopConsecutiveTurnsRemainingByPlayer;
}

function reserveTimeStopConsecutiveTurns(cardState: any, playerKey: any, totalTurns: any, deps: RiboTimeStopDeps) {
    const byPlayer = ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState);
    const requestedTurns = Number.isFinite(Number(totalTurns))
        ? Math.max(1, Math.floor(Number(totalTurns)))
        : deps.constants.TIME_STOP_GOD_CONSECUTIVE_TURNS;
    const current = Math.max(0, Number(byPlayer[playerKey]) || 0);
    const increment = current > 0 ? Math.max(0, requestedTurns - 1) : requestedTurns;
    byPlayer[playerKey] = current + increment;
    return byPlayer[playerKey];
}

function armRiboWillEffect(cardState: any, playerKey: any, deps: RiboTimeStopDeps) {
    const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
    const entry = {
        remainingOwnerTurns: deps.constants.RIBO_WILL_OWNER_TURNS,
        repaymentAmount: deps.constants.RIBO_WILL_REPAYMENT_AMOUNT,
        shortageDestroyCount: deps.constants.RIBO_WILL_SHORTAGE_DESTROY_COUNT
    };
    riboByPlayer[playerKey].push(entry);
    const gained = deps.addChargeWithTotal(cardState, playerKey, deps.constants.RIBO_WILL_INITIAL_GAIN);
    return {
        applied: true,
        gained,
        repaymentAmount: entry.repaymentAmount,
        remainingOwnerTurns: entry.remainingOwnerTurns,
        shortageDestroyCount: entry.shortageDestroyCount,
        activeCount: riboByPlayer[playerKey].length
    };
}

function getTimeStopGodDestroyableCount(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey, deps).length;
}

function canUseTimeStopGodForPlayer(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    if (!gameState || !Array.isArray(gameState.board)) return false;
    return getTimeStopGodDestroyableCount(cardState, gameState, playerKey, deps) >= deps.constants.TIME_STOP_GOD_SELF_DESTROY_COUNT;
}

function resolveTimeStopGodUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RiboTimeStopDeps) {
    const targets = deps.sampleRandomPositions(
        collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey, deps),
        deps.constants.TIME_STOP_GOD_SELF_DESTROY_COUNT,
        prng
    );
    const destroyed = [];

    for (const target of targets) {
        if (!target) continue;
        const destroyRes = deps.destroyCellWithPresentation(
            cardState,
            gameState,
            target.row,
            target.col,
            'TIME_STOP_GOD',
            'time_stop_god_cost',
            { owner: playerKey }
        );
        if (destroyRes && destroyRes.destroyed) {
            destroyed.push({ row: target.row, col: target.col });
        }
    }

    return {
        applied: true,
        requestedCount: deps.constants.TIME_STOP_GOD_SELF_DESTROY_COUNT,
        destroyedCount: destroyed.length,
        destroyed
    };
}

function consumeTimeStopConsecutiveTurn(cardState: any, playerKey: any) {
    const byPlayer = ensureTimeStopConsecutiveTurnsRemainingByPlayer(cardState);
    const current = Math.max(0, Number(byPlayer[playerKey]) || 0);
    if (current <= 0) {
        return { consumed: false, remaining: 0, continueTurn: false };
    }
    byPlayer[playerKey] = current - 1;
    return {
        consumed: true,
        remaining: byPlayer[playerKey],
        continueTurn: byPlayer[playerKey] > 0
    };
}

function processTimeStopEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: RiboTimeStopDeps) {
    const marker = deps.findSpecialMarkerAt(cardState, row, col, 'TIME_STOP', playerKey);
    if (!marker) {
        return { triggered: [], fizzled: [] };
    }

    const playerValue = playerKey === 'black' ? deps.BLACK : deps.WHITE;
    const cellValue = deps.getCellValueForCard(gameState, row, col);
    if (cellValue !== playerValue) {
        if (marker.id !== undefined && marker.id !== null) {
            deps.removeMarkerById(cardState, marker.id);
        } else {
            deps.removeMarkersAt(cardState, row, col, { kind: deps.specialStoneKind, type: 'TIME_STOP', owner: playerKey });
        }
        return {
            triggered: [],
            fizzled: [{ row, col, owner: playerKey, reason: 'anchor_lost' }]
        };
    }

    if (!marker.data) marker.data = {};
    const remainingOwnerTurns = Number.isFinite(Number(marker.data.remainingOwnerTurns))
        ? Math.max(0, Math.floor(Number(marker.data.remainingOwnerTurns)))
        : deps.constants.TIME_STOP_GOD_TURNS;
    const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
    marker.data.remainingOwnerTurns = remainingAfter;
    if (remainingAfter > 0) {
        return { triggered: [], fizzled: [] };
    }

    deps.revertSpecialStoneWithPresentation(cardState, gameState, row, col, 'TIME_STOP', playerKey, 'TIME_STOP', 'duration_end', {
        owner: playerKey,
        timer: 0
    });
    const totalReservedTurns = reserveTimeStopConsecutiveTurns(cardState, playerKey, deps.constants.TIME_STOP_GOD_CONSECUTIVE_TURNS, deps);
    return {
        triggered: [{ row, col, owner: playerKey, totalReservedTurns }],
        fizzled: []
    };
}

function processRiboWillTurnStartEffects(cardState: any, gameState: any, playerKey: any, prng: any, deps: RiboTimeStopDeps) {
    const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
    const active = Array.isArray(riboByPlayer[playerKey]) ? riboByPlayer[playerKey] : [];
    const summary: { entries: any[]; totalRepaid: number; totalDestroyed: number; completedCount: number } = {
        entries: [],
        totalRepaid: 0,
        totalDestroyed: 0,
        completedCount: 0
    };
    if (active.length === 0) return summary;

    const next = [];
    for (const rawEntry of active) {
        const remainingOwnerTurns = Number.isFinite(Number(rawEntry && rawEntry.remainingOwnerTurns))
            ? Math.max(0, Math.floor(Number(rawEntry && rawEntry.remainingOwnerTurns)))
            : 0;
        if (remainingOwnerTurns <= 0) continue;

        const repaymentAmount = Number.isFinite(Number(rawEntry && rawEntry.repaymentAmount))
            ? Math.max(0, Math.floor(Number(rawEntry && rawEntry.repaymentAmount)))
            : deps.constants.RIBO_WILL_REPAYMENT_AMOUNT;
        const shortageDestroyCount = Number.isFinite(Number(rawEntry && rawEntry.shortageDestroyCount))
            ? Math.max(0, Math.floor(Number(rawEntry && rawEntry.shortageDestroyCount)))
            : deps.constants.RIBO_WILL_SHORTAGE_DESTROY_COUNT;
        const chargeBefore = Number.isFinite(Number(cardState && cardState.charge && cardState.charge[playerKey]))
            ? Number(cardState.charge[playerKey])
            : 0;
        const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
        const entry: {
            repaymentAmount: any; shortageDestroyCount: any; remainingOwnerTurnsBefore: number; remainingOwnerTurnsAfter: number;
            chargeBefore: number; chargeAfter: number; repaid: number; shortage: boolean; destroyed: any[]; destroyedCount: number; completed: boolean;
        } = {
            repaymentAmount,
            shortageDestroyCount,
            remainingOwnerTurnsBefore: remainingOwnerTurns,
            remainingOwnerTurnsAfter: remainingAfter,
            chargeBefore,
            chargeAfter: chargeBefore,
            repaid: 0,
            shortage: false,
            destroyed: [],
            destroyedCount: 0,
            completed: remainingAfter <= 0
        };

        if (chargeBefore >= repaymentAmount) {
            const deltaRes = deps.addChargeValue(cardState, playerKey, -repaymentAmount, 'ribo_will_repayment');
            entry.repaid = Math.max(0, -(Number(deltaRes && deltaRes.delta) || 0));
            entry.chargeAfter = Number.isFinite(Number(deltaRes && deltaRes.after))
                ? Number(deltaRes.after)
                : Math.max(0, chargeBefore - repaymentAmount);
            summary.totalRepaid += entry.repaid;
        } else {
            entry.shortage = true;
            const targets = deps.sampleRandomPositions(
                collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey, deps),
                shortageDestroyCount,
                prng
            );
            const destroyTargets = () => {
                for (const target of targets) {
                    if (!target) continue;
                    let destroyed = false;
                    if (deps.BoardOpsModule && typeof deps.BoardOpsModule.destroyAt === 'function') {
                        const destroyRes = deps.BoardOpsModule.destroyAt(
                            cardState,
                            gameState,
                            target.row,
                            target.col,
                            'RIBO_WILL',
                            'ribo_repayment_shortage',
                            { owner: playerKey }
                        );
                        destroyed = !!(destroyRes && destroyRes.destroyed);
                    } else {
                        destroyed = deps.destroyAt(cardState, gameState, target.row, target.col);
                    }
                    if (!destroyed) continue;
                    entry.destroyed.push({ row: target.row, col: target.col });
                }
            };
            deps.runBoardOpsDestroyBlock(cardState, gameState, destroyTargets, { randomSource: prng });
            entry.destroyedCount = entry.destroyed.length;
            summary.totalDestroyed += entry.destroyedCount;
        }

        if (entry.completed) {
            summary.completedCount += 1;
        } else {
            next.push({
                remainingOwnerTurns: remainingAfter,
                repaymentAmount,
                shortageDestroyCount
            });
        }
        summary.entries.push(entry);
    }

    riboByPlayer[playerKey] = next;
    return summary;
}

module.exports = {
    armRiboWillEffect,
    getTimeStopGodDestroyableCount,
    canUseTimeStopGodForPlayer,
    resolveTimeStopGodUsage,
    consumeTimeStopConsecutiveTurn,
    processTimeStopEffectsAtTurnStartAnchor,
    processRiboWillTurnStartEffects
};
