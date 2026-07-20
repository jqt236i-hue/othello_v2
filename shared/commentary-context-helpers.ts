(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let OwnerHelpersModule = null;
        let SharedBoardUtilsModule = null;
        try {
            OwnerHelpersModule = require('../utils/owner-helpers');
        } catch (e) { /* ignore */ }
        try {
            SharedBoardUtilsModule = require('./shared-board-utils');
        } catch (e) { /* ignore */ }
        module.exports = factory(OwnerHelpersModule, SharedBoardUtilsModule);
    } else {
        root.CommentaryContextHelpers = factory(root.OwnerHelpers || null, root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function (OwnerHelpersModule: unknown, SharedBoardUtilsModule: unknown) {
    'use strict';

    interface AdvantageProfile {
        discWeight: number;
        mobilityWeight: number;
        cornerWeight: number;
        edgeWeight: number;
        xRiskWeight: number;
        cRiskWeight: number;
        threshold: number;
    }

    interface DiscCounts {
        black: number;
        white: number;
    }

    interface CountOptions {
        blackValues?: unknown[];
        whiteValues?: unknown[];
    }

    interface CommentaryOptions {
        gameState?: { board?: unknown[][]; turnNumber?: number };
        board?: unknown[][];
        counts?: { black?: number; white?: number };
        countOptions?: CountOptions;
        occupiedCells?: number;
        turnNumber?: number;
        playerKey?: string;
        fallbackPlayerKey?: string;
        phase?: string;
        advantage?: string;
        eventType?: string;
        cardId?: string;
        extra?: Record<string, unknown>;
        advantageOptions?: Record<string, unknown>;
        diffThreshold?: number;
        scoreThreshold?: number;
        preparedMetrics?: Record<string, unknown>;
    }

    interface AdvantageScore {
        phase: string;
        score: number;
        threshold: number;
        usesBoardHeuristics: boolean;
        discDiff: number;
        mobilityDiff: number;
        cornerDiff: number;
        edgeDiff: number;
        xRiskDiff: number;
        cRiskDiff: number;
    }

    interface CommentaryContext extends Record<string, unknown> {
        eventType: string;
        playerKey: string;
        turnNumber: number | null;
        phase: string;
        advantage: string;
        counts: DiscCounts;
        occupiedCells: number;
    }

    const DEFAULT_DISC_DIFF_THRESHOLD = 6;
    const INITIAL_COMMENTARY_OCCUPIED_CELLS = 4;
    const ADVANTAGE_PROFILES: Readonly<Record<string, Readonly<AdvantageProfile>>> = Object.freeze({
        opening: Object.freeze({
            discWeight: 0.35,
            mobilityWeight: 1.3,
            cornerWeight: 9,
            edgeWeight: 0.25,
            xRiskWeight: 5,
            cRiskWeight: 3,
            threshold: 5.5
        }),
        middle: Object.freeze({
            discWeight: 0.7,
            mobilityWeight: 1.1,
            cornerWeight: 8,
            edgeWeight: 0.5,
            xRiskWeight: 4,
            cRiskWeight: 2.5,
            threshold: 6
        }),
        endgame: Object.freeze({
            discWeight: 1.2,
            mobilityWeight: 0.4,
            cornerWeight: 6,
            edgeWeight: 0.75,
            xRiskWeight: 1.5,
            cRiskWeight: 1,
            threshold: 7
        })
    });

    function normalizePlayerKey(value: unknown, fallbackKey: unknown): string {
        try {
            if (
                OwnerHelpersModule &&
                typeof (OwnerHelpersModule as { normalizePlayerKey?: (v: unknown, f: unknown) => string }).normalizePlayerKey === 'function'
            ) {
                return (OwnerHelpersModule as { normalizePlayerKey: (v: unknown, f: unknown) => string }).normalizePlayerKey(value, fallbackKey);
            }
        } catch (e) { /* ignore */ }

        if (value === 'white' || value === -1 || value === '-1') return 'white';
        if (value === 'black' || value === 1 || value === '1') return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }

    function countDiscsFromBoard(board: unknown, options: unknown): DiscCounts {
        const rows = Array.isArray(board) ? board as unknown[][] : [];
        const opts = options && typeof options === 'object' ? options as CountOptions : {};
        const blackValues = (opts.blackValues && Array.isArray(opts.blackValues)) ? opts.blackValues : [1, '1', 'black'];
        const whiteValues = (opts.whiteValues && Array.isArray(opts.whiteValues)) ? opts.whiteValues : [-1, '-1', 'white'];
        const blackLookup: Record<string, boolean> = Object.create(null);
        const whiteLookup: Record<string, boolean> = Object.create(null);
        for (const value of blackValues) blackLookup[String(value)] = true;
        for (const value of whiteValues) whiteLookup[String(value)] = true;

        let black = 0;
        let white = 0;
        for (let row = 0; row < rows.length; row += 1) {
            const line = Array.isArray(rows[row]) ? rows[row] as unknown[] : [];
            for (let col = 0; col < line.length; col += 1) {
                const key = String(line[col]);
                if (blackLookup[key]) black += 1;
                else if (whiteLookup[key]) white += 1;
            }
        }
        return { black, white };
    }

    function hasCommentaryGameplayStarted(options: unknown): boolean {
        const opts = (options && typeof options === 'object') ? options as CommentaryOptions : {};
        const state = (opts.gameState && typeof opts.gameState === 'object') ? opts.gameState : null;
        const board = Array.isArray(opts.board)
            ? opts.board
            : (state && Array.isArray(state.board) ? state.board : null);
        const counts = (opts.counts && Number.isFinite(Number(opts.counts.black)) && Number.isFinite(Number(opts.counts.white)))
            ? {
                black: Number(opts.counts.black),
                white: Number(opts.counts.white)
            }
            : countDiscsFromBoard(board, opts.countOptions);
        const occupiedCells = Number.isFinite(Number(opts.occupiedCells))
            ? Number(opts.occupiedCells)
            : ((counts.black || 0) + (counts.white || 0));
        const turnNumber = Number.isFinite(Number(opts.turnNumber))
            ? Number(opts.turnNumber)
            : (state && Number.isFinite(Number(state.turnNumber)) ? Number(state.turnNumber) : null);

        if (Number.isFinite(turnNumber as number) && (turnNumber as number) > 0) return true;
        return occupiedCells > INITIAL_COMMENTARY_OCCUPIED_CELLS;
    }

    function resolvePhaseByTurn(turnNumber: unknown, occupiedCells: unknown): string {
        if (Number.isFinite(turnNumber)) {
            if ((turnNumber as number) <= 12) return 'opening';
            if ((turnNumber as number) <= 40) return 'middle';
            return 'endgame';
        }
        if (Number.isFinite(occupiedCells)) {
            if ((occupiedCells as number) <= 20) return 'opening';
            if ((occupiedCells as number) <= 48) return 'middle';
            return 'endgame';
        }
        return 'middle';
    }

    function resolvePlayerValue(playerKey: unknown): number {
        return normalizePlayerKey(playerKey, 'black') === 'white' ? -1 : 1;
    }

    function resolveBoardBounds(board: unknown): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { resolveBoardBounds?: (b: unknown) => { minRow: number; maxRow: number; minCol: number; maxCol: number } | null }).resolveBoardBounds === 'function'
        ) {
            return (SharedBoardUtilsModule as { resolveBoardBounds: (b: unknown) => { minRow: number; maxRow: number; minCol: number; maxCol: number } | null }).resolveBoardBounds(board);
        }
        if (!Array.isArray(board) || board.length <= 0) return null;
        let maxCol = -1;
        for (const row of board as unknown[][]) {
            if (Array.isArray(row) && row.length > 0) maxCol = Math.max(maxCol, row.length - 1);
        }
        if (maxCol < 0) return null;
        return { minRow: 0, maxRow: (board as unknown[][]).length - 1, minCol: 0, maxCol };
    }

    function getCellValue(board: unknown, row: unknown, col: unknown): number {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { getCellValue?: (b: unknown, r: unknown, c: unknown) => number }).getCellValue === 'function'
        ) {
            return (SharedBoardUtilsModule as { getCellValue: (b: unknown, r: unknown, c: unknown) => number }).getCellValue(board, row, col);
        }
        const line = Array.isArray(board) && Number.isInteger(row) ? (board as unknown[][])[row as number] : null;
        return Array.isArray(line) && Number.isInteger(col) && (col as number) >= 0 && (col as number) < line.length
            ? Number(line[col as number]) || 0
            : 0;
    }

    function hasPlayableCell(board: unknown, row: unknown, col: unknown): boolean {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { hasPlayableCell?: (b: unknown, r: unknown, c: unknown) => boolean }).hasPlayableCell === 'function'
        ) {
            return (SharedBoardUtilsModule as { hasPlayableCell: (b: unknown, r: unknown, c: unknown) => boolean }).hasPlayableCell(board, row, col);
        }
        return Array.isArray(board) &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row as number) >= 0 &&
            (row as number) < (board as unknown[][]).length &&
            Array.isArray((board as unknown[][])[row as number]) &&
            (col as number) >= 0 &&
            (col as number) < (board as unknown[][])[row as number].length;
    }

    function countCornerControl(board: unknown, playerValue: unknown): { ownCorners: number; oppCorners: number } {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { countCornerControl?: (b: unknown, p: unknown) => { ownCorners: number; oppCorners: number } }).countCornerControl === 'function'
        ) {
            return (SharedBoardUtilsModule as { countCornerControl: (b: unknown, p: unknown) => { ownCorners: number; oppCorners: number } }).countCornerControl(board, playerValue);
        }
        const bounds = resolveBoardBounds(board);
        if (!bounds) return { ownCorners: 0, oppCorners: 0 };
        const corners = [
            [bounds.minRow, bounds.minCol],
            [bounds.minRow, bounds.maxCol],
            [bounds.maxRow, bounds.minCol],
            [bounds.maxRow, bounds.maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const one of corners) {
            const value = getCellValue(board, one[0], one[1]);
            if (value === playerValue) ownCorners += 1;
            else if (value === -(playerValue as number)) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }

    function countEdgeControl(board: unknown, playerValue: unknown): { ownEdges: number; oppEdges: number } {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { countEdgeControl?: (b: unknown, p: unknown) => { ownEdges: number; oppEdges: number } }).countEdgeControl === 'function'
        ) {
            return (SharedBoardUtilsModule as { countEdgeControl: (b: unknown, p: unknown) => { ownEdges: number; oppEdges: number } }).countEdgeControl(board, playerValue);
        }
        const bounds = resolveBoardBounds(board);
        if (!bounds) return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
            const line = Array.isArray((board as unknown[][])[row]) ? (board as unknown[][])[row] : [];
            for (let col = bounds.minCol; col < line.length; col += 1) {
                const isEdge = row === bounds.minRow || row === bounds.maxRow || col === bounds.minCol || col === bounds.maxCol;
                const isCorner = (row === bounds.minRow || row === bounds.maxRow) && (col === bounds.minCol || col === bounds.maxCol);
                if (!isEdge || isCorner) continue;
                const value = getCellValue(board, row, col);
                if (value === playerValue) ownEdges += 1;
                else if (value === -(playerValue as number)) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    }

    function countLegalMoves(board: unknown, playerValue: unknown): number {
        if (
            SharedBoardUtilsModule &&
            typeof (SharedBoardUtilsModule as { getLegalMovesBasic?: (b: unknown, p: unknown) => unknown[] }).getLegalMovesBasic === 'function'
        ) {
            return (SharedBoardUtilsModule as { getLegalMovesBasic: (b: unknown, p: unknown) => unknown[] }).getLegalMovesBasic(board, playerValue).length;
        }
        return 0;
    }

    function countCornerRiskCells(board: unknown, playerValue: unknown): { ownX: number; oppX: number; ownC: number; oppC: number } {
        const bounds = resolveBoardBounds(board);
        if (!bounds) {
            return { ownX: 0, oppX: 0, ownC: 0, oppC: 0 };
        }

        const corners = [
            { row: bounds.minRow, col: bounds.minCol, inwardRow: bounds.minRow + 1, inwardCol: bounds.minCol + 1 },
            { row: bounds.minRow, col: bounds.maxCol, inwardRow: bounds.minRow + 1, inwardCol: bounds.maxCol - 1 },
            { row: bounds.maxRow, col: bounds.minCol, inwardRow: bounds.maxRow - 1, inwardCol: bounds.minCol + 1 },
            { row: bounds.maxRow, col: bounds.maxCol, inwardRow: bounds.maxRow - 1, inwardCol: bounds.maxCol - 1 }
        ];
        const out = { ownX: 0, oppX: 0, ownC: 0, oppC: 0 };

        const applyCell = (row: number, col: number, keyOwn: 'ownX' | 'ownC', keyOpp: 'oppX' | 'oppC') => {
            if (!hasPlayableCell(board, row, col)) return;
            const value = getCellValue(board, row, col);
            if (value === playerValue) out[keyOwn] += 1;
            else if (value === -(playerValue as number)) out[keyOpp] += 1;
        };

        for (const corner of corners) {
            if (getCellValue(board, corner.row, corner.col) !== 0) continue;
            applyCell(corner.inwardRow, corner.inwardCol, 'ownX', 'oppX');
            applyCell(corner.row, corner.inwardCol, 'ownC', 'oppC');
            applyCell(corner.inwardRow, corner.col, 'ownC', 'oppC');
        }

        return out;
    }

    function resolveAdvantageProfile(phase: string): Readonly<AdvantageProfile> {
        return ADVANTAGE_PROFILES[phase] || ADVANTAGE_PROFILES.middle;
    }

    function resolveFallbackThreshold(options: Record<string, unknown> | undefined): number {
        return Number.isFinite(options?.diffThreshold)
            ? Number(options!.diffThreshold)
            : DEFAULT_DISC_DIFF_THRESHOLD;
    }

    function resolveScoreThreshold(phase: string, options: Record<string, unknown> | undefined): number {
        if (Number.isFinite(options?.scoreThreshold)) return Number(options!.scoreThreshold);
        return resolveAdvantageProfile(phase).threshold;
    }

    function resolveCommentaryAdvantageScore(playerKey: unknown, counts: DiscCounts | undefined, options: unknown): AdvantageScore {
        const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
        const black = Number.isFinite(counts && counts.black) ? (counts as DiscCounts).black : 0;
        const white = Number.isFinite(counts && counts.white) ? (counts as DiscCounts).white : 0;
        const normalizedKey = normalizePlayerKey(playerKey, 'black');
        const own = normalizedKey === 'black' ? black : white;
        const opp = normalizedKey === 'black' ? white : black;
        const discDiff = own - opp;
        const occupiedCells = Number.isFinite(opts.occupiedCells)
            ? Number(opts.occupiedCells)
            : (black + white);
        const phase = (typeof opts.phase === 'string' && opts.phase)
            ? String(opts.phase).toLowerCase()
            : resolvePhaseByTurn(opts.turnNumber, occupiedCells);
        const board = Array.isArray(opts.board) ? opts.board as unknown[][] : null;
        const fallbackThreshold = resolveFallbackThreshold(opts);

        if (!board || !SharedBoardUtilsModule) {
            return {
                phase,
                score: discDiff,
                threshold: fallbackThreshold,
                usesBoardHeuristics: false,
                discDiff,
                mobilityDiff: 0,
                cornerDiff: 0,
                edgeDiff: 0,
                xRiskDiff: 0,
                cRiskDiff: 0
            };
        }

        const playerValue = resolvePlayerValue(normalizedKey);
        const profile = resolveAdvantageProfile(phase);
        const corners = countCornerControl(board, playerValue);
        const edges = countEdgeControl(board, playerValue);
        const risk = countCornerRiskCells(board, playerValue);
        const cornerDiff = (corners.ownCorners || 0) - (corners.oppCorners || 0);
        const edgeDiff = (edges.ownEdges || 0) - (edges.oppEdges || 0);
        const preparedMobility = opts.mobility && typeof opts.mobility === 'object'
            ? opts.mobility as Record<string, unknown>
            : null;
        const blackMobility = preparedMobility && Number.isFinite(Number(preparedMobility.black))
            ? Number(preparedMobility.black)
            : null;
        const whiteMobility = preparedMobility && Number.isFinite(Number(preparedMobility.white))
            ? Number(preparedMobility.white)
            : null;
        const mobilityDiff = blackMobility !== null && whiteMobility !== null
            ? (normalizedKey === 'black' ? blackMobility - whiteMobility : whiteMobility - blackMobility)
            : countLegalMoves(board, playerValue) - countLegalMoves(board, -playerValue);
        const xRiskDiff = (risk.oppX || 0) - (risk.ownX || 0);
        const cRiskDiff = (risk.oppC || 0) - (risk.ownC || 0);
        const score =
            (discDiff * profile.discWeight) +
            (mobilityDiff * profile.mobilityWeight) +
            (cornerDiff * profile.cornerWeight) +
            (edgeDiff * profile.edgeWeight) +
            (xRiskDiff * profile.xRiskWeight) +
            (cRiskDiff * profile.cRiskWeight);

        return {
            phase,
            score,
            threshold: resolveScoreThreshold(phase, opts),
            usesBoardHeuristics: true,
            discDiff,
            mobilityDiff,
            cornerDiff,
            edgeDiff,
            xRiskDiff,
            cRiskDiff
        };
    }

    function resolveAdvantageLabel(playerKey: unknown, counts: DiscCounts | undefined, options: unknown): string {
        const evaluation = resolveCommentaryAdvantageScore(playerKey, counts, options);
        if (evaluation.score >= evaluation.threshold) return 'ahead';
        if (evaluation.score <= -evaluation.threshold) return 'behind';
        return 'even';
    }

    function buildCpuCommentaryMetrics(options: unknown): Readonly<Record<string, unknown>> {
        const opts = (options && typeof options === 'object') ? options as CommentaryOptions : {};
        const state = (opts.gameState && typeof opts.gameState === 'object') ? opts.gameState : null;
        const board = Array.isArray(opts.board)
            ? opts.board
            : (state && Array.isArray(state.board) ? state.board : null);
        const counts = (opts.counts && Number.isFinite(Number(opts.counts.black)) && Number.isFinite(Number(opts.counts.white)))
            ? { black: Number(opts.counts.black), white: Number(opts.counts.white) }
            : countDiscsFromBoard(board, opts.countOptions);
        const occupiedCells = Number.isFinite(Number(opts.occupiedCells))
            ? Number(opts.occupiedCells)
            : counts.black + counts.white;
        const turnNumber = Number.isFinite(Number(opts.turnNumber))
            ? Number(opts.turnNumber)
            : (state && Number.isFinite(Number(state.turnNumber)) ? Number(state.turnNumber) : null);
        const playerKey = normalizePlayerKey(opts.playerKey, opts.fallbackPlayerKey || 'black');
        const phase = resolvePhaseByTurn(turnNumber, occupiedCells);
        const mobility = Object.freeze({
            black: board ? countLegalMoves(board, 1) : 0,
            white: board ? countLegalMoves(board, -1) : 0
        });
        const advantageScore = resolveCommentaryAdvantageScore(playerKey, counts, Object.assign({}, opts.advantageOptions || {}, {
            board,
            turnNumber,
            occupiedCells,
            phase,
            mobility
        }));
        const advantage = advantageScore.score >= advantageScore.threshold
            ? 'ahead'
            : (advantageScore.score <= -advantageScore.threshold ? 'behind' : 'even');
        const cornerControl = board
            ? countCornerControl(board, resolvePlayerValue(playerKey))
            : { ownCorners: 0, oppCorners: 0 };
        return Object.freeze({
            counts: Object.freeze({ ...counts }),
            occupiedCells,
            turnNumber,
            phase,
            advantage,
            mobility,
            corners: Object.freeze({
                own: cornerControl.ownCorners || 0,
                opp: cornerControl.oppCorners || 0
            }),
            advantageScore: Object.freeze({ ...advantageScore })
        });
    }

    function buildCommentaryContext(options: unknown): CommentaryContext {
        const opts = (options && typeof options === 'object') ? options as CommentaryOptions : {};
        const preparedMetrics = opts.preparedMetrics && typeof opts.preparedMetrics === 'object'
            ? opts.preparedMetrics as Record<string, any>
            : null;
        const state = (opts.gameState && typeof opts.gameState === 'object') ? opts.gameState : null;
        const board = Array.isArray(opts.board)
            ? opts.board
            : (state && Array.isArray(state.board) ? state.board : null);
        const counts = preparedMetrics && preparedMetrics.counts
            && Number.isFinite(Number(preparedMetrics.counts.black))
            && Number.isFinite(Number(preparedMetrics.counts.white))
            ? {
                black: Number(preparedMetrics.counts.black),
                white: Number(preparedMetrics.counts.white)
            }
            : (opts.counts && Number.isFinite(Number(opts.counts.black)) && Number.isFinite(Number(opts.counts.white)))
            ? {
                black: Number(opts.counts.black),
                white: Number(opts.counts.white)
            }
            : countDiscsFromBoard(board, opts.countOptions);
        const occupiedCells = preparedMetrics && Number.isFinite(Number(preparedMetrics.occupiedCells))
            ? Number(preparedMetrics.occupiedCells)
            : Number.isFinite(Number(opts.occupiedCells))
            ? Number(opts.occupiedCells)
            : ((counts.black || 0) + (counts.white || 0));
        const turnNumber = preparedMetrics
            && preparedMetrics.turnNumber !== null
            && typeof preparedMetrics.turnNumber !== 'undefined'
            && Number.isFinite(Number(preparedMetrics.turnNumber))
            ? Number(preparedMetrics.turnNumber)
            : Number.isFinite(Number(opts.turnNumber))
            ? Number(opts.turnNumber)
            : (state && Number.isFinite(Number(state.turnNumber)) ? Number(state.turnNumber) : null);
        const playerKey = normalizePlayerKey(opts.playerKey, opts.fallbackPlayerKey || 'black');
        const directPhase = String((preparedMetrics && preparedMetrics.phase) || opts.phase || '').toLowerCase();
        const directAdvantage = String((preparedMetrics && preparedMetrics.advantage) || opts.advantage || '').toLowerCase();
        const phase = (directPhase === 'opening' || directPhase === 'middle' || directPhase === 'endgame')
            ? directPhase
            : resolvePhaseByTurn(turnNumber, occupiedCells);
        const advantage = (directAdvantage === 'ahead' || directAdvantage === 'behind' || directAdvantage === 'even')
            ? directAdvantage
            : resolveAdvantageLabel(playerKey, counts, Object.assign({}, opts.advantageOptions || {}, {
                board,
                turnNumber,
                occupiedCells,
                phase
            }));

        const context: CommentaryContext = Object.assign({}, opts.extra || {}, {
            eventType: String(opts.eventType || 'turn_start'),
            playerKey,
            turnNumber,
            phase,
            advantage,
            counts,
            occupiedCells
        });

        if (board) context.board = board;
        if (preparedMetrics && preparedMetrics.corners) context.corners = preparedMetrics.corners;
        if (preparedMetrics && preparedMetrics.mobility) context.mobility = preparedMetrics.mobility;
        if (preparedMetrics && preparedMetrics.advantageScore) context.advantageScore = preparedMetrics.advantageScore;
        if (opts.cardId !== null && opts.cardId !== undefined && opts.cardId !== '') {
            context.cardId = String(opts.cardId);
        }

        return context;
    }

    return {
        normalizePlayerKey,
        countDiscsFromBoard,
        hasCommentaryGameplayStarted,
        resolvePhaseByTurn,
        resolveCommentaryAdvantageScore,
        resolveAdvantageLabel,
        buildCpuCommentaryMetrics,
        buildCommentaryContext
    };
}));
