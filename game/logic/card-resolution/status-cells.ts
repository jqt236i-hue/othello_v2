import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardStatusCellsEffects = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

type StatusCellSubjectKind = 'stone_body' | 'stone_status' | 'cell_marker' | 'topology' | 'placement_effect';
type StatusCellOwnershipPolicy = 'stone_owner' | 'source_player' | 'none';
type StatusCellDurationClock = 'owner_turn' | 'completed_turn' | 'permanent' | 'none';

interface StatusCellSemanticTraits {
    subjectKind: StatusCellSubjectKind;
    ownershipPolicy: StatusCellOwnershipPolicy;
    durationClock: StatusCellDurationClock;
}

interface StatusCellMarkerConfig {
    markerType: string;
    reason: string;
    remainingOwnerTurns?: number;
    remainingTurns?: number;
    appliedTurnNumber?: number;
    sourceCardType?: string;
    presentationMeta?: Record<string, unknown> | null;
    [key: string]: unknown;
}

function applyStatusCellWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, config: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const getTargets = config && config.getTargets;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== config.pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = targets.some((t: any) => t.row === row && t.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const result = applyStatusCellMarker(cardState, playerKey, row, col, config, deps);
    if (!result.applied) return result;

    clearCardPendingEffect(cardState, playerKey);
    syncHazardContacts(cardState, gameState, Number(gameState && (gameState as any).turnNumber || 0), deps);
    return result;
}

function getTemporarySpecialCellTypes(deps: any): string[] {
    const source = deps && deps.TEMPORARY_SPECIAL_CELL_TYPES;
    if (source instanceof Set) return Array.from(source).map((type) => String(type).toUpperCase());
    if (Array.isArray(source)) return source.map((type) => String(type).toUpperCase());
    throw new Error('Status-cell resolution requires SpecialStoneRegistry.TEMPORARY_SPECIAL_CELL_TYPES');
}

function isTemporarySpecialCellType(rawType: unknown, deps: any): boolean {
    if (!deps || typeof deps.isTemporarySpecialCellType !== 'function') {
        throw new Error('Status-cell resolution requires SpecialStoneRegistry.isTemporarySpecialCellType');
    }
    return deps.isTemporarySpecialCellType(rawType) === true;
}

function getStatusCellSemanticTraits(rawType: unknown, markerData: unknown, deps: any): StatusCellSemanticTraits {
    if (!deps || typeof deps.getMarkerSemanticTraits !== 'function') {
        throw new Error('Status-cell resolution requires SpecialStoneRegistry.getMarkerSemanticTraits');
    }
    const traits = deps.getMarkerSemanticTraits(rawType, markerData);
    if (!traits || traits.subjectKind !== 'cell_marker') {
        throw new Error(`Status-cell marker type is not a canonical cell marker: ${String(rawType || '')}`);
    }
    return traits as StatusCellSemanticTraits;
}

function createCellMarkerPresentationMeta(
    markerTypeRaw: unknown,
    markerData: Record<string, any>,
    markerOwner: PlayerKey | null,
    sourcePlayer: PlayerKey | null,
    reason: string,
    presentationMeta: Record<string, unknown> | null,
    deps: any
): Record<string, unknown> {
    const markerTypeKey = String(markerTypeRaw || '').trim().toUpperCase();
    const traits = getStatusCellSemanticTraits(markerTypeKey, markerData, deps);
    const timer = traits.durationClock === 'completed_turn'
        ? markerData.remainingTurns
        : traits.durationClock === 'owner_turn'
            ? markerData.remainingOwnerTurns
            : null;
    const semanticOwner = traits.ownershipPolicy === 'none' ? null : markerOwner;
    const semanticSourcePlayer = sourcePlayer || (
        traits.ownershipPolicy === 'none' && (markerOwner === 'black' || markerOwner === 'white')
            ? markerOwner
            : null
    );
    return Object.assign({}, presentationMeta || {}, {
        special: markerTypeKey,
        owner: semanticOwner,
        sourcePlayer: semanticSourcePlayer,
        timer: Number.isFinite(Number(timer)) ? Math.max(0, Math.trunc(Number(timer))) : null,
        reason,
        subjectKind: traits.subjectKind,
        stoneMutation: 'preserve'
    });
}

function removeTemporarySpecialCellsAt(cardState: CardState, row: number, col: number, deps: any): string[] {
    const getMarkers = deps && deps.getMarkers;
    const removeMarkerById = deps && deps.removeMarkerById;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const removed: string[] = [];
    if (typeof getMarkers === 'function' && typeof removeMarkerById === 'function') {
        const candidates = getMarkers(cardState).filter((marker: any) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            isTemporarySpecialCellType(markerType(marker), deps)
        ));
        for (const marker of candidates) {
            const type = markerType(marker);
            if (!removeMarkerById(cardState, marker.id)) continue;
            removed.push(type);
            if (typeof emitPresentationEvent === 'function') {
                const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
                const owner = marker.owner === 'black' || marker.owner === 'white' ? marker.owner : null;
                const sourcePlayer = data.sourcePlayer === 'black' || data.sourcePlayer === 'white'
                    ? data.sourcePlayer
                    : owner;
                emitPresentationEvent(cardState, {
                    type: 'STATUS_REMOVED',
                    row,
                    col,
                    meta: createCellMarkerPresentationMeta(
                        type,
                        data,
                        owner,
                        sourcePlayer,
                        'special_cell_overwritten',
                        null,
                        deps
                    )
                });
            }
        }
        return removed;
    }
    if (typeof removeMarkersAt === 'function') {
        for (const type of getTemporarySpecialCellTypes(deps)) {
            const count = Number(removeMarkersAt(cardState, row, col, {
                kind: deps && deps.MARKER_KINDS ? deps.MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                type
            }) || 0);
            if (count > 0) removed.push(type);
        }
    }
    return removed;
}

function applyStatusCellMarker(
    cardState: CardState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    config: StatusCellMarkerConfig,
    deps: any
): Record<string, any> {
    const addMarker = deps && deps.addMarker;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;

    if (typeof addMarker !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return { applied: false, reason: 'invalid_target' };
    }

    const removedTypes = removeTemporarySpecialCellsAt(cardState, row, col, deps);
    const markerData: Record<string, any> = { type: config.markerType };
    if (Number.isFinite(Number(config.remainingOwnerTurns))) {
        markerData.remainingOwnerTurns = Number(config.remainingOwnerTurns);
    }
    if (Number.isFinite(Number(config.remainingTurns))) {
        markerData.remainingTurns = Number(config.remainingTurns);
    }
    if (Number.isFinite(Number(config.appliedTurnNumber))) {
        markerData.appliedTurnNumber = Number(config.appliedTurnNumber);
    }
    const sourceCardType = String(config.sourceCardType || '').trim().toUpperCase();
    if (sourceCardType === 'SEED_WILL' || sourceCardType === 'GRASS_WILL') {
        markerData.sourceCardType = sourceCardType;
    }
    const semanticTraits = getStatusCellSemanticTraits(config.markerType, markerData, deps);
    const markerOwner = semanticTraits.ownershipPolicy === 'none' ? null : playerKey;
    const sourcePlayer = playerKey;
    if (semanticTraits.ownershipPolicy === 'none') {
        markerData.sourcePlayer = sourcePlayer;
    }
    const marker = addMarker(
        cardState,
        'specialStone',
        row,
        col,
        markerOwner,
        markerData,
        { emitStatusApplied: false }
    );
    if (typeof emitPresentationEvent === 'function') {
        const presentationMeta = config.presentationMeta && typeof config.presentationMeta === 'object'
            ? config.presentationMeta
            : null;
        emitPresentationEvent(cardState, {
            type: 'STATUS_APPLIED',
            row,
            col,
            meta: createCellMarkerPresentationMeta(
                config.markerType,
                markerData,
                markerOwner,
                sourcePlayer,
                config.reason,
                presentationMeta,
                deps
            )
        });
    }
    return { applied: true, row, col, markerId: marker && marker.id, removedTypes };
}

function applyBlockadeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'BLOCKADE_WILL',
        markerType: 'BLOCKADE',
        reason: 'blockade_selected',
        remainingOwnerTurns: deps && deps.BLOCKADE_TURNS,
        getTargets: deps && deps.getBlockadeTargets
    }, deps);
}

function applyFreezeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'FREEZE_WILL',
        markerType: 'FREEZE',
        reason: 'freeze_selected',
        remainingOwnerTurns: deps && deps.FREEZE_TURNS,
        getTargets: deps && deps.getFreezeTargets
    }, deps);
}

function applyMassFreezeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const collectTargets = deps && deps.collectMassFreezeWillTargets;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const addMarker = deps && deps.addMarker;
    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof collectTargets !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof addMarker !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing', frozenCount: 0, targets: [] };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'MASS_FREEZE_WILL') {
        return { applied: false, reason: 'not_pending', frozenCount: 0, targets: [] };
    }

    const targets = collectTargets(cardState, gameState, playerKey, { includeHiddenOpponentTraps: true });
    if (!Array.isArray(targets) || targets.length === 0) {
        return { applied: false, reason: 'no_targets', frozenCount: 0, targets: [] };
    }
    const seen = new Set<string>();
    const normalizedTargets: Array<{ row: number; col: number }> = [];
    const expandedTargets: any[] = [];
    for (const target of targets) {
        const footprint = deps && typeof deps.getMultiCellFootprintAt === 'function'
            ? deps.getMultiCellFootprintAt(cardState, target.row, target.col)
            : null;
        if (Array.isArray(footprint) && footprint.length > 1) expandedTargets.push(...footprint);
        else expandedTargets.push(target);
    }
    for (const target of expandedTargets) {
        const row = target && target.row;
        const col = target && target.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
            return { applied: false, reason: 'invalid_target', frozenCount: 0, targets: [] };
        }
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalizedTargets.push({ row, col });
    }
    if (normalizedTargets.length === 0) {
        return { applied: false, reason: 'no_targets', frozenCount: 0, targets: [] };
    }

    for (const target of normalizedTargets) {
        const result = applyStatusCellMarker(cardState, playerKey, target.row, target.col, {
            markerType: 'FREEZE',
            reason: 'mass_freeze_will',
            remainingOwnerTurns: deps && deps.FREEZE_TURNS
        }, deps);
        if (!result.applied) {
            throw new Error(`MASS_FREEZE_WILL marker apply failed at ${target.row},${target.col}: ${result.reason || 'unknown'}`);
        }
    }

    clearCardPendingEffect(cardState, playerKey);
    syncHazardContacts(cardState, gameState, Number(gameState && (gameState as any).turnNumber || 0), deps);
    return {
        applied: true,
        frozenCount: targets.length,
        frozenCellCount: normalizedTargets.length,
        targets: normalizedTargets
    };
}

function applySeedWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    return applyStatusCellWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'SEED_WILL',
        markerType: 'SEED',
        reason: 'seed_selected',
        remainingOwnerTurns: deps && deps.SEED_WILL_TURNS,
        sourceCardType: 'SEED_WILL',
        getTargets: deps && deps.getSeedTargets
    }, deps);
}

function applySeedMarker(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    sourceCardType: string,
    deps: any,
    sourceRow?: number,
    sourceCol?: number
): Record<string, any> {
    const getTargets = deps && deps.getSeedTargets;
    if (typeof getTargets !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }
    const targets = getTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target: any) => (
        target && target.row === row && target.col === col
    ));
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const normalizedSourceCardType = String(sourceCardType || '').trim().toUpperCase();
    const hasGrassSource = normalizedSourceCardType === 'GRASS_WILL'
        && Number.isInteger(sourceRow)
        && Number.isInteger(sourceCol);
    const result = applyStatusCellMarker(cardState, playerKey, row, col, {
        markerType: 'SEED',
        reason: 'grass_seeded',
        remainingOwnerTurns: deps && deps.SEED_WILL_TURNS,
        sourceCardType,
        presentationMeta: hasGrassSource ? {
            cause: 'GRASS_WILL',
            sourceRow,
            sourceCol,
            sourceTrajectoryProfile: 'grassWillSeedBeam'
        } : null
    }, deps);
    if (result.applied) {
        syncHazardContacts(cardState, gameState, Number(gameState && (gameState as any).turnNumber || 0), deps);
    }
    return result;
}

function markerType(marker: any): string {
    return String(marker && marker.data && marker.data.type || '').trim().toUpperCase();
}

function syncPoisonContacts(cardState: CardState, gameState: GameState, appliedTurnNumber: number, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    const addMarker = deps && deps.addMarker;
    const removeMarkerById = deps && deps.removeMarkerById;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const isInviolableCell = deps && deps.isInviolableCell;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const empty = deps && deps.EMPTY;
    if (typeof getMarkers !== 'function' || typeof addMarker !== 'function' || typeof getCellValueForCard !== 'function') {
        return { applied: 0, removed: 0 };
    }
    const markers = getMarkers(cardState).slice();
    const poisonCells = markers.filter((marker: any) => markerType(marker) === 'POISON_CELL');
    const poisoned = markers.filter((marker: any) => markerType(marker) === 'POISONED');
    let applied = 0;
    let removed = 0;

    for (const status of poisoned) {
        const occupied = getCellValueForCard(gameState, status.row, status.col) !== empty;
        const guarded = markers.some((marker: any) => marker.row === status.row && marker.col === status.col && markerType(marker) === 'GUARD');
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, status.row, status.col);
        if (occupied && !guarded && !inviolable) continue;
        if (typeof removeMarkerById === 'function' && removeMarkerById(cardState, status.id)) {
            removed += 1;
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED', row: status.row, col: status.col,
                meta: { special: 'POISONED', reason: guarded ? 'full_guard' : (inviolable ? 'inviolable' : 'stone_absent') }
            });
        }
    }

    for (const cell of poisonCells) {
        const value = getCellValueForCard(gameState, cell.row, cell.col);
        if (value === empty) continue;
        const currentMarkers = getMarkers(cardState);
        const guarded = currentMarkers.some((marker: any) => marker.row === cell.row && marker.col === cell.col && markerType(marker) === 'GUARD');
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, cell.row, cell.col);
        const exists = currentMarkers.some((marker: any) => marker.row === cell.row && marker.col === cell.col && markerType(marker) === 'POISONED');
        if (guarded || inviolable || exists) continue;
        const owner = value === deps.BLACK ? 'black' : 'white';
        addMarker(cardState, 'specialStone', cell.row, cell.col, owner, {
            type: 'POISONED',
            remainingTurns: deps.POISON_STONE_TURNS,
            appliedTurnNumber
        });
        applied += 1;
    }
    return { applied, removed };
}

function syncScorchContacts(cardState: CardState, gameState: GameState, appliedTurnNumber: number, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    const addMarker = deps && deps.addMarker;
    const removeMarkerById = deps && deps.removeMarkerById;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const isInviolableCell = deps && deps.isInviolableCell;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const empty = deps && deps.EMPTY;
    if (
        typeof getMarkers !== 'function' ||
        typeof addMarker !== 'function' ||
        typeof removeMarkerById !== 'function' ||
        typeof getCellValueForCard !== 'function'
    ) {
        return { applied: 0, removed: 0 };
    }

    const markers = getMarkers(cardState).slice();
    const scorchCells = markers.filter((marker: any) => markerType(marker) === 'SCORCHED_CELL');
    const scorched = markers.filter((marker: any) => markerType(marker) === 'SCORCHED');
    let applied = 0;
    let removed = 0;

    for (const status of scorched) {
        const occupied = getCellValueForCard(gameState, status.row, status.col) !== empty;
        const stillOnContactCell = Number(status.data && status.data.contactRow) === Number(status.row) &&
            Number(status.data && status.data.contactCol) === Number(status.col);
        const onScorchCell = scorchCells.some((cell: any) => cell.row === status.row && cell.col === status.col);
        const persistsWithoutScorchedCell = status.data && status.data.persistsWithoutScorchedCell === true;
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, status.row, status.col);
        if (occupied && stillOnContactCell && (onScorchCell || persistsWithoutScorchedCell) && !inviolable) continue;
        if (!removeMarkerById(cardState, status.id)) continue;
        removed += 1;
        if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row: status.row,
            col: status.col,
            meta: {
                special: 'SCORCHED',
                reason: inviolable
                    ? 'inviolable'
                    : (!occupied ? 'stone_absent' : (!stillOnContactCell ? 'stone_left_cell' : 'scorched_cell_absent'))
            }
        });
    }

    for (const cell of scorchCells) {
        const value = getCellValueForCard(gameState, cell.row, cell.col);
        if (value === empty) continue;
        const currentMarkers = getMarkers(cardState);
        const inviolable = typeof isInviolableCell === 'function' && isInviolableCell(cardState, cell.row, cell.col);
        const exists = currentMarkers.some((marker: any) => (
            marker.row === cell.row &&
            marker.col === cell.col &&
            markerType(marker) === 'SCORCHED'
        ));
        if (inviolable || exists) continue;
        const owner = value === deps.BLACK ? 'black' : 'white';
        addMarker(cardState, 'specialStone', cell.row, cell.col, owner, {
            type: 'SCORCHED',
            remainingTurns: deps.SCORCHED_STONE_TURNS,
            appliedTurnNumber,
            contactRow: cell.row,
            contactCol: cell.col
        });
        applied += 1;
    }
    return { applied, removed };
}

function preserveScorchedStatusAfterHealingOverwrite(
    cardState: CardState,
    row: number,
    col: number,
    removedTypes: unknown,
    deps: any
): void {
    if (
        !Array.isArray(removedTypes) ||
        !removedTypes.some((type) => String(type || '').trim().toUpperCase() === 'SCORCHED_CELL')
    ) {
        return;
    }
    const getMarkers = deps && deps.getMarkers;
    if (typeof getMarkers !== 'function') return;
    for (const status of getMarkers(cardState)) {
        if (
            !status ||
            markerType(status) !== 'SCORCHED' ||
            status.row !== row ||
            status.col !== col ||
            !status.data ||
            Number(status.data.contactRow) !== row ||
            Number(status.data.contactCol) !== col
        ) {
            continue;
        }
        status.data.persistsWithoutScorchedCell = true;
    }
}

function syncHazardContacts(cardState: CardState, gameState: GameState, appliedTurnNumber: number, deps: any): Record<string, any> {
    const poison = syncPoisonContacts(cardState, gameState, appliedTurnNumber, deps);
    const scorch = syncScorchContacts(cardState, gameState, appliedTurnNumber, deps);
    return { poison, scorch };
}

function applyPoisonWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'POISON_WILL' || pending.stage !== 'selectTarget') return { applied: false, reason: 'not_pending' };
    const targets = deps.getPoisonTargets(cardState, gameState, playerKey);
    if (!targets.some((target: any) => target.row === row && target.col === col)) return { applied: false, reason: 'invalid_target' };
    const appliedTurnNumber = Number(gameState && (gameState as any).turnNumber || 0);
    const result = applyStatusCellMarker(cardState, playerKey, row, col, {
        markerType: 'POISON_CELL',
        remainingTurns: deps.POISON_CELL_TURNS,
        appliedTurnNumber,
        reason: 'poison_cell_applied'
    }, deps);
    if (!result.applied) return result;
    deps.clearCardPendingEffect(cardState, playerKey);
    syncHazardContacts(cardState, gameState, appliedTurnNumber, deps);
    return result;
}

function applyScorchedCell(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps: any,
    sourceRow?: number,
    sourceCol?: number
): Record<string, any> {
    const appliedTurnNumber = Number(gameState && (gameState as any).turnNumber || 0);
    const hasSource = Number.isInteger(sourceRow) && Number.isInteger(sourceCol);
    const result = applyStatusCellMarker(cardState, playerKey, row, col, {
        markerType: 'SCORCHED_CELL',
        remainingTurns: deps.SCORCHED_CELL_TURNS,
        appliedTurnNumber,
        reason: 'scorched_cell_applied',
        presentationMeta: hasSource ? {
            cause: 'FIRE_WILL',
            sourceRow,
            sourceCol,
            sourceTrajectoryProfile: 'fireWillFlameBeam'
        } : null
    }, deps);
    if (!result.applied) return result;
    syncHazardContacts(cardState, gameState, appliedTurnNumber, deps);
    return result;
}

function applyHealingCell(
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps: any,
    sourceRow?: number,
    sourceCol?: number
): Record<string, any> {
    const appliedTurnNumber = Number(gameState && (gameState as any).turnNumber || 0);
    const hasSource = Number.isInteger(sourceRow) && Number.isInteger(sourceCol);
    const result = applyStatusCellMarker(cardState, playerKey, row, col, {
        markerType: 'HEALING_CELL',
        remainingTurns: deps.HEALING_CELL_TURNS,
        appliedTurnNumber,
        reason: 'healing_cell_applied',
        presentationMeta: hasSource ? {
            cause: 'WATER_WILL',
            sourceRow,
            sourceCol,
            sourceTrajectoryProfile: 'waterWillHealingBeam'
        } : { cause: 'WATER_WILL' }
    }, deps);
    if (!result.applied) return result;
    preserveScorchedStatusAfterHealingOverwrite(cardState, row, col, result.removedTypes, deps);
    syncHazardContacts(cardState, gameState, appliedTurnNumber, deps);
    return result;
}

function compareMarkerOrder(left: any, right: any): number {
    return (
        (Number(left && left.createdSeq) || 0) - (Number(right && right.createdSeq) || 0) ||
        (Number(left && left.row) || 0) - (Number(right && right.row) || 0) ||
        (Number(left && left.col) || 0) - (Number(right && right.col) || 0) ||
        String(left && (left.markerId || left.id) || '').localeCompare(String(right && (right.markerId || right.id) || ''), 'en')
    );
}

function processStatusCellTurnEnd(cardState: CardState, gameState: GameState, completedTurnNumber: number, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    const removeMarkerById = deps && deps.removeMarkerById;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    if (typeof getMarkers !== 'function' || typeof removeMarkerById !== 'function') return { processed: false };
    syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
    let lethalCount = 0;
    let expiredCellCount = 0;
    let poisonLethalCount = 0;
    let scorchLethalCount = 0;
    let expiredPoisonCellCount = 0;
    let expiredScorchedCellCount = 0;
    let expiredHealingCellCount = 0;
    const statuses = getMarkers(cardState).filter((marker: any) => (
        markerType(marker) === 'POISONED' || markerType(marker) === 'SCORCHED'
    )).slice().sort(compareMarkerOrder);
    for (const queuedMarker of statuses) {
        syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
        const marker = getMarkers(cardState).find((current: any) => current && current.id === queuedMarker.id);
        if (!marker) continue;
        if (Number(marker.data.appliedTurnNumber) === Number(completedTurnNumber)) continue;
        marker.data.remainingTurns = Math.max(0, Number(marker.data.remainingTurns || 0) - 1);
        const type = markerType(marker);
        const isPoison = type === 'POISONED';
        if (marker.data.remainingTurns > 0) {
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_TICK', row: marker.row, col: marker.col,
                meta: {
                    special: type,
                    timer: marker.data.remainingTurns,
                    reason: isPoison ? 'poison_tick' : 'scorched_tick'
                }
            });
            continue;
        }
        lethalCount += 1;
        if (isPoison) poisonLethalCount += 1;
        else scorchLethalCount += 1;
        const resolveLethalStatus = () => {
            if (typeof deps.destroyAt === 'function') deps.destroyAt(
                cardState,
                gameState,
                marker.row,
                marker.col,
                isPoison ? 'POISON_WILL' : 'FIRE_WILL',
                isPoison ? 'poison_lethal' : 'scorched_lethal',
                isPoison ? { poison: true } : { scorch: true }
            );
            removeMarkerById(cardState, marker.id);
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED', row: marker.row, col: marker.col,
                meta: {
                    special: type,
                    timer: 0,
                    reason: isPoison ? 'poison_resolved' : 'scorched_resolved'
                }
            });
        };
        if (typeof deps.runEffectBlock === 'function') {
            deps.runEffectBlock(cardState, gameState, {
                kind: 'status_cell_lethal',
                cause: isPoison ? 'POISON_WILL' : 'FIRE_WILL',
                reason: isPoison ? 'poison_lethal' : 'scorched_lethal',
                sourceRow: marker.row,
                sourceCol: marker.col
            }, resolveLethalStatus);
        } else {
            resolveLethalStatus();
        }
        syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
    }
    syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
    const cells = getMarkers(cardState).filter((marker: any) => (
        markerType(marker) === 'POISON_CELL' ||
        markerType(marker) === 'SCORCHED_CELL' ||
        markerType(marker) === 'HEALING_CELL'
    )).slice().sort(compareMarkerOrder);
    for (const queuedMarker of cells) {
        const marker = getMarkers(cardState).find((current: any) => current && current.id === queuedMarker.id);
        if (!marker) continue;
        if (Number(marker.data.appliedTurnNumber) === Number(completedTurnNumber)) continue;
        marker.data.remainingTurns = Math.max(0, Number(marker.data.remainingTurns || 0) - 1);
        const type = markerType(marker);
        const isPoisonCell = type === 'POISON_CELL';
        const isHealingCell = type === 'HEALING_CELL';
        if (marker.data.remainingTurns > 0) {
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_TICK', row: marker.row, col: marker.col,
                meta: {
                    special: type,
                    timer: marker.data.remainingTurns,
                    reason: isPoisonCell
                        ? 'poison_cell_tick'
                        : (isHealingCell ? 'healing_cell_tick' : 'scorched_cell_tick')
                }
            });
            continue;
        }
        const resolveCellExpiry = () => {
            if (removeMarkerById(cardState, marker.id)) {
                expiredCellCount += 1;
                if (isPoisonCell) expiredPoisonCellCount += 1;
                else if (isHealingCell) expiredHealingCellCount += 1;
                else expiredScorchedCellCount += 1;
            }
            syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
            if (typeof emitPresentationEvent === 'function') emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED', row: marker.row, col: marker.col,
                meta: { special: type, timer: 0, reason: 'duration_end' }
            });
        };
        if (typeof deps.runEffectBlock === 'function') {
            deps.runEffectBlock(cardState, gameState, {
                kind: 'status_cell_expiry',
                cause: isPoisonCell ? 'POISON_WILL' : (isHealingCell ? 'WATER_WILL' : 'FIRE_WILL'),
                reason: 'duration_end',
                sourceRow: marker.row,
                sourceCol: marker.col
            }, resolveCellExpiry);
        } else {
            resolveCellExpiry();
        }
    }
    syncHazardContacts(cardState, gameState, completedTurnNumber, deps);
    return {
        processed: true,
        lethalCount,
        expiredCellCount,
        poisonLethalCount,
        scorchLethalCount,
        expiredPoisonCellCount,
        expiredScorchedCellCount,
        expiredHealingCellCount
    };
}

function processPoisonTurnEnd(cardState: CardState, gameState: GameState, completedTurnNumber: number, deps: any): Record<string, any> {
    return processStatusCellTurnEnd(cardState, gameState, completedTurnNumber, deps);
}

    return {
        removeTemporarySpecialCellsAt,
        applyStatusCellMarker,
        applyBlockadeWill,
        applyFreezeWill,
        applyMassFreezeWill,
        applySeedWill,
        applySeedMarker,
        applyPoisonWill,
        applyScorchedCell,
        applyHealingCell,
        syncPoisonContacts,
        syncScorchContacts,
        syncHazardContacts,
        processStatusCellTurnEnd,
        processPoisonTurnEnd
    };
}));
