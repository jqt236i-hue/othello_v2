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

const MoveGeneratorLegacyCore = requireMoveGeneratorModuleOrNull('./game-core-logic');

const MoveGeneratorBoardOps = requireMoveGeneratorModuleOrNull('./logic/board_ops');
const MoveGeneratorSharedBoardUtils = requireMoveGeneratorModuleOrNull('../shared/shared-board-utils');

const MoveGeneratorMarkersAdapter = requireMoveGeneratorModuleOrNull('./logic/markers_adapter');
const MoveGeneratorCardMarkers = requireMoveGeneratorModuleOrNull('./logic/cards/markers');

function getFlipsForMoveGeneration(state: any, row: number, col: number, player: any, protection: any, perma: any) {
    const legacyGetFlips = (MoveGeneratorLegacyCore && typeof MoveGeneratorLegacyCore.getFlips === 'function')
        ? MoveGeneratorLegacyCore.getFlips
        : null;
    if (legacyGetFlips) {
        return legacyGetFlips(state, row, col, player, protection, perma);
    }
    throw new Error('MoveGenerator.getFlips dependency unavailable');
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

function getExpansionCellsForMoveGeneration(state: any) {
    if (MoveGeneratorBoardOps && typeof MoveGeneratorBoardOps.getExpansionDescriptors === 'function') {
        return MoveGeneratorBoardOps.getExpansionDescriptors(state);
    }

    const expansion = (state && state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    if (!expansion) return [];

    const cells: any[] = [];
    const boardBounds = (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.resolveBoardBounds === 'function')
        ? MoveGeneratorSharedBoardUtils.resolveBoardBounds(state && state.board)
        : null;
    const pushCell = (cellLike: any) => {
        if (!cellLike || typeof cellLike !== 'object') return;
        const side = cellLike.side;
        const row = Number(cellLike.row);
        let col = Number.isInteger(cellLike.col) ? cellLike.col : null;
        if (!Number.isInteger(col)) {
            if (side === 'left') col = -1;
            else if (side === 'right' && boardBounds) col = boardBounds.maxCol + 1;
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (boardBounds) {
            if (row < -1 || row > (boardBounds.maxRow + 1) || col < -1 || col > (boardBounds.maxCol + 1)) return;
            if (row >= boardBounds.minRow && row <= boardBounds.maxRow && col >= boardBounds.minCol && col <= boardBounds.maxCol) return;
        }
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({ row, col, side, owner: Number(cellLike.owner) });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushCell(cell);
        }
    }
    if (cells.length === 0 && expansion.active === true) {
        pushCell(expansion);
    }
    return cells;
}

function setCellValueForMoveGeneration(state: any, row: number, col: number, value: any) {
    if (!state || !Array.isArray(state.board)) return false;
    const boardBounds = (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.resolveBoardBounds === 'function')
        ? MoveGeneratorSharedBoardUtils.resolveBoardBounds(state.board)
        : null;
    if (
        boardBounds &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= boardBounds.minRow &&
        row <= boardBounds.maxRow &&
        col >= boardBounds.minCol &&
        col <= boardBounds.maxCol
    ) {
        state.board[row][col] = value;
        return true;
    }
    if (MoveGeneratorBoardOps && typeof MoveGeneratorBoardOps.setCellValue === 'function') {
        return !!MoveGeneratorBoardOps.setCellValue(state, row, col, value);
    }

    const expansion = (state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    if (!expansion) return false;

    const cells = Array.isArray(expansion.cells)
        ? expansion.cells
        : [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell || typeof cell !== 'object') continue;
        const cellRow = Number(cell.row);
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' && boardBounds ? boardBounds.maxCol + 1 : null));
        if (!Number.isInteger(cellRow) || !Number.isInteger(cellCol)) continue;
        if (cellRow !== row || cellCol !== col) continue;
        cells[i] = { ...cell, owner: Number(value) };
        return true;
    }
    return false;
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

    for (let r = 0; r < currentGameState.board.length; r++) {
        const boardRow = currentGameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            if (boardRow[c] !== EMPTY) continue;
            upsertMoveIfTabooValid(r, c);
        }
    }

    const expansionCells = getExpansionCellsForMoveGeneration(currentGameState);
    for (const expansion of expansionCells) {
        if (!expansion || Number(expansion.owner) !== EMPTY) continue;
        upsertMoveIfTabooValid(expansion.row, expansion.col);
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
    for (let r = 0; r < currentGameState.board.length; r++) {
        const boardRow = currentGameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            if (boardRow[c] !== EMPTY) continue;
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.isBlockedCell === 'function' && currentCardState) {
                if (CardLogic.isBlockedCell(currentCardState, r, c, currentGameState)) continue;
            }
            const flips = getFlipsForMoveGeneration(currentGameState, r, c, player, protection, perma);
            moves.push({ row: r, col: c, flips, effectUsed, player, playerValue: player });
        }
    }
    const expansionCells = getExpansionCellsForMoveGeneration(currentGameState);
    for (const expansion of expansionCells) {
        if (!expansion || Number(expansion.owner) !== EMPTY) continue;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.isBlockedCell === 'function' && currentCardState) {
            if (CardLogic.isBlockedCell(currentCardState, expansion.row, expansion.col, currentGameState)) {
                continue;
            }
        }
        const flips = getFlipsForMoveGeneration(currentGameState, expansion.row, expansion.col, player, protection, perma);
        moves.push({ row: expansion.row, col: expansion.col, flips, effectUsed, player, playerValue: player });
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

    for (let r = 0; r < currentGameState.board.length; r++) {
        const boardRow = currentGameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            const cellVal = boardRow[c];
            const key = r + ',' + c;

            if (cellVal === -player && !protectedCells.has(key)) {
                const hasSpecialOrBomb = hasSpecialOrBombAt(r, c);
                if (hasSpecialOrBomb) continue;
                const clonedState = deepCloneState(currentGameState);
                setCellValueForMoveGeneration(clonedState, r, c, EMPTY);
                const swapFlips = getFlipsForMoveGeneration(clonedState, r, c, player, protection, perma);
                moves.push({ row: r, col: c, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player, playerValue: player });
            }
        }
    }

    const expansionCells = getExpansionCellsForMoveGeneration(currentGameState);
    for (const expansion of expansionCells) {
        if (!expansion) continue;
        const key = expansion.row + ',' + expansion.col;
        if (Number(expansion.owner) !== -player || protectedCells.has(key)) continue;

        const hasSpecialOrBomb = hasSpecialOrBombAt(expansion.row, expansion.col);
        if (hasSpecialOrBomb) continue;

        const clonedState = deepCloneState(currentGameState);
        if (!setCellValueForMoveGeneration(clonedState, expansion.row, expansion.col, EMPTY)) continue;
        const swapFlips = getFlipsForMoveGeneration(clonedState, expansion.row, expansion.col, player, protection, perma);
        moves.push({ row: expansion.row, col: expansion.col, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player, playerValue: player });
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
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.isCorner === 'function') {
        if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isCorner(row, col, boardOrRows);
        return MoveGeneratorSharedBoardUtils.isCorner(row, col, 8, 8);
    }
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

/**
 * 辺かどうか判定
 */
function isEdge(row: number, col: number, boardOrRows: any) {
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.isEdge === 'function') {
        if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isEdge(row, col, boardOrRows);
        return MoveGeneratorSharedBoardUtils.isEdge(row, col, 8, 8);
    }
    return row === 0 || row === 7 || col === 0 || col === 7;
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
