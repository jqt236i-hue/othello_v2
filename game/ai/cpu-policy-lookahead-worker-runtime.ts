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

function createWorkerBoardUtils() {
    const shapeByBoard = new WeakMap<object, any>();
    const readShape = (board: any): any => Array.isArray(board)
        ? (shapeByBoard.get(board) || null)
        : null;
    const keyOf = (row: number, col: number) => `${row},${col}`;
    const normalizeOwner = (value: unknown): number => value === 1 || value === -1 ? value : 0;
    const registerBoardShape = (board: any, shape: any): any => {
        if (!Array.isArray(board)) return board;
        if (!shape || typeof shape !== 'object') {
            shapeByBoard.delete(board);
            return board;
        }
        shapeByBoard.set(board, {
            ...shape,
            playableKeys: new Set(Array.isArray(shape.playableKeys) ? shape.playableKeys : []),
            meteorHoleKeys: new Set(Array.isArray(shape.meteorHoleKeys) ? shape.meteorHoleKeys : []),
            expansionCells: Array.isArray(shape.expansionCells)
                ? shape.expansionCells.map((cell: any) => ({ ...cell }))
                : [],
            expansionOwnerByKey: { ...(shape.expansionOwnerByKey || {}) }
        });
        return board;
    };
    const readCoordinates = (board: any): Array<{ row: number; col: number }> => {
        const shape = readShape(board);
        if (shape && shape.playableKeys instanceof Set) {
            return Array.from(shape.playableKeys)
                .map((key: any) => String(key).split(',').map(Number))
                .filter(([row, col]) => Number.isInteger(row) && Number.isInteger(col))
                .map(([row, col]) => ({ row, col }))
                .sort((a, b) => a.row - b.row || a.col - b.col);
        }
        const coordinates: Array<{ row: number; col: number }> = [];
        if (!Array.isArray(board)) return coordinates;
        board.forEach((row: any, rowIndex: number) => {
            if (!Array.isArray(row)) return;
            row.forEach((_cell: any, colIndex: number) => coordinates.push({ row: rowIndex, col: colIndex }));
        });
        return coordinates;
    };
    const resolveBounds = (boardOrRows: any, maybeCols?: any) => {
        if (!Array.isArray(boardOrRows)) {
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
        if (!Number.isInteger(row) || !Number.isInteger(col) || !Array.isArray(board)) return false;
        const shape = readShape(board);
        if (shape && shape.playableKeys instanceof Set) return shape.playableKeys.has(keyOf(row, col));
        return row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length;
    };
    const getCellValue = (board: any, row: number, col: number): number | null => {
        if (!hasPlayableCell(board, row, col)) return null;
        if (row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length) {
            return Number(board[row][col] || 0);
        }
        const shape = readShape(board);
        return Number(shape?.expansionOwnerByKey?.[keyOf(row, col)] || 0);
    };
    const setCellValue = (board: any, row: number, col: number, owner: number): boolean => {
        if (!hasPlayableCell(board, row, col)) return false;
        if (row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length) {
            board[row][col] = owner;
            return true;
        }
        const shape = readShape(board);
        shape.expansionOwnerByKey = shape.expansionOwnerByKey || {};
        shape.expansionOwnerByKey[keyOf(row, col)] = owner;
        const cell = Array.isArray(shape.expansionCells)
            ? shape.expansionCells.find((entry: any) => entry && entry.row === row && entry.col === col)
            : null;
        if (cell) cell.owner = owner;
        return true;
    };
    const cloneBoard = (board: any): any => {
        if (!Array.isArray(board)) return [];
        const clone = board.map((row: any) => Array.isArray(row) ? row.slice() : []);
        const shape = readShape(board);
        if (shape) registerBoardShape(clone, {
            ...shape,
            playableKeys: Array.from(shape.playableKeys instanceof Set ? shape.playableKeys : []),
            meteorHoleKeys: Array.from(shape.meteorHoleKeys instanceof Set ? shape.meteorHoleKeys : [])
        });
        return clone;
    };
    const cornerUtils = createBoardCorners({
        toBoardCellKey: keyOf,
        getBoardShapeMeta: readShape,
        collectBoardCoordinates: readCoordinates,
        hasPlayableCell,
        resolveBoardBounds: resolveBounds
    });
    const riskUtils = createRiskCells({
        toBoardCellKey: keyOf,
        getBoardShapeMeta: readShape,
        collectBoardCoordinates: readCoordinates,
        hasPlayableCell,
        resolveBoardBounds: resolveBounds,
        getCornerCells: cornerUtils.getCornerCells,
        isCornerCell: cornerUtils.isCornerCell,
        isEdgeCell: cornerUtils.isEdgeCell
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
        registerBoardShape,
        cloneBoard,
        collectBoardCoordinates: readCoordinates,
        encodeBoard: canonicalEncoding.encodeBoard,
        getCellValue,
        setCellValue,
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
    const SharedBoardUtils: any = createWorkerBoardUtils();
    const OthelloCore: any = {
        getFlipsBasic: SharedBoardUtils.getFlipsBasic,
        getLegalMovesBasic: SharedBoardUtils.getLegalMovesBasic
    };
    const primitives = CpuPolicyBoardPrimitivesModule.createCpuPolicyBoardPrimitives({
        SharedBoardUtils,
        OthelloCore,
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
        if (!Array.isArray(board) || !isXSquare(row, col, board)) return false;
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
            if (Array.isArray(normalizedOptions.board)) {
                SharedBoardUtils.registerBoardShape(
                    normalizedOptions.board,
                    normalizedOptions.boardShape || null
                );
            }
            return controller.chooseMoveByLookahead(candidateMoves, normalizedOptions);
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
