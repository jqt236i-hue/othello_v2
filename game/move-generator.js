/**
 * @file move-generator.js
 * @description 合法手生成モジュール
 * 
 * CoreLogic を使用して合法手を生成する。
 * CPU評価関数は別ファイル (game/ai/level-system.js) に移行予定。
 */

if (typeof CoreLogic === 'undefined') {
    console.error('CoreLogic is not loaded.');
}

// ===== Move Generation & Legal Move Lookup =====

/**
 * 合法手リストを取得
 * @param {Object} state - ゲーム状態
 * @param {Array} protectedStones - 保護石リスト
 * @param {Array} permaProtectedStones - 永久保護石リスト
 * @returns {Array} 合法手リスト
 */
function getLegalMoves(state, protectedStones, permaProtectedStones) {
    // Use centralized safe context helper when available
    let context = null;
    try {
        const ctxHelper = (typeof require === 'function') ? require('./logic/context') : (typeof globalThis !== 'undefined' ? globalThis.GameLogicContext : null);
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(typeof cardState !== 'undefined' ? cardState : undefined, protectedStones, permaProtectedStones);
        }
    } catch (e) { /* ignore and fall back below */ }

    if (!context) {
        // Fallback to CardLogic if available, else construct a minimal safe context
        try {
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardContext === 'function' && typeof cardState !== 'undefined') {
                context = CardLogic.getCardContext(cardState);
            }
        } catch (e) { /* ignore */ }
    }

    if (!context) {
        const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function' && typeof cardState !== 'undefined')
            ? MarkersAdapter.getBombMarkers(cardState).map(m => ({
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

    return CoreLogic.getLegalMoves(state, state.currentPlayer, context);
}

// ===== Shared Move Helpers =====

/**
 * 保護セルのセットを作成
 */
function createProtectedCellSet(protection, perma) {
    const set = new Set();
    if (protection && protection.length) {
        protection.forEach(p => set.add(p.row + ',' + p.col));
    }
    if (perma && perma.length) {
        perma.forEach(p => set.add(p.row + ',' + p.col));
    }
    return set;
}

/**
 * プレイヤーの手を生成（カード効果考慮）
 */
function generateMovesForPlayer(player, pending, protection, perma) {
    const legal = getLegalMoves(gameState, protection, perma);
    if (!pending) {
        return legal.map(m => ({ ...m, effectUsed: null, player }));
    }

    const pendingType = pending.type;
    // Target-selection cards must be resolved BEFORE any placement can happen.
    if (pending.stage === 'selectTarget' && (
        pendingType === 'DESTROY_ONE_STONE' ||
        pendingType === 'STRONG_WIND_WILL' ||
        pendingType === 'SACRIFICE_WILL' ||
        pendingType === 'SELL_CARD_WILL' ||
        pendingType === 'HEAVEN_BLESSING' ||
        pendingType === 'CONDEMN_WILL' ||
        pendingType === 'SWAP_WITH_ENEMY' ||
        pendingType === 'POSITION_SWAP_WILL' ||
        pendingType === 'TRAP_WILL' ||
        pendingType === 'TEMPT_WILL' ||
        pendingType === 'GUARD_WILL'
    )) {
        return [];
    }
    if (pendingType === 'FREE_PLACEMENT') {
        return generateFreePlacementMoves(player, protection, perma);
    }
    if (pendingType === 'SWAP_WITH_ENEMY') {
        return generateSwapMoves(player, legal, protection, perma);
    }

    return legal.map(m => ({ ...m, effectUsed: pendingType, player }));
}

/**
 * 自由配置モードの手を生成
 */
function generateFreePlacementMoves(player, protection, perma) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== EMPTY) continue;
            const flips = getFlips(gameState, r, c, player, protection, perma);
            moves.push({ row: r, col: c, flips, effectUsed: 'FREE_PLACEMENT', player });
        }
    }
    return moves;
}

/**
 * スワップモードの手を生成
 */
function generateSwapMoves(player, legal, protection, perma) {
    const moves = [];
    const legalSet = new Set(legal.map(m => m.row + ',' + m.col));
    const protectedCells = createProtectedCellSet(protection, perma);
    const markers = (typeof cardState !== 'undefined' && cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

    const deepCloneState = (s) => (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') ? globalThis.structuredClone(s) : JSON.parse(JSON.stringify(s));

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cellVal = gameState.board[r][c];
            const key = r + ',' + c;

            if (cellVal === -player && !protectedCells.has(key)) {
                const hasSpecialOrBomb = markers.some(m => (m.row === r && m.col === c) && (m.kind === 'specialStone' || m.kind === 'bomb'));
                if (hasSpecialOrBomb) continue;
                // Avoid mutating the real game state: work on a shallow clone when computing hypothetical flips
                const clonedState = deepCloneState(gameState);
                clonedState.board[r][c] = EMPTY;
                const swapFlips = getFlips(clonedState, r, c, player, protection, perma);
                moves.push({ row: r, col: c, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player });
            }
        }
    }
    return moves;
}

/**
 * 特定セルの手を検索
 */
function findMoveForCell(player, row, col, pending, protection, perma) {
    const moves = generateMovesForPlayer(player, pending, protection, perma);
    return moves.find(m => m.row === row && m.col === col) || null;
}

// ===== Utility Functions =====

/**
 * 座標を表記法に変換
 */
function posToNotation(row, col) {
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

/**
 * 角かどうか判定
 */
function isCorner(row, col) {
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

/**
 * 辺かどうか判定
 */
function isEdge(row, col) {
    return row === 0 || row === 7 || col === 0 || col === 7;
}

// ===== Exports =====

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getLegalMoves,
        generateMovesForPlayer,
        generateFreePlacementMoves,
        generateSwapMoves,
        findMoveForCell,
        posToNotation,
        isCorner,
        isEdge
    };
}
