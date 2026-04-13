/**
 * @file cpu-decision.js
 * @description CPU意思決定モジュール
 * 
 * AISystemを利用してレベル別のCPU行動を実行する。
 */

// AISystemの存在確認 (lightweight helper used throughout CPU decision logic)
function isAISystemAvailable() {
    return (typeof AISystem !== 'undefined' && AISystem && typeof AISystem === 'object');
}

function isCpuDebugEnabled() {
    try {
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) return true;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.DEBUG_CPU_LOG === true) return true;
    } catch (e) { /* ignore */ }
    try {
        const qs = (typeof location !== 'undefined' && location && typeof location.search === 'string')
            ? location.search
            : '';
        if (/[?&]debug=(?:1|true)\b/i.test(qs)) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function cpuDebugLog() {
    if (!isCpuDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, arguments); } catch (e) { /* ignore */ }
}

if (!isAISystemAvailable()) {
    // Keep runtime warning in browser/dev, but avoid noisy test output.
    const isTestEnv = (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV === 'test');
    if (!isTestEnv) {
        console.error('[CPU] AISystem is not loaded. Please include game/ai/level-system.js');
    }
}

/**
 * フォールバック: レベルやハンド状況に基づいて使用候補を返す
 */
// CPU RNG injection (default deterministic to avoid random calls in game layer)
let cpuRng = { random: () => 0.5 };
function setCpuRng(rng) { cpuRng = rng || cpuRng; }

let CpuPolicyCore = null;
if (typeof require === 'function') {
    try { CpuPolicyCore = require('./ai/cpu-policy-core'); } catch (e) { /* ignore */ }
}
let CpuPolicyTableRuntime = null;
if (typeof require === 'function') {
    try { CpuPolicyTableRuntime = require('./ai/policy-table-runtime'); } catch (e) { /* ignore */ }
}
let CpuPolicyOnnxRuntime = null;
if (typeof require === 'function') {
    try { CpuPolicyOnnxRuntime = require('./ai/policy-onnx-runtime'); } catch (e) { /* ignore */ }
}
let SharedBoardUtilsModule = null;
if (typeof require === 'function') {
    try { SharedBoardUtilsModule = require('../shared/shared-board-utils'); } catch (e) { /* ignore */ }
}
if (!SharedBoardUtilsModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SharedBoardUtils) {
            SharedBoardUtilsModule = globalThis.SharedBoardUtils;
        }
    } catch (e) { /* ignore */ }
}
let CpuLv6RuntimeCapabilityModule = null;
if (typeof require === 'function') {
    try { CpuLv6RuntimeCapabilityModule = require('../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}

function readGlobalModule(globalKey) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis && globalThis[globalKey]) {
            return globalThis[globalKey];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveModuleReference(currentValue, options) {
    const opts = options || {};
    const isValid = (typeof opts.isValid === 'function')
        ? opts.isValid
        : function isTruthy(value) { return !!value; };
    if (isValid(currentValue)) return currentValue;

    let resolvedModule = null;
    if (typeof opts.readLocal === 'function') {
        try {
            resolvedModule = opts.readLocal();
        } catch (e) { /* ignore */ }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.requirePath && typeof require === 'function') {
        try {
            resolvedModule = require(opts.requirePath);
        } catch (e) { /* ignore */ }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.globalKey) {
        resolvedModule = readGlobalModule(opts.globalKey);
        if (isValid(resolvedModule)) return resolvedModule;
    }
    return null;
}

function resolveSharedBoardUtilsModule() {
    const resolvedModule = resolveModuleReference(SharedBoardUtilsModule, {
        requirePath: '../shared/shared-board-utils',
        globalKey: 'SharedBoardUtils',
        isValid: (moduleRef) => !!(moduleRef && typeof moduleRef === 'object')
    });
    if (resolvedModule) SharedBoardUtilsModule = resolvedModule;
    return resolvedModule;
}

let PendingTargetSelector = null;
if (typeof require === 'function') {
    try { PendingTargetSelector = require('./turn-handlers/pending-target-selector'); } catch (e) { /* ignore */ }
}
var PendingSelectionFlow = null;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./card-effects/selection-flow'); } catch (e) { /* ignore */ }
}
let cpuDecisionNetworkTurnHandoff = null;
if (typeof require === 'function') {
    try { cpuDecisionNetworkTurnHandoff = require('./network-turn-handoff'); } catch (e) { /* ignore */ }
}
let CpuPendingCoordinator = null;
if (typeof require === 'function') {
    try { CpuPendingCoordinator = require('./turn/pending-coordinator'); } catch (e) { /* ignore */ }
}
if (!cpuDecisionNetworkTurnHandoff && typeof globalThis !== 'undefined' && globalThis.NetworkTurnHandoff) {
    cpuDecisionNetworkTurnHandoff = globalThis.NetworkTurnHandoff;
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}
if (!CpuPendingCoordinator && typeof globalThis !== 'undefined' && globalThis.PendingCoordinator) {
    CpuPendingCoordinator = globalThis.PendingCoordinator;
}

function hasPendingSelectionFlowContract(moduleRef) {
    return !!(
        moduleRef
        && typeof moduleRef === 'object'
        && (
            typeof moduleRef.createPendingSelectionAction === 'function'
            || typeof moduleRef.finalizePendingSelectionFlow === 'function'
            || typeof moduleRef.isSelectionOnlyEndTurnPendingType === 'function'
        )
    );
}

function hasPendingSelectionFlowFunction(moduleRef, functionName) {
    return !!(
        moduleRef
        && typeof moduleRef === 'object'
        && typeof moduleRef[functionName] === 'function'
    );
}

function resolvePendingSelectionFlow(requiredFunctionName) {
    const requiredName = typeof requiredFunctionName === 'string' ? requiredFunctionName : '';
    const resolvedModule = resolveModuleReference(PendingSelectionFlow, {
        requirePath: './card-effects/selection-flow',
        globalKey: 'PendingSelectionFlow',
        isValid: (moduleRef) => requiredName
            ? hasPendingSelectionFlowFunction(moduleRef, requiredName)
            : hasPendingSelectionFlowContract(moduleRef)
    });
    if (resolvedModule) PendingSelectionFlow = resolvedModule;
    return resolvedModule;
}

function resolveCpuPendingCoordinator() {
    const resolvedModule = resolveModuleReference(CpuPendingCoordinator, {
        requirePath: './turn/pending-coordinator',
        globalKey: 'PendingCoordinator',
        isValid: (moduleRef) => !!(moduleRef && typeof moduleRef === 'object')
    });
    if (resolvedModule) CpuPendingCoordinator = resolvedModule;
    return resolvedModule;
}

function readCpuPendingEffect(playerKey, stateRef) {
    const resolvedState = stateRef || ((typeof cardState !== 'undefined') ? cardState : null);
    const pendingCoordinator = resolveCpuPendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function') {
        return pendingCoordinator.readPendingEffect(resolvedState, playerKey);
    }
    return (resolvedState && resolvedState.pendingEffectByPlayer)
        ? (resolvedState.pendingEffectByPlayer[playerKey] || null)
        : null;
}

function clearCpuPendingEffect(playerKey, stateRef) {
    const resolvedState = stateRef || ((typeof cardState !== 'undefined') ? cardState : null);
    const pendingCoordinator = resolveCpuPendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.clearPendingEffect === 'function') {
        return pendingCoordinator.clearPendingEffect(resolvedState, playerKey, {
            clearSelectionAction: true
        });
    }
    if (resolvedState && resolvedState.pendingEffectByPlayer) {
        resolvedState.pendingEffectByPlayer[playerKey] = null;
    }
    return { ok: true, playerKey };
}

const CpuDecisionBoardUtilsModule = (() => {
    if (typeof require === 'function') {
        try { return require('./cpu-decision-board-utils'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CpuDecisionBoardUtils) {
            return globalThis.CpuDecisionBoardUtils;
        }
    } catch (e) { /* ignore */ }
    return null;
})();

const countBoardEmpties = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countBoardEmpties === 'function')
    ? CpuDecisionBoardUtilsModule.countBoardEmpties
    : function countBoardEmptiesFallback(board) {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                if (row[c] === 0) empties += 1;
            }
        }
        return empties;
    };

const isStandardBoard8x8 = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isStandardBoard8x8 === 'function')
    ? CpuDecisionBoardUtilsModule.isStandardBoard8x8
    : function isStandardBoard8x8Fallback() { return false; };

const isCornerCell = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isCornerCell === 'function')
    ? CpuDecisionBoardUtilsModule.isCornerCell
    : function isCornerCellFallback(row, col) {
        return (row === 0 || row === 7) && (col === 0 || col === 7);
    };

const isEdgeCell = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isEdgeCell === 'function')
    ? CpuDecisionBoardUtilsModule.isEdgeCell
    : function isEdgeCellFallback(row, col) {
        return row === 0 || row === 7 || col === 0 || col === 7;
    };

function isPlayableBoard(board) {
    if (!Array.isArray(board) || board.length <= 0) return false;
    for (const row of board) {
        if (!Array.isArray(row) || row.length <= 0) return false;
    }
    return true;
}

function getShapeAwareBoard(board, gameStateOverride, cardStateOverride) {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (!Array.isArray(board) || !boardUtils || typeof boardUtils.attachBoardShape !== 'function') {
        return board;
    }
    try {
        boardUtils.attachBoardShape(board, {
            boardExpansion: gameStateOverride && gameStateOverride.boardExpansion,
            cardState: cardStateOverride || null
        });
    } catch (e) { /* ignore */ }
    return board;
}

function getCurrentCpuBoard() {
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    return (gs && Array.isArray(gs.board))
        ? getShapeAwareBoard(gs.board, gs, cs)
        : null;
}

/**
 * Intentional product gate:
 * learned CPU routes (policy-table / ONNX / 8x8 teacher-aligned paths) stay standard-8x8 only.
 * Custom boards must fall back to the safe non-learned CPU path.
 */
function canUseStandardBoardCpuPolicy(boardRef, featureKey, playerKey, level) {
    const board = boardRef || getCurrentCpuBoard();
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const supported = capabilityModule && typeof capabilityModule.isStandardBoardCpuPolicyCompatible === 'function'
        ? capabilityModule.isStandardBoardCpuPolicyCompatible(board)
        : isStandardBoard8x8(board);
    if (!supported) {
        const tag = String(featureKey || 'cpu-policy');
        const levelLabel = Number.isFinite(level) ? `Lv${level}` : 'Lv?';
        const actorLabel = String(playerKey || '').trim() || 'cpu';
        cpuDebugLog(
            `[CPU] ${levelLabel} ${actorLabel}: ${tag} は標準8x8専用の学習済みCPU経路のため無効化し、安全な通常判断へフォールバック`
        );
    }
    return supported;
}

function countPlayableCells(board) {
    if (!Array.isArray(board)) return 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function') {
        return boardUtils.collectBoardCoordinates(board).length;
    }
    let total = 0;
    for (const row of board) total += Array.isArray(row) ? row.length : 0;
    return total;
}

function getBoardCellValue(board, row, col) {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.getCellValue === 'function') {
        return boardUtils.getCellValue(board, row, col);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return null;
    return board[row][col];
}

function setBoardCellValue(board, row, col, value) {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.setCellValue === 'function') {
        return boardUtils.setCellValue(board, row, col, value);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row]) || col < 0 || col >= board[row].length) return false;
    board[row][col] = value;
    return true;
}

function getBoardBonusValueAt(row, col) {
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.getBoardBonusValueAt === 'function') {
        const cs = (typeof cardState !== 'undefined') ? cardState : null;
        return CpuDecisionBoardUtilsModule.getBoardBonusValueAt(row, col, cs);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    if (!cs) return 0;
    const key = `${row},${col}`;
    const consumed = (cs.boardBonusConsumedByCell && cs.boardBonusConsumedByCell[key] === true);
    if (consumed) return 0;
    const raw = Number(cs.boardBonusByCell && cs.boardBonusByCell[key] ? cs.boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

const countCornerControl = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countCornerControl === 'function')
    ? CpuDecisionBoardUtilsModule.countCornerControl
    : function countCornerControlFallback(board, playerValue) {
        if (!isPlayableBoard(board)) return { ownCorners: 0, oppCorners: 0 };
        const maxRow = board.length - 1;
        const maxCol = Array.isArray(board[0]) ? (board[0].length - 1) : maxRow;
        const corners = [
            [0, 0],
            [0, maxCol],
            [maxRow, 0],
            [maxRow, maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const one of corners) {
            const row = Array.isArray(board[one[0]]) ? board[one[0]] : null;
            if (!row || one[1] < 0 || one[1] >= row.length) continue;
            const v = row[one[1]];
            if (v === playerValue) ownCorners += 1;
            else if (v === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    };

const countEdgeControl = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countEdgeControl === 'function')
    ? CpuDecisionBoardUtilsModule.countEdgeControl
    : function countEdgeControlFallback(board, playerValue) {
        if (!isPlayableBoard(board)) return { ownEdges: 0, oppEdges: 0 };
        const maxRow = board.length - 1;
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row <= maxRow; row++) {
            const cells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < cells.length; col++) {
                if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) continue;
                const v = cells[col];
                if (v === playerValue) ownEdges += 1;
                else if (v === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    };

function isRecoveryCardType(cardType) {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerRecoveryCardType === 'function') {
        try { return CpuPolicyCore.isCornerRecoveryCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isRecoveryCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isRecoveryCardType(type);
    }
    return false;
}

function isHoldCardType(cardType) {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerHoldCardType === 'function') {
        try { return CpuPolicyCore.isCornerHoldCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isHoldCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isHoldCardType(type);
    }
    return false;
}

function isChargeRampCardType(cardType) {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isChargeRampCardType === 'function') {
        try { return CpuPolicyCore.isChargeRampCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isChargeRampCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isChargeRampCardType(type);
    }
    return false;
}

function resolveCardType(cardId, cardDef) {
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.resolveCardType === 'function') {
        const logic = (typeof CardLogic !== 'undefined') ? CardLogic : null;
        return CpuDecisionBoardUtilsModule.resolveCardType(cardId, cardDef, logic);
    }
    if (cardDef && typeof cardDef.type === 'string' && cardDef.type) return cardDef.type;
    if (!cardId || typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getCardDef !== 'function') return '';
    try {
        const def = CardLogic.getCardDef(cardId);
        return (def && typeof def.type === 'string') ? def.type : '';
    } catch (e) {
        return '';
    }
}

const WHITE_LV6_CORNER_SWING_KEEP_TYPES = new Set([
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL'
]);

function resolvePolicyTableRuntime() {
    const resolvedModule = resolveModuleReference(CpuPolicyTableRuntime, {
        globalKey: 'CpuPolicyTableRuntime',
        isValid: (moduleRef) => !!(
            moduleRef &&
            (
                typeof moduleRef.chooseMove === 'function' ||
                typeof moduleRef.getActionScoreForKey === 'function'
            )
        )
    });
    if (resolvedModule) CpuPolicyTableRuntime = resolvedModule;
    return resolvedModule;
}

function resolvePolicyOnnxRuntime() {
    const resolvedModule = resolveModuleReference(CpuPolicyOnnxRuntime, {
        globalKey: 'CpuPolicyOnnxRuntime',
        isValid: (moduleRef) => !!(
            moduleRef &&
            (
                typeof moduleRef.chooseMove === 'function' ||
                typeof moduleRef.chooseCard === 'function' ||
                typeof moduleRef.choosePendingTarget === 'function' ||
                typeof moduleRef.evaluatePosition === 'function'
            )
        )
    });
    if (resolvedModule) CpuPolicyOnnxRuntime = resolvedModule;
    return resolvedModule;
}

function resolveCpuLv6RuntimeCapabilityModule() {
    const resolvedModule = resolveModuleReference(CpuLv6RuntimeCapabilityModule, {
        globalKey: 'CpuLv6RuntimeCapability',
        isValid: (moduleRef) => !!(
            moduleRef &&
            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'
        )
    });
    if (resolvedModule) CpuLv6RuntimeCapabilityModule = resolvedModule;
    return resolvedModule;
}

function resolvePendingType(playerKey) {
    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getPendingEffectType === 'function') {
            return CardLogic.getPendingEffectType(cardState, playerKey);
        }
    } catch (e) { /* ignore */ }
    try {
        const pending = readCpuPendingEffect(playerKey);
        return pending && pending.type ? pending.type : null;
    } catch (e) { /* ignore */ }
    return null;
}

function getHandCardIdsForPlayer(playerKey) {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const hand = (cs && cs.hands && Array.isArray(cs.hands[playerKey]))
        ? cs.hands[playerKey]
        : [];
    return hand.slice();
}

function buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, usableCardIds, candidateMoves) {
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const moves = Array.isArray(candidateMoves)
        ? candidateMoves.filter((one) => one && Number.isFinite(one.row) && Number.isFinite(one.col))
        : [];
    let hasCornerMoveNow = false;
    let hasEdgeMoveNow = false;
    let maxLegalMoveBonus = 0;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const boardRef = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    for (const move of moves) {
        if (!hasCornerMoveNow && isCornerCell(move.row, move.col, boardRef)) hasCornerMoveNow = true;
        if (!hasEdgeMoveNow && isEdgeCell(move.row, move.col, boardRef) && !isCornerCell(move.row, move.col, boardRef)) hasEdgeMoveNow = true;
        const bonus = getBoardBonusValueAt(move.row, move.col);
        if (bonus > maxLegalMoveBonus) maxLegalMoveBonus = bonus;
    }
    return {
        playerKey,
        level,
        board: boardRef,
        pendingType: resolvePendingType(playerKey),
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        ownCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey])) ? cardState.charge[playerKey] : 0,
        oppCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[opponentKey])) ? cardState.charge[opponentKey] : 0,
        deckCount: (cardState && cardState.deck && Number.isFinite(cardState.deck.length)) ? cardState.deck.length : 0,
        boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
            ? cardState.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
            ? cardState.boardBonusConsumedByCell
            : null,
        handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : getHandCardIdsForPlayer(playerKey),
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null,
        candidateMoves: moves,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        maxLegalMoveBonus,
        highBonusMoveAvailable: maxLegalMoveBonus >= 3
    };
}

function selectMoveFromLearnedPolicy(candidateMoves, playerKey, level) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    try {
        const boardRef = getCurrentCpuBoard();
        if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-move', playerKey, level)) return null;
        return runtime.chooseMove(candidateMoves, {
            playerKey,
            level,
            board: boardRef,
            pendingType: resolvePendingType(playerKey),
            legalMovesCount: candidateMoves.length
        });
    } catch (e) {
        console.warn('[CPU] policy-table runtime failed, fallback to default policy', e);
        return null;
    }
}

function createLearnedScoreFn(playerKey, level, legalMovesCount) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScore !== 'function') return null;
    const boardRef = getCurrentCpuBoard();
    if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-score', playerKey, level)) return null;
    return function scoreMove(move) {
        try {
            const s = runtime.getActionScore(move, {
                playerKey,
                level,
                board: boardRef,
                pendingType: resolvePendingType(playerKey),
                legalMovesCount
            });
            return Number.isFinite(s) ? s : 0;
        } catch (e) {
            return 0;
        }
    };
}

function createLookaheadPriorScoreFn(playerKey, level, legalMovesCount, onnxSelectedMove) {
    const learnedScoreFn = createLearnedScoreFn(playerKey, level, legalMovesCount);
    return function priorScore(move) {
        let score = 0;
        if (learnedScoreFn) {
            const learned = Number(learnedScoreFn(move) || 0);
            if (Number.isFinite(learned) && learned !== 0) {
                score += Math.sign(learned) * Math.log1p(Math.abs(learned)) * 180;
            }
        }
        if (onnxSelectedMove && isSameMoveByCoord(move, onnxSelectedMove)) {
            score += 1100;
        }
        return score;
    };
}

function resolveCpuLv6SharedProfile() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CPU_LV6_SHARED_PROFILE && typeof globalThis.CPU_LV6_SHARED_PROFILE === 'object') {
            return globalThis.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const loaded = require('../constants/cpu-lv6-shared-profile.js');
            if (loaded && typeof loaded === 'object') return loaded;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuLv6BrowserProfile() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6BrowserProfile === 'function') {
        return capabilityModule.resolveCpuLv6BrowserProfile(shared);
    }
    if (shared && shared.browser && typeof shared.browser === 'object') return shared.browser;
    return null;
}

function resolveCpuLv6LookaheadWeights() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6LookaheadWeights === 'function') {
        return capabilityModule.resolveCpuLv6LookaheadWeights(shared);
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const weightConfig = browserProfile && browserProfile.lookaheadWeights && typeof browserProfile.lookaheadWeights === 'object'
        ? browserProfile.lookaheadWeights
        : null;
    return {
        onnxRefinePriorWeight: Number(weightConfig && weightConfig.onnxRefinePriorWeight) || 66,
        policyLookaheadPriorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
        searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8
    };
}

function resolveCpuCurrentTurnNumber() {
    const turnNumber = Number(gameState && gameState.turnNumber);
    if (Number.isFinite(turnNumber)) return Math.max(1, Math.floor(turnNumber) + 1);

    const turnIndex = Number(cardState && cardState.turnIndex);
    if (Number.isFinite(turnIndex)) return Math.max(1, Math.floor(turnIndex) + 1);

    return null;
}

function resolveCpuLv6OnnxRuntimeGuardOverrides() {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.CPU_LV6_ONNX_RUNTIME_GUARD &&
            typeof globalThis.CPU_LV6_ONNX_RUNTIME_GUARD === 'object'
        ) {
            return globalThis.CPU_LV6_ONNX_RUNTIME_GUARD;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readLegacyPendingSelectionBudgetMs() {
    try {
        return Number(globalThis && globalThis.CPU_LV6_PENDING_SELECTION_ONNX_MAX_MS);
    } catch (e) { /* ignore */ }
    return NaN;
}

function resolveCpuLv6BrowserRuntimeCapability() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (!capabilityModule || typeof capabilityModule.resolveCpuLv6BrowserRuntimeCapability !== 'function') return null;
    return capabilityModule.resolveCpuLv6BrowserRuntimeCapability(shared, {
        guardOverrides: resolveCpuLv6OnnxRuntimeGuardOverrides(),
        legacyPendingSelectionBudgetMs: readLegacyPendingSelectionBudgetMs()
    });
}

function resolveCpuLv6OnnxRuntimeGuard() {
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability && capability.onnxRuntimeGuard && typeof capability.onnxRuntimeGuard === 'object') {
        return capability.onnxRuntimeGuard;
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configured = browserProfile && browserProfile.onnxRuntimeGuard && typeof browserProfile.onnxRuntimeGuard === 'object'
        ? browserProfile.onnxRuntimeGuard
        : null;
    const overrides = resolveCpuLv6OnnxRuntimeGuardOverrides();
    const readNumber = (key, fallback) => {
        const overrideValue = Number(overrides && overrides[key]);
        if (Number.isFinite(overrideValue)) return overrideValue;
        const configuredValue = Number(configured && configured[key]);
        if (Number.isFinite(configuredValue)) return configuredValue;
        return fallback;
    };

    const legacyPendingBudgetMs = readLegacyPendingSelectionBudgetMs();
    const pendingSelectionBudgetMs = Number.isFinite(legacyPendingBudgetMs) && legacyPendingBudgetMs > 0
        ? legacyPendingBudgetMs
        : readNumber('pendingSelectionBudgetMs', Number(browserProfile && browserProfile.pendingSelectionOnnxMaxMs) || 120);

    return {
        minSamples: Math.max(1, Math.floor(readNumber('minSamples', 4))),
        maxAverageLatencyMs: Math.max(0, readNumber('maxAverageLatencyMs', 0)),
        maxP95LatencyMs: Math.max(0, readNumber('maxP95LatencyMs', 0)),
        maxMaxLatencyMs: Math.max(0, readNumber('maxMaxLatencyMs', 0)),
        moveBudgetMs: Math.max(0, Math.floor(readNumber('moveBudgetMs', 0))),
        cardBudgetMs: Math.max(0, Math.floor(readNumber('cardBudgetMs', 0))),
        pendingSelectionBudgetMs: Math.max(0, Math.floor(pendingSelectionBudgetMs))
    };
}

function resolveCpuLv6OnnxRuntimeBudgetMs(level, operationKey) {
    if (!Number.isFinite(level) || level < 6) return 0;
    const guard = resolveCpuLv6OnnxRuntimeGuard();
    if (!guard) return 0;
    if (operationKey === 'chooseMove') return guard.moveBudgetMs;
    if (operationKey === 'chooseCard') return guard.cardBudgetMs;
    if (operationKey === 'choosePendingTarget') return guard.pendingSelectionBudgetMs;
    return 0;
}

function formatCpuOnnxLatencyGateReason(operationKey, sourceLabel, bucket, guard) {
    const parts = [];
    const averageMs = Number(bucket && bucket.averageMs);
    const p95Ms = Number(bucket && bucket.p95Ms);
    const maxMs = Number(bucket && bucket.maxMs);
    if (guard.maxAverageLatencyMs > 0 && Number.isFinite(averageMs) && averageMs > guard.maxAverageLatencyMs) {
        parts.push(`avg=${averageMs.toFixed(1)}>${guard.maxAverageLatencyMs}`);
    }
    if (guard.maxP95LatencyMs > 0 && Number.isFinite(p95Ms) && p95Ms > guard.maxP95LatencyMs) {
        parts.push(`p95=${p95Ms.toFixed(1)}>${guard.maxP95LatencyMs}`);
    }
    if (guard.maxMaxLatencyMs > 0 && Number.isFinite(maxMs) && maxMs > guard.maxMaxLatencyMs) {
        parts.push(`max=${maxMs.toFixed(1)}>${guard.maxMaxLatencyMs}`);
    }
    return `${operationKey}:${sourceLabel}:${parts.join(',')}`;
}

function evaluateCpuOnnxLatencyGate(runtime, operationKey, level) {
    if (!runtime || typeof runtime.getStatus !== 'function') return { shouldDegrade: false, reason: '' };
    if (!Number.isFinite(level) || level < 6) return { shouldDegrade: false, reason: '' };

    const guard = resolveCpuLv6OnnxRuntimeGuard();
    const thresholdEnabled = !!(
        guard && (
            guard.maxAverageLatencyMs > 0 ||
            guard.maxP95LatencyMs > 0 ||
            guard.maxMaxLatencyMs > 0
        )
    );
    if (!thresholdEnabled) return { shouldDegrade: false, reason: '' };

    const status = runtime.getStatus() || {};
    const latency = status && status.latency && typeof status.latency === 'object' ? status.latency : null;
    if (!latency) return { shouldDegrade: false, reason: '' };

    const buckets = [];
    const operationBucket = latency.perOperation && latency.perOperation[operationKey];
    if (operationBucket && Number(operationBucket.count) >= guard.minSamples) {
        buckets.push({ label: operationKey, bucket: operationBucket });
    }
    if (latency.overall && Number(latency.overall.count) >= guard.minSamples) {
        buckets.push({ label: 'overall', bucket: latency.overall });
    }

    for (const one of buckets) {
        const bucket = one.bucket;
        if (!bucket) continue;
        const averageMs = Number(bucket.averageMs);
        const p95Ms = Number(bucket.p95Ms);
        const maxMs = Number(bucket.maxMs);
        const exceeded = (
            (guard.maxAverageLatencyMs > 0 && Number.isFinite(averageMs) && averageMs > guard.maxAverageLatencyMs) ||
            (guard.maxP95LatencyMs > 0 && Number.isFinite(p95Ms) && p95Ms > guard.maxP95LatencyMs) ||
            (guard.maxMaxLatencyMs > 0 && Number.isFinite(maxMs) && maxMs > guard.maxMaxLatencyMs)
        );
        if (exceeded) {
            return {
                shouldDegrade: true,
                reason: formatCpuOnnxLatencyGateReason(operationKey, one.label, bucket, guard)
            };
        }
    }

    return { shouldDegrade: false, reason: '' };
}

function logCpuOnnxLatencyDegrade(level, playerKey, operationKey, reason) {
    cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: ONNX縮退 ${operationKey}${reason ? ` ${reason}` : ''}`
    );
}

function resolveLv6LookaheadTimeCaps(playerKey) {
    const isWhite = String(playerKey || '') === 'white';
    const isBrowserUi = (typeof window !== 'undefined' && typeof document !== 'undefined');
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6LookaheadTimeCaps === 'function') {
        const resolved = capabilityModule.resolveCpuLv6LookaheadTimeCaps(shared, {
            playerKey,
            isBrowserUi
        });
        if (resolved) return resolved;
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configuredCaps = browserProfile && browserProfile.lookaheadTimeCaps && typeof browserProfile.lookaheadTimeCaps === 'object'
        ? browserProfile.lookaheadTimeCaps
        : null;
    if (configuredCaps) {
        if (isWhite && isBrowserUi && configuredCaps.whiteUi) return configuredCaps.whiteUi;
        if (isWhite && configuredCaps.whiteHeadless) return configuredCaps.whiteHeadless;
        if (configuredCaps.black) return configuredCaps.black;
    }
    if (isWhite && isBrowserUi) {
        return {
            moveCapMs: 1100,
            endgameCapMs: 1600,
            quiescenceMoveCapMs: 900,
            quiescenceEndgameCapMs: 1500,
            quiescenceEndgameMinMs: 700
        };
    }
    if (isWhite) {
        return {
            moveCapMs: 900,
            endgameCapMs: 1300,
            quiescenceMoveCapMs: 750,
            quiescenceEndgameCapMs: 1200,
            quiescenceEndgameMinMs: 600
        };
    }
    return {
        moveCapMs: 1000,
        endgameCapMs: 1500,
        quiescenceMoveCapMs: 800,
        quiescenceEndgameCapMs: 1400,
        quiescenceEndgameMinMs: 700
    };
}

function createLookaheadMetaLogger(playerKey, level, phaseLabel) {
    if (!Number.isFinite(level) || level < 6) return null;
    if (typeof cpuDebugLog !== 'function') return null;
    return function onSearchMeta(meta) {
        if (!meta || typeof meta !== 'object') return;
        const depth = Number.isFinite(meta.depth) ? Number(meta.depth) : 'n/a';
        const branch = Number.isFinite(meta.branchLimit) ? Number(meta.branchLimit) : 'all';
        const nodes = Number.isFinite(meta.nodeBudget) ? Number(meta.nodeBudget) : 'n/a';
        const timeMs = Number.isFinite(meta.timeBudgetMs) ? Number(meta.timeBudgetMs) : 'n/a';
        const endgame = meta.endgameMode === true;
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey} ${phaseLabel}: depth=${depth} branch=${branch} nodes=${nodes} timeMs=${timeMs} endgame=${endgame}`
        );
    };
}

function buildLv6LookaheadOptions(level, board, legalMovesCount, playerKey) {
    if (!Number.isFinite(level) || level < 6) return {};
    const empties = countBoardEmpties(board);
    const moves = Math.max(1, Number(legalMovesCount) || 1);
    const totalCells = Array.isArray(board)
        ? board.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0)
        : 0;
    const safeTotalCells = totalCells > 0 ? totalCells : 64;
    const occupiedRatio = Math.max(0, Math.min(1, 1 - (empties / safeTotalCells)));
    const sizeScale = Math.max(0.75, Math.min(1.8, Math.sqrt(safeTotalCells / 64)));
    const movePressure = Math.max(0.9, Math.min(1.5, (moves / 8)));
    const browserProfile = resolveCpuLv6BrowserProfile();
    const stageConfig = browserProfile && browserProfile.lookaheadStages && typeof browserProfile.lookaheadStages === 'object'
        ? browserProfile.lookaheadStages
        : null;
    const openingStage = stageConfig && stageConfig.opening ? stageConfig.opening : null;
    const midStage = stageConfig && stageConfig.mid ? stageConfig.mid : null;
    const endStage = stageConfig && stageConfig.end ? stageConfig.end : null;
    const selectedStage = (
        openingStage && occupiedRatio < Number(openingStage.maxOccupiedRatio)
    )
        ? openingStage
        : (
            midStage && occupiedRatio < Number(midStage.maxOccupiedRatio)
                ? midStage
                : endStage
        );
    const lowBranch = moves <= 4;
    let depth = Number(selectedStage && selectedStage.depth);
    if (!Number.isFinite(depth) || depth <= 0) {
        depth = occupiedRatio < 0.28 ? 4 : (occupiedRatio < 0.62 ? 5 : 6);
    }
    if (lowBranch) depth += 1;
    const maxBranchBase = Number(selectedStage && selectedStage.maxBranch);
    const maxBranch = Math.min(
        Number.isFinite(maxBranchBase) && maxBranchBase > 0 ? maxBranchBase : (occupiedRatio < 0.28 ? 6 : (occupiedRatio < 0.62 ? 7 : 8)),
        moves
    );
    const nodeBudgetBase = Number(selectedStage && selectedStage.nodeBudgetBase);
    const resolvedNodeBudgetBase = Number.isFinite(nodeBudgetBase) && nodeBudgetBase > 0
        ? nodeBudgetBase
        : (occupiedRatio < 0.28 ? 900_000 : (occupiedRatio < 0.62 ? 1_500_000 : 2_200_000));
    const maxTimeBase = Number(selectedStage && selectedStage.maxTimeBaseMs);
    const resolvedMaxTimeBase = Number.isFinite(maxTimeBase) && maxTimeBase > 0
        ? maxTimeBase
        : (occupiedRatio < 0.28 ? 900 : (occupiedRatio < 0.62 ? 1_100 : 1_500));
    const nodeBudget = Math.floor(resolvedNodeBudgetBase * sizeScale);
    const timeCaps = resolveLv6LookaheadTimeCaps(playerKey);
    const maxTimeMs = Math.min(
        Math.floor(resolvedMaxTimeBase * sizeScale * movePressure),
        timeCaps.moveCapMs
    );
    const endgameConfig = browserProfile && browserProfile.endgameLookahead && typeof browserProfile.endgameLookahead === 'object'
        ? browserProfile.endgameLookahead
        : null;
    const endgameSolveEmpties = occupiedRatio < 0.55
        ? Number(endgameConfig && endgameConfig.solveEmptiesOpeningMid) || 16
        : Number(endgameConfig && endgameConfig.solveEmptiesEnd) || 20;
    const endgameDepth = occupiedRatio < 0.55
        ? Number(endgameConfig && endgameConfig.depthOpeningMid) || 12
        : Number(endgameConfig && endgameConfig.depthEnd) || 16;
    const endgameNodeBudgetBase = Number(endgameConfig && endgameConfig.nodeBudgetBase);
    const endgameMaxTimeBase = Number(endgameConfig && endgameConfig.maxTimeBaseMs);

    return {
        depth,
        maxBranch,
        nodeBudget,
        maxTimeMs,
        endgameSolveEmpties,
        endgameDepth,
        endgameNodeBudget: Math.floor((Number.isFinite(endgameNodeBudgetBase) && endgameNodeBudgetBase > 0 ? endgameNodeBudgetBase : 64_000_000) * sizeScale),
        endgameMaxTimeMs: Math.min(
            Math.floor((Number.isFinite(endgameMaxTimeBase) && endgameMaxTimeBase > 0 ? endgameMaxTimeBase : 120_000) * sizeScale),
            timeCaps.endgameCapMs
        ),
    };
}

function selectMoveByLookahead(candidateMoves, playerKey, level, onnxSelectedMove) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.chooseMoveByLookahead !== 'function') return null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const board = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    if (!isPlayableBoard(board)) return null;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const priorScore = createLookaheadPriorScoreFn(playerKey, level, candidateMoves.length, onnxSelectedMove);
    const lv6Lookahead = buildLv6LookaheadOptions(level, board, candidateMoves.length, playerKey);
    const onSearchMeta = createLookaheadMetaLogger(playerKey, level, 'onnx-lookahead');
    const weightConfig = resolveCpuLv6LookaheadWeights();

    return CpuPolicyCore.chooseMoveByLookahead(candidateMoves, {
        board,
        playerValue,
        level,
        depth: lv6Lookahead.depth,
        maxBranch: lv6Lookahead.maxBranch,
        nodeBudget: lv6Lookahead.nodeBudget,
        scoreMove: priorScore,
        priorWeight: level >= 6 ? (Number(weightConfig && weightConfig.onnxRefinePriorWeight) || 66) : 82,
        searchWeight: level >= 6 ? (Number(weightConfig && weightConfig.searchWeight) || 1.8) : 1,
        endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
        endgameDepth: lv6Lookahead.endgameDepth || 16,
        endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
        maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
        endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600,
        onSearchMeta,
        boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
            ? cs.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
            ? cs.boardBonusConsumedByCell
            : null
    });
}

async function selectMoveFromOnnxPolicyAsync(candidateMoves, playerKey, level) {
    const runtime = resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    const board = getCurrentCpuBoard();
    if (!canUseStandardBoardCpuPolicy(board, 'onnx-move', playerKey, level)) return null;
    let prioritizedCandidateMoves = filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    if (Number.isFinite(level) && level >= 6) {
        prioritizedCandidateMoves = filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
    }
    const preGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
    if (preGate.shouldDegrade) {
        logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', preGate.reason);
        return null;
    }
    const budgetMs = resolveCpuLv6OnnxRuntimeBudgetMs(level, 'chooseMove');
    try {
        const handCardIds = getHandCardIdsForPlayer(playerKey);
        const selected = await awaitCpuPromiseWithinBudget(
            () => runtime.chooseMove(
                prioritizedCandidateMoves,
                buildOnnxContext(playerKey, level, prioritizedCandidateMoves.length, handCardIds, null)
            ),
            budgetMs,
            CPU_ONNX_BUDGET_TIMEOUT
        );
        if (selected === CPU_ONNX_BUDGET_TIMEOUT) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', `timeout budget=${budgetMs}ms`);
            return null;
        }
        const postGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
        if (postGate.shouldDegrade) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', postGate.reason);
            return null;
        }
        const tactical = refineOnnxMoveByTacticalPlan(prioritizedCandidateMoves, selected, playerKey, level);
        if (!Number.isFinite(level) || level < 6) {
            return tactical;
        }
        const searched = selectMoveByLookahead(prioritizedCandidateMoves, playerKey, level, selected);
        if (!searched) return tactical;
        const resolved = resolveCandidateMoveByCoord(prioritizedCandidateMoves, searched) || searched;
        if (tactical && !isSameMoveByCoord(resolved, tactical)) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ONNX手を先読み補正 (${tactical.row},${tactical.col}) -> (${resolved.row},${resolved.col})`
            );
        }
        return resolved;
    } catch (e) {
        console.warn('[CPU] policy-onnx runtime failed, fallback to default policy', e);
        return null;
    }
}

function isSameMoveByCoord(a, b) {
    if (!a || !b) return false;
    return Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
}

function resolveCandidateMoveByCoord(candidateMoves, move) {
    if (!Array.isArray(candidateMoves) || !move) return null;
    for (const one of candidateMoves) {
        if (isSameMoveByCoord(one, move)) return one;
    }
    return null;
}

function refineOnnxMoveByTacticalPlan(candidateMoves, selectedMove, playerKey, level) {
    if (!selectedMove) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1) return selectedMove;
    if (!Number.isFinite(level) || level < 6) return selectedMove;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') return selectedMove;

    const context = buildMovePlanContext(playerKey, level, candidateMoves);
    if (!context) return resolveCandidateMoveByCoord(candidateMoves, selectedMove) || selectedMove;

    const selected = resolveCandidateMoveByCoord(candidateMoves, selectedMove) || selectedMove;
    let selectedScore = Number.NEGATIVE_INFINITY;
    try {
        selectedScore = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(selected, context) || 0);
    } catch (e) {
        selectedScore = Number.NEGATIVE_INFINITY;
    }

    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const move of candidateMoves) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            score = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, context) || 0);
        } catch (e) {
            score = Number.NEGATIVE_INFINITY;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
            continue;
        }
        if (score === bestScore && bestMove) {
            const bestRow = Number(bestMove.row);
            const bestCol = Number(bestMove.col);
            const row = Number(move.row);
            const col = Number(move.col);
            if (row < bestRow || (row === bestRow && col < bestCol)) {
                bestMove = move;
            }
        }
    }
    if (!bestMove) return selected;
    if (isSameMoveByCoord(bestMove, selected)) return selected;

    const gap = bestScore - selectedScore;
    const boardRef = context && Array.isArray(context.board) ? context.board : null;
    const selectedCorner = isCornerCell(selected.row, selected.col, boardRef);
    const bestCorner = isCornerCell(bestMove.row, bestMove.col, boardRef);
    const selectedEdge = !selectedCorner && isEdgeCell(selected.row, selected.col, boardRef);
    const bestEdge = !bestCorner && isEdgeCell(bestMove.row, bestMove.col, boardRef);
    const playerValue = Number(context && context.playerValue);
    const cornerStats = Number.isFinite(playerValue)
        ? countCornerControl(boardRef, playerValue)
        : { ownCorners: 0, oppCorners: 0 };
    const cornerLead = Number(cornerStats.ownCorners || 0) - Number(cornerStats.oppCorners || 0);

    const cornerOverride = bestCorner && !selectedCorner;
    const edgeConsolidationOverride = bestEdge && !selectedEdge && cornerLead > 0 && gap >= 180;
    const tacticalOverride = gap >= 700;
    if (cornerOverride || edgeConsolidationOverride || tacticalOverride) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: ONNX手を戦術補正 (${selected.row},${selected.col}) -> (${bestMove.row},${bestMove.col}) gap=${Number.isFinite(gap) ? gap.toFixed(1) : 'NA'}`
        );
        return bestMove;
    }
    return selected;
}

function canRerankOnnxCardChoice(level, usableCardIds) {
    if (!Number.isFinite(level) || level < 6) return false;
    if (!Array.isArray(usableCardIds) || usableCardIds.length <= 1) return false;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') return false;
    if (typeof CardLogic === 'undefined' || !CardLogic) return false;
    if (typeof CardLogic.getCardCost !== 'function' || typeof CardLogic.getCardDef !== 'function') return false;
    return true;
}

function scoreCardForOnnxRerank(cardId, playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext) {
    if (!cardId) return Number.NEGATIVE_INFINITY;
    if (!canRerankOnnxCardChoice(level, usableCardIds)) return Number.NEGATIVE_INFINITY;

    const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
    const decision = CpuPolicyCore.scoreCardUseDecision(
        cardId,
        CardLogic.getCardCost,
        CardLogic.getCardDef,
        context
    );
    if (!decision || !Number.isFinite(decision.score)) return Number.NEGATIVE_INFINITY;

    const cardDef = CardLogic.getCardDef(cardId);
    const cardType = resolveCardType(cardId, cardDef);
    const whiteLv6Mode = level >= 6 && playerKey === 'white';
    let score = Number(decision.score);

    if (context && context.cornerEmergency === true && isRecoveryCardType(cardType)) score += 16;
    if (context && context.hasCornerMoveNow === true && isHoldCardType(cardType)) score += 14;
    if (context && context.cornerHoldMode === true && isHoldCardType(cardType)) score += 8;
    if (context && context.recoveryCostGap > 0 && isChargeRampCardType(cardType)) score += 9;
    if (context && context.highBonusMoveAvailable === true && isChargeRampCardType(cardType)) score += 6;
    if (context && context.hasCornerMoveNow === true && !isHoldCardType(cardType) && !isRecoveryCardType(cardType)) score -= 10;
    if (
        whiteLv6Mode &&
        context &&
        context.recoveryCostGap > 0 &&
        !isChargeRampCardType(cardType) &&
        !isRecoveryCardType(cardType) &&
        !isHoldCardType(cardType)
    ) {
        score -= 18;
    }
    if (
        whiteLv6Mode &&
        context &&
        context.cornerEmergency !== true &&
        context.hasCornerMoveNow !== true &&
        WHITE_LV6_CORNER_SWING_KEEP_TYPES.has(cardType)
    ) {
        score -= 28;
    }
    if (
        whiteLv6Mode &&
        context &&
        context.cornerEmergency === true &&
        WHITE_LV6_CORNER_SWING_KEEP_TYPES.has(cardType)
    ) {
        score += 20;
    }

    return score;
}

function rerankOnnxCardChoice(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usableCardIds) {
    if (!selectedCardId) return { cardId: selectedCardId, changed: false, gap: 0 };
    if (!canRerankOnnxCardChoice(level, usableCardIds)) {
        return { cardId: selectedCardId, changed: false, gap: 0 };
    }

    const context = buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
    const usable = usableCardIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (usable.length <= 1) return { cardId: selectedCardId, changed: false, gap: 0 };

    let bestCardId = selectedCardId;
    let bestScore = scoreCardForOnnxRerank(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usable, context);

    for (const cardId of usable) {
        const score = scoreCardForOnnxRerank(cardId, playerKey, level, legalMovesCount, legalMoves, usable, context);
        if (!Number.isFinite(score)) continue;
        if (!Number.isFinite(bestScore) || score > bestScore) {
            bestScore = score;
            bestCardId = cardId;
            continue;
        }
        if (score === bestScore && String(cardId) < String(bestCardId)) {
            bestCardId = cardId;
        }
    }

    const selectedScore = scoreCardForOnnxRerank(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usable, context);
    const gap = Number.isFinite(bestScore) && Number.isFinite(selectedScore)
        ? (bestScore - selectedScore)
        : Number.POSITIVE_INFINITY;
    const overrideThreshold = (context && (context.cornerEmergency === true || context.hasCornerMoveNow === true)) ? 6 : 12;
    const shouldOverride = bestCardId !== selectedCardId && (gap >= overrideThreshold || !Number.isFinite(selectedScore));

    return {
        cardId: shouldOverride ? bestCardId : selectedCardId,
        changed: shouldOverride,
        gap
    };
}

async function selectCardFromOnnxPolicyAsync(playerKey, level, legalMovesCount, usableCardIds, legalMoves) {
    const runtime = resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseCard !== 'function') return null;
    if (!canUseStandardBoardCpuPolicy(null, 'onnx-card', playerKey, level)) return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    const filteredUsableCardIds = usableCardIds.slice();
    if (filteredUsableCardIds.length === 0) return null;
    const preGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseCard', level);
    if (preGate.shouldDegrade) {
        logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', preGate.reason);
        return null;
    }
    const budgetMs = resolveCpuLv6OnnxRuntimeBudgetMs(level, 'chooseCard');
    try {
        const handCardIds = getHandCardIdsForPlayer(playerKey);
        const selectedCardId = await awaitCpuPromiseWithinBudget(
            () => runtime.chooseCard(
                filteredUsableCardIds,
                buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, filteredUsableCardIds, legalMoves)
            ),
            budgetMs,
            CPU_ONNX_BUDGET_TIMEOUT
        );
        if (selectedCardId === CPU_ONNX_BUDGET_TIMEOUT) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', `timeout budget=${budgetMs}ms`);
            return null;
        }
        const postGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseCard', level);
        if (postGate.shouldDegrade) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', postGate.reason);
            return null;
        }
        if (!selectedCardId) {
            // ONNX model can explicitly choose "hold card" via no-card head output.
            if (typeof runtime.getStatus === 'function') {
                const status = runtime.getStatus() || {};
                if (status.loaded === true && status.hasCardHead === true && status.noCardSupported === true && !status.lastError) {
                    return { hold: true };
                }
            }
            return null;
        }
        const reranked = rerankOnnxCardChoice(
            selectedCardId,
            playerKey,
            level,
            legalMovesCount,
            legalMoves,
            filteredUsableCardIds
        );
        const resolvedCardId = reranked && reranked.cardId ? reranked.cardId : selectedCardId;
        if (reranked && reranked.changed) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ONNXカードを再評価 ${selectedCardId} -> ${resolvedCardId} gap=${Number.isFinite(reranked.gap) ? reranked.gap.toFixed(1) : 'NA'}`
            );
        }
        const cardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(resolvedCardId)
            : null;
        return { cardId: resolvedCardId, cardDef };
    } catch (e) {
        console.warn('[CPU] policy-onnx card runtime failed, fallback to default policy', e);
        return null;
    }
}

function selectCardFromLearnedPolicy(playerKey, level, legalMovesCount, usableCardIds) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScoreForKey !== 'function') return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    const boardRef = getCurrentCpuBoard();
    if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-card', playerKey, level)) return null;

    let bestCardId = null;
    let bestScore = -Infinity;
    for (const cardId of usableCardIds) {
        const actionKey = `use_card:${cardId}`;
        let score = null;
        try {
            score = runtime.getActionScoreForKey(actionKey, {
                playerKey,
                level,
                board: boardRef,
                pendingType: resolvePendingType(playerKey),
                legalMovesCount
            });
        } catch (e) { score = null; }
        if (!Number.isFinite(score)) continue;
        if (score > bestScore) {
            bestScore = score;
            bestCardId = cardId;
        }
    }
    if (!bestCardId) return null;
    const cardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? CardLogic.getCardDef(bestCardId)
        : null;
    return { cardId: bestCardId, cardDef };
}

function shouldUseSharedPolicyTableCoreCardDecision(level) {
    if (!Number.isFinite(level) || level < 6) return false;
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability) return capability.usesPolicyTableCoreCardDecision === true;
    const browserProfile = resolveCpuLv6BrowserProfile();
    return !!(browserProfile && browserProfile.cardDecisionMode === 'policy-table-core');
}

function createCardChoiceFromId(cardId) {
    if (!cardId) return null;
    const cardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? CardLogic.getCardDef(cardId)
        : null;
    return { cardId, cardDef };
}

function selectCardBySharedPolicyTableCore(playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext) {
    if (!Array.isArray(usableCardIds) || usableCardIds.length <= 0) return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;

    const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
    const learnedChoice = selectCardFromLearnedPolicy(playerKey, level, legalMovesCount, usableCardIds);
    if (learnedChoice && learnedChoice.cardId) {
        if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') return learnedChoice;
        const score = CpuPolicyCore.scoreCardUseDecision(
            learnedChoice.cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!score || score.shouldUse === true) {
            return learnedChoice;
        }
    }

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
        const selected = CpuPolicyCore.chooseCardWithRiskProfile(
            usableCardIds,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (selected && selected.cardId) return selected;
    }

    const usableSortedByCost = usableCardIds.slice().sort((a, b) => CardLogic.getCardCost(b) - CardLogic.getCardCost(a));
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') {
        return createCardChoiceFromId(usableSortedByCost[0] || null);
    }
    for (const cardId of usableSortedByCost) {
        const score = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!score || score.shouldUse === true) {
            return createCardChoiceFromId(cardId);
        }
    }
    return null;
}

function getLearnedCardActionScore(cardId, playerKey, level, legalMovesCount) {
    if (!cardId) return null;
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScoreForKey !== 'function') return null;
    try {
        const boardRef = getCurrentCpuBoard();
        if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-card-score', playerKey, level)) return null;
        const score = runtime.getActionScoreForKey(`use_card:${cardId}`, {
            playerKey,
            level,
            board: boardRef,
            pendingType: resolvePendingType(playerKey),
            legalMovesCount
        });
        return Number.isFinite(score) ? Number(score) : null;
    } catch (e) {
        return null;
    }
}

function selectCardByLevel6Consensus(playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext) {
    if (!Number.isFinite(level) || level < 6) return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length <= 0) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;
    if (typeof CardLogic.getCardCost !== 'function' || typeof CardLogic.getCardDef !== 'function') return null;

    const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
    const usable = usableCardIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (usable.length <= 0) return null;

    let best = null;
    let second = null;
    for (const cardId of usable) {
        const decision = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!decision || !Number.isFinite(decision.score)) continue;

        const learnedRaw = getLearnedCardActionScore(cardId, playerKey, level, legalMovesCount);
        const learnedBoost = Number.isFinite(learnedRaw)
            ? (Math.sign(learnedRaw) * Math.log1p(Math.abs(learnedRaw)) * 20)
            : 0;
        const score = Number(decision.score) + learnedBoost;
        const one = { cardId, score, decision };
        if (!best || score > best.score || (score === best.score && String(cardId) < String(best.cardId))) {
            second = best;
            best = one;
        } else if (!second || score > second.score || (score === second.score && String(cardId) < String(second.cardId))) {
            second = one;
        }
    }

    if (!best) return null;
    if (best.decision.shouldUse !== true) return null;

    const stableState = !!context && context.forceUseCard !== true &&
        context.cornerEmergency !== true &&
        Number(context.discDiff || 0) >= 10 &&
        Number(context.handSize || 0) <= 2 &&
        Number(context.ownCharge || 0) <= 18 &&
        Number(context.legalMovesCount || legalMovesCount || 0) >= 5;
    if (stableState) {
        if (!isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, best.cardId, context)) {
            return null;
        }
        const gap = second && Number.isFinite(second.score)
            ? (best.score - second.score)
            : Number.POSITIVE_INFINITY;
        if (Number.isFinite(gap) && gap < 8 && context.hasCornerMoveNow === true) {
            return null;
        }
    }

    const cardDef = CardLogic.getCardDef(best.cardId);
    return { cardId: best.cardId, cardDef };
}

function emitPresentationEventForCpu(ev) {
    try {
        if (typeof require === 'function') {
            const pres = require('./logic/presentation');
            if (pres && typeof pres.emitPresentationEvent === 'function') {
                return !!pres.emitPresentationEvent(cardState, ev);
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof BoardOps !== 'undefined' && BoardOps && typeof BoardOps.emitPresentationEvent === 'function') {
            BoardOps.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof PresentationHelper !== 'undefined' && PresentationHelper && typeof PresentationHelper.emitPresentationEvent === 'function') {
            PresentationHelper.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        // Last-resort persistence so PresentationHandler can consume on next BOARD_UPDATED.
        if (cardState && typeof cardState === 'object') {
            if (!Array.isArray(cardState._presentationEventsPersist)) {
                cardState._presentationEventsPersist = [];
            }
            cardState._presentationEventsPersist.push(ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuSelectionStateChange() {
    if (typeof emitCardStateChange === 'function') emitCardStateChange();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    if (typeof emitGameStateChange === 'function') emitGameStateChange();
}

function isSelectionOnlyEndTurnPendingType(pendingType) {
    const pendingSelectionFlow = resolvePendingSelectionFlow('isSelectionOnlyEndTurnPendingType');
    return !!(
        pendingSelectionFlow
        && typeof pendingSelectionFlow.isSelectionOnlyEndTurnPendingType === 'function'
        && pendingSelectionFlow.isSelectionOnlyEndTurnPendingType(pendingType)
    );
}

function resolvePlayerKeyFromTurnValue(value) {
    if (value === 'black' || value === 1 || value === '1' || (typeof BLACK !== 'undefined' && value === BLACK)) return 'black';
    if (value === 'white' || value === -1 || value === '-1' || (typeof WHITE !== 'undefined' && value === WHITE)) return 'white';
    return null;
}

function handOffSelectionTurnInGameState(playerKey) {
    if (!gameState) return false;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const turnNumberBeforeSelection = Number(gameState.turnNumber || 0);
    if (
        gameState.currentPlayer === 1 ||
        gameState.currentPlayer === -1 ||
        gameState.currentPlayer === '1' ||
        gameState.currentPlayer === '-1'
    ) {
        gameState.currentPlayer = opponentKey === 'black' ? 1 : -1;
    } else {
        gameState.currentPlayer = opponentKey;
    }
    gameState.consecutivePasses = 0;
    gameState.turnNumber = turnNumberBeforeSelection + 1;
    return true;
}

function captureNetworkPublishSnapshot(gameStateValue, cardStateValue) {
    if (cpuDecisionNetworkTurnHandoff && typeof cpuDecisionNetworkTurnHandoff.captureNetworkPublishSnapshot === 'function') {
        return cpuDecisionNetworkTurnHandoff.captureNetworkPublishSnapshot(gameStateValue, cardStateValue);
    }
    if (!gameStateValue || !cardStateValue) return null;
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
            return {
                gameState: globalThis.structuredClone(gameStateValue),
                cardState: globalThis.structuredClone(cardStateValue)
            };
        }
    } catch (e) { /* ignore */ }

    try {
        return {
            gameState: JSON.parse(JSON.stringify(gameStateValue)),
            cardState: JSON.parse(JSON.stringify(cardStateValue))
        };
    } catch (e) {
        return null;
    }
}

function publishCpuSelectionNetworkSnapshot(playerKey, action, playbackEvents, snapshotOverride) {
    if (cpuDecisionNetworkTurnHandoff && typeof cpuDecisionNetworkTurnHandoff.publishNetworkSnapshot === 'function') {
        const meta = {
            playerKey: playerKey || 'black',
            actionType: 'place',
            playbackEvents: Array.isArray(playbackEvents) ? playbackEvents : []
        };
        if (action && typeof action === 'object') meta.action = action;
        if (snapshotOverride) meta.snapshot = snapshotOverride;
        return cpuDecisionNetworkTurnHandoff.publishNetworkSnapshot(meta);
    }
    try {
        if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return;
        if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return;
        if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) return;
        const meta = {
            playerKey: playerKey || 'black',
            actionType: 'place',
            playbackEvents: Array.isArray(playbackEvents) ? playbackEvents : []
        };
        if (action && typeof action === 'object') meta.action = action;
        if (snapshotOverride) meta.snapshot = snapshotOverride;
        globalThis.NetworkMatchClient.publishSnapshot(meta);
    } catch (e) { /* ignore */ }
}

function isCpuSelectionHumanVsHumanModeEnabled() {
    const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

async function waitForCpuSelectionPlaybackIdle(playbackEvents) {
    if (cpuDecisionNetworkTurnHandoff && typeof cpuDecisionNetworkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
        return cpuDecisionNetworkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
    }
    if (!Array.isArray(playbackEvents) || !playbackEvents.length) return;

    const waitForPlaybackFn = (typeof waitForPlaybackIdle === 'function')
        ? waitForPlaybackIdle
        : ((typeof globalThis !== 'undefined' && typeof globalThis.waitForPlaybackIdle === 'function')
            ? globalThis.waitForPlaybackIdle
            : null);

    if (typeof waitForPlaybackFn !== 'function') return;

    try {
        await waitForPlaybackFn();
    } catch (e) { /* ignore */ }
}

function scheduleCpuSelectionWhiteTurn(delayMs, expectedTurnNumber) {
    const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
    const tid = setTimeout(() => {
        const activePlayerKey = resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
        const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
        if (activePlayerKey !== 'white') return;
        if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
        if (typeof processCpuTurn === 'function') processCpuTurn();
    }, safeDelay);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

async function continueCpuSelectionTurnHandoff(playerKey, playbackEvents, action) {
    const finalizeTurn = (cpuDecisionNetworkTurnHandoff && typeof cpuDecisionNetworkTurnHandoff.finalizeNetworkTurnHandoff === 'function')
        ? cpuDecisionNetworkTurnHandoff.finalizeNetworkTurnHandoff
        : null;
    if (!finalizeTurn) return;

    await finalizeTurn({
        playerKey,
        actionType: 'place',
        action,
        playbackEvents,
        humanMode: isCpuSelectionHumanVsHumanModeEnabled(),
        publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }) => {
            publishCpuSelectionNetworkSnapshot(publishPlayerKey, publishAction || action, publishPlaybackEvents);
        },
        resolveCurrentPlayerKey: () => resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null),
        scheduleCpuTurn: ({ delayMs, expectedTurnNumber }) => {
            scheduleCpuSelectionWhiteTurn(delayMs, expectedTurnNumber);
        },
        onHumanTurnReady: () => {
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        }
    });
}

function maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, playbackEvents, action) {
    if (!isSelectionOnlyEndTurnPendingType(pendingType)) return;
    const activePlayerKey = resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
    if (!activePlayerKey || activePlayerKey === playerKey) return;
    Promise.resolve(continueCpuSelectionTurnHandoff(playerKey, playbackEvents, action)).catch(() => {
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    });
}

function finalizeCpuPendingSelectionFlow(playerKey, pendingType, playbackEvents, action) {
    const normalizedPlaybackEvents = Array.isArray(playbackEvents) ? playbackEvents : [];
    const pendingSelectionFlow = resolvePendingSelectionFlow('finalizePendingSelectionFlow');

    if (pendingSelectionFlow && typeof pendingSelectionFlow.finalizePendingSelectionFlow === 'function') {
        return Promise.resolve(pendingSelectionFlow.finalizePendingSelectionFlow({
            playerKey,
            pendingType,
            action,
            playbackEvents: normalizedPlaybackEvents,
            gameStateValue: gameState,
            cardStateValue: cardState,
            onHumanTurnReady: () => {
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            },
            onSettled: () => {
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            }
        })).catch(() => {
            if (isSelectionOnlyEndTurnPendingType(pendingType)) {
                maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
                return;
            }

            Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
                try {
                    if (typeof globalThis !== 'undefined' && globalThis.NetworkMatchClient && typeof globalThis.NetworkMatchClient.publishSnapshot === 'function') {
                        const meta = {
                            playerKey: playerKey || 'black',
                            actionType: 'place',
                            playbackEvents: normalizedPlaybackEvents
                        };
                        if (action) meta.action = action;
                        globalThis.NetworkMatchClient.publishSnapshot(meta);
                        return;
                    }
                } catch (e) { /* ignore */ }
                publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
            }).catch(() => { /* ignore */ });
        });
    }

    if (isSelectionOnlyEndTurnPendingType(pendingType)) {
        maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
        return Promise.resolve();
    }

    return Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkMatchClient && typeof globalThis.NetworkMatchClient.publishSnapshot === 'function') {
                const meta = {
                    playerKey: playerKey || 'black',
                    actionType: 'place',
                    playbackEvents: normalizedPlaybackEvents
                };
                if (action) meta.action = action;
                globalThis.NetworkMatchClient.publishSnapshot(meta);
                return;
            }
        } catch (e) { /* ignore */ }
        publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
    }).catch(() => { /* ignore */ });
}

function resolveTurnPipelineAdapter() {
    return resolveModuleReference(null, {
        readLocal: () => (typeof TurnPipelineUIAdapter !== 'undefined' ? TurnPipelineUIAdapter : null),
        requirePath: './turn/pipeline_ui_adapter',
        globalKey: 'TurnPipelineUIAdapter',
        isValid: (moduleRef) => !!moduleRef
    });
}

function resolveTurnPipeline() {
    return resolveModuleReference(null, {
        readLocal: () => (typeof TurnPipeline !== 'undefined' ? TurnPipeline : null),
        requirePath: './turn/turn_pipeline',
        globalKey: 'TurnPipeline',
        isValid: (moduleRef) => !!moduleRef
    });
}

async function runCpuPendingSelectionViaPipeline(playerKey, actionPayload, pendingType) {
    const adapter = resolveTurnPipelineAdapter();
    const pipeline = resolveTurnPipeline();
    const pendingSelectionFlow = resolvePendingSelectionFlow('createPendingSelectionAction');
    if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

    const normalizedActionPayload = Object.assign({}, actionPayload || {});
    normalizedActionPayload.deferNetworkPublish = true;

    const action = (pendingSelectionFlow && typeof pendingSelectionFlow.createPendingSelectionAction === 'function')
        ? pendingSelectionFlow.createPendingSelectionAction(playerKey, pendingType, normalizedActionPayload, { cardState })
        : ((typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, normalizedActionPayload)
            : Object.assign({ type: 'place' }, normalizedActionPayload));
    if (action) {
        action.deferNetworkPublish = true;
    }
    if ((!pendingSelectionFlow || typeof pendingSelectionFlow.createPendingSelectionAction !== 'function') && action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
    if (!res || res.ok === false) {
        return { ok: false, res };
    }

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;
    if (res.playbackEvents && res.playbackEvents.length) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: res.playbackEvents,
            meta: { source: 'cpu_pending_selection', pendingType: pendingType || null }
        });
    }
    emitCpuSelectionStateChange();
    await finalizeCpuPendingSelectionFlow(playerKey, pendingType, res.playbackEvents, action);
    return { ok: true, res };
}

function resolveAppliedCardMeta(playerKey, fallbackCardId, fallbackCardDef) {
    const appliedCardId = (cardState && cardState.lastUsedCardByPlayer && cardState.lastUsedCardByPlayer[playerKey])
        ? cardState.lastUsedCardByPlayer[playerKey]
        : fallbackCardId;
    const appliedCardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? (CardLogic.getCardDef(appliedCardId) || fallbackCardDef || null)
        : (fallbackCardDef || null);
    const appliedCardCost = (appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null;
    const appliedCardName = (appliedCardDef && appliedCardDef.name) ? appliedCardDef.name : null;
    return { appliedCardId, appliedCardDef, appliedCardCost, appliedCardName };
}

function normalizeCardUsePlaybackEvents(playbackEvents, playerKey, cardMeta) {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    const meta = cardMeta || {};
    return events.map((ev) => {
        if (!ev || ev.type !== 'card_use_animation') return ev;
        const targets = Array.isArray(ev.targets) ? ev.targets : [];
        const normalizedTargets = targets.length > 0
            ? targets.map((t) => Object.assign({}, t, {
                cardId: meta.appliedCardId,
                cost: meta.appliedCardCost,
                name: meta.appliedCardName
            }))
            : [{
                player: playerKey,
                owner: playerKey,
                cardId: meta.appliedCardId,
                cost: meta.appliedCardCost,
                name: meta.appliedCardName
            }];
        return Object.assign({}, ev, { targets: normalizedTargets });
    });
}

function emitCpuCardUseLog(playerKey, level, cardDefOrNull, cardIdOrNull) {
    const shownName = cardDefOrNull ? cardDefOrNull.name : cardIdOrNull;
    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用 - ${shownName}`);
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})がカードを使用: ${shownName}`);
    }
}

function runCpuCardUseViaPipeline(playerKey, cardId, cardDef) {
    const adapter = resolveTurnPipelineAdapter();
    const pipeline = resolveTurnPipeline();
    if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

    const actionPayload = {
        useCardId: cardId,
        useCardOwnerKey: playerKey
    };
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('use_card', playerKey, actionPayload)
        : Object.assign({ type: 'use_card' }, actionPayload);

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
    if (!res || res.ok === false) {
        return { ok: false, res };
    }

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;

    const cardMeta = resolveAppliedCardMeta(playerKey, cardId, cardDef);

    let emittedCardUsePlayback = false;
    if (res.playbackEvents && res.playbackEvents.length) {
        const normalizedPlaybackEvents = normalizeCardUsePlaybackEvents(res.playbackEvents, playerKey, cardMeta);
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: normalizedPlaybackEvents,
            meta: { source: 'cpu_card_use_pipeline', cardId: cardMeta.appliedCardId || null }
        });
        emittedCardUsePlayback = true;
    }

    if (!emittedCardUsePlayback) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: [{
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardMeta.appliedCardId,
                    cost: cardMeta.appliedCardCost,
                    name: cardMeta.appliedCardName
                }]
            }],
            meta: { source: 'cpu_card_use_pipeline_fallback' }
        });
    }

    emitCpuSelectionStateChange();
    return {
        ok: true,
        res,
        emittedCardUsePlayback,
        appliedCardId: cardMeta.appliedCardId,
        appliedCardDef: cardMeta.appliedCardDef,
        appliedCardCost: cardMeta.appliedCardCost,
        appliedCardName: cardMeta.appliedCardName
    };
}

function runCpuHandDestroyViaPipeline(playerKey, destroyCardId) {
    const adapter = resolveTurnPipelineAdapter();
    const pipeline = resolveTurnPipeline();
    if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

    const actionPayload = { destroyCardId };
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('destroy_hand_card', playerKey, actionPayload)
        : Object.assign({ type: 'destroy_hand_card' }, actionPayload);

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
    if (!res || res.ok === false) {
        return { ok: false, res };
    }

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;
    emitCpuSelectionStateChange();
    return {
        ok: true,
        res
    };
}

function emitCpuEffectLog(message) {
    if (!message) return;
    if (typeof emitEffectLog === 'function') {
        emitEffectLog(message);
        return;
    }
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(message, 'effect');
    }
}

function getTargetAwareUsableCardIds(playerKey) {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return [];
    if (!cs || !gs) return [];
    if (typeof CardLogic.getUsableCardIds === 'function') {
        try {
            return CardLogic.getUsableCardIds(cs, gs, playerKey) || [];
        } catch (e) { /* ignore */ }
    }
    if (typeof CardLogic.hasUsableCard === 'function' && CardLogic.hasUsableCard(cs, gs, playerKey)) {
        // Fallback when only boolean API is available.
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        return hand.slice();
    }
    if (typeof CardLogic.canUseCard === 'function') {
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        return hand.filter((id) => {
            try { return !!CardLogic.canUseCard(cs, playerKey, id); } catch (e) { return false; }
        });
    }
    return [];
}

function makePlanPressureProfile(basePressure, cornerWindowPressure, recoveryGapPressure, recoveryEmergencyPressure) {
    return Object.freeze({
        basePressure: Math.max(0, Number(basePressure) || 0),
        cornerWindowPressure: Math.max(0, Number(cornerWindowPressure) || 0),
        recoveryGapPressure: Math.max(0, Number(recoveryGapPressure) || 0),
        recoveryEmergencyPressure: Math.max(0, Number(recoveryEmergencyPressure) || 0)
    });
}

const GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE = Object.freeze({
    DOUBLE_PLACE: makePlanPressureProfile(2, 4, 2, 3),
    TRIPLE_PLACE: makePlanPressureProfile(3, 5, 3, 4),
    QUAD_PLACE: makePlanPressureProfile(4, 6, 4, 5),
    INFINITE_PLACE: makePlanPressureProfile(5, 7, 5, 6)
});

const CARD_TYPE_PLAN_PRESSURE_PROFILE = Object.freeze({
    BLOCKADE_WILL: makePlanPressureProfile(1, 2, 1, 1),
    BOARD_EXPANSION_GOD: makePlanPressureProfile(3, 4, 3, 4),
    BOARD_EXPANSION_WILL: makePlanPressureProfile(2, 3, 2, 3),
    BOARD_SHRINK_WILL: makePlanPressureProfile(3, 4, 3, 2),
    BOARD_SHRINK_GOD: makePlanPressureProfile(4, 5, 4, 3),
    BREEDING_WILL: makePlanPressureProfile(2, 2, 2, 3),
    PROLIFERATION_WILL: makePlanPressureProfile(1, 2, 1, 2),
    CHAIN_WILL: makePlanPressureProfile(2, 4, 2, 3),
    DOUBLE_CHAIN_WILL: makePlanPressureProfile(2, 4, 2, 3),
    TRIPLE_CHAIN_WILL: makePlanPressureProfile(3, 5, 3, 4),
    QUAD_CHAIN_WILL: makePlanPressureProfile(4, 6, 4, 5),
    INFINITE_CHAIN_WILL: makePlanPressureProfile(5, 7, 5, 6),
    CLONE_WILL: makePlanPressureProfile(2, 2, 2, 3),
    CONDEMN_WILL: makePlanPressureProfile(1, 2, 1, 1),
    CORNER_TRIBUTE: makePlanPressureProfile(1, 3, 0, 2),
    CORROSION_WILL: makePlanPressureProfile(1, 2, 1, 1),
    CROSS_BOMB: makePlanPressureProfile(3, 4, 3, 3),
    DESTROY_DRAGON_WILL: makePlanPressureProfile(1, 2, 1, 2),
    DESTROY_ONE_STONE: makePlanPressureProfile(4, 5, 4, 0),
    DOUBLE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.DOUBLE_PLACE,
    TRIPLE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.TRIPLE_PLACE,
    QUAD_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.QUAD_PLACE,
    INFINITE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.INFINITE_PLACE,
    ESCAPE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    EXTEND_LIFE_WILL: makePlanPressureProfile(1, 1, 1, 2),
    EXTEND_LIFE_GOD: makePlanPressureProfile(1, 1, 1, 3),
    EXTREME_HYPERACTIVE_WILL: makePlanPressureProfile(3, 4, 3, 3),
    EQUALITY_WILL: makePlanPressureProfile(2, 3, 2, 2),
    REINFORCEMENT_WILL: makePlanPressureProfile(1, 2, 1, 2),
    FATE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    FREE_PLACEMENT: makePlanPressureProfile(2, 4, 2, 0),
    FREEZE_WILL: makePlanPressureProfile(1, 2, 1, 1),
    SEED_WILL: makePlanPressureProfile(2, 3, 1, 3),
    GLUTTONOUS_WILL: makePlanPressureProfile(3, 4, 3, 3),
    GOLD_STONE: makePlanPressureProfile(1, 2, 0, 2),
    CRYSTAL_STONE: makePlanPressureProfile(1, 2, 1, 2),
    RAINBOW_STONE: makePlanPressureProfile(1, 3, 0, 3),
    AFTERIMAGE_WILL: makePlanPressureProfile(0, 0, 0, 1),
    GUARDIAN_GOD: makePlanPressureProfile(0, 0, 0, 0),
    GUARD_WILL: makePlanPressureProfile(0, 0, 0, 0),
    GHOST_WILL: makePlanPressureProfile(0, 0, 0, 1),
    HEAVEN_BLESSING: makePlanPressureProfile(1, 2, 1, 2),
    REVEAL_HAND_WILL: makePlanPressureProfile(1, 2, 0, 1),
    HYPERACTIVE_INHERIT_WILL: makePlanPressureProfile(2, 2, 2, 3),
    HYPERACTIVE_WILL: makePlanPressureProfile(3, 3, 3, 3),
    INSTANT_HYPERACTIVE_WILL: makePlanPressureProfile(3, 4, 3, 4),
    LAST_RESORT: makePlanPressureProfile(3, 4, 3, 0),
    LIGHTNING_WILL: makePlanPressureProfile(1, 1, 1, 2),
    LIVING_WILL: makePlanPressureProfile(1, 2, 1, 3),
    LOSS_WILL: makePlanPressureProfile(1, 2, 1, 2),
    METEOR_WILL: makePlanPressureProfile(3, 4, 3, 2),
    OBSERVER_WILL: makePlanPressureProfile(1, 1, 1, 2),
    PERMA_PROTECT_NEXT_STONE: makePlanPressureProfile(0, 0, 0, 1),
    PLUNDER_WILL: makePlanPressureProfile(1, 2, 0, 2),
    POSITION_SWAP_WILL: makePlanPressureProfile(2, 3, 2, 2),
    PROTECTED_NEXT_STONE: makePlanPressureProfile(0, 0, 0, 1),
    REBUILD_WILL: makePlanPressureProfile(1, 2, 1, 2),
    REGEN_WILL: makePlanPressureProfile(0, 0, 0, 1),
    RIBO_WILL: makePlanPressureProfile(1, 2, 0, 2),
    ROBOT_VACUUM_WILL: makePlanPressureProfile(2, 2, 2, 3),
    SALVATION_WILL: makePlanPressureProfile(1, 2, 1, 2),
    SUPPLY_WILL: makePlanPressureProfile(1, 2, 0, 2),
    SILVER_STONE: makePlanPressureProfile(1, 2, 0, 2),
    SNIPER_WILL: makePlanPressureProfile(1, 1, 1, 2),
    SPLIT_WILL: makePlanPressureProfile(2, 2, 2, 3),
    STRONG_WIND_WILL: makePlanPressureProfile(2, 3, 2, 2),
    SUPER_BUOYANCY_WILL: makePlanPressureProfile(2, 4, 2, 0),
    SUPER_GRAVITY_WILL: makePlanPressureProfile(2, 4, 2, 0),
    SWAP_WITH_ENEMY: makePlanPressureProfile(2, 3, 2, 2),
    TABOO_REVERSE_WILL: makePlanPressureProfile(3, 4, 3, 2),
    TELEPORT_WILL: makePlanPressureProfile(2, 3, 2, 2),
    CELL_TELEPORT_WILL: makePlanPressureProfile(3, 4, 3, 2),
    TEMPT_WILL: makePlanPressureProfile(2, 3, 2, 2),
    CAPTURE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    TIME_BOMB: makePlanPressureProfile(3, 4, 3, 2),
    TIME_STOP_GOD: makePlanPressureProfile(3, 4, 3, 2),
    TRAP_WILL: makePlanPressureProfile(1, 2, 1, 2),
    TREASURE_BOX: makePlanPressureProfile(1, 2, 0, 2),
    ULTIMATE_DESTROY_GOD: makePlanPressureProfile(3, 4, 3, 2),
    ULTIMATE_HYPERACTIVE_GOD: makePlanPressureProfile(4, 5, 4, 3),
    ULTIMATE_REVERSE_DRAGON: makePlanPressureProfile(3, 4, 3, 3),
    WILL_HUNTER_KING: makePlanPressureProfile(3, 4, 3, 4),
    WORK_WILL: makePlanPressureProfile(1, 0, 1, 2),
    X_BOMB: makePlanPressureProfile(3, 4, 3, 3)
});

function getGeneratedThrowChainPlanPressureProfile(cardType) {
    const type = String(cardType || '');
    return Object.prototype.hasOwnProperty.call(GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE, type)
        ? GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE[type]
        : null;
}

function hasPlanPressureProfileForCardType(cardType) {
    const type = String(cardType || '');
    const hasDirectProfile = Object.prototype.hasOwnProperty.call(
        CARD_TYPE_PLAN_PRESSURE_PROFILE,
        type
    );
    return hasDirectProfile || !!getGeneratedThrowChainPlanPressureProfile(type);
}

function getCardPlanPressureProfile(cardType) {
    const type = String(cardType || '');
    return Object.prototype.hasOwnProperty.call(CARD_TYPE_PLAN_PRESSURE_PROFILE, type)
        ? CARD_TYPE_PLAN_PRESSURE_PROFILE[type]
        : getGeneratedThrowChainPlanPressureProfile(type);
}

function computeCardPlanPressure(level, legalMovesCount, planState, decisionContext) {
    const plan = planState || {};
    const ctx = decisionContext || {};
    const discDiff = Number.isFinite(ctx.discDiff) ? Number(ctx.discDiff) : 0;
    const handSize = Number.isFinite(ctx.handSize) ? Number(ctx.handSize) : 0;
    const ownCharge = Number.isFinite(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const ownEdges = Number.isFinite(ctx.ownEdges) ? Number(ctx.ownEdges) : 0;
    const oppEdges = Number.isFinite(ctx.oppEdges) ? Number(ctx.oppEdges) : 0;
    const ownSpecialCount = Number.isFinite(ctx.ownSpecialCount) ? Number(ctx.ownSpecialCount) : 0;
    const oppSpecialCount = Number.isFinite(ctx.oppSpecialCount) ? Number(ctx.oppSpecialCount) : 0;

    let pressure = 0;
    if (plan.cornerEmergency === true) pressure += 2;
    else if (Number(plan.oppCorners || 0) > Number(plan.ownCorners || 0)) pressure += 1;

    if (discDiff <= -12) pressure += 2;
    else if (discDiff <= -6) pressure += 1;

    if (legalMovesCount <= 1) pressure += 2;
    else if (legalMovesCount <= 2) pressure += 1;

    if (handSize >= 5) pressure += 2;
    else if (handSize >= 4) pressure += 1;

    if (ownCharge >= 36) pressure += 2;
    else if (ownCharge >= 28) pressure += 1;

    if ((ownEdges - oppEdges) <= -4) pressure += 1;
    if (oppSpecialCount >= (ownSpecialCount + 2)) pressure += 1;
    if (ctx.highBonusMoveAvailable === true) pressure += 1;

    if (plan.cornerEmergency !== true) {
        if (discDiff >= 12) pressure -= 2;
        else if (discDiff >= 6) pressure -= 1;
        if (plan.hasCornerMoveNow === true && legalMovesCount > 1) pressure -= 1;
    }

    return Math.max(0, Math.min(7, pressure));
}

function resolveCardPlanPressureThreshold(legalMovesCount, planState, profile) {
    const plan = planState || {};
    const activeProfile = profile || makePlanPressureProfile(0, 0, 0, 0);
    if (plan.cornerEmergency === true) return activeProfile.recoveryEmergencyPressure;
    if (plan.hasCornerMoveNow === true && legalMovesCount > 1) return activeProfile.cornerWindowPressure;
    if (Number(plan.recoveryCostGap || 0) > 0) return activeProfile.recoveryGapPressure;
    return activeProfile.basePressure;
}

function buildCornerPlanState(playerKey, legalMoves, usableCardIds) {
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const board = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey]) ? Number(cs.charge[playerKey]) : 0;
    const corners = countCornerControl(board, playerValue);

    const moves = Array.isArray(legalMoves) ? legalMoves : [];
    const hasCornerMoveNow = moves.some((m) => m && isCornerCell(m.row, m.col, board));
    const hasEdgeMoveNow = moves.some((m) => m && !isCornerCell(m.row, m.col, board) && isEdgeCell(m.row, m.col, board));
    let maxBoardBonusOnLegalMoves = 0;
    for (const m of moves) {
        if (!m || !Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
        const b = getBoardBonusValueAt(m.row, m.col);
        if (b > maxBoardBonusOnLegalMoves) maxBoardBonusOnLegalMoves = b;
    }

    const usableSet = new Set((Array.isArray(usableCardIds) ? usableCardIds : []).map((id) => String(id)));
    const handIds = getHandCardIdsForPlayer(playerKey);
    let recoveryReady = false;
    let holdReady = false;
    let recoveryCostGap = Number.POSITIVE_INFINITY;
    for (const cardId of handIds) {
        const cardType = resolveCardType(cardId, null);
        if (!cardType) continue;
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? Number(CardLogic.getCardCost(cardId) || 0)
            : 0;
        if (isRecoveryCardType(cardType)) {
            if (usableSet.has(String(cardId)) && ownCharge >= cost) {
                recoveryReady = true;
            } else {
                recoveryCostGap = Math.min(recoveryCostGap, Math.max(0, cost - ownCharge));
            }
        }
        if (isHoldCardType(cardType) && usableSet.has(String(cardId)) && ownCharge >= cost) {
            holdReady = true;
        }
    }
    if (!Number.isFinite(recoveryCostGap)) recoveryCostGap = 0;

    const cornerEmergency = (
        corners.oppCorners > corners.ownCorners ||
        (!hasCornerMoveNow && corners.oppCorners > 0)
    );
    const cornerHoldMode = !cornerEmergency && corners.ownCorners > 0 && corners.ownCorners >= corners.oppCorners;

    return {
        ownCorners: corners.ownCorners,
        oppCorners: corners.oppCorners,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        cornerHoldMode,
        recoveryReady,
        recoveryCostGap,
        maxBoardBonusOnLegalMoves,
        highBonusMoveAvailable: maxBoardBonusOnLegalMoves >= 3
    };
}

function isCardChoiceAllowedByPlan(playerKey, level, legalMovesCount, cardId, cardDef, planState, decisionContext) {
    if (!cardId) return false;
    if (!Number.isFinite(level) || level < 6) return true;
    if (!Number.isFinite(legalMovesCount) || legalMovesCount <= 0) return true;

    const plan = planState || buildCornerPlanState(playerKey, [], []);
    const cardType = resolveCardType(cardId, cardDef);
    if (!cardType) return true;

    const forceUseCard = !!(decisionContext && decisionContext.forceUseCard === true);
    const ownCharge = Number.isFinite(decisionContext && decisionContext.ownCharge)
        ? Number(decisionContext.ownCharge)
        : 0;
    const reserveChargeFloor = Number.isFinite(decisionContext && decisionContext.reserveChargeFloor)
        ? Number(decisionContext.reserveChargeFloor)
        : 0;
    const lowDiscEmergency = !!(decisionContext && decisionContext.lowDiscEmergency === true);
    const criticalLowDiscEmergency = !!(decisionContext && decisionContext.criticalLowDiscEmergency === true);
    const hasCornerMoveNow = !!(plan && plan.hasCornerMoveNow === true);
    const lowChargeTight = ownCharge <= Math.max(8, reserveChargeFloor + 2);
    const maxLegalFlips = Number.isFinite(decisionContext && decisionContext.maxLegalFlips)
        ? Math.max(0, Math.floor(Number(decisionContext.maxLegalFlips)))
        : 0;
    const maxLegalGain = Number.isFinite(decisionContext && decisionContext.maxLegalGain)
        ? Math.max(0, Number(decisionContext.maxLegalGain))
        : maxLegalFlips;
    const maxLegalBoardBonus = Number.isFinite(decisionContext && decisionContext.maxLegalBoardBonus)
        ? Math.max(0, Number(decisionContext.maxLegalBoardBonus))
        : 0;
    const oppHandSize = Number.isFinite(decisionContext && decisionContext.oppHandSize)
        ? Math.max(0, Math.floor(Number(decisionContext.oppHandSize)))
        : 0;
    const handSize = Number.isFinite(decisionContext && decisionContext.handSize)
        ? Math.max(0, Math.floor(Number(decisionContext.handSize)))
        : 0;
    const highYieldChargeRecovery = (
        ((cardType === 'GOLD_STONE' || cardType === 'SILVER_STONE' || cardType === 'RAINBOW_STONE') &&
            maxLegalFlips >= 3 &&
            maxLegalGain >= 3) ||
        (cardType === 'CRYSTAL_STONE' &&
            maxLegalBoardBonus >= 2) ||
        (cardType === 'PLUNDER_WILL' &&
            maxLegalFlips >= 3 &&
            maxLegalGain >= 3 &&
            Number.isFinite(decisionContext && decisionContext.oppCharge) &&
            Number(decisionContext.oppCharge) >= 3)
    );

    // When a legal corner exists, Lv6 should just take the corner instead of
    // pre-spending charge on setup/protection cards.
    if (hasCornerMoveNow && !forceUseCard) {
        return false;
    }

    // When charge is tight, only allow direct recovery/swing cards or true
    // survival cards. This keeps non-corner utility from stealing charge that
    // should be reserved for corner take / corner recapture.
    if (
        lowChargeTight &&
        !forceUseCard &&
        !criticalLowDiscEmergency &&
        !highYieldChargeRecovery &&
        !isCornerRecoveryCardType(cardType) &&
        !WHITE_LV6_CORNER_SWING_KEEP_TYPES.has(cardType)
    ) {
        if (!(lowDiscEmergency && isCornerHoldCardType(cardType))) {
            return false;
        }
    }

    const profile = getCardPlanPressureProfile(cardType);
    if (!profile) return true;

    const planPressure = computeCardPlanPressure(level, legalMovesCount, plan, decisionContext);
    const requiredPressure = resolveCardPlanPressureThreshold(legalMovesCount, plan, profile);
    return planPressure >= requiredPressure;
}

function buildMovePlanContext(playerKey, level, candidateMoves) {
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const board = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    if (!isPlayableBoard(board)) return null;
    const pending = readCpuPendingEffect(playerKey, cs);
    const pendingType = resolvePendingType(playerKey);
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey])
        ? Number(cs.charge[playerKey])
        : 0;
    const boardStats = countBoardStatsForPlayer(playerValue);
    const totalCells = Math.max(1, countPlayableCells(board));
    const occupied = Math.max(0, totalCells - Math.max(0, Number(boardStats.empties) || 0));
    const ownDiscs = Math.max(0, Math.min(
        occupied,
        Math.floor((occupied + (Number(boardStats.discDiff) || 0)) / 2)
    ));
    const usable = (typeof CardLogic !== 'undefined' && CardLogic)
        ? getTargetAwareUsableCardIds(playerKey)
        : [];
    const plan = buildCornerPlanState(playerKey, candidateMoves, usable);
    return {
        level,
        board,
        playerValue,
        ownCharge,
        ownDiscs,
        boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object') ? cs.boardBonusByCell : null,
        boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object') ? cs.boardBonusConsumedByCell : null,
        reserveRecoveryCardReady: plan.recoveryReady === true,
        reserveRecoveryCardCostGap: Number(plan.recoveryCostGap || 0),
        hasCornerHoldCardReady: plan.holdReady === true,
        pendingType,
        pendingPlacementsRemaining: pending && Number.isFinite(Number(pending.placementsRemaining))
            ? Number(pending.placementsRemaining)
            : 0,
        preferEdgeRetention: plan.cornerHoldMode === true
    };
}

function shouldRespectPendingPlacementPlanStrictly(pendingType) {
    if (!pendingType || !CpuPolicyCore || typeof CpuPolicyCore.getMovePlanProfileForCardType !== 'function') {
        return false;
    }

    const profile = CpuPolicyCore.getMovePlanProfileForCardType(pendingType);
    if (!profile) return false;

    const stabilityBias = Number(profile.stabilityBias || 0);
    const emptyAdjBias = Number(profile.emptyAdjBias || 0);
    const cornerBias = Number(profile.cornerBias || 0);
    const edgeBias = Number(profile.edgeBias || 0);
    const innerBias = Number(profile.innerBias || 0);

    return (
        stabilityBias >= 3 &&
        emptyAdjBias <= 0 &&
        innerBias < 0 &&
        (cornerBias >= 3 || edgeBias >= 2)
    );
}

function maybeOverrideWithStrictPendingPlacement(selectedMove, candidateMoves, playerKey, movePlanScoreFn) {
    if (!selectedMove || !Array.isArray(candidateMoves) || candidateMoves.length <= 1) return selectedMove;
    if (typeof movePlanScoreFn !== 'function') return selectedMove;

    const pendingType = resolvePendingType(playerKey);
    if (!shouldRespectPendingPlacementPlanStrictly(pendingType)) return selectedMove;

    const selectedRow = Number(selectedMove.row);
    const selectedCol = Number(selectedMove.col);
    const board = getCurrentCpuBoard();
    const selectedAnchored = isCornerCell(selectedRow, selectedCol, board) || isEdgeCell(selectedRow, selectedCol, board);
    const selectedPlanScore = Number(movePlanScoreFn(selectedMove) || 0);

    let bestAnchoredMove = null;
    let bestAnchoredScore = Number.NEGATIVE_INFINITY;
    for (const move of candidateMoves) {
        if (!move) continue;
        const row = Number(move.row);
        const col = Number(move.col);
        const anchored = isCornerCell(row, col, board) || isEdgeCell(row, col, board);
        if (!anchored) continue;

        const planScore = Number(movePlanScoreFn(move) || 0);
        if (planScore > bestAnchoredScore) {
            bestAnchoredMove = move;
            bestAnchoredScore = planScore;
        }
    }

    if (!bestAnchoredMove) return selectedMove;
    if (Number(bestAnchoredMove.row) === selectedRow && Number(bestAnchoredMove.col) === selectedCol) {
        return selectedMove;
    }

    const planGap = bestAnchoredScore - selectedPlanScore;
    const selectedBonus = getBoardBonusValueAt(selectedRow, selectedCol);
    const anchoredBonus = getBoardBonusValueAt(Number(bestAnchoredMove.row), Number(bestAnchoredMove.col));
    const threshold = selectedAnchored ? 2200 : 3000;
    if (planGap < threshold) return selectedMove;

    // 持続石の効果は先読み木に完全には乗らないため、
    // 安定配置の計画差が大きい時だけ最終手を計画側へ戻す。
    if ((selectedBonus - anchoredBonus) >= 5 && planGap < 5500) {
        return selectedMove;
    }

    cpuDebugLog(
        `[CPU] Lv${cpuSmartness[playerKey] || 1} ${playerKey}: ${pendingType}配置を安定寄せへ補正 (${bestAnchoredMove.row}, ${bestAnchoredMove.col})`
    );
    return bestAnchoredMove;
}

function countBoardStatsForPlayer(playerValue) {
    const board = getCurrentCpuBoard();
    if (!Array.isArray(board)) {
        return { discDiff: 0, empties: 0 };
    }
    let own = 0;
    let opp = 0;
    let empties = 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    const cells = (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function')
        ? boardUtils.collectBoardCoordinates(board)
        : board.flatMap((row, r) => (Array.isArray(row) ? row.map((_, c) => ({ row: r, col: c })) : []));
    for (const cell of cells) {
        const v = getBoardCellValue(board, cell.row, cell.col);
        if (v === playerValue) own += 1;
        else if (v === -playerValue) opp += 1;
        else if (v === 0) empties += 1;
    }
    return { discDiff: own - opp, empties };
}

function buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds) {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const board = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const stats = countBoardStatsForPlayer(playerValue);
    const edgeControl = countEdgeControl(board, playerValue);
    const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey])
        ? cs.charge[playerKey]
        : 0;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const oppHandSize = cs && cs.hands && Array.isArray(cs.hands[opponentKey])
        ? cs.hands[opponentKey].length
        : 0;
    const oppCharge = cs && cs.charge && Number.isFinite(cs.charge[opponentKey])
        ? cs.charge[opponentKey]
        : 0;
    const handCardIds = cs && cs.hands && Array.isArray(cs.hands[playerKey])
        ? cs.hands[playerKey].slice()
        : [];
    const handSize = handCardIds.length;
    const deckRemaining = cs && cs.decks && Array.isArray(cs.decks[playerKey])
        ? cs.decks[playerKey].length
        : null;
    const hasDestroyedCardThisTurn = !!(cs && cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer[playerKey]);
    const planState = buildCornerPlanState(playerKey, legalMoves, usableCardIds);
    const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
    const legalMoveMetrics = (CpuPolicyCore && typeof CpuPolicyCore.computeLegalMoveMetrics === 'function')
        ? CpuPolicyCore.computeLegalMoveMetrics(safeLegalMoves, (row, col) => getBoardBonusValueAt(row, col))
        : {
            maxLegalFlips: 0,
            avgLegalFlips: 0,
            maxLegalGain: 0,
            maxLegalBoardBonus: 0
        };

    const markers = cs && Array.isArray(cs.markers) ? cs.markers : [];
    let ownSpecialCount = 0;
    let oppSpecialCount = 0;
    let ownGuardCount = 0;
    let oppGuardCount = 0;
    let cloneSplitEligibleSourceCount = 0;
    const cloneSplitEligibleSourceKeys = new Set();
    for (const marker of markers) {
        if (!marker || (marker.kind !== 'specialStone' && marker.kind !== 'bomb')) continue;
        const row = Number(marker.row);
        const col = Number(marker.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        if (getBoardCellValueSafe(board, row, col) === playerValue) {
            const sourceKey = `${row},${col}`;
            if (!cloneSplitEligibleSourceKeys.has(sourceKey)) {
                cloneSplitEligibleSourceKeys.add(sourceKey);
                cloneSplitEligibleSourceCount += 1;
            }
        }
        if (marker.kind !== 'specialStone') continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        const type = data && typeof data.type === 'string' ? data.type : '';
        if (type === 'METEOR_HOLE') continue;
        if (marker.owner === playerKey) {
            ownSpecialCount += 1;
            if (type === 'GUARD') ownGuardCount += 1;
        } else if (marker.owner === opponentKey) {
            oppSpecialCount += 1;
            if (type === 'GUARD') oppGuardCount += 1;
        }
    }

    return {
        level,
        whiteLv6Mode: level >= 6 && playerKey === 'white',
        playerValue,
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        discDiff: stats.discDiff,
        empties: stats.empties,
        ownCharge,
        oppCharge,
        oppHandSize,
        handSize,
        handCardIds,
        deckRemaining,
        hasDestroyedCardThisTurn,
        forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
        ownCorners: planState.ownCorners,
        oppCorners: planState.oppCorners,
        ownEdges: edgeControl.ownEdges,
        oppEdges: edgeControl.oppEdges,
        hasCornerMoveNow: planState.hasCornerMoveNow,
        hasEdgeMoveNow: planState.hasEdgeMoveNow,
        cornerEmergency: planState.cornerEmergency,
        cornerHoldMode: planState.cornerHoldMode,
        recoveryCostGap: planState.recoveryCostGap,
        highBonusMoveAvailable: planState.highBonusMoveAvailable,
        maxLegalFlips: legalMoveMetrics.maxLegalFlips,
        avgLegalFlips: legalMoveMetrics.avgLegalFlips,
        maxLegalGain: legalMoveMetrics.maxLegalGain,
        maxLegalBoardBonus: legalMoveMetrics.maxLegalBoardBonus,
        cloneSplitEligibleSourceCount,
        ownSpecialCount,
        oppSpecialCount,
        ownGuardCount,
        oppGuardCount,
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : [],
        cornerPlanState: planState
    };
}

const HIGH_VARIANCE_CARD_TYPES_FOR_QUIESCENCE = new Set([
    'TIME_BOMB',
    'METEOR_WILL',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL'
]);

function cloneBoardForCpu(board) {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.cloneBoard === 'function') {
        return boardUtils.cloneBoard(board);
    }
    if (!Array.isArray(board)) return [];
    return board.map((row) => (Array.isArray(row) ? row.slice() : []));
}

function applyMoveByFlipsForCpu(board, move, playerValue) {
    if (!Array.isArray(board) || !move) return null;
    const row = Number(move.row);
    const col = Number(move.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const next = cloneBoardForCpu(board);
    if (!setBoardCellValue(next, row, col, playerValue)) return null;
    const flips = Array.isArray(move.flips) ? move.flips : [];
    for (const one of flips) {
        const fr = Number(one && one.row);
        const fc = Number(one && one.col);
        if (!Number.isInteger(fr) || !Number.isInteger(fc)) continue;
        setBoardCellValue(next, fr, fc, playerValue);
    }
    return next;
}

function hasCornerMoveOnBoardForPlayer(board, playerValue) {
    if (!Array.isArray(board)) return false;
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.getLegalMovesBasic === 'function') {
        try {
            const legal = boardUtils.getLegalMovesBasic(board, playerValue) || [];
            return legal.some((m) => m && isCornerCell(Number(m.row), Number(m.col), board));
        } catch (e) {
            return false;
        }
    }
    if (typeof getLegalMoves !== 'function') return false;
    try {
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(playerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const simulated = { board, currentPlayer: playerValue };
        const legal = getLegalMoves(simulated, protection, perma) || [];
        return legal.some((m) => m && isCornerCell(Number(m.row), Number(m.col), board));
    } catch (e) {
        return false;
    }
}

function buildCardQuiescenceSnapshot(playerKey, level, legalMoves, context) {
    if (!Number.isFinite(level) || level < 6) return null;
    if (!Array.isArray(legalMoves) || legalMoves.length <= 0) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.chooseMoveByLookahead !== 'function') return null;
    if (!isPlayableBoard(getCurrentCpuBoard())) return null;

    const board = getCurrentCpuBoard();
    const playerValue = Number.isFinite(context && context.playerValue)
        ? (Number(context.playerValue) >= 0 ? 1 : -1)
        : (playerKey === 'black' ? 1 : -1);
    const lv6Lookahead = buildLv6LookaheadOptions(level, board, legalMoves.length, playerKey);
    const timeCaps = resolveLv6LookaheadTimeCaps(playerKey);
    const onSearchMeta = createLookaheadMetaLogger(playerKey, level, 'card-quiescence');
    const bestMove = CpuPolicyCore.chooseMoveByLookahead(legalMoves, {
        board,
        playerValue,
        level,
        depth: Math.max(4, Math.min(7, Number(lv6Lookahead.depth) || 5)),
        maxBranch: Math.max(4, Math.min(8, Number(lv6Lookahead.maxBranch) || 6)),
        nodeBudget: Math.max(120_000, Math.min(800_000, Number(lv6Lookahead.nodeBudget) || 350_000)),
        maxTimeMs: Math.max(300, Math.min(timeCaps.quiescenceMoveCapMs, Number(lv6Lookahead.maxTimeMs) || 900)),
        endgameSolveEmpties: Math.max(12, Math.min(24, Number(lv6Lookahead.endgameSolveEmpties) || 18)),
        endgameDepth: Math.max(10, Math.min(20, Number(lv6Lookahead.endgameDepth) || 14)),
        endgameNodeBudget: Math.max(600_000, Math.min(3_000_000, Number(lv6Lookahead.endgameNodeBudget) || 1_500_000)),
        endgameMaxTimeMs: Math.max(
            timeCaps.quiescenceEndgameMinMs,
            Math.min(timeCaps.quiescenceEndgameCapMs, Number(lv6Lookahead.endgameMaxTimeMs) || 1_600)
        ),
        onSearchMeta,
        boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
            ? cardState.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
            ? cardState.boardBonusConsumedByCell
            : null
    });
    if (!bestMove) return null;

    const bestMoveBonus = (Number.isInteger(bestMove.row) && Number.isInteger(bestMove.col))
        ? getBoardBonusValueAt(bestMove.row, bestMove.col)
        : 0;
    const bestMoveFlips = Array.isArray(bestMove.flips) ? bestMove.flips.length : 0;
    const bestMoveCorner = isCornerCell(Number(bestMove.row), Number(bestMove.col), board);
    const bestMoveEdge = !bestMoveCorner && isEdgeCell(Number(bestMove.row), Number(bestMove.col), board);
    const nextBoard = applyMoveByFlipsForCpu(board, bestMove, playerValue);
    const oppCornerAfterBest = nextBoard
        ? hasCornerMoveOnBoardForPlayer(nextBoard, -playerValue)
        : false;

    return {
        bestMove,
        bestMoveBonus,
        bestMoveFlips,
        bestMoveCorner,
        bestMoveEdge,
        oppCornerAfterBest
    };
}

function shouldHoldCardByQuiescence(playerKey, level, cardId, cardDef, context, snapshot) {
    if (!Number.isFinite(level) || level < 6) return false;
    if (!cardId || !context || !snapshot || !snapshot.bestMove) return false;
    if (context.forceUseCard === true) return false;
    if (context.cornerEmergency === true) return false;
    if (Number(context.discDiff || 0) <= -8) return false;
    if (Number(context.handSize || 0) >= 4) return false;
    if (Number(context.ownCharge || 0) >= 24) return false;
    if (Number(context.legalMovesCount || 0) <= 2) return false;

    const cardType = resolveCardType(cardId, cardDef);
    if (!HIGH_VARIANCE_CARD_TYPES_FOR_QUIESCENCE.has(cardType)) return false;
    if (snapshot.oppCornerAfterBest === true) return false;

    const discDiff = Number(context.discDiff || 0);
    if (snapshot.bestMoveCorner === true && discDiff >= 0) return true;
    if (snapshot.bestMoveBonus >= 2 && discDiff >= 0) return true;
    if (snapshot.bestMoveFlips >= 6 && discDiff >= 4) return true;
    if (snapshot.bestMoveEdge === true && discDiff >= 10) return true;
    return false;
}

function isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, cardId, prebuiltContext) {
    if (!cardId) return false;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function' || typeof CardLogic === 'undefined' || !CardLogic) {
        return true;
    }
    try {
        const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount);
        const decision = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!decision) return true;
        return decision.shouldUse === true;
    } catch (e) {
        return true;
    }
}

function isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, cardId, prebuiltContext) {
    if (!cardId) return false;
    if (!Number.isFinite(level) || level < 6) return true;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function' || typeof CardLogic === 'undefined' || !CardLogic) {
        return true;
    }
    try {
        const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount);
        if (context && context.forceUseCard === true) return true;

        const decision = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!decision) return true;

        let requiredMargin = 6;
        if (context && context.hasCornerMoveNow === true) requiredMargin += 10;
        if (context && context.highBonusMoveAvailable === true) requiredMargin += 3;
        if (context && Number.isFinite(context.discDiff) && context.discDiff >= 8) requiredMargin += 2;
        if (context && Number.isFinite(context.discDiff) && context.discDiff <= -10) requiredMargin -= 8;
        if (context && Number.isFinite(context.handSize) && context.handSize >= 5) requiredMargin -= 14;
        else if (context && Number.isFinite(context.handSize) && context.handSize >= 4) requiredMargin -= 10;
        else if (context && Number.isFinite(context.handSize) && context.handSize >= 3) requiredMargin -= 6;
        if (context && Number.isFinite(context.ownCharge) && context.ownCharge >= 24) requiredMargin -= 4;
        if (context && Number.isFinite(context.ownCharge) && context.ownCharge >= 36) requiredMargin -= 4;
        if (context && Number.isFinite(context.legalMovesCount) && context.legalMovesCount <= 3) requiredMargin -= 10;
        if (context && context.lowDiscEmergency === true) requiredMargin -= 6;
        if (context && context.criticalLowDiscEmergency === true) requiredMargin -= 10;
        if (context && context.whiteLv6Mode === true) requiredMargin -= 3;
        if (context && context.whiteLv6Mode === true && Number.isFinite(context.maxLegalFlips) && context.maxLegalFlips >= 4) requiredMargin -= 4;
        if (requiredMargin < 0) requiredMargin = 0;

        return Number(decision.score) >= (Number(decision.minUseScore) + requiredMargin);
    } catch (e) {
        return true;
    }
}

function _isCpuTrapOnlyModeEnabled(playerKey) {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        if (!root) return false;
        const qs = String((root.location && root.location.search) || '');
        const debugEnabled =
            /[?&]debug=(1|true)\b/i.test(qs) ||
            root.DEBUG_UNLIMITED_USAGE === true;
        if (!debugEnabled) return false;
        const enabled = /[?&]cpuTrapOnly=(1|true)\b/i.test(qs);
        if (!enabled) return false;
        // Default target is white CPU (opponent from normal player perspective).
        const m = qs.match(/[?&]cpuTrapOnlyFor=([^&]+)/i);
        const raw = m && m[1] ? decodeURIComponent(m[1]).toLowerCase() : 'white';
        if (raw === 'all') return true;
        return raw === String(playerKey || '').toLowerCase();
    } catch (e) {
        return false;
    }
}

function _findTrapCardIdInCatalog() {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        const defs = (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS))
            ? CARD_DEFS
            : (root && Array.isArray(root.CARD_DEFS) ? root.CARD_DEFS : []);
        const def = defs.find(c => c && c.type === 'TRAP_WILL' && c.enabled !== false);
        return def ? def.id : null;
    } catch (e) {
        return null;
    }
}

function _prepareCpuTrapOnlyCard(playerKey) {
    if (!_isCpuTrapOnlyModeEnabled(playerKey)) return null;
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;

    const hand = cardState.hands[playerKey];
    let trapId = null;
    for (const id of hand) {
        try {
            const def = CardLogic.getCardDef ? CardLogic.getCardDef(id) : null;
            if (def && def.type === 'TRAP_WILL') {
                trapId = id;
                break;
            }
        } catch (e) { /* ignore */ }
    }
    if (!trapId) {
        trapId = _findTrapCardIdInCatalog();
        if (!trapId) return null;
        // Debug-only convenience: ensure CPU always has trap card in hand.
        if (hand.length >= ((typeof HAND_LIMIT !== 'undefined') ? HAND_LIMIT : 5)) {
            hand.shift();
        }
        hand.push(trapId);
    }

    try {
        const cost = (typeof CardLogic.getCardCost === 'function') ? (CardLogic.getCardCost(trapId) || 0) : 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const curr = Number(cardState.charge[playerKey] || 0);
        if (curr < cost) cardState.charge[playerKey] = cost;
    } catch (e) { /* ignore */ }

    return trapId;
}

function selectCardFallback(cardState, gameState, playerKey, level, legalMoves) {
    if (typeof cardState === 'undefined' || !cardState) return null;
    if (typeof CardLogic === 'undefined') return null;
    const usable = getTargetAwareUsableCardIds(playerKey);
    if (!usable.length) return null;
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usable);

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
        const selected = CpuPolicyCore.chooseCardWithRiskProfile(
            usable,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            decisionContext
        );
        if (selected) return selected;
    }
    if (CpuPolicyCore && typeof CpuPolicyCore.chooseHighestCostCard === 'function') {
        const fallback = CpuPolicyCore.chooseHighestCostCard(usable, CardLogic.getCardCost, CardLogic.getCardDef);
        if (!fallback) return null;
        return isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, fallback.cardId, decisionContext)
            ? fallback
            : null;
    }
    const choiceId = usable[0];
    const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
    if (!isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choiceId, decisionContext)) return null;
    return { cardId: choiceId, cardDef };
}

/**
 * カード使用判定・実行
 * @param {string} playerKey - 'black' または 'white'
 */
/**
 * Decide which card (if any) the CPU should use.
 * Pure function: inspects global state and returns a candidate object { cardId, cardDef } or null.
 * This function does NOT apply the card usage side effects; use `applyCardChoice` for that.
 * @param {string} playerKey - 'black' or 'white'
 * @returns {{cardId:string,cardDef:object}|null}
 */
function selectCardToUse(playerKey) {
    // Pure decision: returns a candidate { cardId, cardDef } or null but does NOT apply it.
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness[playerKey] !== 'undefined') ? cpuSmartness[playerKey] : 1;
    const player = playerKey === 'black' ? (typeof BLACK !== 'undefined' ? BLACK : (typeof global !== 'undefined' ? global.BLACK : 1)) : (typeof WHITE !== 'undefined' ? WHITE : (typeof global !== 'undefined' ? global.WHITE : -1));
    const protection = (typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(player) : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
    const legalMoves = (typeof getLegalMoves === 'function') ? getLegalMoves(safeGameState, protection, perma) : [];
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const usableNow = (typeof CardLogic !== 'undefined' && CardLogic)
        ? getTargetAwareUsableCardIds(playerKey)
        : [];
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableNow);
    if (
        Number.isFinite(level) &&
        level >= 6 &&
        decisionContext &&
        decisionContext.hasCornerMoveNow === true &&
        decisionContext.forceUseCard !== true
    ) {
        return null;
    }
    const quiescenceSnapshot = buildCardQuiescenceSnapshot(playerKey, level, legalMoves, decisionContext);
    const cornerPlanState = decisionContext.cornerPlanState || buildCornerPlanState(playerKey, legalMoves, usableNow);
    const isAllowedChoice = (choice) => {
        if (!choice || !choice.cardId) return false;
        if (!isCardChoiceAllowedByPlan(playerKey, level, legalMovesCount, choice.cardId, choice.cardDef, cornerPlanState, decisionContext)) {
            return false;
        }
        if (!isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
            return false;
        }
        const stableLeadState = !!(decisionContext &&
            Number(decisionContext.discDiff || 0) >= 10 &&
            Number(decisionContext.handSize || 0) <= 2 &&
            Number(decisionContext.ownCharge || 0) <= 18 &&
            Number(decisionContext.legalMovesCount || legalMovesCount || 0) >= 5 &&
            decisionContext.highBonusMoveAvailable !== true &&
            decisionContext.lowDiscEmergency !== true);
        const requireHighConfidence = Number.isFinite(level) && level >= 6 &&
            decisionContext &&
            decisionContext.forceUseCard !== true &&
            decisionContext.cornerEmergency !== true &&
            stableLeadState;
        if (requireHighConfidence) {
            if (!isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
                return false;
            }
        }
        if (shouldHoldCardByQuiescence(playerKey, level, choice.cardId, choice.cardDef, decisionContext, quiescenceSnapshot)) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 高分散カードを保留(静止探索) - ${choice.cardId}`);
            return false;
        }
        return true;
    };

    // Debug-only accelerator: CPU uses Trap Will preferentially.
    const trapId = _prepareCpuTrapOnlyCard(playerKey);
    if (trapId) {
        const usableTrap = getTargetAwareUsableCardIds(playerKey);
        if (usableTrap.includes(trapId)) {
            const trapDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
                ? CardLogic.getCardDef(trapId)
                : null;
            return { cardId: trapId, cardDef: trapDef };
        }
    }

    if (typeof CardLogic !== 'undefined') {
        const usable = usableNow;
        if (shouldUseSharedPolicyTableCoreCardDecision(level)) {
            return selectCardBySharedPolicyTableCore(
                playerKey,
                level,
                legalMoves.length,
                legalMoves,
                usable,
                decisionContext
            ) || null;
        }
        if (usable.length) {
            const lv6Consensus = selectCardByLevel6Consensus(
                playerKey,
                level,
                legalMoves.length,
                legalMoves,
                usable,
                decisionContext
            );
            if (isAllowedChoice(lv6Consensus)) {
                return lv6Consensus;
            }
            const learnedChoice = selectCardFromLearnedPolicy(playerKey, level, legalMoves.length, usable);
            if (isAllowedChoice(learnedChoice)) {
                return learnedChoice;
            }
        }
        if (usable.length) {
            if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
                const selected = CpuPolicyCore.chooseCardWithRiskProfile(
                    usable,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    decisionContext
                );
                if (isAllowedChoice(selected)) return selected;
            }
            if (CpuPolicyCore && typeof CpuPolicyCore.chooseHighestCostCard === 'function') {
                const fallback = CpuPolicyCore.chooseHighestCostCard(usable, CardLogic.getCardCost, CardLogic.getCardDef);
                if (isAllowedChoice(fallback)) {
                    return fallback;
                }
            }
            const choiceId = usable[0];
            const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
            if (isAllowedChoice({ cardId: choiceId, cardDef })) {
                return { cardId: choiceId, cardDef };
            }
        }
    }

    // Try AISystem via safe wrapper
    let cardChoice = null;
    if (isAISystemAvailable() && typeof AISystem.selectCardToUse === 'function') {
        try {
            const safeCardState = (typeof cardState !== 'undefined') ? cardState : null;
            const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
            cardChoice = AISystem.selectCardToUse(safeCardState, safeGameState, playerKey, level, legalMoves, null);
        } catch (e) {
            console.warn('[CPU] AISystem.selectCardToUse failed', e);
            cardChoice = null;
        }
    }

    if (!cardChoice) {
        const safeCardState = (typeof cardState !== 'undefined') ? cardState : null;
        const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
        cardChoice = selectCardFallback(safeCardState, safeGameState, playerKey, level, legalMoves);
    }
    if (cardChoice && !isAllowedChoice(cardChoice)) {
        return null;
    }
    return cardChoice || null;
}

function selectHandCardToDestroy(playerKey) {
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return null;
    if (readCpuPendingEffect(playerKey)) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.chooseHandDestroyTargetForCycle !== 'function') return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;

    const hand = cardState.hands[playerKey].slice();
    if (hand.length <= 0) return null;

    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    if (level < 4) return null;

    const player = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const protection = (typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(player) : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = (typeof getLegalMoves === 'function') ? (getLegalMoves(gameState, protection, perma) || []) : [];
    const usableNow = getTargetAwareUsableCardIds(playerKey);
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMoves.length, legalMoves, usableNow);

    const selected = CpuPolicyCore.chooseHandDestroyTargetForCycle(
        hand,
        usableNow,
        typeof CardLogic.getCardCost === 'function' ? CardLogic.getCardCost : () => 0,
        typeof CardLogic.getCardDef === 'function' ? CardLogic.getCardDef : () => null,
        decisionContext
    );
    if (!selected || !selected.cardId) return null;
    return selected;
}

function applyHandCardDestroy(playerKey, destroyChoice) {
    if (!destroyChoice || !destroyChoice.cardId) return false;
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return false;
    if (!cardState.hands[playerKey].includes(destroyChoice.cardId)) return false;

    const destroyCardId = destroyChoice.cardId;
    const destroyCardDef = destroyChoice.cardDef || (
        (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(destroyCardId)
            : null
    );
    const pipelineResult = runCpuHandDestroyViaPipeline(playerKey, destroyCardId);
    if (pipelineResult && pipelineResult.ok) {
        const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? Number(cpuSmartness[playerKey])
            : 1;
        const cardName = (destroyCardDef && destroyCardDef.name) ? destroyCardDef.name : destroyCardId;
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 手札破壊 - ${cardName} (${destroyChoice.reason || 'cycle'})`);
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})が手札を破壊: ${cardName}`);
        }
        return true;
    }
    if (pipelineResult && pipelineResult.ok === false) {
        return false;
    }

    if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.destroyHandCard !== 'function') return false;
    const direct = CardLogic.destroyHandCard(cardState, playerKey, destroyCardId);
    if (!direct || !direct.applied) return false;
    emitCpuSelectionStateChange();

    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const cardName = (destroyCardDef && destroyCardDef.name) ? destroyCardDef.name : destroyCardId;
    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 手札破壊(direct) - ${cardName} (${destroyChoice.reason || 'cycle'})`);
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})が手札を破壊: ${cardName}`);
    }
    return true;
}

function cpuMaybeDestroyHandCardWithPolicy(playerKey) {
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return false;
    if (readCpuPendingEffect(playerKey)) return false;

    const destroyChoice = selectHandCardToDestroy(playerKey);
    if (!destroyChoice) return false;
    return applyHandCardDestroy(playerKey, destroyChoice);
}

/**
 * Apply a chosen card. Performs state changes and emits UI hooks.
 * Side-effectful: mutates cardState/gameState and triggers emitters.
 * Returns true on success, false if application failed or card not in hand.
 */
function applyCardChoice(playerKey, cardChoice) {
    // Side-effectful application: applies the chosen card and updates UI/state
    if (!cardChoice) return false;
    const { cardId, cardDef } = cardChoice;
    if (cardState.hands[playerKey].indexOf(cardId) === -1) return false;
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const fallbackCardCost = (cardDef && Number.isFinite(cardDef.cost)) ? cardDef.cost : null;
    const fallbackCardName = (cardDef && cardDef.name) ? cardDef.name : null;
    const pipelineResult = runCpuCardUseViaPipeline(playerKey, cardId, cardDef);
    if (pipelineResult && pipelineResult.ok) {
        const appliedCardId = pipelineResult.appliedCardId || cardId;
        const appliedCardDef = pipelineResult.appliedCardDef || cardDef;
        const appliedCardCost = Number.isFinite(pipelineResult.appliedCardCost)
            ? pipelineResult.appliedCardCost
            : ((appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null);
        const appliedCardName = pipelineResult.appliedCardName || (appliedCardDef && appliedCardDef.name) || null;

        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.playCardUseHandAnimation === 'function') {
                if (globalThis.VisualPlaybackActive !== true) {
                    globalThis.playCardUseHandAnimation({
                        player: playerKey,
                        owner: playerKey,
                        cardId: appliedCardId,
                        cost: appliedCardCost,
                        name: appliedCardName
                    }).catch(() => {});
                }
            }
        } catch (e) { /* ignore */ }

        emitCpuCardUseLog(playerKey, level, appliedCardDef, appliedCardId);
        return true;
    }
    if (pipelineResult && pipelineResult.ok === false) {
        const rejectedReason = pipelineResult.res && pipelineResult.res.rejectedReason
            ? pipelineResult.res.rejectedReason
            : 'PIPELINE_REJECTED';
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用拒否(${rejectedReason}) - ${cardDef ? cardDef.name : cardId}`);
        return false;
    }

    if (typeof CardLogic === 'undefined' || !CardLogic.applyCardUsage) {
        console.warn('[CPU] CardLogic.applyCardUsage not available, skipping card use');
        return false;
    }
    const ok = CardLogic.applyCardUsage(cardState, gameState, playerKey, cardId);
    if (!ok) return false;

    // Normalize CPU card-use visuals through PlaybackEvents so CPU/AUTO and manual use
    // the same animation path.
    let emittedCardUsePlayback = false;
    try {
        if (
            typeof CardLogic.flushPresentationEvents === 'function' &&
            typeof TurnPipelineUIAdapter !== 'undefined' &&
            TurnPipelineUIAdapter &&
            typeof TurnPipelineUIAdapter.mapToPlaybackEvents === 'function'
        ) {
            const pres = CardLogic.flushPresentationEvents(cardState) || [];
            const playback = TurnPipelineUIAdapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
            if (playback.length > 0) {
                emitPresentationEventForCpu({ type: 'PLAYBACK_EVENTS', events: playback, meta: { source: 'cpu_card_use' } });
                emittedCardUsePlayback = true;
            } else {
                for (const ev of pres) emitPresentationEventForCpu(ev);
            }
        }
    } catch (e) {
        // Keep game flow even if animation conversion fails.
    }
    if (!emittedCardUsePlayback) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: [{
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardId,
                    cost: fallbackCardCost,
                    name: fallbackCardName
                }]
            }],
            meta: { source: 'cpu_card_use_fallback' }
        });
    }

    // Browser safety fallback: if playback wiring misses in this build/order, play once directly.
    // Duplicate calls are suppressed in playCardUseHandAnimation via timestamp guard.
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.playCardUseHandAnimation === 'function') {
            if (globalThis.VisualPlaybackActive !== true) {
                globalThis.playCardUseHandAnimation({
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardId,
                    cost: fallbackCardCost,
                    name: fallbackCardName
                }).catch(() => {});
            }
        }
    } catch (e) { /* ignore */ }

    emitCpuCardUseLog(playerKey, level, cardDef || null, cardId || null);

    if (typeof emitCardStateChange === 'function') emitCardStateChange();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();

    return true;
}

function cpuMaybeUseCardWithPolicy(playerKey) {
    // Backwards-compatible wrapper that selects then applies; preserves original behavior
    if (typeof cardState === 'undefined' || !cardState || !cardState.hasUsedCardThisTurnByPlayer) {
        // Defensive: in some browser load orders cardState may not be initialized yet
        console.warn('[CPU] cardState not initialized; skipping card use');
        return false;
    }
    if (cardState.hasUsedCardThisTurnByPlayer[playerKey]) return false;

    const level = cpuSmartness && cpuSmartness[playerKey] ? cpuSmartness[playerKey] : 1;
    const cardChoice = selectCardToUse(playerKey);
    if (!cardChoice) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カードスキップ (no candidate)`);
        return false;
    }

    if (applyCardChoice(playerKey, cardChoice)) return true;

    // Try other usable cards as fallback (preserve original retry behavior)
    if (typeof CardLogic !== 'undefined') {
        const usable = getTargetAwareUsableCardIds(playerKey);
        for (const id of usable) {
            if (id === (cardChoice && cardChoice.cardId)) continue;
            const def = CardLogic.getCardDef ? CardLogic.getCardDef(id) : null;
            if (applyCardChoice(playerKey, { cardId: id, cardDef: def })) return true;
        }
    }

    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用に失敗`);
    return false;
}

/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
function selectCpuMoveWithPolicy(candidateMoves, playerKey) {
    const level = cpuSmartness[playerKey] || 1;

    // 人間プレイヤーの場合はエラー（このコードは呼ばれてはいけない）
    if (level < 0) {
        console.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }

    let prioritizedCandidateMoves = filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    if (Number.isFinite(level) && level >= 6) {
        const board = getCurrentCpuBoard();
        prioritizedCandidateMoves = filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
    }

    const aiSelector = isAISystemAvailable() && typeof AISystem.selectMove === 'function'
        ? (moves, lv) => AISystem.selectMove(gameState, cardState, moves, lv, null)
        : null;
    const pendingType = resolvePendingType(playerKey);
    if (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') {
        const pending = readCpuPendingEffect(playerKey);
        const pendingPicked = choosePendingTargetWithPolicy(playerKey, pendingType, prioritizedCandidateMoves, pending);
        if (pendingPicked) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ${pendingType}選択 (${pendingPicked.row}, ${pendingPicked.col}) - 反転${Array.isArray(pendingPicked.flips) ? pendingPicked.flips.length : 0}枚`
            );
            return pendingPicked;
        }
    }

    const learnedMove = (level >= 6) ? selectMoveFromLearnedPolicy(prioritizedCandidateMoves, playerKey, level) : null;
    const learnedScoreFn = createLearnedScoreFn(playerKey, level, prioritizedCandidateMoves.length);
    const movePlanContext = (level >= 4) ? buildMovePlanContext(playerKey, level, prioritizedCandidateMoves) : null;
    const movePlanScoreFn = (
        movePlanContext &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function'
    )
        ? (move) => {
            try {
                return Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0);
            } catch (e) {
                return 0;
            }
        }
        : null;

    if (learnedMove && !movePlanScoreFn) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 学習選択 (${learnedMove.row}, ${learnedMove.col}) - 反転${learnedMove.flips.length}枚`);
        return learnedMove;
    }

    const combinedScoreFn = (move) => {
        let score = 0;
        if (movePlanScoreFn) score += movePlanScoreFn(move);
        if (learnedScoreFn) {
            const learnedWeight = movePlanScoreFn ? (level >= 6 ? 0.35 : 0.15) : 1.0;
            score += (Number(learnedScoreFn(move) || 0) * learnedWeight);
        }
        if (learnedMove && move && move.row === learnedMove.row && move.col === learnedMove.col) {
            score += movePlanScoreFn ? 1200 : 2500;
        }
        return score;
    };

    if (
        level >= 6 &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.chooseMoveByLookahead === 'function' &&
        isPlayableBoard(gameState && gameState.board)
    ) {
        const playerValue = playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1);
        const lv6Lookahead = buildLv6LookaheadOptions(level, gameState.board, prioritizedCandidateMoves.length, playerKey);
        const onSearchMeta = createLookaheadMetaLogger(playerKey, level, 'policy-lookahead');
        const weightConfig = resolveCpuLv6LookaheadWeights();
        const looked = CpuPolicyCore.chooseMoveByLookahead(prioritizedCandidateMoves, {
            board: gameState.board,
            playerValue,
            level,
            depth: lv6Lookahead.depth,
            maxBranch: lv6Lookahead.maxBranch,
            nodeBudget: lv6Lookahead.nodeBudget,
            scoreMove: combinedScoreFn,
            priorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
            searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8,
            endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
            endgameDepth: lv6Lookahead.endgameDepth || 16,
            endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
            maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
            endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600,
            onSearchMeta,
            boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? cardState.boardBonusConsumedByCell
                : null
        });
        if (looked) {
            const stabilized = maybeOverrideWithStrictPendingPlacement(looked, prioritizedCandidateMoves, playerKey, movePlanScoreFn);
            if (stabilized) {
                cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 先読み選択 (${stabilized.row}, ${stabilized.col}) - 反転${stabilized.flips.length}枚`);
                return stabilized;
            }
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 先読み選択 (${looked.row}, ${looked.col}) - 反転${looked.flips.length}枚`);
            return looked;
        }
    }

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseMove === 'function') {
        const useHeuristic = !movePlanScoreFn && level >= 3;
        const selected = CpuPolicyCore.chooseMove(prioritizedCandidateMoves, level, cpuRng, aiSelector, {
            enableHeuristic: useHeuristic,
            scoreMove: (movePlanScoreFn || learnedScoreFn || learnedMove) ? combinedScoreFn : null
        });
        if (selected) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selected.row}, ${selected.col}) - 反転${selected.flips.length}枚`);
            return selected;
        }
    }

    if (!isAISystemAvailable() || typeof AISystem.selectMove !== 'function') {
        // フォールバック: ランダム (injectable via setCpuRng)
        console.warn('[CPU] AISystem not available, using random');
        return prioritizedCandidateMoves[Math.floor(cpuRng.random() * prioritizedCandidateMoves.length)];
    }
    try {
        const selectedMove = AISystem.selectMove(gameState, cardState, prioritizedCandidateMoves, level, null);
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selectedMove.row}, ${selectedMove.col}) - 反転${selectedMove.flips.length}枚`);
        return selectedMove;
    } catch (e) {
        console.warn('[CPU] AISystem.selectMove failed, falling back to random', e);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }
}

function getBoardCellValueSafe(board, row, col) {
    if (!Array.isArray(board)) return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return getBoardCellValue(board, row, col);
}

function countAdjacentCellsByValue(board, row, col, value) {
    if (!Array.isArray(board)) return 0;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            const cell = getBoardCellValueSafe(board, r, c);
            if (cell === value) count += 1;
        }
    }
    return count;
}

function getMarkerPriorityValue(type) {
    const t = String(type || '').toUpperCase();
    if (!t) return 120;
    if (t === 'GUARD') return 280;
    if (t === 'WORK') return 320;
    if (t.includes('ULTIMATE')) return 260;
    if (t === 'SNIPER' || t === 'ROBOT_VACUUM') return 240;
    if (t === 'TRAP') return 180;
    return 140;
}

function getTimedMarkerProfileAt(playerKey, row, col) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const out = {
        ownTimedCount: 0,
        oppTimedCount: 0,
        ownTimedScore: 0,
        oppTimedScore: 0,
        ownRemainingSum: 0,
        oppRemainingSum: 0,
        ownCriticalCount: 0,
        oppCriticalCount: 0
    };
    for (const m of markers) {
        if (!m || m.kind !== 'specialStone' || m.row !== row || m.col !== col) continue;
        const remaining = Number(m.data && m.data.remainingOwnerTurns);
        if (!Number.isFinite(remaining) || remaining <= 0) continue;
        const weight = getMarkerPriorityValue(m.data && m.data.type) + (Math.min(6, remaining) * 28);
        if (m.owner === playerKey) {
            out.ownTimedCount += 1;
            out.ownTimedScore += weight;
            out.ownRemainingSum += remaining;
            if (remaining <= 2) out.ownCriticalCount += 1;
        } else {
            out.oppTimedCount += 1;
            out.oppTimedScore += weight;
            out.oppRemainingSum += remaining;
            if (remaining <= 2) out.oppCriticalCount += 1;
        }
    }
    return out;
}

function isCpuBlockedCell(row, col) {
    try {
        if (typeof isBlockedCell === 'function') {
            return !!isBlockedCell(cardState, row, col, gameState);
        }
    } catch (e) {
        // ignore and treat as unblocked
    }
    return false;
}

function getStrongWindLandingProfile(row, col) {
    const board = getCurrentCpuBoard();
    if (!board) return null;

    const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
    ];
    let maxDistance = 0;
    let longestOptionCount = 0;
    let longestCornerCount = 0;
    let longestEdgeCount = 0;
    let longestRiskCount = 0;
    let longestBonusTotal = 0;

    for (const d of dirs) {
        const nr = row + d.dr;
        const nc = col + d.dc;
        if (getBoardCellValueSafe(board, nr, nc) !== 0) continue;
        if (isCpuBlockedCell(nr, nc)) continue;

        let tr = nr;
        let tc = nc;
        while (true) {
            const rr = tr + d.dr;
            const cc = tc + d.dc;
            if (getBoardCellValueSafe(board, rr, cc) !== 0) break;
            if (isCpuBlockedCell(rr, cc)) break;
            tr = rr;
            tc = cc;
        }

        const distance = Math.abs(tr - row) + Math.abs(tc - col);
        if (distance <= 0) continue;

        if (distance > maxDistance) {
            maxDistance = distance;
            longestOptionCount = 0;
            longestCornerCount = 0;
            longestEdgeCount = 0;
            longestRiskCount = 0;
            longestBonusTotal = 0;
        }
        if (distance !== maxDistance) continue;

        longestOptionCount += 1;
        if (isCornerCell(tr, tc, board)) longestCornerCount += 1;
        else if (isEdgeCell(tr, tc, board)) longestEdgeCount += 1;
        longestBonusTotal += getBoardBonusValueAt(tr, tc);

        const landingCornerHint = getCornerProximity(tr, tc, board);
        if (landingCornerHint) {
            const cornerCell = getBoardCellValueSafe(
                board,
                landingCornerHint.corner[0],
                landingCornerHint.corner[1]
            );
            if (cornerCell === 0) longestRiskCount += 1;
        }
    }

    if (longestOptionCount <= 0) return null;
    return {
        maxDistance,
        longestOptionCount,
        longestCornerCount,
        longestEdgeCount,
        longestRiskCount,
        averageBonus: longestBonusTotal / longestOptionCount
    };
}

function scoreSeatStrategicValue(playerKey, row, col, markerProfile) {
    const board = getCurrentCpuBoard();
    if (!board) return 0;
    const cell = getBoardCellValueSafe(board, row, col);
    if (cell === null) return 0;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const profile = markerProfile || getMarkerProfileAt(playerKey, row, col);
    const corner = isCornerCell(row, col, board);
    const edge = !corner && isEdgeCell(row, col, board);
    const bonus = getBoardBonusValueAt(row, col);
    const ownAdj = countAdjacentCellsByValue(board, row, col, playerValue);
    const oppAdj = countAdjacentCellsByValue(board, row, col, -playerValue);
    const cornerHint = getCornerProximity(row, col, board);

    let score = 0;
    if (corner) score += 3200;
    else if (edge) score += 900;
    score += bonus * 240;
    score += (profile.ownSpecialScore + profile.oppSpecialScore) * 0.7;
    score += (profile.ownBombCount + profile.oppBombCount) * 210;

    if (cornerHint) {
        const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
        if (cornerCell === 0) score += cornerHint.kind === 'X' ? -900 : -420;
    }

    if (cell === playerValue) score += (ownAdj * 30) - (oppAdj * 18);
    else if (cell === -playerValue) score += (oppAdj * 30) - (ownAdj * 18);
    else score += Math.max(ownAdj, oppAdj) * 18;

    return score;
}

function getMarkerProfileAt(playerKey, row, col) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const out = {
        ownSpecialScore: 0,
        oppSpecialScore: 0,
        ownBombCount: 0,
        oppBombCount: 0
    };
    for (const m of markers) {
        if (!m || m.row !== row || m.col !== col) continue;
        if (m.kind === 'bomb') {
            if (m.owner === playerKey) out.ownBombCount += 1;
            else out.oppBombCount += 1;
            continue;
        }
        if (m.kind !== 'specialStone') continue;
        const priority = getMarkerPriorityValue(m.data && m.data.type);
        if (m.owner === playerKey) out.ownSpecialScore += priority;
        else out.oppSpecialScore += priority;
    }
    return out;
}

function getMoveOpponentSpecialFlipProfile(playerKey, move) {
    const flips = Array.isArray(move && move.flips) ? move.flips : [];
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    if (flips.length <= 0 || markers.length <= 0) {
        return { count: 0, score: 0 };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const flippedCells = new Set();
    for (const one of flips) {
        const row = Number(one && one.row);
        const col = Number(one && one.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        flippedCells.add(`${row},${col}`);
    }
    if (flippedCells.size <= 0) {
        return { count: 0, score: 0 };
    }

    let count = 0;
    let score = 0;
    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone' || marker.owner !== opponentKey) continue;
        const row = Number(marker.row);
        const col = Number(marker.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        if (!flippedCells.has(`${row},${col}`)) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        const type = data && typeof data.type === 'string' ? data.type : '';
        if (type === 'METEOR_HOLE') continue;
        count += 1;
        score += getMarkerPriorityValue(type);
        const remaining = Number(data && data.remainingOwnerTurns);
        if (Number.isFinite(remaining) && remaining > 0) {
            score += Math.min(6, remaining) * 28;
        }
    }

    return { count, score };
}

function scoreLv6PlacementPlanMove(playerKey, level, move, planContext) {
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') {
        return 0;
    }
    const context = planContext || buildMovePlanContext(playerKey, Math.max(4, level), [move]);
    if (!context) return 0;
    const score = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, context) || 0);
    return Number.isFinite(score) ? score : 0;
}

function filterLv6SpecialRemovalMoves(playerKey, level, candidateMoves) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];

    const profiledMoves = [];
    for (const move of candidateMoves) {
        const profile = getMoveOpponentSpecialFlipProfile(playerKey, move);
        if (!profile || profile.count <= 0) continue;
        profiledMoves.push({ move, profile });
    }
    if (profiledMoves.length <= 1) return profiledMoves.map((one) => one.move);

    const maxCount = profiledMoves.reduce((best, one) => Math.max(best, Number(one.profile.count) || 0), 0);
    let narrowed = profiledMoves.filter((one) => (Number(one.profile.count) || 0) === maxCount);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const maxScore = narrowed.reduce((best, one) => Math.max(best, Number(one.profile.score) || 0), 0);
    narrowed = narrowed.filter((one) => (Number(one.profile.score) || 0) === maxScore);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const narrowedMoves = narrowed.map((one) => one.move);
    const planContext = buildMovePlanContext(playerKey, Math.max(4, level), narrowedMoves);
    let bestPlanScore = Number.NEGATIVE_INFINITY;
    const planScored = narrowed.map((one) => {
        const planScore = scoreLv6PlacementPlanMove(playerKey, level, one.move, planContext);
        if (planScore > bestPlanScore) bestPlanScore = planScore;
        return { move: one.move, planScore };
    });
    const finalists = planScored.filter((one) => one.planScore >= (bestPlanScore - 1e-6)).map((one) => one.move);
    return finalists.length > 0 ? finalists : narrowedMoves;
}

function isEdgeDangerousCornerAdjacent(row, col, board) {
    if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) return false;
    return isLv6OpenCornerAdjacentCell(row, col, board);
}

function isLv6OpenCornerAdjacentCell(row, col, board) {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (isCornerCell(row, col, board)) return false;
    const cornerHint = getCornerProximity(row, col, board);
    if (!cornerHint) return false;
    return getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]) === 0;
}

function filterLv6OpenCornerAdjacentMoves(candidateMoves, board) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1 || !Array.isArray(board)) return candidateMoves;
    const safeMoves = candidateMoves.filter((move) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        return !isLv6OpenCornerAdjacentCell(row, col, board);
    });
    return safeMoves.length > 0 ? safeMoves : candidateMoves;
}

function filterLv6EdgeMovesByPlan(playerKey, level, candidateMoves, board) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0 || !board) return [];

    const edgeMoves = candidateMoves.filter((move) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        return Number.isInteger(row) && Number.isInteger(col) && !isCornerCell(row, col, board) && isEdgeCell(row, col, board);
    });

    const safeEdgeMoves = edgeMoves.filter((move) => {
        return !isEdgeDangerousCornerAdjacent(Number(move.row), Number(move.col), board);
    });
    if (safeEdgeMoves.length <= 0) return [];
    if (safeEdgeMoves.length <= 1) return safeEdgeMoves;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') return safeEdgeMoves;

    const planContext = buildMovePlanContext(playerKey, Math.max(4, level), safeEdgeMoves);
    if (!planContext) return safeEdgeMoves;

    let bestPlanScore = Number.NEGATIVE_INFINITY;
    const planScored = safeEdgeMoves.map((move) => {
        const planScore = scoreLv6PlacementPlanMove(playerKey, level, move, planContext);
        if (planScore > bestPlanScore) bestPlanScore = planScore;
        return { move, planScore };
    });
    const finalists = planScored
        .filter((one) => one.planScore >= (bestPlanScore - 1200))
        .map((one) => one.move);
    return finalists.length > 0 ? finalists : safeEdgeMoves;
}

function hasLv6MarkerPressure() {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((marker) => {
        if (!marker) return false;
        if (marker.kind === 'bomb') return true;
        if (marker.kind !== 'specialStone') return false;
        const type = String(marker.data && marker.data.type ? marker.data.type : '');
        return type !== 'METEOR_HOLE';
    });
}

function shouldForceLv6EdgePriority(playerKey, board) {
    if (!board) return true;

    const pending = readCpuPendingEffect(playerKey);
    if (pending && pending.type) {
        return true;
    }

    if (hasLv6MarkerPressure()) {
        return true;
    }
    return false;
}

function filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];
    if (!Number.isFinite(level) || level < 6) return candidateMoves;

    const board = getCurrentCpuBoard();
    const filteredCandidates = (board && candidateMoves.length > 1)
        ? filterLv6OpenCornerAdjacentMoves(candidateMoves, board)
        : candidateMoves;
    const candidatePool = filteredCandidates.length > 0 ? filteredCandidates : candidateMoves;

    if (board && filteredCandidates.length > 0 && filteredCandidates.length < candidateMoves.length) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 角隣接の危険候補を除外 (${filteredCandidates.length}/${candidateMoves.length})`
        );
    }

    if (board) {
        const cornerMoves = candidatePool.filter((move) => {
            if (!move) return false;
            const row = Number(move.row);
            const col = Number(move.col);
            return Number.isInteger(row) && Number.isInteger(col) && isCornerCell(row, col, board);
        });
        if (cornerMoves.length > 0) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: 角合法手を最優先 (${cornerMoves.length}/${candidatePool.length})`
            );
            return cornerMoves;
        }
    }

    const prioritized = filterLv6SpecialRemovalMoves(playerKey, level, candidatePool);
    if (prioritized.length > 0) {
        let removedSpecialCount = 0;
        let strongestProfileScore = 0;
        for (const move of prioritized) {
            const profile = getMoveOpponentSpecialFlipProfile(playerKey, move);
            if (!profile) continue;
            removedSpecialCount += Number(profile.count) || 0;
            strongestProfileScore = Math.max(strongestProfileScore, Number(profile.score) || 0);
        }
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 相手特殊石を反転除去できる候補を優先 (${prioritized.length}/${candidatePool.length}, 対象${removedSpecialCount}個, 最大優先値${strongestProfileScore})`
        );
        return prioritized;
    }

    const edgeMoves = filterLv6EdgeMovesByPlan(playerKey, level, candidatePool, board);
    if (edgeMoves.length > 0) {
        const forceEdge = shouldForceLv6EdgePriority(playerKey, board);
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: edge-gate force=${forceEdge} pending=${String(resolvePendingType(playerKey) || '')} marker=${hasLv6MarkerPressure()}`
        );
        if (forceEdge) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: 辺手を優先 (${edgeMoves.length}/${candidatePool.length})`
            );
            return edgeMoves;
        }

        const nonEdgeAlternatives = candidatePool.filter((move) => {
            if (!move) return false;
            const row = Number(move.row);
            const col = Number(move.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
            return !isEdgeCell(row, col, board);
        });
        if (nonEdgeAlternatives.length <= 0) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: 非辺候補がないため辺手を維持 (${edgeMoves.length}/${candidatePool.length})`
            );
            return edgeMoves;
        }

        const hasPlainInnerAlternative = nonEdgeAlternatives.some((move) => {
            if (!move) return false;
            const row = Number(move.row);
            const col = Number(move.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
            return getBoardBonusValueAt(row, col) <= 0;
        });
        if (!hasPlainInnerAlternative) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: 非辺候補が番号マスのみのため辺手を維持 (${edgeMoves.length}/${candidatePool.length})`
            );
            return edgeMoves;
        }

        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 辺手の強制優先を緩和 (${candidatePool.length}/${candidateMoves.length})`
        );
    }

    return candidatePool;
}

function isCloneSplitEligibleSource(playerKey, row, col, markerProfile) {
    const board = getCurrentCpuBoard();
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    if (getBoardCellValueSafe(board, row, col) !== playerValue) return false;

    const profile = markerProfile || getMarkerProfileAt(playerKey, row, col);
    if (!profile || typeof profile !== 'object') return false;
    return (
        Number(profile.ownSpecialScore || 0) > 0 ||
        Number(profile.oppSpecialScore || 0) > 0 ||
        Number(profile.ownBombCount || 0) > 0 ||
        Number(profile.oppBombCount || 0) > 0
    );
}

function filterCloneSplitTargetsForLv6(playerKey, targets) {
    if (!Array.isArray(targets) || targets.length <= 0) return [];
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    if (level < 6) return targets;
    return targets.filter((target) => {
        if (!target) return false;
        return isCloneSplitEligibleSource(playerKey, target.row, target.col);
    });
}

function getCornerProximity(row, col, boardOverride) {
    const board = Array.isArray(boardOverride) ? boardOverride : getCurrentCpuBoard();
    const boardUtils = resolveSharedBoardUtilsModule();
    if (!board || !boardUtils) return null;
    if (typeof boardUtils.getCornerProximity === 'function') {
        return boardUtils.getCornerProximity(row, col, board);
    }
    if (typeof boardUtils.getCornerCells !== 'function') return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const isX = typeof boardUtils.isXSquare === 'function'
        ? boardUtils.isXSquare(row, col, board)
        : false;
    const isC = !isX && typeof boardUtils.isCSquare === 'function'
        ? boardUtils.isCSquare(row, col, board)
        : false;
    if (!isX && !isC) return null;

    const corners = boardUtils.getCornerCells(board);
    for (const corner of corners) {
        if (!corner || !Number.isInteger(corner.row) || !Number.isInteger(corner.col)) continue;
        for (const vertical of [-1, 1]) {
            for (const horizontal of [-1, 1]) {
                const verticalCell = getBoardCellValueSafe(board, corner.row + vertical, corner.col);
                const horizontalCell = getBoardCellValueSafe(board, corner.row, corner.col + horizontal);
                if (verticalCell !== null || horizontalCell !== null) continue;
                const inwardRow = corner.row - vertical;
                const inwardCol = corner.col - horizontal;
                if (isX && inwardRow === row && inwardCol === col) {
                    return { kind: 'X', corner: [corner.row, corner.col] };
                }
                if (isC && (
                    (inwardRow === row && corner.col === col) ||
                    (corner.row === row && inwardCol === col)
                )) {
                    return { kind: 'C', corner: [corner.row, corner.col] };
                }
            }
        }
    }
    return null;
}

function getForcedCornerLaneBonus(pendingType, row, col, board, playerValue) {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const targetCell = getBoardCellValueSafe(board, row, col);
    if (targetCell !== playerValue) return 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;
    if (col !== bounds.minCol && col !== bounds.maxCol) return 0;

    if (String(pendingType || '') === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        return getBoardCellValueSafe(board, bounds.minRow, col) === 0 ? 2600 : 0;
    }
    if (String(pendingType || '') === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        return getBoardCellValueSafe(board, bounds.maxRow, col) === 0 ? 2600 : 0;
    }
    return 0;
}

function getForcedCornerLaneAntiPatternPenalty(pendingType, row, col, board, playerValue) {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const targetCell = getBoardCellValueSafe(board, row, col);
    if (targetCell === null || targetCell === playerValue) return 0;
    const type = String(pendingType || '');
    const boardUtils = resolveSharedBoardUtilsModule();
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;

    if (type === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.minRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.minRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getBoardCellValueSafe(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    if (type === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.maxRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.maxRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getBoardCellValueSafe(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    return 0;
}

function simulatePendingPlacementBoard(board, playerValue, target) {
    if (!Array.isArray(board)) return null;
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    const next = cloneBoardForCpu(board);
    if (!setBoardCellValue(next, target.row, target.col, playerValue)) return next;
    const flips = Array.isArray(target.flips) ? target.flips : [];
    for (const one of flips) {
        if (!one || !Number.isInteger(one.row) || !Number.isInteger(one.col)) continue;
        setBoardCellValue(next, one.row, one.col, playerValue);
    }
    return next;
}

function scorePendingTargetByType(playerKey, pendingType, target, pending) {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return Number.NEGATIVE_INFINITY;
    const board = getCurrentCpuBoard();
    if (!board) return Number.NEGATIVE_INFINITY;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const opponentValue = -playerValue;
    const row = target.row;
    const col = target.col;
    const cell = getBoardCellValueSafe(board, row, col);
    const onBoard = cell !== null;
    const own = onBoard && cell === playerValue;
    const opp = onBoard && cell === opponentValue;
    const empty = onBoard && cell === 0;
    const corner = onBoard && isCornerCell(row, col, board);
    const edge = onBoard && !corner && isEdgeCell(row, col, board);
    const ownAdj = onBoard ? countAdjacentCellsByValue(board, row, col, playerValue) : 0;
    const oppAdj = onBoard ? countAdjacentCellsByValue(board, row, col, opponentValue) : 0;
    const emptyAdj = onBoard ? countAdjacentCellsByValue(board, row, col, 0) : 0;
    const bonus = onBoard ? getBoardBonusValueAt(row, col) : 0;
    const markerProfile = getMarkerProfileAt(playerKey, row, col);
    const timedProfile = onBoard ? getTimedMarkerProfileAt(playerKey, row, col) : null;
    const seatValue = onBoard ? scoreSeatStrategicValue(playerKey, row, col, markerProfile) : 0;
    const stats = countBoardStatsForPlayer(playerValue);
    const discDiff = Number.isFinite(stats.discDiff) ? Number(stats.discDiff) : 0;
    const cornerHint = getCornerProximity(row, col, board);
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

    function hasSpecialMarkerTypeAt(targetRow, targetCol, markerType) {
        return markers.some((marker) => (
            marker &&
            marker.kind === 'specialStone' &&
            marker.row === targetRow &&
            marker.col === targetCol &&
            marker.data &&
            marker.data.type === markerType
        ));
    }

    function scoreBoardShrinkLine(lineCells) {
        if (!Array.isArray(lineCells) || lineCells.length <= 0) return Number.NEGATIVE_INFINITY;
        let lineScore = 0;
        let changeableCount = 0;
        for (const lineCell of lineCells) {
            if (!lineCell || !Number.isInteger(lineCell.row) || !Number.isInteger(lineCell.col)) continue;
            const lineRow = lineCell.row;
            const lineCol = lineCell.col;
            const boardValue = getBoardCellValueSafe(board, lineRow, lineCol);
            if (boardValue === null) continue;
            const lineCorner = isCornerCell(lineRow, lineCol, board);
            const lineEdge = !lineCorner && isEdgeCell(lineRow, lineCol, board);
            const absProtected = hasSpecialMarkerTypeAt(lineRow, lineCol, 'ABSOLUTE_PROTECTED');
            const frozen = hasSpecialMarkerTypeAt(lineRow, lineCol, 'FREEZE');
            if (absProtected) {
                lineScore -= 260;
                continue;
            }
            if (frozen) {
                lineScore -= 180;
                continue;
            }
            changeableCount += 1;
            if (boardValue === opponentValue) {
                lineScore += lineCorner ? 1600 : (lineEdge ? 520 : 180);
            } else if (boardValue === playerValue) {
                lineScore += lineCorner ? -2600 : (lineEdge ? -320 : -120);
            } else {
                lineScore += lineCorner ? 260 : (lineEdge ? 120 : 40);
            }
            const lineOwnAdj = countAdjacentCellsByValue(board, lineRow, lineCol, playerValue);
            const lineOppAdj = countAdjacentCellsByValue(board, lineRow, lineCol, opponentValue);
            const lineMarkerProfile = getMarkerProfileAt(playerKey, lineRow, lineCol);
            lineScore += (lineOppAdj - lineOwnAdj) * (lineEdge ? 60 : 34);
            lineScore += (lineMarkerProfile.oppSpecialScore - lineMarkerProfile.ownSpecialScore) * 1.4;
            lineScore += (lineMarkerProfile.oppBombCount - lineMarkerProfile.ownBombCount) * 180;
            lineScore += getBoardBonusValueAt(lineRow, lineCol) * 120;
        }
        if (changeableCount <= 0) return -4000;
        return lineScore + (changeableCount * 140);
    }

    let score = 0;
    const destructiveMarkerScore =
        markerProfile.oppSpecialScore - markerProfile.ownSpecialScore +
        ((markerProfile.oppBombCount - markerProfile.ownBombCount) * 220);

    switch (String(pendingType || '')) {
    case 'FREE_PLACEMENT':
    case 'LAST_RESORT': {
        if (!empty) return -5000;
        const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? Number(cpuSmartness[playerKey])
            : 1;
        const isLastResort = String(pendingType || '') === 'LAST_RESORT';
        const placementsRemaining = Math.max(1, Number(pending && pending.placementsRemaining) || (isLastResort ? 3 : 1));
        const flips = Array.isArray(target.flips) ? target.flips.length : 0;

        if (corner) score += 42000;
        else if (edge) score += 8600;
        else score -= 1400;

        score += flips * 420;
        score += bonus * 900;
        score += (oppAdj * 180) - (ownAdj * 110);
        score += (emptyAdj * 70);

        if (cornerHint) {
            const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
            if (cornerCell === 0) {
                score += cornerHint.kind === 'X' ? -18000 : -11000;
            } else if (cornerCell === playerValue) {
                score += cornerHint.kind === 'X' ? 1600 : 900;
            }
        }

        const planContext = (CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function')
            ? buildMovePlanContext(playerKey, Math.max(4, level), [])
            : null;
        if (planContext && CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function') {
            const moveLike = {
                row,
                col,
                flips: Array.isArray(target.flips) ? target.flips : []
            };
            let planScore = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(moveLike, planContext) || 0);
            if (!Number.isFinite(planScore)) planScore = 0;
            score += planScore * 0.18;
        }

        const after = simulatePendingPlacementBoard(board, playerValue, target);
        if (after && CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function') {
            const afterContext = {
                level: Math.max(4, level),
                board: after,
                playerValue,
                ownCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey]))
                    ? Number(cardState.charge[playerKey])
                    : 0,
                boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                    ? cardState.boardBonusByCell
                    : null,
                boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                    ? cardState.boardBonusConsumedByCell
                    : null,
                reserveRecoveryCardReady: false,
                reserveRecoveryCardCostGap: 0,
                hasCornerHoldCardReady: false,
                pendingType: String(pendingType || ''),
                pendingPlacementsRemaining: placementsRemaining,
                preferEdgeRetention: true
            };
            // Penalize spots that likely create immediate corner swing against us.
            let postRisk = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(
                { row, col, flips: [] },
                afterContext
            ) || 0);
            if (!Number.isFinite(postRisk)) postRisk = 0;
            score += postRisk * 0.04;
        }

        if (isLastResort) {
            if (placementsRemaining >= 2) {
                if (!corner && !edge && bonus <= 0) score -= 2000;
                score += (discDiff <= -8 ? 320 : 0);
            } else {
                score += flips * 220;
                if (discDiff <= -6) score += 280;
                if (discDiff >= 8 && !corner && !edge) score -= 420;
            }
        }
        return score;
    }
    case 'DESTROY_ONE_STONE':
        score += opp ? 220 : -260;
        if (corner) score += opp ? 3400 : -4600;
        else if (edge) score += opp ? 900 : -1100;
        score += destructiveMarkerScore * 1.2;
        score += (oppAdj - ownAdj) * 70;
        if (discDiff <= -8 && opp) score += 180;
        if (discDiff >= 8 && own) score -= 180;
        if (empty) score -= 2200;
        return score;
    case 'STRONG_WIND_WILL':
        score += opp ? 180 : -220;
        if (corner) score += opp ? 2200 : -3400;
        else if (edge) score += opp ? 620 : -900;
        score += destructiveMarkerScore * 0.9;
        score += (oppAdj - ownAdj) * 55;
        score += seatValue * (opp ? 0.14 : -0.08);
        {
            const landingProfile = getStrongWindLandingProfile(row, col);
            if (landingProfile) {
                score += landingProfile.maxDistance * (opp ? 70 : 40);
                if (opp) {
                    score -= landingProfile.longestCornerCount * 260;
                    score -= landingProfile.longestEdgeCount * 80;
                    score -= landingProfile.longestRiskCount * 55;
                    score -= landingProfile.averageBonus * 90;
                } else if (own) {
                    score += landingProfile.longestCornerCount * 360;
                    score += landingProfile.longestEdgeCount * 90;
                    score += landingProfile.averageBonus * 110;
                    score -= landingProfile.longestRiskCount * 40;
                }
            }
        }
        if (discDiff >= 6 && own) score -= 220;
        return score;
    case 'SUPER_BUOYANCY_WILL':
    case 'SUPER_GRAVITY_WILL':
        score += opp ? 220 : -260;
        if (corner) score += opp ? 2800 : -3800;
        else if (edge) score += opp ? 840 : -1100;
        score += getForcedCornerLaneBonus(pendingType, row, col, board, playerValue);
        score += getForcedCornerLaneAntiPatternPenalty(pendingType, row, col, board, playerValue);
        if (own) {
            if (edge) score += 560;
            if (corner) score -= 1200;
        }
        if (opp) {
            if (corner) score -= 3200;
            else if (edge) score -= 920;
        }
        score += destructiveMarkerScore * 1.15;
        score += (oppAdj - ownAdj) * 80;
        if (discDiff >= 6 && own) score -= 260;
        return score;
    case 'SWAP_WITH_ENEMY':
        score += opp ? 260 : -600;
        if (corner) score += opp ? 3600 : -2600;
        else if (edge) score += opp ? 1100 : -900;
        score += destructiveMarkerScore * 1.3;
        score += (oppAdj - ownAdj) * 120;
        score += seatValue * 0.18;
        if (discDiff <= -8) score += 200;
        return score;
    case 'POSITION_SWAP_WILL': {
        const first = pending && pending.firstTarget ? pending.firstTarget : null;
        if (first && Number.isInteger(first.row) && Number.isInteger(first.col)) {
            const firstCell = getBoardCellValueSafe(board, first.row, first.col);
            const firstOwn = firstCell === playerValue;
            const firstOpp = firstCell === opponentValue;
            const firstMarkerProfile = getMarkerProfileAt(playerKey, first.row, first.col);
            const firstSeatValue = scoreSeatStrategicValue(playerKey, first.row, first.col, firstMarkerProfile);
            if (firstOpp) {
                score += own ? 460 : -500;
                if (corner && own) score -= 3400;
                else if (edge && own) score -= 900;
                else if (own) score += 260;
                if (own) score += (firstSeatValue - seatValue) * 0.35;
            } else if (firstOwn) {
                score += opp ? 520 : -520;
                if (corner && opp) score += 3500;
                else if (edge && opp) score += 1000;
                else if (opp) score += 220;
                if (corner && own) score -= 3200;
                if (opp) score += (seatValue - firstSeatValue) * 0.35;
            } else {
                score += opp ? 180 : (own ? -120 : 0);
            }
            score += destructiveMarkerScore;
            return score;
        }
        // First pick: prefer grabbing strong opponent stones first.
        score += opp ? 220 : -160;
        if (corner && opp) score += 2900;
        else if (edge && opp) score += 900;
        if (corner && own) score -= 2600;
        score += destructiveMarkerScore * 1.1;
        score += seatValue * 0.14;
        return score;
    }
    case 'TRAP_WILL':
        if (!own) return -2800;
        if (corner) score -= 1800;
        else if (edge) score += 220;
        score += (oppAdj * 180) - (ownAdj * 60) + (emptyAdj * 30);
        score += markerProfile.ownSpecialScore * 0.3;
        return score;
    case 'GUARD_WILL':
    case 'GUARDIAN_GOD':
        if (!own) return -2800;
        if (corner) score -= 5200;
        else if (edge) score += 360;
        score += bonus * 110;
        score += (ownAdj * 40) + (oppAdj * 20);
        score += markerProfile.ownSpecialScore * 1.15;
        if (timedProfile) {
            score += timedProfile.ownTimedScore * 3.1;
            score += timedProfile.ownRemainingSum * 70;
            score += timedProfile.ownCriticalCount * 380;
            if (timedProfile.ownTimedCount <= 0 && markerProfile.ownSpecialScore <= 0) score -= 2200;
        } else if (markerProfile.ownSpecialScore <= 0) {
            score -= 900;
        }
        // Guard effects are wasted on inherently stable corners. Prefer
        // vulnerable high-value timed stones (work, robot, dragons, observer).
        if (corner) {
            score -= 1800;
            if (timedProfile && timedProfile.ownTimedCount > 0) score -= 1200;
        }
        if (markerProfile.ownSpecialScore >= 260 && (!timedProfile || timedProfile.ownTimedCount <= 0)) {
            score -= 1200;
        }
        if (markerProfile.ownSpecialScore >= 520 && (!timedProfile || timedProfile.ownCriticalCount <= 0)) {
            score -= 800;
        }
        if (timedProfile) {
            if (timedProfile.ownTimedCount > 0) score += 900;
            if (timedProfile.ownCriticalCount > 0) score += 1400;
        }
        return score;
    case 'LIVING_WILL': {
        if (!own) return -2800;
        const hasGuard = hasSpecialMarkerTypeAt(row, col, 'GUARD');
        const hasRegen = hasSpecialMarkerTypeAt(row, col, 'REGEN');
        if (corner) score += 260;
        else if (edge) score += 180;
        score += bonus * 90;
        score += seatValue * 0.12;
        score += markerProfile.ownSpecialScore * 1.85;
        score += (oppAdj * 48) - (ownAdj * 10) + (emptyAdj * 24);
        if (timedProfile) {
            score += timedProfile.ownTimedScore * 2.7;
            score += timedProfile.ownRemainingSum * 48;
            score += timedProfile.ownCriticalCount * 560;
            if (timedProfile.ownTimedCount > 0) score += 820;
            if (timedProfile.ownCriticalCount > 0) score += 1250;
        }
        if (markerProfile.ownSpecialScore <= 0 && (!timedProfile || timedProfile.ownTimedCount <= 0)) {
            score -= 1200;
        }
        if (hasGuard) score -= 700;
        if (hasRegen) score += 460;
        return score;
    }
    case 'HYPERACTIVE_INHERIT_WILL':
        if (!own) return -2800;
        if (corner) score -= 420;
        else if (edge) score += 140;
        score += (emptyAdj * 140) + (oppAdj * 90);
        score += markerProfile.ownSpecialScore * 0.6;
        return score;
    case 'EXTEND_LIFE_WILL':
    case 'EXTEND_LIFE_GOD': {
        const isExtendLifeGod = String(pendingType || '') === 'EXTEND_LIFE_GOD';
        if (!own) return -2800;
        if (corner) score += isExtendLifeGod ? 680 : 520;
        else if (edge) score += isExtendLifeGod ? 320 : 220;
        score += markerProfile.ownSpecialScore * (isExtendLifeGod ? 2.8 : 2.0);
        if (timedProfile) {
            score += timedProfile.ownTimedScore * (isExtendLifeGod ? 3.1 : 2.2);
            score += timedProfile.ownRemainingSum * (isExtendLifeGod ? 68 : 52);
            score += timedProfile.ownCriticalCount * (isExtendLifeGod ? 360 : 260);
            score -= timedProfile.oppTimedScore * 1.3;
            if (timedProfile.ownTimedCount <= 0) score -= isExtendLifeGod ? 1800 : 1400;
        }
        score += seatValue * 0.08;
        score += (oppAdj * (isExtendLifeGod ? 52 : 40));
        return score;
    }
    case 'CORROSION_WILL':
        if (!onBoard) return -2800;
        score += markerProfile.oppSpecialScore * 2.2;
        score -= markerProfile.ownSpecialScore * 1.6;
        score += (markerProfile.oppBombCount * 220) - (markerProfile.ownBombCount * 140);
        if (timedProfile) {
            score += timedProfile.oppTimedScore * 2.3;
            score += timedProfile.oppRemainingSum * 60;
            score += timedProfile.oppCriticalCount * 180;
            score -= timedProfile.ownTimedScore * 1.8;
            score -= timedProfile.ownRemainingSum * 46;
            if (timedProfile.oppTimedCount <= 0 && markerProfile.oppSpecialScore <= 0) score -= 1800;
        }
        if (opp) score += 260;
        if (own) score -= 180;
        if (corner) score += opp ? 900 : -900;
        else if (edge) score += opp ? 240 : -240;
        score += seatValue * (opp ? 0.06 : -0.04);
        score += (oppAdj - ownAdj) * 30;
        return score;
    case 'TELEPORT_WILL':
        score += opp ? 160 : -220;
        if (corner) score += opp ? 4200 : -5200;
        else if (edge) score += opp ? 900 : -900;
        score += destructiveMarkerScore;
        score += (oppAdj - ownAdj) * 45;
        return score;
    case 'CELL_TELEPORT_WILL':
        score += opp ? 220 : (own ? -280 : 60);
        if (corner) score += opp ? 3000 : -4200;
        else if (edge) score += opp ? 900 : -1200;
        if (!onBoard) score += opp ? 420 : (own ? -520 : 80);
        score += destructiveMarkerScore * 1.15;
        score += (oppAdj - ownAdj) * 70;
        return score;
    case 'TEMPT_WILL':
    case 'CAPTURE_WILL':
        score += opp ? 300 : -400;
        if (corner) score += opp ? 2600 : -2200;
        else if (edge) score += opp ? 900 : -700;
        score += destructiveMarkerScore * 1.5;
        return score;
    case 'CLONE_WILL':
        if (!own) return -2600;
        if (level >= 6 && !isCloneSplitEligibleSource(playerKey, row, col, markerProfile)) return -8000;
        if (corner) score -= 260;
        else if (edge) score += 120;
        score += (emptyAdj * 165) + (oppAdj * 95) - (ownAdj * 18);
        score += markerProfile.ownSpecialScore * 0.85;
        score += markerProfile.ownBombCount * 180;
        score += seatValue * 0.06;
        if (timedProfile) {
            score += timedProfile.ownTimedScore * 1.05;
            score += timedProfile.ownRemainingSum * 30;
            score += timedProfile.ownTimedCount * 160;
        }
        if (emptyAdj <= 1) score -= 120;
        return score;
    case 'SPLIT_WILL':
        if (!own) return -2600;
        if (level >= 6 && !isCloneSplitEligibleSource(playerKey, row, col, markerProfile)) return -8000;
        if (corner) score -= 920;
        else if (edge) score += 60;
        score += (emptyAdj * 155) + (oppAdj * 80) - (ownAdj * 26);
        score -= markerProfile.ownSpecialScore * 1.35;
        score -= markerProfile.ownBombCount * 220;
        score -= seatValue * 0.05;
        if (timedProfile) {
            score -= timedProfile.ownTimedScore * 0.95;
            score -= timedProfile.ownRemainingSum * 42;
            score -= timedProfile.ownTimedCount * 120;
            score += timedProfile.ownCriticalCount * 180;
        } else if (markerProfile.ownSpecialScore <= 0 && markerProfile.ownBombCount <= 0) {
            score += 180;
        }
        if (emptyAdj <= 1) score -= 120;
        return score;
    case 'METEOR_WILL':
        score += opp ? 240 : (own ? -260 : 40);
        if (corner) score += opp ? 260 : (own ? -4200 : 260);
        else if (edge) score += opp ? 1000 : (own ? -1100 : 120);
        score += destructiveMarkerScore * 1.4;
        score += (oppAdj - ownAdj) * 90;
        return score;
    case 'BOARD_SHRINK_WILL':
        if (hasSpecialMarkerTypeAt(row, col, 'ABSOLUTE_PROTECTED')) return -5200;
        score += opp ? 220 : (own ? -280 : 60);
        if (corner) score += opp ? 1400 : (own ? -5200 : 320);
        else if (edge) score += opp ? 820 : (own ? -960 : 180);
        score += destructiveMarkerScore * 1.55;
        score += (oppAdj - ownAdj) * 88;
        score += bonus * 100;
        return score;
    case 'BOARD_SHRINK_GOD': {
        if (Array.isArray(target.lineCells) && target.lineCells.length > 0) {
            return scoreBoardShrinkLine(target.lineCells);
        }
        if (Array.isArray(target.lineTargets) && target.lineTargets.length > 0) {
            let bestLineScore = Number.NEGATIVE_INFINITY;
            for (const lineTarget of target.lineTargets) {
                const oneLineScore = scoreBoardShrinkLine(lineTarget && lineTarget.lineCells);
                if (oneLineScore > bestLineScore) bestLineScore = oneLineScore;
            }
            return bestLineScore + (target.lineTargets.length * 60);
        }
        if (hasSpecialMarkerTypeAt(row, col, 'ABSOLUTE_PROTECTED')) score -= 420;
        score += corner ? 240 : 40;
        score += destructiveMarkerScore * 0.6;
        return score;
    }
    case 'BLOCKADE_WILL':
        if (!empty && onBoard) score -= 1800;
        if (edge) score += 220;
        if (cornerHint) {
            const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
            if (cornerCell === 0) {
                score += cornerHint.kind === 'X' ? 900 : 520;
            }
        }
        score += (oppAdj * 130) - (ownAdj * 40);
        if (!onBoard) score += 260;
        return score;
    case 'SEED_WILL':
        if (!empty && onBoard) return -2400;
        if (corner) score -= 1600;
        else if (edge) score += 380;
        else score += 180;
        if (cornerHint) {
            const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
            if (cornerCell === 0) {
                score += cornerHint.kind === 'X' ? -1400 : -520;
            } else if (cornerCell === playerValue) {
                score += cornerHint.kind === 'X' ? 220 : 140;
            }
        }
        score += (ownAdj * 85) - (oppAdj * 30);
        score += emptyAdj * 36;
        score += bonus * 110;
        score += seatValue * 0.08;
        if (discDiff <= -8) score += 120;
        if (discDiff >= 10) score -= 90;
        return score;
    case 'WORK_WILL':
    case 'OBSERVER_WILL':
        if (!own) return -2800;
        if (corner) score += 2600;
        else if (edge) score += 1680;
        else score -= 1100;
        if (cornerHint) {
            const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
            if (cornerCell === 0) {
                score += cornerHint.kind === 'X' ? -2200 : -1300;
            }
        }
        score += bonus * 160;
        score += (ownAdj * 80) - (oppAdj * 120);
        if (emptyAdj <= 2) score += 180;
        else if (emptyAdj >= 4) score -= 520;
        if (!corner && !edge && ownAdj <= 1) score -= 640;
        if (!corner && !edge && oppAdj >= ownAdj) score -= 360;
        if (discDiff <= -10) score += 120;
        return score;
    case 'BOARD_EXPANSION_WILL':
    case 'BOARD_EXPANSION_GOD': {
        const side = String(target.side || '');
        if (onBoard) {
            if (own) score += 260;
            else if (empty) score += 120;
            else if (opp) score += 40;
            if (row === 0 || row === 7) score += 180;
            score += seatValue * 0.12;
        } else {
            score += 120;
        }
        if (side === 'left' || side === 'right') {
            const topCorner = getBoardCellValueSafe(board, 0, side === 'left' ? 0 : 7);
            const bottomCorner = getBoardCellValueSafe(board, 7, side === 'left' ? 0 : 7);
            if (topCorner === opponentValue || bottomCorner === opponentValue) score += 220;
            if (topCorner === playerValue || bottomCorner === playerValue) score += 140;
        }
        return score;
    }
    default:
        // Deterministic stable fallback.
        score += (corner ? 12 : 0) + (edge ? 4 : 0) + bonus;
        return score;
    }
}

function choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending) {
    if (
        PendingTargetSelector &&
        typeof PendingTargetSelector.choosePendingTargetWithPolicy === 'function'
    ) {
        return PendingTargetSelector.choosePendingTargetWithPolicy({
            playerKey,
            pendingType,
            pending,
            targets,
            scoreTarget: (target) => scorePendingTargetByType(playerKey, pendingType, target, pending)
        });
    }

    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const one of targets) {
        const score = scorePendingTargetByType(playerKey, pendingType, one, pending);
        if (score > bestScore) {
            bestScore = score;
            best = one;
            continue;
        }
        if (score === bestScore && best) {
            const row = Number(one && one.row);
            const col = Number(one && one.col);
            const bestRow = Number(best && best.row);
            const bestCol = Number(best && best.col);
            if (row < bestRow || (row === bestRow && col < bestCol)) {
                best = one;
            }
        }
    }
    return best || targets[0];
}

const PENDING_SELECTION_ONNX_TIMEOUT = { kind: 'pending-selection-onnx-timeout' };
const PENDING_SELECTION_VALUE_WEIGHT = 220;

const CPU_ONNX_BUDGET_TIMEOUT = { kind: 'cpu-onnx-budget-timeout' };

function resolvePendingSelectionOnnxBudgetMs(level) {
    return resolveCpuLv6OnnxRuntimeBudgetMs(level, 'choosePendingTarget');
}

async function awaitCpuPromiseWithinBudget(promiseFactory, budgetMs, timeoutValue) {
    if (typeof promiseFactory !== 'function') return null;
    if (
        !Number.isFinite(budgetMs) ||
        budgetMs <= 0 ||
        typeof setTimeout !== 'function' ||
        typeof clearTimeout !== 'function'
    ) {
        return promiseFactory();
    }
    let timeoutId = null;
    try {
        return await Promise.race([
            Promise.resolve().then(() => promiseFactory()),
            new Promise((resolve) => {
                timeoutId = setTimeout(() => resolve(timeoutValue), budgetMs);
            })
        ]);
    } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
    }
}

function resolveCurrentLegalMovesCountForPlayer(playerKey) {
    if (typeof getLegalMoves !== 'function' || !gameState) return 0;
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    try {
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(playerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const legalMoves = getLegalMoves(gameState, protection, perma) || [];
        return Array.isArray(legalMoves) ? legalMoves.length : 0;
    } catch (e) {
        return 0;
    }
}

function buildPendingTargetOnnxContext(playerKey, level, pendingType, targets) {
    const handCardIds = getHandCardIdsForPlayer(playerKey);
    const context = buildOnnxContext(
        playerKey,
        level,
        resolveCurrentLegalMovesCountForPlayer(playerKey),
        handCardIds,
        null,
        targets
    );
    context.pendingType = pendingType || context.pendingType;
    return context;
}

function simulateBoardForPendingTarget(playerKey, pendingType, target) {
    const board = getCurrentCpuBoard();
    if (!isPlayableBoard(board) || !target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    const type = String(pendingType || '');
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);

    if (type === 'FREE_PLACEMENT' || type === 'LAST_RESORT') {
        return simulatePendingPlacementBoard(board, playerValue, target);
    }

    if (type === 'DESTROY_ONE_STONE') {
        const next = cloneBoardForCpu(board);
        setBoardCellValue(next, target.row, target.col, 0);
        return next;
    }

    return null;
}

function buildPendingTargetValueContext(baseContext, pendingType, target, boardOverride) {
    const normalizedTarget = (target && Number.isFinite(target.row) && Number.isFinite(target.col))
        ? {
            row: Number(target.row),
            col: Number(target.col),
            flips: Array.isArray(target.flips) ? target.flips.slice() : []
        }
        : null;
    return Object.assign({}, baseContext || {}, {
        pendingType: pendingType || (baseContext && baseContext.pendingType) || null,
        board: boardOverride || (baseContext && baseContext.board) || null,
        candidateMoves: normalizedTarget ? [normalizedTarget] : [],
        legalMovesCount: normalizedTarget ? 1 : ((baseContext && baseContext.legalMovesCount) || 0)
    });
}

async function evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, target, budgetMs) {
    if (!runtime || typeof runtime.evaluatePosition !== 'function') return null;
    const valueBudgetMs = Number.isFinite(budgetMs) && budgetMs > 0
        ? Math.max(12, Math.floor(budgetMs / 2))
        : 0;
    const boardOverride = simulateBoardForPendingTarget(playerKey, pendingType, target);
    const valueContext = buildPendingTargetValueContext(baseContext, pendingType, target, boardOverride);
    const value = await awaitCpuPromiseWithinBudget(
        () => runtime.evaluatePosition(valueContext),
        valueBudgetMs,
        PENDING_SELECTION_ONNX_TIMEOUT
    );
    if (value === PENDING_SELECTION_ONNX_TIMEOUT) return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

function resolvePendingTargetOverrideThreshold(pendingType) {
    const type = String(pendingType || '');
    if (type === 'FREE_PLACEMENT' || type === 'LAST_RESORT') return 240;
    return 24;
}

async function rerankOnnxPendingTargetChoice(runtime, selectedTarget, playerKey, level, pendingType, targets, pending, baseContext, budgetMs) {
    const selected = resolveCandidateMoveByCoord(targets, selectedTarget) || selectedTarget;
    const fallback = choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending);
    if (!selected || !fallback || isSameMoveByCoord(selected, fallback)) {
        return { target: selected || fallback || targets[0], changed: false, gap: 0, selectedValue: null, fallbackValue: null };
    }

    const selectedHeuristic = scorePendingTargetByType(playerKey, pendingType, selected, pending);
    const fallbackHeuristic = scorePendingTargetByType(playerKey, pendingType, fallback, pending);
    let selectedComposite = Number.isFinite(selectedHeuristic) ? Number(selectedHeuristic) : Number.NEGATIVE_INFINITY;
    let fallbackComposite = Number.isFinite(fallbackHeuristic) ? Number(fallbackHeuristic) : Number.NEGATIVE_INFINITY;

    const selectedValue = await evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, selected, budgetMs);
    const fallbackValue = await evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, fallback, budgetMs);
    if (Number.isFinite(selectedValue)) selectedComposite += selectedValue * PENDING_SELECTION_VALUE_WEIGHT;
    if (Number.isFinite(fallbackValue)) fallbackComposite += fallbackValue * PENDING_SELECTION_VALUE_WEIGHT;

    const gap = fallbackComposite - selectedComposite;
    const shouldOverride = (
        (!Number.isFinite(selectedComposite) && Number.isFinite(fallbackComposite)) ||
        gap >= resolvePendingTargetOverrideThreshold(pendingType)
    );

    return {
        target: shouldOverride ? fallback : selected,
        changed: shouldOverride,
        gap,
        selectedValue,
        fallbackValue
    };
}

async function choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) {
    const fallback = choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending);
    if (!Array.isArray(targets) || targets.length <= 0) return null;

    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const runtime = resolvePolicyOnnxRuntime();
    if (
        !runtime ||
        typeof runtime.choosePendingTarget !== 'function' ||
        !Number.isFinite(level) ||
        level < 6
    ) {
        return fallback || targets[0];
    }
    if (!canUseStandardBoardCpuPolicy(null, 'onnx-pending-target', playerKey, level)) {
        return fallback || targets[0];
    }

    const budgetMs = resolvePendingSelectionOnnxBudgetMs(level);
    const baseContext = buildPendingTargetOnnxContext(playerKey, level, pendingType, targets);
    const preGate = evaluateCpuOnnxLatencyGate(runtime, 'choosePendingTarget', level);
    if (preGate.shouldDegrade) {
        logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', preGate.reason);
        return fallback || targets[0];
    }

    try {
        const selected = await awaitCpuPromiseWithinBudget(
            () => runtime.choosePendingTarget(targets, baseContext),
            budgetMs,
            CPU_ONNX_BUDGET_TIMEOUT
        );
        if (selected === CPU_ONNX_BUDGET_TIMEOUT) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', `timeout ${String(pendingType || '')} budget=${budgetMs}ms`);
            return fallback || targets[0];
        }
        const postGate = evaluateCpuOnnxLatencyGate(runtime, 'choosePendingTarget', level);
        if (postGate.shouldDegrade) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', postGate.reason);
            return fallback || targets[0];
        }
        if (!selected) return fallback || targets[0];

        const reranked = await rerankOnnxPendingTargetChoice(
            runtime,
            selected,
            playerKey,
            level,
            pendingType,
            targets,
            pending,
            baseContext,
            budgetMs
        );
        if (reranked && reranked.changed) {
            const chosen = reranked.target;
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ONNX対象を再評価 ${String(pendingType || '')} gap=${Number.isFinite(reranked.gap) ? reranked.gap.toFixed(1) : 'NA'} -> (${chosen.row},${chosen.col})`
            );
        }
        return (reranked && reranked.target) || resolveCandidateMoveByCoord(targets, selected) || selected || fallback || targets[0];
    } catch (e) {
        console.warn('[CPU] policy-onnx pending runtime failed, fallback to default policy', e);
        return fallback || targets[0];
    }
}

/**
 * 破壊対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectDestroyWithPolicy(playerKey) {
    const level = cpuSmartness[playerKey] || 1;
    const board = getCurrentCpuBoard();
    const selectorTargets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    let targets = Array.isArray(selectorTargets)
        ? selectorTargets.filter((target) => {
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return false;
            const value = getBoardCellValueSafe(board, target.row, target.col);
            return value !== null && value !== 0;
        })
        : [];
    if (targets.length <= 0 && Array.isArray(board)) {
        const boardUtils = resolveSharedBoardUtilsModule();
        if (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function') {
            targets = boardUtils.collectBoardCoordinates(board)
                .filter((cell) => getBoardCellValueSafe(board, cell.row, cell.col) !== 0);
        } else {
            targets = [];
            for (let row = 0; row < board.length; row++) {
                const line = Array.isArray(board[row]) ? board[row] : [];
                for (let col = 0; col < line.length; col++) {
                    if (line[col] === 0) continue;
                    targets.push({ row, col });
                }
            }
        }
    }

    if (targets.length === 0) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'DESTROY_ONE_STONE', targets, null) || targets[0];

    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { destroyTarget: { row: target.row, col: target.col } },
        'DESTROY_ONE_STONE'
    );
    if (pipelineResult) return;

    // CPU must bypass UI lock-based handlers and apply effect directly.
    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyDestroyEffect === 'function') {
        const applied = !!CardLogic.applyDestroyEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
    // Fallback for legacy environments.
    if (typeof handleDestroySelection === 'function') {
        await handleDestroySelection(target.row, target.col, playerKey);
    }
}

/**
 * 強風の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectStrongWindWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 強風対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'STRONG_WIND_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 強風ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { strongWindTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'STRONG_WIND_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyStrongWindWill === 'function') {
        const res = CardLogic.applyStrongWindWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectSuperBuoyancyWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 超浮力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SUPER_BUOYANCY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 超浮力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { superBuoyancyTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'SUPER_BUOYANCY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySuperBuoyancyWill === 'function') {
        const res = CardLogic.applySuperBuoyancyWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectSuperGravityWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 超重力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SUPER_GRAVITY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 超重力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { superGravityTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'SUPER_GRAVITY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySuperGravityWill === 'function') {
        const res = CardLogic.applySuperGravityWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}


/**
 * 天の恵み 候補選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHeavenBlessingWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 天の恵み候補なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    let targetCardId = offers[0];
    let bestCost = -Infinity;
    let bestScore = Number.NEGATIVE_INFINITY;
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const player = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const protection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(player)
        : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = (typeof getLegalMoves === 'function')
        ? (getLegalMoves(gameState, protection, perma) || [])
        : [];
    const usableCards = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
        ? cardState.hands[playerKey].slice()
        : [];
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMoves.length, legalMoves, usableCards);

    for (const cardId of offers) {
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(cardId) || 0)
            : 0;
        let score = cost * 0.35;
        if (
            CpuPolicyCore &&
            typeof CpuPolicyCore.scoreCardUseDecision === 'function' &&
            typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.getCardDef === 'function' &&
            typeof CardLogic.getCardCost === 'function'
        ) {
            const useDecision = CpuPolicyCore.scoreCardUseDecision(
                cardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                decisionContext
            );
            const retention = (typeof CpuPolicyCore.scoreCardRetentionPriority === 'function')
                ? CpuPolicyCore.scoreCardRetentionPriority(
                    cardId,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    decisionContext
                )
                : null;
            if (useDecision && Number.isFinite(useDecision.score)) {
                score += Number(useDecision.score) * 0.95;
                if (useDecision.shouldUse === true) score += 18;
            }
            if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.8;
        }
        if (score > bestScore || (score === bestScore && cost > bestCost)) {
            bestScore = score;
            bestCost = cost;
            targetCardId = cardId;
        }
    }
    cpuDebugLog(`[CPU] ${playerKey}: 天の恵み選択 ${targetCardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { heavenBlessingCardId: targetCardId },
        'HEAVEN_BLESSING'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyHeavenBlessingChoice === 'function') {
        const res = CardLogic.applyHeavenBlessingChoice(cardState, playerKey, targetCardId);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            const actor = playerKey === 'black' ? '黒' : '白';
            emitCpuEffectLog(`${actor}: 天の恵みでカード獲得`);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 断罪の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCondemnWillWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 断罪候補なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    let target = offers[0];
    let bestCost = -Infinity;
    let bestScore = Number.NEGATIVE_INFINITY;
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentValue = opponentKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const opponentProtection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(opponentValue)
        : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const opponentLegalMoves = (typeof getLegalMoves === 'function')
        ? (getLegalMoves(gameState, opponentProtection, perma) || [])
        : [];
    const opponentUsableCards = (cardState && cardState.hands && Array.isArray(cardState.hands[opponentKey]))
        ? cardState.hands[opponentKey].slice()
        : [];
    const opponentContext = buildCardUseDecisionContext(
        opponentKey,
        level,
        opponentLegalMoves.length,
        opponentLegalMoves,
        opponentUsableCards
    );
    for (const offer of offers) {
        if (!offer || !offer.cardId) continue;
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(offer.cardId) || 0)
            : 0;
        let score = cost * 0.45;
        if (
            CpuPolicyCore &&
            typeof CpuPolicyCore.scoreCardRetentionPriority === 'function' &&
            typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.getCardDef === 'function' &&
            typeof CardLogic.getCardCost === 'function'
        ) {
            const retention = CpuPolicyCore.scoreCardRetentionPriority(
                offer.cardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                opponentContext
            );
            const useDecision = (typeof CpuPolicyCore.scoreCardUseDecision === 'function')
                ? CpuPolicyCore.scoreCardUseDecision(
                    offer.cardId,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    opponentContext
                )
                : null;
            if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.9;
            if (useDecision && Number.isFinite(useDecision.score)) {
                score += Number(useDecision.score) * 0.75;
                if (useDecision.shouldUse === true) score += 16;
            }
        }
        if (score > bestScore || (score === bestScore && cost > bestCost)) {
            bestScore = score;
            bestCost = cost;
            target = offer;
        }
    }
    if (!target || !Number.isInteger(target.handIndex)) {
        clearCpuPendingEffect(playerKey);
        return;
    }
    cpuDebugLog(`[CPU] ${playerKey}: 断罪選択 index=${target.handIndex} card=${target.cardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { condemnTargetIndex: target.handIndex },
        'CONDEMN_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCondemnWill === 'function') {
        const res = CardLogic.applyCondemnWill(cardState, playerKey, target.handIndex);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 交換の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSwapWithEnemyWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 交換対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SWAP_WITH_ENEMY', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 交換ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { swapTarget: { row: target.row, col: target.col } },
        'SWAP_WITH_ENEMY'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySwapEffect === 'function') {
        const applied = !!CardLogic.applySwapEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            handOffSelectionTurnInGameState(playerKey);
            maybeContinueCpuSelectionTurnHandoff(playerKey, 'SWAP_WITH_ENEMY', []);
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handleSwapSelection === 'function') {
        await handleSwapSelection(target.row, target.col, playerKey);
    }
}

/**
 * 入替の意志 対象選択（2段階）
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectPositionSwapWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 入替対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const pending = readCpuPendingEffect(playerKey);
    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'POSITION_SWAP_WILL', targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 入替ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { positionSwapTarget: { row: target.row, col: target.col } },
        'POSITION_SWAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyPositionSwapWill === 'function') {
        const res = CardLogic.applyPositionSwapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handlePositionSwapSelection === 'function') {
        await handlePositionSwapSelection(target.row, target.col, playerKey);
    }
}

/**
 * 罠の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTrapWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 罠対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TRAP_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 罠ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { trapTarget: { row: target.row, col: target.col } },
        'TRAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTrapWill === 'function') {
        const res = CardLogic.applyTrapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            handOffSelectionTurnInGameState(playerKey);
            maybeContinueCpuSelectionTurnHandoff(playerKey, 'TRAP_WILL', []);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 守る意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectGuardWillWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD'))
        ? pending.type
        : 'GUARD_WILL';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 守る対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 守るターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { guardTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyGuardWill === 'function') {
        const res = CardLogic.applyGuardWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 生きる意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectLivingWillWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = (pending && pending.type === 'LIVING_WILL') ? pending.type : 'LIVING_WILL';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getLivingWillTargets === 'function')
        ? CardLogic.getLivingWillTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 生きる意志対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 生きる意志ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { livingWillTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyLivingWill === 'function') {
        const res = CardLogic.applyLivingWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 多動の継承 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHyperactiveInheritWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getHyperactiveInheritTargets === 'function')
        ? CardLogic.getHyperactiveInheritTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 継承多動対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'HYPERACTIVE_INHERIT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 継承多動ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { hyperactiveInheritTarget: { row: target.row, col: target.col } },
        'HYPERACTIVE_INHERIT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyHyperactiveInheritWill === 'function') {
        const res = CardLogic.applyHyperactiveInheritWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 延命系カード 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectExtendLifeWillWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && pending.type === 'EXTEND_LIFE_GOD'
        ? 'EXTEND_LIFE_GOD'
        : 'EXTEND_LIFE_WILL';
    const applyMethodName = pendingType === 'EXTEND_LIFE_GOD' ? 'applyExtendLifeGod' : 'applyExtendLifeWill';
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getExtendLifeTargets === 'function')
        ? CardLogic.getExtendLifeTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${pendingType === 'EXTEND_LIFE_GOD' ? '延命神' : '延命'}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${pendingType === 'EXTEND_LIFE_GOD' ? '延命神' : '延命'}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { extendTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic[applyMethodName] === 'function') {
        const res = CardLogic[applyMethodName](cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 腐食の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCorrosionWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getCorrosionTargets === 'function')
        ? CardLogic.getCorrosionTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 腐食対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CORROSION_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 腐食ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { corrosionTarget: { row: target.row, col: target.col } },
        'CORROSION_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCorrosionWill === 'function') {
        const res = CardLogic.applyCorrosionWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

function scoreTimeBombTarget(playerKey, target) {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return -Infinity;
    const board = getCurrentCpuBoard();
    if (!board) return -Infinity;
    if (getBoardCellValueSafe(board, target.row, target.col) === null) return -Infinity;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const stats = countBoardStatsForPlayer(playerValue);
    let score = 0;
    let oppCornerHits = 0;
    let ownCornerHits = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = target.row + dr;
            const c = target.col + dc;
            const cell = getBoardCellValueSafe(board, r, c);
            if (cell === null || cell === 0) continue;

            const corner = isCornerCell(r, c, board);
            const edge = isEdgeCell(r, c, board);
            const weight = corner ? 12 : (edge ? 4 : 2);
            const isOwn = cell === playerValue;
            const markerProfile = getMarkerProfileAt(playerKey, r, c);
            const timedProfile = getTimedMarkerProfileAt(playerKey, r, c);
            if (isOwn) {
                score -= weight * 100;
                score -= markerProfile.ownSpecialScore * 0.55;
                score -= markerProfile.ownBombCount * 160;
                score -= timedProfile.ownRemainingSum * 36;
                if (corner) ownCornerHits += 1;
            } else {
                score += weight * 100;
                score += markerProfile.oppSpecialScore * 0.55;
                score += markerProfile.oppBombCount * 160;
                score += timedProfile.oppRemainingSum * 36;
                if (corner) oppCornerHits += 1;
            }
        }
    }

    if (stats.discDiff <= -8) score += 140;
    if (stats.discDiff <= -14) score += 80;
    if (stats.discDiff >= 8) score -= 140;
    if (stats.discDiff >= 12) score -= 70;
    if (oppCornerHits > 0) score += 2400 * oppCornerHits;
    if (ownCornerHits > 0) score -= 3200 * ownCornerHits;
    if (stats.discDiff >= 0 && oppCornerHits <= 0) score -= 220;

    // Deterministic tie-break jitter from injected RNG.
    score += cpuRng.random() * 0.01;
    return score;
}

function chooseTimeBombTargetWithPolicy(playerKey, targets) {
    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const target of targets) {
        const score = scoreTimeBombTarget(playerKey, target);
        if (score > bestScore) {
            bestScore = score;
            best = target;
        }
    }
    return best || targets[0];
}

/**
 * 時限爆弾 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTimeBombWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getTimeBombTargets === 'function')
        ? CardLogic.getTimeBombTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = chooseTimeBombTargetWithPolicy(playerKey, targets);
    if (!target) {
        clearCpuPendingEffect(playerKey);
        return;
    }
    cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { bombTarget: { row: target.row, col: target.col } },
        'TIME_BOMB'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTimeBombWill === 'function') {
        const res = CardLogic.applyTimeBombWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 盤面拡張 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardExpansionWillWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_EXPANSION_WILL';
    const isGodExpansion = pendingType === 'BOARD_EXPANSION_GOD';
    const cardLabel = isGodExpansion ? '盤面拡張神' : '盤面拡張';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { expansionTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    const applyFn = (typeof CardLogic !== 'undefined' && isGodExpansion && typeof CardLogic.applyBoardExpansionGod === 'function')
        ? CardLogic.applyBoardExpansionGod
        : (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBoardExpansionWill === 'function'
            ? CardLogic.applyBoardExpansionWill
            : null);

    if (typeof applyFn === 'function') {
        const res = applyFn(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 盤面縮小 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardShrinkWithPolicy(playerKey) {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_SHRINK_WILL';
    const isGodShrink = pendingType === 'BOARD_SHRINK_GOD';
    const cardLabel = isGodShrink ? '盤面縮小神' : '盤面縮小';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { shrinkTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    const applyFn = (typeof CardLogic !== 'undefined' && isGodShrink && typeof CardLogic.applyBoardShrinkGod === 'function')
        ? CardLogic.applyBoardShrinkGod
        : (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBoardShrinkWill === 'function'
            ? CardLogic.applyBoardShrinkWill
            : null);

    if (typeof applyFn === 'function') {
        const res = applyFn(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 封鎖の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBlockadeWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 封鎖対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'BLOCKADE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 封鎖ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { blockadeTarget: { row: target.row, col: target.col } },
        'BLOCKADE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBlockadeWill === 'function') {
        const res = CardLogic.applyBlockadeWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 隕石 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectMeteorWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 隕石対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'METEOR_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 隕石ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { meteorTarget: { row: target.row, col: target.col } },
        'METEOR_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyMeteorWill === 'function') {
        const res = CardLogic.applyMeteorWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 凍結の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectFreezeWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 凍結対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'FREEZE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 凍結ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { freezeTarget: { row: target.row, col: target.col } },
        'FREEZE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyFreezeWill === 'function') {
        const res = CardLogic.applyFreezeWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 種まきの意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSeedWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 種まき対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SEED_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 種まきターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { seedTarget: { row: target.row, col: target.col } },
        'SEED_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySeedWill === 'function') {
        const res = CardLogic.applySeedWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 複製の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCloneWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const eligibleTargets = filterCloneSplitTargetsForLv6(playerKey, targets);
    if (!eligibleTargets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし (通常石は除外)`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CLONE_WILL', eligibleTargets, null) || eligibleTargets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 複製ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { cloneTarget: { row: target.row, col: target.col } },
        'CLONE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCloneWill === 'function') {
        const res = CardLogic.applyCloneWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 分裂の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSplitWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 分裂対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const eligibleTargets = filterCloneSplitTargetsForLv6(playerKey, targets);
    if (!eligibleTargets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 分裂対象なし (通常石は除外)`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SPLIT_WILL', eligibleTargets, null) || eligibleTargets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 分裂ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { splitTarget: { row: target.row, col: target.col } },
        'SPLIT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySplitWill === 'function') {
        const res = CardLogic.applySplitWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * テレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTeleportWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: テレポート対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TELEPORT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: テレポートターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { teleportTarget: { row: target.row, col: target.col } },
        'TELEPORT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTeleportWill === 'function') {
        const res = CardLogic.applyTeleportWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * マステレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCellTeleportWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: マステレポート対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CELL_TELEPORT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: マステレポートターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { teleportTarget: { row: target.row, col: target.col } },
        'CELL_TELEPORT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCellTeleportWill === 'function') {
        const res = CardLogic.applyCellTeleportWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 誘惑の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTemptWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 誘惑対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TEMPT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 誘惑ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { temptTarget: { row: target.row, col: target.col } },
        'TEMPT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTemptWill === 'function') {
        const res = CardLogic.applyTemptWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handleTemptSelection === 'function') {
        await handleTemptSelection(target.row, target.col, playerKey);
    }
}

/**
 * 捕獲の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCaptureWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 捕獲対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CAPTURE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 捕獲ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { captureTarget: { row: target.row, col: target.col } },
        'CAPTURE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCaptureWill === 'function') {
        const res = CardLogic.applyCaptureWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    } else {
        clearCpuPendingEffect(playerKey);
        emitCpuSelectionStateChange();
    }
}

// UI-level exposure is handled by UI layer; Node/CommonJS consumers should use module.exports.


// Compute a CPU action WITHOUT side effects. Returns an action descriptor object:
// { type: 'move', move }
// { type: 'useCard', cardId, cardDef }
// { type: 'pass' }
function computeCpuAction(playerKey) {
    const level = cpuSmartness[playerKey] || 1;
    const player = playerKey === 'black' ? BLACK : WHITE;
    const protection = getActiveProtectionForPlayer(player);
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = getLegalMoves(gameState, protection, perma);

    if (!legalMoves.length) {
        // ask the centralized selector for a candidate
        let cardChoice = null;
        try {
            cardChoice = selectCardToUse(playerKey);
        } catch (e) {
            cardChoice = null;
        }
        if (cardChoice && cardChoice.cardId) {
            return { type: 'useCard', cardId: cardChoice.cardId, cardDef: cardChoice.cardDef };
        }
        return { type: 'pass' };
    }

    const move = selectCpuMoveWithPolicy(legalMoves, playerKey);
    return { type: 'move', move };
}

// Node.js環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cpuMaybeDestroyHandCardWithPolicy,
        cpuMaybeUseCardWithPolicy,
        selectHandCardToDestroy,
        applyHandCardDestroy,
        selectCardToUse,
        applyCardChoice,
        selectCpuMoveWithPolicy,
        selectMoveFromOnnxPolicyAsync,
        selectCardFromOnnxPolicyAsync,
        isCardChoiceAllowedByRisk,
        isCardChoiceAllowedByHighConfidence,
        hasPlanPressureProfileForCardType,
        buildCardUseDecisionContext,
        cpuSelectDestroyWithPolicy,
        cpuSelectHeavenBlessingWithPolicy,
        cpuSelectCondemnWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
        cpuSelectPositionSwapWillWithPolicy,
        cpuSelectTrapWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectLivingWillWithPolicy,
        cpuSelectCaptureWillWithPolicy,
        cpuSelectHyperactiveInheritWillWithPolicy,
        cpuSelectExtendLifeWillWithPolicy,
        cpuSelectCorrosionWillWithPolicy,
        cpuSelectSuperBuoyancyWillWithPolicy,
        cpuSelectSuperGravityWillWithPolicy,
        cpuSelectTeleportWillWithPolicy,
        cpuSelectCellTeleportWillWithPolicy,
        cpuSelectTimeBombWithPolicy,
        cpuSelectBoardExpansionWillWithPolicy,
        cpuSelectBoardShrinkWithPolicy,
        cpuSelectBlockadeWillWithPolicy,
        cpuSelectMeteorWillWithPolicy,
        cpuSelectFreezeWillWithPolicy,
        cpuSelectSeedWillWithPolicy,
        cpuSelectCloneWillWithPolicy,
        cpuSelectSplitWillWithPolicy,
        cpuSelectTemptWillWithPolicy,
        computeCpuAction,
        setCpuRng
    };
}

// Expose to global for environments that rely on global symbols (e.g., browser concatenation)
if (typeof global !== 'undefined') { global.computeCpuAction = computeCpuAction; global.selectCardToUse = selectCardToUse; global.applyCardChoice = applyCardChoice; }
// Register via UIBootstrap when available, fallback to globalThis for legacy global access
try {
    const uiBootstrap = require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ computeCpuAction });
} catch (e) { /* ignore */ }
try { if (typeof globalThis !== 'undefined') globalThis.computeCpuAction = computeCpuAction; } catch (e) {}
