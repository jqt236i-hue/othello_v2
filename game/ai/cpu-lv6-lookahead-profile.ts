// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

/**
 * @file cpu-lv6-lookahead-profile.js
 * @description Shared Lv6 lookahead profile helpers for browser/headless parity.
 */



let BoardUtils = null;
if (typeof require === 'function') {
    try { BoardUtils = require('../cpu-decision-board-utils'); } catch (e) { /* ignore */ }
}

let sharedProfile = null;
if (typeof require === 'function') {
    try { sharedProfile = require('../../constants/cpu-lv6-shared-profile.js'); } catch (e) { /* ignore */ }
}

let CpuPolicyCore = null;
if (typeof require === 'function') {
    try { CpuPolicyCore = require('./cpu-policy-core'); } catch (e) { /* ignore */ }
}

let CpuLv6RuntimeCapabilityModule = null;
if (typeof require === 'function') {
    try { CpuLv6RuntimeCapabilityModule = require('../../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}

const countBoardEmpties = (BoardUtils && typeof BoardUtils.countBoardEmpties === 'function')
    ? BoardUtils.countBoardEmpties
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

const isCornerCell = (BoardUtils && typeof BoardUtils.isCornerCell === 'function')
    ? BoardUtils.isCornerCell
    : function isCornerCellFallback(row, col, board) {
        if (!Array.isArray(board) || board.length <= 0) return false;
        const maxRow = board.length - 1;
        const maxCol = Array.isArray(board[0]) ? board[0].length - 1 : maxRow;
        return (row === 0 || row === maxRow) && (col === 0 || col === maxCol);
    };

const isEdgeCell = (BoardUtils && typeof BoardUtils.isEdgeCell === 'function')
    ? BoardUtils.isEdgeCell
    : function isEdgeCellFallback(row, col, board) {
        if (!Array.isArray(board) || board.length <= 0) return false;
        const maxRow = board.length - 1;
        const maxCol = Array.isArray(board[0]) ? board[0].length - 1 : maxRow;
        return row === 0 || row === maxRow || col === 0 || col === maxCol;
    };

function resolveCpuLv6SharedProfile() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CPU_LV6_SHARED_PROFILE && typeof globalThis.CPU_LV6_SHARED_PROFILE === 'object') {
            return globalThis.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    return sharedProfile && typeof sharedProfile === 'object' ? sharedProfile : null;
}

function resolveCpuLv6RuntimeCapabilityModule() {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.CpuLv6RuntimeCapability &&
            typeof globalThis.CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
        ) {
            return globalThis.CpuLv6RuntimeCapability;
        }
    } catch (e) { /* ignore */ }
    return CpuLv6RuntimeCapabilityModule && typeof CpuLv6RuntimeCapabilityModule === 'object'
        ? CpuLv6RuntimeCapabilityModule
        : null;
}

function resolveCpuLv6BrowserProfile() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6BrowserProfile === 'function') {
        return capabilityModule.resolveCpuLv6BrowserProfile(shared);
    }
    return shared && shared.browser && typeof shared.browser === 'object'
        ? shared.browser
        : null;
}

function resolveCpuLv6TeacherProfile() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6TeacherProfile === 'function') {
        return capabilityModule.resolveCpuLv6TeacherProfile(shared);
    }
    return shared && shared.teacher && typeof shared.teacher === 'object'
        ? shared.teacher
        : null;
}

function normalizeTeacherLookaheadOverrides(runtimeOverrides) {
    if (!runtimeOverrides || typeof runtimeOverrides !== 'object') return null;

    const normalized = {};
    if (Number.isFinite(runtimeOverrides.tacticalDepthOpening)) {
        normalized.tacticalDepthOpening = Math.max(1, Math.floor(Number(runtimeOverrides.tacticalDepthOpening)));
    }
    if (Number.isFinite(runtimeOverrides.tacticalDepthMid)) {
        normalized.tacticalDepthMid = Math.max(1, Math.floor(Number(runtimeOverrides.tacticalDepthMid)));
    }
    if (Number.isFinite(runtimeOverrides.tacticalDepthEnd)) {
        normalized.tacticalDepthEnd = Math.max(1, Math.floor(Number(runtimeOverrides.tacticalDepthEnd)));
    }
    if (Number.isFinite(runtimeOverrides.tacticalBeamWidth)) {
        normalized.tacticalBeamWidth = Math.max(1, Math.floor(Number(runtimeOverrides.tacticalBeamWidth)));
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
}

function resolveLv6LookaheadTimeCaps(playerKey, runtimeMode) {
    const isWhite = String(playerKey || '') === 'white';
    const mode = String(runtimeMode || '').trim().toLowerCase();
    if (mode === 'teacher') {
        const teacherProfile = resolveCpuLv6TeacherProfile();
        const teacherCaps = teacherProfile && teacherProfile.lookaheadTimeCaps && typeof teacherProfile.lookaheadTimeCaps === 'object'
            ? teacherProfile.lookaheadTimeCaps
            : null;
        if (teacherCaps) {
            return {
                moveCapMs: Number(teacherCaps.moveCapMs) || 80,
                endgameCapMs: Number(teacherCaps.endgameCapMs) || 160,
                quiescenceMoveCapMs: Number(teacherCaps.moveCapMs) || 80,
                quiescenceEndgameCapMs: Number(teacherCaps.endgameCapMs) || 160,
                quiescenceEndgameMinMs: Math.min(Number(teacherCaps.endgameCapMs) || 160, Number(teacherCaps.moveCapMs) || 80)
            };
        }
    }
    const isUi = mode === 'ui' || mode === 'browser-ui';
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configuredCaps = browserProfile && browserProfile.lookaheadTimeCaps && typeof browserProfile.lookaheadTimeCaps === 'object'
        ? browserProfile.lookaheadTimeCaps
        : null;
    if (configuredCaps) {
        if (isWhite && isUi && configuredCaps.whiteUi) return configuredCaps.whiteUi;
        if (isWhite && configuredCaps.whiteHeadless) return configuredCaps.whiteHeadless;
        if (configuredCaps.black) return configuredCaps.black;
    }
    if (isWhite && isUi) {
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

function buildLv6LookaheadOptions(level, board, legalMovesCount, playerKey, runtimeMode, runtimeOverrides) {
    if (!Number.isFinite(level) || level < 6) return {};
    const mode = String(runtimeMode || '').trim().toLowerCase();
    const teacherProfile = mode === 'teacher' ? resolveCpuLv6TeacherProfile() : null;
    const teacherLookaheadOverrides = mode === 'teacher'
        ? normalizeTeacherLookaheadOverrides(runtimeOverrides)
        : null;
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
    const teacherStageConfig = (
        teacherProfile &&
        Number.isFinite(
            teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthOpening)
                ? teacherLookaheadOverrides.tacticalDepthOpening
                : teacherProfile.tacticalDepthOpening
        ) &&
        Number.isFinite(
            teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthMid)
                ? teacherLookaheadOverrides.tacticalDepthMid
                : teacherProfile.tacticalDepthMid
        ) &&
        Number.isFinite(
            teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthEnd)
                ? teacherLookaheadOverrides.tacticalDepthEnd
                : teacherProfile.tacticalDepthEnd
        )
    )
        ? {
            opening: {
                maxOccupiedRatio: 0.28,
                depth: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthOpening)
                        ? teacherLookaheadOverrides.tacticalDepthOpening
                        : teacherProfile.tacticalDepthOpening
                ) || 4)),
                maxBranch: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalBeamWidth)
                        ? teacherLookaheadOverrides.tacticalBeamWidth
                        : teacherProfile.tacticalBeamWidth
                ) || 6)),
                nodeBudgetBase: 1_000_000,
                maxTimeBaseMs: 90
            },
            mid: {
                maxOccupiedRatio: 0.62,
                depth: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthMid)
                        ? teacherLookaheadOverrides.tacticalDepthMid
                        : teacherProfile.tacticalDepthMid
                ) || 6)),
                maxBranch: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalBeamWidth)
                        ? teacherLookaheadOverrides.tacticalBeamWidth
                        : teacherProfile.tacticalBeamWidth
                ) || 6)),
                nodeBudgetBase: 1_600_000,
                maxTimeBaseMs: 120
            },
            end: {
                depth: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalDepthEnd)
                        ? teacherLookaheadOverrides.tacticalDepthEnd
                        : teacherProfile.tacticalDepthEnd
                ) || 7)),
                maxBranch: Math.max(1, Math.floor(Number(
                    teacherLookaheadOverrides && Number.isFinite(teacherLookaheadOverrides.tacticalBeamWidth)
                        ? teacherLookaheadOverrides.tacticalBeamWidth
                        : teacherProfile.tacticalBeamWidth
                ) || 6)),
                nodeBudgetBase: 2_400_000,
                maxTimeBaseMs: 180
            }
        }
        : null;
    const stageConfig = mode === 'teacher'
        ? teacherStageConfig
        : (browserProfile && browserProfile.lookaheadStages && typeof browserProfile.lookaheadStages === 'object'
            ? browserProfile.lookaheadStages
            : null);
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
    const budgetScale = mode === 'teacher'
        ? Math.max(0.01, Math.min(1, Number(teacherProfile && teacherProfile.lookaheadBudgetScale) || 0.05))
        : 1;
    const nodeBudget = Math.floor(resolvedNodeBudgetBase * sizeScale * budgetScale);
    const timeCaps = resolveLv6LookaheadTimeCaps(playerKey, mode);
    const maxTimeMs = Math.min(
        Math.floor(resolvedMaxTimeBase * sizeScale * movePressure),
        timeCaps.moveCapMs
    );
    const endgameConfig = mode === 'teacher'
        ? {
            solveEmptiesOpeningMid: 32,
            solveEmptiesEnd: 36,
            depthOpeningMid: 24,
            depthEnd: 28,
            nodeBudgetBase: 8_000_000,
            maxTimeBaseMs: 600
        }
        : (browserProfile && browserProfile.endgameLookahead && typeof browserProfile.endgameLookahead === 'object'
            ? browserProfile.endgameLookahead
            : null);
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
        endgameNodeBudget: Math.floor((Number.isFinite(endgameNodeBudgetBase) && endgameNodeBudgetBase > 0 ? endgameNodeBudgetBase : 4_000_000) * sizeScale * budgetScale),
        endgameMaxTimeMs: Math.min(
            Math.floor((Number.isFinite(endgameMaxTimeBase) && endgameMaxTimeBase > 0 ? endgameMaxTimeBase : 1_600) * sizeScale),
            timeCaps.endgameCapMs
        )
    };
}

function resolveLv6LookaheadWeights() {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6LookaheadWeights === 'function') {
        return capabilityModule.resolveCpuLv6LookaheadWeights(shared);
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configured = browserProfile && browserProfile.lookaheadWeights && typeof browserProfile.lookaheadWeights === 'object'
        ? browserProfile.lookaheadWeights
        : null;
    return {
        onnxRefinePriorWeight: Number(configured && configured.onnxRefinePriorWeight) || 66,
        policyLookaheadPriorWeight: Number(configured && configured.policyLookaheadPriorWeight) || 62,
        searchWeight: Number(configured && configured.searchWeight) || 1.8
    };
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

function getBoardBonusValueAt(row, col, boardBonusByCell, boardBonusConsumedByCell) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const key = `${row},${col}`;
    if (boardBonusConsumedByCell && boardBonusConsumedByCell[key] === true) return 0;
    const raw = Number(boardBonusByCell && boardBonusByCell[key] ? boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
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

function maybeOverrideWithStrictPendingPlacement(selectedMove, candidateMoves, pendingType, movePlanScoreFn, board, boardBonusByCell, boardBonusConsumedByCell) {
    if (!selectedMove || !Array.isArray(candidateMoves) || candidateMoves.length <= 1) return selectedMove;
    if (typeof movePlanScoreFn !== 'function') return selectedMove;
    if (!shouldRespectPendingPlacementPlanStrictly(pendingType)) return selectedMove;

    const selectedRow = Number(selectedMove.row);
    const selectedCol = Number(selectedMove.col);
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
    if (isSameMoveByCoord(bestAnchoredMove, selectedMove)) return selectedMove;

    const planGap = bestAnchoredScore - selectedPlanScore;
    const selectedBonus = getBoardBonusValueAt(selectedRow, selectedCol, boardBonusByCell, boardBonusConsumedByCell);
    const anchoredBonus = getBoardBonusValueAt(Number(bestAnchoredMove.row), Number(bestAnchoredMove.col), boardBonusByCell, boardBonusConsumedByCell);
    const threshold = selectedAnchored ? 2200 : 3000;
    if (planGap < threshold) return selectedMove;

    if ((selectedBonus - anchoredBonus) >= 5 && planGap < 5500) {
        return selectedMove;
    }

    return bestAnchoredMove;
}

export = {
    buildLv6LookaheadOptions,
    resolveLv6LookaheadWeights,
    resolveCandidateMoveByCoord,
    maybeOverrideWithStrictPendingPlacement,
    isSameMoveByCoord
};
