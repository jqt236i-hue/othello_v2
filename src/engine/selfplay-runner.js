/**
 * @file selfplay-runner.js
 * @description Headless self-play runner backed by the production TurnPipeline.
 */

'use strict';

const path = require('path');
const Core = require('../../game/logic/core');
const CardLogic = require('../../game/logic/cards');
const TurnPipeline = require('../../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../../game/schema/prng');
const deepClone = require('../../utils/deepClone');
const CpuPolicyCore = require('../../game/ai/cpu-policy-core');
const CpuPolicyTableRuntime = require('../../game/ai/policy-table-runtime');
const CpuLv6LookaheadProfile = require('../../game/ai/cpu-lv6-lookahead-profile');
const SharedBoardUtils = require(path.resolve(__dirname, '..', '..', 'shared', 'shared-board-utils.js'));
const SharedCardHeuristics = require(path.resolve(__dirname, '..', '..', 'shared', 'shared-card-heuristics.js'));
const PendingTargetSelector = require('../../game/turn-handlers/pending-target-selector');

const SELFPLAY_SCHEMA_VERSION = 'selfplay.v2';
const LEGACY_SELFPLAY_SCHEMA_VERSION = 'selfplay.v1';

const TARGET_SELECTION_CARD_TYPES = new Set([
    'DESTROY_ONE_STONE',
    'TRAP_WILL',
    'CLONE_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'CORROSION_WILL',
    'HYPERACTIVE_INHERIT_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'STRONG_WIND_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'TEMPT_WILL',
    'SELL_CARD_WILL',
    'HEAVEN_BLESSING',
    'CONDEMN_WILL',
    'TIME_BOMB',
    'GUARD_WILL',
    'GUARDIAN_GOD',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BLOCKADE_WILL',
    'METEOR_WILL'
]);

const CANDIDATE_CARD_TYPES = new Set([
    'TREASURE_BOX',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'SNIPER_WILL',
    'PROTECTED_NEXT_STONE',
    'PERMA_PROTECT_NEXT_STONE',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'AFTERIMAGE_WILL',
    'GHOST_WILL',
    'CORROSION_WILL',
    'GUARD_WILL',
    'GUARDIAN_GOD',
    'TRAP_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BLOCKADE_WILL',
    'METEOR_WILL',
    'CHAIN_WILL',
    'DOUBLE_CHAIN_WILL',
    'TRIPLE_CHAIN_WILL',
    'QUAD_CHAIN_WILL',
    'INFINITE_CHAIN_WILL',
    'TABOO_REVERSE_WILL',
    'REGEN_WILL',
    'TIME_BOMB',
    'CROSS_BOMB',
    'X_BOMB',
    'ULTIMATE_REVERSE_DRAGON',
    'BREEDING_WILL',
    'CLONE_WILL',
    'HYPERACTIVE_WILL',
    'INSTANT_HYPERACTIVE_WILL',
    'ESCAPE_WILL',
    'ROBOT_VACUUM_WILL',
    'HYPERACTIVE_INHERIT_WILL',
    'PLUNDER_WILL',
    'WORK_WILL',
    'DOUBLE_PLACE',
    'TRIPLE_PLACE',
    'QUAD_PLACE',
    'INFINITE_PLACE',
    'HEAVEN_BLESSING',
    'CONDEMN_WILL',
    'GOLD_STONE',
    'CRYSTAL_STONE',
    'SILVER_STONE',
    'ULTIMATE_HYPERACTIVE_GOD',
    'ULTIMATE_DESTROY_GOD',
    'DESTROY_ONE_STONE',
    'STRONG_WIND_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'SELL_CARD_WILL',
    'REBUILD_WILL',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'TEMPT_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'LOSS_WILL',
    'OBSERVER_WILL',
    'DESTROY_DRAGON_WILL'
]);

const POSITION_WEIGHTS = [
    [120, -20, 20, 5, 5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20, 5, 5, 20, -20, 120]
];

const FALLBACK_CORNER_RECOVERY_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CORNER_RECOVERY_CARD_TYPES,
        [
            'SUPER_BUOYANCY_WILL',
            'SUPER_GRAVITY_WILL',
            'BOARD_EXPANSION_WILL',
            'BOARD_EXPANSION_GOD'
        ]
    )
    : new Set([
        'DESTROY_ONE_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'STRONG_WIND_WILL',
        'SUPER_BUOYANCY_WILL',
        'SUPER_GRAVITY_WILL',
        'TEMPT_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_REVERSE_DRAGON',
        'METEOR_WILL',
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD'
    ]);

const FALLBACK_CORNER_HOLD_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CORNER_HOLD_CARD_TYPES,
        []
    )
    : new Set([
        'PROTECTED_NEXT_STONE',
        'PERMA_PROTECT_NEXT_STONE',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'REGEN_WILL',
        'BLOCKADE_WILL'
    ]);

function toPlayerKey(playerValue) {
    return playerValue === Core.BLACK ? 'black' : 'white';
}

function toPlayerValue(playerKey) {
    return playerKey === 'black' ? Core.BLACK : Core.WHITE;
}

function getSafeCardContext(cardState) {
    let context = null;
    try {
        const ctxHelper = require('../../game/logic/context');
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(cardState);
        }
    } catch (e) { /* ignore */ }
    if (context) return context;
    try {
        return CardLogic.getCardContext(cardState);
    } catch (e) {
        return {
            protectedStones: [],
            permaProtectedStones: [],
            bombs: []
        };
    }
}

function getShapeAwareBoard(board, options) {
    if (!Array.isArray(board)) return [];
    if (SharedBoardUtils && typeof SharedBoardUtils.attachBoardShape === 'function') {
        return SharedBoardUtils.attachBoardShape(board, options || null);
    }
    return board;
}

function getSelfplayBoard(gameState, cardState) {
    if (!gameState || !Array.isArray(gameState.board)) return [];
    return getShapeAwareBoard(gameState.board, {
        boardExpansion: gameState.boardExpansion,
        cardState
    });
}

function getBoardCellValue(board, row, col) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function') {
        return SharedBoardUtils.getCellValue(board, row, col);
    }
    return Array.isArray(board) && Array.isArray(board[row]) ? board[row][col] : null;
}

function setBoardCellValue(board, row, col, value) {
    if (SharedBoardUtils && typeof SharedBoardUtils.setCellValue === 'function') {
        return SharedBoardUtils.setCellValue(board, row, col, value);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return false;
    board[row][col] = value;
    return true;
}

function encodeBoard(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.encodeBoard === 'function') {
        return SharedBoardUtils.encodeBoard(board);
    }
    if (!Array.isArray(board)) return '';
    return board
        .map((row) => row.map((v) => (v === Core.BLACK ? 'B' : (v === Core.WHITE ? 'W' : '.'))).join(''))
        .join('/');
}

function decodeBoard(boardStr) {
    if (!boardStr) return [];
    return boardStr.split('/').map((row) => row.split(''));
}

function transformCoord(row, col, size, t) {
    if (SharedBoardUtils && typeof SharedBoardUtils.transformCoord === 'function') {
        return SharedBoardUtils.transformCoord(row, col, size, t);
    }
    if (t === 0) return { row, col };
    if (t === 1) return { row: col, col: size - 1 - row };
    if (t === 2) return { row: size - 1 - row, col: size - 1 - col };
    if (t === 3) return { row: size - 1 - col, col: row };
    if (t === 4) return { row, col: size - 1 - col };
    if (t === 5) return { row: size - 1 - col, col: size - 1 - row };
    if (t === 6) return { row: size - 1 - row, col };
    if (t === 7) return { row: col, col: row };
    return { row, col };
}

function transformBoard(board, t) {
    if (!Array.isArray(board) || !board.length) return [];
    const size = board.length;
    const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const next = transformCoord(r, c, size, t);
            out[next.row][next.col] = board[r][c];
        }
    }
    return out;
}

function canonicalizeBoard(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.canonicalizeBoard === 'function') {
        return SharedBoardUtils.canonicalizeBoard(board);
    }
    const raw = encodeBoard(board);
    if (!raw) return { boardKey: raw, transformId: 0 };
    const decoded = decodeBoard(raw);
    let best = null;
    let bestT = 0;
    for (let t = 0; t < 8; t++) {
        const encoded = encodeBoard(transformBoard(decoded, t));
        if (best === null || encoded < best) {
            best = encoded;
            bestT = t;
        }
    }
    return { boardKey: best || raw, transformId: bestT };
}

function isCorner(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isCorner === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.isCorner(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.isCorner(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    return (row === 0 || row === n - 1) && (col === 0 || col === n - 1);
}

function isEdge(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isEdge === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.isEdge(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.isEdge(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    return row === 0 || row === n - 1 || col === 0 || col === n - 1;
}

function resolveForcedPlacementCandidates(legalMoves, options, board) {
    const safeLegalMoves = Array.isArray(legalMoves)
        ? legalMoves.filter((move) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        : [];
    const defaultMoves = safeLegalMoves.length > 0
        ? safeLegalMoves
        : (Array.isArray(legalMoves) ? legalMoves : []);

    if (options && options.forceCornerEdgePlacement === false) {
        return {
            category: null,
            moves: defaultMoves
        };
    }

    const cornerMoves = safeLegalMoves.filter((move) => isCorner(move.row, move.col, board));
    if (cornerMoves.length > 0) {
        return {
            category: 'corner',
            moves: cornerMoves
        };
    }

    const edgeMoves = safeLegalMoves.filter((move) => !isCorner(move.row, move.col, board) && isEdge(move.row, move.col, board));
    if (edgeMoves.length > 0) {
        return {
            category: 'edge',
            moves: edgeMoves
        };
    }

    return {
        category: null,
        moves: defaultMoves
    };
}

function isXSquare(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isXSquare === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.isXSquare(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.isXSquare(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    return (row === 1 || row === n - 2) && (col === 1 || col === n - 2);
}

function isCSquare(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isCSquare === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.isCSquare(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.isCSquare(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    const nearTopBottom = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
    const nearLeftRight = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
    return nearTopBottom || nearLeftRight;
}

function getFlipsBasic(board, row, col, playerValue) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getFlipsBasic === 'function') {
        return SharedBoardUtils.getFlipsBasic(board, row, col, playerValue);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return [];
    if (board[row][col] !== 0) return [];
    const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    const out = [];
    for (const d of dirs) {
        const temp = [];
        let r = row + d[0];
        let c = col + d[1];
        while (r >= 0 && c >= 0 && r < board.length && c < board.length && board[r][c] === -playerValue) {
            temp.push({ row: r, col: c });
            r += d[0];
            c += d[1];
        }
        if (temp.length > 0 && r >= 0 && c >= 0 && r < board.length && c < board.length && board[r][c] === playerValue) {
            out.push(...temp);
        }
    }
    return out;
}

function getLegalMovesBasic(board, playerValue) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getLegalMovesBasic === 'function') {
        return SharedBoardUtils.getLegalMovesBasic(board, playerValue);
    }
    if (!Array.isArray(board)) return [];
    const moves = [];
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            const flips = getFlipsBasic(board, row, col, playerValue);
            if (flips.length > 0) moves.push({ row, col, flips });
        }
    }
    return moves;
}

function scoreMove(move, rng, context) {
    const row = Number.isFinite(move && move.row) ? move.row : 0;
    const col = Number.isFinite(move && move.col) ? move.col : 0;
    const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;
    const scoreContext = context || {};
    const planState = scoreContext.planState || null;
    const movePlanContext = scoreContext.movePlanContext || null;
    const board = Array.isArray(scoreContext.board)
        ? scoreContext.board
        : getSelfplayBoard(scoreContext.gameState, scoreContext.cardState);
    const shouldUseCornerPlan = (
        CpuPolicyCore &&
        typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function' &&
        scoreContext.gameState &&
        movePlanContext
    );

    let score = flips * 100;
    if (shouldUseCornerPlan) {
        try {
            score = CpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext);
        } catch (e) {
            score = flips * 100;
        }
    }
    if (!shouldUseCornerPlan) {
        if (isCorner(row, col, board)) score += 10000;
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 5200;
        if (isXSquare(row, col, board)) score -= 600;
        if (isCSquare(row, col, board)) score -= 300;
    }

    const moveBonus = getBoardBonusAtCell(scoreContext.cardState, row, col);
    if (moveBonus > 0) {
        // Keep strict priority: corner > edge > bonus cell.
        const bonusWeight = (planState && planState.cornerHoldMode) ? 260 : 180;
        score += moveBonus * bonusWeight;
    }

    if (planState && planState.cornerHoldMode) {
        score += flips * 65;
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 850;
        if (!isCorner(row, col, board) && !isEdge(row, col, board)) score -= 220;
        if (isXSquare(row, col, board)) score -= 1000;
        if (isCSquare(row, col, board)) score -= 450;
    } else if (planState && planState.cornerSeekMode) {
        if (isCorner(row, col, board)) score += 7000;
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 950;
        if (isXSquare(row, col, board)) score -= 1200;
        if (isCSquare(row, col, board)) score -= 500;
    }

    // Deterministic tie-break jitter.
    score += rng.random() * 0.01;
    return score;
}

function evaluatePositionalDiff(board, playerValue) {
    const boardRef = getShapeAwareBoard(board);
    let own = 0;
    let opp = 0;
    const cells = (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function')
        ? SharedBoardUtils.collectBoardCoordinates(boardRef)
        : boardRef.flatMap((row, rowIndex) => (Array.isArray(row) ? row.map((_, colIndex) => ({ row: rowIndex, col: colIndex })) : []));
    for (const pos of cells) {
        if (!pos) continue;
        const row = pos.row;
        const col = pos.col;
        const cell = getBoardCellValue(boardRef, row, col);
        if (cell === null) continue;
            const w = POSITION_WEIGHTS[row] && Number.isFinite(POSITION_WEIGHTS[row][col]) ? POSITION_WEIGHTS[row][col] : 0;
            if (cell === playerValue) own += w;
            else if (cell === -playerValue) opp += w;
    }
    return own - opp;
}

function countCorners(board, playerValue) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        const control = SharedBoardUtils.countCornerControl(board, playerValue);
        return Number(control.ownCorners || 0) - Number(control.oppCorners || 0);
    }
    if (!Array.isArray(board) || board.length === 0) return 0;
    const n = board.length - 1;
    const points = [[0, 0], [0, n], [n, 0], [n, n]];
    let own = 0;
    let opp = 0;
    for (const p of points) {
        const row = board[p[0]];
        if (!Array.isArray(row)) continue;
        const v = row[p[1]];
        if (v === playerValue) own += 1;
        else if (v === -playerValue) opp += 1;
    }
    return own - opp;
}

function countCornerControl(board, playerValue) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        return SharedBoardUtils.countCornerControl(board, playerValue);
    }
    if (!Array.isArray(board) || board.length === 0) return { ownCorners: 0, oppCorners: 0 };
    const n = board.length - 1;
    const points = [[0, 0], [0, n], [n, 0], [n, n]];
    let ownCorners = 0;
    let oppCorners = 0;
    for (const p of points) {
        const row = board[p[0]];
        if (!Array.isArray(row)) continue;
        const v = row[p[1]];
        if (v === playerValue) ownCorners += 1;
        else if (v === -playerValue) oppCorners += 1;
    }
    return { ownCorners, oppCorners };
}

function countEdgeControl(board, playerValue) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countEdgeControl === 'function') {
        return SharedBoardUtils.countEdgeControl(board, playerValue);
    }
    if (!Array.isArray(board) || board.length === 0) return { ownEdges: 0, oppEdges: 0 };
    let ownEdges = 0;
    let oppEdges = 0;
    const size = board.length;
    for (let row = 0; row < size; row++) {
        const oneRow = board[row];
        if (!Array.isArray(oneRow)) continue;
        for (let col = 0; col < oneRow.length; col++) {
            if (!isEdge(row, col, board) || isCorner(row, col, board)) continue;
            const v = oneRow[col];
            if (v === playerValue) ownEdges += 1;
            else if (v === -playerValue) oppEdges += 1;
        }
    }
    return { ownEdges, oppEdges };
}

function toFiniteStatNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function getDiscCountForPlayerFromRecord(rec, playerKey, phase) {
    if (!rec || !playerKey) return 0;
    const useAfter = phase === 'after';
    if (playerKey === 'black') {
        return useAfter
            ? toFiniteStatNumber(rec.blackCountAfter)
            : toFiniteStatNumber(rec.blackCountBefore);
    }
    return useAfter
        ? toFiniteStatNumber(rec.whiteCountAfter)
        : toFiniteStatNumber(rec.whiteCountBefore);
}

function getCornerCountForPlayerFromRecord(rec, playerKey, phase) {
    if (!rec || !playerKey) return 0;
    const useAfter = phase === 'after';
    const ownKey = useAfter ? 'ownCornersAfter' : 'ownCornersBefore';
    const oppKey = useAfter ? 'oppCornersAfter' : 'oppCornersBefore';
    return rec.player === playerKey
        ? toFiniteStatNumber(rec[ownKey])
        : toFiniteStatNumber(rec[oppKey]);
}

function annotateHorizonDecisionMetrics(gameRecords, horizonPlies) {
    if (!Array.isArray(gameRecords) || gameRecords.length <= 0) return;
    const horizon = Number.isFinite(horizonPlies)
        ? Math.max(1, Math.floor(horizonPlies))
        : 3;
    const lastIndex = gameRecords.length - 1;

    for (let i = 0; i < gameRecords.length; i++) {
        const rec = gameRecords[i];
        if (!rec || (rec.player !== 'black' && rec.player !== 'white')) continue;
        const actor = rec.player;
        const horizonIndex = Math.min(lastIndex, i + horizon);
        const horizonRec = gameRecords[horizonIndex] || rec;

        const ownDiscAfter = getDiscCountForPlayerFromRecord(rec, actor, 'after');
        const ownDiscAfterHorizon = getDiscCountForPlayerFromRecord(horizonRec, actor, 'after');
        const ownCornersAfterHorizon = getCornerCountForPlayerFromRecord(horizonRec, actor, 'after');

        let cornerHoldTurnsNext3Plies = 0;
        for (let j = i + 1; j <= horizonIndex; j++) {
            const futureRec = gameRecords[j];
            const ownCornersFuture = getCornerCountForPlayerFromRecord(futureRec, actor, 'after');
            if (ownCornersFuture > 0) cornerHoldTurnsNext3Plies += 1;
        }

        rec.futureDiscDelta3Ply = ownDiscAfterHorizon - ownDiscAfter;
        rec.ownCornersAfter3Ply = ownCornersAfterHorizon;
        rec.cornerHoldTurnsNext3Plies = cornerHoldTurnsNext3Plies;
        rec.horizonPliesUsed = horizonIndex - i;
    }
}

function classifySelectionSeat(row, col, board) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 'unknown';
    if (isCorner(row, col, board)) return 'corner';
    if (isEdge(row, col, board)) return 'edge';
    return 'inner';
}

function cloneTargetCell(target) {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    return { row: target.row, col: target.col };
}

function buildPendingSelectionRecord(action, pendingType) {
    if (!action || typeof action !== 'object' || action.type !== 'place') return null;

    const boardTargetKeys = [
        'destroyTarget',
        'strongWindTarget',
        'superBuoyancyTarget',
        'superGravityTarget',
        'sacrificeTarget',
        'temptTarget',
        'swapTarget',
        'positionSwapTarget',
        'guardTarget',
        'extendTarget',
        'corrosionTarget',
        'bombTarget',
        'cloneTarget',
        'splitTarget',
        'blockadeTarget',
        'meteorTarget',
        'teleportTarget',
        'expansionTarget',
        'trapTarget',
        'hyperactiveInheritTarget'
    ];

    for (const key of boardTargetKeys) {
        const cell = cloneTargetCell(action[key]);
        if (!cell) continue;
        return {
            kind: 'board_cell',
            pendingType: pendingType || null,
            sourceKey: key,
            row: cell.row,
            col: cell.col
        };
    }

    if (Number.isInteger(action.condemnTargetIndex)) {
        return {
            kind: 'hand_index',
            pendingType: pendingType || null,
            sourceKey: 'condemnTargetIndex',
            handIndex: action.condemnTargetIndex
        };
    }

    if (typeof action.heavenBlessingCardId === 'string' && action.heavenBlessingCardId.trim()) {
        return {
            kind: 'offer_card',
            pendingType: pendingType || null,
            sourceKey: 'heavenBlessingCardId',
            cardId: action.heavenBlessingCardId.trim()
        };
    }

    if (pendingType === 'SELL_CARD_WILL' && typeof action.sellCardId === 'string' && action.sellCardId.trim()) {
        return {
            kind: 'hand_card',
            pendingType: pendingType || null,
            sourceKey: 'sellCardId',
            cardId: action.sellCardId.trim()
        };
    }

    return null;
}

function buildPendingSelectionTrace(record) {
    if (!record || typeof record !== 'object') return null;
    const selection = record.pendingSelection;
    if (!selection || typeof selection !== 'object') return null;

    if (selection.kind === 'board_cell') {
        return {
            kind: 'board_cell',
            pendingType: selection.pendingType || null,
            sourceKey: selection.sourceKey || null,
            row: Number.isFinite(selection.row) ? Number(selection.row) : null,
            col: Number.isFinite(selection.col) ? Number(selection.col) : null,
            seat: classifySelectionSeat(selection.row, selection.col)
        };
    }
    if (selection.kind === 'hand_index') {
        return {
            kind: 'hand_index',
            pendingType: selection.pendingType || null,
            sourceKey: selection.sourceKey || null,
            handIndex: Number.isFinite(selection.handIndex) ? Number(selection.handIndex) : null
        };
    }
    if (selection.kind === 'offer_card' || selection.kind === 'hand_card') {
        return {
            kind: selection.kind,
            pendingType: selection.pendingType || null,
            sourceKey: selection.sourceKey || null,
            cardId: selection.cardId || null
        };
    }
    return null;
}

function normalizeDecisionCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    return {
        actionType: typeof candidate.actionType === 'string' ? candidate.actionType : null,
        decisionKind: typeof candidate.decisionKind === 'string' ? candidate.decisionKind : null,
        cardId: typeof candidate.cardId === 'string' ? candidate.cardId : null,
        cardType: typeof candidate.cardType === 'string' ? candidate.cardType : null,
        cardCost: Number.isFinite(candidate.cardCost) ? Number(candidate.cardCost) : null,
        score: Number.isFinite(candidate.score) ? Number(candidate.score) : null,
        minUseScore: Number.isFinite(candidate.minUseScore) ? Number(candidate.minUseScore) : null,
        shouldUse: typeof candidate.shouldUse === 'boolean' ? candidate.shouldUse : null,
        isSelected: candidate.isSelected === true
    };
}

function resolveCardDecisionKind(record, normalizedCandidates) {
    const selectedActionKey = typeof (record && record.selectedActionKey) === 'string'
        ? record.selectedActionKey.trim()
        : '';
    if (selectedActionKey.startsWith('sell:')) return 'sell';
    if (selectedActionKey.startsWith('use:')) return 'use';
    if (selectedActionKey.startsWith('destroy:')) return 'destroy';
    if (selectedActionKey === 'keep' || selectedActionKey.startsWith('keep:')) return 'keep';
    if (record && record.sellCardId) return 'sell';
    if (record && record.useCardId) return 'use';
    if (record && record.destroyCardId) return 'destroy';
    const selectedCandidate = Array.isArray(normalizedCandidates)
        ? normalizedCandidates.find((candidate) => candidate && candidate.isSelected && candidate.decisionKind)
        : null;
    if (selectedCandidate && selectedCandidate.decisionKind) return selectedCandidate.decisionKind;
    const firstCandidate = Array.isArray(normalizedCandidates)
        ? normalizedCandidates.find((candidate) => candidate && candidate.decisionKind)
        : null;
    if (firstCandidate && firstCandidate.decisionKind) return firstCandidate.decisionKind;
    const actionType = String(record && record.actionType ? record.actionType : '');
    if (actionType === 'use_card') return 'use';
    if (actionType === 'destroy_hand_card') return 'destroy';
    if (actionType === 'cancel_card') return 'keep';
    return null;
}

function buildCardSelectionTrace(record) {
    if (!record || typeof record !== 'object') return null;
    const candidates = Array.isArray(record.decisionCandidates)
        ? record.decisionCandidates.map((candidate) => normalizeDecisionCandidate(candidate)).filter(Boolean)
        : [];
    const decision = resolveCardDecisionKind(record, candidates);
    if (!decision) return null;
    const selectedCandidate = candidates.find((candidate) => candidate && candidate.isSelected) || null;
    const selectedCardId = (typeof record.sellCardId === 'string' && record.sellCardId)
        || (typeof record.useCardId === 'string' && record.useCardId)
        || (typeof record.destroyCardId === 'string' && record.destroyCardId)
        || (selectedCandidate && selectedCandidate.cardId)
        || null;
    const reasonTags = Array.isArray(record.decisionReasonTags)
        ? record.decisionReasonTags.map((tag) => String(tag || '').trim()).filter(Boolean)
        : [];
    const scoreSummary = record.decisionScoreSummary && typeof record.decisionScoreSummary === 'object'
        ? { ...record.decisionScoreSummary }
        : null;
    return {
        kind: 'card',
        decision,
        selectedCardId,
        selectedActionKey: typeof record.selectedActionKey === 'string' && record.selectedActionKey.trim()
            ? record.selectedActionKey.trim()
            : null,
        usableCardIds: Array.isArray(record.usableCardIds) ? record.usableCardIds.slice() : [],
        handCards: Array.isArray(record.handCards) ? record.handCards.slice() : [],
        reasonTags,
        scoreSummary,
        candidates,
        pendingSelection: buildPendingSelectionTrace(record)
    };
}

function buildSelectionTrace(record) {
    if (!record || typeof record !== 'object') return null;
    const cardTrace = buildCardSelectionTrace(record);
    if (cardTrace) return cardTrace;
    const actionType = String(record.actionType || '');
    if (actionType === 'place') {
        const topCandidates = Array.isArray(record.topPlacementCandidates)
            ? record.topPlacementCandidates.map((one) => ({
                row: Number.isFinite(one && one.row) ? Number(one.row) : null,
                col: Number.isFinite(one && one.col) ? Number(one.col) : null,
                seat: String(one && one.seat ? one.seat : 'unknown'),
                combinedScore: Number.isFinite(one && one.combinedScore) ? Number(one.combinedScore) : null,
                tacticalScore: Number.isFinite(one && one.tacticalScore) ? Number(one.tacticalScore) : null,
                heuristicScore: Number.isFinite(one && one.heuristicScore) ? Number(one.heuristicScore) : null,
                policyScore: Number.isFinite(one && one.policyScore) ? Number(one.policyScore) : null,
                finalScore: Number.isFinite(one && one.finalScore) ? Number(one.finalScore) : null,
                committeeVotes: Number.isFinite(one && one.committeeVotes) ? Number(one.committeeVotes) : 0
            }))
            : [];
        return {
            kind: 'place',
            selected: {
                row: Number.isFinite(record.row) ? Number(record.row) : null,
                col: Number.isFinite(record.col) ? Number(record.col) : null,
                seat: classifySelectionSeat(record.row, record.col),
                selectedCompositeScore: Number.isFinite(record.selectedCompositeScore) ? Number(record.selectedCompositeScore) : null,
                selectedTacticalScore: Number.isFinite(record.selectedTacticalScore) ? Number(record.selectedTacticalScore) : null,
                selectedCellBonus: Number.isFinite(record.selectedCellBonus) ? Number(record.selectedCellBonus) : null
            },
            topCandidates,
            forcedPlacementCategory: record.forcedPlacementCategory || null,
            pendingSelection: buildPendingSelectionTrace(record)
        };
    }
    return {
        kind: 'other',
        actionType: actionType || null
    };
}

function buildActorViewSnapshot(record) {
    if (!record || typeof record !== 'object') return null;
    return {
        board: record.board || '',
        player: record.player || null,
        pendingType: record.pendingType || null,
        legalMoves: Number.isFinite(record.legalMoves) ? Number(record.legalMoves) : 0,
        handCards: Array.isArray(record.handCards) ? record.handCards.slice() : [],
        usableCardIds: Array.isArray(record.usableCardIds) ? record.usableCardIds.slice() : [],
        handBlack: Number.isFinite(record.handBlack) ? Number(record.handBlack) : 0,
        handWhite: Number.isFinite(record.handWhite) ? Number(record.handWhite) : 0,
        chargeBlack: Number.isFinite(record.chargeBlack) ? Number(record.chargeBlack) : 0,
        chargeWhite: Number.isFinite(record.chargeWhite) ? Number(record.chargeWhite) : 0,
        deckCount: Number.isFinite(record.deckCount) ? Number(record.deckCount) : 0,
        discardCount: Number.isFinite(record.discardCount) ? Number(record.discardCount) : 0,
        blackCountBefore: Number.isFinite(record.blackCountBefore) ? Number(record.blackCountBefore) : 0,
        whiteCountBefore: Number.isFinite(record.whiteCountBefore) ? Number(record.whiteCountBefore) : 0,
        ownCornersBefore: Number.isFinite(record.ownCornersBefore) ? Number(record.ownCornersBefore) : 0,
        oppCornersBefore: Number.isFinite(record.oppCornersBefore) ? Number(record.oppCornersBefore) : 0,
        ownEdgesBefore: Number.isFinite(record.ownEdgesBefore) ? Number(record.ownEdgesBefore) : 0,
        oppEdgesBefore: Number.isFinite(record.oppEdgesBefore) ? Number(record.oppEdgesBefore) : 0,
        hasCornerMoveNow: record.hasCornerMoveNow ? 1 : 0,
        hasEdgeMoveNow: record.hasEdgeMoveNow ? 1 : 0,
        cornerEmergency: record.cornerEmergency ? 1 : 0,
        cornerHoldMode: record.cornerHoldMode ? 1 : 0,
        highBonusMoveAvailable: record.highBonusMoveAvailable ? 1 : 0,
        maxLegalMoveBonus: Number.isFinite(record.maxLegalMoveBonus) ? Number(record.maxLegalMoveBonus) : 0,
        selectedCellBonus: Number.isFinite(record.selectedCellBonus) ? Number(record.selectedCellBonus) : 0,
        pendingSelection: buildPendingSelectionTrace(record),
        selectionTrace: buildSelectionTrace(record)
    };
}

function computeHardcaseTags(record) {
    if (!record || typeof record !== 'object') return [];
    const tags = [];
    const pushUnique = (tag) => {
        const normalized = String(tag || '').trim();
        if (!normalized || tags.includes(normalized)) return;
        tags.push(normalized);
    };

    if (record.hasCornerMoveNow) pushUnique('corner_move_available');
    if (record.cornerEmergency) pushUnique('corner_emergency');
    if (Number(record.legalMoves || 0) <= 2) pushUnique('low_legal_moves');
    if (Array.isArray(record.handCards) && record.handCards.length >= 4) pushUnique('hand_pressure');
    if (record.pendingType) pushUnique('pending_target_selection');
    if (Number(record.futureDiscDelta3Ply || 0) < 0) pushUnique('negative_future_disc');
    if (Number(record.tacticalScoreMissRatio || 0) >= 0.08) pushUnique('tactical_miss_high');

    const edgeSwing = Math.abs(
        (Number(record.ownEdgesAfter || 0) - Number(record.ownEdgesBefore || 0)) -
        (Number(record.oppEdgesAfter || 0) - Number(record.oppEdgesBefore || 0))
    );
    if (edgeSwing >= 2) pushUnique('edge_balance_swing');

    const emptyCountBefore = (typeof record.board === 'string' && record.board)
        ? countEmptiesInBoardKey(record.board)
        : (64 - Number(record.blackCountBefore || 0) - Number(record.whiteCountBefore || 0));
    if (emptyCountBefore <= 40) pushUnique('endgame_mode');

    return tags;
}

function annotateSelfplayV2Metadata(gameRecords, options) {
    if (!Array.isArray(gameRecords) || gameRecords.length <= 0) return;
    const seedFamily = options && typeof options.seedFamily === 'string' && options.seedFamily.trim()
        ? options.seedFamily.trim()
        : 'train';
    const dataLane = options && typeof options.dataLane === 'string' && options.dataLane.trim()
        ? options.dataLane.trim()
        : 'selfplay-games';

    for (const rec of gameRecords) {
        if (!rec || typeof rec !== 'object') continue;
        rec.visibilityScope = 'actor';
        rec.seedFamily = seedFamily;
        rec.dataLane = dataLane;
        rec.actorView = buildActorViewSnapshot(rec);
        rec.hardcaseTags = computeHardcaseTags(rec);
        rec.isHardcase = rec.hardcaseTags.length > 0;
        rec.hardcasePrimaryTag = rec.hardcaseTags.length > 0 ? rec.hardcaseTags[0] : null;
    }
}

function getBoardBonusAtCell(cardState, row, col) {
    if (!cardState || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const key = `${row},${col}`;
    if (cardState.boardBonusConsumedByCell && cardState.boardBonusConsumedByCell[key] === true) return 0;
    const raw = Number(cardState.boardBonusByCell && cardState.boardBonusByCell[key] ? cardState.boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function resolveCardType(cardId) {
    if (!cardId) return '';
    if (typeof CardLogic.getCardType === 'function') {
        try {
            const cardType = CardLogic.getCardType(cardId);
            if (typeof cardType === 'string' && cardType) return cardType;
        } catch (e) { /* ignore */ }
    }
    if (typeof CardLogic.getCardDef === 'function') {
        try {
            const cardDef = CardLogic.getCardDef(cardId);
            if (cardDef && typeof cardDef.type === 'string') return cardDef.type;
        } catch (e) { /* ignore */ }
    }
    return '';
}

function isRecoveryCardType(cardType) {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerRecoveryCardType === 'function') {
        try {
            return CpuPolicyCore.isCornerRecoveryCardType(type) === true;
        } catch (e) { /* ignore */ }
    }
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isRecoveryCardType === 'function') {
        try {
            if (SharedCardHeuristics.isRecoveryCardType(type) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return FALLBACK_CORNER_RECOVERY_CARD_TYPES.has(type);
}

function isHoldCardType(cardType) {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerHoldCardType === 'function') {
        try {
            return CpuPolicyCore.isCornerHoldCardType(type) === true;
        } catch (e) { /* ignore */ }
    }
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isHoldCardType === 'function') {
        try {
            if (SharedCardHeuristics.isHoldCardType(type) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return FALLBACK_CORNER_HOLD_CARD_TYPES.has(type);
}

function buildCornerPlanState(gameState, cardState, playerKey, legalMoves, usableCardIds) {
    if (!gameState || !Array.isArray(gameState.board)) {
        return {
            ownCorners: 0,
            oppCorners: 0,
            ownEdges: 0,
            oppEdges: 0,
            hasCornerMoveNow: false,
            hasEdgeMoveNow: false,
            cornerEmergency: false,
            cornerHoldMode: false,
            cornerSeekMode: true,
            recoveryReady: false,
            holdReady: false,
            recoveryCostGap: 0,
            maxBoardBonusOnLegalMoves: 0,
            highBonusMoveAvailable: false
        };
    }
    const board = getSelfplayBoard(gameState, cardState);
    const playerValue = toPlayerValue(playerKey);
    const cornerControl = countCornerControl(board, playerValue);
    const edgeControl = countEdgeControl(board, playerValue);
    const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
    const hasCornerMoveNow = safeLegalMoves.some((move) => move && isCorner(move.row, move.col, board));
    const hasEdgeMoveNow = safeLegalMoves.some((move) => move && !isCorner(move.row, move.col, board) && isEdge(move.row, move.col, board));
    let maxBoardBonusOnLegalMoves = 0;
    for (const move of safeLegalMoves) {
        if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) continue;
        const bonus = getBoardBonusAtCell(cardState, move.row, move.col);
        if (bonus > maxBoardBonusOnLegalMoves) maxBoardBonusOnLegalMoves = bonus;
    }

    const ownKey = playerKey === 'black' ? 'black' : 'white';
    const ownCharge = cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? Number(cardState.charge[ownKey]) : 0;
    const safeUsableCardIds = Array.isArray(usableCardIds) ? usableCardIds : [];
    const usableSet = new Set(safeUsableCardIds.map((cardId) => String(cardId)));
    const handCards = cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey] : [];

    let recoveryReady = false;
    let holdReady = false;
    let recoveryCostGap = Number.POSITIVE_INFINITY;
    for (const cardId of handCards) {
        const cardType = resolveCardType(cardId);
        if (!cardType) continue;
        const cardCost = (typeof CardLogic.getCardCost === 'function')
            ? Number(CardLogic.getCardCost(cardId) || 0)
            : 0;
        if (isRecoveryCardType(cardType)) {
            if (usableSet.has(String(cardId)) && ownCharge >= cardCost) {
                recoveryReady = true;
            } else {
                recoveryCostGap = Math.min(recoveryCostGap, Math.max(0, cardCost - ownCharge));
            }
        }
        if (isHoldCardType(cardType) && usableSet.has(String(cardId)) && ownCharge >= cardCost) {
            holdReady = true;
        }
    }
    if (!Number.isFinite(recoveryCostGap)) recoveryCostGap = 0;

    const cornerEmergency = cornerControl.oppCorners > cornerControl.ownCorners || (!hasCornerMoveNow && cornerControl.oppCorners > 0);
    const edgeLead = edgeControl.ownEdges >= edgeControl.oppEdges;
    const cornerHoldMode = !cornerEmergency && cornerControl.ownCorners > 0 && cornerControl.ownCorners >= cornerControl.oppCorners && edgeLead;

    return {
        ownCorners: cornerControl.ownCorners,
        oppCorners: cornerControl.oppCorners,
        ownEdges: edgeControl.ownEdges,
        oppEdges: edgeControl.oppEdges,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        cornerHoldMode,
        cornerSeekMode: !cornerHoldMode,
        recoveryReady,
        holdReady,
        recoveryCostGap,
        maxBoardBonusOnLegalMoves,
        highBonusMoveAvailable: maxBoardBonusOnLegalMoves >= 3
    };
}

function buildMovePlanContext(gameState, cardState, playerKey, legalMoves, usableCardIds) {
    if (!gameState || !Array.isArray(gameState.board)) return null;
    const board = getSelfplayBoard(gameState, cardState);
    const ownKey = playerKey === 'black' ? 'black' : 'white';
    const planState = buildCornerPlanState(gameState, cardState, ownKey, legalMoves, usableCardIds);
    const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[ownKey] : null;
    return {
        level: 6,
        board,
        playerValue: toPlayerValue(ownKey),
        ownCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? Number(cardState.charge[ownKey]) : 0,
        boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
            ? cardState.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
            ? cardState.boardBonusConsumedByCell
            : null,
        reserveRecoveryCardReady: planState.recoveryReady === true,
        reserveRecoveryCardCostGap: Number(planState.recoveryCostGap || 0),
        hasCornerHoldCardReady: planState.holdReady === true,
        pendingType: pending && typeof pending.type === 'string' ? pending.type : null,
        pendingPlacementsRemaining: pending && Number.isFinite(Number(pending.placementsRemaining))
            ? Number(pending.placementsRemaining)
            : 0,
        preferEdgeRetention: planState.cornerHoldMode === true,
        cornerPlanState: planState
    };
}

function countDiscsByValue(gameState, playerValue) {
    const board = getSelfplayBoard(gameState);
    if (isStandardBoard(board)) {
        const counts = Core.countDiscs(gameState);
        return playerValue === Core.BLACK
            ? (counts.black - counts.white)
            : (counts.white - counts.black);
    }
    let own = 0;
    let opp = 0;
    if (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function') {
        for (const cell of SharedBoardUtils.collectBoardCoordinates(board)) {
            const v = getBoardCellValue(board, cell.row, cell.col);
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
        }
    } else {
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[r].length; c++) {
                const v = board[r][c];
                if (v === playerValue) own += 1;
                else if (v === -playerValue) opp += 1;
            }
        }
    }
    return own - opp;
}

function countEmpties(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.countBoardEmpties === 'function') {
        return SharedBoardUtils.countBoardEmpties(board);
    }
    let empties = 0;
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === 0) empties += 1;
        }
    }
    return empties;
}

function isStandardBoard(board) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isStandardBoard8x8 === 'function') {
        return SharedBoardUtils.isStandardBoard8x8(board);
    }
    if (!Array.isArray(board) || board.length !== 8) return false;
    for (const row of board) {
        if (!Array.isArray(row) || row.length !== 8) return false;
    }
    return true;
}

function evaluateBoardForPlayer(gameState, cardState, playerKey) {
    const playerValue = toPlayerValue(playerKey);
    const context = getSafeCardContext(cardState);
    const board = getSelfplayBoard(gameState, cardState);
    const ownMobility = Core.getLegalMoves(gameState, playerValue, context).length;
    const oppMobility = Core.getLegalMoves(gameState, -playerValue, context).length;
    const mobilityDiff = ownMobility - oppMobility;
    const cornerDiff = countCorners(board, playerValue);
    const positionalDiff = evaluatePositionalDiff(board, playerValue);
    const discDiff = countDiscsByValue(gameState, playerValue);
    const empties = countEmpties(board);
    const discWeight = empties <= 12 ? 22 : (empties <= 24 ? 10 : 2);

    return (
        (cornerDiff * 350) +
        (mobilityDiff * 18) +
        (positionalDiff * 4) +
        (discDiff * discWeight)
    );
}

function applyMoveForEvaluation(gameState, move, playerValue) {
    const nextState = Core.copyGameState(gameState);
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return nextState;
    const flips = [];
    if (Array.isArray(move.flips)) {
        for (const f of move.flips) {
            if (Array.isArray(f) && f.length >= 2 && Number.isFinite(f[0]) && Number.isFinite(f[1])) {
                flips.push([f[0], f[1]]);
            } else if (f && Number.isFinite(f.row) && Number.isFinite(f.col)) {
                flips.push([f.row, f.col]);
            }
        }
    }
    // Use Core.applyMove so expansion cells are handled consistently with production rules.
    nextState.currentPlayer = playerValue;
    return Core.applyMove(nextState, { row: move.row, col: move.col, flips });
}

function countDiscDiffOnBoard(board, playerValue) {
    if (!Array.isArray(board)) return 0;
    let own = 0;
    let opp = 0;
    if (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function') {
        for (const cell of SharedBoardUtils.collectBoardCoordinates(board)) {
            const v = getBoardCellValue(board, cell.row, cell.col);
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
        }
    } else {
        for (let row = 0; row < board.length; row++) {
            const cells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < cells.length; col++) {
                const v = cells[col];
                if (v === playerValue) own += 1;
                else if (v === -playerValue) opp += 1;
            }
        }
    }
    return own - opp;
}

function applyMoveToBoard(board, move, playerValue) {
    if (!Array.isArray(board)) return [];
    const next = (SharedBoardUtils && typeof SharedBoardUtils.cloneBoard === 'function')
        ? SharedBoardUtils.cloneBoard(board)
        : board.map((row) => (Array.isArray(row) ? row.slice() : []));
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return next;
    if (!setBoardCellValue(next, move.row, move.col, playerValue)) return next;
    const flips = Array.isArray(move.flips) ? move.flips : [];
    for (const flip of flips) {
        if (Array.isArray(flip) && flip.length >= 2 && Number.isFinite(flip[0]) && Number.isFinite(flip[1])) {
            setBoardCellValue(next, flip[0], flip[1], playerValue);
            continue;
        }
        if (flip && Number.isFinite(flip.row) && Number.isFinite(flip.col)) {
            setBoardCellValue(next, flip.row, flip.col, playerValue);
        }
    }
    return next;
}

function evaluateBoardForSearch(board, playerValue) {
    const empties = countEmpties(board);
    const cornerDiff = countCorners(board, playerValue);
    const positionalDiff = evaluatePositionalDiff(board, playerValue);
    const mobilityDiff = getLegalMovesBasic(board, playerValue).length - getLegalMovesBasic(board, -playerValue).length;
    const discDiff = countDiscDiffOnBoard(board, playerValue);
    const discWeight = empties <= 10 ? 20 : (empties <= 24 ? 10 : 3);
    return (
        (cornerDiff * 420) +
        (mobilityDiff * 30) +
        (positionalDiff * 5) +
        (discDiff * discWeight)
    );
}

function scoreMoveForSearchOrder(move, board) {
    const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;
    const row = Number.isFinite(move && move.row) ? move.row : 0;
    const col = Number.isFinite(move && move.col) ? move.col : 0;
    return (flips * 120) + (evaluatePositionValue(row, col, board) * 14);
}

function sortMovesForSearch(moves, beamWidth, board) {
    const out = Array.isArray(moves) ? moves.slice() : [];
    out.sort((a, b) => {
        const sa = scoreMoveForSearchOrder(a, board);
        const sb = scoreMoveForSearchOrder(b, board);
        if (sb !== sa) return sb - sa;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });
    const bw = Number.isFinite(beamWidth) ? Math.max(1, Math.floor(beamWidth)) : 6;
    if (out.length > bw) return out.slice(0, bw);
    return out;
}

function resolveTacticalSearchDepth(options, empties, planState) {
    const openingDepth = Number.isFinite(options && options.tacticalDepthOpening)
        ? Math.max(0, Math.floor(options.tacticalDepthOpening))
        : 2;
    const midDepth = Number.isFinite(options && options.tacticalDepthMid)
        ? Math.max(0, Math.floor(options.tacticalDepthMid))
        : 3;
    const endDepth = Number.isFinite(options && options.tacticalDepthEnd)
        ? Math.max(0, Math.floor(options.tacticalDepthEnd))
        : 4;
    let depth = empties <= 14 ? endDepth : (empties <= 32 ? midDepth : openingDepth);
    if (planState && planState.cornerEmergency) depth += 1;
    // Keep search practical while honoring configured depths.
    // Previous hard-cap(5) neutralized configured 7-12 depths in training presets.
    const phaseCap = empties <= 12 ? 11 : (empties <= 28 ? 9 : 7);
    return Math.max(0, Math.min(phaseCap, depth));
}

function resolveTacticalBeamWidth(options, empties) {
    const configured = Number.isFinite(options && options.tacticalBeamWidth)
        ? Math.max(1, Math.floor(options.tacticalBeamWidth))
        : 0;
    if (configured > 0) return Math.min(16, configured);
    if (empties <= 12) return 12;
    if (empties <= 28) return 10;
    return 8;
}

function resolveTacticalMetricsCandidateLimit(options, candidateCount) {
    const total = Number.isFinite(candidateCount) ? Math.max(0, Math.floor(candidateCount)) : 0;
    if (total <= 0) return 0;
    const configured = Number.isFinite(options && options.tacticalMetricsCandidateLimit)
        ? Math.max(1, Math.floor(options.tacticalMetricsCandidateLimit))
        : 0;
    if (configured > 0) return Math.min(total, configured);
    if (total <= 4) return total;
    return Math.min(total, 3);
}

function minimaxBoardSearch(board, currentPlayer, rootPlayer, depth, alpha, beta, passCount, beamWidth) {
    if (!Array.isArray(board) || depth <= 0 || passCount >= 2) {
        return evaluateBoardForSearch(board, rootPlayer);
    }

    const legalMoves = getLegalMovesBasic(board, currentPlayer);
    if (!legalMoves.length) {
        return minimaxBoardSearch(board, -currentPlayer, rootPlayer, depth - 1, alpha, beta, passCount + 1, beamWidth);
    }

    const maximizing = currentPlayer === rootPlayer;
    const orderedMoves = sortMovesForSearch(legalMoves, beamWidth, board);
    if (maximizing) {
        let best = -Infinity;
        for (const move of orderedMoves) {
            const nextBoard = applyMoveToBoard(board, move, currentPlayer);
            const score = minimaxBoardSearch(nextBoard, -currentPlayer, rootPlayer, depth - 1, alpha, beta, 0, beamWidth);
            if (score > best) best = score;
            if (score > alpha) alpha = score;
            if (beta <= alpha) break;
        }
        return best;
    }

    let best = Infinity;
    for (const move of orderedMoves) {
        const nextBoard = applyMoveToBoard(board, move, currentPlayer);
        const score = minimaxBoardSearch(nextBoard, -currentPlayer, rootPlayer, depth - 1, alpha, beta, 0, beamWidth);
        if (score < best) best = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
    }
    return best;
}

function scoreTacticalMove(move, context, options) {
    if (!context || !context.gameState || !context.cardState) return 0;
    const playerKey = context.playerKey === 'black' ? 'black' : 'white';
    const playerValue = toPlayerValue(playerKey);
    const nextState = applyMoveForEvaluation(context.gameState, move, playerValue);
    const empties = countEmpties(nextState.board);
    const discWeight = empties <= 12 ? 18 : (empties <= 24 ? 8 : 2);
    const discDiff = countDiscsByValue(nextState, playerValue);
    const cornerDiff = countCorners(nextState.board, playerValue);
    const opponentMoves = getLegalMovesBasic(nextState.board, -playerValue);
    let opponentThreat = 0;
    let givesCorner = false;
    for (const oppMove of opponentMoves) {
        const pressure = ((oppMove.flips ? oppMove.flips.length : 0) * 80) + (evaluatePositionValue(oppMove.row, oppMove.col, nextState.board) * 8);
        if (pressure > opponentThreat) opponentThreat = pressure;
        if (isCorner(oppMove.row, oppMove.col, nextState.board)) givesCorner = true;
    }
    const row = Number.isFinite(move && move.row) ? move.row : 0;
    const col = Number.isFinite(move && move.col) ? move.col : 0;
    const planState = context.planState || null;
    const moveBonus = getBoardBonusAtCell(context.cardState, row, col);
    const tie = (7 - row) * 0.001 + (7 - col) * 0.0001;
    const baseScore = (
        ((Array.isArray(move.flips) ? move.flips.length : 0) * 60) +
        (evaluatePositionValue(row, col, nextState.board) * 8) +
        (discDiff * discWeight) +
        (cornerDiff * 300) +
        (moveBonus * (planState && planState.cornerHoldMode ? 500 : 220)) +
        (opponentMoves.length * -45) +
        (opponentThreat * -6) +
        (givesCorner ? (planState && planState.cornerSeekMode ? -2600 : -1800) : 0) +
        ((planState && planState.cornerHoldMode && !isCorner(row, col, nextState.board) && !isEdge(row, col, nextState.board)) ? -380 : 0) +
        tie
    );

    const searchDepth = resolveTacticalSearchDepth(options, empties, planState);
    if (searchDepth <= 0) return baseScore;

    const beamWidth = resolveTacticalBeamWidth(options, empties);
    const searchValue = minimaxBoardSearch(
        nextState.board,
        -playerValue,
        playerValue,
        searchDepth - 1,
        -Infinity,
        Infinity,
        0,
        beamWidth
    );
    return baseScore + (searchValue * 0.35);
}

function makePolicyStateKey(playerKey, board, pendingType, legalMovesCount) {
    const pending = pendingType || '-';
    const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    return `${playerKey}|${encodeBoard(board)}|${pending}|${legal}`;
}

function makePolicyActionKey(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
    return `place:${move.row}:${move.col}`;
}

function cellType(row, col, boardOrSize) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellType === 'function') {
        if (Array.isArray(boardOrSize)) return SharedBoardUtils.getCellType(row, col, boardOrSize);
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return SharedBoardUtils.getCellType(row, col, n, n);
    }
    const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
    if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) return 'x';
    const nearTB = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
    const nearLR = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
    if (nearTB || nearLR) return 'c';
    if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
    return 'inner';
}

function makePolicyAbstractActionKey(move, boardShapeOrSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return 'place_cat:unknown';
    return `place_cat:${cellType(move.row, move.col, boardShapeOrSize)}`;
}

function countEmptiesInBoardKey(boardKey) {
    if (typeof boardKey !== 'string' || !boardKey) return 0;
    let c = 0;
    for (let i = 0; i < boardKey.length; i++) if (boardKey[i] === '.') c++;
    return c;
}

function discDiffFromPlayer(boardKey, playerKey) {
    if (typeof boardKey !== 'string') return 0;
    let b = 0;
    let w = 0;
    for (let i = 0; i < boardKey.length; i++) {
        if (boardKey[i] === 'B') b++;
        if (boardKey[i] === 'W') w++;
    }
    return playerKey === 'black' ? (b - w) : (w - b);
}

function cornerDiffFromPlayer(boardKey, playerKey) {
    const rows = typeof boardKey === 'string' ? boardKey.split('/') : [];
    if (!rows.length) return 0;
    const size = rows.length;
    const own = playerKey === 'black' ? 'B' : 'W';
    const opp = own === 'B' ? 'W' : 'B';
    const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
    let ownCount = 0;
    let oppCount = 0;
    for (const p of corners) {
        const ch = rows[p[0]][p[1]];
        if (ch === own) ownCount++;
        else if (ch === opp) oppCount++;
    }
    return ownCount - oppCount;
}

function toBucket(value, steps) {
    for (let i = 0; i < steps.length; i++) {
        if (value <= steps[i]) return String(steps[i]);
    }
    return `>${steps[steps.length - 1]}`;
}

function makePolicyAbstractStateKey(playerKey, board, pendingType, legalMovesCount) {
    const pending = pendingType || '-';
    const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const boardKey = typeof board === 'string' ? board : '';
    const empties = Array.isArray(board) ? countEmpties(board) : countEmptiesInBoardKey(boardKey);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobility = toBucket(legal, [0, 2, 4, 6, 10, 20]);
    const disc = toBucket(Array.isArray(board) ? countDiscDiffOnBoard(board, toPlayerValue(playerKey)) : discDiffFromPlayer(boardKey, playerKey), [-20, -10, -4, 0, 4, 10, 20]);
    const corner = toBucket(Array.isArray(board) ? countCorners(board, toPlayerValue(playerKey)) : cornerDiffFromPlayer(boardKey, playerKey), [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobility}|disc:${disc}|corner:${corner}`;
}

function getPolicyScore(options, context, move) {
    if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
    const model = options.policyTableModel;
    const runtimeBoard = getSelfplayBoard(context && context.gameState, context && context.cardState);
    if (
        model.schemaVersion !== SELFPLAY_SCHEMA_VERSION &&
        model.schemaVersion !== LEGACY_SELFPLAY_SCHEMA_VERSION &&
        model.schemaVersion !== 'policy_table.v1' &&
        model.schemaVersion !== 'policy_table.v2'
    ) return null;

    if (
        model.schemaVersion !== SELFPLAY_SCHEMA_VERSION &&
        model.schemaVersion !== LEGACY_SELFPLAY_SCHEMA_VERSION &&
        CpuPolicyTableRuntime &&
        typeof CpuPolicyTableRuntime.getActionScoreFromModel === 'function'
    ) {
        const score = CpuPolicyTableRuntime.getActionScoreFromModel(model, move, {
            playerKey: context.playerKey,
            level: 6,
            board: runtimeBoard,
            pendingType: context.pendingType || null,
            legalMovesCount: context.legalMovesCount
        });
        if (Number.isFinite(score)) return Number(score);
    }

    const schema = model.schemaVersion || 'policy_table.v1';
    const canonical = schema === 'policy_table.v2'
        ? canonicalizeBoard(runtimeBoard)
        : { boardKey: encodeBoard(runtimeBoard), transformId: 0 };
    const key = `${context.playerKey}|${canonical.boardKey}|${context.pendingType || '-'}|${context.legalMovesCount}`;
    let state = model.states[key];
    let isAbstract = false;
    if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = makePolicyAbstractStateKey(
            context.playerKey,
            runtimeBoard,
            context.pendingType || '-',
            context.legalMovesCount
        );
        state = model.abstractStates[abstractKey];
        isAbstract = !!state;
    }
    if (!state || !state.actions) return null;

    const actionKey = (() => {
        if (isAbstract) return makePolicyAbstractActionKey(move, runtimeBoard);
        if (schema !== 'policy_table.v2') return makePolicyActionKey(move);
        if (SharedBoardUtils && typeof SharedBoardUtils.makeCanonicalActionKey === 'function') {
            return SharedBoardUtils.makeCanonicalActionKey(move, runtimeBoard, canonical.transformId);
        }
        const mapped = transformCoord(move.row, move.col, context.gameState.board.length, canonical.transformId);
        return `place:${mapped.row}:${mapped.col}`;
    })();
    const stat = state.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = state.bestAction === actionKey ? (isAbstract ? 50 : 100) : 0;
    const visitBonus = Math.log1p(Math.max(0, visits)) * 15;
    const outcomeBonus = avgOutcome * 80;
    return bestBonus + visitBonus + outcomeBonus;
}

function getPolicyActionScoreByKey(options, context, actionKey) {
    if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
    if (!actionKey || typeof actionKey !== 'string') return null;
    const model = options.policyTableModel;
    if (
        model.schemaVersion !== SELFPLAY_SCHEMA_VERSION &&
        model.schemaVersion !== LEGACY_SELFPLAY_SCHEMA_VERSION &&
        model.schemaVersion !== 'policy_table.v1' &&
        model.schemaVersion !== 'policy_table.v2'
    ) return null;

    const schema = model.schemaVersion || 'policy_table.v1';
    const runtimeBoard = getSelfplayBoard(context && context.gameState, context && context.cardState);
    const canonical = schema === 'policy_table.v2'
        ? canonicalizeBoard(runtimeBoard)
        : { boardKey: encodeBoard(runtimeBoard), transformId: 0 };
    const key = `${context.playerKey}|${canonical.boardKey}|${context.pendingType || '-'}|${context.legalMovesCount}`;
    let state = model.states[key];
    if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = makePolicyAbstractStateKey(context.playerKey, runtimeBoard, context.pendingType || '-', context.legalMovesCount);
        state = model.abstractStates[abstractKey];
    }
    if (!state || !state.actions) return null;

    const stat = state.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = state.bestAction === actionKey ? 1_000_000 : 0;
    return bestBonus + visits * 1_000 + avgOutcome;
}

function createPolicyRuntimeContext(context, legalMovesCountOverride) {
    return {
        playerKey: context && context.playerKey === 'black' ? 'black' : 'white',
        level: 6,
        board: getSelfplayBoard(context && context.gameState, context && context.cardState),
        pendingType: context && context.pendingType ? context.pendingType : null,
        legalMovesCount: Number.isFinite(legalMovesCountOverride)
            ? Number(legalMovesCountOverride)
            : (Number.isFinite(context && context.legalMovesCount) ? Number(context.legalMovesCount) : 0)
    };
}

function selectPlacementMoveFromPolicyModel(options, context, candidateMoves) {
    if (!options || !options.policyTableModel || !Array.isArray(candidateMoves) || candidateMoves.length <= 0) return null;
    if (
        options.policyTableModel.schemaVersion !== SELFPLAY_SCHEMA_VERSION &&
        options.policyTableModel.schemaVersion !== LEGACY_SELFPLAY_SCHEMA_VERSION &&
        CpuPolicyTableRuntime &&
        typeof CpuPolicyTableRuntime.chooseMoveFromModel === 'function'
    ) {
        const selected = CpuPolicyTableRuntime.chooseMoveFromModel(
            options.policyTableModel,
            candidateMoves,
            createPolicyRuntimeContext(context, candidateMoves.length)
        );
        return CpuLv6LookaheadProfile.resolveCandidateMoveByCoord(candidateMoves, selected) || selected;
    }

    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const move of candidateMoves) {
        const score = getPolicyScore(options, Object.assign({}, context || {}, {
            legalMovesCount: candidateMoves.length
        }), move);
        if (!Number.isFinite(score)) continue;
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
    return bestMove;
}

function chooseBestMoveByScore(candidateMoves, scoreFn) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0 || typeof scoreFn !== 'function') return null;
    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const move of candidateMoves) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            score = Number(scoreFn(move) || 0);
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
    return bestMove;
}

function choosePlacementMoveByBrowserParity(candidateMoves, context, options, movePlanContext) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) {
        return {
            move: null,
            learnedMove: null,
            learnedScoreFn: null,
            movePlanScoreFn: null,
            combinedScoreFn: null
        };
    }

    const learnedMove = selectPlacementMoveFromPolicyModel(options, context, candidateMoves);
    const learnedScoreFn = (move) => getPolicyScore(options, Object.assign({}, context || {}, {
        legalMovesCount: candidateMoves.length
    }), move);
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
    const policyScoreWeight = Number.isFinite(options && options.policyScoreWeight)
        ? Math.max(0, Number(options.policyScoreWeight))
        : (movePlanScoreFn ? 0.35 : 1.0);
    const heuristicWeight = Number.isFinite(options && options.heuristicWeight)
        ? Math.max(0, Number(options.heuristicWeight))
        : 1.0;
    const tacticalWeight = Number.isFinite(options && options.tacticalWeight)
        ? Math.max(0, Number(options.tacticalWeight))
        : 1.0;
    const combinedScoreFn = (move) => {
        let score = 0;
        if (movePlanScoreFn) score += movePlanScoreFn(move) * heuristicWeight;
        const learnedScore = learnedScoreFn ? Number(learnedScoreFn(move) || 0) : 0;
        if (learnedScoreFn) {
            score += learnedScore * policyScoreWeight;
        }
        if (learnedMove && move && Number(move.row) === Number(learnedMove.row) && Number(move.col) === Number(learnedMove.col)) {
            const learnedBonusScale = Math.max(0, Math.min(1, policyScoreWeight));
            score += (movePlanScoreFn ? 1200 : 2500) * learnedBonusScale;
        }
        return score;
    };

    let selectedMove = null;
    const tacticalLookaheadEnabled =
        !(options && options.enableTacticalLookahead === false) &&
        tacticalWeight > 0;
    if (
        tacticalLookaheadEnabled &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.chooseMoveByLookahead === 'function' &&
        context &&
        context.gameState &&
        Array.isArray(context.gameState.board)
    ) {
        const teacherLookaheadOverride = {
            tacticalDepthOpening: options && options.tacticalDepthOpening,
            tacticalDepthMid: options && options.tacticalDepthMid,
            tacticalDepthEnd: options && options.tacticalDepthEnd,
            tacticalBeamWidth: options && options.tacticalBeamWidth
        };
        const lookaheadOptions = CpuLv6LookaheadProfile.buildLv6LookaheadOptions(
            6,
            context.gameState.board,
            candidateMoves.length,
            context.playerKey,
            'teacher',
            teacherLookaheadOverride
        );
        const weights = CpuLv6LookaheadProfile.resolveLv6LookaheadWeights();
        const disableLookaheadTimeBudget = options && options.disableLookaheadTimeBudget === true;
        const resolvedMaxTimeMs = disableLookaheadTimeBudget
            ? 0
            : normalizeLookaheadTimeBudget(
                options && options.lookaheadMaxTimeMs,
                normalizeLookaheadTimeBudget(lookaheadOptions.maxTimeMs, 2200)
            );
        const resolvedEndgameMaxTimeMs = disableLookaheadTimeBudget
            ? 0
            : normalizeLookaheadTimeBudget(
                options && options.lookaheadEndgameMaxTimeMs,
                normalizeLookaheadTimeBudget(lookaheadOptions.endgameMaxTimeMs, 12000)
            );
        const looked = CpuPolicyCore.chooseMoveByLookahead(candidateMoves, {
            board: context.gameState.board,
            playerValue: toPlayerValue(context.playerKey),
            level: 6,
            depth: lookaheadOptions.depth,
            maxBranch: lookaheadOptions.maxBranch,
            nodeBudget: lookaheadOptions.nodeBudget,
            scoreMove: combinedScoreFn,
            priorWeight: Number(weights && weights.policyLookaheadPriorWeight) || 58,
            searchWeight: (Number(weights && weights.searchWeight) || 1.55) * tacticalWeight,
            endgameSolveEmpties: lookaheadOptions.endgameSolveEmpties || 40,
            endgameDepth: lookaheadOptions.endgameDepth || 40,
            endgameNodeBudget: lookaheadOptions.endgameNodeBudget || 2_500_000,
            maxTimeMs: resolvedMaxTimeMs,
            endgameMaxTimeMs: resolvedEndgameMaxTimeMs,
            virtualTimePerNodeMs: Number.isFinite(options && options.lookaheadVirtualTimePerNodeMs)
                ? Math.max(0, Number(options.lookaheadVirtualTimePerNodeMs))
                : Number.NaN,
            boardBonusByCell: (context.cardState && context.cardState.boardBonusByCell && typeof context.cardState.boardBonusByCell === 'object')
                ? context.cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (context.cardState && context.cardState.boardBonusConsumedByCell && typeof context.cardState.boardBonusConsumedByCell === 'object')
                ? context.cardState.boardBonusConsumedByCell
                : null
        });
        if (looked) {
            selectedMove = CpuLv6LookaheadProfile.maybeOverrideWithStrictPendingPlacement(
                looked,
                candidateMoves,
                context.pendingType || null,
                movePlanScoreFn,
                context.gameState.board,
                context.cardState && context.cardState.boardBonusByCell,
                context.cardState && context.cardState.boardBonusConsumedByCell
            );
        }
    }

    if (!selectedMove) {
        selectedMove = chooseBestMoveByScore(candidateMoves, combinedScoreFn) || learnedMove || candidateMoves[0];
    }

    return {
        move: CpuLv6LookaheadProfile.resolveCandidateMoveByCoord(candidateMoves, selectedMove) || selectedMove,
        learnedMove,
        learnedScoreFn,
        movePlanScoreFn,
        combinedScoreFn
    };
}

function selectPlacementMove(legalMoves, rng, context, options) {
    const scored = scorePlacementCandidates(legalMoves, rng, context, options);
    if (scored && scored.move) return scored.move;
    if (Array.isArray(legalMoves) && legalMoves.length > 0) return legalMoves[0];
    return null;
}

function makeMoveKey(move) {
    if (!move) return '';
    return `${Number(move.row)}:${Number(move.col)}`;
}

function sortScoredMovesBy(scoredMoves, scoreKey) {
    return scoredMoves.slice().sort((a, b) => {
        const sa = Number.isFinite(a && a[scoreKey]) ? Number(a[scoreKey]) : Number.NEGATIVE_INFINITY;
        const sb = Number.isFinite(b && b[scoreKey]) ? Number(b[scoreKey]) : Number.NEGATIVE_INFINITY;
        if (sb !== sa) return sb - sa;
        const ar = Number.isFinite(a && a.move && a.move.row) ? Number(a.move.row) : 0;
        const br = Number.isFinite(b && b.move && b.move.row) ? Number(b.move.row) : 0;
        if (ar !== br) return ar - br;
        const ac = Number.isFinite(a && a.move && a.move.col) ? Number(a.move.col) : 0;
        const bc = Number.isFinite(b && b.move && b.move.col) ? Number(b.move.col) : 0;
        return ac - bc;
    });
}

function buildBordaMaps(scoredMoves) {
    const keys = ['strategistScore', 'tacticianScore', 'economistScore'];
    const points = new Map();
    const ranksByKey = {
        strategistScore: new Map(),
        tacticianScore: new Map(),
        economistScore: new Map()
    };
    const n = Array.isArray(scoredMoves) ? scoredMoves.length : 0;
    if (n <= 0) return { points, ranksByKey };
    for (const scoreKey of keys) {
        const ordered = sortScoredMovesBy(scoredMoves, scoreKey);
        for (let i = 0; i < ordered.length; i++) {
            const one = ordered[i];
            const key = makeMoveKey(one && one.move);
            if (!key) continue;
            ranksByKey[scoreKey].set(key, i);
            const add = (n - 1 - i);
            points.set(key, (points.get(key) || 0) + add);
        }
    }
    return { points, ranksByKey };
}

function scorePlacementCandidates(legalMoves, rng, context, options) {
    const forcedPlacement = resolveForcedPlacementCandidates(
        legalMoves,
        options,
        getSelfplayBoard(context && context.gameState, context && context.cardState)
    );
    const defaultCandidateMoves = Array.isArray(legalMoves)
        ? legalMoves.filter((move) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        : [];
    const candidateMoves = (Array.isArray(forcedPlacement.moves) && forcedPlacement.moves.length > 0)
        ? forcedPlacement.moves
        : defaultCandidateMoves;
    if (candidateMoves.length <= 0) {
        return { move: null, metrics: null };
    }
    const enableTacticalLookahead = !(options && options.enableTacticalLookahead === false);
    let usableCardIds = [];
    try {
        usableCardIds = getDirectUsableCardIds(context && context.cardState, context && context.gameState, context && context.playerKey);
    } catch (e) {
        usableCardIds = [];
    }
    const planState = buildCornerPlanState(
        context && context.gameState,
        context && context.cardState,
        context && context.playerKey,
        legalMoves,
        usableCardIds
    );
    const movePlanContext = buildMovePlanContext(
        context && context.gameState,
        context && context.cardState,
        context && context.playerKey,
        legalMoves,
        usableCardIds
    );
    const scoreContext = Object.assign({}, context || {}, {
        planState,
        movePlanContext
    });
    const paritySelection = choosePlacementMoveByBrowserParity(candidateMoves, Object.assign({}, context || {}, {
        legalMovesCount: candidateMoves.length
    }), Object.assign({}, options || {}, {
        enableTacticalLookahead
    }), movePlanContext);
    const parityCombinedScoreFn = paritySelection && typeof paritySelection.combinedScoreFn === 'function'
        ? paritySelection.combinedScoreFn
        : null;
    const parityMove = paritySelection && paritySelection.move ? paritySelection.move : null;
    const scoredMoves = [];
    let bestCombinedScore = -Infinity;
    for (const move of candidateMoves) {
        const heuristic = scoreMove(move, rng, scoreContext);
        const policy = getPolicyScore(options, Object.assign({}, context || {}, {
            legalMovesCount: candidateMoves.length
        }), move);
        const policyScore = policy !== null ? policy : 0;
        const combined = parityCombinedScoreFn ? Number(parityCombinedScoreFn(move) || 0) : 0;
        scoredMoves.push({
            move,
            heuristicScore: heuristic,
            policyScore,
            tacticalScore: 0,
            combinedScore: combined,
            committeeScore: 0,
            finalScore: combined,
            committeeVotes: 0
        });
        if (combined > bestCombinedScore) bestCombinedScore = combined;
    }

    let selected = parityMove
        ? scoredMoves.find((one) => CpuLv6LookaheadProfile.isSameMoveByCoord(one.move, parityMove)) || null
        : null;
    if (!selected) {
        let bestScored = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const one of scoredMoves) {
            const score = Number(one && one.finalScore) || 0;
            if (score > bestScore) {
                bestScore = score;
                bestScored = one;
                continue;
            }
            if (score === bestScore && bestScored && CpuLv6LookaheadProfile.isSameMoveByCoord(bestScored.move, one.move) === false) {
                const bestRow = Number(bestScored.move && bestScored.move.row);
                const bestCol = Number(bestScored.move && bestScored.move.col);
                const row = Number(one.move && one.move.row);
                const col = Number(one.move && one.move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    bestScored = one;
                }
            }
        }
        selected = bestScored;
    }

    if (!selected) {
        return { move: null, metrics: null };
    }

    let bestTacticalScore = 0;
    if (enableTacticalLookahead) {
        const tacticalLimit = resolveTacticalMetricsCandidateLimit(options, scoredMoves.length);
        if (tacticalLimit > 0) {
            const tacticalCandidates = scoredMoves
                .slice()
                .sort((a, b) => {
                    const aScore = Number(a && a.finalScore) || 0;
                    const bScore = Number(b && b.finalScore) || 0;
                    if (bScore !== aScore) return bScore - aScore;
                    const aRow = Number(a && a.move && a.move.row);
                    const bRow = Number(b && b.move && b.move.row);
                    if (aRow !== bRow) return aRow - bRow;
                    const aCol = Number(a && a.move && a.move.col);
                    const bCol = Number(b && b.move && b.move.col);
                    return aCol - bCol;
                })
                .slice(0, tacticalLimit);

            if (!tacticalCandidates.some((one) => one === selected)) {
                tacticalCandidates.push(selected);
            }

            for (const one of tacticalCandidates) {
                const tactical = scoreTacticalMove(one.move, scoreContext, options);
                one.tacticalScore = tactical;
                if (tactical > bestTacticalScore) bestTacticalScore = tactical;
            }
        }
    }

    const sortedByFinalScore = scoredMoves
        .slice()
        .sort((a, b) => {
            const aScore = Number(a && a.finalScore) || 0;
            const bScore = Number(b && b.finalScore) || 0;
            if (bScore !== aScore) return bScore - aScore;
            const aRow = Number(a && a.move && a.move.row);
            const bRow = Number(b && b.move && b.move.row);
            if (aRow !== bRow) return aRow - bRow;
            const aCol = Number(a && a.move && a.move.col);
            const bCol = Number(b && b.move && b.move.col);
            return aCol - bCol;
        })
        .slice(0, 3)
        .map((one) => ({
            row: Number.isFinite(one && one.move && one.move.row) ? Number(one.move.row) : null,
            col: Number.isFinite(one && one.move && one.move.col) ? Number(one.move.col) : null,
            seat: classifySelectionSeat(
                Number.isFinite(one && one.move && one.move.row) ? Number(one.move.row) : null,
                Number.isFinite(one && one.move && one.move.col) ? Number(one.move.col) : null,
                context && context.gameState ? context.gameState.board : null
            ),
            heuristicScore: Number(one && one.heuristicScore) || 0,
            policyScore: Number(one && one.policyScore) || 0,
            tacticalScore: Number(one && one.tacticalScore) || 0,
            combinedScore: Number(one && one.combinedScore) || 0,
            finalScore: Number(one && one.finalScore) || 0,
            committeeVotes: Number(one && one.committeeVotes) || 0
        }));

    const selectedCombined = Number(selected.combinedScore) || 0;
    const selectedTactical = Number(selected.tacticalScore) || 0;
    const bestCombined = Number(bestCombinedScore) || 0;
    const bestTactical = Number(bestTacticalScore) || 0;
    const compositeScoreMiss = Math.max(0, bestCombined - selectedCombined);
    const tacticalScoreMiss = Math.max(0, bestTactical - selectedTactical);

    return {
        move: selected.move,
        metrics: {
            selectedCompositeScore: selectedCombined,
            bestCompositeScore: bestCombined,
            compositeScoreMiss,
            compositeScoreMissRatio: compositeScoreMiss / Math.max(1, Math.abs(bestCombined)),
            selectedTacticalScore: selectedTactical,
            bestTacticalScore: bestTactical,
            tacticalScoreMiss,
            tacticalScoreMissRatio: tacticalScoreMiss / Math.max(1, Math.abs(bestTactical)),
            selectedHeuristicScore: Number(selected.heuristicScore) || 0,
            selectedPolicyScore: Number(selected.policyScore) || 0,
            selectedFinalScore: Number(selected.finalScore) || 0,
            selectedCommitteeScore: Number(selected.committeeScore) || 0,
            selectedCommitteeVotes: Number(selected.committeeVotes) || 0,
            forcedPlacementCategory: forcedPlacement.category || null,
            topCandidates: sortedByFinalScore
        }
    };
}

function evaluatePositionValue(row, col, boardOrSize) {
    let score = 0;
    if (isCorner(row, col, boardOrSize)) score += 10000;
    else if (isEdge(row, col, boardOrSize)) score += 250;
    if (isXSquare(row, col, boardOrSize)) score -= 600;
    if (isCSquare(row, col, boardOrSize)) score -= 300;
    return score;
}

function getCellOwnerValueForSelfplay(gameState, row, col) {
    if (!gameState) return 0;
    const board = getSelfplayBoard(gameState);
    const value = getBoardCellValue(board, row, col);
    return Number(value) || 0;
}

function getLegalMovesForAction(gameState, cardState, playerKey) {
    const player = toPlayerValue(playerKey);
    const context = getSafeCardContext(cardState);
    const pendingType = CardLogic.getPendingEffectType(cardState, playerKey);

    if (CardLogic.isFreePlacementPendingType(pendingType)) {
        return Core.getFreePlacementMoves(gameState, player, context);
    }
    return Core.getLegalMoves(gameState, player, context);
}

function getDirectUsableCardIds(cardState, gameState, playerKey) {
    const ids = CardLogic.getUsableCardIds(cardState, gameState, playerKey);
    if (!Array.isArray(ids)) return [];
    return ids.filter((cardId) => {
        let t = '';
        try {
            t = CardLogic.getCardType(cardId);
        } catch (e) {
            t = resolveCardType(cardId);
        }
        return CANDIDATE_CARD_TYPES.has(t);
    });
}

function buildCardDecisionContext(gameState, cardState, playerKey, legalMovesCount, legalMoves, usableCardIds) {
    const ownKey = playerKey === 'black' ? 'black' : 'white';
    const oppKey = ownKey === 'black' ? 'white' : 'black';
    const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
    const hasDestroyedCardThisTurn = !!(
        cardState &&
        cardState.hasDestroyedCardThisTurnByPlayer &&
        cardState.hasDestroyedCardThisTurnByPlayer[ownKey]
    );
    const pending = cardState && cardState.pendingEffectByPlayer
        ? cardState.pendingEffectByPlayer[ownKey]
        : null;
    let safeUsableCardIds = Array.isArray(usableCardIds) ? usableCardIds.slice() : null;
    if (!safeUsableCardIds) {
        try {
            safeUsableCardIds = getDirectUsableCardIds(cardState, gameState, ownKey);
        } catch (e) {
            safeUsableCardIds = [];
        }
    }
    const planState = buildCornerPlanState(gameState, cardState, ownKey, safeLegalMoves, safeUsableCardIds);
    const legalMoveMetrics = (CpuPolicyCore && typeof CpuPolicyCore.computeLegalMoveMetrics === 'function')
        ? CpuPolicyCore.computeLegalMoveMetrics(safeLegalMoves, (row, col) => getBoardBonusAtCell(cardState, row, col))
        : {
            maxLegalFlips: 0,
            avgLegalFlips: 0,
            maxLegalGain: 0,
            maxLegalBoardBonus: 0
        };

    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    let ownSpecialCount = 0;
    let oppSpecialCount = 0;
    let ownGuardCount = 0;
    let oppGuardCount = 0;
    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone') continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        const type = data && typeof data.type === 'string' ? data.type : '';
        if (type === 'METEOR_HOLE') continue;
        if (marker.owner === ownKey) {
            ownSpecialCount += 1;
            if (type === 'GUARD') ownGuardCount += 1;
        } else if (marker.owner === oppKey) {
            oppSpecialCount += 1;
            if (type === 'GUARD') oppGuardCount += 1;
        }
    }

    return {
        level: 6,
        playerValue: toPlayerValue(playerKey),
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        discDiff: countDiscsByValue(gameState, toPlayerValue(playerKey)),
        empties: countEmpties(gameState.board),
        ownCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? cardState.charge[ownKey] : 0,
        oppCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[oppKey]) ? cardState.charge[oppKey] : 0,
        oppHandSize: cardState && cardState.hands && Array.isArray(cardState.hands[oppKey]) ? cardState.hands[oppKey].length : 0,
        handSize: cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey].length : 0,
        handCardIds: cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey].slice() : [],
        hasDestroyedCardThisTurn,
        forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
        ownCorners: planState.ownCorners,
        oppCorners: planState.oppCorners,
        ownEdges: planState.ownEdges,
        oppEdges: planState.oppEdges,
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
        ownSpecialCount,
        oppSpecialCount,
        ownGuardCount,
        oppGuardCount,
        usableCardIds: safeUsableCardIds.slice(),
        cornerPlanState: planState
    };
}

function selectCardIdToUse(cardState, gameState, playerKey, options, context) {
    const usable = getDirectUsableCardIds(cardState, gameState, playerKey);
    if (!usable.length) return null;
    const riskContext = buildCardDecisionContext(
        gameState,
        cardState,
        playerKey,
        context && Number.isFinite(context.legalMovesCount) ? context.legalMovesCount : 0,
        context && Array.isArray(context.legalMoves) ? context.legalMoves : [],
        usable
    );

    if (options && options.policyTableModel && context) {
        let bestCardId = null;
        let bestScore = -Infinity;
        for (const cardId of usable) {
            const s = getPolicyActionScoreByKey(options, context, `use_card:${cardId}`);
            if (!Number.isFinite(s)) continue;
            if (s > bestScore) {
                bestScore = s;
                bestCardId = cardId;
            }
        }
        if (bestCardId) {
            if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') return bestCardId;
            const score = CpuPolicyCore.scoreCardUseDecision(
                bestCardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                riskContext
            );
            if (!score || score.shouldUse) return bestCardId;
        }
    }

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
        const selected = CpuPolicyCore.chooseCardWithRiskProfile(
            usable,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            riskContext
        );
        if (selected && selected.cardId) return selected.cardId;
    }

    usable.sort((a, b) => CardLogic.getCardCost(b) - CardLogic.getCardCost(a));
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function') return usable[0];
    for (const cardId of usable) {
        const score = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            riskContext
        );
        if (!score || score.shouldUse) return cardId;
    }
    return null;
}

function selectDestroyHandCardId(cardState, gameState, playerKey, context) {
    const ownKey = playerKey === 'black' ? 'black' : 'white';
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[ownKey])) return null;
    if (cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[ownKey]) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.chooseHandDestroyTargetForCycle !== 'function') return null;

    const hand = cardState.hands[ownKey].slice();
    if (hand.length <= 0) return null;

    const legalMoves = (context && Array.isArray(context.legalMoves)) ? context.legalMoves : [];
    const legalMovesCount = (context && Number.isFinite(context.legalMovesCount))
        ? Number(context.legalMovesCount)
        : legalMoves.length;
    const usable = getDirectUsableCardIds(cardState, gameState, ownKey);
    const riskContext = buildCardDecisionContext(gameState, cardState, ownKey, legalMovesCount, legalMoves, usable);
    const selected = CpuPolicyCore.chooseHandDestroyTargetForCycle(
        hand,
        usable,
        CardLogic.getCardCost,
        CardLogic.getCardDef,
        riskContext
    );
    return selected && selected.cardId ? selected.cardId : null;
}

function choosePendingTargetByScore(targets, scoreTarget) {
    const safeTargets = Array.isArray(targets)
        ? targets.filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col))
        : [];
    if (!safeTargets.length) return null;

    if (
        PendingTargetSelector &&
        typeof PendingTargetSelector.choosePendingTargetWithPolicy === 'function'
    ) {
        return PendingTargetSelector.choosePendingTargetWithPolicy({
            targets: safeTargets,
            scoreTarget
        });
    }

    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const target of safeTargets) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            const rawScore = Number(scoreTarget(target));
            score = Number.isFinite(rawScore) ? rawScore : Number.NEGATIVE_INFINITY;
        } catch (e) {
            score = Number.NEGATIVE_INFINITY;
        }
        if (!best || score > bestScore || (score === bestScore && ((target.row < best.row) || (target.row === best.row && target.col < best.col)))) {
            best = target;
            bestScore = score;
        }
    }
    return best || safeTargets[0];
}

function chooseSwapTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    return choosePendingTargetByScore(
        targets,
        (target) => evaluatePositionValue(target.row, target.col) + rng.random() * 0.01
    );
}

function choosePositionSwapTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    return choosePendingTargetByScore(
        targets,
        (target) => evaluatePositionValue(target.row, target.col) + rng.random() * 0.01
    );
}

function chooseDestroyTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    const selfVal = toPlayerValue(playerKey);
    return choosePendingTargetByScore(targets, (target) => {
        const occupant = getCellOwnerValueForSelfplay(gameState, target.row, target.col);
        const isEnemy = occupant === -selfVal;
        const base = evaluatePositionValue(target.row, target.col);
        return (isEnemy ? 2000 : 0) + base + rng.random() * 0.01;
    });
}

function chooseTargetBySimulation(gameState, cardState, playerKey, rng, applyEffectFn, fallbackScoreFn, scoreAdjustFn) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;

    return choosePendingTargetByScore(targets, (target) => {
        let score = null;
        try {
            const simGameState = Core.copyGameState(gameState);
            const simCardState = (typeof CardLogic.copyCardState === 'function')
                ? CardLogic.copyCardState(cardState)
                : deepClone(cardState);
            const simRng = clonePrng(rng);
            const result = applyEffectFn(simCardState, simGameState, playerKey, target.row, target.col, simRng);
            if (result && result.applied === true) {
                score = evaluateBoardForPlayer(simGameState, simCardState, playerKey);
                if (typeof scoreAdjustFn === 'function') {
                    score += Number(scoreAdjustFn(target, result, simGameState, simCardState, gameState, cardState, playerKey) || 0);
                }
            }
        } catch (e) { /* fallback score */ }

        if (!Number.isFinite(score)) {
            score = typeof fallbackScoreFn === 'function'
                ? Number(fallbackScoreFn(target, gameState, cardState, playerKey) || 0)
                : evaluatePositionValue(target.row, target.col);
        }
        return score;
    });
}

function chooseStrongWindTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col, simRng) =>
            CardLogic.applyStrongWindWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
        (target, sourceGameState, _sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const base = evaluatePositionValue(target.row, target.col);
            return occupant === selfVal ? (base * -0.4) : (base * -1.2);
        },
        (target, result, _simGameState, _simCardState, sourceGameState, sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const fromVal = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const isOwnStone = fromVal === selfVal;
            let extra = 0;
            if (isCorner(target.row, target.col) && !isOwnStone) extra += 7000;
            if (isCorner(target.row, target.col) && isOwnStone) extra -= 8000;
            if (result && result.to) {
                if (isCorner(result.to.row, result.to.col)) extra += isOwnStone ? 6500 : -5000;
                if (isEdge(result.to.row, result.to.col) && !isCorner(result.to.row, result.to.col)) {
                    extra += isOwnStone ? 1800 : -900;
                }
                extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 800;
            }
            return extra;
        }
    );
}

function chooseSuperBuoyancyTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applySuperBuoyancyWill(simCardState, simGameState, onePlayerKey, row, col),
        (target, sourceGameState, _sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const isEnemy = occupant === -selfVal;
            const base = evaluatePositionValue(target.row, target.col);
            return isEnemy ? (base * 1.5) + 1200 : (base * -0.35);
        },
        (_target, result, _simGameState, _simCardState, _sourceGameState, sourceCardState) => {
            let extra = 0;
            const destroyedCount = Number(result && result.destroyedCount);
            if (Number.isFinite(destroyedCount) && destroyedCount > 0) {
                extra += destroyedCount * 520;
            }
            if (result && result.to) {
                if (isCorner(result.to.row, result.to.col)) extra += 5600;
                if (isEdge(result.to.row, result.to.col) && !isCorner(result.to.row, result.to.col)) extra += 1400;
                extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
            }
            return extra;
        }
    );
}

function chooseSuperGravityTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applySuperGravityWill(simCardState, simGameState, onePlayerKey, row, col),
        (target, sourceGameState, _sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const isEnemy = occupant === -selfVal;
            const base = evaluatePositionValue(target.row, target.col);
            return isEnemy ? (base * 1.5) + 1200 : (base * -0.35);
        },
        (_target, result, _simGameState, _simCardState, _sourceGameState, sourceCardState) => {
            let extra = 0;
            const destroyedCount = Number(result && result.destroyedCount);
            if (Number.isFinite(destroyedCount) && destroyedCount > 0) {
                extra += destroyedCount * 520;
            }
            if (result && result.to) {
                if (isCorner(result.to.row, result.to.col)) extra += 5600;
                if (isEdge(result.to.row, result.to.col) && !isCorner(result.to.row, result.to.col)) extra += 1400;
                extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
            }
            return extra;
        }
    );
}

function chooseGuardTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyGuardWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.4)
    );
}

function chooseBoardExpansionTarget(gameState, cardState, playerKey, rng) {
    const pending = (cardState && cardState.pendingEffectByPlayer)
        ? cardState.pendingEffectByPlayer[playerKey]
        : null;
    const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_EXPANSION_WILL';
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) => {
            const simPending = (simCardState && simCardState.pendingEffectByPlayer)
                ? simCardState.pendingEffectByPlayer[onePlayerKey]
                : null;
            const simPendingType = simPending && typeof simPending.type === 'string' ? simPending.type : pendingType;
            if (simPendingType === 'BOARD_EXPANSION_GOD' && typeof CardLogic.applyBoardExpansionGod === 'function') {
                return CardLogic.applyBoardExpansionGod(simCardState, simGameState, onePlayerKey, row, col);
            }
            return CardLogic.applyBoardExpansionWill(simCardState, simGameState, onePlayerKey, row, col);
        },
        (target) => {
            if (target.row === 0 || target.row === 7) return 9000;
            if (target.row === 1 || target.row === 6) return 2200;
            return 600;
        }
    );
}

function chooseBlockadeTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyBlockadeWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.3)
    );
}

function chooseMeteorTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyMeteorWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.35)
    );
}

function chooseTrapTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyTrapWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.1)
    );
}

function chooseCloneTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col, simRng) =>
            CardLogic.applyCloneWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.25)
    );
}

function chooseHyperactiveInheritTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyHyperactiveInheritWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => (evaluatePositionValue(target.row, target.col) * 1.15),
        (target, _result, sourceGameState, _sourceCardState, _origGameState, _origCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            let extra = 0;
            if (occupant === selfVal && isCorner(target.row, target.col)) extra += 1200;
            if (occupant === selfVal && !isCorner(target.row, target.col) && isEdge(target.row, target.col)) extra += 600;
            if (isXSquare(target.row, target.col)) extra -= 350;
            return extra;
        }
    );
}

function chooseTeleportTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col, simRng) =>
            CardLogic.applyTeleportWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
        (target, sourceGameState, _sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const isEnemy = occupant === -selfVal;
            const base = evaluatePositionValue(target.row, target.col);
            if (isEnemy) return (base * 1.4) + 900;
            return (base * -0.45);
        }
    );
}

function chooseCellTeleportTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col, simRng) =>
            CardLogic.applyCellTeleportWill(simCardState, simGameState, onePlayerKey, row, col, simRng),
        (target, sourceGameState, _sourceCardState, onePlayerKey) => {
            const selfVal = toPlayerValue(onePlayerKey);
            const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const isEnemy = occupant === -selfVal;
            const base = evaluatePositionValue(target.row, target.col);
            if (isEnemy) return (base * 1.6) + 1500;
            return (base * -0.55) - 120;
        },
        (_target, result, _simGameState, _simCardState, _sourceGameState, sourceCardState) => {
            let extra = 0;
            if (result && result.to) {
                const toOuter = result.to.row < 0 || result.to.row > 7 || result.to.col < 0 || result.to.col > 7;
                const toOuterCorner = (result.to.row === -1 || result.to.row === 8) && (result.to.col === -1 || result.to.col === 8);
                if (toOuter) extra += 1800;
                if (toOuterCorner) extra += 1600;
                extra += getBoardBonusAtCell(sourceCardState, result.to.row, result.to.col) * 900;
            }
            return extra;
        }
    );
}

function getExtendLifeMarkerPriority(marker) {
    if (!marker || !marker.data || typeof marker.data.type !== 'string') return 0;
    const type = marker.data.type;
    if (type === 'WORK') return 3800;
    if (type === 'GUARD') return 3200;
    if (type === 'BLOCKADE') return 2800;
    if (type === 'REGEN') return 2200;
    if (type === 'ULTIMATE_DESTROY_GOD') return 2600;
    if (type === 'ULTIMATE_HYPERACTIVE') return 2200;
    if (type === 'SNIPER') return 1800;
    return 800;
}

function chooseExtendLifeTarget(gameState, cardState, playerKey, rng) {
    return chooseTargetBySimulation(
        gameState,
        cardState,
        playerKey,
        rng,
        (simCardState, simGameState, onePlayerKey, row, col) =>
            CardLogic.applyExtendLifeWill(simCardState, simGameState, onePlayerKey, row, col),
        (target) => {
            const marker = getSpecialMarkerAt(cardState, target.row, target.col, playerKey);
            return (evaluatePositionValue(target.row, target.col) * 0.6) + getExtendLifeMarkerPriority(marker);
        },
        (target, _result, _simGameState, _simCardState, sourceGameState, sourceCardState, onePlayerKey) => {
            const marker = getSpecialMarkerAt(sourceCardState, target.row, target.col, onePlayerKey);
                const occupant = getCellOwnerValueForSelfplay(sourceGameState, target.row, target.col);
            const selfVal = toPlayerValue(onePlayerKey);
            let extra = getExtendLifeMarkerPriority(marker);
            if (occupant === selfVal && isCorner(target.row, target.col)) extra += 1600;
            if (occupant === selfVal && !isCorner(target.row, target.col) && isEdge(target.row, target.col)) extra += 700;
            return extra;
        }
    );
}

function getCorrosionMarkerTypeWeight(type) {
    if (type === 'WORK') return 2800;
    if (type === 'GUARD') return 2400;
    if (type === 'BLOCKADE') return 2200;
    if (type === 'REGEN') return 1800;
    if (type === 'ULTIMATE_DESTROY_GOD') return 2600;
    if (type === 'ULTIMATE_HYPERACTIVE_GOD') return 2400;
    if (type === 'HYPERACTIVE') return 1400;
    return 900;
}

function chooseCorrosionTarget(gameState, cardState, playerKey, rng) {
    const rawTargets = (typeof CardLogic.getCorrosionTargets === 'function')
        ? (CardLogic.getCorrosionTargets(cardState, gameState, playerKey) || [])
        : (CardLogic.getSelectableTargets(cardState, gameState, playerKey) || []);
    if (!rawTargets.length) return null;

    const targets = [];
    const seen = new Set();
    for (const one of rawTargets) {
        if (!one || !Number.isInteger(one.row) || !Number.isInteger(one.col)) continue;
        const key = `${one.row},${one.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push(one);
    }
    if (!targets.length) return null;

    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    const selfVal = toPlayerValue(playerKey);
    return choosePendingTargetByScore(targets, (target) => {
        let score = evaluatePositionValue(target.row, target.col) * 0.15;

        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone') continue;
            if (marker.row !== target.row || marker.col !== target.col) continue;
            if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns)) continue;

            const remaining = Number(marker.data.remainingOwnerTurns);
            if (remaining <= 0) continue;

            const type = typeof marker.data.type === 'string' ? marker.data.type : '';
            const magnitude = getCorrosionMarkerTypeWeight(type) + (remaining * 280);
            if (marker.owner === playerKey) score -= magnitude;
            else score += magnitude;
        }

        const occupant = getCellOwnerValueForSelfplay(gameState, target.row, target.col);
        if (occupant === -selfVal) score += 180;
        else if (occupant === selfVal) score -= 160;

        if (isCorner(target.row, target.col)) score += (occupant === -selfVal) ? 700 : -700;
        else if (isEdge(target.row, target.col)) score += (occupant === -selfVal) ? 220 : -220;

        score += (rng && typeof rng.random === 'function') ? (rng.random() * 0.01) : 0;
        return score;
    });
}

function getSpecialMarkerAt(cardState, row, col, ownerKey) {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.find((m) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        (!ownerKey || m.owner === ownerKey)
    )) || null;
}


function chooseTemptTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    return choosePendingTargetByScore(
        targets,
        (target) => evaluatePositionValue(target.row, target.col) + rng.random() * 0.01
    );
}

function scoreTimeBombTarget(gameState, playerKey, target, rng) {
    if (!gameState || !Array.isArray(gameState.board) || !target) return -Infinity;
    const board = gameState.board;
    const size = board.length;
    if (!Number.isInteger(target.row) || !Number.isInteger(target.col)) return -Infinity;
    if (target.row < 0 || target.col < 0 || target.row >= size || target.col >= size) return -Infinity;

    const playerValue = toPlayerValue(playerKey);
    const discDiff = countDiscsByValue(gameState, playerValue);
    let score = 0;
    let oppCornerHits = 0;
    let ownCornerHits = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const row = target.row + dr;
            const col = target.col + dc;
            if (row < 0 || col < 0 || row >= board.length || col >= board[row].length) continue;
            const cell = board[row][col];
            if (cell === 0) continue;
            const corner = isCorner(row, col);
            const edge = isEdge(row, col);
            const weight = corner ? 12 : (edge ? 4 : 2);
            const isOwn = cell === playerValue;
            if (isOwn) {
                score -= weight * 100;
                if (corner) ownCornerHits += 1;
            } else {
                score += weight * 100;
                if (corner) oppCornerHits += 1;
            }
        }
    }

    if (discDiff <= -8) score += 140;
    if (discDiff <= -14) score += 80;
    if (discDiff >= 8) score -= 140;
    if (discDiff >= 12) score -= 70;
    if (oppCornerHits > 0) score += 2400 * oppCornerHits;
    if (ownCornerHits > 0) score -= 3200 * ownCornerHits;
    if (discDiff >= 0 && oppCornerHits <= 0) score -= 220;

    score += rng.random() * 0.01;
    return score;
}

function chooseTimeBombTarget(gameState, cardState, playerKey, rng) {
    const targets = (typeof CardLogic.getTimeBombTargets === 'function')
        ? (CardLogic.getTimeBombTargets(cardState, gameState, playerKey) || [])
        : (CardLogic.getSelectableTargets(cardState, gameState, playerKey) || []);
    if (!targets.length) return null;
    return choosePendingTargetByScore(
        targets,
        (target) => scoreTimeBombTarget(gameState, playerKey, target, rng)
    );
}

function chooseSellCardTarget(gameState, cardState, playerKey) {
    const hand = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
        ? cardState.hands[playerKey]
        : [];
    if (!hand.length) return null;
    if (CpuPolicyCore && typeof CpuPolicyCore.chooseSellCardTargetByRetention === 'function') {
        const legalMoves = getLegalMovesForAction(gameState, cardState, playerKey);
        const context = buildCardDecisionContext(
            gameState,
            cardState,
            playerKey,
            legalMoves.length,
            legalMoves
        );
        const selected = CpuPolicyCore.chooseSellCardTargetByRetention(
            hand,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (selected && selected.cardId) return selected.cardId;
    }

    let bestId = hand[0];
    let bestCost = -Infinity;
    for (const cardId of hand) {
        const cost = CardLogic.getCardCost(cardId) || 0;
        if (cost > bestCost) {
            bestCost = cost;
            bestId = cardId;
        }
    }
    return bestId;
}

function buildPendingSelectionAction(gameState, cardState, playerKey, pendingType, rng) {
    return PendingTargetSelector.buildPendingSelectionAction({
        gameState,
        cardState,
        playerKey,
        pendingType,
        rng,
        selectors: {
            chooseSwapTarget,
            choosePositionSwapTarget,
            chooseDestroyTarget,
            chooseStrongWindTarget,
            chooseSuperBuoyancyTarget,
            chooseSuperGravityTarget,
            chooseSellCardTarget,
            chooseTemptTarget,
            chooseTimeBombTarget,
            chooseGuardTarget,
            chooseBoardExpansionTarget,
            chooseBlockadeTarget,
            chooseMeteorTarget,
            chooseTrapTarget,
            chooseCloneTarget,
            chooseHyperactiveInheritTarget,
            chooseTeleportTarget,
            chooseCellTeleportTarget,
            chooseExtendLifeTarget,
            chooseCorrosionTarget
        },
        getLegalMovesForAction,
        buildCardDecisionContext,
        cpuPolicyCore: CpuPolicyCore,
        cardLogic: CardLogic
    });
}

function clonePrng(rng) {
    if (!rng || typeof rng.getState !== 'function') return rng;
    try {
        return SeededPRNG.fromState(rng.getState());
    } catch (e) {
        return rng;
    }
}

function buildDecisionSnapshot(gameState, cardState, playerKey, rng) {
    const clonedGameState = deepClone(gameState);
    const clonedCardState = deepClone(cardState);
    const previewEvents = [];
    const previewPrng = clonePrng(rng);
    try {
        TurnPipelinePhases.applyTurnStartPhase(
            CardLogic,
            Core,
            clonedCardState,
            clonedGameState,
            playerKey,
            previewEvents,
            previewPrng
        );
    } catch (e) {
        return {
            gameState,
            cardState
        };
    }
    return {
        gameState: clonedGameState,
        cardState: clonedCardState
    };
}

function decideAction(gameState, cardState, playerKey, rng, options, snapshot) {
    const decisionState = snapshot || { gameState, cardState };
    const activeGameState = decisionState.gameState || gameState;
    const activeCardState = decisionState.cardState || cardState;
    const pending = activeCardState.pendingEffectByPlayer[playerKey];
    const legalMoves = getLegalMovesForAction(activeGameState, activeCardState, playerKey);
    const forcedPlacement = resolveForcedPlacementCandidates(legalMoves, options, getSelfplayBoard(activeGameState, activeCardState));
    const mustTakePriorityPlacement = !!forcedPlacement.category;

    if (pending && pending.stage === 'selectTarget') {
        const pendingAction = buildPendingSelectionAction(activeGameState, activeCardState, playerKey, pending.type, rng);
        if (pendingAction) {
            return { action: pendingAction, legalMoves };
        }
        return { action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } }, legalMoves };
    }

    if (
        options.allowCardUsage &&
        options.allowHandDestroy !== false &&
        !mustTakePriorityPlacement &&
        !activeCardState.hasUsedCardThisTurnByPlayer[playerKey]
    ) {
        const destroyCardId = selectDestroyHandCardId(
            activeCardState,
            activeGameState,
            playerKey,
            {
                gameState: activeGameState,
                cardState: activeCardState,
                playerKey,
                pendingType: pending ? pending.type : null,
                legalMovesCount: legalMoves.length,
                legalMoves
            }
        );
        if (destroyCardId) {
            return {
                action: { type: 'destroy_hand_card', destroyCardId },
                legalMoves
            };
        }
    }

    if (
        options.allowCardUsage &&
        !mustTakePriorityPlacement &&
        !activeCardState.hasUsedCardThisTurnByPlayer[playerKey]
    ) {
        const cardId = selectCardIdToUse(activeCardState, activeGameState, playerKey, options, {
            gameState: activeGameState,
            cardState: activeCardState,
            playerKey,
            pendingType: pending ? pending.type : null,
            legalMovesCount: legalMoves.length,
            legalMoves
        });
        const mustUseCardToCreateMove = legalMoves.length === 0;
        let adjustedRate = Number.isFinite(options.cardUsageRate) ? options.cardUsageRate : 0;
        let forceUseByRiskScore = false;
        let preferUseByRiskScore = false;
        if (cardId && CpuPolicyCore && typeof CpuPolicyCore.scoreCardUseDecision === 'function') {
            const risk = CpuPolicyCore.scoreCardUseDecision(
                cardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                buildCardDecisionContext(activeGameState, activeCardState, playerKey, legalMoves.length, legalMoves)
            );
            if (risk && risk.shouldUse === false) {
                adjustedRate = 0;
            } else if (risk && Number.isFinite(risk.score)) {
                const minUseScore = Number.isFinite(risk.minUseScore) ? Number(risk.minUseScore) : 0;
                const scoreMargin = Number(risk.score) - minUseScore;
                if (scoreMargin >= 28) forceUseByRiskScore = true;
                else if (scoreMargin >= 14) preferUseByRiskScore = true;
                if (risk.score >= 60) adjustedRate = Math.min(1, adjustedRate * 1.8);
                else if (risk.score >= 25) adjustedRate = Math.min(1, adjustedRate * 1.3);
                else if (risk.score < 10) adjustedRate *= 0.35;
            }
        }
        const handSize = activeCardState && activeCardState.hands && Array.isArray(activeCardState.hands[playerKey])
            ? activeCardState.hands[playerKey].length
            : 0;
        if (handSize >= 5) adjustedRate = Math.max(adjustedRate, 0.88);
        else if (handSize >= 4) adjustedRate = Math.max(adjustedRate, 0.58);
        if (preferUseByRiskScore) adjustedRate = Math.max(adjustedRate, handSize >= 4 ? 0.88 : 0.76);
        if (forceUseByRiskScore) adjustedRate = Math.max(adjustedRate, 0.98);
        const randomUse = rng.random() < adjustedRate;
        if (cardId && (mustUseCardToCreateMove || forceUseByRiskScore || randomUse)) {
            return { action: { type: 'use_card', useCardId: cardId, useCardOwnerKey: playerKey }, legalMoves };
        }
    }

    if (!legalMoves.length) {
        const strictLegalMoves = Core.getLegalMoves(
            activeGameState,
            toPlayerValue(playerKey),
            getSafeCardContext(activeCardState)
        );
        if (strictLegalMoves.length > 0) {
            const forcedPlacement = scorePlacementCandidates(
                strictLegalMoves,
                rng,
                {
                    gameState: activeGameState,
                    cardState: activeCardState,
                    playerKey,
                    pendingType: pending ? pending.type : null,
                    legalMovesCount: strictLegalMoves.length
                },
                options
            );
            const forcedMove = forcedPlacement && forcedPlacement.move
                ? forcedPlacement.move
                : strictLegalMoves[0];
            return {
                action: { type: 'place', row: forcedMove.row, col: forcedMove.col },
                legalMoves: strictLegalMoves,
                placementMetrics: forcedPlacement ? forcedPlacement.metrics : null
            };
        }
        return { action: { type: 'pass' }, legalMoves };
    }

    const chosenPlacement = scorePlacementCandidates(
        legalMoves,
        rng,
        {
            gameState: activeGameState,
            cardState: activeCardState,
            playerKey,
            pendingType: pending ? pending.type : null,
            legalMovesCount: legalMoves.length
        },
        options
    );
    const chosenMove = chosenPlacement && chosenPlacement.move ? chosenPlacement.move : legalMoves[0];
    return {
        action: { type: 'place', row: chosenMove.row, col: chosenMove.col },
        legalMoves,
        placementMetrics: chosenPlacement ? chosenPlacement.metrics : null
    };
}

function resolveWinner(gameState) {
    const counts = Core.countDiscs(gameState);
    if (counts.black > counts.white) return { winner: 'black', counts };
    if (counts.white > counts.black) return { winner: 'white', counts };
    return { winner: 'draw', counts };
}

function createInitialState(seed) {
    const prng = SeededPRNG.createPRNG(seed);
    const init = CardLogic.initGame(prng);
    return {
        gameState: Core.createGameState(),
        cardState: init.cardState,
        prng,
        stateVersion: 0
    };
}

function normalizeOptions(options) {
    const opts = options || {};
    const policyMixRate = Number.isFinite(opts.policyMixRate)
        ? Math.max(0, Math.min(1, Number(opts.policyMixRate)))
        : 1;
    const cardUsageRateJitter = Number.isFinite(opts.cardUsageRateJitter)
        ? Math.max(0, Math.min(1, Number(opts.cardUsageRateJitter)))
        : 0;
    const tacticalWeightMin = Number.isFinite(opts.tacticalWeightMin)
        ? Math.max(0, Number(opts.tacticalWeightMin))
        : 1;
    const tacticalWeightMaxRaw = Number.isFinite(opts.tacticalWeightMax)
        ? Math.max(0, Number(opts.tacticalWeightMax))
        : tacticalWeightMin;
    const tacticalWeightMax = Math.max(tacticalWeightMin, tacticalWeightMaxRaw);
    const policyScoreWeightMin = Number.isFinite(opts.policyScoreWeightMin)
        ? Math.max(0, Number(opts.policyScoreWeightMin))
        : 1;
    const policyScoreWeightMaxRaw = Number.isFinite(opts.policyScoreWeightMax)
        ? Math.max(0, Number(opts.policyScoreWeightMax))
        : policyScoreWeightMin;
    const policyScoreWeightMax = Math.max(policyScoreWeightMin, policyScoreWeightMaxRaw);
    const heuristicWeightMin = Number.isFinite(opts.heuristicWeightMin)
        ? Math.max(0, Number(opts.heuristicWeightMin))
        : 1;
    const heuristicWeightMaxRaw = Number.isFinite(opts.heuristicWeightMax)
        ? Math.max(0, Number(opts.heuristicWeightMax))
        : heuristicWeightMin;
    const heuristicWeightMax = Math.max(heuristicWeightMin, heuristicWeightMaxRaw);
    const tacticalDepthOpening = Number.isFinite(opts.tacticalDepthOpening)
        ? Math.max(0, Math.floor(Number(opts.tacticalDepthOpening)))
        : 2;
    const tacticalDepthMid = Number.isFinite(opts.tacticalDepthMid)
        ? Math.max(0, Math.floor(Number(opts.tacticalDepthMid)))
        : 3;
    const tacticalDepthEnd = Number.isFinite(opts.tacticalDepthEnd)
        ? Math.max(0, Math.floor(Number(opts.tacticalDepthEnd)))
        : 4;
    const tacticalBeamWidth = Number.isFinite(opts.tacticalBeamWidth)
        ? Math.max(1, Math.floor(Number(opts.tacticalBeamWidth)))
        : 0;
    const teacherCommitteeWeightMin = Number.isFinite(opts.teacherCommitteeWeightMin)
        ? Math.max(0, Number(opts.teacherCommitteeWeightMin))
        : 28;
    const teacherCommitteeWeightMaxRaw = Number.isFinite(opts.teacherCommitteeWeightMax)
        ? Math.max(0, Number(opts.teacherCommitteeWeightMax))
        : teacherCommitteeWeightMin;
    const teacherCommitteeWeightMax = Math.max(teacherCommitteeWeightMin, teacherCommitteeWeightMaxRaw);
    const teacherCommitteeConsensusBonusMin = Number.isFinite(opts.teacherCommitteeConsensusBonusMin)
        ? Math.max(0, Number(opts.teacherCommitteeConsensusBonusMin))
        : 320;
    const teacherCommitteeConsensusBonusMaxRaw = Number.isFinite(opts.teacherCommitteeConsensusBonusMax)
        ? Math.max(0, Number(opts.teacherCommitteeConsensusBonusMax))
        : teacherCommitteeConsensusBonusMin;
    const teacherCommitteeConsensusBonusMax = Math.max(
        teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMaxRaw
    );
    return {
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        games: Number.isFinite(opts.games) ? Math.max(1, Math.floor(opts.games)) : 10,
        baseSeed: Number.isFinite(opts.baseSeed) ? Math.floor(opts.baseSeed) : 1,
        gameIndexOffset: Number.isFinite(opts.gameIndexOffset) ? Math.max(0, Math.floor(opts.gameIndexOffset)) : 0,
        maxPlies: Number.isFinite(opts.maxPlies) ? Math.max(1, Math.floor(opts.maxPlies)) : 220,
        allowCardUsage: opts.allowCardUsage !== false,
        cardUsageRate: Number.isFinite(opts.cardUsageRate) ? Math.max(0, Math.min(1, opts.cardUsageRate)) : 0.2,
        policyMixRate,
        cardUsageRateJitter,
        tacticalWeightMin,
        tacticalWeightMax,
        policyScoreWeightMin,
        policyScoreWeightMax,
        heuristicWeightMin,
        heuristicWeightMax,
        tacticalDepthOpening,
        tacticalDepthMid,
        tacticalDepthEnd,
        tacticalBeamWidth,
        teacherCommitteeWeightMin,
        teacherCommitteeWeightMax,
        teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMax,
        playerPolicies: opts.playerPolicies || null,
        playerPolicyResolver: typeof opts.playerPolicyResolver === 'function'
            ? opts.playerPolicyResolver
            : null,
        seedFamily: typeof opts.seedFamily === 'string' && opts.seedFamily.trim()
            ? opts.seedFamily.trim()
            : 'train',
        dataLane: typeof opts.dataLane === 'string' && opts.dataLane.trim()
            ? opts.dataLane.trim()
            : 'selfplay-games',
        shouldStop: typeof opts.shouldStop === 'function' ? opts.shouldStop : null,
        onRecord: typeof opts.onRecord === 'function' ? opts.onRecord : null,
        onGameEnd: typeof opts.onGameEnd === 'function' ? opts.onGameEnd : null
    };
}

function getPolicyForPlayer(options, playerKey) {
    const base = {
        allowCardUsage: options.allowCardUsage,
        cardUsageRate: options.cardUsageRate,
        enableTacticalLookahead: true,
        disableLookaheadTimeBudget: false,
        lookaheadMaxTimeMs: Number.NaN,
        lookaheadEndgameMaxTimeMs: Number.NaN,
        lookaheadVirtualTimePerNodeMs: 10,
        tacticalWeight: Number.NaN,
        policyScoreWeight: Number.NaN,
        heuristicWeight: Number.NaN,
        tacticalDepthOpening: Number.isFinite(options.tacticalDepthOpening) ? Math.max(0, Math.floor(options.tacticalDepthOpening)) : 2,
        tacticalDepthMid: Number.isFinite(options.tacticalDepthMid) ? Math.max(0, Math.floor(options.tacticalDepthMid)) : 3,
        tacticalDepthEnd: Number.isFinite(options.tacticalDepthEnd) ? Math.max(0, Math.floor(options.tacticalDepthEnd)) : 4,
        tacticalBeamWidth: Number.isFinite(options.tacticalBeamWidth) ? Math.max(1, Math.floor(options.tacticalBeamWidth)) : 0,
        teacherCommitteeWeight: Number.NaN,
        teacherCommitteeConsensusBonus: Number.NaN
    };
    if (!options.playerPolicies || !options.playerPolicies[playerKey]) return base;
    const override = options.playerPolicies[playerKey];
    return {
        allowCardUsage: override.allowCardUsage !== undefined ? !!override.allowCardUsage : base.allowCardUsage,
        cardUsageRate: Number.isFinite(override.cardUsageRate)
            ? Math.max(0, Math.min(1, override.cardUsageRate))
            : base.cardUsageRate,
        policyTableModel: override.policyTableModel || null,
        enableTacticalLookahead: override.enableTacticalLookahead !== undefined
            ? !!override.enableTacticalLookahead
            : base.enableTacticalLookahead,
        disableLookaheadTimeBudget: override.disableLookaheadTimeBudget !== undefined
            ? !!override.disableLookaheadTimeBudget
            : base.disableLookaheadTimeBudget,
        lookaheadMaxTimeMs: normalizeLookaheadTimeBudget(override.lookaheadMaxTimeMs, base.lookaheadMaxTimeMs),
        lookaheadEndgameMaxTimeMs: normalizeLookaheadTimeBudget(
            override.lookaheadEndgameMaxTimeMs,
            base.lookaheadEndgameMaxTimeMs
        ),
        lookaheadVirtualTimePerNodeMs: normalizeLookaheadVirtualTimePerNodeMs(
            override.lookaheadVirtualTimePerNodeMs,
            base.lookaheadVirtualTimePerNodeMs
        ),
        tacticalWeight: Number.isFinite(override.tacticalWeight)
            ? Math.max(0, override.tacticalWeight)
            : base.tacticalWeight,
        policyScoreWeight: Number.isFinite(override.policyScoreWeight)
            ? Math.max(0, override.policyScoreWeight)
            : Number.NaN,
        heuristicWeight: Number.isFinite(override.heuristicWeight)
            ? Math.max(0, override.heuristicWeight)
            : Number.NaN,
        tacticalDepthOpening: Number.isFinite(override.tacticalDepthOpening)
            ? Math.max(0, Math.floor(override.tacticalDepthOpening))
            : base.tacticalDepthOpening,
        tacticalDepthMid: Number.isFinite(override.tacticalDepthMid)
            ? Math.max(0, Math.floor(override.tacticalDepthMid))
            : base.tacticalDepthMid,
        tacticalDepthEnd: Number.isFinite(override.tacticalDepthEnd)
            ? Math.max(0, Math.floor(override.tacticalDepthEnd))
            : base.tacticalDepthEnd,
        tacticalBeamWidth: Number.isFinite(override.tacticalBeamWidth)
            ? Math.max(1, Math.floor(override.tacticalBeamWidth))
            : base.tacticalBeamWidth,
        teacherCommitteeWeight: Number.isFinite(override.teacherCommitteeWeight)
            ? Math.max(0, Number(override.teacherCommitteeWeight))
            : base.teacherCommitteeWeight,
        teacherCommitteeConsensusBonus: Number.isFinite(override.teacherCommitteeConsensusBonus)
            ? Math.max(0, Number(override.teacherCommitteeConsensusBonus))
            : base.teacherCommitteeConsensusBonus
    };
}

function clamp01(value, fallback) {
    if (!Number.isFinite(value)) {
        return Number.isFinite(fallback)
            ? Math.max(0, Math.min(1, Number(fallback)))
            : 0;
    }
    return Math.max(0, Math.min(1, Number(value)));
}

function normalizeLookaheadTimeBudget(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(Number(value)));
}

function normalizeLookaheadVirtualTimePerNodeMs(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Number(value));
}

function buildPerGamePolicySet(options, seed, gameIndex) {
    const baseBlack = getPolicyForPlayer(options, 'black');
    const baseWhite = getPolicyForPlayer(options, 'white');
    const mixRate = clamp01(options.policyMixRate, 1);
    const jitter = clamp01(options.cardUsageRateJitter, 0);
    const tacticalWeightMin = Number.isFinite(options.tacticalWeightMin)
        ? Math.max(0, Number(options.tacticalWeightMin))
        : 1;
    const tacticalWeightMax = Number.isFinite(options.tacticalWeightMax)
        ? Math.max(tacticalWeightMin, Number(options.tacticalWeightMax))
        : tacticalWeightMin;
    const policyScoreWeightMin = Number.isFinite(options.policyScoreWeightMin)
        ? Math.max(0, Number(options.policyScoreWeightMin))
        : 1;
    const policyScoreWeightMax = Number.isFinite(options.policyScoreWeightMax)
        ? Math.max(policyScoreWeightMin, Number(options.policyScoreWeightMax))
        : policyScoreWeightMin;
    const heuristicWeightMin = Number.isFinite(options.heuristicWeightMin)
        ? Math.max(0, Number(options.heuristicWeightMin))
        : 1;
    const heuristicWeightMax = Number.isFinite(options.heuristicWeightMax)
        ? Math.max(heuristicWeightMin, Number(options.heuristicWeightMax))
        : heuristicWeightMin;
    const teacherCommitteeWeightMin = Number.isFinite(options.teacherCommitteeWeightMin)
        ? Math.max(0, Number(options.teacherCommitteeWeightMin))
        : 28;
    const teacherCommitteeWeightMax = Number.isFinite(options.teacherCommitteeWeightMax)
        ? Math.max(teacherCommitteeWeightMin, Number(options.teacherCommitteeWeightMax))
        : teacherCommitteeWeightMin;
    const teacherCommitteeConsensusBonusMin = Number.isFinite(options.teacherCommitteeConsensusBonusMin)
        ? Math.max(0, Number(options.teacherCommitteeConsensusBonusMin))
        : 320;
    const teacherCommitteeConsensusBonusMax = Number.isFinite(options.teacherCommitteeConsensusBonusMax)
        ? Math.max(teacherCommitteeConsensusBonusMin, Number(options.teacherCommitteeConsensusBonusMax))
        : teacherCommitteeConsensusBonusMin;
    const rng = SeededPRNG.createPRNG((Number(seed) || 0) + ((Number(gameIndex) || 0) * 7919) + 97);

    const buildOne = (base) => {
        const allowCardUsage = base.allowCardUsage !== false;
        const baseRate = clamp01(base.cardUsageRate, options.cardUsageRate);
        const jitterDelta = jitter > 0 ? ((rng.random() * 2) - 1) * jitter : 0;
        const cardUsageRate = clamp01(baseRate + jitterDelta, baseRate);
        const canUseModel = !!base.policyTableModel;
        const useModel = canUseModel && (rng.random() < mixRate);
        const enableTacticalLookahead = base.enableTacticalLookahead !== false;
        const tacticalWeight = enableTacticalLookahead
            ? (
                Number.isFinite(base.tacticalWeight)
                    ? Math.max(0, Number(base.tacticalWeight))
                    : (tacticalWeightMin + ((tacticalWeightMax - tacticalWeightMin) * rng.random()))
            )
            : 0;
        const policyScoreWeight = Number.isFinite(base.policyScoreWeight)
            ? Math.max(0, Number(base.policyScoreWeight))
            : (useModel
                ? (policyScoreWeightMin + ((policyScoreWeightMax - policyScoreWeightMin) * rng.random()))
                : 0);
        const heuristicWeight = Number.isFinite(base.heuristicWeight)
            ? Math.max(0, Number(base.heuristicWeight))
            : (heuristicWeightMin + ((heuristicWeightMax - heuristicWeightMin) * rng.random()));
        const teacherCommitteeWeight = Number.isFinite(base.teacherCommitteeWeight)
            ? Math.max(0, Number(base.teacherCommitteeWeight))
            : (
                teacherCommitteeWeightMin +
                ((teacherCommitteeWeightMax - teacherCommitteeWeightMin) * rng.random())
            );
        const teacherCommitteeConsensusBonus = Number.isFinite(base.teacherCommitteeConsensusBonus)
            ? Math.max(0, Number(base.teacherCommitteeConsensusBonus))
            : (
                teacherCommitteeConsensusBonusMin +
                ((teacherCommitteeConsensusBonusMax - teacherCommitteeConsensusBonusMin) * rng.random())
            );

        return {
            allowCardUsage,
            cardUsageRate,
            policyTableModel: useModel ? base.policyTableModel : null,
            enableTacticalLookahead,
            disableLookaheadTimeBudget: base.disableLookaheadTimeBudget === true,
            lookaheadMaxTimeMs: normalizeLookaheadTimeBudget(base.lookaheadMaxTimeMs, Number.NaN),
            lookaheadEndgameMaxTimeMs: normalizeLookaheadTimeBudget(base.lookaheadEndgameMaxTimeMs, Number.NaN),
            lookaheadVirtualTimePerNodeMs: normalizeLookaheadVirtualTimePerNodeMs(base.lookaheadVirtualTimePerNodeMs, Number.NaN),
            tacticalWeight,
            policyScoreWeight: useModel ? policyScoreWeight : 0,
            heuristicWeight,
            tacticalDepthOpening: Number.isFinite(base.tacticalDepthOpening) ? Math.max(0, Math.floor(base.tacticalDepthOpening)) : 2,
            tacticalDepthMid: Number.isFinite(base.tacticalDepthMid) ? Math.max(0, Math.floor(base.tacticalDepthMid)) : 3,
            tacticalDepthEnd: Number.isFinite(base.tacticalDepthEnd) ? Math.max(0, Math.floor(base.tacticalDepthEnd)) : 4,
            tacticalBeamWidth: Number.isFinite(base.tacticalBeamWidth) ? Math.max(1, Math.floor(base.tacticalBeamWidth)) : 0,
            teacherCommitteeWeight,
            teacherCommitteeConsensusBonus
        };
    };

    return {
        black: buildOne(baseBlack),
        white: buildOne(baseWhite)
    };
}

function createAction(decision, gameIndex, actionCounter, turnIndex) {
    return {
        action: Object.assign({}, decision.action, {
            actionId: `sp-${gameIndex}-${actionCounter}`,
            turnIndex
        }),
        actionType: decision.action.type
    };
}

function applyActionSafe(state, playerKey, action) {
    return TurnPipeline.applyTurnSafe(
        state.cardState,
        state.gameState,
        playerKey,
        action,
        state.prng,
        { currentStateVersion: state.stateVersion }
    );
}

function getPendingSelectionState(cardState, playerKey) {
    const pending = cardState && cardState.pendingEffectByPlayer
        ? cardState.pendingEffectByPlayer[playerKey]
        : null;
    if (!pending || pending.stage !== 'selectTarget') return null;
    return pending;
}

function buildRetryFallbackDecision(gameState, cardState, playerKey, rng, options) {
    const pending = getPendingSelectionState(cardState, playerKey);
    if (pending) {
        const pendingAction = buildPendingSelectionAction(gameState, cardState, playerKey, pending.type, rng);
        if (pendingAction) {
            return {
                action: pendingAction,
                legalMoves: getLegalMovesForAction(gameState, cardState, playerKey)
            };
        }
        return {
            action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } },
            legalMoves: getLegalMovesForAction(gameState, cardState, playerKey)
        };
    }

    const fallbackLegalMoves = getLegalMovesForAction(gameState, cardState, playerKey);
    const sortedFallbackMoves = Array.isArray(fallbackLegalMoves)
        ? fallbackLegalMoves.slice().sort((a, b) => (a.row - b.row) || (a.col - b.col))
        : [];
    const forcedFallback = resolveForcedPlacementCandidates(sortedFallbackMoves, options, getSelfplayBoard(gameState, cardState));
    const fallbackMoves = Array.isArray(forcedFallback.moves) && forcedFallback.moves.length > 0
        ? forcedFallback.moves
        : sortedFallbackMoves;
    return {
        action: (fallbackMoves.length > 0)
            ? { type: 'place', row: fallbackMoves[0].row, col: fallbackMoves[0].col }
            : { type: 'pass' },
        legalMoves: sortedFallbackMoves
    };
}

function applyDecisionWithRetry(state, gameIndex, ply, playerKey, options, actionCounterRef) {
    const firstSnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
    const firstDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, options, firstSnapshot);
    actionCounterRef.value += 1;
    const first = createAction(firstDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    let result = applyActionSafe(state, playerKey, first.action);
    if (result.ok) {
        return { decision: firstDecision, action: first.action, result, decisionContext: firstSnapshot };
    }

    // Apply rejected snapshots as the new baseline before retrying.
    state.cardState = result.cardState;
    state.gameState = result.gameState;
    state.stateVersion = result.nextStateVersion;

    const errMsg = String(result.errorMessage || '');
    const illegalPassRejected = first.actionType === 'pass' && errMsg.includes('Illegal pass');
    const canRetry =
        first.actionType === 'use_card' ||
        first.actionType === 'destroy_hand_card' ||
        first.actionType === 'place' ||
        result.rejectedReason === 'ILLEGAL_MOVE' ||
        illegalPassRejected;
    if (!canRetry) {
        const msg = result.errorMessage || '';
        throw new Error(`[SELFPLAY] action rejected game=${gameIndex} ply=${ply} action=${first.actionType} reason=${result.rejectedReason || 'UNKNOWN'} ${msg}`);
    }

    const retryOpts = Object.assign({}, options);
    if (first.actionType === 'use_card') retryOpts.allowCardUsage = false;
    if (first.actionType === 'destroy_hand_card') retryOpts.allowHandDestroy = false;
    const retrySnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
    const retryDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, retryOpts, retrySnapshot);
    actionCounterRef.value += 1;
    const retry = createAction(retryDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    result = applyActionSafe(state, playerKey, retry.action);
    if (!result.ok) {
        // Last-resort safety net: force a deterministic legal action so long training loops do not crash.
        state.cardState = result.cardState;
        state.gameState = result.gameState;
        state.stateVersion = result.nextStateVersion;

        const fallbackSnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
        const fallbackDecision = buildRetryFallbackDecision(
            fallbackSnapshot.gameState,
            fallbackSnapshot.cardState,
            playerKey,
            state.prng,
            options
        );

        actionCounterRef.value += 1;
        const forced = createAction(fallbackDecision, gameIndex, actionCounterRef.value, state.stateVersion);
        const forcedResult = applyActionSafe(state, playerKey, forced.action);
        if (forcedResult.ok) {
            return { decision: fallbackDecision, action: forced.action, result: forcedResult, decisionContext: fallbackSnapshot };
        }

        const msg = forcedResult.errorMessage || result.errorMessage || '';
        throw new Error(`[SELFPLAY] action rejected game=${gameIndex} ply=${ply} action=${retry.actionType} reason=${forcedResult.rejectedReason || result.rejectedReason || 'UNKNOWN'} ${msg}`);
    }
    return { decision: retryDecision, action: retry.action, result, decisionContext: retrySnapshot };
}

function runSingleGame(gameIndex, seed, options) {
    const normalizedOptions = normalizeOptions(options);
    const state = createInitialState(seed);
    const gameRecords = [];
    const actionCounterRef = { value: 0 };

    for (let ply = 0; ply < normalizedOptions.maxPlies; ply++) {
        if (Core.isGameOver(state.gameState)) break;

        const playerKey = toPlayerKey(state.gameState.currentPlayer);
        const playerPolicy = getPolicyForPlayer(normalizedOptions, playerKey);

        const execution = applyDecisionWithRetry(state, gameIndex, ply, playerKey, playerPolicy, actionCounterRef);
        const decisionCardState = execution.decisionContext && execution.decisionContext.cardState
            ? execution.decisionContext.cardState
            : state.cardState;
        const decisionGameState = execution.decisionContext && execution.decisionContext.gameState
            ? execution.decisionContext.gameState
            : state.gameState;
        const pendingType = CardLogic.getPendingEffectType(decisionCardState, playerKey);
        const countsBefore = Core.countDiscs(decisionGameState);
        const boardBefore = encodeBoard(decisionGameState.board);
        const turnNumberBefore = decisionGameState.turnNumber || 0;
        const handCards = decisionCardState && decisionCardState.hands && Array.isArray(decisionCardState.hands[playerKey])
            ? decisionCardState.hands[playerKey].slice()
            : [];
        let usableCardIds = [];
        try {
            usableCardIds = getDirectUsableCardIds(decisionCardState, decisionGameState, playerKey);
        } catch (e) {
            usableCardIds = [];
        }
        const decision = execution.decision;
        const action = execution.action;
        const result = execution.result;
        const pendingSelection = buildPendingSelectionRecord(action, pendingType);
        const planStateBefore = buildCornerPlanState(
            decisionGameState,
            decisionCardState,
            playerKey,
            decision.legalMoves,
            usableCardIds
        );
        const selectedCellBonus = (
            action.type === 'place' &&
            Number.isInteger(action.row) &&
            Number.isInteger(action.col)
        )
            ? getBoardBonusAtCell(decisionCardState, action.row, action.col)
            : 0;
        const placementMetrics = (
            action.type === 'place' &&
            decision &&
            decision.placementMetrics &&
            typeof decision.placementMetrics === 'object'
        )
            ? decision.placementMetrics
            : null;

        const record = {
            schemaVersion: normalizedOptions.schemaVersion,
            gameIndex,
            seed,
            ply,
            turnNumber: turnNumberBefore,
            player: playerKey,
            actionType: action.type,
            row: Number.isFinite(action.row) ? action.row : null,
            col: Number.isFinite(action.col) ? action.col : null,
            useCardId: action.useCardId || null,
            destroyCardId: action.destroyCardId || null,
            sellCardId: action.sellCardId || null,
            legalMoves: decision.legalMoves.length,
            pendingType: pendingType || null,
            handBlack: state.cardState.hands.black.length,
            handWhite: state.cardState.hands.white.length,
            chargeBlack: state.cardState.charge.black || 0,
            chargeWhite: state.cardState.charge.white || 0,
            deckCount: state.cardState.deck.length,
            discardCount: state.cardState.discard.length,
            blackCountBefore: countsBefore.black,
            whiteCountBefore: countsBefore.white,
            board: boardBefore,
            ownCornersBefore: Number(planStateBefore.ownCorners || 0),
            oppCornersBefore: Number(planStateBefore.oppCorners || 0),
            ownEdgesBefore: Number(planStateBefore.ownEdges || 0),
            oppEdgesBefore: Number(planStateBefore.oppEdges || 0),
            hasCornerMoveNow: planStateBefore.hasCornerMoveNow ? 1 : 0,
            hasEdgeMoveNow: planStateBefore.hasEdgeMoveNow ? 1 : 0,
            cornerEmergency: planStateBefore.cornerEmergency ? 1 : 0,
            cornerHoldMode: planStateBefore.cornerHoldMode ? 1 : 0,
            highBonusMoveAvailable: planStateBefore.highBonusMoveAvailable ? 1 : 0,
            maxLegalMoveBonus: Number(planStateBefore.maxBoardBonusOnLegalMoves || 0),
            selectedCellBonus: Number(selectedCellBonus || 0),
            selectedCompositeScore: placementMetrics && Number.isFinite(placementMetrics.selectedCompositeScore)
                ? Number(placementMetrics.selectedCompositeScore)
                : null,
            bestCompositeScore: placementMetrics && Number.isFinite(placementMetrics.bestCompositeScore)
                ? Number(placementMetrics.bestCompositeScore)
                : null,
            compositeScoreMiss: placementMetrics && Number.isFinite(placementMetrics.compositeScoreMiss)
                ? Number(placementMetrics.compositeScoreMiss)
                : null,
            compositeScoreMissRatio: placementMetrics && Number.isFinite(placementMetrics.compositeScoreMissRatio)
                ? Number(placementMetrics.compositeScoreMissRatio)
                : null,
            selectedTacticalScore: placementMetrics && Number.isFinite(placementMetrics.selectedTacticalScore)
                ? Number(placementMetrics.selectedTacticalScore)
                : null,
            bestTacticalScore: placementMetrics && Number.isFinite(placementMetrics.bestTacticalScore)
                ? Number(placementMetrics.bestTacticalScore)
                : null,
            tacticalScoreMiss: placementMetrics && Number.isFinite(placementMetrics.tacticalScoreMiss)
                ? Number(placementMetrics.tacticalScoreMiss)
                : null,
            tacticalScoreMissRatio: placementMetrics && Number.isFinite(placementMetrics.tacticalScoreMissRatio)
                ? Number(placementMetrics.tacticalScoreMissRatio)
                : null,
            pendingSelection
        };
        record.handCards = handCards;
        record.usableCardIds = usableCardIds;
        record.topPlacementCandidates = placementMetrics && Array.isArray(placementMetrics.topCandidates)
            ? placementMetrics.topCandidates.map((one) => Object.assign({}, one))
            : [];

        state.cardState = result.cardState;
        state.gameState = result.gameState;
        state.stateVersion = result.nextStateVersion;

        const countsAfter = Core.countDiscs(state.gameState);
        const planStateAfter = buildCornerPlanState(
            state.gameState,
            state.cardState,
            playerKey,
            [],
            []
        );
        record.blackCountAfter = countsAfter.black;
        record.whiteCountAfter = countsAfter.white;
        record.ownCornersAfter = Number(planStateAfter.ownCorners || 0);
        record.oppCornersAfter = Number(planStateAfter.oppCorners || 0);
        record.ownEdgesAfter = Number(planStateAfter.ownEdges || 0);
        record.oppEdgesAfter = Number(planStateAfter.oppEdges || 0);

        gameRecords.push(record);
    }

    const maxPlyReached = !Core.isGameOver(state.gameState) && gameRecords.length >= normalizedOptions.maxPlies;

    annotateHorizonDecisionMetrics(gameRecords, 3);
    annotateSelfplayV2Metadata(gameRecords, normalizedOptions);

    const resolved = resolveWinner(state.gameState);
    const finalCornerControl = countCornerControl(state.gameState.board, Core.BLACK);
    const finalEdgeControl = countEdgeControl(state.gameState.board, Core.BLACK);
    for (const rec of gameRecords) {
        rec.winner = resolved.winner;
        rec.outcome = resolved.winner === 'draw' ? 0 : (rec.player === resolved.winner ? 1 : -1);
    }

    return {
        records: gameRecords,
        summary: {
            schemaVersion: normalizedOptions.schemaVersion,
            gameIndex,
            seed,
            plies: gameRecords.length,
            winner: resolved.winner,
            blackCount: resolved.counts.black,
            whiteCount: resolved.counts.white,
            blackCorners: Number(finalCornerControl.ownCorners || 0),
            whiteCorners: Number(finalCornerControl.oppCorners || 0),
            blackEdges: Number(finalEdgeControl.ownEdges || 0),
            whiteEdges: Number(finalEdgeControl.oppEdges || 0),
            endedBy: maxPlyReached ? 'max_plies' : 'game_over'
        }
    };
}

function runSelfPlayGames(options) {
    const opts = normalizeOptions(options);
    const allRecords = [];
    const gameSummaries = [];
    const totals = { black: 0, white: 0, draw: 0 };
    let totalPlies = 0;

    for (let i = 0; i < opts.games; i++) {
        if (opts.shouldStop && opts.shouldStop()) {
            break;
        }
        const gameIndex = opts.gameIndexOffset + i;
        const seed = opts.baseSeed + i;
        const gamePlayerPolicies = opts.playerPolicyResolver
            ? opts.playerPolicyResolver(gameIndex, seed)
            : opts.playerPolicies;
        const perGamePolicies = buildPerGamePolicySet(
            Object.assign({}, opts, { playerPolicies: gamePlayerPolicies || null }),
            seed,
            gameIndex
        );
        const one = runSingleGame(gameIndex, seed, Object.assign({}, opts, {
            playerPolicies: perGamePolicies
        }));
        gameSummaries.push(one.summary);
        totals[one.summary.winner] += 1;
        totalPlies += one.summary.plies;

        for (const rec of one.records) {
            if (opts.onRecord) opts.onRecord(rec);
            else allRecords.push(rec);
        }
        if (opts.onGameEnd) opts.onGameEnd(one.summary);
    }

    return {
        records: opts.onRecord ? [] : allRecords,
        gameSummaries,
        summary: {
            schemaVersion: opts.schemaVersion,
            totalGames: gameSummaries.length,
            plannedGames: opts.games,
            aborted: gameSummaries.length < opts.games,
            totalPlies,
            avgPlies: gameSummaries.length > 0 ? totalPlies / gameSummaries.length : 0,
            wins: totals
        }
    };
}

module.exports = {
    SELFPLAY_SCHEMA_VERSION,
    LEGACY_SELFPLAY_SCHEMA_VERSION,
    runSelfPlayGames,
    runSingleGame,
    decideAction,
    buildActorViewSnapshot,
    buildCardDecisionContext,
    buildSelectionTrace,
    selectPlacementMove,
    getPolicyActionScoreByKey,
    encodeBoard,
    getPolicyForPlayer
};
