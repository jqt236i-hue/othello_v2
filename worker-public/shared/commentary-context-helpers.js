(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let OwnerHelpersModule = null;
        try {
            OwnerHelpersModule = require('../utils/owner-helpers');
        } catch (e) { /* ignore */ }
        module.exports = factory(OwnerHelpersModule);
    } else {
        root.CommentaryContextHelpers = factory(root.OwnerHelpers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (OwnerHelpersModule) {
    'use strict';

    function normalizePlayerKey(value, fallbackKey) {
        try {
            if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKey === 'function') {
                return OwnerHelpersModule.normalizePlayerKey(value, fallbackKey);
            }
        } catch (e) { /* ignore */ }

        if (value === 'white' || value === -1 || value === '-1') return 'white';
        if (value === 'black' || value === 1 || value === '1') return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }

    function countDiscsFromBoard(board, options) {
        const rows = Array.isArray(board) ? board : [];
        const blackValues = (options && Array.isArray(options.blackValues)) ? options.blackValues : [1, '1', 'black'];
        const whiteValues = (options && Array.isArray(options.whiteValues)) ? options.whiteValues : [-1, '-1', 'white'];
        const blackLookup = Object.create(null);
        const whiteLookup = Object.create(null);
        for (const value of blackValues) blackLookup[String(value)] = true;
        for (const value of whiteValues) whiteLookup[String(value)] = true;

        let black = 0;
        let white = 0;
        for (let row = 0; row < rows.length; row += 1) {
            const line = Array.isArray(rows[row]) ? rows[row] : [];
            for (let col = 0; col < line.length; col += 1) {
                const key = String(line[col]);
                if (blackLookup[key]) black += 1;
                else if (whiteLookup[key]) white += 1;
            }
        }
        return { black, white };
    }

    function resolvePhaseByTurn(turnNumber, occupiedCells) {
        if (Number.isFinite(turnNumber)) {
            if (turnNumber <= 12) return 'opening';
            if (turnNumber <= 40) return 'middle';
            return 'endgame';
        }
        if (Number.isFinite(occupiedCells)) {
            if (occupiedCells <= 20) return 'opening';
            if (occupiedCells <= 48) return 'middle';
            return 'endgame';
        }
        return 'middle';
    }

    function resolveAdvantageLabel(playerKey, counts, options) {
        const black = Number.isFinite(counts && counts.black) ? counts.black : 0;
        const white = Number.isFinite(counts && counts.white) ? counts.white : 0;
        const normalizedKey = normalizePlayerKey(playerKey, 'black');
        const threshold = Number.isFinite(options && options.diffThreshold) ? options.diffThreshold : 6;
        const diff = normalizedKey === 'black' ? (black - white) : (white - black);
        if (diff >= threshold) return 'ahead';
        if (diff <= -threshold) return 'behind';
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
            : resolveAdvantageLabel(playerKey, counts, opts.advantageOptions);

        const context = Object.assign({}, opts.extra || {}, {
            eventType: String(opts.eventType || 'turn_start'),
            playerKey,
            turnNumber,
            phase,
            advantage,
            counts,
            occupiedCells
        });

        if (board) context.board = board;
        if (opts.cardId !== null && opts.cardId !== undefined && opts.cardId !== '') {
            context.cardId = String(opts.cardId);
        }

        return context;
    }

    return {
        normalizePlayerKey,
        countDiscsFromBoard,
        resolvePhaseByTurn,
        resolveAdvantageLabel,
        buildCommentaryContext
    };
}));
