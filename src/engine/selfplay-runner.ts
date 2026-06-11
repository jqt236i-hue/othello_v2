declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

/**
 * @file selfplay-runner.js
 * @description Headless self-play runner backed by the production TurnPipeline.
 */

'use strict';

const path = require('path');
/** @type {any} */
const Core = require('../../game/logic/core.js');
const CardLogic = require('../../game/logic/cards.js');
const TurnPipeline = require('../../game/turn/turn_pipeline.js');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases.js');
const SeededPRNG = require('../../game/schema/prng.js');
const deepClone = require('../../utils/deepClone');
const CpuPolicyCore = require('../../game/ai/cpu-policy-core.js');
const CpuPolicyTableRuntime = require('../../game/ai/policy-table-runtime.js');
const CpuLv6LookaheadProfile = require('../../game/ai/cpu-lv6-lookahead-profile.js');
const SharedBoardUtils = require(path.resolve(__dirname, '..', '..', 'shared', 'shared-board-utils.js'));
const OthelloCore = require(path.resolve(__dirname, '..', '..', 'shared', 'othello-core.js'));
const SharedCardHeuristics = require(path.resolve(__dirname, '..', '..', 'shared', 'shared-card-heuristics.js'));
const PendingTargetSelector = require('../../game/turn-handlers/pending-target-selector.js');
const PendingCoordinator = require('../../game/turn/pending-coordinator.js');
const SelfplayBoardPrimitives = require('./selfplay-board-primitives.js');
const SelfplayRecordMetadata = require('./selfplay-record-metadata.js');
const SelfplaySearchPrimitives = require('./selfplay-search-primitives.js');
const SelfplayCornerPlan = require('./selfplay-corner-plan.js');
const SelfplayPolicyModel = require('./selfplay-policy-model.js');
const SelfplayPendingTargetSelection = require('./selfplay-pending-target-selection.js');
const SelfplayRetryController = require('./selfplay-retry-controller.js');
const SelfplayCardChoice = require('./selfplay-card-choice.js');
const SelfplayBasicTargetChoosers = require('./selfplay-basic-target-choosers.js');
const SelfplaySimpleSimulationChoosers = require('./selfplay-simple-simulation-choosers.js');
const SelfplayAdvancedSimulationChoosers = require('./selfplay-advanced-simulation-choosers.js');
const SelfplayScoreTargetChoosers = require('./selfplay-score-target-choosers.js');
const SelfplaySellCardChoice = require('./selfplay-sell-card-choice.js');
const SelfplayCardUsageDecision = require('./selfplay-card-usage-decision.js');
const SelfplayPendingActionDecision = require('./selfplay-pending-action-decision.js');
const SelfplayPlacementDecision = require('./selfplay-placement-decision.js');
const SelfplayDecisionContext = require('./selfplay-decision-context.js');
const SelfplayPendingSelectionBridge = require('./selfplay-pending-selection-bridge.js');
const SelfplayBootstrapHelpers = require('./selfplay-bootstrap-helpers.js');
const SelfplayPolicySetup = require('./selfplay-policy-setup.js');
const SelfplayBatchRunner = require('./selfplay-batch-runner.js');
const SelfplayRetryHelpers = require('./selfplay-retry-helpers.js');
const SelfplayPositionWeights = require('./selfplay-position-weights.js');

let ContextHelper: any = null;
try {
    ContextHelper = _require('../../game/logic/context');
} catch (e) { /* ignore */ }

const SELFPLAY_SCHEMA_VERSION = 'selfplay.v2';
const LEGACY_SELFPLAY_SCHEMA_VERSION = 'selfplay.v1';

const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;

const FALLBACK_CORNER_RECOVERY_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CORNER_RECOVERY_CARD_TYPES,
        [
            'BUOYANCY_WILL',
            'SUPER_BUOYANCY_WILL',
            'GRAVITY_WILL',
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
        'BUOYANCY_WILL',
        'SUPER_BUOYANCY_WILL',
        'GRAVITY_WILL',
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

const {
    toPlayerKey,
    toPlayerValue,
    getSafeCardContext,
    getShapeAwareBoard,
    getSelfplayBoard,
    readSelfplayPendingEffect,
    getBoardCellValue,
    setBoardCellValue,
    encodeBoard,
    encodeMainBoard,
    decodeBoard,
    transformCoord,
    transformBoard,
    canonicalizeBoard,
    isCorner,
    isEdge,
    resolveForcedPlacementCandidates,
    isXSquare,
    isCSquare,
    getFlipsBasic,
    getLegalMovesBasic
} = SelfplayBoardPrimitives.createSelfplayBoardPrimitives({
    Core,
    CardLogic,
    SharedBoardUtils,
    OthelloCore,
    PendingCoordinator,
    ContextHelper
});

function getCornerProximity(row: any, col: any, boardOverride: any = null) {
    const board = Array.isArray(boardOverride) ? boardOverride : null;
    if (SharedBoardUtils && typeof SharedBoardUtils.getCornerProximity === 'function') {
        return SharedBoardUtils.getCornerProximity(row, col, board || 8);
    }
    const n = Array.isArray(board) && board.length > 0 ? board.length : 8;
    if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) {
        return { kind: 'X', corner: [row === 1 ? 0 : n - 1, col === 1 ? 0 : n - 1] };
    }
    if (row === 0 && (col === 1 || col === n - 2)) return { kind: 'C', corner: [0, col === 1 ? 0 : n - 1] };
    if (row === n - 1 && (col === 1 || col === n - 2)) return { kind: 'C', corner: [n - 1, col === 1 ? 0 : n - 1] };
    if (col === 0 && (row === 1 || row === n - 2)) return { kind: 'C', corner: [row === 1 ? 0 : n - 1, 0] };
    if (col === n - 1 && (row === 1 || row === n - 2)) return { kind: 'C', corner: [row === 1 ? 0 : n - 1, n - 1] };
    return null;
}

function scoreMove(move: any, rng: any, context: any) {
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

function evaluatePositionalDiff(board: any, playerValue: any) {
    const boardRef = getShapeAwareBoard(board);
    let own = 0;
    let opp = 0;
    const cells = (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function')
        ? SharedBoardUtils.collectBoardCoordinates(boardRef)
        : boardRef.flatMap((row: any, rowIndex: any) => (Array.isArray(row) ? row.map((_: any, colIndex: any) => ({ row: rowIndex, col: colIndex })) : []));
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

function countCorners(board: any, playerValue: any) {
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

function countCornerControl(board: any, playerValue: any) {
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

function countEdgeControl(board: any, playerValue: any) {
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

function countEmptiesInBoardKey(boardKey: any) {
    if (typeof boardKey !== 'string' || !boardKey) return 0;
    let count = 0;
    for (let i = 0; i < boardKey.length; i++) {
        if (boardKey[i] === '.') count += 1;
    }
    return count;
}

const {
    annotateHorizonDecisionMetrics,
    classifySelectionSeat,
    buildPendingSelectionRecord,
    buildPendingSelectionTrace,
    buildSelectionTrace,
    getDeckStatsForPlayer,
    buildActorViewSnapshot,
    annotateSelfplayV2Metadata
} = SelfplayRecordMetadata.createSelfplayRecordMetadata({
    isCorner,
    isEdge,
    countEmptiesInBoardKey,
    boardTargetKeys: [
        'destroyTarget',
        'strongWindTarget',
        'buoyancyTarget',
        'superBuoyancyTarget',
        'gravityTarget',
        'superGravityTarget',
        'sacrificeTarget',
        'temptTarget',
        'captureTarget',
        'swapTarget',
        'positionSwapTarget',
        'guardTarget',
        'livingWillTarget',
        'extendTarget',
        'corrosionTarget',
        'bombTarget',
        'cloneTarget',
        'blockadeTarget',
        'meteorTarget',
        'freezeTarget',
        'seedTarget',
        'teleportTarget',
        'expansionTarget',
        'shrinkTarget',
        'trapTarget'
    ]
});
const {
    getBoardBonusAtCell,
    resolveCardType,
    buildCornerPlanState,
    buildMovePlanContext
} = SelfplayCornerPlan.createSelfplayCornerPlan({
    CardLogic,
    CpuPolicyCore,
    SharedCardHeuristics,
    SharedBoardUtils,
    fallbackCornerRecoveryCardTypes: FALLBACK_CORNER_RECOVERY_CARD_TYPES,
    fallbackCornerHoldCardTypes: FALLBACK_CORNER_HOLD_CARD_TYPES,
    getSelfplayBoard,
    toPlayerValue,
    isCorner,
    isEdge,
    countCornerControl,
    countEdgeControl,
    readSelfplayPendingEffect
});
function countDiscsByValue(gameState: any, playerValue: any) {
    const board = getSelfplayBoard(gameState);
    if (isStandardBoard(board)) {
        const counts = Core.countDiscs(gameState);
        return playerValue === Core.BLACK
            ? (counts.black - counts.white)
            : (counts.white - counts.black);
    }
    return countDiscDiffOnBoard(board, playerValue);
}

function evaluateBoardForPlayer(gameState: any, cardState: any, playerKey: any) {
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

const {
    clonePrng,
    buildDecisionSnapshot,
    cloneInitialDeckCardIdsByPlayer,
    createInitialState
} = SelfplayBootstrapHelpers.createSelfplayBootstrapHelpers({
    SeededPRNG,
    deepClone,
    TurnPipelinePhases,
    CardLogic,
    Core
});

const {
    normalizeLookaheadTimeBudget,
    normalizeLookaheadVirtualTimePerNodeMs,
    normalizeOptions,
    getPolicyForPlayer,
    buildPerGamePolicySet
} = SelfplayPolicySetup.createSelfplayPolicySetup({
    SELFPLAY_SCHEMA_VERSION,
    SeededPRNG,
    cloneInitialDeckCardIdsByPlayer
});

const {
    choosePendingTargetByScore,
    resolvePendingTargetList,
    chooseTargetBySimulation
} = SelfplayPendingTargetSelection.createSelfplayPendingTargetSelection({
    PendingTargetSelector,
    CardLogic,
    Core,
    deepClone,
    evaluateBoardForPlayer,
    evaluatePositionValue,
    clonePrng
});

function applyMoveForEvaluation(gameState: any, move: any, playerValue: any) {
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
const {
    countEmpties,
    isStandardBoard,
    countDiscDiffOnBoard,
    applyMoveToBoard,
    evaluateBoardForSearch,
    resolveTacticalSearchDepth,
    resolveTacticalBeamWidth,
    resolveTacticalMetricsCandidateLimit,
    computePositiveOpportunityMissMetrics,
    minimaxBoardSearch
} = SelfplaySearchPrimitives.createSelfplaySearchPrimitives({
    SharedBoardUtils,
    getLegalMovesBasic,
    setBoardCellValue,
    evaluatePositionValue,
    countCorners
});

const {
    getPolicyScore,
    getPolicyActionScoreByKey,
    selectPlacementMoveFromPolicyModel,
    chooseBestMoveByScore
} = SelfplayPolicyModel.createSelfplayPolicyModel({
    SharedBoardUtils,
    CpuPolicyTableRuntime,
    CpuLv6LookaheadProfile,
    selfplaySchemaVersion: SELFPLAY_SCHEMA_VERSION,
    legacySelfplaySchemaVersion: LEGACY_SELFPLAY_SCHEMA_VERSION,
    getSelfplayBoard,
    encodeBoard,
    canonicalizeBoard,
    transformCoord,
    countEmpties,
    countDiscDiffOnBoard,
    toPlayerValue,
    countCorners
});

function scoreTacticalMove(move: any, context: any, options: any) {
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

function choosePlacementMoveByBrowserParity(candidateMoves: any, context: any, options: any, movePlanContext: any) {
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
    const learnedScoreFn = (move: any) => getPolicyScore(options, Object.assign({}, context || {}, {
        legalMovesCount: candidateMoves.length
    }), move);
    const movePlanScoreFn = (
        movePlanContext &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function'
    )
        ? (move: any) => {
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
    const combinedScoreFn = (move: any) => {
        let score = 0;
        if (movePlanScoreFn) score += movePlanScoreFn(move) * heuristicWeight;
        const learnedScore = learnedScoreFn ? Number(learnedScoreFn(move) || 0) : 0;
        if (typeof learnedScoreFn === 'function') {
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

function selectPlacementMove(legalMoves: any, rng: any, context: any, options: any) {
    const scored = scorePlacementCandidates(legalMoves, rng, context, options);
    if (scored && scored.move) return scored.move;
    if (Array.isArray(legalMoves) && legalMoves.length > 0) return legalMoves[0];
    return null;
}

function makeMoveKey(move: any) {
    if (!move) return '';
    return `${Number(move.row)}:${Number(move.col)}`;
}

function sortScoredMovesBy(scoredMoves: any, scoreKey: any) {
    return scoredMoves.slice().sort((a: any, b: any) => {
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

function buildBordaMaps(scoredMoves: any, scoreKeys: any) {
    const keys = Array.isArray(scoreKeys) && scoreKeys.length > 0
        ? scoreKeys.slice()
        : ['strategistScore', 'tacticianScore', 'economistScore'];
    const points = new Map();
    const ranksByKey: Record<string, any> = {};
    for (const scoreKey of keys) {
        ranksByKey[scoreKey] = new Map();
    }
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

function hasMeaningfulFiniteScore(scoredItems: any, scoreKey: any) {
    if (!Array.isArray(scoredItems) || !scoreKey) return false;
    let finiteCount = 0;
    let firstValue = Number.NaN;
    let varied = false;
    for (const item of scoredItems) {
        const value = Number(item && item[scoreKey]);
        if (!Number.isFinite(value)) continue;
        finiteCount += 1;
        if (!Number.isFinite(firstValue)) {
            firstValue = value;
            continue;
        }
        if (value !== firstValue) varied = true;
    }
    return finiteCount > 0 && (varied || finiteCount === 1);
}

function resolveCommitteeScoreKeys(scoredItems: any, preferredKeys: any) {
    const candidates = Array.isArray(preferredKeys) ? preferredKeys : [];
    return candidates.filter((scoreKey: any) => hasMeaningfulFiniteScore(scoredItems, scoreKey));
}

function countCommitteeLeaderVotes(ranksByKey: any, candidateKey: any) {
    if (!ranksByKey || !candidateKey) return 0;
    let votes = 0;
    for (const rankMap of Object.values(ranksByKey)) {
        if (rankMap instanceof Map && rankMap.get(candidateKey) === 0) {
            votes += 1;
        }
    }
    return votes;
}

function resolveCommitteeConsensusScore(votes: any, consensusBonus: any) {
    const normalizedVotes = Number.isFinite(votes) ? Math.max(0, Math.floor(Number(votes))) : 0;
    const normalizedBonus = Number.isFinite(consensusBonus) ? Math.max(0, Number(consensusBonus)) : 0;
    if (normalizedVotes < 2 || !(normalizedBonus > 0)) return 0;
    return normalizedBonus * (normalizedVotes - 1);
}

function applyTeacherCommitteeToMoveScores(scoredMoves: any, options: any) {
    const committeeWeight = Number.isFinite(options && options.teacherCommitteeWeight)
        ? Math.max(0, Number(options.teacherCommitteeWeight))
        : 0;
    const consensusBonus = Number.isFinite(options && options.teacherCommitteeConsensusBonus)
        ? Math.max(0, Number(options.teacherCommitteeConsensusBonus))
        : 0;
    for (const one of scoredMoves || []) {
        one.committeeScore = 0;
        one.committeeVotes = 0;
        one.finalScore = Number(one && one.combinedScore) || 0;
    }
    if ((!Array.isArray(scoredMoves) || scoredMoves.length <= 0) || (!(committeeWeight > 0) && !(consensusBonus > 0))) {
        return;
    }
    const scoreKeys = resolveCommitteeScoreKeys(scoredMoves, ['combinedScore', 'heuristicScore', 'tacticalScore', 'policyScore']);
    if (scoreKeys.length <= 0) return;
    const { points, ranksByKey } = buildBordaMaps(scoredMoves, scoreKeys);
    for (const one of scoredMoves) {
        const moveKey = makeMoveKey(one && one.move);
        const pointScore = Number(points.get(moveKey) || 0);
        const committeeVotes = countCommitteeLeaderVotes(ranksByKey, moveKey);
        const committeeScore = (pointScore * committeeWeight) +
            resolveCommitteeConsensusScore(committeeVotes, consensusBonus);
        one.committeeVotes = committeeVotes;
        one.committeeScore = committeeScore;
        one.finalScore = (Number(one && one.combinedScore) || 0) + committeeScore;
    }
}

function sortScoredCardsBy(scoredCards: any, scoreKey: any) {
    return scoredCards.slice().sort((a: any, b: any) => {
        const sa = Number.isFinite(a && a[scoreKey]) ? Number(a[scoreKey]) : Number.NEGATIVE_INFINITY;
        const sb = Number.isFinite(b && b[scoreKey]) ? Number(b[scoreKey]) : Number.NEGATIVE_INFINITY;
        if (sb !== sa) return sb - sa;
        const aCost = Number.isFinite(a && a.cardCost) ? Number(a.cardCost) : Number.NEGATIVE_INFINITY;
        const bCost = Number.isFinite(b && b.cardCost) ? Number(b.cardCost) : Number.NEGATIVE_INFINITY;
        if (bCost !== aCost) return bCost - aCost;
        return String(a && a.cardId ? a.cardId : '').localeCompare(String(b && b.cardId ? b.cardId : ''));
    });
}

function buildCardBordaMaps(scoredCards: any, scoreKeys: any) {
    const keys = Array.isArray(scoreKeys) ? scoreKeys.filter(Boolean) : [];
    const points = new Map();
    const ranksByKey: Record<string, any> = {};
    const n = Array.isArray(scoredCards) ? scoredCards.length : 0;
    if (n <= 0 || keys.length <= 0) return { points, ranksByKey };
    for (const scoreKey of keys) {
        ranksByKey[scoreKey] = new Map();
        const ordered = sortScoredCardsBy(scoredCards, scoreKey);
        for (let i = 0; i < ordered.length; i++) {
            const one = ordered[i];
            const key = String(one && one.cardId ? one.cardId : '');
            if (!key) continue;
            ranksByKey[scoreKey].set(key, i);
            points.set(key, (points.get(key) || 0) + (n - 1 - i));
        }
    }
    return { points, ranksByKey };
}

function applyTeacherCommitteeToCardCandidates(candidates: any, options: any) {
    const committeeWeight = Number.isFinite(options && options.teacherCommitteeWeight)
        ? Math.max(0, Number(options.teacherCommitteeWeight))
        : 0;
    const consensusBonus = Number.isFinite(options && options.teacherCommitteeConsensusBonus)
        ? Math.max(0, Number(options.teacherCommitteeConsensusBonus))
        : 0;
    for (const one of candidates || []) {
        one.committeeScore = 0;
        one.committeeVotes = 0;
        one.finalScore = Number.isFinite(one && one.baseScore) ? Number(one.baseScore) : 0;
    }
    if ((!Array.isArray(candidates) || candidates.length <= 0) || (!(committeeWeight > 0) && !(consensusBonus > 0))) {
        return;
    }
    const scoreKeys = resolveCommitteeScoreKeys(candidates, ['policyScore', 'riskScore', 'costScore']);
    if (scoreKeys.length <= 0) return;
    const { points, ranksByKey } = buildCardBordaMaps(candidates, scoreKeys);
    for (const one of candidates) {
        const cardKey = String(one && one.cardId ? one.cardId : '');
        const pointScore = Number(points.get(cardKey) || 0);
        const committeeVotes = countCommitteeLeaderVotes(ranksByKey, cardKey);
        const committeeScore = (pointScore * committeeWeight) +
            resolveCommitteeConsensusScore(committeeVotes, consensusBonus);
        one.committeeVotes = committeeVotes;
        one.committeeScore = committeeScore;
        one.finalScore = (Number.isFinite(one && one.baseScore) ? Number(one.baseScore) : 0) + committeeScore;
    }
}

function scorePlacementCandidates(legalMoves: any, rng: any, context: any, options: any) {
    const forcedPlacement = resolveForcedPlacementCandidates(
        legalMoves,
        options,
        getSelfplayBoard(context && context.gameState, context && context.cardState)
    );
    const defaultCandidateMoves = Array.isArray(legalMoves)
        ? legalMoves.filter((move: any) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        : [];
    const candidateMoves = (Array.isArray(forcedPlacement.moves) && forcedPlacement.moves.length > 0)
        ? forcedPlacement.moves
        : defaultCandidateMoves;
    if (candidateMoves.length <= 0) {
        return { move: null, metrics: null };
    }
    const enableTacticalLookahead = !(options && options.enableTacticalLookahead === false);
    let usableCardIds: any[] = [];
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

    let preliminarySelected = parityMove
        ? scoredMoves.find((one: any) => CpuLv6LookaheadProfile.isSameMoveByCoord(one.move, parityMove)) || null
        : null;
    if (!preliminarySelected) {
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
        preliminarySelected = bestScored;
    }

    if (!preliminarySelected) {
        return { move: null, metrics: null };
    }

    let bestTacticalScore = 0;
    if (enableTacticalLookahead) {
        const tacticalLimit = resolveTacticalMetricsCandidateLimit(options, scoredMoves.length);
        if (tacticalLimit > 0) {
            const tacticalCandidates = scoredMoves
                .slice()
                .sort((a: any, b: any) => {
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

            if (!tacticalCandidates.some((one: any) => one === preliminarySelected)) {
                tacticalCandidates.push(preliminarySelected);
            }

            for (const one of tacticalCandidates) {
                const tactical = scoreTacticalMove(one.move, scoreContext, options);
                one.tacticalScore = tactical;
                if (tactical > bestTacticalScore) bestTacticalScore = tactical;
            }
        }
    }

    applyTeacherCommitteeToMoveScores(scoredMoves, options);

    const teacherCommitteeEnabled = (
        Number.isFinite(options && options.teacherCommitteeWeight) &&
        Number(options.teacherCommitteeWeight) > 0
    ) || (
        Number.isFinite(options && options.teacherCommitteeConsensusBonus) &&
        Number(options.teacherCommitteeConsensusBonus) > 0
    );
    let selected: any = preliminarySelected;
    if (teacherCommitteeEnabled || !selected) {
        selected = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const one of scoredMoves) {
            const score = Number(one && one.finalScore) || 0;
            if (score > bestScore) {
                bestScore = score;
                selected = one;
                continue;
            }
            if (score === bestScore && selected && CpuLv6LookaheadProfile.isSameMoveByCoord(selected.move, one.move) === false) {
                const bestRow = Number(selected.move && selected.move.row);
                const bestCol = Number(selected.move && selected.move.col);
                const row = Number(one.move && one.move.row);
                const col = Number(one.move && one.move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    selected = one;
                }
            }
        }
    }

    const sortedByFinalScore = scoredMoves
        .slice()
        .sort((a: any, b: any) => {
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
        .map((one: any) => ({
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
            committeeScore: Number(one && one.committeeScore) || 0,
            finalScore: Number(one && one.finalScore) || 0,
            committeeVotes: Number(one && one.committeeVotes) || 0
        }));

    const selectedCombined = Number(selected.combinedScore) || 0;
    const selectedTactical = Number(selected.tacticalScore) || 0;
    const bestCombined = Number(bestCombinedScore) || 0;
    const bestTactical = Number(bestTacticalScore) || 0;
    const compositeScoreMiss = Math.max(0, bestCombined - selectedCombined);
    const tacticalMissMetrics = computePositiveOpportunityMissMetrics(bestTactical, selectedTactical);

    return {
        move: selected.move,
        metrics: {
            selectedCompositeScore: selectedCombined,
            bestCompositeScore: bestCombined,
            compositeScoreMiss,
            compositeScoreMissRatio: compositeScoreMiss / Math.max(1, Math.abs(bestCombined)),
            selectedTacticalScore: selectedTactical,
            bestTacticalScore: bestTactical,
            tacticalScoreMiss: tacticalMissMetrics.miss,
            tacticalScoreMissRatio: tacticalMissMetrics.ratio,
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

function evaluatePositionValue(row: any, col: any, boardOrSize: any = 8) {
    let score = 0;
    if (isCorner(row, col, boardOrSize)) score += 10000;
    else if (isEdge(row, col, boardOrSize)) score += 250;
    if (isXSquare(row, col, boardOrSize)) score -= 600;
    if (isCSquare(row, col, boardOrSize)) score -= 300;
    return score;
}

function getCellOwnerValueForSelfplay(gameState: any, row: any, col: any) {
    if (!gameState) return 0;
    const board = getSelfplayBoard(gameState);
    const value = getBoardCellValue(board, row, col);
    return Number(value) || 0;
}

const {
    getLegalMovesForAction,
    getDirectUsableCardIds,
    buildCardDecisionContext
} = SelfplayDecisionContext.createSelfplayDecisionContext({
    Core,
    CardLogic,
    CpuPolicyCore,
    toPlayerValue,
    getSafeCardContext,
    readSelfplayPendingEffect,
    buildCornerPlanState,
    getBoardBonusAtCell,
    countDiscsByValue,
    countEmpties
});

const {
    selectCardIdToUse,
    selectDestroyHandCardId
} = SelfplayCardChoice.createSelfplayCardChoice({
    CardLogic,
    CpuPolicyCore,
    getDirectUsableCardIds,
    buildCardDecisionContext,
    resolveCardType,
    getPolicyActionScoreByKey,
    applyTeacherCommitteeToCardCandidates,
    readSelfplayPendingEffect
});

const {
    chooseSwapTarget,
    choosePositionSwapTarget,
    chooseDestroyTarget
} = SelfplayBasicTargetChoosers.createSelfplayBasicTargetChoosers({
    CardLogic,
    choosePendingTargetByScore,
    evaluatePositionValue,
    toPlayerValue,
    getCellOwnerValueForSelfplay
});

const {
    chooseGuardTarget,
    chooseLivingWillTarget,
    chooseBoardExpansionTarget,
    chooseBoardShrinkTarget,
    chooseBlockadeTarget,
    chooseFreezeTarget,
    chooseSeedTarget
} = SelfplaySimpleSimulationChoosers.createSelfplaySimpleSimulationChoosers({
    CardLogic,
    chooseTargetBySimulation,
    evaluatePositionValue,
    readSelfplayPendingEffect,
    getSelfplayBoard,
    getCornerProximity,
    getBoardCellValue,
    isEdge
});

const {
    chooseStrongWindTarget,
    chooseSuperBuoyancyTarget,
    chooseSuperGravityTarget,
    chooseMeteorTarget,
    chooseTrapTarget,
    chooseCloneTarget,
    chooseHyperactiveInheritTarget,
    chooseTeleportTarget,
    chooseCellTeleportTarget,
    chooseExtendLifeTarget
} = SelfplayAdvancedSimulationChoosers.createSelfplayAdvancedSimulationChoosers({
    CardLogic,
    chooseTargetBySimulation,
    evaluatePositionValue,
    toPlayerValue,
    getCellOwnerValueForSelfplay,
    isCorner,
    isEdge,
    isXSquare,
    getBoardBonusAtCell
});

const {
    chooseCorrosionTarget,
    chooseTemptTarget,
    chooseCaptureTarget,
    chooseTimeBombTarget
} = SelfplayScoreTargetChoosers.createSelfplayScoreTargetChoosers({
    CardLogic,
    choosePendingTargetByScore,
    evaluatePositionValue,
    toPlayerValue,
    getCellOwnerValueForSelfplay,
    isCorner,
    isEdge,
    countDiscsByValue
});

const {
    chooseSellCardTarget
} = SelfplaySellCardChoice.createSelfplaySellCardChoice({
    CpuPolicyCore,
    CardLogic,
    getLegalMovesForAction,
    buildCardDecisionContext
});

const {
    decideCardUsageAction
} = SelfplayCardUsageDecision.createSelfplayCardUsageDecision({
    selectDestroyHandCardId,
    selectCardIdToUse,
    CpuPolicyCore,
    CardLogic,
    buildCardDecisionContext
});

const {
    decidePlacementAction
} = SelfplayPlacementDecision.createSelfplayPlacementDecision({
    Core,
    toPlayerValue,
    getSafeCardContext,
    scorePlacementCandidates
});

const {
    buildPendingSelectionAction
} = SelfplayPendingSelectionBridge.createSelfplayPendingSelectionBridge({
    PendingTargetSelector,
    selectors: {
        chooseSwapTarget,
        choosePositionSwapTarget,
        chooseDestroyTarget,
        chooseStrongWindTarget,
        chooseSuperBuoyancyTarget,
        chooseSuperGravityTarget,
        chooseSellCardTarget,
        chooseTemptTarget,
        chooseCaptureTarget,
        chooseTimeBombTarget,
        chooseGuardTarget,
        chooseLivingWillTarget,
        chooseBoardExpansionTarget,
        chooseBoardShrinkTarget,
        chooseBlockadeTarget,
        chooseMeteorTarget,
        chooseFreezeTarget,
        chooseSeedTarget,
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
    CpuPolicyCore,
    CardLogic
});

const {
    decidePendingAction
} = SelfplayPendingActionDecision.createSelfplayPendingActionDecision({
    buildPendingSelectionAction
});

function decideAction(gameState: any, cardState: any, playerKey: any, rng: any, options: any, snapshot: any) {
    const decisionState = snapshot || { gameState, cardState };
    const activeGameState = decisionState.gameState || gameState;
    const activeCardState = decisionState.cardState || cardState;
    const pending = readSelfplayPendingEffect(activeCardState, playerKey);
    const legalMoves = getLegalMovesForAction(activeGameState, activeCardState, playerKey);
    const forcedPlacement = resolveForcedPlacementCandidates(legalMoves, options, getSelfplayBoard(activeGameState, activeCardState));
    const mustTakePriorityPlacement = !!forcedPlacement.category;

    const pendingDecision = decidePendingAction({
        activeGameState,
        activeCardState,
        playerKey,
        pending,
        rng,
        legalMoves
    });
    if (pendingDecision) {
        return pendingDecision;
    }

    const cardUsageDecision = decideCardUsageAction({
        activeGameState,
        activeCardState,
        playerKey,
        options,
        pending,
        legalMoves,
        mustTakePriorityPlacement,
        rng
    });
    if (cardUsageDecision) {
        return cardUsageDecision;
    }

    return decidePlacementAction({
        activeGameState,
        activeCardState,
        playerKey,
        pending,
        legalMoves,
        rng,
        options
    });
}

function resolveWinner(gameState: any) {
    const counts = Core.countDiscs(gameState);
    if (counts.black > counts.white) return { winner: 'black', counts };
    if (counts.white > counts.black) return { winner: 'white', counts };
    return { winner: 'draw', counts };
}


function createAction(decision: any, gameIndex: any, actionCounter: any, turnIndex: any) {
    return {
        action: Object.assign({}, decision.action, {
            actionId: `sp-${gameIndex}-${actionCounter}`,
            turnIndex
        }),
        actionType: decision.action.type
    };
}

function applyActionSafe(state: any, playerKey: any, action: any) {
    const skipTurnStart = state.skipTurnStartForNextAction === true;
    state.skipTurnStartForNextAction = false;
    return TurnPipeline.applyTurnSafe(
        state.cardState,
        state.gameState,
        playerKey,
        action,
        state.prng,
        {
            currentStateVersion: state.stateVersion,
            skipTurnStart
        }
    );
}

const {
    applyDecisionSnapshotBaseline,
    applyRejectedTurnStartBaseline,
    getPendingSelectionState,
    buildRetryFallbackDecision,
    listFallbackPlacementActions,
    getPlacementFlipsBeforeApply,
    tryFallbackPlacementsFromSnapshot,
    buildIllegalMoveHardcase,
    attachSelfplayHardcase
} = SelfplayRetryHelpers.createSelfplayRetryHelpers({
    deepClone,
    clonePrng,
    readSelfplayPendingEffect,
    buildPendingSelectionAction,
    getLegalMovesForAction,
    resolveForcedPlacementCandidates,
    getSelfplayBoard,
    CardLogic,
    Core,
    toPlayerValue,
    getSafeCardContext,
    toPlayerKey,
    createAction,
    applyActionSafe
});

function applyDecisionWithRetry(state: any, gameIndex: any, ply: any, playerKey: any, options: any, actionCounterRef: any) {
    const firstSnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
    const firstDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, options, firstSnapshot);
    actionCounterRef.value += 1;
    const first = createAction(firstDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    applyDecisionSnapshotBaseline(state, firstSnapshot, state.stateVersion);
    let result = applyActionSafe(state, playerKey, first.action);
    if (result.ok) {
        return { decision: firstDecision, action: first.action, result, decisionContext: firstSnapshot };
    }

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

    // Retry from the pre-action turn-start snapshot. applyTurnSafe returns a clone
    // that may contain partially applied turn/card mutations after a rejection.
    // Reusing that rejected clone can drift currentPlayer and poison long self-play.
    applyDecisionSnapshotBaseline(state, firstSnapshot, result.nextStateVersion);

    const retryOpts = Object.assign({}, options);
    if (first.actionType === 'use_card') retryOpts.allowCardUsage = false;
    if (first.actionType === 'destroy_hand_card') retryOpts.allowHandDestroy = false;
    const retrySnapshot = firstSnapshot;
    const retryDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, retryOpts, retrySnapshot);
    actionCounterRef.value += 1;
    const retry = createAction(retryDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    applyDecisionSnapshotBaseline(state, retrySnapshot, state.stateVersion);
    result = applyActionSafe(state, playerKey, retry.action);
    if (!result.ok) {
        // Last-resort safety net: force a deterministic legal action so long training loops do not crash.
        applyDecisionSnapshotBaseline(state, retrySnapshot, result.nextStateVersion);

        const fallbackSnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
        const fallbackDecision = buildRetryFallbackDecision(
            fallbackSnapshot.gameState,
            fallbackSnapshot.cardState,
            playerKey,
            state.prng,
            options
        );
        const fallbackStateVersion = state.stateVersion;

        actionCounterRef.value += 1;
        const forced = createAction(fallbackDecision, gameIndex, actionCounterRef.value, state.stateVersion);
        applyDecisionSnapshotBaseline(state, fallbackSnapshot, state.stateVersion);
        const forcedPendingBefore = CardLogic.getPendingEffectType(state.cardState, playerKey) || null;
        const forcedFlipsBefore = (
            forced.action &&
            forced.action.type === 'place' &&
            !CardLogic.isFreePlacementPendingType(forcedPendingBefore)
        )
            ? Core.getFlipsWithContext(
                state.gameState,
                forced.action.row,
                forced.action.col,
                toPlayerValue(playerKey),
                getSafeCardContext(state.cardState)
            ).length
            : null;
        const forcedResult = applyActionSafe(state, playerKey, forced.action);
        if (forcedResult.ok) {
            return { decision: fallbackDecision, action: forced.action, result: forcedResult, decisionContext: fallbackSnapshot };
        }

        const placementFallback = tryFallbackPlacementsFromSnapshot(
            state,
            fallbackSnapshot,
            fallbackStateVersion,
            fallbackDecision,
            gameIndex,
            actionCounterRef,
            playerKey
        );
        if (placementFallback.ok) {
            return {
                decision: placementFallback.decision,
                action: placementFallback.action,
                result: placementFallback.result,
                decisionContext: fallbackSnapshot
            };
        }

        const forcedErrMsg = String(forcedResult.errorMessage || '');
        if (forced.action && forced.action.type === 'pass' && forcedErrMsg.includes('Illegal pass')) {
            applyRejectedTurnStartBaseline(state, forcedResult);
            const passRejectedFallback = buildRetryFallbackDecision(
                state.gameState,
                state.cardState,
                playerKey,
                state.prng,
                options
            );
            const passRejectedMoves = Array.isArray(passRejectedFallback.legalMoves)
                ? passRejectedFallback.legalMoves.filter((move: any) => (
                    move &&
                    Number.isInteger(move.row) &&
                    Number.isInteger(move.col)
                ))
                : [];
            const passRejectedSnapshot = {
                gameState: state.gameState,
                cardState: state.cardState,
                prng: state.prng,
                turnStartApplied: true
            };
            const passRejectedStateVersion = state.stateVersion;
            const passRejectedPlacement = tryFallbackPlacementsFromSnapshot(
                state,
                passRejectedSnapshot,
                passRejectedStateVersion,
                Object.assign({}, passRejectedFallback, { legalMoves: passRejectedMoves }),
                gameIndex,
                actionCounterRef,
                playerKey
            );
            if (passRejectedPlacement.ok) {
                return {
                    decision: passRejectedPlacement.decision,
                    action: passRejectedPlacement.action,
                    result: passRejectedPlacement.result,
                    decisionContext: passRejectedSnapshot
                };
            }
        }

        const msg = forcedResult.errorMessage || result.errorMessage || '';
        const fallbackCurrentPlayer = toPlayerKey(fallbackSnapshot.gameState.currentPlayer);
        const hardcase = buildIllegalMoveHardcase({
            gameIndex,
            ply,
            playerKey,
            first,
            retry,
            forced,
            forcedResult,
            forcedPendingBefore,
            forcedFlipsBefore,
            fallbackSnapshot,
            fallbackStateVersion,
            fallbackDecision,
            placementFallback
        });
        const error = new Error(
            `[SELFPLAY] action rejected game=${gameIndex} ply=${ply} action=${retry.actionType} ` +
            `reason=${forcedResult.rejectedReason || result.rejectedReason || 'UNKNOWN'} ` +
            `first=${first.actionType}:${first.action.type} retry=${retry.actionType}:${retry.action.type} ` +
            `forced=${forced.action.type}:${Number.isFinite(forced.action.row) ? forced.action.row : 'na'},${Number.isFinite(forced.action.col) ? forced.action.col : 'na'} ` +
            `pending=${forcedPendingBefore || 'none'} current=${fallbackCurrentPlayer} player=${playerKey} flipsBefore=${forcedFlipsBefore === null ? 'na' : forcedFlipsBefore} ` +
            `legal=${Array.isArray(fallbackDecision.legalMoves) ? fallbackDecision.legalMoves.length : 'na'} ` +
            `attemptedPlacements=${placementFallback.attemptedPlacements} skippedInvalidPlacements=${placementFallback.skippedInvalidPlacements} ` +
            `lastPlacementFlipsBefore=${placementFallback.flipsBefore === null ? 'na' : placementFallback.flipsBefore} ${msg}`
        );
        throw attachSelfplayHardcase(error, hardcase);
    }
    return { decision: retryDecision, action: retry.action, result, decisionContext: retrySnapshot };
}

function runSingleGame(gameIndex: any, seed: any, options: any) {
    const normalizedOptions = normalizeOptions(options);
    const state = createInitialState(seed, normalizedOptions);
    const gameRecords = [];
    const actionCounterRef = { value: 0 };

    for (let ply = 0; ply < normalizedOptions.maxPlies; ply++) {
        if (Core.isGameOver(state.gameState)) break;

        const playerKey = toPlayerKey(state.gameState.currentPlayer);
        const playerPolicy = getPolicyForPlayer(normalizedOptions, playerKey);
        const preDecisionCardState = state.cardState;

        const execution = applyDecisionWithRetry(state, gameIndex, ply, playerKey, playerPolicy, actionCounterRef);
        const decisionCardState = execution.decisionContext && execution.decisionContext.cardState
            ? execution.decisionContext.cardState
            : state.cardState;
        const decisionGameState = execution.decisionContext && execution.decisionContext.gameState
            ? execution.decisionContext.gameState
            : state.gameState;
        const pendingType = CardLogic.getPendingEffectType(decisionCardState, playerKey);
        const countsBefore = Core.countDiscs(decisionGameState);
        const boardBefore = encodeMainBoard(decisionGameState.board);
        const runtimeBoardBefore = getSelfplayBoard(decisionGameState, decisionCardState);
        const boardEnvelope = encodeBoard(runtimeBoardBefore);
        const boardBounds = (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardBounds === 'function')
            ? SharedBoardUtils.resolveBoardBounds(runtimeBoardBefore)
            : null;
        const turnNumberBefore = decisionGameState.turnNumber || 0;
        const handCards = decisionCardState && decisionCardState.hands && Array.isArray(decisionCardState.hands[playerKey])
            ? decisionCardState.hands[playerKey].slice()
            : [];
        let usableCardIds: any[] = [];
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
        const deckStats = getDeckStatsForPlayer(preDecisionCardState, playerKey);

        const record: any = {
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
            legalMoves: decision.legalMoves.length,
            pendingType: pendingType || null,
            handBlack: state.cardState.hands.black.length,
            handWhite: state.cardState.hands.white.length,
            chargeBlack: state.cardState.charge.black || 0,
            chargeWhite: state.cardState.charge.white || 0,
            deckCount: deckStats.ownDeckCount,
            ownDeckCount: deckStats.ownDeckCount,
            initialDeckSize: deckStats.initialDeckSize,
            discardCount: state.cardState.discard.length,
            blackCountBefore: countsBefore.black,
            whiteCountBefore: countsBefore.white,
            board: boardBefore,
            boardEnvelope,
            boardMinRow: boardBounds && Number.isFinite(boardBounds.minRow) ? Number(boardBounds.minRow) : 0,
            boardMinCol: boardBounds && Number.isFinite(boardBounds.minCol) ? Number(boardBounds.minCol) : 0,
            ownCornersBefore: Number(planStateBefore.ownCorners || 0),
            oppCornersBefore: Number(planStateBefore.oppCorners || 0),
            ownEdgesBefore: Number(planStateBefore.ownEdges || 0),
            oppEdgesBefore: Number(planStateBefore.oppEdges || 0),
            ownEdgeChainStrengthBefore: Number(planStateBefore.ownEdgeChainStrength || 0),
            oppEdgeChainStrengthBefore: Number(planStateBefore.oppEdgeChainStrength || 0),
            ownLongestEdgeRunBefore: Number(planStateBefore.ownLongestEdgeRun || 0),
            oppLongestEdgeRunBefore: Number(planStateBefore.oppLongestEdgeRun || 0),
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
            selectedCommitteeScore: placementMetrics && Number.isFinite(placementMetrics.selectedCommitteeScore)
                ? Number(placementMetrics.selectedCommitteeScore)
                : null,
            selectedCommitteeVotes: placementMetrics && Number.isFinite(placementMetrics.selectedCommitteeVotes)
                ? Number(placementMetrics.selectedCommitteeVotes)
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
        if (decision && decision.cardDecision && typeof decision.cardDecision === 'object') {
            record.selectedActionKey = typeof decision.cardDecision.selectedActionKey === 'string'
                ? decision.cardDecision.selectedActionKey
                : null;
            record.decisionCandidates = Array.isArray(decision.cardDecision.candidates)
                ? decision.cardDecision.candidates.map((one: any) => Object.assign({}, one))
                : [];
            record.decisionReasonTags = Array.isArray(decision.cardDecision.reasonTags)
                ? decision.cardDecision.reasonTags.slice()
                : [];
            record.decisionScoreSummary = (
                decision.cardDecision.scoreSummary &&
                typeof decision.cardDecision.scoreSummary === 'object'
            )
                ? Object.assign({}, decision.cardDecision.scoreSummary)
                : null;
        }
        record.topPlacementCandidates = placementMetrics && Array.isArray(placementMetrics.topCandidates)
            ? placementMetrics.topCandidates.map((one: any) => Object.assign({}, one))
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
        record.ownEdgeChainStrengthAfter = Number(planStateAfter.ownEdgeChainStrength || 0);
        record.oppEdgeChainStrengthAfter = Number(planStateAfter.oppEdgeChainStrength || 0);
        record.ownLongestEdgeRunAfter = Number(planStateAfter.ownLongestEdgeRun || 0);
        record.oppLongestEdgeRunAfter = Number(planStateAfter.oppLongestEdgeRun || 0);

        gameRecords.push(record);
    }

    const maxPlyReached = !Core.isGameOver(state.gameState) && gameRecords.length >= normalizedOptions.maxPlies;

    annotateHorizonDecisionMetrics(gameRecords, 3);
    annotateSelfplayV2Metadata(gameRecords, normalizedOptions);

    const resolved = resolveWinner(state.gameState);
    const finalCornerControl = countCornerControl(state.gameState.board, Core.BLACK);
    const finalEdgeControl = countEdgeControl(state.gameState.board, Core.BLACK);
    const finalRuntimeBoard = getSelfplayBoard(state.gameState, state.cardState);
    const finalBlackEdgeRun = (
        SharedBoardUtils &&
        typeof SharedBoardUtils.summarizeEdgeRuns === 'function'
    )
        ? SharedBoardUtils.summarizeEdgeRuns(finalRuntimeBoard, Core.BLACK)
        : null;
    const finalWhiteEdgeRun = (
        SharedBoardUtils &&
        typeof SharedBoardUtils.summarizeEdgeRuns === 'function'
    )
        ? SharedBoardUtils.summarizeEdgeRuns(finalRuntimeBoard, Core.WHITE)
        : null;
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
            blackLongestEdgeRun: Number(finalBlackEdgeRun && finalBlackEdgeRun.longestRun) || 0,
            whiteLongestEdgeRun: Number(finalWhiteEdgeRun && finalWhiteEdgeRun.longestRun) || 0,
            maxEdgeLineLength: Math.max(
                Number(finalBlackEdgeRun && finalBlackEdgeRun.maxLineLength) || 0,
                Number(finalWhiteEdgeRun && finalWhiteEdgeRun.maxLineLength) || 0
            ),
            endedBy: maxPlyReached ? 'max_plies' : 'game_over'
        }
    };
}

const {
    buildSelfplayRetrySeed,
    runSingleGameWithRetries
} = SelfplayRetryController.createSelfplayRetryController({
    runSingleGame
});

const {
    runSelfPlayGames
} = SelfplayBatchRunner.createSelfplayBatchRunner({
    normalizeOptions,
    buildPerGamePolicySet,
    runSingleGameWithRetries
});

export {
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
