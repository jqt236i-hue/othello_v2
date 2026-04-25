/**
 * @file clone.js
 * @description Clone/Split helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../cards-internal/random-source'));
    } else {
        root.CardClone = factory(root.SharedConstants, root.CardRandomSource || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, RandomSourceModule) {
    'use strict';

    const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
        ? Number(SharedConstants.BLACK)
        : 1;
    const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
        ? Number(SharedConstants.WHITE)
        : -1;
    const BOMB_CATEGORY = 'bomb';

    function resolveRandomSource(prng) {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
            return RandomSourceModule.resolveRandomSource(prng, null, 'CardClone');
        }
        if (prng && typeof prng.random === 'function') return prng;
        throw new Error('CardClone requires an injected deterministic PRNG.');
    }

    function resolveRandomIndex(randomSource, length) {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
            return RandomSourceModule.resolveRandomIndex(length, randomSource, null, 'CardClone');
        }
        if (!Number.isInteger(length) || length <= 0) return 0;
        const raw = Math.floor(randomSource.random() * length);
        if (!Number.isInteger(raw)) return 0;
        return Math.max(0, Math.min(length - 1, raw));
    }

    function cloneMarkerData(data) {
        if (!data || typeof data !== 'object') return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return { ...data };
        }
    }

    function halveDurationValueForSplit(value) {
        const current = Number(value);
        if (!Number.isFinite(current) || current <= 0) return value;
        return Math.max(1, Math.trunc(current / 2));
    }

    function halveDurationOnMarkerDataForSplit(data, markerCategory) {
        if (!data || typeof data !== 'object') return null;
        if (markerCategory === 'specialStone') {
            if (!Number.isFinite(Number(data.remainingOwnerTurns)) || Number(data.remainingOwnerTurns) <= 0) return null;
            const previous = Number(data.remainingOwnerTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingOwnerTurns = next;
            return {
                durationKey: 'remainingOwnerTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        if (markerCategory === BOMB_CATEGORY) {
            if (!Number.isFinite(Number(data.remainingTurns)) || Number(data.remainingTurns) <= 0) return null;
            const previous = Number(data.remainingTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingTurns = next;
            return {
                durationKey: 'remainingTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        return null;
    }

    function getPlayerValue(playerKey) {
        return playerKey === 'black' ? BLACK : WHITE;
    }

    function applySpawnWithValidation(spawnAt, setCellValueForCard, cardState, gameState, target, playerKey, playerValue, cause, reason, meta) {
        if (typeof spawnAt === 'function') {
            const spawnResult = spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason, meta);
            if (!spawnResult || spawnResult.spawned !== true) {
                return {
                    applied: false,
                    reason: (spawnResult && typeof spawnResult.reason === 'string' && spawnResult.reason)
                        ? spawnResult.reason
                        : 'spawn_failed'
                };
            }
            return { applied: true, spawnResult };
        }

        const wroteCell = setCellValueForCard(gameState, target.row, target.col, playerValue);
        if (wroteCell !== true) {
            return { applied: false, reason: 'spawn_failed' };
        }
        return { applied: true, spawnResult: null };
    }

    function applyCloneWill(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'CLONE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getCloneTargets = deps.getCloneTargets || (() => []);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const getSpecialMarkers = deps.getSpecialMarkers || (() => []);
        const getBombMarkers = deps.getBombMarkers || (() => []);
        const collectEmptyNeighborCellsForCard = deps.collectEmptyNeighborCellsForCard || (() => []);
        const spawnAt = deps.spawnAt || null;
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const addMarker = deps.addMarker || (() => false);

        const targets = getCloneTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceValue = getCellValueForCard(gameState, row, col);
        const playerValue = getPlayerValue(playerKey);
        if (sourceValue !== playerValue) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter((marker) => marker && marker.row === row && marker.col === col);
        const sourceBombs = getBombMarkers(cardState).filter((marker) => marker && marker.row === row && marker.col === col);
        const spawnTargets = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);
        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const randomSource = resolveRandomSource(prng);
        const target = spawnTargets[resolveRandomIndex(randomSource, spawnTargets.length)] || spawnTargets[0];
        const spawned = [];

        const spawnOutcome = applySpawnWithValidation(
            spawnAt,
            setCellValueForCard,
            cardState,
            gameState,
            target,
            playerKey,
            playerValue,
            'CLONE_WILL',
            'clone_spawn',
            {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            }
        );
        if (!spawnOutcome.applied) return spawnOutcome;

        for (const special of sourceSpecials) {
            const owner = special.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(special.data || {}));
        }
        for (const bomb of sourceBombs) {
            const owner = bomb.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'specialStone', target.row, target.col, owner, Object.assign(
                {},
                cloneMarkerData(bomb.data || {}),
                { category: BOMB_CATEGORY, type: (bomb.data && bomb.data.type) || 'TIME_BOMB' }
            ));
        }

        spawned.push({ row: target.row, col: target.col });
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, source: { row, col }, spawned };
    }

    function applySplitWill(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'SPLIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getSplitTargets = deps.getSplitTargets || (() => []);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const getSpecialMarkers = deps.getSpecialMarkers || (() => []);
        const getBombMarkers = deps.getBombMarkers || (() => []);
        const collectEmptyNeighborCellsForCard = deps.collectEmptyNeighborCellsForCard || (() => []);
        const spawnAt = deps.spawnAt || null;
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const addMarker = deps.addMarker || (() => false);

        const targets = getSplitTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceValue = getCellValueForCard(gameState, row, col);
        const playerValue = getPlayerValue(playerKey);
        if (sourceValue !== playerValue) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter((marker) => marker && marker.row === row && marker.col === col);
        const sourceBombs = getBombMarkers(cardState).filter((marker) => marker && marker.row === row && marker.col === col);
        const spawnTargets = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);
        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const randomSource = resolveRandomSource(prng);
        const target = spawnTargets[resolveRandomIndex(randomSource, spawnTargets.length)] || spawnTargets[0];
        const spawned = [];

        const spawnOutcome = applySpawnWithValidation(
            spawnAt,
            setCellValueForCard,
            cardState,
            gameState,
            target,
            playerKey,
            playerValue,
            'SPLIT_WILL',
            'split_spawn',
            {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            }
        );
        if (!spawnOutcome.applied) return spawnOutcome;

        const durationChanges = [];
        for (const special of sourceSpecials) {
            const owner = special.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(special.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, 'specialStone');
            special.data = sourceData;
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(sourceData));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: sourceData.type || null,
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }
        for (const bomb of sourceBombs) {
            const owner = bomb.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(bomb.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, BOMB_CATEGORY);
            bomb.data = sourceData;
            addMarker(cardState, 'specialStone', target.row, target.col, owner, Object.assign(
                {},
                cloneMarkerData(sourceData),
                { category: BOMB_CATEGORY, type: (sourceData && sourceData.type) || 'TIME_BOMB' }
            ));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: 'TIME_BOMB',
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }

        spawned.push({ row: target.row, col: target.col });
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, source: { row, col }, spawned, durationChanges };
    }

    return {
        applyCloneWill,
        applySplitWill
    };
}));
