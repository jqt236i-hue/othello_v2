/**
 * @file markers.ts
 * @description Marker helpers (Shared between Browser and Headless)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function resolveCardMarkersModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        try {
            return _require(id) || getRuntimeGlobalValue(globalKey);
        } catch (e) {
            return getRuntimeGlobalValue(globalKey);
        }
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedBoardUtils = resolveCardMarkersModuleOrGlobal('../../../shared/shared-board-utils', 'SharedBoardUtils');
const MarkersAdapterModule = resolveCardMarkersModuleOrGlobal('../markers_adapter', 'MarkersAdapter');
const CardUtilsModule = resolveCardMarkersModuleOrGlobal('./utils', 'CardUtils');
const PresentationModule = resolveCardMarkersModuleOrGlobal('../presentation', 'PresentationHelper');
const SpecialStoneRegistry = resolveCardMarkersModuleOrGlobal('../../../shared/special-stone-registry', 'SpecialStoneRegistry');
const ManifestStoneRegistry = resolveCardMarkersModuleOrGlobal('../../../shared/manifest-stone-registry', 'ManifestStoneRegistry');

function isManifestStoneType(rawType: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

const MarkersAdapter = MarkersAdapterModule || null;
const MARKER_KINDS = (MarkersAdapter && MarkersAdapter.MARKER_KINDS)
    ? MarkersAdapter.MARKER_KINDS
    : {
        SPECIAL_STONE: 'specialStone',
        MANIFEST_STONE: 'manifestStone'
    };
const MARKER_CATEGORIES = (MarkersAdapter && MarkersAdapter.MARKER_CATEGORIES)
    ? MarkersAdapter.MARKER_CATEGORIES
    : { BOMB: 'bomb' };

function getMarkerBoardKernel(): any {
    if (
        !SharedBoardUtils ||
        typeof SharedBoardUtils.createBoardContext !== 'function' ||
        typeof SharedBoardUtils.createBoardView !== 'function' ||
        typeof SharedBoardUtils.toBoardCellKey !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext APIs are required by CardMarkers');
    }
    return SharedBoardUtils;
}

function getPresentationHelper(): any {
    if (PresentationModule && typeof PresentationModule.emitPresentationEvent === 'function') {
        return PresentationModule;
    }
    const helper = getRuntimeGlobalValue('PresentationHelper');
    return (helper && typeof helper.emitPresentationEvent === 'function') ? helper : null;
}

function getPrimaryDurationMarker(markersAtCell: any[]): any {
    const markers = Array.isArray(markersAtCell) ? markersAtCell.filter(Boolean) : [];
    return markers.find((marker: any) => {
        const type = marker && marker.data ? marker.data.type : null;
        return type !== 'GUARD';
    }) || markers[0] || null;
}

function emitDurationChangeStatusTick(cardState: CardState, marker: any, options: any): void {
    const presentationHelper = getPresentationHelper();
    if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function') return;
    if (!marker || !marker.data) return;
    const settings = (options && typeof options === 'object') ? options : {};
    const meta: any = {
        special: marker.data.type || null,
        timer: (typeof marker.data.remainingOwnerTurns === 'number') ? marker.data.remainingOwnerTurns : null,
        owner: marker.owner || null,
        reason: settings.reason || null,
        highlightTone: settings.highlightTone || null
    };
    if (typeof marker.data.regenRemaining === 'number') meta.regenRemaining = marker.data.regenRemaining;
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

function getMarkerBoardView(cardState: CardState, gameState: GameState): any {
    const boardKernel = getMarkerBoardKernel();
    const context = boardKernel.createBoardContext(gameState, cardState);
    return boardKernel.createBoardView(context.gameState, {
        cardState: context.cardState,
        strict: false
    });
}

function ensureMarkers(cardState: CardState): void {
    if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
        MarkersAdapter.ensureMarkers(cardState);
        return;
    }
    if (!cardState) return;
    if (!Array.isArray((cardState as any).markers)) (cardState as any).markers = [];
    if (typeof (cardState as any)._nextMarkerId !== 'number') (cardState as any)._nextMarkerId = 1;
    if (typeof (cardState as any)._nextCreatedSeq !== 'number') (cardState as any)._nextCreatedSeq = 1;
}

function getMarkers(cardState: CardState): any[] {
    if (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function') {
        return MarkersAdapter.getMarkers(cardState);
    }
    return (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
}

function getMarkerCategory(marker: any): string | null {
    if (MarkersAdapter && typeof MarkersAdapter.getMarkerCategory === 'function') {
        return MarkersAdapter.getMarkerCategory(marker);
    }
    if (!marker) return null;
    if (marker.data && typeof marker.data.category === 'string' && marker.data.category) {
        return marker.data.category;
    }
    if (marker.kind === MARKER_CATEGORIES.BOMB) return MARKER_CATEGORIES.BOMB;
    return (
        marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        marker.data &&
        marker.data.category === MARKER_CATEGORIES.BOMB
    ) ? MARKER_CATEGORIES.BOMB : null;
}

function isBombCategoryMarker(marker: any): boolean {
    if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
}

function isSpecialStoneMarker(marker: any): boolean {
    if (MarkersAdapter && typeof MarkersAdapter.isSpecialStoneMarker === 'function') {
        return MarkersAdapter.isSpecialStoneMarker(marker);
    }
    return !!(
        marker &&
        marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        !isBombCategoryMarker(marker) &&
        !isManifestStoneMarker(marker)
    );
}

function isManifestStoneMarker(marker: any): boolean {
    if (MarkersAdapter && typeof MarkersAdapter.isManifestStoneMarker === 'function') {
        return MarkersAdapter.isManifestStoneMarker(marker);
    }
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isManifestStoneMarker(marker) === true;
    }
    const type = getNormalizedMarkerType(marker);
    return !!(
        marker &&
        (marker.kind === MARKER_KINDS.MANIFEST_STONE || marker.kind === MARKER_KINDS.SPECIAL_STONE) &&
        isManifestStoneType(type)
    );
}

function getMarkerRuleClass(marker: any): string | null {
    if (!marker || typeof marker !== 'object') return null;
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.classifyMarkerRuleClass === 'function') {
        return SpecialStoneRegistry.classifyMarkerRuleClass(marker);
    }
    const type = String(marker && marker.data && marker.data.type || '').toUpperCase();
    if (isBombCategoryMarker(marker) || type === 'TIME_BOMB') return 'bomb';
    if (type === 'TRAP') return 'trap';
    if (type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE' || type === 'SEED' || type === 'POISON_CELL' || type === 'SCORCHED_CELL') return 'board_marker';
    if (type === 'HYPERACTIVE' && !!(marker && marker.data && marker.data.instantPlacementOnly)) return 'placement_effect';
    if (type === 'CROSS_BOMB' || type === 'X_BOMB' || type === 'GOLD' || type === 'SILVER' || type === 'RAINBOW') return 'placement_effect';
    if (type === 'GUARD' || type === 'LIVING_WILL' || type === 'POISONED' || type === 'SCORCHED') return 'stone_status';
    if (!type) return null;
    return 'true_special_stone';
}

function isTrueSpecialStoneMarker(marker: any): boolean {
    if (isManifestStoneMarker(marker)) return false;
    return getMarkerRuleClass(marker) === 'true_special_stone';
}

function isTemptTargetableMarker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = getNormalizedMarkerType(marker);
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isTemptTargetableStoneEffect === 'function') {
        return SpecialStoneRegistry.isTemptTargetableStoneEffect(type, marker.data) === true;
    }
    if (type === 'GUARD') return false;
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb' || type === 'LIVING_WILL';
}

function isCaptureTargetableMarker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = getNormalizedMarkerType(marker);
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isCaptureTargetableStoneEffect === 'function') {
        return SpecialStoneRegistry.isCaptureTargetableStoneEffect(type, marker.data) === true;
    }
    return getMarkerRuleClass(marker) === 'true_special_stone';
}

function blocksTemptAt(cardState: CardState, row: number, col: number): boolean {
    return getMarkers(cardState).some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col || !marker.data) return false;
        const type = getNormalizedMarkerType(marker);
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.blocksTempt === 'function') {
            return SpecialStoneRegistry.blocksTempt(type, marker.data) === true;
        }
        return type === 'GUARD';
    });
}

function canLossWillRevertMarker(marker: any): boolean {
    if (!marker || typeof marker !== 'object') return false;
    if (isManifestStoneMarker(marker)) return false;
    const type = getNormalizedMarkerType(marker);
    if (!type) return false;
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.canLossWillRevert === 'function') {
        return SpecialStoneRegistry.canLossWillRevert(type, marker.data || null) === true;
    }
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb';
}

function isDurationAffectableMarker(marker: any): boolean {
    if (isManifestStoneMarker(marker)) return false;
    const type = getNormalizedMarkerType(marker);
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getStoneEffectRule === 'function') {
        const rule = SpecialStoneRegistry.getStoneEffectRule(type, marker && marker.data);
        if (rule) return rule.durationAffectable === true;
    }
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone' || ruleClass === 'stone_status';
}

function normalizeMarkerOwnerKey(value: any): string {
    return value === 'white' ? 'white' : 'black';
}

function getNormalizedMarkerType(marker: any): string {
    const rawType = marker && marker.data ? marker.data.type : null;
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.normalizeSpecialStoneType === 'function') {
        return SpecialStoneRegistry.normalizeSpecialStoneType(rawType) || '';
    }
    return String(rawType || '').trim().toUpperCase();
}

function isActiveSpecialMarker(marker: any): boolean {
    if (!marker || marker.kind !== MARKER_KINDS.SPECIAL_STONE || !marker.data) return false;
    if (isManifestStoneMarker(marker)) return false;
    if (Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
        const remainingOwnerTurns = Number(marker.data.remainingOwnerTurns);
        if (!Number.isFinite(remainingOwnerTurns) || remainingOwnerTurns <= 0) return false;
    }
    return true;
}

function isActiveManifestMarker(marker: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isActiveManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isActiveManifestStoneMarker(marker) === true;
    }
    if (!isManifestStoneMarker(marker) || !marker.data) return false;
    if (Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
        const remainingOwnerTurns = Number(marker.data.remainingOwnerTurns);
        if (!Number.isFinite(remainingOwnerTurns) || remainingOwnerTurns <= 0) return false;
    }
    return true;
}

function isInviolableMarker(marker: any): boolean {
    if (isActiveManifestMarker(marker)) {
        const type = getNormalizedMarkerType(marker);
        if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isInviolableManifestStoneType === 'function') {
            return ManifestStoneRegistry.isInviolableManifestStoneType(type) === true;
        }
        return isManifestStoneType(type);
    }
    return false;
}

function isInviolableCell(cardState: CardState, row: number, col: number): boolean {
    return getMarkers(cardState).some((marker: any) => (
        marker &&
        markerOccupiesCell(marker, row, col) &&
        isInviolableMarker(marker)
    ));
}

function isTheoryIncarnationStoneReservedForPlayer(cardState: CardState, playerKey: any): boolean {
    const stateRef: any = cardState || {};
    const reservations = stateRef.nextTheoryIncarnationStoneByPlayer;
    if (!reservations || typeof reservations !== 'object') return false;
    const ownerKey = normalizeMarkerOwnerKey(playerKey);
    const reservation = reservations[ownerKey];
    if (!reservation || typeof reservation !== 'object') return false;
    const type = String(reservation.sourceType || reservation.type || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION';
}

function isCardPlayLockedForPlayer(cardState: CardState, playerKey: PlayerKey): boolean {
    const ownerKey = normalizeMarkerOwnerKey(playerKey);
    if (isTheoryIncarnationStoneReservedForPlayer(cardState, ownerKey)) return true;
    return getMarkers(cardState).some((marker: any) => {
        if (!isActiveManifestMarker(marker)) return false;
        const type = getNormalizedMarkerType(marker);
        if (type === 'BOARD_EXECUTOR') return true;
        return type === 'THEORY_INCARNATION' && normalizeMarkerOwnerKey(marker.owner) === ownerKey;
    });
}

function isPlacementLockedForPlayer(cardState: CardState, playerKey: PlayerKey): boolean {
    return false;
}

function getBombMarkerType(marker: any): string | null {
    if (MarkersAdapter && typeof MarkersAdapter.getBombMarkerType === 'function') {
        return MarkersAdapter.getBombMarkerType(marker);
    }
    if (!isBombCategoryMarker(marker)) return null;
    return marker && marker.data && marker.data.type ? marker.data.type : 'TIME_BOMB';
}

function normalizeMarkerInput(kind: string, data: any): { kind: string; data: any } {
    if (MarkersAdapter && typeof MarkersAdapter.normalizeMarkerInput === 'function') {
        return MarkersAdapter.normalizeMarkerInput(kind, data);
    }
    const normalizedData = (data && typeof data === 'object') ? { ...data } : {};
    const isBombInput =
        kind === MARKER_CATEGORIES.BOMB ||
        normalizedData.category === MARKER_CATEGORIES.BOMB ||
        normalizedData.type === 'TIME_BOMB';
    if (isBombInput) {
        normalizedData.category = MARKER_CATEGORIES.BOMB;
        if (!normalizedData.type) normalizedData.type = 'TIME_BOMB';
        return { kind: MARKER_KINDS.SPECIAL_STONE, data: normalizedData };
    }
    return { kind, data: normalizedData };
}

function getSpecialMarkers(cardState: CardState): any[] {
    if (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function') {
        return MarkersAdapter.getSpecialMarkers(cardState);
    }
    return getMarkers(cardState).filter(isSpecialStoneMarker);
}

function getManifestMarkers(cardState: CardState): any[] {
    if (MarkersAdapter && typeof MarkersAdapter.getManifestMarkers === 'function') {
        return MarkersAdapter.getManifestMarkers(cardState);
    }
    return getMarkers(cardState).filter(isManifestStoneMarker);
}

function getActiveManifestMarkers(cardState: CardState): any[] {
    if (MarkersAdapter && typeof MarkersAdapter.getActiveManifestMarkers === 'function') {
        return MarkersAdapter.getActiveManifestMarkers(cardState);
    }
    return getManifestMarkers(cardState).filter(isActiveManifestMarker);
}

function getBombMarkers(cardState: CardState): any[] {
    if (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function') {
        return MarkersAdapter.getBombMarkers(cardState);
    }
    return getMarkers(cardState).filter(isBombCategoryMarker);
}

function getBlockadeMarkers(cardState: CardState): any[] {
    return getSpecialMarkers(cardState).filter((marker: any) => marker && marker.data && marker.data.type === 'BLOCKADE');
}

function getBlockingMarkers(cardState: CardState): any[] {
    return getSpecialMarkers(cardState).filter((marker: any) => (
        marker &&
        marker.data &&
        (marker.data.type === 'BLOCKADE' || marker.data.type === 'METEOR_HOLE' || marker.data.type === 'FREEZE')
    ));
}

function isFrozenCellForCard(cardState: CardState, row: number, col: number): boolean {
    return getSpecialMarkers(cardState).some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'FREEZE'
    ));
}

function isMeteorHoleCell(cardState: CardState, row: number, col: number): boolean {
    return getSpecialMarkers(cardState).some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'METEOR_HOLE'
    ));
}

function isGuardProtectedCell(cardState: CardState, row: number, col: number): boolean {
    return getSpecialMarkers(cardState).some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'GUARD'
    ));
}

function findSpecialMarkerAt(cardState: CardState, row: number, col: number, type?: string, owner?: PlayerKey): any {
    if (MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function') {
        return MarkersAdapter.findSpecialMarkerAt(cardState, row, col, type, owner);
    }
    return getMarkers(cardState).find((marker: any) => (
        marker &&
        isSpecialStoneMarker(marker) &&
        marker.row === row &&
        marker.col === col &&
        (type ? (marker.data && marker.data.type === type) : true) &&
        (owner ? marker.owner === owner : true)
    ));
}

function findBombMarkerAt(cardState: CardState, row: number, col: number): any {
    if (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function') {
        return MarkersAdapter.findBombMarkerAt(cardState, row, col);
    }
    return getMarkers(cardState).find((marker: any) => (
        marker && isBombCategoryMarker(marker) && marker.row === row && marker.col === col
    ));
}

function markerOccupiesCell(marker: any, row: any, col: any): boolean {
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.markerOccupiesCell === 'function') {
        return SpecialStoneRegistry.markerOccupiesCell(marker, row, col) === true;
    }
    return !!(marker && marker.row === row && marker.col === col);
}

function getMarkerFootprint(marker: any): any[] {
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneFootprint === 'function') {
        return SpecialStoneRegistry.getSpecialStoneFootprint(marker);
    }
    return marker && Number.isInteger(marker.row) && Number.isInteger(marker.col)
        ? [{ row: marker.row, col: marker.col, role: 'anchor' }]
        : [];
}

function markerCellKey(row: any, col: any): string {
    return `${typeof row}:${String(row)},${typeof col}:${String(col)}`;
}

type MarkerContextIndexOptions = {
    onMarkerVisited?: (marker: any, index: number) => void;
    includeCellIndex?: boolean;
};

function createMarkerContextIndex(cardState: CardState, options?: MarkerContextIndexOptions) {
    const byCell = new Map<string, any[]>();
    const markers = getMarkers(cardState);
    const specialMarkers: any[] = [];
    const manifestMarkers: any[] = [];
    const bombMarkers: any[] = [];
    const blockingMarkers: any[] = [];
    const frozenCellKeys = new Set<string>();
    const opts = options && typeof options === 'object' ? options : {};
    const includeCellIndex = opts.includeCellIndex !== false;
    let scanCount = 0;

    for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
        const marker = markers[markerIndex];
        scanCount += 1;
        if (typeof opts.onMarkerVisited === 'function') opts.onMarkerVisited(marker, markerIndex);
        if (!marker) continue;

        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        const type = data && data.type ? String(data.type).trim().toUpperCase() : '';
        const bomb = marker.kind === MARKER_CATEGORIES.BOMB || !!(data && data.category === MARKER_CATEGORIES.BOMB);
        const manifest = !bomb && (
            marker.kind === MARKER_KINDS.MANIFEST_STONE ||
            (marker.kind === MARKER_KINDS.SPECIAL_STONE && isManifestStoneType(type))
        );
        const special = !bomb && !manifest && marker.kind === MARKER_KINDS.SPECIAL_STONE;
        if (special) specialMarkers.push(marker);
        if (manifest) manifestMarkers.push(marker);
        if (bomb) bombMarkers.push(marker);

        if (special && (type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE')) {
            blockingMarkers.push(marker);
        }
        if (special && type === 'FREEZE') {
            frozenCellKeys.add(markerCellKey(marker.row, marker.col));
        }

        if (includeCellIndex && Number.isFinite(marker.row) && Number.isFinite(marker.col)) {
            for (const cell of getMarkerFootprint(marker)) {
                const key = markerCellKey(cell.row, cell.col);
                const list = byCell.get(key);
                if (list) list.push(marker);
                else byCell.set(key, [marker]);
            }
        }
    }

    const cellIndex = {
        get(row: any, col: any): any[] {
            return byCell.get(markerCellKey(row, col)) || [];
        },
        some(row: any, col: any, predicate: (marker: any) => boolean): boolean {
            return cellIndex.get(row, col).some(predicate);
        },
        find(row: any, col: any, predicate: (marker: any) => boolean): any {
            return cellIndex.get(row, col).find(predicate);
        },
        findSpecial(row: any, col: any, type?: string, owner?: PlayerKey): any {
            return cellIndex.find(row, col, (marker: any) => (
                marker &&
                isSpecialStoneMarker(marker) &&
                (type ? (marker.data && marker.data.type === type) : true) &&
                (owner ? marker.owner === owner : true)
            ));
        },
        isSpecialStoneAt(row: any, col: any): boolean {
            return !!cellIndex.find(row, col, (marker: any) => {
                if (!marker) return false;
                if (isSpecialStoneMarker(marker) && !isNormalVisualSpecialMarker(marker)) return true;
                return isBombCategoryMarker(marker);
            });
        }
    };

    return {
        markers,
        specialMarkers,
        manifestMarkers,
        bombMarkers,
        blockingMarkers,
        frozenCellKeys,
        scanCount,
        byCell,
        cellIndex,
        isFrozenCell(row: any, col: any): boolean {
            return frozenCellKeys.has(markerCellKey(row, col));
        }
    };
}

function createMarkerCellIndex(cardState: CardState) {
    return createMarkerContextIndex(cardState).cellIndex;
}

interface RemoveMarkersOptions {
    kind?: string;
    category?: string;
    type?: string;
    owner?: PlayerKey;
    preserveTypes?: string[];
}

function removeMarkersAt(cardState: CardState, row: number, col: number, options?: RemoveMarkersOptions): void {
    if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col, options);
        return;
    }
    if (!cardState || !Array.isArray((cardState as any).markers)) return;
    const opts = options || {};
    const preserveTypes = new Set((opts.preserveTypes || []).map((type) => String(type).toUpperCase()));
    (cardState as any).markers = (cardState as any).markers.filter((marker: any) => {
        if (!marker || !markerOccupiesCell(marker, row, col)) return true;
        if (preserveTypes.has(String(marker.data && marker.data.type || '').toUpperCase())) return true;
        if (opts.kind === MARKER_CATEGORIES.BOMB && !isBombCategoryMarker(marker)) return true;
        if (opts.kind === MARKER_KINDS.SPECIAL_STONE && !isSpecialStoneMarker(marker)) return true;
        if (opts.kind === MARKER_KINDS.MANIFEST_STONE && !isManifestStoneMarker(marker)) return true;
        if (
            opts.kind &&
            opts.kind !== MARKER_CATEGORIES.BOMB &&
            opts.kind !== MARKER_KINDS.SPECIAL_STONE &&
            opts.kind !== MARKER_KINDS.MANIFEST_STONE &&
            marker.kind !== opts.kind
        ) return true;
        if (opts.category && getMarkerCategory(marker) !== opts.category) return true;
        if (opts.type && (!marker.data || marker.data.type !== opts.type)) return true;
        if (opts.owner && marker.owner !== opts.owner) return true;
        return false;
    });
}

function getSpecialMarkerAt(cardState: CardState, row: number, col: number): { kind: string; category: string | null; marker: any } | null {
    const special = getSpecialMarkers(cardState).find((marker: any) => (
        marker &&
        markerOccupiesCell(marker, row, col) &&
        !isNormalVisualSpecialMarker(marker)
    ));
    if (special) return { kind: 'specialStone', category: getMarkerCategory(special), marker: special };
    const bomb = findBombMarkerAt(cardState, row, col);
    if (bomb) return { kind: 'specialStone', category: MARKER_CATEGORIES.BOMB, marker: bomb };
    return null;
}

function findManifestMarkerAt(cardState: CardState, row: number, col: number, type?: string, owner?: PlayerKey): any {
    return getManifestMarkers(cardState).find((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        (type ? getNormalizedMarkerType(marker) === String(type).toUpperCase() : true) &&
        (owner ? marker.owner === owner : true)
    )) || null;
}

function getTrueSpecialStoneMarkerAt(cardState: CardState, row: number, col: number): { kind: string; category: string | null; marker: any } | null {
    const special = getSpecialMarkers(cardState).find((marker: any) => (
        marker &&
        markerOccupiesCell(marker, row, col) &&
        isTrueSpecialStoneMarker(marker)
    ));
    if (!special) return null;
    return { kind: 'specialStone', category: getMarkerCategory(special), marker: special };
}

function isSpecialStoneAt(cardState: CardState, row: number, col: number): boolean {
    return !!getSpecialMarkerAt(cardState, row, col);
}

function isManifestStoneAt(cardState: CardState, row: number, col: number): boolean {
    return !!findManifestMarkerAt(cardState, row, col);
}

function isTrueSpecialStoneAt(cardState: CardState, row: number, col: number): boolean {
    return !!getTrueSpecialStoneMarkerAt(cardState, row, col);
}

function getSpecialOwnerAt(cardState: CardState, row: number, col: number): PlayerKey | null {
    const entry = getSpecialMarkerAt(cardState, row, col);
    return entry && entry.marker ? entry.marker.owner : null;
}

function getTrueSpecialStoneOwnerAt(cardState: CardState, row: number, col: number): PlayerKey | null {
    const entry = getTrueSpecialStoneMarkerAt(cardState, row, col);
    return entry && entry.marker ? entry.marker.owner : null;
}

function isNormalVisualSpecialMarker(marker: any): boolean {
    const type = getNormalizedMarkerType(marker);
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isNormalVisualStoneEffect === 'function') {
        return SpecialStoneRegistry.isNormalVisualStoneEffect(type, marker && marker.data) === true;
    }
    return (
        type === 'BLOCKADE' ||
        type === 'METEOR_HOLE' ||
        type === 'FREEZE' ||
        type === 'SEED' ||
        type === 'POISON_CELL' ||
        type === 'POISONED' ||
        type === 'SCORCHED_CELL' ||
        type === 'SCORCHED' ||
        type === 'LIVING_WILL' ||
        type === 'TRAP'
    );
}

function clearStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number): void {
    if (!cardState) return;
    const boardKernel = getMarkerBoardKernel();
    const view = getMarkerBoardView(cardState, gameState);
    const key = boardKernel.toBoardCellKey(row, col);
    if (view.topology.baseKeys.has(key)) {
        if ((cardState as any).stoneIdMap && (cardState as any).stoneIdMap[row]) {
            (cardState as any).stoneIdMap[row][col] = null;
        }
        return;
    }
    if (!view.topology.expansionKeys.has(key)) return;
    if ((cardState as any).expansionStoneIdByCell && typeof (cardState as any).expansionStoneIdByCell === 'object') {
        delete (cardState as any).expansionStoneIdByCell[key];
    }
}

function getStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number): string | null {
    if (!cardState) return null;
    const boardKernel = getMarkerBoardKernel();
    const view = getMarkerBoardView(cardState, gameState);
    if (!view.isPlayable(row, col)) return null;
    const key = boardKernel.toBoardCellKey(row, col);
    if (view.topology.baseKeys.has(key)) {
        return ((cardState as any).stoneIdMap && (cardState as any).stoneIdMap[row])
            ? ((cardState as any).stoneIdMap[row][col] || null)
            : null;
    }
    if (!view.topology.expansionKeys.has(key)) return null;
    if (!(cardState as any).expansionStoneIdByCell || typeof (cardState as any).expansionStoneIdByCell !== 'object') return null;
    return (cardState as any).expansionStoneIdByCell[key] || null;
}

function setStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number, stoneId: string | null): boolean {
    if (!cardState) return false;
    const boardKernel = getMarkerBoardKernel();
    const view = getMarkerBoardView(cardState, gameState);
    if (!view.isPlayable(row, col)) return false;
    const key = boardKernel.toBoardCellKey(row, col);
    if (view.topology.baseKeys.has(key)) {
        if (!Array.isArray((cardState as any).stoneIdMap)) {
            (cardState as any).stoneIdMap = Array.from(
                { length: view.topology.baseRows },
                () => Array(view.topology.baseCols).fill(null)
            );
        }
        if (!Array.isArray((cardState as any).stoneIdMap[row])) {
            (cardState as any).stoneIdMap[row] = Array(view.topology.baseCols).fill(null);
        }
        (cardState as any).stoneIdMap[row][col] = stoneId || null;
        return true;
    }
    if (!view.topology.expansionKeys.has(key)) return false;
    if (!(cardState as any).expansionStoneIdByCell || typeof (cardState as any).expansionStoneIdByCell !== 'object') {
        (cardState as any).expansionStoneIdByCell = {};
    }
    if (stoneId == null) {
        delete (cardState as any).expansionStoneIdByCell[key];
    } else {
        (cardState as any).expansionStoneIdByCell[key] = stoneId;
    }
    return true;
}

interface Position {
    row: number;
    col: number;
}

function swapCellCoordinates(cardState: CardState, gameState: GameState, posA: Position, posB: Position): void {
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
        if (getMarkerRuleClass(marker) === 'board_marker') continue;
        if (marker.row === aRow && marker.col === aCol) {
            marker.row = bRow;
            marker.col = bCol;
        } else if (marker.row === bRow && marker.col === bCol) {
            marker.row = aRow;
            marker.col = aCol;
        }
    }

    const swapPoint = (point: any) => {
        if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col)) return point;
        if (point.row === aRow && point.col === aCol) return { row: bRow, col: bCol };
        if (point.row === bRow && point.col === bCol) return { row: aRow, col: aCol };
        return point;
    };

    if ((cardState as any).workAnchorPosByPlayer) {
        (cardState as any).workAnchorPosByPlayer.black = swapPoint((cardState as any).workAnchorPosByPlayer.black);
        (cardState as any).workAnchorPosByPlayer.white = swapPoint((cardState as any).workAnchorPosByPlayer.white);
    }
    if ((cardState as any).breedingSproutByOwner) {
        for (const owner of ['black', 'white']) {
            const points = Array.isArray((cardState as any).breedingSproutByOwner[owner]) ? (cardState as any).breedingSproutByOwner[owner] : [];
            (cardState as any).breedingSproutByOwner[owner] = points.map(swapPoint);
        }
    }
    if ((cardState as any).breedingFrontierByAnchorId && typeof (cardState as any).breedingFrontierByAnchorId === 'object') {
        for (const key of Object.keys((cardState as any).breedingFrontierByAnchorId)) {
            const points = Array.isArray((cardState as any).breedingFrontierByAnchorId[key]) ? (cardState as any).breedingFrontierByAnchorId[key] : [];
            (cardState as any).breedingFrontierByAnchorId[key] = points.map(swapPoint);
        }
    }
}

interface AddMarkerOptions {
    emitStatusApplied?: boolean;
}

function addMarker(
    cardState: CardState,
    kind: string,
    row: number,
    col: number,
    owner: PlayerKey | null,
    data: any,
    options: AddMarkerOptions = {}
): any {
    ensureMarkers(cardState);
    const id = (cardState as any)._nextMarkerId || 1;
    (cardState as any)._nextMarkerId = id + 1;

    if (typeof (cardState as any)._nextCreatedSeq === 'undefined') (cardState as any)._nextCreatedSeq = 1;
    const createdSeq = (cardState as any)._nextCreatedSeq++;

    const normalized = normalizeMarkerInput(kind, data);
    const markerId = String(id);
    const marker = {
        id,
        markerId,
        row,
        col,
        kind: normalized.kind,
        owner,
        createdSeq,
        data: normalized.data
    };

    (cardState as any).markers.push(marker);

    if (options.emitStatusApplied !== false) try {
        const presentationHelper = getPresentationHelper();
        let special: any = null;
        let timer: any = null;
        let flipEvadeRemaining: any = null;
        let destroyEvadeRemaining: any = null;
        const isManifestMarker = isManifestStoneMarker(marker);
        const isVisualStoneMarker = isSpecialStoneMarker(marker) || isManifestMarker;

        if (isBombCategoryMarker(marker)) {
            special = getBombMarkerType(marker);
            timer = (marker.data && typeof marker.data.remainingTurns === 'number') ? marker.data.remainingTurns : null;
        } else if (isVisualStoneMarker) {
            special = marker.data && marker.data.type ? marker.data.type : null;
            timer = (marker.data && typeof marker.data.remainingOwnerTurns === 'number')
                ? marker.data.remainingOwnerTurns
                : ((marker.data && typeof marker.data.remainingTurns === 'number') ? marker.data.remainingTurns : null);
            flipEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.flipEvadeRemaining))
                ? Math.max(0, Math.trunc(Number(marker.data.flipEvadeRemaining)))
                : null;
            destroyEvadeRemaining = Number.isFinite(Number(marker.data && marker.data.destroyEvadeRemaining))
                ? Math.max(0, Math.trunc(Number(marker.data.destroyEvadeRemaining)))
                : null;
        }

        const isHiddenTrap =
            isSpecialStoneMarker(marker) &&
            special === 'TRAP' &&
            !!(marker.data && marker.data.hidden);

        const markerMeta: any = { special, timer, owner };
        if (flipEvadeRemaining !== null) markerMeta.flipEvadeRemaining = flipEvadeRemaining;
        if (destroyEvadeRemaining !== null) markerMeta.destroyEvadeRemaining = destroyEvadeRemaining;
        if (marker.data && marker.data.visualEffectKey) markerMeta.visualEffectKey = marker.data.visualEffectKey;
        if (isManifestMarker) markerMeta.manifestAura = { owner };

        let visualOwnedBySpawn = false;
        if (special && cardState && !isHiddenTrap) {
            const currentActionId = ((cardState as any)._currentActionMeta && (cardState as any)._currentActionMeta.actionId) || null;
            const persist = Array.isArray((cardState as any)._presentationEventsPersist) ? (cardState as any)._presentationEventsPersist : [];
            const live = Array.isArray((cardState as any).presentationEvents) ? (cardState as any).presentationEvents : [];
            const patchSpawnMeta = (events: any[]) => {
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
            visualOwnedBySpawn = patchSpawnMeta(persist) || patchSpawnMeta(live);
        }

        if (special && presentationHelper && !isHiddenTrap) {
            if (visualOwnedBySpawn) markerMeta.visualOwnedBySpawn = true;
            presentationHelper.emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: markerMeta });
        }
    } catch (e) { /* ignore presentation failures */ }

    return marker;
}

function removeMarkerById(cardState: CardState, markerId: number): boolean {
    if (!cardState || !Array.isArray((cardState as any).markers)) return false;
    const index = (cardState as any).markers.findIndex((marker: any) => marker && marker.id === markerId);
    if (index === -1) return false;
    (cardState as any).markers.splice(index, 1);
    return true;
}

interface ExtendLifeDeps {
    getExtendLifeTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
}

function applyExtendLifeSelection(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: ExtendLifeDeps, options: any): { applied: boolean; reason?: string; row?: number; col?: number; previousRemainingOwnerTurns?: number; newRemainingOwnerTurns?: number; multiplier?: number; cardType?: string } {
    const settings = options && typeof options === 'object' ? options : {};
    const pendingType = settings.pendingType || 'EXTEND_LIFE_WILL';
    const multiplier = Number.isFinite(settings.multiplier) ? Number(settings.multiplier) : 2;
    const pending = cardState && (cardState as any).pendingEffectByPlayer ? (cardState as any).pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getTargets = deps && typeof deps.getExtendLifeTargets === 'function'
        ? deps.getExtendLifeTargets
        : (() => []);
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const specialsAtCell = getSpecialMarkers(cardState).filter((marker: any) => (
        marker &&
        isTrueSpecialStoneMarker(marker) &&
        isDurationAffectableMarker(marker) &&
        markerOccupiesCell(marker, row, col) &&
        marker.owner === playerKey &&
        marker.data &&
        Number.isFinite(marker.data.remainingOwnerTurns) &&
        Number(marker.data.remainingOwnerTurns) > 0
    ));
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

    (cardState as any).pendingEffectByPlayer[playerKey] = null;
    return { applied: true, row, col, previousRemainingOwnerTurns, newRemainingOwnerTurns, multiplier, cardType: pendingType };
}

function applyExtendLifeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: ExtendLifeDeps): { applied: boolean; reason?: string; row?: number; col?: number; previousRemainingOwnerTurns?: number; newRemainingOwnerTurns?: number; multiplier?: number; cardType?: string } {
    return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, deps, {
        pendingType: 'EXTEND_LIFE_WILL',
        multiplier: 2
    });
}

function applyExtendLifeGod(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: ExtendLifeDeps): { applied: boolean; reason?: string; row?: number; col?: number; previousRemainingOwnerTurns?: number; newRemainingOwnerTurns?: number; multiplier?: number; cardType?: string } {
    return applyExtendLifeSelection(cardState, gameState, playerKey, row, col, deps, {
        pendingType: 'EXTEND_LIFE_GOD',
        multiplier: 4
    });
}

function addSpecialStoneDurationOnHealingCells(
    cardState: CardState,
    playerKey: PlayerKey,
    bonusRaw: number
): { affectedCount: number; details: any[] } {
    const bonus = Number.isFinite(Number(bonusRaw)) ? Math.max(0, Math.trunc(Number(bonusRaw))) : 0;
    if (bonus <= 0) return { affectedCount: 0, details: [] };

    const healingCells = new Set(
        getMarkers(cardState)
            .filter((marker: any) => getNormalizedMarkerType(marker) === 'HEALING_CELL')
            .map((marker: any) => `${marker.row},${marker.col}`)
    );
    if (!healingCells.size) return { affectedCount: 0, details: [] };

    const targets = getSpecialMarkers(cardState).filter((marker: any) => (
        marker &&
        isTrueSpecialStoneMarker(marker) &&
        isDurationAffectableMarker(marker) &&
        isActiveSpecialMarker(marker) &&
        marker.owner === playerKey &&
        marker.data &&
        Number.isFinite(Number(marker.data.remainingOwnerTurns)) &&
        Number(marker.data.remainingOwnerTurns) > 0 &&
        healingCells.has(`${marker.row},${marker.col}`)
    )).slice().sort((left: any, right: any) => (
        (Number(left && left.createdSeq) || 0) - (Number(right && right.createdSeq) || 0) ||
        (Number(left && left.row) || 0) - (Number(right && right.row) || 0) ||
        (Number(left && left.col) || 0) - (Number(right && right.col) || 0)
    ));

    const details: any[] = [];
    for (const marker of targets) {
        const before = Math.max(1, Math.trunc(Number(marker.data.remainingOwnerTurns)));
        const after = before + bonus;
        marker.data.remainingOwnerTurns = after;
        details.push({
            row: marker.row,
            col: marker.col,
            owner: marker.owner,
            special: marker.data.type || null,
            previousRemainingOwnerTurns: before,
            newRemainingOwnerTurns: after,
            addedTurns: bonus
        });
        emitDurationChangeStatusTick(cardState, marker, {
            reason: 'healing_cell_duration_added',
            highlightTone: 'positive'
        });
    }
    return { affectedCount: details.length, details };
}

interface CorrosionDeps {
    getCorrosionTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
}

function applyCorrosionWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: CorrosionDeps): { applied: boolean; reason?: string; affectedCount: number; details: any[] } {
    const pending = cardState && (cardState as any).pendingEffectByPlayer ? (cardState as any).pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'CORROSION_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending', affectedCount: 0, details: [] };
    }

    const getTargets = deps && typeof deps.getCorrosionTargets === 'function'
        ? deps.getCorrosionTargets
        : (() => []);
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed) {
        return { applied: false, reason: 'invalid_target', affectedCount: 0, details: [] };
    }

    const details: any[] = [];
    for (const marker of getSpecialMarkers(cardState)) {
        if (!marker || marker.row !== row || marker.col !== col) continue;
        if (!isDurationAffectableMarker(marker)) continue;
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

    const primaryMarker = getPrimaryDurationMarker(
        getSpecialMarkers(cardState).filter((marker: any) => (
            marker &&
            isDurationAffectableMarker(marker) &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            Number.isFinite(marker.data.remainingOwnerTurns) &&
            Number(marker.data.remainingOwnerTurns) > 0
        ))
    );
    if (primaryMarker) {
        emitDurationChangeStatusTick(cardState, primaryMarker, {
            reason: 'corrosion_applied',
            highlightTone: 'negative'
        });
    }

    (cardState as any).pendingEffectByPlayer[playerKey] = null;
    return { applied: true, affectedCount: details.length, details };
}

export = {
    MARKER_KINDS,
    MARKER_CATEGORIES,
    ensureMarkers,
    getMarkers,
    getMarkerCategory,
    getBombMarkerType,
    isBombCategoryMarker,
    isManifestStoneMarker,
    isSpecialStoneMarker,
    getMarkerRuleClass,
    isTrueSpecialStoneMarker,
    isTemptTargetableMarker,
    isCaptureTargetableMarker,
    blocksTemptAt,
    canLossWillRevertMarker,
    isDurationAffectableMarker,
    isActiveSpecialMarker,
    isActiveManifestMarker,
    isInviolableMarker,
    isInviolableCell,
    isCardPlayLockedForPlayer,
    isPlacementLockedForPlayer,
    getSpecialMarkers,
    getManifestMarkers,
    getActiveManifestMarkers,
    getBombMarkers,
    getBlockadeMarkers,
    getBlockingMarkers,
    isFrozenCellForCard,
    isMeteorHoleCell,
    isGuardProtectedCell,
    markerOccupiesCell,
    getMarkerFootprint,
    findSpecialMarkerAt,
    findManifestMarkerAt,
    findBombMarkerAt,
    createMarkerContextIndex,
    createMarkerCellIndex,
    removeMarkersAt,
    getSpecialMarkerAt,
    getTrueSpecialStoneMarkerAt,
    isSpecialStoneAt,
    isManifestStoneAt,
    isTrueSpecialStoneAt,
    getSpecialOwnerAt,
    getTrueSpecialStoneOwnerAt,
    clearStoneIdAtForCard,
    getStoneIdAtForCard,
    setStoneIdAtForCard,
    swapCellCoordinates,
    addMarker,
    removeMarkerById,
    applyExtendLifeWill,
    applyExtendLifeGod,
    addSpecialStoneDurationOnHealingCells,
    applyCorrosionWill
};
