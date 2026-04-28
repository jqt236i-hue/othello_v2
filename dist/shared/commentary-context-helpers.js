"use strict";
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let OwnerHelpersModule = null;
        let SharedBoardUtilsModule = null;
        try {
            OwnerHelpersModule = require('../utils/owner-helpers');
        }
        catch (e) { /* ignore */ }
        try {
            SharedBoardUtilsModule = require('./shared-board-utils');
        }
        catch (e) { /* ignore */ }
        module.exports = factory(OwnerHelpersModule, SharedBoardUtilsModule);
    }
    else {
        root.CommentaryContextHelpers = factory(root.OwnerHelpers || null, root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self : this, function (OwnerHelpersModule, SharedBoardUtilsModule) {
    'use strict';
    const DEFAULT_DISC_DIFF_THRESHOLD = 6;
    const INITIAL_COMMENTARY_OCCUPIED_CELLS = 4;
    const ADVANTAGE_PROFILES = Object.freeze({
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
    function normalizePlayerKey(value, fallbackKey) {
        try {
            if (OwnerHelpersModule &&
                typeof OwnerHelpersModule.normalizePlayerKey === 'function') {
                return OwnerHelpersModule.normalizePlayerKey(value, fallbackKey);
            }
        }
        catch (e) { /* ignore */ }
        if (value === 'white' || value === -1 || value === '-1')
            return 'white';
        if (value === 'black' || value === 1 || value === '1')
            return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }
    function countDiscsFromBoard(board, options) {
        const rows = Array.isArray(board) ? board : [];
        const opts = options && typeof options === 'object' ? options : {};
        const blackValues = (opts.blackValues && Array.isArray(opts.blackValues)) ? opts.blackValues : [1, '1', 'black'];
        const whiteValues = (opts.whiteValues && Array.isArray(opts.whiteValues)) ? opts.whiteValues : [-1, '-1', 'white'];
        const blackLookup = Object.create(null);
        const whiteLookup = Object.create(null);
        for (const value of blackValues)
            blackLookup[String(value)] = true;
        for (const value of whiteValues)
            whiteLookup[String(value)] = true;
        let black = 0;
        let white = 0;
        for (let row = 0; row < rows.length; row += 1) {
            const line = Array.isArray(rows[row]) ? rows[row] : [];
            for (let col = 0; col < line.length; col += 1) {
                const key = String(line[col]);
                if (blackLookup[key])
                    black += 1;
                else if (whiteLookup[key])
                    white += 1;
            }
        }
        return { black, white };
    }
    function hasCommentaryGameplayStarted(options) {
        const opts = (options && typeof options === 'object') ? options : {};
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
        if (Number.isFinite(turnNumber) && turnNumber > 0)
            return true;
        return occupiedCells > INITIAL_COMMENTARY_OCCUPIED_CELLS;
    }
    function resolvePhaseByTurn(turnNumber, occupiedCells) {
        if (Number.isFinite(turnNumber)) {
            if (turnNumber <= 12)
                return 'opening';
            if (turnNumber <= 40)
                return 'middle';
            return 'endgame';
        }
        if (Number.isFinite(occupiedCells)) {
            if (occupiedCells <= 20)
                return 'opening';
            if (occupiedCells <= 48)
                return 'middle';
            return 'endgame';
        }
        return 'middle';
    }
    function resolvePlayerValue(playerKey) {
        return normalizePlayerKey(playerKey, 'black') === 'white' ? -1 : 1;
    }
    function resolveBoardBounds(board) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.resolveBoardBounds === 'function') {
            return SharedBoardUtilsModule.resolveBoardBounds(board);
        }
        if (!Array.isArray(board) || board.length <= 0)
            return null;
        let maxCol = -1;
        for (const row of board) {
            if (Array.isArray(row) && row.length > 0)
                maxCol = Math.max(maxCol, row.length - 1);
        }
        if (maxCol < 0)
            return null;
        return { minRow: 0, maxRow: board.length - 1, minCol: 0, maxCol };
    }
    function getCellValue(board, row, col) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.getCellValue === 'function') {
            return SharedBoardUtilsModule.getCellValue(board, row, col);
        }
        const line = Array.isArray(board) && Number.isInteger(row) ? board[row] : null;
        return Array.isArray(line) && Number.isInteger(col) && col >= 0 && col < line.length
            ? Number(line[col]) || 0
            : 0;
    }
    function hasPlayableCell(board, row, col) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.hasPlayableCell === 'function') {
            return SharedBoardUtilsModule.hasPlayableCell(board, row, col);
        }
        return Array.isArray(board) &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= 0 &&
            row < board.length &&
            Array.isArray(board[row]) &&
            col >= 0 &&
            col < board[row].length;
    }
    function countCornerControl(board, playerValue) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.countCornerControl === 'function') {
            return SharedBoardUtilsModule.countCornerControl(board, playerValue);
        }
        const bounds = resolveBoardBounds(board);
        if (!bounds)
            return { ownCorners: 0, oppCorners: 0 };
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
            if (value === playerValue)
                ownCorners += 1;
            else if (value === -playerValue)
                oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }
    function countEdgeControl(board, playerValue) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.countEdgeControl === 'function') {
            return SharedBoardUtilsModule.countEdgeControl(board, playerValue);
        }
        const bounds = resolveBoardBounds(board);
        if (!bounds)
            return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
            const line = Array.isArray(board[row]) ? board[row] : [];
            for (let col = bounds.minCol; col < line.length; col += 1) {
                const isEdge = row === bounds.minRow || row === bounds.maxRow || col === bounds.minCol || col === bounds.maxCol;
                const isCorner = (row === bounds.minRow || row === bounds.maxRow) && (col === bounds.minCol || col === bounds.maxCol);
                if (!isEdge || isCorner)
                    continue;
                const value = getCellValue(board, row, col);
                if (value === playerValue)
                    ownEdges += 1;
                else if (value === -playerValue)
                    oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    }
    function countLegalMoves(board, playerValue) {
        if (SharedBoardUtilsModule &&
            typeof SharedBoardUtilsModule.getLegalMovesBasic === 'function') {
            return SharedBoardUtilsModule.getLegalMovesBasic(board, playerValue).length;
        }
        return 0;
    }
    function countCornerRiskCells(board, playerValue) {
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
        const applyCell = (row, col, keyOwn, keyOpp) => {
            if (!hasPlayableCell(board, row, col))
                return;
            const value = getCellValue(board, row, col);
            if (value === playerValue)
                out[keyOwn] += 1;
            else if (value === -playerValue)
                out[keyOpp] += 1;
        };
        for (const corner of corners) {
            if (getCellValue(board, corner.row, corner.col) !== 0)
                continue;
            applyCell(corner.inwardRow, corner.inwardCol, 'ownX', 'oppX');
            applyCell(corner.row, corner.inwardCol, 'ownC', 'oppC');
            applyCell(corner.inwardRow, corner.col, 'ownC', 'oppC');
        }
        return out;
    }
    function resolveAdvantageProfile(phase) {
        return ADVANTAGE_PROFILES[phase] || ADVANTAGE_PROFILES.middle;
    }
    function resolveFallbackThreshold(options) {
        return Number.isFinite(options?.diffThreshold)
            ? Number(options.diffThreshold)
            : DEFAULT_DISC_DIFF_THRESHOLD;
    }
    function resolveScoreThreshold(phase, options) {
        if (Number.isFinite(options?.scoreThreshold))
            return Number(options.scoreThreshold);
        return resolveAdvantageProfile(phase).threshold;
    }
    function resolveCommentaryAdvantageScore(playerKey, counts, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const black = Number.isFinite(counts && counts.black) ? counts.black : 0;
        const white = Number.isFinite(counts && counts.white) ? counts.white : 0;
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
        const board = Array.isArray(opts.board) ? opts.board : null;
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
        const mobilityDiff = countLegalMoves(board, playerValue) - countLegalMoves(board, -playerValue);
        const xRiskDiff = (risk.oppX || 0) - (risk.ownX || 0);
        const cRiskDiff = (risk.oppC || 0) - (risk.ownC || 0);
        const score = (discDiff * profile.discWeight) +
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
    function resolveAdvantageLabel(playerKey, counts, options) {
        const evaluation = resolveCommentaryAdvantageScore(playerKey, counts, options);
        if (evaluation.score >= evaluation.threshold)
            return 'ahead';
        if (evaluation.score <= -evaluation.threshold)
            return 'behind';
        return 'even';
    }
    function buildCommentaryContext(options) {
        const opts = (options && typeof options === 'object') ? options : {};
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
        const playerKey = normalizePlayerKey(opts.playerKey, opts.fallbackPlayerKey || 'black');
        const directPhase = String(opts.phase || '').toLowerCase();
        const directAdvantage = String(opts.advantage || '').toLowerCase();
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
        const context = Object.assign({}, opts.extra || {}, {
            eventType: String(opts.eventType || 'turn_start'),
            playerKey,
            turnNumber,
            phase,
            advantage,
            counts,
            occupiedCells
        });
        if (board)
            context.board = board;
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
        buildCommentaryContext
    };
}));
//# sourceMappingURL=commentary-context-helpers.js.map