(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkCommentaryModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createNetworkCommentaryController(config) {
        const cfg = (config && typeof config === 'object') ? config : {};
        const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
        let commentaryContextHelpers = null;
        let commentaryRuntimeHelpers = null;

        function resolveFromGlobal(name) {
            try {
                if (rootRef && rootRef[name]) return rootRef[name];
            } catch (e) { /* ignore */ }
            try {
                if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
            } catch (e) { /* ignore */ }
            return null;
        }

        function resolveCommentaryContextHelpers() {
            if (commentaryContextHelpers) return commentaryContextHelpers;

            commentaryContextHelpers = resolveFromGlobal('CommentaryContextHelpers');
            if (commentaryContextHelpers) return commentaryContextHelpers;

            try {
                if (typeof require === 'function') {
                    commentaryContextHelpers = require('../../shared/commentary-context-helpers');
                    if (commentaryContextHelpers) return commentaryContextHelpers;
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function resolveCommentaryRuntimeHelpers() {
            if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;

            commentaryRuntimeHelpers = resolveFromGlobal('CommentaryRuntimeHelpers');
            if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;

            try {
                if (typeof require === 'function') {
                    commentaryRuntimeHelpers = require('../../shared/commentary-runtime-helpers');
                    if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function resolveCpuCommentaryRuntime() {
            const runtimeHelpers = resolveCommentaryRuntimeHelpers();
            if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeFromGlobal === 'function') {
                const runtime = runtimeHelpers.resolveCommentaryRuntimeFromGlobal(rootRef);
                if (runtime) return runtime;
            }

            try {
                const runtime = resolveFromGlobal('CpuCommentaryRuntime');
                if (runtime && typeof runtime.requestCommentary === 'function') {
                    return runtime;
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function resolveState() {
            return (typeof cfg.getState === 'function' && cfg.getState()) || {};
        }

        function resolveLogWriter() {
            if (typeof cfg.addLog === 'function') return cfg.addLog;

            try {
                if (rootRef && typeof rootRef.addLog === 'function') {
                    return rootRef.addLog.bind(rootRef);
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && typeof globalThis.addLog === 'function') {
                    return globalThis.addLog.bind(globalThis);
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function countDiscsFromBoard(board) {
            const helpers = resolveCommentaryContextHelpers();
            if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
                return helpers.countDiscsFromBoard(board);
            }
            return { black: 0, white: 0 };
        }

        function resolvePhaseByTurn(turnNumber, occupiedCells) {
            const helpers = resolveCommentaryContextHelpers();
            if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
                return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
            }
            return 'middle';
        }

        function resolveAdvantageLabel(playerKey, counts) {
            const helpers = resolveCommentaryContextHelpers();
            if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
                return helpers.resolveAdvantageLabel(playerKey, counts);
            }
            return 'even';
        }

        function normalizePlayerKey(value) {
            if (typeof cfg.normalizePlayerKey === 'function') {
                return cfg.normalizePlayerKey(value);
            }
            const normalized = String(value || '').trim().toLowerCase();
            if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
            return 'black';
        }

        function buildFallbackEventType(actionType, cardId) {
            const action = String(actionType || '').toLowerCase();
            if (action === 'pass') return 'pass';
            if (action === 'use_card') return 'card_used';
            if (cardId) return 'card_used';
            return 'turn_start';
        }

        function emitSnapshotCommentary(payload, snapshot, isSelfOperation, playbackEvents) {
            if (isSelfOperation) return;
            if (!payload || payload.ok !== true) return;

            const logWriter = resolveLogWriter();
            if (!logWriter) return;

            const actorKey = normalizePlayerKey(payload.playerKey || '');
            const state = resolveState();
            if (!actorKey || actorKey === state.seatKey) return;

            const runtime = resolveCpuCommentaryRuntime();
            if (!runtime || typeof runtime.requestCommentary !== 'function') return;

            const gameStateSnapshot = snapshot && snapshot.gameState ? snapshot.gameState : null;
            if (!gameStateSnapshot || !Array.isArray(gameStateSnapshot.board)) return;

            const counts = countDiscsFromBoard(gameStateSnapshot.board);
            const turnNumber = Number.isFinite(gameStateSnapshot.turnNumber) ? gameStateSnapshot.turnNumber : null;
            const runtimeHelpers = resolveCommentaryRuntimeHelpers();
            const cardId = (runtimeHelpers && typeof runtimeHelpers.extractCardIdFromPlaybackEvents === 'function')
                ? runtimeHelpers.extractCardIdFromPlaybackEvents(playbackEvents)
                : null;
            const eventType = (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryEventType === 'function')
                ? runtimeHelpers.resolveCommentaryEventType(payload.actionType, cardId)
                : buildFallbackEventType(payload.actionType, cardId);
            const contextHelpers = resolveCommentaryContextHelpers();
            const context = (contextHelpers && typeof contextHelpers.buildCommentaryContext === 'function')
                ? contextHelpers.buildCommentaryContext({
                    eventType,
                    playerKey: actorKey,
                    turnNumber,
                    counts,
                    board: gameStateSnapshot.board,
                    cardId
                })
                : {
                    eventType,
                    playerKey: actorKey,
                    turnNumber,
                    phase: resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
                    advantage: resolveAdvantageLabel(actorKey, counts),
                    counts,
                    board: gameStateSnapshot.board,
                    cardId
                };

            runtime.requestCommentary(context).then((text) => {
                const line = String(text || '').trim();
                if (!line) return;
                const prefix = (runtimeHelpers && typeof runtimeHelpers.getCpuSpeakerPrefix === 'function')
                    ? runtimeHelpers.getCpuSpeakerPrefix(actorKey)
                    : (actorKey === 'white' ? '白CPU' : '黒CPU');
                logWriter(`${prefix}: ${line}`);
            }).catch(() => {
                // Keep networking path stable on commentary failure.
            });
        }

        return {
            emitSnapshotCommentary
        };
    }

    return {
        createNetworkCommentaryController
    };
}));
