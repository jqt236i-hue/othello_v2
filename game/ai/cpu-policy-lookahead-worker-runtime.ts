/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Static ESM composition root for the CPU lookahead used by Dedicated Workers.
 *
 * cpu-policy-core.ts intentionally keeps a CommonJS-compatible loader for the
 * classic/headless surfaces. A module Worker cannot resolve that dynamic
 * require graph, so this file composes the same pure factories through static
 * imports. It owns no gameplay or presentation state.
 */

import CpuPolicyBoardPrimitivesModule = require('./cpu-policy-board-primitives.js');
import { createCpuPolicyBoardCounts } from './cpu-policy-board-counts';
import { createCpuPolicyBoardFeatures } from './cpu-policy-board-features';
import { createCpuPolicyLookaheadConfig } from './cpu-policy-lookahead-config';
import { createCpuPolicyLookaheadBonus } from './cpu-policy-lookahead-bonus';
import { createCpuPolicyLookaheadParity } from './cpu-policy-lookahead-parity';
import { createCpuPolicySearchKey } from './cpu-policy-search-key';
import { createCpuPolicyLookaheadEvaluation } from './cpu-policy-lookahead-evaluation';
import { createCpuPolicyPlacementProfiles } from './cpu-policy-placement-profiles';
import { createCpuPolicyPlacementFeatures } from './cpu-policy-placement-features';
import { createCpuPolicyMovePlanScoring } from './cpu-policy-move-plan-scoring';
import { createCpuPolicySearchOrder } from './cpu-policy-search-order';
import { createCpuPolicyLookaheadGuards } from './cpu-policy-lookahead-guards';
import { createCpuPolicyLookaheadRootSearch } from './cpu-policy-lookahead-root-search';
import { createCpuPolicyLookaheadPrelude } from './cpu-policy-lookahead-prelude';
import { createCpuPolicyLookaheadNegamax } from './cpu-policy-lookahead-negamax';
import { createCpuPolicyLookaheadController } from './cpu-policy-lookahead-controller';
import { createCanonicalBoardEncoding } from '../../shared/board/canonical-encoding';
import { createBoardCorners } from '../../shared/board/corners';
import { createControlCounts } from '../../shared/board/control-counts';
import { createEdgeRuns } from '../../shared/board/edge-runs';
import { createLegalMoves } from '../../shared/board/legal-moves';
import { createRiskCells } from '../../shared/board/risk-cells';
import { createBoardSearchStateTools } from '../../shared/board/search-state';
import type { CpuPolicyBoard, CpuPolicyPosition } from './cpu-policy-core-types';

type CpuPolicyBoardShape = CpuPolicyBoard | number | null | undefined;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],            [0, 1],
    [1, -1],  [1, 0],   [1, 1]
];

export function createCpuWorkerBoardUtils() {
    const keyOf = (row: number, col: number) => `${row},${col}`;
    const searchState = createBoardSearchStateTools({
        empty: 0,
        black: 1,
        white: -1,
        directions: DIRECTIONS,
        toBoardCellKey: keyOf
    });
    const isContext = searchState.isBoardSearchContext;
    const readShape = (board: any): any => isContext(board) ? board.shape : null;
    const readMatrix = (board: any): any[] => isContext(board)
        ? board.board as any[]
        : (Array.isArray(board) ? board : []);
    const normalizeOwner = (value: unknown): number => value === 1 || value === -1 ? value : 0;
    const createBoardContext = searchState.createBoardContext;
    const readCoordinates = (board: any): Array<{ row: number; col: number }> => {
        if (isContext(board)) return searchState.collectBoardCoordinates(board);
        const coordinates: Array<{ row: number; col: number }> = [];
        const matrix = readMatrix(board);
        matrix.forEach((row: any, rowIndex: number) => {
            if (!Array.isArray(row)) return;
            row.forEach((_cell: any, colIndex: number) => coordinates.push({ row: rowIndex, col: colIndex }));
        });
        return coordinates;
    };
    const resolveBounds = (boardOrRows: any, maybeCols?: any) => {
        if (!Array.isArray(boardOrRows) && !isContext(boardOrRows)) {
            const rows = Number(boardOrRows);
            const cols = Number(maybeCols);
            if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) return null;
            return { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 };
        }
        const shape = readShape(boardOrRows);
        if (shape && [shape.minRow, shape.maxRow, shape.minCol, shape.maxCol].every(Number.isInteger)) {
            return { minRow: shape.minRow, maxRow: shape.maxRow, minCol: shape.minCol, maxCol: shape.maxCol };
        }
        const coordinates = readCoordinates(boardOrRows);
        if (coordinates.length <= 0) return null;
        return coordinates.reduce((bounds, cell) => ({
            minRow: Math.min(bounds.minRow, cell.row),
            maxRow: Math.max(bounds.maxRow, cell.row),
            minCol: Math.min(bounds.minCol, cell.col),
            maxCol: Math.max(bounds.maxCol, cell.col)
        }), {
            minRow: coordinates[0].row,
            maxRow: coordinates[0].row,
            minCol: coordinates[0].col,
            maxCol: coordinates[0].col
        });
    };
    const hasPlayableCell = (board: any, row: number, col: number): boolean => {
        if (isContext(board)) return searchState.hasPlayableCell(board, row, col);
        if (!Number.isInteger(row) || !Number.isInteger(col) || !Array.isArray(board)) return false;
        const matrix = readMatrix(board);
        return row >= 0 && row < matrix.length && Array.isArray(matrix[row]) && col >= 0 && col < matrix[row].length;
    };
    const getCellValue = (board: any, row: number, col: number): number | null => {
        if (isContext(board)) return searchState.getCellValue(board, row, col);
        if (!hasPlayableCell(board, row, col)) return null;
        const matrix = readMatrix(board);
        return Number(matrix[row][col] || 0);
    };
    const setCellValue = (board: any, row: number, col: number, owner: number): boolean => {
        if (isContext(board)) return searchState.setCellValue(board, row, col, owner);
        if ((owner !== 0 && owner !== 1 && owner !== -1) || !hasPlayableCell(board, row, col)) return false;
        const matrix = readMatrix(board);
        matrix[row][col] = owner;
        return true;
    };
    const setCellValues = (
        board: any,
        updates: Array<{ row: number; col: number; value: number }>
    ): boolean => {
        if (isContext(board)) return searchState.setCellValues(board, updates);
        if (!Array.isArray(updates)) return false;
        const seen = new Set<string>();
        for (const update of updates) {
            if (
                !update
                || !Number.isInteger(update.row)
                || !Number.isInteger(update.col)
                || (update.value !== 0 && update.value !== 1 && update.value !== -1)
                || !hasPlayableCell(board, update.row, update.col)
            ) {
                return false;
            }
            const key = keyOf(update.row, update.col);
            if (seen.has(key)) return false;
            seen.add(key);
        }
        for (const update of updates) {
            if (!setCellValue(board, update.row, update.col, update.value)) return false;
        }
        return true;
    };
    const cloneBoard = (board: any): any => {
        if (isContext(board)) return searchState.cloneBoardContext(board);
        const matrix = readMatrix(board);
        if (!matrix.length) return [];
        return matrix.map((row: any) => Array.isArray(row) ? row.slice() : []);
    };
    const cornerUtils = createBoardCorners({
        toBoardCellKey: keyOf,
        collectBoardCoordinates: readCoordinates,
        hasPlayableCell,
        resolveBoardBounds: resolveBounds,
        getShapeCacheKey: (board: any) => isContext(board)
            ? board.shape.playableKeys
            : null
    });
    const riskUtils = createRiskCells({
        toBoardCellKey: keyOf,
        collectBoardCoordinates: readCoordinates,
        hasPlayableCell,
        resolveBoardBounds: resolveBounds,
        getCornerCells: cornerUtils.getCornerCells,
        isCornerCell: cornerUtils.isCornerCell,
        isEdgeCell: cornerUtils.isEdgeCell,
        getShapeCacheKey: (board: any) => isContext(board)
            ? board.shape.playableKeys
            : null
    });
    const edgeRuns = createEdgeRuns({
        toBoardCellKey: keyOf,
        normalizeOwner,
        getCornerCells: cornerUtils.getCornerCells,
        hasPlayableCell,
        isCornerCell: cornerUtils.isCornerCell,
        isEdgeCell: cornerUtils.isEdgeCell,
        getCellValue
    });
    const controlCounts = createControlCounts({
        getCellValue,
        getCornerCells: cornerUtils.getCornerCells,
        collectBoardCoordinates: readCoordinates,
        isEdgeCell: cornerUtils.isEdgeCell,
        isCornerCell: cornerUtils.isCornerCell
    });
    const canonicalEncoding = createCanonicalBoardEncoding({
        resolveBoardBounds: resolveBounds,
        collectBoardCoordinates: readCoordinates,
        getCellValue
    });
    const legalMoves = createLegalMoves({
        empty: 0,
        directions: DIRECTIONS,
        hasPlayableCell,
        getCellValue,
        collectBoardCoordinates: readCoordinates
    });
    return {
        createBoardContext,
        cloneBoard,
        collectBoardCoordinates: readCoordinates,
        encodeBoard: canonicalEncoding.encodeBoard,
        getCellValue,
        setCellValue,
        setCellValues,
        hasPlayableCell,
        getFlipsBasic: legalMoves.getFlipsBasic,
        getLegalMovesBasic: legalMoves.getLegalMovesBasic,
        getCornerCells: cornerUtils.getCornerCells,
        getCornerProximity: riskUtils.getCornerProximity,
        isCorner: cornerUtils.isCornerCell,
        isEdge: cornerUtils.isEdgeCell,
        isXSquare: riskUtils.isXSquare,
        isCSquare: riskUtils.isCSquare,
        countCornerControl: controlCounts.countCornerControl,
        countEdgeControl: controlCounts.countEdgeControl,
        summarizeEdgeRuns: edgeRuns.summarizeEdgeRuns,
        countAdjacentLoneEdgeDiscs: edgeRuns.countAdjacentLoneEdgeDiscs
    };
}

function createLookaheadRuntime() {
    const SharedBoardUtils: any = createCpuWorkerBoardUtils();
    const primitives = CpuPolicyBoardPrimitivesModule.createCpuPolicyBoardPrimitives({
        SharedBoardUtils,
        isFiniteNumber
    });
    const {
        resolveBoardGeometry,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        scoreMoveHeuristic,
        inBoard,
        getLegalMovesBasic,
        applyMoveToBoard
    } = primitives;

    function adjacentCornerFor(
        row: number,
        col: number,
        boardOrRows?: CpuPolicyBoardShape,
        colsMaybe?: number | null
    ): CpuPolicyPosition | null {
        if (SharedBoardUtils && typeof SharedBoardUtils.getCornerProximity === 'function') {
            const hint = SharedBoardUtils.getCornerProximity(row, col, boardOrRows, colsMaybe);
            if (hint && Array.isArray(hint.corner) && hint.corner.length === 2) {
                return { row: Number(hint.corner[0]), col: Number(hint.corner[1]) };
            }
        }
        const geometry = resolveBoardGeometry(boardOrRows, colsMaybe);
        if (geometry.maxR < 1 || geometry.maxC < 1) return null;
        const rowNearTop = row === 1;
        const rowNearBottom = row === geometry.maxR - 1;
        const colNearLeft = col === 1;
        const colNearRight = col === geometry.maxC - 1;
        if ((rowNearTop || rowNearBottom) && (colNearLeft || colNearRight)) {
            return {
                row: rowNearTop ? 0 : geometry.maxR,
                col: colNearLeft ? 0 : geometry.maxC
            };
        }
        if ((row === 0 || row === geometry.maxR) && (colNearLeft || colNearRight)) {
            return { row, col: colNearLeft ? 0 : geometry.maxC };
        }
        if ((col === 0 || col === geometry.maxC) && (rowNearTop || rowNearBottom)) {
            return { row: rowNearTop ? 0 : geometry.maxR, col };
        }
        return null;
    }

    function getBoardCellValueSafe(board: CpuPolicyBoard | null | undefined, row: number, col: number): number | null {
        if (!inBoard(board, row, col)) return null;
        if (SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function') {
            return SharedBoardUtils.getCellValue(board, row, col);
        }
        return Array.isArray(board) && Array.isArray(board[row]) ? Number(board[row][col]) : null;
    }

    function hasOwnedAdjacentCorner(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): boolean {
        const adjacentCorner = adjacentCornerFor(row, col, board);
        return !!adjacentCorner
            && inBoard(board, adjacentCorner.row, adjacentCorner.col)
            && getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col) === playerValue;
    }

    function isPseudoCornerXSquare(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): boolean {
        if (!board || typeof board !== 'object' || !isXSquare(row, col, board)) return false;
        const adjacentCorner = adjacentCornerFor(row, col, board);
        if (!adjacentCorner || !inBoard(board, adjacentCorner.row, adjacentCorner.col)) return false;
        return getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col) === playerValue
            && getBoardCellValueSafe(board, row, adjacentCorner.col) === playerValue
            && getBoardCellValueSafe(board, adjacentCorner.row, col) === playerValue;
    }

    function getBoardBonusAtCell(
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedByCell: Record<string, boolean | number> | null | undefined,
        row: number,
        col: number
    ): number {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
        const key = `${row},${col}`;
        if (consumedByCell && consumedByCell[key] === true) return 0;
        const value = boardBonusByCell ? Number(boardBonusByCell[key] || 0) : 0;
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    const boardCounts = createCpuPolicyBoardCounts({ SharedBoardUtils, isFiniteNumber });
    const {
        countBoardDiscsForPlayer
    } = boardCounts;
    const boardFeatures = createCpuPolicyBoardFeatures({
        SharedBoardUtils,
        inBoard,
        isXSquare,
        isCSquare,
        hasOwnedAdjacentCorner,
        getLegalMovesBasic,
        isCorner
    });
    const {
        countCornersFor,
        countEdgesFor,
        summarizeEdgeRunsFor,
        countAdjacentLoneEdgeDiscsFor,
        normalizePriorScore,
        countXsAndCsFor,
        countCornerMovesFor
    } = boardFeatures;
    const lookaheadConfig = createCpuPolicyLookaheadConfig({ countBoardDiscsForPlayer, asRecord, isFiniteNumber });
    const lookaheadBonus = createCpuPolicyLookaheadBonus({ isFiniteNumber, getBoardBonusAtCell });
    const lookaheadParity = createCpuPolicyLookaheadParity({ SharedBoardUtils, inBoard });
    const searchKey = createCpuPolicySearchKey({ SharedBoardUtils });
    const lookaheadEvaluation = createCpuPolicyLookaheadEvaluation({
        SharedBoardUtils,
        inBoard,
        isCorner,
        isEdge,
        countBoardDiscsForPlayer,
        countCornersFor,
        countEdgesFor,
        getLegalMovesBasic,
        resolveForcedPassFeature: lookaheadParity.resolveForcedPassFeature,
        countCornerMovesFor,
        countXsAndCsFor,
        resolveLookaheadParityFeature: lookaheadParity.resolveLookaheadParityFeature
    });
    const placementProfiles = createCpuPolicyPlacementProfiles({
        getBoardCellValueSafe,
        inBoard,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        applyMoveToBoard,
        countAnchoredEdgeDiscsFromCorners: lookaheadEvaluation.countAnchoredEdgeDiscsFromCorners
    });
    const placementFeatures = createCpuPolicyPlacementFeatures({
        isFiniteNumber,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        getBoardCellValueSafe,
        inBoard,
        applyMoveToBoard,
        getLegalMovesBasic,
        countCornerMovesFor,
        summarizeEdgeRunsFor,
        countAnchoredEdgeDiscsFromCorners: lookaheadEvaluation.countAnchoredEdgeDiscsFromCorners,
        countBoardDiscsForPlayer,
        getBoardBonusAtCell
    });
    const movePlanScoring = createCpuPolicyMovePlanScoring({
        asRecord,
        isFiniteNumber,
        scoreMoveHeuristic,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        getBoardCellValueSafe,
        inBoard,
        isPseudoCornerXSquare,
        getBoardBonusAtCell,
        applyMoveToBoard,
        getLegalMovesBasic,
        getMovePlanProfileForCardType: () => null,
        countCornerMovesFor,
        countCornersFor,
        countEdgesFor,
        summarizeEdgeRunsFor,
        countFrontierDiscsFor: lookaheadEvaluation.countFrontierDiscsFor,
        countAnchoredEdgeDiscsFromCorners: lookaheadEvaluation.countAnchoredEdgeDiscsFromCorners,
        computePlacementStabilityProxy: placementProfiles.computePlacementStabilityProxy,
        countAdjacentCellsByValue: placementProfiles.countAdjacentCellsByValue,
        countAdjacentLoneEdgeDiscsFor,
        countXsAndCsFor,
        countBoardDiscsForPlayer,
        evaluatePlacementCandidate: placementFeatures.evaluatePlacementCandidate
    });
    const searchOrder = createCpuPolicySearchOrder({
        isFiniteNumber,
        resolveBoardGeometry,
        scoreMoveForCornerEdgePlan: movePlanScoring.scoreMoveForCornerEdgePlan,
        scoreMoveHeuristic,
        getMoveChargeGain: lookaheadBonus.getMoveChargeGain,
        normalizePriorScore,
        isCorner,
        inBoard,
        applyMoveToBoard,
        getLegalMovesBasic,
        countCornerMovesFor,
        countFrontierDiscsFor: lookaheadEvaluation.countFrontierDiscsFor
    });
    const guards = createCpuPolicyLookaheadGuards({
        isCorner,
        isEdge,
        countCornersFor,
        evaluateImmediateCornerDonation: movePlanScoring.evaluateImmediateCornerDonation,
        evaluateMoveStabilityProfile: placementProfiles.evaluateMoveStabilityProfile,
        countAnchoredEdgeDiscsFromCorners: lookaheadEvaluation.countAnchoredEdgeDiscsFromCorners,
        buildSearchMoveOrder: searchOrder.buildSearchMoveOrder
    });
    const rootSearch = createCpuPolicyLookaheadRootSearch({
        getMoveChargeGain: lookaheadBonus.getMoveChargeGain,
        getBoardBonusAtCell,
        consumeBonusCell: lookaheadBonus.consumeBonusCell,
        applyMoveToBoard,
        normalizePriorScore
    });
    const prelude = createCpuPolicyLookaheadPrelude({
        isFiniteNumber,
        countBoardDiscsForPlayer,
        resolveLookaheadEndgameDepth: lookaheadConfig.resolveLookaheadEndgameDepth,
        resolveLookaheadDepth: lookaheadConfig.resolveLookaheadDepth,
        resolveLookaheadBranch: lookaheadConfig.resolveLookaheadBranch,
        resolveLookaheadNodeBudget: lookaheadConfig.resolveLookaheadNodeBudget,
        resolveLookaheadTimeBudgetMs: lookaheadConfig.resolveLookaheadTimeBudgetMs,
        resolveLookaheadVirtualTimePerNodeMs: lookaheadConfig.resolveLookaheadVirtualTimePerNodeMs,
        createConsumedBonusMap: lookaheadBonus.createConsumedBonusMap,
        resolveLookaheadMixWeights: lookaheadConfig.resolveLookaheadMixWeights,
        getLegalMovesBasic,
        resolveLookaheadParityFeature: lookaheadParity.resolveLookaheadParityFeature,
        resolveForcedPassFeature: lookaheadParity.resolveForcedPassFeature,
        resolveLookaheadTranspositionLimit: lookaheadConfig.resolveLookaheadTranspositionLimit
    });
    const negamax = createCpuPolicyLookaheadNegamax({
        evaluateBoardForLookahead: lookaheadEvaluation.evaluateBoardForLookahead,
        evaluateTerminalBoardForLookahead: lookaheadEvaluation.evaluateTerminalBoardForLookahead,
        buildBoardSearchKey: searchKey.buildBoardSearchKey,
        getLegalMovesBasic,
        buildSearchMoveOrder: searchOrder.buildSearchMoveOrder,
        getMoveChargeGain: lookaheadBonus.getMoveChargeGain,
        getBoardBonusAtCell,
        consumeBonusCell: lookaheadBonus.consumeBonusCell,
        applyMoveToBoard
    });
    const controller = createCpuPolicyLookaheadController({
        isFiniteNumber,
        prepareLookaheadPrelude: prelude.prepareLookaheadPrelude,
        notifyLookaheadSearchMeta: prelude.notifyLookaheadSearchMeta,
        createNegamax: negamax.createNegamax,
        buildSearchMoveOrder: searchOrder.buildSearchMoveOrder,
        runLookaheadRootSearch: rootSearch.runLookaheadRootSearch,
        applyLookaheadHardGuards: guards.applyLookaheadHardGuards
    });
    return {
        chooseMoveByLookahead(candidateMoves: any[], options?: Record<string, any> | null): any {
            const normalizedOptions = options && typeof options === 'object' ? options : {};
            if (!Array.isArray(normalizedOptions.board) || !normalizedOptions.boardShape) {
                throw new Error('CPU worker lookahead requires explicit boardShape');
            }
            return controller.chooseMoveByLookahead(candidateMoves, {
                ...normalizedOptions,
                board: SharedBoardUtils.createBoardContext(
                    normalizedOptions.board,
                    normalizedOptions.boardShape
                )
            });
        }
    };
}

const workerLookaheadRuntime = createLookaheadRuntime();

export function chooseMoveByLookaheadInWorker(
    candidateMoves: any[],
    options?: Record<string, any> | null
): any {
    return workerLookaheadRuntime.chooseMoveByLookahead(candidateMoves, options);
}
