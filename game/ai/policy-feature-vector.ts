const BASE_INPUT_DIM = 80;
const AUX_FEATURE_DIM = 16;
const LEGACY_BOARD_SIZE = 8;
const LEGACY_BOARD_FEATURE_DIM = 64;
const MAX_HAND_SIZE = 5;

let SharedBoardUtils: any = null;
try {
    SharedBoardUtils = require('../../shared/shared-board-utils');
} catch (e) {
    // Optional fallback for bundled/runtime environments.
}

const PADDED_BOARD_MIN = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_MIN))
    ? Number(SharedBoardUtils.PADDED_BOARD_MIN)
    : -1;
const PADDED_BOARD_MAX = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_MAX))
    ? Number(SharedBoardUtils.PADDED_BOARD_MAX)
    : 8;
const PADDED_BOARD_SIZE = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_SIZE))
    ? Number(SharedBoardUtils.PADDED_BOARD_SIZE)
    : 10;
const PADDED_BOARD_FEATURE_DIM = PADDED_BOARD_SIZE * PADDED_BOARD_SIZE;
let CHARGE_MAX_NORMALIZER = 99;
try {
    const SharedConstants = require('../../shared-constants');
    if (SharedConstants && Number.isFinite(Number(SharedConstants.CHARGE_MAX))) {
        CHARGE_MAX_NORMALIZER = Number(SharedConstants.CHARGE_MAX);
    }
} catch (e) {
    // Keep legacy normalizer when shared constants are not available.
}
const LEGACY_DECK_COUNT_NORMALIZER = 60;
const DECK_COUNT_FEATURE_MODE = 'own_deck_ratio_v1';

const POLICY_FEATURE_VECTOR_OFFSETS = Object.freeze({
    legalMoves: 0,
    discDiff: 1,
    ownCharge: 2,
    oppCharge: 3,
    deckCount: 4,
    pendingFlag: 5,
    ownCorners: 6,
    oppCorners: 7,
    ownEdges: 8,
    oppEdges: 9,
    hasCornerMoveNow: 10,
    hasEdgeMoveNow: 11,
    cornerEmergency: 12,
    cornerHoldMode: 13,
    highBonusMoveAvailable: 14,
    maxLegalMoveBonus: 15
});

function perspectiveCell(v: any, playerKey: any) {
    if (!Number.isFinite(v)) return 0;
    const sign = playerKey === 'black' ? 1 : -1;
    if (v === sign) return 1;
    if (v === -sign) return -1;
    return 0;
}

function buildCardCounts(cardIds: any) {
    const counts = Object.create(null);
    if (!Array.isArray(cardIds)) return counts;
    for (const one of cardIds) {
        if (typeof one !== 'string') continue;
        const cardId = one.trim();
        if (!cardId) continue;
        counts[cardId] = (counts[cardId] || 0) + 1;
    }
    return counts;
}

function toBinaryFlag(raw: any) {
    if (raw === true) return 1;
    if (raw === false || raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n > 0 ? 1 : 0;
}

function getBoardCoordinates(board: any) {
    if (!Array.isArray(board)) return [];
    if (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function') {
        return SharedBoardUtils.collectBoardCoordinates(board);
    }
    const out = [];
    for (let row = 0; row < Math.min(LEGACY_BOARD_SIZE, board.length); row++) {
        const cells = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < Math.min(LEGACY_BOARD_SIZE, cells.length); col++) {
            out.push({ row, col });
        }
    }
    return out;
}

function getBoardCellValue(board: any, row: any, col: any) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function') {
        return SharedBoardUtils.getCellValue(board, row, col);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return null;
    return board[row][col];
}

function isCornerMoveForBoard(move: any, board: any) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return false;
    if (SharedBoardUtils && typeof SharedBoardUtils.isCornerCell === 'function') {
        return SharedBoardUtils.isCornerCell(Number(move.row), Number(move.col), board);
    }
    return (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
}

function isEdgeMoveForBoard(move: any, board: any) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return false;
    if (SharedBoardUtils && typeof SharedBoardUtils.isEdgeCell === 'function') {
        return SharedBoardUtils.isEdgeCell(Number(move.row), Number(move.col), board);
    }
    return move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7;
}

function isPaddedActionSpace(modelMeta: any, outputDimHint: any) {
    const paddedSize = modelMeta && Number.isFinite(Number(modelMeta.paddedBoardSize))
        ? Math.floor(Number(modelMeta.paddedBoardSize))
        : 0;
    if (paddedSize > LEGACY_BOARD_SIZE) return true;
    const actionSpace = modelMeta && typeof modelMeta.actionSpace === 'string'
        ? modelMeta.actionSpace
        : '';
    if (actionSpace.indexOf('padded') >= 0) return true;
    if (Number.isFinite(outputDimHint) && Number(outputDimHint) > LEGACY_BOARD_FEATURE_DIM) return true;
    return false;
}

function supportsPaddedBoardFeatures(modelMeta: any) {
    const metaBase = modelMeta && Number.isFinite(Number(modelMeta.baseInputDim))
        ? Math.floor(Number(modelMeta.baseInputDim))
        : null;
    return isPaddedActionSpace(modelMeta, modelMeta && modelMeta.outputDim) ||
        (Number.isFinite(metaBase) && Number(metaBase) >= (PADDED_BOARD_FEATURE_DIM + AUX_FEATURE_DIM));
}

function resolveBoardFeatureDim(modelMeta: any, baseInputDim: any) {
    if (supportsPaddedBoardFeatures(modelMeta)) {
        return PADDED_BOARD_FEATURE_DIM;
    }
    if (Number.isFinite(baseInputDim) && baseInputDim >= (PADDED_BOARD_FEATURE_DIM + AUX_FEATURE_DIM)) {
        return PADDED_BOARD_FEATURE_DIM;
    }
    return LEGACY_BOARD_FEATURE_DIM;
}

function countCornerEdgeControl(board: any, playerKey: any) {
    const out = { ownCorners: 0, oppCorners: 0, ownEdges: 0, oppEdges: 0 };
    if (!Array.isArray(board)) return out;
    const own = playerKey === 'black' ? 1 : -1;
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        const cornerControl = SharedBoardUtils.countCornerControl(board, own);
        out.ownCorners = Number(cornerControl && cornerControl.ownCorners) || 0;
        out.oppCorners = Number(cornerControl && cornerControl.oppCorners) || 0;
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.countEdgeControl === 'function') {
        const edgeControl = SharedBoardUtils.countEdgeControl(board, own);
        out.ownEdges = Number(edgeControl && edgeControl.ownEdges) || 0;
        out.oppEdges = Number(edgeControl && edgeControl.oppEdges) || 0;
        return out;
    }
    const opp = -own;
    for (const cell of getBoardCoordinates(board)) {
        const value = getBoardCellValue(board, cell.row, cell.col);
        const isCorner = isCornerMoveForBoard(cell, board);
        const isEdge = !isCorner && isEdgeMoveForBoard(cell, board);
        if (isCorner) {
            if (value === own) out.ownCorners += 1;
            else if (value === opp) out.oppCorners += 1;
        } else if (isEdge) {
            if (value === own) out.ownEdges += 1;
            else if (value === opp) out.oppEdges += 1;
        }
    }
    return out;
}

function getContextBoardBonusAtCell(ctx: any, row: any, col: any) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const key = `${row},${col}`;
    if (ctx.boardBonusConsumedByCell && ctx.boardBonusConsumedByCell[key] === true) return 0;
    const raw = Number(ctx.boardBonusByCell && ctx.boardBonusByCell[key] ? ctx.boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getCornerPlanFeatures(ctx: any, board: any, playerKey: any) {
    const control = countCornerEdgeControl(board, playerKey);
    const ownCorners = Number.isFinite(Number(ctx.ownCornersBefore)) ? Number(ctx.ownCornersBefore) : control.ownCorners;
    const oppCorners = Number.isFinite(Number(ctx.oppCornersBefore)) ? Number(ctx.oppCornersBefore) : control.oppCorners;
    const ownEdges = Number.isFinite(Number(ctx.ownEdgesBefore)) ? Number(ctx.ownEdgesBefore) : control.ownEdges;
    const oppEdges = Number.isFinite(Number(ctx.oppEdgesBefore)) ? Number(ctx.oppEdgesBefore) : control.oppEdges;

    const moves = Array.isArray(ctx.candidateMoves) ? ctx.candidateMoves : [];
    const hasCornerMoveNow = Number.isFinite(Number(ctx.hasCornerMoveNow))
        ? toBinaryFlag(ctx.hasCornerMoveNow)
        : (moves.some((move: any) => isCornerMoveForBoard(move, board)) ? 1 : 0);
    const hasEdgeMoveNow = Number.isFinite(Number(ctx.hasEdgeMoveNow))
        ? toBinaryFlag(ctx.hasEdgeMoveNow)
        : (moves.some((move: any) => isEdgeMoveForBoard(move, board) && !isCornerMoveForBoard(move, board)) ? 1 : 0);

    let maxLegalMoveBonus = Number.isFinite(Number(ctx.maxLegalMoveBonus)) ? Number(ctx.maxLegalMoveBonus) : 0;
    if (maxLegalMoveBonus <= 0 && moves.length > 0) {
        for (const move of moves) {
            if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) continue;
            const b = getContextBoardBonusAtCell(ctx, move.row, move.col);
            if (b > maxLegalMoveBonus) maxLegalMoveBonus = b;
        }
    }
    const highBonusMoveAvailable = Number.isFinite(Number(ctx.highBonusMoveAvailable))
        ? toBinaryFlag(ctx.highBonusMoveAvailable)
        : (maxLegalMoveBonus >= 3 ? 1 : 0);
    const cornerEmergency = Number.isFinite(Number(ctx.cornerEmergency))
        ? toBinaryFlag(ctx.cornerEmergency)
        : ((oppCorners > ownCorners || (hasCornerMoveNow <= 0 && oppCorners > 0)) ? 1 : 0);
    const cornerHoldMode = Number.isFinite(Number(ctx.cornerHoldMode))
        ? toBinaryFlag(ctx.cornerHoldMode)
        : ((cornerEmergency <= 0 && ownCorners > 0 && ownCorners >= oppCorners && ownEdges >= oppEdges) ? 1 : 0);

    return {
        ownCorners,
        oppCorners,
        ownEdges,
        oppEdges,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        cornerHoldMode,
        highBonusMoveAvailable,
        maxLegalMoveBonus
    };
}

function resolveBaseInputDim(modelMeta: any, inputDim: any, cardDim: any): number {
    const metaBase = modelMeta && Number.isFinite(modelMeta.baseInputDim) ? Math.floor(modelMeta.baseInputDim) : null;
    if (Number.isFinite(metaBase) && Number(metaBase) >= 64 && Number(metaBase) <= inputDim) return Number(metaBase);
    if (Number.isFinite(cardDim) && cardDim > 0) {
        const inferred = inputDim - (cardDim * 2);
        if (inferred >= 64 && inferred <= inputDim) return inferred;
    }
    return Math.min(BASE_INPUT_DIM, inputDim);
}

function resolveDeckCountScalar(ctx: any, modelMeta: any) {
    const legacyDeckCount = Number.isFinite(ctx.deckCount) ? ctx.deckCount : 0;
    if (modelMeta && modelMeta.deckCountFeature === DECK_COUNT_FEATURE_MODE) {
        const ownDeckCount = Number.isFinite(ctx.ownDeckCount) ? ctx.ownDeckCount : legacyDeckCount;
        const initialDeckSize = Number.isFinite(ctx.initialDeckSize) && ctx.initialDeckSize > 0
            ? ctx.initialDeckSize
            : LEGACY_DECK_COUNT_NORMALIZER;
        return ownDeckCount / initialDeckSize;
    }
    return legacyDeckCount / LEGACY_DECK_COUNT_NORMALIZER;
}

function buildPolicyFeatureVector(context: any, metaOverride?: any, actionIdsOverride?: any) {
    const ctx = context || {};
    const board = Array.isArray(ctx.board) ? ctx.board : [];
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const modelMeta = metaOverride || {};
    const actionIds = Array.isArray(actionIdsOverride)
        ? actionIdsOverride
        : (modelMeta && Array.isArray(modelMeta.cardActionIds) ? modelMeta.cardActionIds : []);
    const inputDim = (modelMeta && Number.isFinite(modelMeta.inputDim) && modelMeta.inputDim > 0)
        ? Math.floor(modelMeta.inputDim)
        : BASE_INPUT_DIM;
    const cardDim = actionIds.length;
    const baseInputDim = resolveBaseInputDim(modelMeta, inputDim, cardDim);
    const boardFeatureDim = resolveBoardFeatureDim(modelMeta, baseInputDim);
    const out = new Float32Array(inputDim);

    if (board.length > 0) {
        if (boardFeatureDim > LEGACY_BOARD_FEATURE_DIM) {
            let idx = 0;
            for (let row = PADDED_BOARD_MIN; row <= PADDED_BOARD_MAX; row++) {
                for (let col = PADDED_BOARD_MIN; col <= PADDED_BOARD_MAX; col++) {
                    out[idx++] = perspectiveCell(getBoardCellValue(board, row, col), playerKey);
                }
            }
        } else {
            let idx = 0;
            for (let row = 0; row < LEGACY_BOARD_SIZE; row++) {
                for (let col = 0; col < LEGACY_BOARD_SIZE; col++) {
                    out[idx++] = perspectiveCell(getBoardCellValue(board, row, col), playerKey);
                }
            }
        }
    }

    const legalMoves = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    let blackCount = Number.isFinite(ctx.blackCountBefore) ? ctx.blackCountBefore : 0;
    let whiteCount = Number.isFinite(ctx.whiteCountBefore) ? ctx.whiteCountBefore : 0;
    if ((!Number.isFinite(ctx.blackCountBefore) || !Number.isFinite(ctx.whiteCountBefore)) && Array.isArray(board)) {
        blackCount = 0;
        whiteCount = 0;
        for (const cell of getBoardCoordinates(board)) {
            const value = getBoardCellValue(board, cell.row, cell.col);
            if (value === 1) blackCount++;
            else if (value === -1) whiteCount++;
        }
    }
    const ownCharge = Number.isFinite(ctx.ownCharge) ? ctx.ownCharge : 0;
    const oppCharge = Number.isFinite(ctx.oppCharge) ? ctx.oppCharge : 0;
    const deckCountScalar = resolveDeckCountScalar(ctx, modelMeta);
    const pendingFlag = ctx.pendingType ? 1 : 0;
    const discDiff = playerKey === 'black' ? (blackCount - whiteCount) : (whiteCount - blackCount);
    const planFeatures = getCornerPlanFeatures(ctx, board, playerKey);
    const scalarOffset = boardFeatureDim;

    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.legalMoves)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.legalMoves] = legalMoves / 60;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.discDiff)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.discDiff] = discDiff / 64;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownCharge)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownCharge] = ownCharge / CHARGE_MAX_NORMALIZER;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppCharge)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppCharge] = oppCharge / CHARGE_MAX_NORMALIZER;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.deckCount)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.deckCount] = deckCountScalar;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.pendingFlag)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.pendingFlag] = pendingFlag;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownCorners)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownCorners] = planFeatures.ownCorners / 4;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppCorners)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppCorners] = planFeatures.oppCorners / 4;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownEdges)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.ownEdges] = planFeatures.ownEdges / 24;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppEdges)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.oppEdges] = planFeatures.oppEdges / 24;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.hasCornerMoveNow)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.hasCornerMoveNow] = planFeatures.hasCornerMoveNow;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.hasEdgeMoveNow)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.hasEdgeMoveNow] = planFeatures.hasEdgeMoveNow;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.cornerEmergency)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.cornerEmergency] = planFeatures.cornerEmergency;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.cornerHoldMode)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.cornerHoldMode] = planFeatures.cornerHoldMode;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.highBonusMoveAvailable)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.highBonusMoveAvailable] = planFeatures.highBonusMoveAvailable;
    if (baseInputDim > (scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.maxLegalMoveBonus)) out[scalarOffset + POLICY_FEATURE_VECTOR_OFFSETS.maxLegalMoveBonus] = Math.max(0, Math.min(1, planFeatures.maxLegalMoveBonus / 5));

    if (cardDim > 0 && inputDim >= (baseInputDim + (cardDim * 2))) {
        const handCounts = buildCardCounts(ctx.handCardIds);
        const usableFlags = buildCardCounts(ctx.usableCardIds);
        const handOffset = baseInputDim;
        const usableOffset = baseInputDim + cardDim;
        for (let idx = 0; idx < actionIds.length; idx++) {
            const cardId = actionIds[idx];
            const handCount = Number(handCounts[cardId] || 0);
            const usableCount = Number(usableFlags[cardId] || 0);
            out[handOffset + idx] = Math.min(MAX_HAND_SIZE, handCount) / MAX_HAND_SIZE;
            out[usableOffset + idx] = usableCount > 0 ? 1 : 0;
        }
    }

    const pendingTypes = modelMeta && Array.isArray(modelMeta.pendingTypes)
        ? modelMeta.pendingTypes.filter((one: any) => typeof one === 'string' && one.trim())
        : [];
    if (pendingTypes.length > 0) {
        const fullCardOffset = baseInputDim + (cardDim * 2);
        const pendingOffset = inputDim >= (fullCardOffset + pendingTypes.length)
            ? fullCardOffset
            : (inputDim >= (baseInputDim + pendingTypes.length) ? baseInputDim : -1);
        if (pendingOffset >= 0) {
            const pendingType = typeof ctx.pendingType === 'string' ? ctx.pendingType.trim() : '';
            const pendingIndex = pendingTypes.indexOf(pendingType);
            if (pendingIndex >= 0 && pendingOffset + pendingIndex < out.length) {
                out[pendingOffset + pendingIndex] = 1;
            }
        }
    }

    return out;
}

const Api = {
    POLICY_FEATURE_VECTOR_OFFSETS,
    buildPolicyFeatureVector
};

export = Api;
