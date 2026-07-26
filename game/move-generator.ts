/**
 * @file move-generator.ts
 * @description 合法手生成モジュール
 *
 * CoreLogic を使用して合法手を生成する。
 * CPU評価関数は別ファイル (game/ai/level-system.js) に移行予定。
 */

declare const CoreLogic: any;
declare const cardState: any;
declare const gameState: any;
declare const EMPTY: any;
declare const CardLogic: any;
declare const MarkersAdapter: any;

function requireMoveGeneratorModuleOrNull(id: string): any {
    if (typeof require !== 'function') return null;
    try {
        return require(id);
    } catch (e) {
        /* ignore */
    }
    return null;
}

const MoveGeneratorCoreLogic = (() => {
    try {
        if (typeof CoreLogic !== 'undefined' && CoreLogic) return CoreLogic;
    } catch (e) { /* ignore */ }
    return requireMoveGeneratorModuleOrNull('./logic/core');
})();

if (!MoveGeneratorCoreLogic) {
    console.error('CoreLogic is not loaded.');
}

const MoveGeneratorSharedBoardUtils = requireMoveGeneratorModuleOrNull('../shared/shared-board-utils');

const MoveGeneratorMarkersAdapter = requireMoveGeneratorModuleOrNull('./logic/markers_adapter');
const MoveGeneratorCardMarkers = requireMoveGeneratorModuleOrNull('./logic/cards/markers');

function getFlipsForMoveGeneration(
    state: any,
    row: number,
    col: number,
    player: any,
    protection: any,
    perma: any,
    cardStateValue: any = null
) {
    if (MoveGeneratorCoreLogic && typeof MoveGeneratorCoreLogic.getFlipsWithContext === 'function') {
        return MoveGeneratorCoreLogic.getFlipsWithContext(state, row, col, player, {
            protectedStones: protection || [],
            permaProtectedStones: perma || [],
            cardState: cardStateValue
        });
    }
    throw new Error('GameCore.getFlipsWithContext is required by MoveGenerator');
}

function isSpecialOrBombMarkerForMoveGeneration(marker: any) {
    if (!marker) return false;
    if (MoveGeneratorMarkersAdapter && typeof MoveGeneratorMarkersAdapter.isBombCategoryMarker === 'function') {
        if (MoveGeneratorMarkersAdapter.isBombCategoryMarker(marker)) return true;
    }
    return marker.kind === 'specialStone';
}

function resolveGameStateForMoveGeneration(explicitState?: any) {
    if (explicitState && typeof explicitState === 'object') return explicitState;
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCardStateForMoveGeneration(explicitState?: any) {
    if (explicitState && typeof explicitState === 'object') return explicitState;
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    return null;
}

// ===== Move Generation & Legal Move Lookup =====

/**
 * 合法手リストを取得
 */
function getLegalMoves(state: any, protectedStones: any, permaProtectedStones: any, cardStateValue?: any) {
    const currentCardState = resolveCardStateForMoveGeneration(cardStateValue);
    // Use centralized safe context helper when available
    let context = null;
    try {
        const ctxHelper = requireMoveGeneratorModuleOrNull('./logic/context');
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(currentCardState || undefined, protectedStones, permaProtectedStones);
        }
    } catch (e) { /* ignore and fall back below */ }

    if (!context) {
        // Fallback to CardLogic if available, else construct a minimal safe context
        try {
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardContext === 'function' && currentCardState) {
                context = CardLogic.getCardContext(currentCardState);
            }
        } catch (e) { /* ignore */ }
    }

    if (!context) {
        const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function' && currentCardState)
            ? MarkersAdapter.getBombMarkers(currentCardState).map((m: any) => ({
                row: m.row,
                col: m.col,
                remainingTurns: m.data ? m.data.remainingTurns : undefined,
                owner: m.owner,
                placedTurn: m.data ? m.data.placedTurn : undefined,
                createdSeq: m.createdSeq
            }))
            : [];
        context = {
            protectedStones: protectedStones || [],
            permaProtectedStones: permaProtectedStones || [],
            bombs: bombMarkers
        };
    }

    context.cardState = currentCardState || null;
    return MoveGeneratorCoreLogic.getLegalMoves(state, state.currentPlayer, context);
}

// ===== Shared Move Helpers =====

/**
 * 保護セルのセットを作成
 */
function createProtectedCellSet(protection: any, perma: any) {
    const set = new Set();
    if (protection && protection.length) {
        protection.forEach((p: any) => set.add(p.row + ',' + p.col));
    }
    if (perma && perma.length) {
        perma.forEach((p: any) => set.add(p.row + ',' + p.col));
    }
    return set;
}

function createMoveGenerationView(state: any, cardStateValue: any = null) {
    if (!MoveGeneratorSharedBoardUtils || typeof MoveGeneratorSharedBoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by MoveGenerator');
    }
    return MoveGeneratorSharedBoardUtils.createBoardView(state, {
        cardState: cardStateValue,
        strict: false
    });
}

function getExpansionCellsForMoveGeneration(state: any, cardStateValue: any = null) {
    return createMoveGenerationView(state, cardStateValue).expansionCells.map((cell: any) => ({ ...cell }));
}

function setCellValueForMoveGeneration(
    state: any,
    row: number,
    col: number,
    value: any,
    cardStateValue: any = null
) {
    if (!MoveGeneratorSharedBoardUtils || typeof MoveGeneratorSharedBoardUtils.setStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.setStateCellValue is required by MoveGenerator');
    }
    return MoveGeneratorSharedBoardUtils.setStateCellValue(
        state,
        row,
        col,
        value,
        cardStateValue
    );
}

function isFreePlacementPendingTypeForMoveGeneration(pendingType: any) {
    if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.isFreePlacementPendingType === 'function') {
        return CardLogic.isFreePlacementPendingType(pendingType);
    }
    return pendingType === 'FREE_PLACEMENT' || pendingType === 'SNIPER_WILL' || pendingType === 'LAST_RESORT';
}

/**
 * プレイヤーの手を生成（カード効果考慮）
 */
function generateMovesForPlayerInState(stateValue: any, cardStateValue: any, player: any, pending: any, protection: any, perma: any) {
    const currentGameState = resolveGameStateForMoveGeneration(stateValue);
    const currentCardState = resolveCardStateForMoveGeneration(cardStateValue);
    if (!currentGameState || !Array.isArray(currentGameState.board)) return [];
    const legal = getLegalMoves(currentGameState, protection, perma, currentCardState);
    if (!pending) {
        return legal.map((m: any) => ({ ...m, effectUsed: null, player, playerValue: player }));
    }

    const pendingType = pending.type;
    // Target-selection cards must be resolved BEFORE any placement can happen.
    if (pending.stage === 'selectTarget') {
        return [];
    }
    if (isFreePlacementPendingTypeForMoveGeneration(pendingType)) {
        return generateFreePlacementMoves(player, protection, perma, pendingType, currentGameState, currentCardState);
    }
    if (pendingType === 'TABOO_REVERSE_WILL') {
        return generateTabooReverseMoves(player, legal, currentGameState, currentCardState);
    }
    if (pendingType === 'SWAP_WITH_ENEMY') {
        return generateSwapMoves(player, legal, protection, perma, currentGameState, currentCardState);
    }

    return legal.map((m: any) => ({ ...m, effectUsed: pendingType, player, playerValue: player }));
}

function generateMovesForPlayer(player: any, pending: any, protection: any, perma: any) {
    return generateMovesForPlayerInState(null, null, player, pending, protection, perma);
}

function normalizeMoveGenerationPlayerValue(value: any) {
    if (value === 'white' || value === -1 || value === '-1') return -1;
    if (value === 'black' || value === 1 || value === '1') return 1;
    return null;
}

/**
 * Card-decision legal moves and ordinary placement candidates are equivalent
 * only while there is no pending placement effect and both consumers use the
 * exact same state/protection inputs. The returned evidence is invocation-local
 * and must never be serialized into gameplay state.
 */
function deriveEquivalentCpuMoveScanInState(input: any) {
    const source = input && typeof input === 'object' ? input : {};
    const state = resolveGameStateForMoveGeneration(source.gameState);
    const currentCardState = resolveCardStateForMoveGeneration(source.cardState);
    const player = source.playerValue;
    const pending = source.pending || null;
    const protection = Array.isArray(source.protection) ? source.protection : [];
    const flipBlockers = Array.isArray(source.flipBlockers) ? source.flipBlockers : [];
    if (!state || !Array.isArray(state.board) || pending) return null;
    if (normalizeMoveGenerationPlayerValue(state.currentPlayer) !== normalizeMoveGenerationPlayerValue(player)) {
        return null;
    }

    const legalMoves = getLegalMoves(state, protection, flipBlockers, currentCardState) || [];
    const cardLegalMoves = legalMoves.slice();
    const placementCandidates = legalMoves.map((move: any) => ({
        ...move,
        effectUsed: null,
        player,
        playerValue: player
    }));
    const moveScanEvidence = Object.freeze({
        identity: source.identity || null,
        gameState: state,
        cardState: currentCardState,
        playerValue: player,
        pending: null,
        protection,
        flipBlockers,
        placementCandidates: Object.freeze(placementCandidates.slice())
    });
    return Object.freeze({
        cardLegalMoves: Object.freeze(cardLegalMoves),
        moveScanEvidence
    });
}

function reuseEquivalentCpuMoveScanEvidence(evidence: any, input: any) {
    const source = input && typeof input === 'object' ? input : {};
    if (!evidence || typeof evidence !== 'object') return null;
    if (source.pending) return null;
    if (evidence.identity !== (source.identity || null)) return null;
    if (evidence.gameState !== source.gameState || evidence.cardState !== source.cardState) return null;
    if (evidence.playerValue !== source.playerValue) return null;
    if (evidence.protection !== source.protection || evidence.flipBlockers !== source.flipBlockers) return null;
    return Array.isArray(evidence.placementCandidates)
        ? evidence.placementCandidates.slice()
        : null;
}

function generateTabooReverseMoves(player: any, legal: any, stateValue?: any, cardStateValue?: any) {
    const currentGameState = resolveGameStateForMoveGeneration(stateValue);
    const currentCardState = resolveCardStateForMoveGeneration(cardStateValue);
    if (!currentGameState || !Array.isArray(currentGameState.board)) return [];
    const effectUsed = 'TABOO_REVERSE_WILL';
    const moveMap = new Map();

    for (const m of (legal || [])) {
        if (!m || !Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
        const key = `${m.row},${m.col}`;
        moveMap.set(key, { ...m, effectUsed, player, playerValue: player });
    }

    if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getTabooReverseCandidates !== 'function') {
        return Array.from(moveMap.values());
    }
    const playerKey = (player === 'white' || player === -1 || player === '-1') ? 'white' : 'black';

    const upsertMoveIfTabooValid = (row: number, col: number) => {
        const key = `${row},${col}`;
        const candidates = CardLogic.getTabooReverseCandidates(currentCardState, currentGameState, playerKey, row, col);
        if (!Array.isArray(candidates) || candidates.length === 0) return;

        const maxScore = candidates.reduce((max: number, one: any) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one: any) => (Number(one && one.score) || 0) === maxScore);
        const best = topCandidates[0] || candidates[0];
        const flips = Array.isArray(best && best.flips)
            ? best.flips.map((p: any) => [p.row, p.col])
            : [];
        moveMap.set(key, { row, col, flips, effectUsed, player, playerValue: player });
    };

    const tabooView = createMoveGenerationView(currentGameState, currentCardState);
    for (const cell of tabooView.coordinates) {
        if (tabooView.get(cell.row, cell.col) !== EMPTY) continue;
        upsertMoveIfTabooValid(cell.row, cell.col);
    }

    return Array.from(moveMap.values());
}

/**
 * 自由配置モードの手を生成
 */
function generateFreePlacementMoves(player: any, protection: any, perma: any, effectType: any, stateValue?: any, cardStateValue?: any) {
    const currentGameState = resolveGameStateForMoveGeneration(stateValue);
    const currentCardState = resolveCardStateForMoveGeneration(cardStateValue);
    if (!currentGameState || !Array.isArray(currentGameState.board)) return [];
    const effectUsed = effectType || 'FREE_PLACEMENT';
    const moves = [];
    const freePlacementView = createMoveGenerationView(currentGameState, currentCardState);
    for (const cell of freePlacementView.coordinates) {
        if (freePlacementView.get(cell.row, cell.col) !== EMPTY) continue;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.isBlockedCell === 'function' && currentCardState) {
            if (CardLogic.isBlockedCell(currentCardState, cell.row, cell.col, currentGameState)) {
                continue;
            }
        }
        const flips = getFlipsForMoveGeneration(
            currentGameState,
            cell.row,
            cell.col,
            player,
            protection,
            perma,
            currentCardState
        );
        moves.push({ row: cell.row, col: cell.col, flips, effectUsed, player, playerValue: player });
    }
    return moves;
}

/**
 * スワップモードの手を生成
 */
function generateSwapMoves(player: any, legal: any, protection: any, perma: any, stateValue?: any, cardStateValue?: any) {
    const currentGameState = resolveGameStateForMoveGeneration(stateValue);
    const currentCardState = resolveCardStateForMoveGeneration(cardStateValue);
    if (!currentGameState || !Array.isArray(currentGameState.board)) return [];
    const moves = [];
    const legalSet = new Set(legal.map((m: any) => m.row + ',' + m.col));
    const protectedCells = createProtectedCellSet(protection, perma);
    const markers = (currentCardState && Array.isArray(currentCardState.markers)) ? currentCardState.markers : [];
    const markerIndex = MoveGeneratorCardMarkers && typeof MoveGeneratorCardMarkers.createMarkerCellIndex === 'function'
        ? MoveGeneratorCardMarkers.createMarkerCellIndex(currentCardState)
        : null;
    const hasSpecialOrBombAt = (row: any, col: any) => markerIndex
        ? markerIndex.some(row, col, isSpecialOrBombMarkerForMoveGeneration)
        : markers.some((m: any) => (m.row === row && m.col === col) && isSpecialOrBombMarkerForMoveGeneration(m));

    const deepCloneState = (s: any) => (typeof structuredClone === 'function') ? structuredClone(s) : JSON.parse(JSON.stringify(s));

    const swapView = createMoveGenerationView(currentGameState, currentCardState);
    for (const cell of swapView.coordinates) {
        const key = cell.row + ',' + cell.col;
        if (swapView.get(cell.row, cell.col) !== -player || protectedCells.has(key)) continue;
        const hasSpecialOrBomb = hasSpecialOrBombAt(cell.row, cell.col);
        if (hasSpecialOrBomb) continue;
        const clonedState = deepCloneState(currentGameState);
        if (!setCellValueForMoveGeneration(clonedState, cell.row, cell.col, EMPTY, currentCardState)) continue;
        const swapFlips = getFlipsForMoveGeneration(
            clonedState,
            cell.row,
            cell.col,
            player,
            protection,
            perma,
            currentCardState
        );
        moves.push({ row: cell.row, col: cell.col, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player, playerValue: player });
    }

    return moves;
}

/**
 * 特定セルの手を検索
 */
function findMoveForCell(player: any, row: number, col: number, pending: any, protection: any, perma: any) {
    const moves = generateMovesForPlayer(player, pending, protection, perma);
    return moves.find((m: any) => m.row === row && m.col === col) || null;
}

function findMoveForCellInState(stateValue: any, cardStateValue: any, player: any, row: number, col: number, pending: any, protection: any, perma: any) {
    const moves = generateMovesForPlayerInState(stateValue, cardStateValue, player, pending, protection, perma);
    return moves.find((m: any) => m.row === row && m.col === col) || null;
}

// ===== Utility Functions =====

/**
 * 座標を表記法に変換
 */
function posToNotation(row: number, col: number) {
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.posToNotation === 'function') {
        return MoveGeneratorSharedBoardUtils.posToNotation(row, col);
    }
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

/**
 * 角かどうか判定
 */
function isCorner(row: number, col: number, boardOrRows: any) {
    if (!MoveGeneratorSharedBoardUtils || typeof MoveGeneratorSharedBoardUtils.isCorner !== 'function') {
        throw new Error('SharedBoardUtils.isCorner is required by MoveGenerator');
    }
    if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isCorner(row, col, boardOrRows);
    const size = Number.isInteger(Number(boardOrRows)) ? Number(boardOrRows) : 8;
    return MoveGeneratorSharedBoardUtils.isCorner(row, col, size, size);
}

/**
 * 辺かどうか判定
 */
function isEdge(row: number, col: number, boardOrRows: any) {
    if (!MoveGeneratorSharedBoardUtils || typeof MoveGeneratorSharedBoardUtils.isEdge !== 'function') {
        throw new Error('SharedBoardUtils.isEdge is required by MoveGenerator');
    }
    if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isEdge(row, col, boardOrRows);
    const size = Number.isInteger(Number(boardOrRows)) ? Number(boardOrRows) : 8;
    return MoveGeneratorSharedBoardUtils.isEdge(row, col, size, size);
}

// ===== Exports =====

export = {
    getLegalMoves,
    generateMovesForPlayer,
    generateMovesForPlayerInState,
    deriveEquivalentCpuMoveScanInState,
    reuseEquivalentCpuMoveScanEvidence,
    generateFreePlacementMoves,
    generateSwapMoves,
    findMoveForCell,
    findMoveForCellInState,
    posToNotation,
    isCorner,
    isEdge
};
