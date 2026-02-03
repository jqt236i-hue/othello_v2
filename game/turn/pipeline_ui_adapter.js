/**
 * @file pipeline_ui_adapter.js
 * @description Bridge TurnPipeline event log -> browser UI via Canonical Playback Events.
 * alings with 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelineUIAdapter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    /**
     * Helper to get visual state of a cell from game/card state.
     */
    function getVisualStateAt(r, c, cardState, gameState) {
        if (!gameState || !gameState.board) return { color: 0, special: null, timer: null };
        const color = gameState.board[r][c];

        // Find special stone
        let special = null;
        let timer = null;
        let owner = null;

        if (cardState && cardState.markers) {
            const s = MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function'
                ? MarkersAdapter.findSpecialMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.row === r && m.col === c);
            if (s) {
                special = (s.data && s.data.type) || null;
                timer = (s.data && s.data.remainingOwnerTurns) || null;
                owner = (s.owner !== undefined && s.owner !== null) ? s.owner : null;
            }
        }

        // Bomb check
        if (!special && cardState && cardState.markers) {
            const b = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === r && m.col === c);
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && b.data.remainingTurns) || null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
            }
        }

        return { color, special, timer, owner };
    }

    /**
     * Converts presentation events (BoardOps output) into PlaybackEvents.
     * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
     */
    function mapToPlaybackEvents(presEvents, finalCardState, finalGameState) {
        const playbackEvents = [];
        let currentPhase = 1;

        for (const ev of presEvents || []) {
            const pEvent = {
                type: null,
                phase: currentPhase,
                targets: [],
                rawType: ev.type,
                actionId: ev.actionId || null,
                turnIndex: (typeof ev.turnIndex === 'number') ? ev.turnIndex : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
                plyIndex: (typeof ev.plyIndex === 'number') ? ev.plyIndex : null
            };

            switch (ev.type) {
                case 'SPAWN':
                    pEvent.type = 'spawn';
                    pEvent.targets = [{ r: ev.row, col: ev.col, stoneId: ev.stoneId, ownerAfter: ev.ownerAfter }];
                    break;
                case 'DESTROY':
                    pEvent.type = 'destroy';
                    pEvent.targets = [{ r: ev.row, col: ev.col, stoneId: ev.stoneId, ownerBefore: ev.ownerBefore }];
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'CHANGE':
                    // Map CHANGE -> flip to match UI AnimationEngine expectations (Spec B)
                    pEvent.type = 'flip';
                    pEvent.targets = [{ r: ev.row, col: ev.col, ownerBefore: ev.ownerBefore, ownerAfter: ev.ownerAfter }];
                    break;
                case 'MOVE':
                    pEvent.type = 'move';
                    pEvent.targets = [{ from: { r: ev.prevRow, c: ev.prevCol }, to: { r: ev.row, c: ev.col }, stoneId: ev.stoneId }];
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'STATUS_APPLIED':
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_TICK':
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_REMOVED':
                    pEvent.type = 'status_removed';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                default:
                    // Unknown presentation event -> log
                    pEvent.type = 'log';
                    pEvent.message = `PresentationEvent: ${ev.type}`;
            }

            // NOTE: Do not populate 'after' using a final snapshot. Adapter is a thin transform.
            // Instead, include minimal per-target 'after' info derived from the presentation event itself
            // so that visual writers can render based on event payload without requiring snapshots.
            if (pEvent.type !== 'log') {
                for (const t of pEvent.targets) {
                    // Add a best-effort 'after' using event-sourced owner fields (no final snapshot)
                    if (t.ownerAfter !== undefined) {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: (ev.meta && ev.meta.special) || null,
                            timer: (ev.meta && ev.meta.timer) || null,
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'spawn') {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: (ev.meta && ev.meta.special) || null,
                            timer: (ev.meta && ev.meta.timer) || null,
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'move') {
                        t.after = {
                            color: 0,
                            special: (ev.meta && ev.meta.special) || null,
                            timer: (ev.meta && ev.meta.timer) || null,
                            owner: (ev.meta && ev.meta.owner) || null
                        };
                    } else if (pEvent.type === 'destroy') {
                        t.after = { color: 0, special: null, timer: null };
                    } else if (pEvent.type === 'status_applied' || pEvent.type === 'status_removed') {
                        const visual = getVisualStateAt(t.r, t.col, finalCardState, finalGameState);
                        t.after = {
                            color: visual.color || 0,
                            special: (ev.meta && ev.meta.special) || visual.special || null,
                            timer: (ev.meta && ev.meta.timer) || visual.timer || null,
                            owner: (ev.meta && ev.meta.owner) || visual.owner || null
                        };
                    } else {
                        t.after = { color: 0, special: null, timer: null };
                    }
                }
            }

            if (pEvent.type) playbackEvents.push(pEvent);
        }

        return playbackEvents;
    }

    /**
     * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
     */
    function runTurnWithAdapter(cardState, gameState, playerKey, action, turnPipeline) {
        if (!turnPipeline) throw new Error('TurnPipeline not available');

        // Build options for applyTurnSafe: include current state version and previous action ids if ActionManager is available
        const options = {};
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            try {
                if (typeof ActionManager.ActionManager.getRecentActionIds === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getRecentActionIds(200);
                } else if (typeof ActionManager.ActionManager.getActions === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getActions().map(a => a.actionId).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
        }
        if (cardState && typeof cardState.turnIndex === 'number') {
            options.currentStateVersion = cardState.turnIndex;
        }

        // Attempt to pass the current game PRNG (when available in browser env) to ensure deterministic rule logic
        const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : (typeof globalThis !== 'undefined' && typeof globalThis.getGamePrng === 'function') ? globalThis.getGamePrng() : undefined;
        if (typeof console !== 'undefined' && console.log) console.log('[TurnPipelineUIAdapter] runtimePrng available:', !!runtimePrng);
        const result = (typeof turnPipeline.applyTurnSafe === 'function')
            ? turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action, runtimePrng, options)
            : turnPipeline.applyTurn(cardState, gameState, playerKey, action, runtimePrng);

        if (result.ok === false) {
            return { ok: false, rejectedReason: result.rejectedReason || 'UNKNOWN', events: result.events };
        }

        // Prefer pipeline-produced presentationEvents when available
        const pres = result.presentationEvents || result.cardState && result.cardState.presentationEvents || [];
        const playbackEvents = mapToPlaybackEvents(pres, result.cardState, result.gameState);

        return {
            ok: true,
            nextCardState: result.cardState,
            nextGameState: result.gameState,
            playbackEvents: playbackEvents,
            rawEvents: result.events,
            presentationEvents: pres
        };
    }

    return {
        mapToPlaybackEvents,
        runTurnWithAdapter
    };
}));
