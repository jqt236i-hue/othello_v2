"use strict";
/**
 * @file markers.ts
 * @description Marker helpers (Shared between Browser and Headless)
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
const MarkersAdapterModule = (() => {
    if (typeof module === 'object' && module.exports) {
        try {
            return _require('../markers_adapter');
        }
        catch (e) { /* ignore */ }
    }
    return (typeof self !== 'undefined' ? self.MarkersAdapter : null);
})();
const CardUtilsModule = (() => {
    if (typeof module === 'object' && module.exports) {
        try {
            return _require('./utils');
        }
        catch (e) { /* ignore */ }
    }
    return (typeof self !== 'undefined' ? self.CardUtils : null);
})();
const CardExpansionModule = (() => {
    if (typeof module === 'object' && module.exports) {
        try {
            return _require('./expansion');
        }
        catch (e) { /* ignore */ }
    }
    return (typeof self !== 'undefined' ? self.CardExpansion : null);
})();
const PresentationModule = (() => {
    if (typeof module === 'object' && module.exports) {
        try {
            return _require('../presentation');
        }
        catch (e) { /* ignore */ }
    }
    return (typeof self !== 'undefined' ? self.PresentationHelper : null);
})();
const { BOARD_SIZE } = SharedConstants || {};
const MarkersAdapter = MarkersAdapterModule || null;
const MARKER_KINDS = (MarkersAdapter && MarkersAdapter.MARKER_KINDS)
    ? MarkersAdapter.MARKER_KINDS
    : {
        SPECIAL_STONE: 'specialStone'
    };
const MARKER_CATEGORIES = (MarkersAdapter && MarkersAdapter.MARKER_CATEGORIES)
    ? MarkersAdapter.MARKER_CATEGORIES
    : { BOMB: 'bomb' };
function getBoardSize() {
    return Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
}
function resolveMarkerBoardConfig(boardOrConfig) {
    if (boardOrConfig && Number.isInteger(boardOrConfig.rows) && Number.isInteger(boardOrConfig.cols)) {
        return { rows: boardOrConfig.rows, cols: boardOrConfig.cols };
    }
    const board = Array.isArray(boardOrConfig)
        ? boardOrConfig
        : (boardOrConfig && Array.isArray(boardOrConfig.board)
            ? boardOrConfig.board
            : (boardOrConfig && Array.isArray(boardOrConfig.stoneIdMap) ? boardOrConfig.stoneIdMap : null));
    const rows = Array.isArray(board) && board.length > 0
        ? board.length
        : getBoardSize();
    const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0
        ? board[0].length
        : rows;
    return { rows, cols };
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
function getPrimaryDurationMarker(markersAtCell) {
    const markers = Array.isArray(markersAtCell) ? markersAtCell.filter(Boolean) : [];
    return markers.find((marker) => {
        const type = marker && marker.data ? marker.data.type : null;
        return type !== 'GUARD';
    }) || markers[0] || null;
}
function emitDurationChangeStatusTick(cardState, marker, options) {
    const presentationHelper = getPresentationHelper();
    if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function')
        return;
    if (!marker || !marker.data)
        return;
    const settings = (options && typeof options === 'object') ? options : {};
    const meta = {
        special: marker.data.type || null,
        timer: (typeof marker.data.remainingOwnerTurns === 'number') ? marker.data.remainingOwnerTurns : null,
        owner: marker.owner || null,
        reason: settings.reason || null,
        highlightTone: settings.highlightTone || null
    };
    if (typeof marker.data.regenRemaining === 'number')
        meta.regenRemaining = marker.data.regenRemaining;
    if (Number.isFinite(Number(marker.data.flipEvadeRemaining))) {
        meta.flipEvadeRemaining = Math.max(0, Math.trunc(Number(marker.data.flipEvadeRemaining)));
    }
    if (Number.isFinite(Number(marker.data.destroyEvadeRemaining))) {
        meta.destroyEvadeRemaining = Math.max(0, Math.trunc(Number(marker.data.destroyEvadeRemaining)));
    }
    presentationHelper.emitPresentationEvent(cardState, {
        type: 'STATUS_TICK',
        row: marker.row,
        col: marker.col,
        meta
    });
}
function isMainBoardCellForCard(row, col, boardOrConfig) {
    if (CardExpansionModule && typeof CardExpansionModule.isMainBoardCellForCard === 'function') {
        return CardExpansionModule.isMainBoardCellForCard(row, col, boardOrConfig);
    }
    const config = resolveMarkerBoardConfig(boardOrConfig);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
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
    if (!cardState)
        return;
    if (!Array.isArray(cardState.markers))
        cardState.markers = [];
    if (typeof cardState._nextMarkerId !== 'number')
        cardState._nextMarkerId = 1;
    if (typeof cardState._nextCreatedSeq !== 'number')
        cardState._nextCreatedSeq = 1;
}
function getMarkers(cardState) {
    if (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function') {
        return MarkersAdapter.getMarkers(cardState);
    }
    return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
}
function getMarkerCategory(marker) {
    if (MarkersAdapter && typeof MarkersAdapter.getMarkerCategory === 'function') {
        return MarkersAdapter.getMarkerCategory(marker);
    }
    if (!marker)
        return null;
    if (marker.data && typeof marker.data.category === 'string' && marker.data.category) {
        return marker.data.category;
    }
    if (marker.kind === MARKER_CATEGORIES.BOMB)
        return MARKER_CATEGORIES.BOMB;
    return (marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        marker.data &&
        marker.data.category === MARKER_CATEGORIES.BOMB) ? MARKER_CATEGORIES.BOMB : null;
}
function isBombCategoryMarker(marker) {
    if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
}
function isSpecialStoneMarker(marker) {
    if (MarkersAdapter && typeof MarkersAdapter.isSpecialStoneMarker === 'function') {
        return MarkersAdapter.isSpecialStoneMarker(marker);
    }
    return !!(marker &&
        marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        !isBombCategoryMarker(marker));
}
function getBombMarkerType(marker) {
    if (MarkersAdapter && typeof MarkersAdapter.getBombMarkerType === 'function') {
        return MarkersAdapter.getBombMarkerType(marker);
    }
    if (!isBombCategoryMarker(marker))
        return null;
    return marker && marker.data && marker.data.type ? marker.data.type : 'TIME_BOMB';
}
function normalizeMarkerInput(kind, data) {
    if (MarkersAdapter && typeof MarkersAdapter.normalizeMarkerInput === 'function') {
        return MarkersAdapter.normalizeMarkerInput(kind, data);
    }
    const normalizedData = (data && typeof data === 'object') ? { ...data } : {};
    const isBombInput = kind === MARKER_CATEGORIES.BOMB ||
        normalizedData.category === MARKER_CATEGORIES.BOMB ||
        normalizedData.type === 'TIME_BOMB';
    if (isBombInput) {
        normalizedData.category = MARKER_CATEGORIES.BOMB;
        if (!normalizedData.type)
            normalizedData.type = 'TIME_BOMB';
        return { kind: MARKER_KINDS.SPECIAL_STONE, data: normalizedData };
    }
    return { kind, data: normalizedData };
}
function getSpecialMarkers(cardState) {
    if (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function') {
        return MarkersAdapter.getSpecialMarkers(cardState);
    }
    return getMarkers(cardState).filter(isSpecialStoneMarker);
}
function getBombMarkers(cardState) {
    if (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function') {
        return MarkersAdapter.getBombMarkers(cardState);
    }
    return getMarkers(cardState).filter(isBombCategoryMarker);
}
function getBlockadeMarkers(cardState) {
    return getSpecialMarkers(cardState).filter((marker) => marker && marker.data && marker.data.type === 'BLOCKADE');
}
function getBlockingMarkers(cardState) {
    return getSpecialMarkers(cardState).filter((marker) => (marker &&
        marker.data &&
        (marker.data.type === 'BLOCKADE' || marker.data.type === 'METEOR_HOLE' || marker.data.type === 'FREEZE')));
}
function isFrozenCellForCard(cardState, row, col) {
    return getSpecialMarkers(cardState).some((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'FREEZE'));
}
function isMeteorHoleCell(cardState, row, col) {
    return getSpecialMarkers(cardState).some((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'METEOR_HOLE'));
}
function isGuardProtectedCell(cardState, row, col) {
    return getSpecialMarkers(cardState).some((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'GUARD'));
}
function findSpecialMarkerAt(cardState, row, col, type, owner) {
    if (MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function') {
        return MarkersAdapter.findSpecialMarkerAt(cardState, row, col, type, owner);
    }
    return getMarkers(cardState).find((marker) => (marker &&
        isSpecialStoneMarker(marker) &&
        marker.row === row &&
        marker.col === col &&
        (type ? (marker.data && marker.data.type === type) : true) &&
        (owner ? marker.owner === owner : true)));
}
function findBombMarkerAt(cardState, row, col) {
    if (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function') {
        return MarkersAdapter.findBombMarkerAt(cardState, row, col);
    }
    return getMarkers(cardState).find((marker) => (marker && isBombCategoryMarker(marker) && marker.row === row && marker.col === col));
}
function removeMarkersAt(cardState, row, col, options) {
    if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col, options);
        return;
    }
    if (!cardState || !Array.isArray(cardState.markers))
        return;
    const opts = options || {};
    cardState.markers = cardState.markers.filter((marker) => {
        if (!marker || marker.row !== row || marker.col !== col)
            return true;
        if (opts.kind === MARKER_CATEGORIES.BOMB && !isBombCategoryMarker(marker))
            return true;
        if (opts.kind === MARKER_KINDS.SPECIAL_STONE && !isSpecialStoneMarker(marker))
            return true;
        if (opts.kind && opts.kind !== MARKER_CATEGORIES.BOMB && opts.kind !== MARKER_KINDS.SPECIAL_STONE && marker.kind !== opts.kind)
            return true;
        if (opts.category && getMarkerCategory(marker) !== opts.category)
            return true;
        if (opts.type && (!marker.data || marker.data.type !== opts.type))
            return true;
        if (opts.owner && marker.owner !== opts.owner)
            return true;
        return false;
    });
}
function getSpecialMarkerAt(cardState, row, col) {
    const special = getSpecialMarkers(cardState).find((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() !== 'LIVING_WILL'));
    if (special)
        return { kind: 'specialStone', category: getMarkerCategory(special), marker: special };
    const bomb = findBombMarkerAt(cardState, row, col);
    if (bomb)
        return { kind: 'specialStone', category: MARKER_CATEGORIES.BOMB, marker: bomb };
    return null;
}
function isSpecialStoneAt(cardState, row, col) {
    return !!getSpecialMarkerAt(cardState, row, col);
}
function getSpecialOwnerAt(cardState, row, col) {
    const entry = getSpecialMarkerAt(cardState, row, col);
    return entry && entry.marker ? entry.marker.owner : null;
}
function clearStoneIdAtForCard(cardState, gameState, row, col) {
    if (!cardState)
        return;
    if (isMainBoardCellForCard(row, col, gameState || cardState)) {
        if (cardState.stoneIdMap && cardState.stoneIdMap[row]) {
            cardState.stoneIdMap[row][col] = null;
        }
        return;
    }
    if (!hasExpansionCellForCard(gameState, row, col))
        return;
    if (cardState.expansionStoneIdByCell && typeof cardState.expansionStoneIdByCell === 'object') {
        delete cardState.expansionStoneIdByCell[`${row},${col}`];
    }
}
function getStoneIdAtForCard(cardState, gameState, row, col) {
    if (!cardState)
        return null;
    if (isMainBoardCellForCard(row, col, gameState || cardState)) {
        return (cardState.stoneIdMap && cardState.stoneIdMap[row])
            ? (cardState.stoneIdMap[row][col] || null)
            : null;
    }
    if (!hasExpansionCellForCard(gameState, row, col))
        return null;
    if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object')
        return null;
    return cardState.expansionStoneIdByCell[`${row},${col}`] || null;
}
function setStoneIdAtForCard(cardState, gameState, row, col, stoneId) {
    if (!cardState)
        return false;
    const boardConfig = resolveMarkerBoardConfig((gameState && gameState.boardConfig) || gameState || cardState);
    if (isMainBoardCellForCard(row, col, gameState || cardState)) {
        if (!Array.isArray(cardState.stoneIdMap)) {
            cardState.stoneIdMap = Array.from({ length: boardConfig.rows }, () => Array(boardConfig.cols).fill(null));
        }
        if (!Array.isArray(cardState.stoneIdMap[row])) {
            cardState.stoneIdMap[row] = Array(boardConfig.cols).fill(null);
        }
        cardState.stoneIdMap[row][col] = stoneId || null;
        return true;
    }
    if (!hasExpansionCellForCard(gameState, row, col))
        return false;
    if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
        cardState.expansionStoneIdByCell = {};
    }
    const key = `${row},${col}`;
    if (stoneId == null) {
        delete cardState.expansionStoneIdByCell[key];
    }
    else {
        cardState.expansionStoneIdByCell[key] = stoneId;
    }
    return true;
}
function swapCellCoordinates(cardState, gameState, posA, posB) {
    if (!cardState || !gameState || !posA || !posB)
        return;
    const aRow = Number(posA.row);
    const aCol = Number(posA.col);
    const bRow = Number(posB.row);
    const bCol = Number(posB.col);
    if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol))
        return;
    const stoneA = getStoneIdAtForCard(cardState, gameState, aRow, aCol);
    const stoneB = getStoneIdAtForCard(cardState, gameState, bRow, bCol);
    setStoneIdAtForCard(cardState, gameState, aRow, aCol, stoneB);
    setStoneIdAtForCard(cardState, gameState, bRow, bCol, stoneA);
    const markers = getMarkers(cardState);
    for (const marker of markers) {
        if (!marker)
            continue;
        if (marker.row === aRow && marker.col === aCol) {
            marker.row = bRow;
            marker.col = bCol;
        }
        else if (marker.row === bRow && marker.col === bCol) {
            marker.row = aRow;
            marker.col = aCol;
        }
    }
    const swapPoint = (point) => {
        if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col))
            return point;
        if (point.row === aRow && point.col === aCol)
            return { row: bRow, col: bCol };
        if (point.row === bRow && point.col === bCol)
            return { row: aRow, col: aCol };
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
    if (typeof cardState._nextCreatedSeq === 'undefined')
        cardState._nextCreatedSeq = 1;
    const createdSeq = cardState._nextCreatedSeq++;
    const normalized = normalizeMarkerInput(kind, data);
    const marker = {
        id,
        row,
        col,
        kind: normalized.kind,
        owner,
        createdSeq,
        data: normalized.data
    };
    cardState.markers.push(marker);
    try {
        const presentationHelper = getPresentationHelper();
        let special = null;
        let timer = null;
        let flipEvadeRemaining = null;
        let destroyEvadeRemaining = null;
        if (isBombCategoryMarker(marker)) {
            special = getBombMarkerType(marker);
            timer = (marker.data && typeof marker.data.remainingTurns === 'number') ? marker.data.remainingTurns : null;
        }
        else if (isSpecialStoneMarker(marker)) {
            special = marker.data && marker.data.type ? marker.data.type : null;
            timer = (marker.data && typeof marker.data.remainingOwnerTurns === 'number') ? marker.data.remainingOwnerTurns : null;
            flipEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.flipEvadeRemaining))
                ? Math.max(0, Math.trunc(Number(marker.data.flipEvadeRemaining)))
                : null;
            destroyEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.destroyEvadeRemaining))
                ? Math.max(0, Math.trunc(Number(marker.data.destroyEvadeRemaining)))
                : null;
        }
        const isHiddenTrap = isSpecialStoneMarker(marker) &&
            special === 'TRAP' &&
            !!(marker.data && marker.data.hidden);
        const markerMeta = { special, timer, owner };
        if (flipEvadeRemaining !== null)
            markerMeta.flipEvadeRemaining = flipEvadeRemaining;
        if (destroyEvadeRemaining !== null)
            markerMeta.destroyEvadeRemaining = destroyEvadeRemaining;
        if (special && presentationHelper && !isHiddenTrap) {
            presentationHelper.emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: markerMeta });
        }
        if (special && cardState && !isHiddenTrap) {
            const currentActionId = (cardState._currentActionMeta && cardState._currentActionMeta.actionId) || null;
            const persist = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist : [];
            const live = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents : [];
            const patchSpawnMeta = (events) => {
                for (let index = events.length - 1; index >= 0; index--) {
                    const event = events[index];
                    if (!event || event.type !== 'SPAWN')
                        continue;
                    if (event.row !== row || event.col !== col)
                        continue;
                    if (currentActionId && event.actionId && event.actionId !== currentActionId)
                        continue;
                    event.meta = Object.assign({}, event.meta || {}, markerMeta);
                    return true;
                }
                return false;
            };
            if (!patchSpawnMeta(persist))
                patchSpawnMeta(live);
        }
    }
    catch (e) { /* ignore presentation failures */ }
    return marker;
}
function removeMarkerById(cardState, markerId) {
    if (!cardState || !Array.isArray(cardState.markers))
        return false;
    const index = cardState.markers.findIndex((marker) => marker && marker.id === markerId);
    if (index === -1)
        return false;
    cardState.markers.splice(index, 1);
    return true;
}
function applyExtendLifeSelection(cardState, gameState, playerKey, row, col, deps, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const pendingType = settings.pendingType || 'EXTEND_LIFE_WILL';
    const multiplier = Number.isFinite(settings.multiplier) ? Number(settings.multiplier) : 2;
    const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const getTargets = deps && typeof deps.getExtendLifeTargets === 'function'
        ? deps.getExtendLifeTargets
        : (() => []);
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    const specialsAtCell = getSpecialMarkers(cardState).filter((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        marker.owner === playerKey &&
        marker.data &&
        Number.isFinite(marker.data.remainingOwnerTurns) &&
        Number(marker.data.remainingOwnerTurns) > 0));
    if (!specialsAtCell.length) {
        return { applied: false, reason: 'no_duration' };
    }
    const primaryMarker = getPrimaryDurationMarker(specialsAtCell);
    let previousRemainingOwnerTurns = 0;
    let newRemainingOwnerTurns = 0;
    for (const marker of specialsAtCell) {
        const before = Number(marker.data.remainingOwnerTurns || 0);
        const after = Math.max(1, Math.trunc(before * multiplier));
        marker.data.remainingOwnerTurns = after;
        if (marker === primaryMarker) {
            previousRemainingOwnerTurns = before;
            newRemainingOwnerTurns = after;
        }
    }
    if (primaryMarker) {
        emitDurationChangeStatusTick(cardState, primaryMarker, {
            reason: 'extend_life_applied',
            highlightTone: 'positive'
        });
    }
    cardState.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, row, col, previousRemainingOwnerTurns, newRemainingOwnerTurns, multiplier, cardType: pendingType };
}
function applyExtendLifeWill(cardState, gameState, playerKey, row, col, deps) {
    return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, deps, {
        pendingType: 'EXTEND_LIFE_WILL',
        multiplier: 2
    });
}
function applyExtendLifeGod(cardState, gameState, playerKey, row, col, deps) {
    return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, deps, {
        pendingType: 'EXTEND_LIFE_GOD',
        multiplier: 4
    });
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
        if (!marker || marker.row !== row || marker.col !== col)
            continue;
        if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns))
            continue;
        const before = Number(marker.data.remainingOwnerTurns);
        if (before <= 0)
            continue;
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
    const primaryMarker = getPrimaryDurationMarker(getSpecialMarkers(cardState).filter((marker) => (marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        Number.isFinite(marker.data.remainingOwnerTurns) &&
        Number(marker.data.remainingOwnerTurns) > 0)));
    if (primaryMarker) {
        emitDurationChangeStatusTick(cardState, primaryMarker, {
            reason: 'corrosion_applied',
            highlightTone: 'negative'
        });
    }
    cardState.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, affectedCount: details.length, details };
}
module.exports = {
    MARKER_KINDS,
    MARKER_CATEGORIES,
    ensureMarkers,
    getMarkers,
    getMarkerCategory,
    getBombMarkerType,
    isBombCategoryMarker,
    isSpecialStoneMarker,
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
    applyExtendLifeGod,
    applyCorrosionWill
};
//# sourceMappingURL=markers.js.map