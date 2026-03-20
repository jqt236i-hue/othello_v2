/**
 * @file turn_pipeline_phases.js
 * @description Turn pipeline phase helpers (UMD)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelinePhases = factory();
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
    function isBombCategoryMarker(marker) {
        if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        return !!(
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.data &&
            marker.data.category === 'bomb'
        );
    }
    const CardUtilsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/cards/utils');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardUtils || null;
    })();
    const SharedConstantsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared-constants');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.SharedConstants || null;
    })();
    const CHARGE_MAX = Number.isFinite(Number(SharedConstantsModule && SharedConstantsModule.CHARGE_MAX))
        ? Number(SharedConstantsModule.CHARGE_MAX)
        : 99;
    const OwnerHelpersModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../utils/owner-helpers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.OwnerHelpers || null;
    })();

    const PhaseHelpersModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./turn_pipeline_phase_helpers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.TurnPipelinePhaseHelpers || null;
    })();

    const OBSERVER_PLACE_LINES = (
        PhaseHelpersModule &&
        Array.isArray(PhaseHelpersModule.OBSERVER_PLACE_LINES) &&
        PhaseHelpersModule.OBSERVER_PLACE_LINES.length > 0
    ) ? PhaseHelpersModule.OBSERVER_PLACE_LINES : Object.freeze(['観測最高！']);
    const OBSERVER_LOST_LINE = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.OBSERVER_LOST_LINE === 'string'
    ) ? PhaseHelpersModule.OBSERVER_LOST_LINE : '観測失敗';
    const WORK_PLACE_LINES = (
        PhaseHelpersModule &&
        Array.isArray(PhaseHelpersModule.WORK_PLACE_LINES) &&
        PhaseHelpersModule.WORK_PLACE_LINES.length > 0
    ) ? PhaseHelpersModule.WORK_PLACE_LINES : Object.freeze(['ここで稼ぐ！']);
    const WORK_LOST_LINE = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.WORK_LOST_LINE === 'string'
    ) ? PhaseHelpersModule.WORK_LOST_LINE : 'あああああああああああああ';
    const OBSERVER_CARD_ONE_LINERS = (
        PhaseHelpersModule &&
        PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS &&
        typeof PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS === 'object'
    ) ? PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS : Object.freeze({});

    const pickRandomLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.pickRandomLine === 'function'
    )
        ? PhaseHelpersModule.pickRandomLine
        : function pickRandomLineFallback(lines, prng) {
            if (!Array.isArray(lines) || lines.length === 0) return null;
            const source = (prng && typeof prng.random === 'function') ? prng : Math;
            let value = Number(source.random());
            if (!Number.isFinite(value)) value = 0;
            if (value < 0) value = 0;
            if (value >= 1) value = 0.999999;
            const index = Math.floor(value * lines.length);
            return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
        };

    function emitObserverBubblePresentation(CardLogic, cardState, payload) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = payload || {};
        const row = Number(data.row);
        const col = Number(data.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;

        const ev = {
            type: 'OBSERVER_BUBBLE',
            player: data.player || null,
            row,
            col,
            gained: Number(data.gained) || 0,
            text: data.text || null,
            meta: { owner: data.player || null, reason: data.reason || null }
        };
        CardLogic.emitPresentationEvent(cardState, ev);
    }

    const resolveWorkIncomeLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.resolveWorkIncomeLine === 'function'
    )
        ? PhaseHelpersModule.resolveWorkIncomeLine
        : function resolveWorkIncomeLineFallback(gained) {
            return `布石+${Number(gained) || 0} 労働の成果だ`;
        };

    function emitWorkBubblePresentation(CardLogic, cardState, payload) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = payload || {};
        const row = Number(data.row);
        const col = Number(data.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;

        const gained = Number(data.gained) || 0;
        const incomeStep = Number.isFinite(Number(data.incomeStep))
            ? Math.max(1, Math.min(5, Math.trunc(Number(data.incomeStep))))
            : null;
        const text = (typeof data.text === 'string' && data.text.trim())
            ? data.text.trim()
            : resolveWorkIncomeLine(gained, incomeStep);

        CardLogic.emitPresentationEvent(cardState, {
            type: 'WORK_BUBBLE',
            player: data.player || null,
            row,
            col,
            gained,
            incomeStep,
            text,
            reason: data.reason || null,
            meta: {
                owner: data.player || null,
                reason: data.reason || null,
                incomeStep
            }
        });
    }

    function snapshotWorkMarkers(cardState) {
        const markers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        const out = [];
        for (const m of markers) {
            if (!m) continue;
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const markerType = String(m.data && m.data.type ? m.data.type : '').toUpperCase();
            if (markerType !== 'WORK') continue;
            if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const markerId = (m.id !== undefined && m.id !== null)
                ? String(m.id)
                : `${m.row},${m.col}:${m.owner || ''}:${m.createdSeq || 0}`;
            out.push({
                key: markerId,
                row: m.row,
                col: m.col,
                owner: (typeof m.owner === 'string' && m.owner) ? m.owner : null
            });
        }
        return out;
    }

    function getRemovedWorkMarkers(beforeSnapshot, afterSnapshot) {
        const before = Array.isArray(beforeSnapshot) ? beforeSnapshot : [];
        const after = Array.isArray(afterSnapshot) ? afterSnapshot : [];
        const afterSet = new Set(after.map((item) => item && item.key).filter((key) => !!key));
        return before.filter((item) => {
            if (!item || !item.key) return false;
            if (!Number.isInteger(item.row) || !Number.isInteger(item.col)) return false;
            return !afterSet.has(item.key);
        });
    }

    function isWorkDurationEndPresentationEvent(ev) {
        if (!ev || !ev.type) return false;
        if (ev.type === 'WORK_INCOME') {
            if (ev.removed !== true) return false;
        } else if (ev.type === 'WORK_REMOVED') {
            if (ev.removed === false) return false;
        } else {
            return false;
        }
        const reason = String((ev.reason || (ev.meta && ev.meta.reason) || '')).toLowerCase();
        const cause = String(ev.cause || '').toLowerCase();
        return reason === 'duration_end' || reason.indexOf('duration') >= 0 || reason.indexOf('expire') >= 0 || cause.indexOf('expire') >= 0;
    }

    function hasWorkRemovedPresentationEventAt(cardState, row, col, sinceIndex) {
        const pres = (cardState && Array.isArray(cardState.presentationEvents)) ? cardState.presentationEvents : [];
        const start = Number.isFinite(Number(sinceIndex)) ? Math.max(0, Math.trunc(Number(sinceIndex))) : 0;
        for (let i = start; i < pres.length; i++) {
            const ev = pres[i];
            if (!ev || ev.type !== 'WORK_REMOVED') continue;
            if (Number(ev.row) === Number(row) && Number(ev.col) === Number(col)) return true;
        }
        return false;
    }

    function emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, beforeSnapshot, options) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const opts = options || {};
        const afterSnapshot = snapshotWorkMarkers(cardState);
        const removed = getRemovedWorkMarkers(beforeSnapshot, afterSnapshot);
        if (!removed.length) return;

        const durationEndSet = (opts.durationEndSet instanceof Set) ? opts.durationEndSet : new Set();
        const presentationStartIndex = Number.isFinite(Number(opts.presentationStartIndex))
            ? Math.max(0, Math.trunc(Number(opts.presentationStartIndex)))
            : 0;

        for (const item of removed) {
            if (!item) continue;
            const markerKey = `${item.row},${item.col}:${item.owner || ''}`;
            if (durationEndSet.has(markerKey)) continue;
            if (hasWorkRemovedPresentationEventAt(cardState, item.row, item.col, presentationStartIndex)) continue;
            CardLogic.emitPresentationEvent(cardState, {
                type: 'WORK_REMOVED',
                player: item.owner || null,
                row: item.row,
                col: item.col,
                removed: true,
                reason: 'anchor_lost',
                meta: { reason: 'anchor_lost' }
            });
        }
    }

    function snapshotObserverMarkers(cardState) {
        const markers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        const out = [];
        for (const m of markers) {
            if (!m) continue;
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const markerType = String(m.data && m.data.type ? m.data.type : '').toUpperCase();
            if (markerType !== 'OBSERVER') continue;
            if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const markerId = (m.id !== undefined && m.id !== null)
                ? String(m.id)
                : `${m.row},${m.col}:${m.owner || ''}:${m.createdSeq || 0}`;
            out.push({
                key: markerId,
                row: m.row,
                col: m.col,
                owner: (typeof m.owner === 'string' && m.owner) ? m.owner : null
            });
        }
        return out;
    }

    function getRemovedObserverMarkers(beforeSnapshot, afterSnapshot) {
        const before = Array.isArray(beforeSnapshot) ? beforeSnapshot : [];
        const after = Array.isArray(afterSnapshot) ? afterSnapshot : [];
        const afterSet = new Set(after.map((item) => item && item.key).filter((key) => !!key));
        return before.filter((item) => {
            if (!item || !item.key) return false;
            if (!Number.isInteger(item.row) || !Number.isInteger(item.col)) return false;
            return !afterSet.has(item.key);
        });
    }

    function emitObserverLostBubbleFromSnapshots(CardLogic, cardState, beforeSnapshot, reason) {
        const afterSnapshot = snapshotObserverMarkers(cardState);
        const removed = getRemovedObserverMarkers(beforeSnapshot, afterSnapshot);
        const first = removed[0] || null;
        if (!first) return;
        emitObserverBubblePresentation(CardLogic, cardState, {
            player: first.owner || null,
            row: first.row,
            col: first.col,
            text: OBSERVER_LOST_LINE,
            reason: reason || 'removed'
        });
    }

    function addChargeWithTotal(cardState, playerKey, amount) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };
        const deltaRes = (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function')
            ? CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, 'turn_start_effect')
            : null;
        let added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
        if (!deltaRes) {
            const before = cardState.charge[playerKey] || 0;
            const after = Math.min(CHARGE_MAX, before + amount);
            cardState.charge[playerKey] = after;
            added = after - before;
        }
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function transferChargeBetweenPlayers(cardState, fromPlayerKey, toPlayerKey, amount, reasonKey) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };

        const fromCharge = Math.max(0, Number(cardState.charge[fromPlayerKey] || 0));
        const toCharge = Math.max(0, Number(cardState.charge[toPlayerKey] || 0));
        const toRoom = Math.max(0, CHARGE_MAX - toCharge);
        const requested = Math.max(0, Number(amount) || 0);
        const movable = Math.min(requested, fromCharge, toRoom);
        if (movable <= 0) return 0;

        const gained = addChargeWithTotal(cardState, toPlayerKey, movable);
        if (gained <= 0) return 0;

        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            CardUtilsModule.addChargeWithDelta(cardState, fromPlayerKey, -gained, `${reasonKey || 'transfer'}_loss`);
        } else {
            cardState.charge[fromPlayerKey] = Math.max(0, fromCharge - gained);
        }
        return gained;
    }

    function consumeTimeStopCompletedTurn(CardLogic, cardState, playerKey) {
        if (!CardLogic || typeof CardLogic.consumeTimeStopConsecutiveTurn !== 'function') {
            return { consumed: false, remaining: 0, continueTurn: false };
        }
        return CardLogic.consumeTimeStopConsecutiveTurn(cardState, playerKey) || { consumed: false, remaining: 0, continueTurn: false };
    }

    function handOffCompletedTurn(Core, CardLogic, cardState, gameState, playerKey, turnNumberAfterCompletion) {
        if (!Core || !gameState) return { continued: false, remaining: 0 };
        const player = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        const turnNumber = Number.isFinite(Number(turnNumberAfterCompletion))
            ? Number(turnNumberAfterCompletion)
            : (Number(gameState.turnNumber || 0) + 1);
        const timeStopRes = consumeTimeStopCompletedTurn(CardLogic, cardState, playerKey);
        if (timeStopRes.continueTurn === true) {
            gameState.currentPlayer = player;
            gameState.consecutivePasses = 0;
            gameState.turnNumber = turnNumber;
            if (cardState) {
                cardState.lastTurnStartedFor = null;
            }
            return { continued: true, remaining: Number(timeStopRes.remaining) || 0 };
        }
        gameState.currentPlayer = -player;
        gameState.consecutivePasses = 0;
        gameState.turnNumber = turnNumber;
        return { continued: false, remaining: 0 };
    }

    function handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey) {
        if (!Core || !gameState) return;
        const turnNumberBeforeAction = Number(gameState.turnNumber || 0);
        handOffCompletedTurn(Core, CardLogic, cardState, gameState, playerKey, turnNumberBeforeAction + 1);
    }

    function pushTrapEvents(events, trapRes) {
        if (!events || !trapRes) return;
        if (Array.isArray(trapRes.triggered) && trapRes.triggered.length > 0) {
            events.push({ type: 'trap_triggered', details: trapRes.triggered.slice() });
        }
        if (Array.isArray(trapRes.expired) && trapRes.expired.length > 0) {
            events.push({ type: 'trap_expired', details: trapRes.expired.slice() });
        }
        if (Array.isArray(trapRes.disarmed) && trapRes.disarmed.length > 0) {
            events.push({ type: 'trap_disarmed', details: trapRes.disarmed.slice() });
        }
    }

    function normalizePlayerKey(player) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(player);
            if (normalized) return normalized;
        }
        if (player === 'black' || player === 1 || player === '1') return 'black';
        if (player === 'white' || player === -1 || player === '-1') return 'white';
        return null;
    }

    function isFrozenCell(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isFrozenCell === 'function') {
            return !!CardUtilsModule.isFrozenCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m) => (
            m &&
            m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            Number(m.row) === Number(row) &&
            Number(m.col) === Number(col) &&
            m.data &&
            m.data.type === 'FREEZE'
        ));
    }

    function emitHandRemovePresentation(CardLogic, cardState, payload) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = payload || {};
        const playerKey = normalizePlayerKey(data.player);
        const count = Math.max(0, Math.trunc(Number(data.count) || 0));
        if (!playerKey || count <= 0) return;

        const ev = {
            type: 'HAND_REMOVE',
            player: playerKey,
            count,
            reason: data.reason || null
        };
        if (data.cardId) ev.cardId = data.cardId;
        if (Array.isArray(data.cardIds) && data.cardIds.length > 0) {
            ev.cardIds = data.cardIds.slice();
        }

        CardLogic.emitPresentationEvent(cardState, ev);
    }

    function emitTrapHandRemoveEvents(CardLogic, cardState, trapRes) {
        const triggered = (trapRes && Array.isArray(trapRes.triggered)) ? trapRes.triggered : [];
        if (!triggered.length) return;

        for (const detail of triggered) {
            const removedCount = Number(detail && (detail.destroyedHandCount ?? detail.stolenHandCount)) || 0;
            const victim = detail && detail.victim ? detail.victim : null;
            emitHandRemovePresentation(CardLogic, cardState, {
                player: victim,
                count: removedCount,
                reason: 'trap_will_triggered',
                cardIds: Array.isArray(detail && detail.destroyedCardIds) ? detail.destroyedCardIds.slice() : []
            });
        }
    }

    function applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events, prng) {
        const p = prng || undefined;

        if (cardState.lastTurnStartedFor !== playerKey) {
            const presentationStartIndex = Array.isArray(cardState.presentationEvents)
                ? cardState.presentationEvents.length
                : 0;
            const workMarkersBeforeStart = snapshotWorkMarkers(cardState);
            // Snapshot timers before any turn-start processing (for visual timer updates).
            const timerSnapshot = new Map();
            try {
                const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of sourceMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    if (isBombCategoryMarker(m)) {
                        if (typeof m.data.remainingTurns === 'number') {
                            timerSnapshot.set(key, { timer: m.data.remainingTurns, special: 'TIME_BOMB', owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        if (typeof m.data.remainingOwnerTurns === 'number') {
                            timerSnapshot.set(key, { timer: m.data.remainingOwnerTurns, special: m.data.type || null, owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    }
                }
            } catch (e) { /* ignore snapshot failures */ }

            const turnStartSummary = CardLogic.onTurnStart(cardState, playerKey, gameState, p) || null;
            events.push({ type: 'turn_start', player: playerKey });
            if (turnStartSummary && turnStartSummary.ribo && Array.isArray(turnStartSummary.ribo.entries)) {
                for (const entry of turnStartSummary.ribo.entries) {
                    if (!entry) continue;
                    if (entry.shortage) {
                        events.push({
                            type: 'ribo_will_shortage',
                            player: playerKey,
                            destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
                            destroyedCount: Number(entry.destroyedCount) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    } else {
                        events.push({
                            type: 'ribo_will_repaid',
                            player: playerKey,
                            repaid: Number(entry.repaid) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    }
                }
            }

            // Start-of-turn effects: process all markers (bombs & special stones) in creation order
            const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                ? MarkersAdapter.getMarkers(cardState)
                : (cardState.markers || []);
            const markers = sourceMarkers
                .map(m => ({
                    isBomb: isBombCategoryMarker(m),
                    marker: m,
                    createdSeq: (m.createdSeq || 0)
                }))
                .sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));

            const observerMarkersBeforeStart = snapshotObserverMarkers(cardState);
            const hyperAggregated = { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
            const observerStartSummary = { triggered: [], lost: [], durationEnd: [] };

            for (const m of markers) {
                if (m.isBomb) {
                    if (isFrozenCell(cardState, m.marker && m.marker.row, m.marker && m.marker.col)) continue;
                    const res = CardLogic.tickBombAt(cardState, gameState, m.marker, playerKey);
                    if (res && res.exploded && res.exploded.length) {
                        events.push({ type: 'bombs_exploded', details: res });
                    }
                } else {
                    const t = (m.marker.data && m.marker.data.type ? m.marker.data.type : '').toUpperCase();
                    const owner = m.marker.owner;
                    const row = m.marker.row;
                    const col = m.marker.col;
                    if (t !== 'FREEZE' && isFrozenCell(cardState, row, col)) continue;
                    if (t === 'ULTIMATE_DESTROY_GOD' && owner === playerKey) {
                        const res = CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'udg_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'udg_expired_start', details: res.expired });
                    } else if (t === 'DESTROY_DRAGON' && owner === playerKey) {
                        const res = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'destroy_dragon_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'destroy_dragon_expired_start', details: res.expired });
                    } else if (t === 'SNIPER' && owner === playerKey) {
                        const res = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'sniper_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'sniper_expired_start', details: res.expired });
                    } else if (t === 'LIGHTNING' && owner === playerKey) {
                        const res = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'lightning_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'lightning_expired_start', details: res.expired });
                    } else if (t === 'WILL_HUNTER_KING' && owner === playerKey) {
                        const res = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'will_hunter_king_destroyed_start', details: res.destroyed });
                        if (res && res.moved && res.moved.length) events.push({ type: 'will_hunter_king_moved_start', details: res.moved });
                        if (res && res.expired && res.expired.length) events.push({ type: 'will_hunter_king_expired_start', details: res.expired });
                    } else if (t === 'OBSERVER' && owner === playerKey) {
                        const res = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.triggered && Number(res.gained) > 0) {
                            const gained = Number(res.gained) || 0;
                            events.push({
                                type: 'observer_triggered_start',
                                details: [{ row, col, owner: playerKey, gained }]
                            });
                            observerStartSummary.triggered.push({ row, col, owner: playerKey, gained });
                        }
                        if (res && res.expired && res.expired.length) {
                            events.push({ type: 'observer_expired_start', details: res.expired });
                            const lost = res.expired.filter((item) => item && item.reason === 'anchor_lost');
                            if (lost.length) observerStartSummary.lost.push(...lost);
                            const durationEnd = res.expired.filter((item) => item && item.reason === 'duration_end');
                            if (durationEnd.length) observerStartSummary.durationEnd.push(...durationEnd);
                        }
                    } else if (t === 'TIME_STOP' && owner === playerKey && typeof CardLogic.processTimeStopEffectsAtTurnStartAnchor === 'function') {
                        const res = CardLogic.processTimeStopEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && Array.isArray(res.triggered) && res.triggered.length) {
                            for (const detail of res.triggered) {
                                events.push({
                                    type: 'time_stop_triggered',
                                    player: playerKey,
                                    row: detail && Number.isInteger(detail.row) ? detail.row : row,
                                    col: detail && Number.isInteger(detail.col) ? detail.col : col,
                                    remainingBonusTurns: Number(detail && detail.totalReservedTurns) || 0
                                });
                            }
                        }
                        if (res && Array.isArray(res.fizzled) && res.fizzled.length) {
                            for (const detail of res.fizzled) {
                                events.push({
                                    type: 'time_stop_fizzled',
                                    player: playerKey,
                                    row: detail && Number.isInteger(detail.row) ? detail.row : row,
                                    col: detail && Number.isInteger(detail.col) ? detail.col : col,
                                    reason: detail && detail.reason ? detail.reason : 'anchor_lost'
                                });
                            }
                        }
                    } else if (t === 'DRAGON' && owner === playerKey) {
                        const res = CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && res.converted && res.converted.length) {
                            addChargeWithTotal(cardState, playerKey, res.converted.length);
                            events.push({ type: 'dragon_converted_start', details: res.converted });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'dragon_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'BREEDING' && owner === playerKey) {
                        const res = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.spawned && res.spawned.length) events.push({ type: 'breeding_spawned_start', details: res.spawned });
                        if (res && res.flipped && res.flipped.length) {
                            addChargeWithTotal(cardState, playerKey, res.flipped.length);
                            events.push({ type: 'breeding_flipped_start', details: res.flipped });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'breeding_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'HYPERACTIVE' || t === 'ESCAPE_HYPERACTIVE' || t === 'INHERITED_HYPERACTIVE' || t === 'EXTREME_HYPERACTIVE') {
                        // Hyperactive-family moves can trigger for both owners; process per-anchor by owner
                        const ownerKey = owner;
                        if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] processing HYPERACTIVE anchor', { row, col, owner: ownerKey, type: t, createdSeq: m.createdSeq });
                        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey,
                            expectedSpecialType: t
                        });
                        if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] hyperactive result', { row, col, owner: ownerKey, type: t, res });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'hyperactive_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.repelled && res.repelled.length) {
                            events.push({ type: 'extreme_hyperactive_repelled_start', details: res.repelled });
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'hyperactive_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'hyperactive_flipped_start', details: res.flipped });
                            hyperAggregated.flipped.push(...res.flipped);
                            hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                            hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                            // Rule: flip count grants charge to the effect owner (clamped to CHARGE_MAX).
                            addChargeWithTotal(cardState, ownerKey, res.flipped.length);
                        }
                    } else if (t === 'ROBOT_VACUUM') {
                        const ownerKey = owner;
                        const res = CardLogic.processRobotVacuumMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'robot_vacuum_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'robot_vacuum_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                        if (res && res.sucked && res.sucked.length) {
                            events.push({ type: 'robot_vacuum_sucked_start', details: res.sucked });
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'robot_vacuum_flipped_start', details: res.flipped });
                            hyperAggregated.flipped.push(...res.flipped);
                            hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                            hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                            addChargeWithTotal(cardState, ownerKey, res.flipped.length);
                        }
                    } else if (t === 'GLUTTONOUS') {
                        const ownerKey = owner;
                        const res = CardLogic.processGluttonousMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'hyperactive_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'hyperactive_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                    } else if (t === 'ULTIMATE_HYPERACTIVE') {
                        const ownerKey = owner;
                        const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'ultimate_hyperactive_moved_start', details: res.moved });
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'ultimate_hyperactive_flipped_start', details: res.flipped });
                            addChargeWithTotal(cardState, ownerKey, res.flipped.length);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'ultimate_hyperactive_destroyed_start', details: res.destroyed });
                        }
                    }
                }
            }

            // After processing all markers, apply REGEN interaction based on aggregated hyperactive flips
            const hyperByOwner = hyperAggregated.flippedByOwner || {};
            const regenTriggered = [];
            const regenCaptureFlips = [];
            const regenCaptureByOwner = { black: [], white: [] };
            for (const ownerKey of ['black', 'white']) {
                const flips = hyperByOwner[ownerKey] || [];
                if (!flips.length) continue;
                if (typeof CardLogic.applyRegenAfterFlips !== 'function') continue;
                const regenRes = CardLogic.applyRegenAfterFlips(cardState, gameState, flips, ownerKey);
                if (regenRes && regenRes.regened && regenRes.regened.length) regenTriggered.push(...regenRes.regened);
                if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                    regenCaptureFlips.push(...regenRes.captureFlips);
                    regenCaptureByOwner[ownerKey] = regenCaptureByOwner[ownerKey] || [];
                    regenCaptureByOwner[ownerKey].push(...regenRes.captureFlips);
                }
            }
            if (regenCaptureFlips.length && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                CardLogic.clearHyperactiveAtPositions(cardState, regenCaptureFlips);
            }
            if (regenTriggered.length) {
                events.push({ type: 'regen_triggered_start', details: regenTriggered });
            }
            if (regenCaptureFlips.length) {
                // Capture flips grant charge to the regen owner (clamped to CHARGE_MAX).
                for (const ownerKey of ['black', 'white']) {
                    const arr = regenCaptureByOwner[ownerKey] || [];
                    if (!arr.length) continue;
                    addChargeWithTotal(cardState, ownerKey, arr.length);
                }
                events.push({ type: 'regen_capture_flipped_start', details: regenCaptureFlips });
            }

            if (typeof CardLogic.processTrapEffects === 'function') {
                const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: true });
                pushTrapEvents(events, trapRes);
                emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
            }

            const durationEndSet = new Set((observerStartSummary.durationEnd || []).map((item) => `${item.row},${item.col}:${item.owner || ''}`));
            const removedAtStart = getRemovedObserverMarkers(observerMarkersBeforeStart, snapshotObserverMarkers(cardState))
                .filter((item) => !durationEndSet.has(`${item.row},${item.col}:${item.owner || ''}`));
            if (removedAtStart.length) {
                observerStartSummary.lost.push(...removedAtStart.map((item) => ({
                    row: item.row,
                    col: item.col,
                    owner: item.owner || null,
                    reason: 'removed'
                })));
            }

            // Observer bubble priority (start turn): anchor lost > trigger success.
            const primaryLost = observerStartSummary.lost[0] || null;
            const primaryTriggered = observerStartSummary.triggered[0] || null;
            if (primaryLost) {
                emitObserverBubblePresentation(CardLogic, cardState, {
                    player: primaryLost.owner || playerKey,
                    row: primaryLost.row,
                    col: primaryLost.col,
                    text: OBSERVER_LOST_LINE,
                    reason: 'anchor_lost'
                });
            } else if (primaryTriggered) {
                const gained = Number(primaryTriggered.gained) || 0;
                if (typeof CardLogic.emitPresentationEvent === 'function') {
                    CardLogic.emitPresentationEvent(cardState, {
                        type: 'OBSERVER_TRIGGERED',
                        player: playerKey,
                        row: primaryTriggered.row,
                        col: primaryTriggered.col,
                        gained,
                        text: `布石+${gained} 観測が捗る`,
                        meta: { owner: playerKey, reason: 'triggered' }
                    });
                }
            }

            const newPresentationEvents = Array.isArray(cardState.presentationEvents)
                ? cardState.presentationEvents.slice(presentationStartIndex)
                : [];
            const workDurationEndSet = new Set(
                newPresentationEvents
                    .filter((ev) => isWorkDurationEndPresentationEvent(ev))
                    .map((ev) => {
                        const row = Number(ev && ev.row);
                        const col = Number(ev && ev.col);
                        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
                        const owner = normalizePlayerKey((ev && ev.player) || (ev && ev.owner) || (ev && ev.meta && ev.meta.owner));
                        return `${row},${col}:${owner || ''}`;
                    })
                    .filter((key) => !!key)
            );

            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeStart, {
                durationEndSet: workDurationEndSet,
                presentationStartIndex
            });

            // Emit timer update events when remaining turns changed.
            try {
                const afterMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of afterMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    const before = timerSnapshot.get(key);
                    if (isBombCategoryMarker(m)) {
                        if (typeof m.data.remainingTurns !== 'number') continue;
                        if (!before || before.timer !== m.data.remainingTurns) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: 'TIME_BOMB', timer: m.data.remainingTurns, owner: m.owner }
                                });
                            }
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        if (typeof m.data.remainingOwnerTurns !== 'number') continue;
                        if (!before || before.timer !== m.data.remainingOwnerTurns) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: m.data.type || null, timer: m.data.remainingOwnerTurns, owner: m.owner }
                                });
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }

            delete cardState._frozenCellsActiveAtTurnStart;

        }
    }

    function applyCardUsagePhase(CardLogic, cardState, gameState, playerKey, action, events, prng) {
        const p = prng || undefined;
        const observerMarkersBeforeUsage = snapshotObserverMarkers(cardState);
        const workMarkersBeforeUsage = snapshotWorkMarkers(cardState);
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.useCardId) {
                const mergedDebugOptions = (action && action.debugOptions && typeof action.debugOptions === 'object')
                    ? { ...action.debugOptions }
                    : {};
                if (p && typeof p.random === 'function') {
                    mergedDebugOptions.prng = p;
                }
                const ok = CardLogic.applyCardUsage(
                    cardState,
                    gameState,
                    playerKey,
                    action.useCardId,
                    action.useCardOwnerKey,
                    mergedDebugOptions
                );
                if (!ok) {
                    throw new Error('applyCardUsage failed');
                }
                events.push({ type: 'card_used', player: playerKey, cardId: action.useCardId });

                // Immediate-effect card: TREASURE_BOX
                // On use, gain random charge [1..3] and clear pending (no placement dependency).
                const pendingType = (typeof CardLogic.getPendingEffectType === 'function')
                    ? CardLogic.getPendingEffectType(cardState, playerKey)
                    : (cardState && cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey]
                        ? cardState.pendingEffectByPlayer[playerKey].type
                        : null);
                if (pendingType === 'TREASURE_BOX') {
                    const rnd = (p && typeof p.random === 'function') ? p.random() : Math.random();
                    const gained = 1 + Math.floor(Math.max(0, Math.min(0.999999, rnd)) * 3);
                    addChargeWithTotal(cardState, playerKey, gained);
                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({ type: 'treasure_box_gain', player: playerKey, gained });
                }

                if (pendingType === 'CORNER_TRIBUTE') {
                    const opponentKey = playerKey === 'black' ? 'white' : 'black';
                    const opponentCornerCount = (typeof CardLogic.countOccupiedCornersForPlayer === 'function')
                        ? CardLogic.countOccupiedCornersForPlayer(cardState, gameState, opponentKey)
                        : 0;
                    const stolen = transferChargeBetweenPlayers(cardState, opponentKey, playerKey, 20, 'corner_tribute');
                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({
                        type: 'corner_tribute_resolved',
                        player: playerKey,
                        opponent: opponentKey,
                        stolen,
                        opponentCornerCount
                    });
                }

                if (pendingType === 'RIBO_WILL') {
                    const res = (typeof CardLogic.armRiboWillEffect === 'function')
                        ? CardLogic.armRiboWillEffect(cardState, playerKey)
                        : null;
                    if (!res || res.applied !== true) {
                        throw new Error('RIBO_WILL resolve failed');
                    }
                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({
                        type: 'ribo_will_resolved',
                        player: playerKey,
                        gained: Number(res.gained) || 0,
                        repaymentAmount: Number(res.repaymentAmount) || 0,
                        remainingOwnerTurns: Number(res.remainingOwnerTurns) || 0
                    });
                }

                if (pendingType === 'TIME_STOP_GOD') {
                    const res = (typeof CardLogic.resolveTimeStopGodUsage === 'function')
                        ? CardLogic.resolveTimeStopGodUsage(cardState, gameState, playerKey, p)
                        : { applied: false, destroyed: [], destroyedCount: 0, requestedCount: 3 };
                    events.push({
                        type: 'time_stop_god_cost_resolved',
                        player: playerKey,
                        destroyed: Array.isArray(res && res.destroyed) ? res.destroyed.slice() : [],
                        destroyedCount: Number(res && res.destroyedCount) || 0,
                        requestedCount: Number(res && res.requestedCount) || 0
                    });
                }

                // Immediate-effect card: REBUILD_WILL
                // On use, destroy all remaining hand cards and draw 3 cards immediately.
                if (pendingType === 'REBUILD_WILL') {
                    const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
                        ? cardState.hands[playerKey]
                        : null;
                    const destroyedCount = hand ? hand.length : 0;
                    if (destroyedCount > 0) {
                        const destroyedCards = hand.splice(0, hand.length);
                        if (!Array.isArray(cardState.discard)) cardState.discard = [];
                        cardState.discard.push(...destroyedCards);
                    }

                    if (typeof CardLogic.emitPresentationEvent === 'function') {
                        CardLogic.emitPresentationEvent(cardState, {
                            type: 'HAND_CLEAR',
                            player: playerKey,
                            count: destroyedCount,
                            reason: 'rebuild_will'
                        });
                    }

                    let drawnCount = 0;
                    if (typeof CardLogic.commitDraw === 'function') {
                        for (let i = 0; i < 3; i++) {
                            const drawnCardId = CardLogic.commitDraw(cardState, playerKey, p);
                            if (!drawnCardId) break;
                            drawnCount++;
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'DRAW_CARD',
                                    player: playerKey,
                                    cardId: drawnCardId,
                                    count: 1
                                });
                            }
                        }
                    }

                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({ type: 'rebuild_will_resolved', player: playerKey, destroyedCount, drawnCount });
                }

                // Immediate-effect card: SUPPLY_WILL
                // On use, draw 2 cards immediately (subject to deck shortage and hand limit).
                if (pendingType === 'SUPPLY_WILL') {
                    let drawnCount = 0;
                    if (typeof CardLogic.commitDraw === 'function') {
                        for (let i = 0; i < 2; i++) {
                            const drawnCardId = CardLogic.commitDraw(cardState, playerKey, p);
                            if (!drawnCardId) break;
                            drawnCount++;
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'DRAW_CARD',
                                    player: playerKey,
                                    cardId: drawnCardId,
                                    count: 1
                                });
                            }
                        }
                    }

                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({ type: 'supply_will_resolved', player: playerKey, drawnCount });
                }

                // Immediate side effect card: GLUTTONOUS_WILL
                // On use, destroy all remaining hand cards immediately (pending stays for next placement).
                if (pendingType === 'GLUTTONOUS_WILL') {
                    const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
                        ? cardState.hands[playerKey]
                        : null;
                    const destroyedCount = hand ? hand.length : 0;
                    if (destroyedCount > 0) {
                        const destroyedCards = hand.splice(0, hand.length);
                        if (!Array.isArray(cardState.discard)) cardState.discard = [];
                        cardState.discard.push(...destroyedCards);
                    }

                    if (typeof CardLogic.emitPresentationEvent === 'function') {
                        CardLogic.emitPresentationEvent(cardState, {
                            type: 'HAND_CLEAR',
                            player: playerKey,
                            count: destroyedCount,
                            reason: 'gluttonous_will'
                        });
                    }

                    events.push({ type: 'gluttonous_will_hand_destroyed', player: playerKey, destroyedCount });
                }

                if (pendingType === 'LOSS_WILL') {
                    const res = (typeof CardLogic.applyLossWill === 'function')
                        ? CardLogic.applyLossWill(cardState, gameState, playerKey)
                        : { applied: false, removedCount: 0 };
                    if (!res || res.applied !== true) {
                        throw new Error('LOSS_WILL resolve failed');
                    }
                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    events.push({ type: 'loss_will_resolved', player: playerKey, removedCount: Number(res.removedCount) || 0 });
                }

            }
        } finally {
            emitObserverLostBubbleFromSnapshots(CardLogic, cardState, observerMarkersBeforeUsage, 'removed_during_card_usage');
            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeUsage, {
                presentationStartIndex
            });
        }
    }

    function resolveSafeCardContext(CardLogic, cardState) {
        let ctx = null;
        try {
            const ctxHelper = (typeof require === 'function') ? require('../logic/context') : (typeof globalThis !== 'undefined' ? globalThis.GameLogicContext : null);
            if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
                ctx = ctxHelper.getSafeCardContext(cardState);
            }
        } catch (e) { /* ignore and fallback */ }
        if (!ctx) {
            try { ctx = CardLogic.getCardContext(cardState); } catch (e) { ctx = { protectedStones: [], permaProtectedStones: [], bombs: [] }; }
        }
        return ctx;
    }

    function hasContinuationMovesForPendingType(Core, CardLogic, cardState, gameState, playerKey, pendingType) {
        const ctx = resolveSafeCardContext(CardLogic, cardState);
        const player = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        if (pendingType === 'LAST_RESORT' && typeof Core.getFreePlacementMoves === 'function') {
            const moves = Core.getFreePlacementMoves(gameState, player, ctx);
            return Array.isArray(moves) && moves.length > 0;
        }
        const moves = Core.getLegalMoves(gameState, player, ctx);
        return Array.isArray(moves) && moves.length > 0;
    }

    function clearMultiPlaceStateForPlayer(cardState, playerKey) {
        if (!cardState) return;
        if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = { black: 0, white: 0 };
        if (!cardState.infinitePlaceActiveByPlayer) cardState.infinitePlaceActiveByPlayer = { black: false, white: false };
        if (!cardState.multiPlaceSourceTypeByPlayer) cardState.multiPlaceSourceTypeByPlayer = { black: null, white: null };
        cardState.extraPlaceRemainingByPlayer[playerKey] = 0;
        cardState.infinitePlaceActiveByPlayer[playerKey] = false;
        cardState.multiPlaceSourceTypeByPlayer[playerKey] = null;
    }

    function getActionCellOwner(gameState, row, col) {
        if (!gameState) return null;

        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        if (Array.isArray(boardRow) && Number.isInteger(col) && col >= 0 && col < boardRow.length) {
            return boardRow[col];
        }

        const expansion = gameState.boardExpansion;
        const cells = Array.isArray(expansion && expansion.cells)
            ? expansion.cells
            : ((expansion && expansion.active) ? [expansion] : []);

        for (const cell of cells) {
            if (!cell) continue;
            const cellRow = Number(cell.row);
            let cellCol = Number.isInteger(cell.col) ? cell.col : null;
            if (!Number.isInteger(cellCol)) {
                if (cell.side === 'left') cellCol = -1;
                else if (cell.side === 'right') cellCol = 8;
            }
            if (cellRow !== row || cellCol !== col) continue;
            const owner = Number(cell.owner);
            return Number.isFinite(owner) ? owner : null;
        }

        return null;
    }

    function applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events) {
        if (!CardLogic || typeof CardLogic.processTrapEffects !== 'function') return;
        const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: false });
        pushTrapEvents(events, trapRes);
        emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
    }

    function applyActionPhase(CardLogic, Core, cardState, gameState, playerKey, action, events, prng, BoardOps) {
        const p = prng || undefined;

        const observerMarkersBeforeAction = snapshotObserverMarkers(cardState);
        const workMarkersBeforeAction = snapshotWorkMarkers(cardState);
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.type === 'pass') {
                const player = playerKey === 'black' ? Core.BLACK : Core.WHITE;
                const ctx = resolveSafeCardContext(CardLogic, cardState);
                const legalMoves = Core.getLegalMoves(gameState, player, ctx);
                if (legalMoves.length > 0) {
                    throw new Error('Illegal pass: legal moves available');
                }
                // Pass policy: abandon any unresolved card effect for this turn.
                if (cardState && cardState.pendingEffectByPlayer) {
                    cardState.pendingEffectByPlayer[playerKey] = null;
                }
                const newState = Core.applyPass(gameState);
                Object.assign(gameState, newState);
                const timeStopPassRes = consumeTimeStopCompletedTurn(CardLogic, cardState, playerKey);
                if (timeStopPassRes.continueTurn === true) {
                    gameState.currentPlayer = player;
                    gameState.consecutivePasses = 0;
                    if (cardState) {
                        cardState.lastTurnStartedFor = null;
                    }
                }
                events.push({ type: 'pass', player: playerKey });
            } else if (action.type === 'use_card') {
            events.push({ type: 'card_used_only', player: playerKey, cardId: action.useCardId || null });
            return;
        } else if (action.type === 'cancel_card') {
            const res = (typeof CardLogic.cancelPendingSelection === 'function')
                ? CardLogic.cancelPendingSelection(cardState, playerKey, action.cancelOptions)
                : { canceled: false, reason: 'not_supported' };
            events.push({ type: 'card_cancelled', player: playerKey, canceled: !!res.canceled, reason: res.reason || null, cardId: res.cardId || null });
            return;
        } else if (action.type === 'destroy_hand_card') {
            const res = (typeof CardLogic.destroyHandCard === 'function')
                ? CardLogic.destroyHandCard(cardState, playerKey, action.destroyCardId, action.destroyOptions)
                : { applied: false, reason: 'not_supported' };
            if (!res || !res.applied) {
                throw new Error(`destroy_hand_card failed${res && res.reason ? `: ${res.reason}` : ''}`);
            }
            emitHandRemovePresentation(CardLogic, cardState, {
                player: playerKey,
                count: 1,
                reason: 'destroy_hand_card',
                cardId: res.destroyedCardId || action.destroyCardId || null
            });
            events.push({ type: 'hand_card_destroyed', player: playerKey, cardId: res.destroyedCardId || action.destroyCardId || null });
            return;
        } else if (action.type === 'place') {
            // 3.5) Optional pre-placement selection effects (for cards that require a target)
            const pending = cardState.pendingEffectByPlayer[playerKey];
            if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget) {
                const destroyed = CardLogic.applyDestroyEffect(
                    cardState,
                    gameState,
                    playerKey,
                    action.destroyTarget.row,
                    action.destroyTarget.col
                );
                events.push({ type: 'destroy_selected', player: playerKey, target: action.destroyTarget, destroyed });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget == null) {
                throw new Error('DESTROY_ONE_STONE requires destroyTarget before placement');
            }
            if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget) {
                const res = CardLogic.applyStrongWindWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.strongWindTarget.row,
                    action.strongWindTarget.col,
                    p
                );
                events.push({ type: 'strong_wind_selected', player: playerKey, target: action.strongWindTarget, applied: !!(res && res.applied), from: res && res.from ? res.from : null, to: res && res.to ? res.to : null });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget == null) {
                throw new Error('STRONG_WIND_WILL requires strongWindTarget before placement');
            }
            if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget) {
                const res = CardLogic.applySuperBuoyancyWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.superBuoyancyTarget.row,
                    action.superBuoyancyTarget.col
                );
                events.push({
                    type: 'super_buoyancy_selected',
                    player: playerKey,
                    target: action.superBuoyancyTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                return;
            } else if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget == null) {
                throw new Error('SUPER_BUOYANCY_WILL requires superBuoyancyTarget before placement');
            }
            if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget) {
                const res = CardLogic.applySuperGravityWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.superGravityTarget.row,
                    action.superGravityTarget.col
                );
                events.push({
                    type: 'super_gravity_selected',
                    player: playerKey,
                    target: action.superGravityTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                return;
            } else if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget == null) {
                throw new Error('SUPER_GRAVITY_WILL requires superGravityTarget before placement');
            }
            if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget) {
                const res = pending.type === 'CELL_TELEPORT_WILL'
                    ? CardLogic.applyCellTeleportWill(
                        cardState,
                        gameState,
                        playerKey,
                        action.teleportTarget.row,
                        action.teleportTarget.col,
                        p
                    )
                    : CardLogic.applyTeleportWill(
                        cardState,
                        gameState,
                        playerKey,
                        action.teleportTarget.row,
                        action.teleportTarget.col,
                        p
                    );
                events.push({
                    type: 'teleport_selected',
                    player: playerKey,
                    cardType: pending.type,
                    target: action.teleportTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    createdDestination: !!(res && res.createdDestination)
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget == null) {
                throw new Error(`${pending.type} requires teleportTarget before placement`);
            }
            if (pending && pending.type === 'SACRIFICE_WILL' && action.sacrificeTarget) {
                const res = CardLogic.applySacrificeWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.sacrificeTarget.row,
                    action.sacrificeTarget.col
                );
                events.push({ type: 'sacrifice_selected', player: playerKey, target: action.sacrificeTarget, applied: !!(res && res.applied), gained: res && res.gained ? res.gained : 0, completed: !!(res && res.completed) });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'SACRIFICE_WILL' && action.sacrificeTarget == null) {
                throw new Error('SACRIFICE_WILL requires sacrificeTarget before placement');
            }
            if (pending && pending.type === 'SELL_CARD_WILL' && action.sellCardId) {
                const res = CardLogic.applySellCardWill(
                    cardState,
                    playerKey,
                    action.sellCardId
                );
                events.push({ type: 'sell_selected', player: playerKey, soldCardId: action.sellCardId, applied: !!(res && res.applied), gained: res && res.gained ? res.gained : 0 });
                if (res && res.applied) {
                    emitHandRemovePresentation(CardLogic, cardState, {
                        player: playerKey,
                        count: 1,
                        reason: 'sell_card_will',
                        cardId: res.soldCardId || action.sellCardId || null
                    });
                }
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'SELL_CARD_WILL' && action.sellCardId == null) {
                throw new Error('SELL_CARD_WILL requires sellCardId before placement');
            }
            if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId) {
                const res = CardLogic.applyHeavenBlessingChoice(
                    cardState,
                    playerKey,
                    action.heavenBlessingCardId
                );
                events.push({
                    type: 'heaven_blessing_selected',
                    player: playerKey,
                    selectedCardId: action.heavenBlessingCardId,
                    applied: !!(res && res.applied)
                });
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId == null) {
                throw new Error('HEAVEN_BLESSING requires heavenBlessingCardId before placement');
            }
            if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex != null) {
                const res = CardLogic.applyCondemnWill(
                    cardState,
                    playerKey,
                    action.condemnTargetIndex
                );
                events.push({
                    type: 'condemn_selected',
                    player: playerKey,
                    condemnTargetIndex: action.condemnTargetIndex,
                    applied: !!(res && res.applied),
                    destroyedCardId: (res && res.destroyedCardId) ? res.destroyedCardId : null
                });
                if (res && res.applied) {
                    const opponentKey = playerKey === 'black' ? 'white' : 'black';
                    emitHandRemovePresentation(CardLogic, cardState, {
                        player: opponentKey,
                        count: 1,
                        reason: 'condemn_will',
                        cardId: (res && res.destroyedCardId) ? res.destroyedCardId : null
                    });
                }
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex == null) {
                throw new Error('CONDEMN_WILL requires condemnTargetIndex before placement');
            }
            if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget) {
                const res = CardLogic.applyTemptWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.temptTarget.row,
                    action.temptTarget.col
                );
                events.push({ type: 'tempt_selected', player: playerKey, target: action.temptTarget, applied: !!(res && res.applied) });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget == null) {
                throw new Error('TEMPT_WILL requires temptTarget before placement');
            }
            if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget) {
                const swapped = CardLogic.applySwapEffect(
                    cardState,
                    gameState,
                    playerKey,
                    action.swapTarget.row,
                    action.swapTarget.col
                );
                events.push({ type: 'swap_selected', player: playerKey, row: action.swapTarget.row, col: action.swapTarget.col, swapped });
                if (!swapped) {
                    throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
                }
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget == null) {
                const hasLegacyBoardClickTarget = Number.isInteger(action.row) && Number.isInteger(action.col);
                if (!hasLegacyBoardClickTarget) {
                    throw new Error('SWAP_WITH_ENEMY requires swapTarget before placement');
                }
            }
            if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget) {
                const res = CardLogic.applyPositionSwapWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.positionSwapTarget.row,
                    action.positionSwapTarget.col
                );
                events.push({
                    type: res && res.completed ? 'position_swap_selected' : 'position_swap_first_selected',
                    player: playerKey,
                    target: action.positionSwapTarget,
                    from: res && res.from ? res.from : (res && res.firstTarget ? res.firstTarget : null),
                    to: res && res.to ? res.to : null,
                    applied: !!(res && res.applied),
                    completed: !!(res && res.completed)
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget == null) {
                throw new Error('POSITION_SWAP_WILL requires positionSwapTarget before placement');
            }
            if (pending && pending.type === 'TRAP_WILL' && action.trapTarget) {
                const res = CardLogic.applyTrapWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.trapTarget.row,
                    action.trapTarget.col
                );
                events.push({ type: 'trap_selected', player: playerKey, applied: !!(res && res.applied) });
                if (res && res.applied) {
                    handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                }
                return;
            } else if (pending && pending.type === 'TRAP_WILL' && action.trapTarget == null) {
                throw new Error('TRAP_WILL requires trapTarget before placement');
            }
            if (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') && action.guardTarget) {
                const res = CardLogic.applyGuardWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.guardTarget.row,
                    action.guardTarget.col
                );
                events.push({ type: 'guard_selected', player: playerKey, target: action.guardTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') && action.guardTarget == null) {
                throw new Error('GUARD-like card requires guardTarget before placement');
            }
            if (pending && pending.type === 'HYPERACTIVE_INHERIT_WILL' && action.hyperactiveInheritTarget) {
                const res = CardLogic.applyHyperactiveInheritWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.hyperactiveInheritTarget.row,
                    action.hyperactiveInheritTarget.col
                );
                events.push({ type: 'hyperactive_inherit_selected', player: playerKey, target: action.hyperactiveInheritTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'HYPERACTIVE_INHERIT_WILL' && action.hyperactiveInheritTarget == null) {
                throw new Error('HYPERACTIVE_INHERIT_WILL requires hyperactiveInheritTarget before placement');
            }
            if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget) {
                const applyExtendLife = pending.type === 'EXTEND_LIFE_GOD'
                    ? CardLogic.applyExtendLifeGod
                    : CardLogic.applyExtendLifeWill;
                const res = applyExtendLife(
                    cardState,
                    gameState,
                    playerKey,
                    action.extendTarget.row,
                    action.extendTarget.col
                );
                events.push({
                    type: 'extend_life_selected',
                    player: playerKey,
                    target: action.extendTarget,
                    applied: !!(res && res.applied),
                    cardType: pending.type,
                    multiplier: res && Number.isFinite(res.multiplier) ? Number(res.multiplier) : (pending.type === 'EXTEND_LIFE_GOD' ? 4 : 2),
                    details: res ? { previous: res.previousRemainingOwnerTurns, current: res.newRemainingOwnerTurns } : null
                });
                return;
            } else if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget == null) {
                throw new Error(`${pending.type} requires extendTarget before placement`);
            }
            if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget) {
                const res = CardLogic.applyCorrosionWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.corrosionTarget.row,
                    action.corrosionTarget.col
                );
                events.push({
                    type: 'corrosion_will_resolved',
                    player: playerKey,
                    target: action.corrosionTarget,
                    applied: !!(res && res.applied),
                    affectedCount: Number(res && res.affectedCount) || 0,
                    details: Array.isArray(res && res.details) ? res.details : []
                });
                return;
            } else if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget == null) {
                throw new Error('CORROSION_WILL requires corrosionTarget before placement');
            }
            if (pending && pending.type === 'TIME_BOMB' && action.bombTarget) {
                const res = CardLogic.applyTimeBombWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.bombTarget.row,
                    action.bombTarget.col
                );
                events.push({ type: 'time_bomb_selected', player: playerKey, target: action.bombTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'TIME_BOMB' && action.bombTarget == null) {
                throw new Error('TIME_BOMB requires bombTarget before placement');
            }
            if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget) {
                const res = CardLogic.applyCloneWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.cloneTarget.row,
                    action.cloneTarget.col,
                    prng
                );
                events.push({
                    type: 'clone_selected',
                    player: playerKey,
                    target: action.cloneTarget,
                    applied: !!(res && res.applied),
                    details: (res && Array.isArray(res.spawned)) ? res.spawned : [],
                    spawned: (res && Array.isArray(res.spawned)) ? res.spawned : []
                });
                return;
            } else if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget == null) {
                throw new Error('CLONE_WILL requires cloneTarget before placement');
            }
            if (pending && pending.type === 'SPLIT_WILL' && action.splitTarget) {
                const res = CardLogic.applySplitWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.splitTarget.row,
                    action.splitTarget.col,
                    prng
                );
                events.push({
                    type: 'split_selected',
                    player: playerKey,
                    target: action.splitTarget,
                    applied: !!(res && res.applied),
                    details: (res && Array.isArray(res.spawned)) ? res.spawned : [],
                    spawned: (res && Array.isArray(res.spawned)) ? res.spawned : [],
                    durationChanges: (res && Array.isArray(res.durationChanges)) ? res.durationChanges : []
                });
                return;
            } else if (pending && pending.type === 'SPLIT_WILL' && action.splitTarget == null) {
                throw new Error('SPLIT_WILL requires splitTarget before placement');
            }
            if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget) {
                const isGodExpansion = pending.type === 'BOARD_EXPANSION_GOD';
                const applyFn = (isGodExpansion && typeof CardLogic.applyBoardExpansionGod === 'function')
                    ? CardLogic.applyBoardExpansionGod
                    : CardLogic.applyBoardExpansionWill;
                const res = applyFn(
                    cardState,
                    gameState,
                    playerKey,
                    action.expansionTarget.row,
                    action.expansionTarget.col
                );
                if (isGodExpansion && res && res.applied && res.completed === false) {
                    events.push({
                        type: 'board_expansion_first_selected',
                        player: playerKey,
                        cardType: pending.type,
                        target: action.expansionTarget,
                        selectedCount: Number(res.selectedCount) || 1,
                        maxSelections: Number(res.maxSelections) || 2,
                        remainingSelections: Number(res.remainingSelections) || 1,
                        selectedTargets: Array.isArray(res.selectedTargets) ? res.selectedTargets : null,
                        applied: true,
                        completed: false
                    });
                } else {
                    events.push({
                        type: 'board_expansion_selected',
                        player: playerKey,
                        cardType: pending.type,
                        target: action.expansionTarget,
                        side: res && res.side ? res.side : null,
                        row: res && Number.isInteger(res.row) ? res.row : null,
                        added: (res && Array.isArray(res.added)) ? res.added : null,
                        selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
                        sources: (res && Array.isArray(res.sources)) ? res.sources : null,
                        applied: !!(res && res.applied),
                        completed: !(res && res.completed === false)
                    });
                }
                return;
            } else if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget == null) {
                throw new Error(`${pending.type} requires expansionTarget before placement`);
            }
            if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget) {
                const res = CardLogic.applyBlockadeWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.blockadeTarget.row,
                    action.blockadeTarget.col
                );
                events.push({ type: 'blockade_selected', player: playerKey, target: action.blockadeTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget == null) {
                throw new Error('BLOCKADE_WILL requires blockadeTarget before placement');
            }
            if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget) {
                const res = CardLogic.applyMeteorWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.meteorTarget.row,
                    action.meteorTarget.col
                );
                events.push({
                    type: 'meteor_selected',
                    player: playerKey,
                    target: action.meteorTarget,
                    applied: !!(res && res.applied),
                    destroyed: !!(res && res.destroyed)
                });
                return;
            } else if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget == null) {
                throw new Error('METEOR_WILL requires meteorTarget before placement');
            }
            if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget) {
                const res = CardLogic.applyFreezeWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.freezeTarget.row,
                    action.freezeTarget.col
                );
                events.push({ type: 'freeze_selected', player: playerKey, target: action.freezeTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget == null) {
                throw new Error('FREEZE_WILL requires freezeTarget before placement');
            }

            // Determine flips using a safe context helper when possible
            const ctx = resolveSafeCardContext(CardLogic, cardState);
            const player = playerKey === 'black' ? Core.BLACK : Core.WHITE;

            const blockedCells = (ctx && Array.isArray(ctx.blockedCells)) ? ctx.blockedCells : [];
            const blockedSet = blockedCells.length ? new Set(blockedCells.map(p => `${p.row},${p.col}`)) : null;
            if (blockedSet && blockedSet.has(`${action.row},${action.col}`)) {
                throw new Error('Illegal move: blocked cell');
            }

            // SWAP_WITH_ENEMY selection via board click (legacy browser path).
            // Treat as selection-only action (same as action.swapTarget).
            const pendingType = CardLogic.getPendingEffectType(cardState, playerKey);
            if (pendingType === 'SWAP_WITH_ENEMY') {
                const targetCell = getActionCellOwner(gameState, action.row, action.col);
                if (targetCell === -player) {
                    const swapped = CardLogic.applySwapEffect(cardState, gameState, playerKey, action.row, action.col);
                    events.push({ type: 'swap_selected', player: playerKey, row: action.row, col: action.col, swapped });
                    if (!swapped) {
                        throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
                    }
                    applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                    handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                    return;
                } else {
                    throw new Error('SWAP_WITH_ENEMY requires selecting an enemy stone before placement');
                }
            }

            let flips = [];
            let tabooReverseApplied = false;
            let tabooReverseResult = null;

            if (pendingType === 'TABOO_REVERSE_WILL' && typeof CardLogic.pickTabooReverseFlips === 'function') {
                const normalFlips = Core.getFlipsWithContext(gameState, action.row, action.col, player, ctx);
                tabooReverseResult = CardLogic.pickTabooReverseFlips(cardState, gameState, playerKey, action.row, action.col, p);
                if (tabooReverseResult && tabooReverseResult.applied && Array.isArray(tabooReverseResult.flips) && tabooReverseResult.flips.length > 0) {
                    flips = tabooReverseResult.flips.map((one) => [one.row, one.col]);
                    tabooReverseApplied = true;
                } else {
                    flips = normalFlips;
                }
            } else {
                flips = Core.getFlipsWithContext(gameState, action.row, action.col, player, ctx);
            }
            let flipCount = flips.length;

            // For legality, require flips > 0 unless the pending card explicitly allows free placement.
            // TABOO_REVERSE_WILL first tries taboo flips, and falls back to normal sandwich flips when taboo is unavailable.
            const freePlacement = !!(
                CardLogic &&
                typeof CardLogic.isFreePlacementPendingType === 'function' &&
                CardLogic.isFreePlacementPendingType(pendingType)
            );
            if (flipCount === 0 && !freePlacement) {
                throw new Error('Illegal move: no flips and not free placement');
            }

            // Save pre-extra to determine if this placement consumes an existing extra place
            const preExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;

            const turnNumberBeforePlace = Number(gameState.turnNumber || 0);

            let flipEvadeResult = null;

            if (BoardOps && typeof BoardOps.spawnAt === 'function') {
                const spawnCause = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'FREE_PLACEMENT' : 'SYSTEM';
                const spawnReason = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'free_placement_place' : 'standard_place';
                const spawnMeta = {};
                if (pendingType === 'GOLD_STONE') {
                    spawnMeta.special = 'GOLD';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'RAINBOW_STONE') {
                    spawnMeta.special = 'RAINBOW';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'SILVER_STONE') {
                    spawnMeta.special = 'SILVER';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'CRYSTAL_STONE') {
                    spawnMeta.special = 'CRYSTAL';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'CROSS_BOMB') {
                    // Show bomb-like special visual briefly before immediate cross explosion.
                    spawnMeta.special = 'CROSS_BOMB';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'X_BOMB') {
                    // Reuse bomb-like visual before immediate diagonal cross explosion.
                    spawnMeta.special = 'X_BOMB';
                    spawnMeta.owner = playerKey;
                }
                BoardOps.spawnAt(cardState, gameState, action.row, action.col, playerKey, spawnCause, spawnReason, spawnMeta);
                if (flipCount > 0 && typeof CardLogic.resolveHyperactiveFlipEvasion === 'function') {
                    flipEvadeResult = CardLogic.resolveHyperactiveFlipEvasion(cardState, gameState, flips, playerKey, p);
                    if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
                        flips = flipEvadeResult.remainingFlips.slice();
                        flipCount = flips.length;
                    }
                }
                const flipCause = tabooReverseApplied ? 'TABOO_REVERSE_WILL' : 'SYSTEM';
                const flipReason = tabooReverseApplied ? 'taboo_reverse_flip' : 'standard_flip';
                for (const [fr, fc] of flips) {
                    BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, flipCause, flipReason);
                }
            } else {
                const newState = Core.applyMove(gameState, { row: action.row, col: action.col, flips });
                Object.assign(gameState, newState);
            }

            if (flipEvadeResult) {
                const movedList = Array.isArray(flipEvadeResult.moved) ? flipEvadeResult.moved : [];
                const destroyedList = Array.isArray(flipEvadeResult.destroyed) ? flipEvadeResult.destroyed : [];

                const ultimateMoved = movedList.filter((detail) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
                const hyperMoved = movedList.filter((detail) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
                if (hyperMoved.length) {
                    events.push({ type: 'hyperactive_moved_immediate', details: hyperMoved });
                }
                if (ultimateMoved.length) {
                    events.push({ type: 'ultimate_hyperactive_moved_immediate', details: ultimateMoved });
                }

                const ultimateDestroyed = destroyedList.filter((detail) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
                const hyperDestroyed = destroyedList.filter((detail) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
                if (hyperDestroyed.length) {
                    events.push({ type: 'hyperactive_destroyed_immediate', details: hyperDestroyed });
                }
                if (ultimateDestroyed.length) {
                    events.push({ type: 'ultimate_hyperactive_destroyed_immediate', details: ultimateDestroyed });
                }
            }

            events.push({ type: 'place', player: playerKey, row: action.row, col: action.col, flips: flips.slice() });
            if (tabooReverseApplied) {
                events.push({
                    type: 'taboo_reverse_flipped',
                    details: (tabooReverseResult && Array.isArray(tabooReverseResult.flips)) ? tabooReverseResult.flips.slice() : [],
                    direction: (tabooReverseResult && Array.isArray(tabooReverseResult.direction)) ? tabooReverseResult.direction.slice() : null
                });
            }

            const bonusKey = `${action.row},${action.col}`;
            const bonusMap = (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null;
            const pendingPlacementType = (typeof CardLogic.getPendingEffectType === 'function')
                ? CardLogic.getPendingEffectType(cardState, playerKey)
                : (cardState && cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey]
                    ? cardState.pendingEffectByPlayer[playerKey].type
                    : null);
            const numberCellMultiplierConfig = (
                pendingPlacementType &&
                CardLogic &&
                CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS &&
                CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS[pendingPlacementType]
            ) || null;
            let boardBonusGained = 0;
            if (!cardState.boardBonusConsumedByCell || typeof cardState.boardBonusConsumedByCell !== 'object') {
                cardState.boardBonusConsumedByCell = {};
            }
            const consumedMap = cardState.boardBonusConsumedByCell;
            const bonusValue = bonusMap ? Number(bonusMap[bonusKey] || 0) : 0;
            if (bonusValue > 0 && consumedMap[bonusKey] !== true) {
                consumedMap[bonusKey] = true;
                const appliedBonus = numberCellMultiplierConfig
                    ? bonusValue * Number(numberCellMultiplierConfig.multiplier || 1)
                    : bonusValue;
                const gained = addChargeWithTotal(cardState, playerKey, appliedBonus);
                boardBonusGained = gained;
                events.push({
                    type: 'board_bonus_gain',
                    player: playerKey,
                    row: action.row,
                    col: action.col,
                    bonus: bonusValue,
                    gained,
                    multiplier: numberCellMultiplierConfig ? Number(numberCellMultiplierConfig.multiplier || 1) : 1,
                    boostedBy: numberCellMultiplierConfig ? pendingPlacementType : null
                });
            }

            if (flips.length > 0 && typeof CardLogic.clearBombAt === 'function') {
                for (const [r, c] of flips) {
                    CardLogic.clearBombAt(cardState, r, c);
                }
            }
            if (flips.length > 0 && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                const flippedPositions = flips.map(([r, c]) => ({ row: r, col: c }));
                CardLogic.clearHyperactiveAtPositions(cardState, flippedPositions);
            }

            // REGEN handling immediately after primary flips
            if (flipCount > 0 && typeof CardLogic.applyRegenAfterFlips === 'function') {
                const regenRes = CardLogic.applyRegenAfterFlips(cardState, gameState, flips, playerKey);
                if (regenRes.regened && regenRes.regened.length) {
                    events.push({ type: 'regen_triggered', details: regenRes.regened });
                }
                if (regenRes.captureFlips && regenRes.captureFlips.length) {
                    flips.push(...regenRes.captureFlips.map(p2 => [p2.row, p2.col]));
                    flipCount = flips.length;
                    events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                }
            }

            // Chain-will family: apply extra flips after normal flips, before placement effects
            if (typeof CardLogic.applyChainWillAfterMove === 'function') {
                const chainRes = CardLogic.applyChainWillAfterMove(cardState, gameState, playerKey, flips, p);
                if (chainRes && chainRes.flips && chainRes.flips.length) {
                    flips.push(...chainRes.flips.map(pos => [pos.row, pos.col]));
                    flipCount = flips.length;
                    events.push({ type: 'chain_flipped', details: chainRes.flips });
                }

                // REGEN after chain flips
                if (chainRes && chainRes.flips && chainRes.flips.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                    const regenRes2 = CardLogic.applyRegenAfterFlips(cardState, gameState, chainRes.flips, playerKey);
                    if (regenRes2.regened && regenRes2.regened.length) {
                        events.push({ type: 'regen_triggered', details: regenRes2.regened });
                    }
                    if (regenRes2.captureFlips && regenRes2.captureFlips.length) {
                        flips.push(...regenRes2.captureFlips.map(p3 => [p3.row, p3.col]));
                        flipCount = flips.length;
                        events.push({ type: 'regen_capture_flipped', details: regenRes2.captureFlips });
                    }
                }
            }

            // 4) Apply placement effects (charge, special stones, etc.)
            const effects = CardLogic.applyPlacementEffects(cardState, gameState, playerKey, action.row, action.col, flipCount);
            if (numberCellMultiplierConfig && effects && numberCellMultiplierConfig.gainField) {
                effects[numberCellMultiplierConfig.gainField] = boardBonusGained;
            }
            events.push({ type: 'placement_effects', player: playerKey, effects });

            // GOLD/SILVER: the placed stone disappears on the opponent's next turn start.

            // Immediate activation on placement turn (spec): dragon/breeding fire immediately after normal flips.
            if (effects && effects.dragonPlaced && typeof CardLogic.processDragonEffectsAtAnchor === 'function') {
                const dragonNow = CardLogic.processDragonEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col);
                if (dragonNow.converted && dragonNow.converted.length) {
                    addChargeWithTotal(cardState, playerKey, dragonNow.converted.length);
                    events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
                }
            }
            if (effects && effects.breedingPlaced && typeof CardLogic.processBreedingEffectsAtAnchor === 'function') {
                const breedingNow = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, p);
                if (breedingNow.spawned && breedingNow.spawned.length) {
                    events.push({ type: 'breeding_spawned_immediate', details: breedingNow.spawned });
                }
                if (breedingNow.flipped && breedingNow.flipped.length) {
                    addChargeWithTotal(cardState, playerKey, breedingNow.flipped.length);
                    events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
                }
            }
            if (effects && effects.ultimateDestroyGodPlaced && typeof CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
                const udgNow = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, { decrementRemainingOwnerTurns: false });
                if (udgNow.destroyed && udgNow.destroyed.length) {
                    events.push({ type: 'udg_destroyed_immediate', details: udgNow.destroyed });
                }
            }
            if (effects && effects.destroyDragonPlaced && typeof CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
                const destroyDragonNow = CardLogic.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (destroyDragonNow && destroyDragonNow.destroyed && destroyDragonNow.destroyed.length) {
                    events.push({ type: 'destroy_dragon_destroyed_immediate', details: destroyDragonNow.destroyed });
                }
                if (destroyDragonNow && destroyDragonNow.expired && destroyDragonNow.expired.length) {
                    events.push({ type: 'destroy_dragon_expired_immediate', details: destroyDragonNow.expired });
                }
            }
            if (effects && effects.sniperPlaced && typeof CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
                const sniperNow = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (sniperNow && sniperNow.destroyed && sniperNow.destroyed.length) {
                    events.push({ type: 'sniper_destroyed_immediate', details: sniperNow.destroyed });
                }
                if (sniperNow && sniperNow.expired && sniperNow.expired.length) {
                    events.push({ type: 'sniper_expired_immediate', details: sniperNow.expired });
                }
            }
            if (effects && effects.lightningPlaced && typeof CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
                const lightningNow = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (lightningNow && lightningNow.destroyed && lightningNow.destroyed.length) {
                    events.push({ type: 'lightning_destroyed_immediate', details: lightningNow.destroyed });
                }
                if (lightningNow && lightningNow.expired && lightningNow.expired.length) {
                    events.push({ type: 'lightning_expired_immediate', details: lightningNow.expired });
                }
            }
            if (effects && effects.willHunterKingPlaced && typeof CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
                const willHunterKingNow = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (willHunterKingNow && willHunterKingNow.destroyed && willHunterKingNow.destroyed.length) {
                    events.push({ type: 'will_hunter_king_destroyed_immediate', details: willHunterKingNow.destroyed });
                }
                if (willHunterKingNow && willHunterKingNow.moved && willHunterKingNow.moved.length) {
                    events.push({ type: 'will_hunter_king_moved_immediate', details: willHunterKingNow.moved });
                }
                if (willHunterKingNow && willHunterKingNow.expired && willHunterKingNow.expired.length) {
                    events.push({ type: 'will_hunter_king_expired_immediate', details: willHunterKingNow.expired });
                }
            }
            if (effects && effects.observerPlaced) {
                const line = pickRandomLine(OBSERVER_PLACE_LINES, p);
                if (line) {
                    emitObserverBubblePresentation(CardLogic, cardState, {
                        player: playerKey,
                        row: action.row,
                        col: action.col,
                        text: line,
                        reason: 'placed'
                    });
                }
            }
            if (effects && effects.workPlaced) {
                const line = pickRandomLine(WORK_PLACE_LINES, p);
                if (line) {
                    emitWorkBubblePresentation(CardLogic, cardState, {
                        player: playerKey,
                        row: action.row,
                        col: action.col,
                        text: line,
                        reason: 'placed'
                    });
                }
            }
            // NOTE: Per spec change (2026-01-26), hyperactive stones do NOT move on the placement turn.
            // Previous behavior ran an immediate hyperactive activation here; it has been removed so that
            // hyperactive moves only occur at turn-start processing (consistent and deterministic).
            if (effects && effects.hyperactivePlaced && !effects.instantHyperactivePlaced) {
                if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] hyperactivePlaced detected on placement — immediate activation suppressed by spec');
            }
            if (effects && effects.instantHyperactivePlaced && typeof CardLogic.processInstantHyperactiveMoveAtAnchor === 'function') {
                const instantHyper = CardLogic.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, action.row, action.col, p);
                if (instantHyper && instantHyper.moved && instantHyper.moved.length) {
                    events.push({ type: 'hyperactive_moved_immediate', details: instantHyper.moved });
                }
                if (instantHyper && instantHyper.flipped && instantHyper.flipped.length) {
                    events.push({ type: 'hyperactive_flipped_immediate', details: instantHyper.flipped });
                    addChargeWithTotal(cardState, playerKey, instantHyper.flipped.length);
                }
                if (instantHyper && instantHyper.destroyed && instantHyper.destroyed.length) {
                    events.push({ type: 'hyperactive_destroyed_immediate', details: instantHyper.destroyed });
                }
                if (instantHyper && instantHyper.flipped && instantHyper.flipped.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                    const regenRes3 = CardLogic.applyRegenAfterFlips(cardState, gameState, instantHyper.flipped, playerKey);
                    if (regenRes3 && regenRes3.regened && regenRes3.regened.length) {
                        events.push({ type: 'regen_triggered', details: regenRes3.regened });
                    }
                    if (regenRes3 && regenRes3.captureFlips && regenRes3.captureFlips.length) {
                        if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                            CardLogic.clearHyperactiveAtPositions(cardState, regenRes3.captureFlips);
                        }
                        addChargeWithTotal(cardState, playerKey, regenRes3.captureFlips.length);
                        events.push({ type: 'regen_capture_flipped', details: regenRes3.captureFlips });
                    }
                }
            }
            // ULTIMATE_HYPERACTIVE_GOD also starts from turn-start processing only.
            if (effects && effects.ultimateHyperactivePlaced) {
                if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] ultimateHyperactivePlaced detected on placement — immediate activation suppressed by spec');
            }

            if (typeof CardLogic.processTrapEffects === 'function') {
                const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: false });
                pushTrapEvents(events, trapRes);
                emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
            }

            const continuationSourceType = (cardState.multiPlaceSourceTypeByPlayer && typeof cardState.multiPlaceSourceTypeByPlayer[playerKey] === 'string')
                ? cardState.multiPlaceSourceTypeByPlayer[playerKey]
                : null;
            const infinitePlaceActive = !!(cardState.infinitePlaceActiveByPlayer && cardState.infinitePlaceActiveByPlayer[playerKey]);

            // If preExtra > 0 then this placement consumes one extra place.
            if (preExtra > 0) {
                cardState.extraPlaceRemainingByPlayer[playerKey] = Math.max(0, (cardState.extraPlaceRemainingByPlayer[playerKey] || 0) - 1);
                events.push({
                    type: 'extra_place_consumed',
                    player: playerKey,
                    sourceType: continuationSourceType || (pendingType === 'LAST_RESORT' ? 'LAST_RESORT' : null),
                    remaining: cardState.extraPlaceRemainingByPlayer[playerKey] || 0
                });
            }

            let postExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;
            const pendingAfterPlacement = (cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey])
                ? cardState.pendingEffectByPlayer[playerKey]
                : null;
            const hasLastResortContinuation = !!(
                pendingAfterPlacement &&
                pendingAfterPlacement.type === 'LAST_RESORT' &&
                Number(pendingAfterPlacement.placementsRemaining || 0) > 0
            );

            let keepTurnForContinuation = false;
            if (infinitePlaceActive) {
                keepTurnForContinuation = hasContinuationMovesForPendingType(Core, CardLogic, cardState, gameState, playerKey, continuationSourceType);
                if (!keepTurnForContinuation) {
                    clearMultiPlaceStateForPlayer(cardState, playerKey);
                }
            } else if (postExtra > 0) {
                const continuationPendingType = hasLastResortContinuation ? 'LAST_RESORT' : continuationSourceType;
                keepTurnForContinuation = hasContinuationMovesForPendingType(Core, CardLogic, cardState, gameState, playerKey, continuationPendingType);
                if (!keepTurnForContinuation) {
                    if (hasLastResortContinuation) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    clearMultiPlaceStateForPlayer(cardState, playerKey);
                    postExtra = 0;
                }
            } else {
                clearMultiPlaceStateForPlayer(cardState, playerKey);
            }

            if (keepTurnForContinuation) {
                gameState.currentPlayer = player;
                gameState.consecutivePasses = 0;
                gameState.turnNumber = turnNumberBeforePlace;
            } else {
                handOffCompletedTurn(Core, CardLogic, cardState, gameState, playerKey, turnNumberBeforePlace + 1);
            }
        } else {
            throw new Error('Unknown action.type');
        }
        } finally {
            emitObserverLostBubbleFromSnapshots(CardLogic, cardState, observerMarkersBeforeAction, 'removed_during_action');
            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeAction, {
                presentationStartIndex
            });
        }
    }

    return { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase };
}));
