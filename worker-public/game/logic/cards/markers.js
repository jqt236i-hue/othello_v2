(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        let MarkersAdapterModule = null;
        let CardUtilsModule = null;
        let CardExpansionModule = null;
        let PresentationModule = null;
        try {
            MarkersAdapterModule = require('../markers_adapter');
        } catch (e) { /* ignore */ }
        try {
            CardUtilsModule = require('./utils');
        } catch (e) { /* ignore */ }
        try {
            CardExpansionModule = require('./expansion');
        } catch (e) { /* ignore */ }
        try {
            PresentationModule = require('../presentation');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../../../shared-constants'), MarkersAdapterModule, CardUtilsModule, CardExpansionModule, PresentationModule);
    } else {
        root.CardMarkers = factory(
            root.SharedConstants,
            root.MarkersAdapter || null,
            root.CardUtils || null,
            root.CardExpansion || null,
            root.PresentationHelper || null
        );
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedConstants, MarkersAdapterModule, CardUtilsModule, CardExpansionModule, PresentationModule) {
    'use strict';

    const { BOARD_SIZE } = SharedConstants || {};
    const MarkersAdapter = MarkersAdapterModule || null;
    const MARKER_KINDS = (MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : {
            SPECIAL_STONE: 'specialStone',
            BOMB: 'bomb'
        };

    function getBoardSize() {
        return Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
    }

    function getPresentationHelper() {
        if (PresentationModule && typeof PresentationModule.emitPresentationEvent === 'function') {
            return PresentationModule;
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        const helper = globalScope && globalScope.PresentationHelper;
        return (helper && typeof helper.emitPresentationEvent === 'function') ? helper : null;
    }

    function isMainBoardCellForCard(row, col) {
        if (CardExpansionModule && typeof CardExpansionModule.isMainBoardCellForCard === 'function') {
            return CardExpansionModule.isMainBoardCellForCard(row, col);
        }
        const boardSize = getBoardSize();
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < boardSize && col >= 0 && col < boardSize;
    }

    function getExpansionDescriptorsForCard(gameState) {
        if (CardExpansionModule && typeof CardExpansionModule.getExpansionDescriptorsForCard === 'function') {
            return CardExpansionModule.getExpansionDescriptorsForCard(gameState);
        }
        return [];
    }

    function hasExpansionCellForCard(gameState, row, col) {
        return getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
    }

    function ensureMarkers(cardState) {
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
            return;
        }
        if (!cardState) return;
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
    }

    function getMarkers(cardState) {
        if (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function') {
            return MarkersAdapter.getMarkers(cardState);
        }
        return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    }

    function getSpecialMarkers(cardState) {
        if (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function') {
            return MarkersAdapter.getSpecialMarkers(cardState);
        }
        return getMarkers(cardState).filter((marker) => marker && marker.kind === MARKER_KINDS.SPECIAL_STONE);
    }

    function getBombMarkers(cardState) {
        if (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function') {
            return MarkersAdapter.getBombMarkers(cardState);
        }
        return getMarkers(cardState).filter((marker) => marker && marker.kind === MARKER_KINDS.BOMB);
    }

    function getBlockadeMarkers(cardState) {
        return getSpecialMarkers(cardState).filter((marker) => marker && marker.data && marker.data.type === 'BLOCKADE');
    }

    function getBlockingMarkers(cardState) {
        return getSpecialMarkers(cardState).filter((marker) => (
            marker &&
            marker.data &&
            (marker.data.type === 'BLOCKADE' || marker.data.type === 'METEOR_HOLE' || marker.data.type === 'FREEZE')
        ));
    }

    function isFrozenCellForCard(cardState, row, col) {
        return getSpecialMarkers(cardState).some((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === 'FREEZE'
        ));
    }

    function isMeteorHoleCell(cardState, row, col) {
        return getSpecialMarkers(cardState).some((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === 'METEOR_HOLE'
        ));
    }

    function isGuardProtectedCell(cardState, row, col) {
        return getSpecialMarkers(cardState).some((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === 'GUARD'
        ));
    }

    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        if (MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function') {
            return MarkersAdapter.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        return getMarkers(cardState).find((marker) => (
            marker &&
            marker.kind === MARKER_KINDS.SPECIAL_STONE &&
            marker.row === row &&
            marker.col === col &&
            (type ? (marker.data && marker.data.type === type) : true) &&
            (owner ? marker.owner === owner : true)
        ));
    }

    function findBombMarkerAt(cardState, row, col) {
        if (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function') {
            return MarkersAdapter.findBombMarkerAt(cardState, row, col);
        }
        return getMarkers(cardState).find((marker) => (
            marker && marker.kind === MARKER_KINDS.BOMB && marker.row === row && marker.col === col
        ));
    }

    function removeMarkersAt(cardState, row, col, options) {
        if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const opts = options || {};
        cardState.markers = cardState.markers.filter((marker) => {
            if (!marker || marker.row !== row || marker.col !== col) return true;
            if (opts.kind && marker.kind !== opts.kind) return true;
            if (opts.type && (!marker.data || marker.data.type !== opts.type)) return true;
            if (opts.owner && marker.owner !== opts.owner) return true;
            return false;
        });
    }

    function getSpecialMarkerAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialMarkerAt === 'function') {
            return CardUtilsModule.getSpecialMarkerAt(cardState, row, col);
        }
        const special = findSpecialMarkerAt(cardState, row, col);
        if (special) return { kind: 'specialStone', marker: special };
        const bomb = findBombMarkerAt(cardState, row, col);
        if (bomb) return { kind: 'bomb', marker: bomb };
        return null;
    }

    function isSpecialStoneAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isSpecialStoneAt === 'function') {
            return CardUtilsModule.isSpecialStoneAt(cardState, row, col);
        }
        return !!getSpecialMarkerAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialOwnerAt === 'function') {
            return CardUtilsModule.getSpecialOwnerAt(cardState, row, col);
        }
        const entry = getSpecialMarkerAt(cardState, row, col);
        return entry && entry.marker ? entry.marker.owner : null;
    }

    function clearStoneIdAtForCard(cardState, gameState, row, col) {
        if (!cardState) return;
        if (isMainBoardCellForCard(row, col)) {
            if (cardState.stoneIdMap && cardState.stoneIdMap[row]) {
                cardState.stoneIdMap[row][col] = null;
            }
            return;
        }
        if (!hasExpansionCellForCard(gameState, row, col)) return;
        if (cardState.expansionStoneIdByCell && typeof cardState.expansionStoneIdByCell === 'object') {
            delete cardState.expansionStoneIdByCell[`${row},${col}`];
        }
    }

    function getStoneIdAtForCard(cardState, gameState, row, col) {
        if (!cardState) return null;
        if (isMainBoardCellForCard(row, col)) {
            return (cardState.stoneIdMap && cardState.stoneIdMap[row])
                ? (cardState.stoneIdMap[row][col] || null)
                : null;
        }
        if (!hasExpansionCellForCard(gameState, row, col)) return null;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') return null;
        return cardState.expansionStoneIdByCell[`${row},${col}`] || null;
    }

    function setStoneIdAtForCard(cardState, gameState, row, col, stoneId) {
        if (!cardState) return false;
        const boardSize = getBoardSize();
        if (isMainBoardCellForCard(row, col)) {
            if (!Array.isArray(cardState.stoneIdMap)) {
                cardState.stoneIdMap = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
            }
            if (!Array.isArray(cardState.stoneIdMap[row])) {
                cardState.stoneIdMap[row] = Array(boardSize).fill(null);
            }
            cardState.stoneIdMap[row][col] = stoneId || null;
            return true;
        }
        if (!hasExpansionCellForCard(gameState, row, col)) return false;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
            cardState.expansionStoneIdByCell = {};
        }
        const key = `${row},${col}`;
        if (stoneId == null) {
            delete cardState.expansionStoneIdByCell[key];
        } else {
            cardState.expansionStoneIdByCell[key] = stoneId;
        }
        return true;
    }

    function swapCellCoordinates(cardState, gameState, posA, posB) {
        if (!cardState || !gameState || !posA || !posB) return;

        const aRow = Number(posA.row);
        const aCol = Number(posA.col);
        const bRow = Number(posB.row);
        const bCol = Number(posB.col);
        if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol)) return;

        const stoneA = getStoneIdAtForCard(cardState, gameState, aRow, aCol);
        const stoneB = getStoneIdAtForCard(cardState, gameState, bRow, bCol);
        setStoneIdAtForCard(cardState, gameState, aRow, aCol, stoneB);
        setStoneIdAtForCard(cardState, gameState, bRow, bCol, stoneA);

        const markers = getMarkers(cardState);
        for (const marker of markers) {
            if (!marker) continue;
            if (marker.row === aRow && marker.col === aCol) {
                marker.row = bRow;
                marker.col = bCol;
            } else if (marker.row === bRow && marker.col === bCol) {
                marker.row = aRow;
                marker.col = aCol;
            }
        }

        const swapPoint = (point) => {
            if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col)) return point;
            if (point.row === aRow && point.col === aCol) return { row: bRow, col: bCol };
            if (point.row === bRow && point.col === bCol) return { row: aRow, col: aCol };
            return point;
        };

        if (cardState.workAnchorPosByPlayer) {
            cardState.workAnchorPosByPlayer.black = swapPoint(cardState.workAnchorPosByPlayer.black);
            cardState.workAnchorPosByPlayer.white = swapPoint(cardState.workAnchorPosByPlayer.white);
        }
        if (cardState.breedingSproutByOwner) {
            for (const owner of ['black', 'white']) {
                const points = Array.isArray(cardState.breedingSproutByOwner[owner]) ? cardState.breedingSproutByOwner[owner] : [];
                cardState.breedingSproutByOwner[owner] = points.map(swapPoint);
            }
        }
        if (cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object') {
            for (const key of Object.keys(cardState.breedingFrontierByAnchorId)) {
                const points = Array.isArray(cardState.breedingFrontierByAnchorId[key]) ? cardState.breedingFrontierByAnchorId[key] : [];
                cardState.breedingFrontierByAnchorId[key] = points.map(swapPoint);
            }
        }
    }

    function addMarker(cardState, kind, row, col, owner, data) {
        ensureMarkers(cardState);
        const id = cardState._nextMarkerId || 1;
        cardState._nextMarkerId = id + 1;

        if (typeof cardState._nextCreatedSeq === 'undefined') cardState._nextCreatedSeq = 1;
        const createdSeq = cardState._nextCreatedSeq++;

        const marker = {
            id,
            row,
            col,
            kind,
            owner,
            createdSeq,
            data: data || {}
        };

        cardState.markers.push(marker);

        try {
            const presentationHelper = getPresentationHelper();
            let special = null;
            let timer = null;
            let flipEvadeRemaining = null;
            let destroyEvadeRemaining = null;

            if (kind === MARKER_KINDS.SPECIAL_STONE) {
                special = data && data.type ? data.type : null;
                timer = (data && typeof data.remainingOwnerTurns === 'number') ? data.remainingOwnerTurns : null;
                flipEvadeRemaining = Number.isFinite(Number(data && data.flipEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(data.flipEvadeRemaining)))
                    : null;
                destroyEvadeRemaining = Number.isFinite(Number(data && data.destroyEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(data.destroyEvadeRemaining)))
                    : null;
            } else if (kind === MARKER_KINDS.BOMB) {
                special = 'TIME_BOMB';
                timer = (data && typeof data.remainingTurns === 'number') ? data.remainingTurns : null;
            }

            const markerMeta = { special, timer, owner };
            if (flipEvadeRemaining !== null) markerMeta.flipEvadeRemaining = flipEvadeRemaining;
            if (destroyEvadeRemaining !== null) markerMeta.destroyEvadeRemaining = destroyEvadeRemaining;

            if (special && presentationHelper) {
                presentationHelper.emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: markerMeta });
            }

            if (special && cardState) {
                const currentActionId = (cardState._currentActionMeta && cardState._currentActionMeta.actionId) || null;
                const persist = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist : [];
                const live = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents : [];
                const patchSpawnMeta = (events) => {
                    for (let index = events.length - 1; index >= 0; index--) {
                        const event = events[index];
                        if (!event || event.type !== 'SPAWN') continue;
                        if (event.row !== row || event.col !== col) continue;
                        if (currentActionId && event.actionId && event.actionId !== currentActionId) continue;
                        event.meta = Object.assign({}, event.meta || {}, markerMeta);
                        return true;
                    }
                    return false;
                };
                if (!patchSpawnMeta(persist)) patchSpawnMeta(live);
            }
        } catch (e) { /* ignore presentation failures */ }

        return marker;
    }

    function removeMarkerById(cardState, markerId) {
        if (!cardState || !Array.isArray(cardState.markers)) return false;
        const index = cardState.markers.findIndex((marker) => marker && marker.id === markerId);
        if (index === -1) return false;
        cardState.markers.splice(index, 1);
        return true;
    }

    function applyExtendLifeWill(cardState, gameState, playerKey, row, col, deps) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'EXTEND_LIFE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getTargets = deps && typeof deps.getExtendLifeTargets === 'function'
            ? deps.getExtendLifeTargets
            : (() => []);
        const targets = getTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const specialsAtCell = getSpecialMarkers(cardState).filter((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.owner === playerKey &&
            marker.data &&
            Number.isFinite(marker.data.remainingOwnerTurns) &&
            Number(marker.data.remainingOwnerTurns) > 0
        ));
        if (!specialsAtCell.length) {
            return { applied: false, reason: 'no_duration' };
        }

        const primaryMarker = specialsAtCell.find((marker) => {
            const type = marker && marker.data ? marker.data.type : null;
            return type !== 'GUARD';
        }) || specialsAtCell[0];

        let previousRemainingOwnerTurns = 0;
        let newRemainingOwnerTurns = 0;
        for (const marker of specialsAtCell) {
            const before = Number(marker.data.remainingOwnerTurns || 0);
            const after = Math.max(1, Math.trunc(before * 2));
            marker.data.remainingOwnerTurns = after;
            if (marker === primaryMarker) {
                previousRemainingOwnerTurns = before;
                newRemainingOwnerTurns = after;
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col, previousRemainingOwnerTurns, newRemainingOwnerTurns };
    }

    function applyCorrosionWill(cardState, gameState, playerKey, row, col, deps) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'CORROSION_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending', affectedCount: 0, details: [] };
        }

        const getTargets = deps && typeof deps.getCorrosionTargets === 'function'
            ? deps.getCorrosionTargets
            : (() => []);
        const targets = getTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) {
            return { applied: false, reason: 'invalid_target', affectedCount: 0, details: [] };
        }

        const details = [];
        for (const marker of getSpecialMarkers(cardState)) {
            if (!marker || marker.row !== row || marker.col !== col) continue;
            if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns)) continue;

            const before = Number(marker.data.remainingOwnerTurns);
            if (before <= 0) continue;

            const after = Math.max(1, Math.trunc(before / 2));
            marker.data.remainingOwnerTurns = after;
            details.push({
                row: marker.row,
                col: marker.col,
                owner: marker.owner || null,
                special: marker.data && marker.data.type ? marker.data.type : null,
                previousRemainingOwnerTurns: before,
                newRemainingOwnerTurns: after
            });
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, affectedCount: details.length, details };
    }

    return {
        MARKER_KINDS,
        ensureMarkers,
        getMarkers,
        getSpecialMarkers,
        getBombMarkers,
        getBlockadeMarkers,
        getBlockingMarkers,
        isFrozenCellForCard,
        isMeteorHoleCell,
        isGuardProtectedCell,
        findSpecialMarkerAt,
        findBombMarkerAt,
        removeMarkersAt,
        getSpecialMarkerAt,
        isSpecialStoneAt,
        getSpecialOwnerAt,
        clearStoneIdAtForCard,
        getStoneIdAtForCard,
        setStoneIdAtForCard,
        swapCellCoordinates,
        addMarker,
        removeMarkerById,
        applyExtendLifeWill,
        applyCorrosionWill
    };
}));