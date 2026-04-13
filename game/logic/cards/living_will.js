(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let CardMarkersModule = null;
        let CardWorkModule = null;
        try {
            CardMarkersModule = require('./markers');
        } catch (e) { /* ignore */ }
        try {
            CardWorkModule = require('./work_will');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../../shared-constants'), CardMarkersModule, CardWorkModule);
    } else {
        root.CardLivingWill = factory(root.SharedConstants, root.CardMarkers || null, root.CardWork || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardMarkersModule, CardWorkModule) {
    'use strict';

    const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
        ? Number(SharedConstants.BLACK)
        : 1;
    const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
        ? Number(SharedConstants.WHITE)
        : -1;
    const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
        ? Number(SharedConstants.EMPTY)
        : 0;
    const MARKER_KIND_SPECIAL = 'specialStone';

    const BLOCKING_TYPES = new Set(['BLOCKADE', 'METEOR_HOLE', 'FREEZE']);
    const OVERLAY_ONLY_TYPES = new Set(['LIVING_WILL']);
    const HYPERACTIVE_TYPES = new Set([
        'HYPERACTIVE',
        'EXTREME_HYPERACTIVE',
        'ESCAPE_HYPERACTIVE',
        'INHERITED_HYPERACTIVE',
        'ROBOT_VACUUM',
        'GLUTTONOUS'
    ]);

    function getGlobalScope() {
        return (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        const globalScope = getGlobalScope();
        return globalScope.CardMarkers || null;
    }

    function getCardWorkModule() {
        if (CardWorkModule) return CardWorkModule;
        const globalScope = getGlobalScope();
        return globalScope.CardWork || null;
    }

    function getSpecialStoneRegistryModule() {
        if (typeof require === 'function') {
            try {
                return require('../../../shared/special-stone-registry');
            } catch (e) { /* ignore */ }
        }
        const globalScope = getGlobalScope();
        return globalScope.SpecialStoneRegistry || null;
    }

    function isOverlayOnlySpecialStoneType(type) {
        const registry = getSpecialStoneRegistryModule();
        if (registry && typeof registry.isOverlayOnlySpecialStoneType === 'function') {
            return registry.isOverlayOnlySpecialStoneType(type);
        }
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'GUARD' || typeUpper === 'INHERITED_HYPERACTIVE' || typeUpper === 'LIVING_WILL';
    }

    function cloneStructuredValue(value) {
        if (Array.isArray(value)) return value.map(cloneStructuredValue);
        if (!value || typeof value !== 'object') return value;
        const out = {};
        for (const key of Object.keys(value)) {
            out[key] = cloneStructuredValue(value[key]);
        }
        return out;
    }

    function normalizeBoardIndex(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.trunc(numeric);
    }

    function ensureMarkers(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
    }

    function getMarkers(cardState) {
        return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    }

    function isBombMarker(marker, cardMarkers) {
        if (!marker) return false;
        if (cardMarkers && typeof cardMarkers.isBombCategoryMarker === 'function') {
            return !!cardMarkers.isBombCategoryMarker(marker);
        }
        return !!(marker.data && marker.data.category === 'bomb');
    }

    function isSpecialMarker(marker, cardMarkers) {
        if (!marker) return false;
        if (cardMarkers && typeof cardMarkers.isSpecialStoneMarker === 'function') {
            return !!cardMarkers.isSpecialStoneMarker(marker);
        }
        return marker.kind === MARKER_KIND_SPECIAL && !isBombMarker(marker, cardMarkers);
    }

    function getSpecialMarkersAt(cardState, row, col) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.getSpecialMarkers === 'function') {
            return cardMarkers.getSpecialMarkers(cardState).filter((marker) => (
                marker &&
                normalizeBoardIndex(marker.row) === row &&
                normalizeBoardIndex(marker.col) === col
            ));
        }
        return getMarkers(cardState).filter((marker) => (
            isSpecialMarker(marker, cardMarkers) &&
            normalizeBoardIndex(marker.row) === row &&
            normalizeBoardIndex(marker.col) === col
        ));
    }

    function getBlockingMarkers(cardState) {
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.getBlockingMarkers === 'function') {
            return cardMarkers.getBlockingMarkers(cardState);
        }
        return getMarkers(cardState).filter((marker) => {
            const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            return BLOCKING_TYPES.has(type);
        });
    }

    function addMarker(cardState, row, col, owner, data) {
        const cardMarkers = getCardMarkersModule();
        ensureMarkers(cardState);
        if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
            return cardMarkers.addMarker(cardState, MARKER_KIND_SPECIAL, row, col, owner, data);
        }
        const id = cardState._nextMarkerId++;
        const createdSeq = cardState._nextCreatedSeq++;
        const marker = {
            id,
            row,
            col,
            kind: MARKER_KIND_SPECIAL,
            owner,
            createdSeq,
            data: cloneStructuredValue(data)
        };
        cardState.markers.push(marker);
        return marker;
    }

    function removeMarkerById(cardState, markerId) {
        if (!cardState || !Array.isArray(cardState.markers)) return false;
        const cardMarkers = getCardMarkersModule();
        if (cardMarkers && typeof cardMarkers.removeMarkerById === 'function') {
            return !!cardMarkers.removeMarkerById(cardState, markerId);
        }
        const before = cardState.markers.length;
        cardState.markers = cardState.markers.filter((marker) => !(marker && marker.id === markerId));
        return cardState.markers.length !== before;
    }

    function removeMarkersAt(cardState, row, col, options) {
        if (!cardState || !Array.isArray(cardState.markers)) return 0;
        const opts = (options && typeof options === 'object') ? options : {};
        const before = cardState.markers.length;
        cardState.markers = cardState.markers.filter((marker) => {
            if (!marker) return true;
            if (normalizeBoardIndex(marker.row) !== row || normalizeBoardIndex(marker.col) !== col) return true;
            if (opts.kind && marker.kind !== opts.kind) return true;
            if (opts.type && String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() !== String(opts.type).toUpperCase()) return true;
            if (opts.owner && marker.owner !== opts.owner) return true;
            if (opts.predicate && !opts.predicate(marker)) return true;
            return false;
        });
        return before - cardState.markers.length;
    }

    function getBoardOps(deps) {
        return deps && deps.BoardOps ? deps.BoardOps : null;
    }

    function getCellValue(gameState, row, col, deps) {
        const boardOps = getBoardOps(deps);
        if (boardOps && typeof boardOps.getCellValue === 'function') {
            return boardOps.getCellValue(gameState, row, col);
        }
        if (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row])) {
            return gameState.board[row][col];
        }
        return null;
    }

    function getExpansionDescriptors(gameState, deps) {
        const boardOps = getBoardOps(deps);
        if (boardOps && typeof boardOps.getExpansionDescriptors === 'function') {
            return boardOps.getExpansionDescriptors(gameState) || [];
        }
        return [];
    }

    function emitPresentationEvent(cardState, event, deps) {
        const boardOps = getBoardOps(deps);
        if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
            boardOps.emitPresentationEvent(cardState, event);
        }
    }

    function normalizeOwnerKeyFromValue(value) {
        if (value === BLACK) return 'black';
        if (value === WHITE) return 'white';
        return null;
    }

    function ownerKeyToValue(ownerKey) {
        return ownerKey === 'black' ? BLACK : WHITE;
    }

    function getDefaultPrng(deps) {
        if (deps && deps.random && typeof deps.random.random === 'function') return deps.random;
        if (deps && deps.defaultPrng && typeof deps.defaultPrng.random === 'function') return deps.defaultPrng;
        return { random: Math.random };
    }

    function getNumericDefault(value, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(0, Math.trunc(numeric));
    }

    function getDurationDefaults(deps) {
        const source = (deps && deps.defaults && typeof deps.defaults === 'object') ? deps.defaults : {};
        return {
            regenReviveLimit: getNumericDefault(source.regenReviveLimit, 3),
            breedingTurns: getNumericDefault(source.breedingTurns, 5),
            proliferationTurns: getNumericDefault(source.proliferationTurns, 10),
            ultimateDragonTurns: getNumericDefault(source.ultimateDragonTurns, 5),
            ultimateDestroyGodTurns: getNumericDefault(source.ultimateDestroyGodTurns, 5),
            sniperTurns: getNumericDefault(source.sniperTurns, 5),
            observerTurns: getNumericDefault(source.observerTurns, 5),
            ghostTurns: getNumericDefault(source.ghostTurns, 5),
            afterimageFlipEvadeLimit: getNumericDefault(source.afterimageFlipEvadeLimit, 3),
            afterimageDestroyEvadeLimit: getNumericDefault(source.afterimageDestroyEvadeLimit, 3),
            timeStopTurns: getNumericDefault(source.timeStopTurns, 3),
            willHunterKingTurns: getNumericDefault(source.willHunterKingTurns, 8),
            destroyDragonTurns: getNumericDefault(source.destroyDragonTurns, 3),
            lightningTurns: getNumericDefault(source.lightningTurns, 5),
            extremeHyperactiveFlipEvadeLimit: getNumericDefault(source.extremeHyperactiveFlipEvadeLimit, 3),
            extremeHyperactiveDestroyEvadeLimit: getNumericDefault(source.extremeHyperactiveDestroyEvadeLimit, 1),
            robotVacuumTurns: getNumericDefault(source.robotVacuumTurns, 5),
            inheritedHyperactiveTurns: getNumericDefault(source.inheritedHyperactiveTurns, 10),
            ultimateHyperactiveTurns: getNumericDefault(source.ultimateHyperactiveTurns, 10),
            ultimateHyperactiveFlipEvadeLimit: getNumericDefault(source.ultimateHyperactiveFlipEvadeLimit, 1),
            ultimateHyperactiveDestroyEvadeLimit: getNumericDefault(source.ultimateHyperactiveDestroyEvadeLimit, 1),
            guardTurns: getNumericDefault(source.guardTurns, 3),
            guardianGodTurns: getNumericDefault(source.guardianGodTurns, 10),
            workTurns: getNumericDefault(source.workTurns, 5)
        };
    }

    function normalizeRestoreMarkerData(marker, ownerKey, deps) {
        const defaults = getDurationDefaults(deps);
        const markerData = cloneStructuredValue(marker && marker.data ? marker.data : {});
        const type = String(markerData.type || '').toUpperCase();
        if (markerData.ownerColor !== undefined) markerData.ownerColor = ownerKey;
        if (markerData.expiresForPlayer !== undefined) markerData.expiresForPlayer = ownerKey;

        switch (type) {
        case 'REGEN':
            markerData.regenRemaining = defaults.regenReviveLimit;
            markerData.remainingOwnerTurns = defaults.regenReviveLimit;
            markerData.ownerColor = ownerKey;
            break;
        case 'PROTECTED':
            markerData.expiresForPlayer = ownerKey;
            break;
        case 'DRAGON':
            markerData.remainingOwnerTurns = defaults.ultimateDragonTurns;
            break;
        case 'BREEDING':
            markerData.remainingOwnerTurns = defaults.breedingTurns;
            break;
        case 'PROLIFERATION':
            markerData.remainingOwnerTurns = defaults.proliferationTurns;
            break;
        case 'ULTIMATE_DESTROY_GOD':
            markerData.remainingOwnerTurns = defaults.ultimateDestroyGodTurns;
            break;
        case 'SNIPER':
            markerData.remainingOwnerTurns = defaults.sniperTurns;
            break;
        case 'OBSERVER':
            markerData.remainingOwnerTurns = defaults.observerTurns;
            break;
        case 'GHOST':
            markerData.remainingOwnerTurns = defaults.ghostTurns;
            break;
        case 'AFTERIMAGE_WILL':
            markerData.flipEvadeRemaining = defaults.afterimageFlipEvadeLimit;
            markerData.destroyEvadeRemaining = defaults.afterimageDestroyEvadeLimit;
            break;
        case 'TIME_STOP':
            markerData.remainingOwnerTurns = defaults.timeStopTurns;
            break;
        case 'WILL_HUNTER_KING':
            markerData.remainingOwnerTurns = defaults.willHunterKingTurns;
            markerData.flipEvadeRemaining = 2;
            markerData.destroyEvadeRemaining = 2;
            break;
        case 'DESTROY_DRAGON':
            markerData.remainingOwnerTurns = defaults.destroyDragonTurns;
            break;
        case 'LIGHTNING':
            markerData.remainingOwnerTurns = defaults.lightningTurns;
            break;
        case 'HYPERACTIVE':
            markerData.flipEvadeRemaining = 1;
            break;
        case 'EXTREME_HYPERACTIVE':
            markerData.flipEvadeRemaining = defaults.extremeHyperactiveFlipEvadeLimit;
            markerData.destroyEvadeRemaining = defaults.extremeHyperactiveDestroyEvadeLimit;
            break;
        case 'ESCAPE_HYPERACTIVE':
            markerData.flipEvadeRemaining = 1;
            break;
        case 'ROBOT_VACUUM':
            markerData.remainingOwnerTurns = defaults.robotVacuumTurns;
            break;
        case 'GLUTTONOUS':
            markerData.gluttonousMissStreak = 0;
            break;
        case 'ULTIMATE_HYPERACTIVE':
            markerData.remainingOwnerTurns = defaults.ultimateHyperactiveTurns;
            markerData.flipEvadeRemaining = defaults.ultimateHyperactiveFlipEvadeLimit;
            markerData.destroyEvadeRemaining = defaults.ultimateHyperactiveDestroyEvadeLimit;
            break;
        case 'INHERITED_HYPERACTIVE':
            markerData.remainingOwnerTurns = defaults.inheritedHyperactiveTurns;
            markerData.flipEvadeRemaining = 1;
            markerData.destroyEvadeRemaining = 1;
            break;
        case 'GUARD':
            markerData.remainingOwnerTurns = markerData.sourceType === 'GUARDIAN_GOD'
                ? defaults.guardianGodTurns
                : defaults.guardTurns;
            break;
        case 'WORK':
            markerData.remainingOwnerTurns = defaults.workTurns;
            markerData.ownerColor = ownerKey;
            markerData.workStage = 0;
            break;
        default:
            break;
        }

        if (HYPERACTIVE_TYPES.has(type)) {
            delete markerData.hyperactiveSeq;
        }

        return markerData;
    }

    function buildLivingWillBaseline(cardState, gameState, row, col, deps) {
        const ownerKey = normalizeOwnerKeyFromValue(getCellValue(gameState, row, col, deps));
        if (!ownerKey) return null;
        const restoreMarkers = getSpecialMarkersAt(cardState, row, col)
            .filter((marker) => {
                const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                return !OVERLAY_ONLY_TYPES.has(type) && !BLOCKING_TYPES.has(type);
            })
            .map((marker) => ({
                owner: marker.owner || ownerKey,
                data: normalizeRestoreMarkerData(marker, marker.owner || ownerKey, deps)
            }));
        return {
            version: 1,
            owner: ownerKey,
            markers: restoreMarkers
        };
    }

    function cloneLivingWillSnapshot(marker) {
        return cloneStructuredValue(marker);
    }

    function findLivingWillMarkerAt(cardState, row, col) {
        return getSpecialMarkersAt(cardState, row, col).find((marker) => (
            String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'LIVING_WILL'
        )) || null;
    }

    function shouldTriggerForSpecialLoss(livingWillMarker, specialType) {
        const typeUpper = String(specialType || '').toUpperCase();
        if (!typeUpper) return false;
        const baseline = livingWillMarker && livingWillMarker.data ? livingWillMarker.data.baseline : null;
        const restoreMarkers = Array.isArray(baseline && baseline.markers) ? baseline.markers : [];
        return restoreMarkers.some((entry) => (
            String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase() === typeUpper
        ));
    }

    function buildRestoreVisualMeta(baseline, trigger) {
        const restoreMarkers = Array.isArray(baseline && baseline.markers) ? baseline.markers : [];
        const primary = restoreMarkers.find((entry) => {
            const typeUpper = String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase();
            return !isOverlayOnlySpecialStoneType(typeUpper);
        }) || restoreMarkers[0] || null;
        const data = primary && primary.data ? primary.data : null;
        const meta = {
            owner: baseline && baseline.owner ? baseline.owner : null,
            reason: 'living_will_restored',
            livingWillRevived: true,
            revivedFromRow: Number.isInteger(trigger && trigger.sourceRow) ? trigger.sourceRow : null,
            revivedFromCol: Number.isInteger(trigger && trigger.sourceCol) ? trigger.sourceCol : null,
            reviveTriggerCause: trigger && trigger.cause ? trigger.cause : null,
            reviveTriggerReason: trigger && trigger.reason ? trigger.reason : null,
            relocated: !!(trigger && trigger.relocated)
        };
        if (data && data.type) meta.special = data.type;
        if (data && typeof data.remainingOwnerTurns === 'number') meta.timer = data.remainingOwnerTurns;
        if (data && Number.isFinite(Number(data.flipEvadeRemaining))) {
            meta.flipEvadeRemaining = Math.max(0, Math.trunc(Number(data.flipEvadeRemaining)));
        }
        if (data && Number.isFinite(Number(data.destroyEvadeRemaining))) {
            meta.destroyEvadeRemaining = Math.max(0, Math.trunc(Number(data.destroyEvadeRemaining)));
        }
        return meta;
    }

    function allocateHyperactiveSeq(cardState) {
        if (!cardState || typeof cardState !== 'object') return 1;
        const current = Number.isFinite(Number(cardState.hyperactiveSeqCounter))
            ? Math.max(0, Math.trunc(Number(cardState.hyperactiveSeqCounter)))
            : 0;
        const next = current + 1;
        cardState.hyperactiveSeqCounter = next;
        return next;
    }

    function ensureBreedingRuntime(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.breedingFrontierByAnchorId || typeof cardState.breedingFrontierByAnchorId !== 'object') {
            cardState.breedingFrontierByAnchorId = {};
        }
        if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
            cardState.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.breedingSproutByOwner.black)) cardState.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState.breedingSproutByOwner.white)) cardState.breedingSproutByOwner.white = [];
    }

    function removeNonBlockingMarkersAt(cardState, row, col) {
        return removeMarkersAt(cardState, row, col, {
            predicate(marker) {
                const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                return !BLOCKING_TYPES.has(type);
            }
        });
    }

    function collectEmptyReviveCells(cardState, gameState, sourceRow, sourceCol, deps) {
        const candidates = [];
        const blockingSet = new Set(
            getBlockingMarkers(cardState).map((marker) => `${normalizeBoardIndex(marker.row)},${normalizeBoardIndex(marker.col)}`)
        );
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];
        for (let row = 0; row < board.length; row++) {
            if (!Array.isArray(board[row])) continue;
            for (let col = 0; col < board[row].length; col++) {
                if (row === sourceRow && col === sourceCol) continue;
                if (getCellValue(gameState, row, col, deps) !== EMPTY) continue;
                if (blockingSet.has(`${row},${col}`)) continue;
                candidates.push({ row, col });
            }
        }
        for (const descriptor of getExpansionDescriptors(gameState, deps)) {
            if (!descriptor || !Number.isInteger(descriptor.row) || !Number.isInteger(descriptor.col)) continue;
            if (descriptor.row === sourceRow && descriptor.col === sourceCol) continue;
            if (getCellValue(gameState, descriptor.row, descriptor.col, deps) !== EMPTY) continue;
            if (blockingSet.has(`${descriptor.row},${descriptor.col}`)) continue;
            candidates.push({ row: descriptor.row, col: descriptor.col });
        }
        return candidates;
    }

    function shouldRelocateForTrigger(trigger) {
        if (trigger && trigger.forceRelocation === true) return true;
        const cause = String(trigger && trigger.cause ? trigger.cause : '').toUpperCase();
        const reason = String(trigger && trigger.reason ? trigger.reason : '').toUpperCase();
        return (
            cause === 'METEOR_WILL' ||
            cause === 'BOARD_SHRINK_WILL' ||
            cause === 'BOARD_SHRINK_GOD' ||
            reason.indexOf('METEOR') !== -1 ||
            reason.indexOf('BOARD_SHRINK') !== -1
        );
    }

    function pickRelocationTarget(cardState, gameState, sourceRow, sourceCol, deps) {
        const candidates = collectEmptyReviveCells(cardState, gameState, sourceRow, sourceCol, deps);
        if (!candidates.length) return null;
        const prng = getDefaultPrng(deps);
        const raw = Number(prng.random());
        const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
        const index = Math.floor(normalized * candidates.length);
        return candidates[index] || candidates[0] || null;
    }

    function restoreBaselineMarkers(cardState, gameState, row, col, baseline, deps) {
        const restoreMarkers = Array.isArray(baseline && baseline.markers) ? baseline.markers : [];
        const workModule = getCardWorkModule();
        const restored = [];
        for (const entry of restoreMarkers) {
            const owner = entry && entry.owner ? entry.owner : (baseline && baseline.owner ? baseline.owner : null);
            const data = cloneStructuredValue(entry && entry.data ? entry.data : {});
            const type = String(data && data.type ? data.type : '').toUpperCase();
            if (HYPERACTIVE_TYPES.has(type)) {
                data.hyperactiveSeq = allocateHyperactiveSeq(cardState);
            }
            if (type === 'WORK' && workModule && typeof workModule.placeWorkStone === 'function') {
                workModule.placeWorkStone(cardState, gameState, owner, row, col, {
                    addMarker(cs, kind, markerRow, markerCol, markerOwner, markerData) {
                        return addMarker(cs, markerRow, markerCol, markerOwner, markerData);
                    },
                    removeMarkersAt
                });
                restored.push({ type: 'WORK' });
                continue;
            }
            const marker = addMarker(cardState, row, col, owner, data);
            restored.push(marker);
            if (type === 'BREEDING' && marker && Number.isInteger(marker.id)) {
                ensureBreedingRuntime(cardState);
                cardState.breedingFrontierByAnchorId[marker.id] = [];
            }
        }
        return restored;
    }

    function restoreFromLivingWillSnapshot(cardState, gameState, livingWillMarker, trigger, deps = {}) {
        const snapshot = cloneLivingWillSnapshot(livingWillMarker);
        const baseline = snapshot && snapshot.data ? snapshot.data.baseline : null;
        if (!baseline || !baseline.owner) {
            return { restored: false, consumed: false, reason: 'missing_baseline' };
        }

        const sourceRow = Number.isInteger(trigger && trigger.sourceRow) ? trigger.sourceRow : normalizeBoardIndex(snapshot && snapshot.row);
        const sourceCol = Number.isInteger(trigger && trigger.sourceCol) ? trigger.sourceCol : normalizeBoardIndex(snapshot && snapshot.col);
        if (!Number.isInteger(sourceRow) || !Number.isInteger(sourceCol)) {
            return { restored: false, consumed: false, reason: 'missing_source' };
        }

        const relocate = shouldRelocateForTrigger(trigger);
        const destination = relocate
            ? pickRelocationTarget(cardState, gameState, sourceRow, sourceCol, deps)
            : { row: sourceRow, col: sourceCol };

        removeMarkerById(cardState, snapshot && snapshot.id);
        emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row: sourceRow,
            col: sourceCol,
            cause: 'LIVING_WILL',
            reason: 'living_will_consumed',
            meta: {
                special: 'LIVING_WILL',
                owner: snapshot && snapshot.owner ? snapshot.owner : baseline.owner,
                reason: 'living_will_consumed',
                reviveTriggerCause: trigger && trigger.cause ? trigger.cause : null,
                reviveTriggerReason: trigger && trigger.reason ? trigger.reason : null
            }
        }, deps);

        if (!destination) {
            return { restored: false, consumed: true, reason: 'no_relocation_destination' };
        }

        const boardOps = getBoardOps(deps);
        if (!boardOps || typeof boardOps.spawnAt !== 'function' || typeof boardOps.changeAt !== 'function') {
            return { restored: false, consumed: true, reason: 'board_ops_unavailable' };
        }

        removeNonBlockingMarkersAt(cardState, destination.row, destination.col);

        const destinationValue = getCellValue(gameState, destination.row, destination.col, deps);
        const visualMeta = buildRestoreVisualMeta(baseline, Object.assign({}, trigger, { relocated: relocate }));
        let boardResult = null;
        if (destinationValue === EMPTY) {
            boardResult = boardOps.spawnAt(
                cardState,
                gameState,
                destination.row,
                destination.col,
                baseline.owner,
                'LIVING_WILL',
                'living_will_restored',
                visualMeta
            );
        } else {
            const changeMeta = Object.assign({}, visualMeta, {
                forcePresentation: true
            });
            boardResult = boardOps.changeAt(
                cardState,
                gameState,
                destination.row,
                destination.col,
                baseline.owner,
                'LIVING_WILL',
                'living_will_restored',
                changeMeta
            );
        }

        if (!(boardResult && (boardResult.spawned || boardResult.changed || boardResult.presented || destinationValue !== EMPTY))) {
            return { restored: false, consumed: true, reason: 'board_restore_failed', destination };
        }

        restoreBaselineMarkers(cardState, gameState, destination.row, destination.col, baseline, deps);

        return {
            restored: true,
            consumed: true,
            source: { row: sourceRow, col: sourceCol },
            destination: { row: destination.row, col: destination.col },
            owner: baseline.owner,
            relocated: relocate
        };
    }

    function applyLivingWill(cardState, gameState, playerKey, row, col, deps = {}) {
        const readCardPendingEffect = deps.readCardPendingEffect || ((state, owner) => (
            state && state.pendingEffectByPlayer ? state.pendingEffectByPlayer[owner] : null
        ));
        const clearCardPendingEffect = deps.clearCardPendingEffect || ((state, owner) => {
            if (state && state.pendingEffectByPlayer) state.pendingEffectByPlayer[owner] = null;
        });
        const getLivingWillTargets = deps.getLivingWillTargets || (() => []);

        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'LIVING_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getLivingWillTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => (
            target &&
            target.row === row &&
            target.col === col
        ));
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const baseline = buildLivingWillBaseline(cardState, gameState, row, col, deps);
        if (!baseline) return { applied: false, reason: 'invalid_baseline' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KIND_SPECIAL,
            type: 'LIVING_WILL'
        });

        const marker = addMarker(cardState, row, col, playerKey, {
            type: 'LIVING_WILL',
            baseline
        });
        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            row,
            col,
            markerId: marker && marker.id ? marker.id : null,
            baselineOwner: baseline.owner
        };
    }

    function applyLivingWillAfterFlips(cardState, gameState, flips, flipperKey, deps = {}) {
        const restored = [];
        if (!Array.isArray(flips) || !flips.length) return { restored };
        const seen = new Set();
        for (const raw of flips) {
            const row = Number.isInteger(raw && raw.row) ? raw.row : normalizeBoardIndex(raw && raw[0]);
            const col = Number.isInteger(raw && raw.col) ? raw.col : normalizeBoardIndex(raw && raw[1]);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            const key = `${row},${col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const livingWillMarker = findLivingWillMarkerAt(cardState, row, col);
            if (!livingWillMarker) continue;
            const baseline = livingWillMarker.data && livingWillMarker.data.baseline;
            const currentOwner = normalizeOwnerKeyFromValue(getCellValue(gameState, row, col, deps));
            if (!baseline || !baseline.owner || currentOwner === baseline.owner) continue;
            const result = restoreFromLivingWillSnapshot(cardState, gameState, livingWillMarker, {
                triggerKind: 'flip',
                cause: 'LIVING_WILL',
                reason: 'living_will_flip_restore',
                sourceRow: row,
                sourceCol: col,
                flippedBy: flipperKey || null
            }, deps);
            if (result && result.restored) restored.push(result.destination || { row, col });
        }
        return { restored };
    }

    return {
        applyLivingWill,
        applyLivingWillAfterFlips,
        findLivingWillMarkerAt,
        shouldTriggerForSpecialLoss,
        restoreFromLivingWillSnapshot
    };
}));
