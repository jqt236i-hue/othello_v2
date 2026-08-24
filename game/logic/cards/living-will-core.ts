/**
 * @file living_will.ts
 * @description Living Will effects (Shared between Browser and Headless)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');
import CardMarkersImport = require('./markers');
import CardWorkImport = require('./work_will');
import RandomSourceImport = require('../cards-internal/random-source');
import EvasionStatusImport = require('../../../shared/evasion-status');
import ManifestStoneRegistryImport = require('../../../shared/manifest-stone-registry');
import SpecialStoneRegistryImport = require('../../../shared/special-stone-registry-static');
import BoardUtilsImport = require('../../../shared/shared-board-utils');

const SharedConstants: any = SharedConstantsImport;
const CardMarkersModule: any = CardMarkersImport;
const CardWorkModule: any = CardWorkImport;
const RandomSourceModule: any = RandomSourceImport;
const EvasionStatusModule: any = EvasionStatusImport;
const ManifestStoneRegistry: any = ManifestStoneRegistryImport;
const SpecialStoneRegistry: any = SpecialStoneRegistryImport;
const BoardUtils: any = BoardUtilsImport;

const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
    ? Number(SharedConstants.BLACK)
    : 1;
const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
    ? Number(SharedConstants.WHITE)
    : -1;
const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;

function isManifestStoneType(rawType: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}
const MARKER_KIND_SPECIAL = 'specialStone';
const MARKER_KIND_MANIFEST = 'manifestStone';

const BLOCKING_TYPES = new Set(['BLOCKADE', 'METEOR_HOLE', 'FREEZE']);
const OVERLAY_ONLY_TYPES = new Set(['LIVING_WILL']);
const HYPERACTIVE_TYPES = new Set([
    'HYPERACTIVE',
    'EXTREME_HYPERACTIVE',
    'ESCAPE_HYPERACTIVE',
    'ROBOT_VACUUM',
    'GLUTTONOUS'
]);

if (!BoardUtils ||
    typeof BoardUtils.createBoardContext !== 'function' ||
    typeof BoardUtils.collectBoardCellValues !== 'function' ||
    typeof BoardUtils.getCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext access is required by CardLivingWill');
}

function getCardMarkersModule(): any {
    return CardMarkersModule;
}

function getCardWorkModule(): any {
    return CardWorkModule;
}

function getSpecialStoneRegistryModule(): any {
    return SpecialStoneRegistry;
}

function isOverlayOnlySpecialStoneType(type: string): boolean {
    const registry = getSpecialStoneRegistryModule();
    if (registry && typeof registry.isOverlayOnlySpecialStoneType === 'function') {
        return registry.isOverlayOnlySpecialStoneType(type);
    }
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'GUARD' || typeUpper === 'LIVING_WILL';
}

function getFlipEvadeDefault(type: string, fallback: number): number {
    if (EvasionStatusModule && typeof EvasionStatusModule.getFlipEvadeDefault === 'function') {
        const value = EvasionStatusModule.getFlipEvadeDefault(type);
        if (Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return fallback;
}

function getDestroyEvadeDefault(type: string, fallback: number): number {
    if (EvasionStatusModule && typeof EvasionStatusModule.getDestroyEvadeDefault === 'function') {
        const value = EvasionStatusModule.getDestroyEvadeDefault(type);
        if (Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return fallback;
}

function cloneStructuredValue(value: any): any {
    if (Array.isArray(value)) return value.map(cloneStructuredValue);
    if (!value || typeof value !== 'object') return value;
    const out: any = {};
    for (const key of Object.keys(value)) {
        out[key] = cloneStructuredValue(value[key]);
    }
    return out;
}

function normalizeBoardIndex(value: any): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.trunc(numeric);
}

function ensureMarkers(cardState: CardState): void {
    if (!cardState || typeof cardState !== 'object') return;
    const cs = cardState as any;
    if (!Array.isArray(cs.markers)) cs.markers = [];
    if (typeof cs._nextMarkerId !== 'number') cs._nextMarkerId = 1;
    if (typeof cs._nextCreatedSeq !== 'number') cs._nextCreatedSeq = 1;
}

function getMarkers(cardState: CardState): any[] {
    const cs = cardState as any;
    return (cs && Array.isArray(cs.markers)) ? cs.markers : [];
}

function isBombMarker(marker: any, cardMarkers: any): boolean {
    if (!marker) return false;
    if (cardMarkers && typeof cardMarkers.isBombCategoryMarker === 'function') {
        return !!cardMarkers.isBombCategoryMarker(marker);
    }
    return !!(marker.data && marker.data.category === 'bomb');
}

function isSpecialMarker(marker: any, cardMarkers: any): boolean {
    if (!marker) return false;
    if (cardMarkers && typeof cardMarkers.isSpecialStoneMarker === 'function') {
        return !!cardMarkers.isSpecialStoneMarker(marker);
    }
    return marker.kind === MARKER_KIND_SPECIAL && !isBombMarker(marker, cardMarkers);
}

function isManifestMarker(marker: any, cardMarkers: any): boolean {
    if (!marker) return false;
    if (cardMarkers && typeof cardMarkers.isManifestStoneMarker === 'function') {
        return !!cardMarkers.isManifestStoneMarker(marker);
    }
    const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    return (marker.kind === MARKER_KIND_MANIFEST || marker.kind === MARKER_KIND_SPECIAL) &&
        isManifestStoneType(type);
}

function getSpecialMarkersAt(cardState: CardState, row: number, col: number): any[] {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.getSpecialMarkers === 'function') {
        const specialMarkers = cardMarkers.getSpecialMarkers(cardState);
        const manifestMarkers = typeof cardMarkers.getManifestMarkers === 'function'
            ? cardMarkers.getManifestMarkers(cardState)
            : [];
        return specialMarkers.concat(manifestMarkers).filter((marker: any) => (
            marker &&
            normalizeBoardIndex(marker.row) === row &&
            normalizeBoardIndex(marker.col) === col
        ));
    }
    return getMarkers(cardState).filter((marker: any) => (
        (isSpecialMarker(marker, cardMarkers) || isManifestMarker(marker, cardMarkers)) &&
        normalizeBoardIndex(marker.row) === row &&
        normalizeBoardIndex(marker.col) === col
    ));
}

function getBlockingMarkers(cardState: CardState): any[] {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.getBlockingMarkers === 'function') {
        return cardMarkers.getBlockingMarkers(cardState);
    }
    return getMarkers(cardState).filter((marker: any) => {
        const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        return BLOCKING_TYPES.has(type);
    });
}

function addMarker(cardState: CardState, row: number, col: number, owner: PlayerKey, data: any, kind?: string): any {
    const cardMarkers = getCardMarkersModule();
    ensureMarkers(cardState);
    const markerKind = kind || MARKER_KIND_SPECIAL;
    if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
        return cardMarkers.addMarker(cardState, markerKind, row, col, owner, data);
    }
    const cs = cardState as any;
    const id = cs._nextMarkerId++;
    const createdSeq = cs._nextCreatedSeq++;
    const marker = {
        id,
        row,
        col,
        kind: markerKind,
        owner,
        createdSeq,
        data: cloneStructuredValue(data)
    };
    cs.markers.push(marker);
    return marker;
}

function removeMarkerById(cardState: CardState, markerId: number): boolean {
    const cs = cardState as any;
    if (!cs || !Array.isArray(cs.markers)) return false;
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.removeMarkerById === 'function') {
        return !!cardMarkers.removeMarkerById(cardState, markerId);
    }
    const before = cs.markers.length;
    cs.markers = cs.markers.filter((marker: any) => !(marker && marker.id === markerId));
    return cs.markers.length !== before;
}

interface RemoveMarkersOptions {
    kind?: string;
    type?: string;
    owner?: PlayerKey;
    predicate?: (marker: any) => boolean;
}

function removeMarkersAt(cardState: CardState, row: number, col: number, options?: RemoveMarkersOptions): number {
    const cs = cardState as any;
    if (!cs || !Array.isArray(cs.markers)) return 0;
    const opts = (options && typeof options === 'object') ? options : {};
    const before = cs.markers.length;
    cs.markers = cs.markers.filter((marker: any) => {
        if (!marker) return true;
        if (normalizeBoardIndex(marker.row) !== row || normalizeBoardIndex(marker.col) !== col) return true;
        if (opts.kind && marker.kind !== opts.kind) return true;
        if (opts.type && String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() !== String(opts.type).toUpperCase()) return true;
        if (opts.owner && marker.owner !== opts.owner) return true;
        if (opts.predicate && !opts.predicate(marker)) return true;
        return false;
    });
    return before - cs.markers.length;
}

interface LivingWillDeps {
    BoardOps?: any;
    random?: any;
    defaultPrng?: any;
    defaults?: any;
    readCardPendingEffect?: (state: CardState, owner: PlayerKey) => any;
    clearCardPendingEffect?: (state: CardState, owner: PlayerKey) => void;
    getLivingWillTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
    emitPresentationEvent?: (cardState: CardState, event: any) => void;
    getCardContext?: (cardState: CardState) => any;
    getFlipsWithContext?: (gameState: GameState, row: number, col: number, ownerValue: number, context?: any) => any[];
    getOccupiedOriginFlipsWithContext?: (gameState: GameState, row: number, col: number, ownerValue: number, context?: any) => any[];
    clearBombAt?: (cardState: CardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: CardState, positions: any[]) => void;
    addChargeWithTotal?: (cardState: CardState, playerKey: PlayerKey, amount: number, meta?: any) => number;
}

function getBoardOps(deps: LivingWillDeps): any {
    return (deps && deps.BoardOps) || null;
}

function createBoardContext(gameState: GameState, cardState: CardState): any {
    return BoardUtils.createBoardContext(gameState, cardState);
}

function getCellValue(gameState: GameState, row: number, col: number, cardState: CardState, _deps: LivingWillDeps): any {
    return BoardUtils.getCellValue(createBoardContext(gameState, cardState), row, col);
}

function emitPresentationEvent(cardState: CardState, event: any, deps: LivingWillDeps): void {
    const boardOps = getBoardOps(deps);
    if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
        boardOps.emitPresentationEvent(cardState, event);
    }
}

function normalizeOwnerKeyFromValue(value: any): PlayerKey | null {
    if (value === BLACK) return 'black';
    if (value === WHITE) return 'white';
    return null;
}

function ownerKeyToValue(ownerKey: PlayerKey): number {
    return ownerKey === 'black' ? BLACK : WHITE;
}

function getDefaultPrng(deps: LivingWillDeps): any {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(
            deps && deps.random,
            deps && deps.defaultPrng,
            'CardLivingWill'
        );
    }
    if (deps && deps.random && typeof deps.random.random === 'function') return deps.random;
    if (deps && deps.defaultPrng && typeof deps.defaultPrng.random === 'function') return deps.defaultPrng;
    throw new Error('CardLivingWill requires an injected deterministic PRNG.');
}

function getNumericDefault(value: any, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.trunc(numeric));
}

interface DurationDefaults {
    regenReviveLimit: number;
    breedingTurns: number;
    proliferationTurns: number;
    ultimateDragonTurns: number;
    ultimateDestroyGodTurns: number;
    stoneSalvationGodTurns: number;
    sniperTurns: number;
    observerTurns: number;
    ghostTurns: number;
    afterimageFlipEvadeLimit: number;
    afterimageDestroyEvadeLimit: number;
    timeStopTurns: number;
    willHunterKingTurns: number;
    destroyDragonTurns: number;
    lightningTurns: number;
    fireTurns: number;
    grassTurns: number;
    meteorGodTurns: number;
    extremeHyperactiveFlipEvadeLimit: number;
    extremeHyperactiveDestroyEvadeLimit: number;
    robotVacuumTurns: number;
    ultimateHyperactiveTurns: number;
    ultimateHyperactiveFlipEvadeLimit: number;
    ultimateHyperactiveDestroyEvadeLimit: number;
    guardTurns: number;
    guardianGodTurns: number;
    workTurns: number;
}

function getDurationDefaults(deps: LivingWillDeps): DurationDefaults {
    const source = (deps && deps.defaults && typeof deps.defaults === 'object') ? deps.defaults : {};
    return {
        regenReviveLimit: getNumericDefault(source.regenReviveLimit, 3),
        breedingTurns: getNumericDefault(source.breedingTurns, 5),
        proliferationTurns: getNumericDefault(source.proliferationTurns, 10),
        ultimateDragonTurns: getNumericDefault(source.ultimateDragonTurns, 8),
        ultimateDestroyGodTurns: getNumericDefault(source.ultimateDestroyGodTurns, 6),
        stoneSalvationGodTurns: getNumericDefault(source.stoneSalvationGodTurns, 12),
        sniperTurns: getNumericDefault(source.sniperTurns, 6),
        observerTurns: getNumericDefault(source.observerTurns, 5),
        ghostTurns: getNumericDefault(source.ghostTurns, 8),
        afterimageFlipEvadeLimit: getNumericDefault(source.afterimageFlipEvadeLimit, getFlipEvadeDefault('AFTERIMAGE_WILL', 6)),
        afterimageDestroyEvadeLimit: getNumericDefault(source.afterimageDestroyEvadeLimit, getDestroyEvadeDefault('AFTERIMAGE_WILL', 6)),
        timeStopTurns: getNumericDefault(source.timeStopTurns, 3),
        willHunterKingTurns: getNumericDefault(source.willHunterKingTurns, 8),
        destroyDragonTurns: getNumericDefault(source.destroyDragonTurns, 3),
        lightningTurns: getNumericDefault(source.lightningTurns, 6),
        fireTurns: getNumericDefault(source.fireTurns, 6),
        grassTurns: getNumericDefault(source.grassTurns, 10),
        meteorGodTurns: getNumericDefault(source.meteorGodTurns, 6),
        extremeHyperactiveFlipEvadeLimit: getNumericDefault(source.extremeHyperactiveFlipEvadeLimit, getFlipEvadeDefault('EXTREME_HYPERACTIVE', 5)),
        extremeHyperactiveDestroyEvadeLimit: getNumericDefault(source.extremeHyperactiveDestroyEvadeLimit, getDestroyEvadeDefault('EXTREME_HYPERACTIVE', 5)),
        robotVacuumTurns: getNumericDefault(source.robotVacuumTurns, 5),
        ultimateHyperactiveTurns: getNumericDefault(source.ultimateHyperactiveTurns, 12),
        ultimateHyperactiveFlipEvadeLimit: getNumericDefault(source.ultimateHyperactiveFlipEvadeLimit, getFlipEvadeDefault('ULTIMATE_HYPERACTIVE', 5)),
        ultimateHyperactiveDestroyEvadeLimit: getNumericDefault(source.ultimateHyperactiveDestroyEvadeLimit, getDestroyEvadeDefault('ULTIMATE_HYPERACTIVE', 2)),
        guardTurns: getNumericDefault(source.guardTurns, 3),
        guardianGodTurns: getNumericDefault(source.guardianGodTurns, 10),
        workTurns: getNumericDefault(source.workTurns, 5)
    };
}

function normalizeRestoreMarkerData(marker: any, ownerKey: PlayerKey, deps: LivingWillDeps): any {
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
    case 'STONE_SALVATION_GOD':
        markerData.remainingOwnerTurns = defaults.stoneSalvationGodTurns;
        break;
    case 'SNIPER':
        markerData.remainingOwnerTurns = defaults.sniperTurns;
        break;
    case 'OBSERVER_WILL':
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
        markerData.flipEvadeRemaining = getFlipEvadeDefault('WILL_HUNTER_KING', 2);
        markerData.destroyEvadeRemaining = getDestroyEvadeDefault('WILL_HUNTER_KING', 2);
        break;
    case 'DESTROY_DRAGON':
        markerData.remainingOwnerTurns = defaults.destroyDragonTurns;
        break;
    case 'LIGHTNING':
        markerData.remainingOwnerTurns = defaults.lightningTurns;
        break;
    case 'FIRE':
        markerData.remainingOwnerTurns = defaults.fireTurns;
        break;
    case 'GRASS':
        markerData.remainingOwnerTurns = defaults.grassTurns;
        break;
    case 'METEOR_GOD':
        markerData.remainingOwnerTurns = defaults.meteorGodTurns;
        break;
    case 'HYPERACTIVE':
        markerData.flipEvadeRemaining = getFlipEvadeDefault('HYPERACTIVE', 1);
        break;
    case 'EXTREME_HYPERACTIVE':
        markerData.flipEvadeRemaining = defaults.extremeHyperactiveFlipEvadeLimit;
        markerData.destroyEvadeRemaining = defaults.extremeHyperactiveDestroyEvadeLimit;
        break;
    case 'ESCAPE_HYPERACTIVE':
        markerData.flipEvadeRemaining = getFlipEvadeDefault('ESCAPE_HYPERACTIVE', 1);
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
    case 'ULTIMATE_WORK_GOD':
        markerData.ownerColor = ownerKey;
        markerData.selfDestructChancePercent = 0;
        break;
    default:
        break;
    }

    if (HYPERACTIVE_TYPES.has(type)) {
        delete markerData.hyperactiveSeq;
    }

    return markerData;
}

interface LivingWillBaseline {
    version: number;
    owner: PlayerKey;
    markers: { kind?: string; owner: PlayerKey; data: any }[];
}

function buildLivingWillBaseline(cardState: CardState, gameState: GameState, row: number, col: number, deps: LivingWillDeps): LivingWillBaseline | null {
    const ownerKey = normalizeOwnerKeyFromValue(getCellValue(gameState, row, col, cardState, deps));
    if (!ownerKey) return null;
    const restoreMarkers = getSpecialMarkersAt(cardState, row, col)
        .filter((marker: any) => {
            const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            return !OVERLAY_ONLY_TYPES.has(type) && !BLOCKING_TYPES.has(type);
        })
        .map((marker: any) => ({
            kind: marker.kind || MARKER_KIND_SPECIAL,
            owner: marker.owner || ownerKey,
            data: normalizeRestoreMarkerData(marker, marker.owner || ownerKey, deps)
        }));
    return {
        version: 1,
        owner: ownerKey,
        markers: restoreMarkers
    };
}

function cloneLivingWillSnapshot(marker: any): any {
    return cloneStructuredValue(marker);
}

function findLivingWillMarkerAt(cardState: CardState, row: number, col: number): any {
    return getSpecialMarkersAt(cardState, row, col).find((marker: any) => (
        String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'LIVING_WILL'
    )) || null;
}

function shouldTriggerForSpecialLoss(livingWillMarker: any, specialType: string): boolean {
    const typeUpper = String(specialType || '').toUpperCase();
    if (!typeUpper) return false;
    const baseline = livingWillMarker && livingWillMarker.data ? livingWillMarker.data.baseline : null;
    const restoreMarkers = Array.isArray(baseline && baseline.markers) ? baseline.markers : [];
    return restoreMarkers.some((entry: any) => (
        String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase() === typeUpper
    ));
}

interface RestoreTrigger {
    sourceRow?: number;
    sourceCol?: number;
    cause?: string;
    reason?: string;
    relocated?: boolean;
}

function buildRestoreVisualMeta(baseline: LivingWillBaseline | null, trigger: RestoreTrigger): any {
    const restoreMarkers = Array.isArray(baseline && baseline.markers) ? (baseline as LivingWillBaseline).markers : [];
    const primary = restoreMarkers.find((entry: any) => {
        const typeUpper = String(entry && entry.data && entry.data.type ? entry.data.type : '').toUpperCase();
        return !isOverlayOnlySpecialStoneType(typeUpper);
    }) || restoreMarkers[0] || null;
    const data = primary && primary.data ? primary.data : null;
    const meta: any = {
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

function allocateHyperactiveSeq(cardState: CardState): number {
    if (!cardState || typeof cardState !== 'object') return 1;
    const cs = cardState as any;
    const current = Number.isFinite(Number(cs.hyperactiveSeqCounter))
        ? Math.max(0, Math.trunc(Number(cs.hyperactiveSeqCounter)))
        : 0;
    const next = current + 1;
    cs.hyperactiveSeqCounter = next;
    return next;
}

function ensureBreedingRuntime(cardState: CardState): void {
    if (!cardState || typeof cardState !== 'object') return;
    const cs = cardState as any;
    if (!cs.breedingFrontierByAnchorId || typeof cs.breedingFrontierByAnchorId !== 'object') {
        cs.breedingFrontierByAnchorId = {};
    }
    if (!cs.breedingSproutByOwner || typeof cs.breedingSproutByOwner !== 'object') {
        cs.breedingSproutByOwner = { black: [], white: [] };
    }
    if (!Array.isArray(cs.breedingSproutByOwner.black)) cs.breedingSproutByOwner.black = [];
    if (!Array.isArray(cs.breedingSproutByOwner.white)) cs.breedingSproutByOwner.white = [];
}

function removeNonBlockingMarkersAt(cardState: CardState, row: number, col: number): number {
    return removeMarkersAt(cardState, row, col, {
        predicate(marker: any) {
            const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            return !BLOCKING_TYPES.has(type);
        }
    });
}

interface CellPosition {
    row: number;
    col: number;
}

function collectEmptyReviveCells(cardState: CardState, gameState: GameState, sourceRow: number, sourceCol: number, deps: LivingWillDeps): CellPosition[] {
    const candidates: CellPosition[] = [];
    const blockingSet = new Set(
        getBlockingMarkers(cardState).map((marker: any) => `${normalizeBoardIndex(marker.row)},${normalizeBoardIndex(marker.col)}`)
    );
    for (const cell of BoardUtils.collectBoardCellValues(createBoardContext(gameState, cardState))) {
        if (cell.row === sourceRow && cell.col === sourceCol) continue;
        if (cell.owner !== EMPTY) continue;
        if (blockingSet.has(`${cell.row},${cell.col}`)) continue;
        candidates.push({ row: cell.row, col: cell.col });
    }
    return candidates;
}

interface TriggerInfo {
    forceRelocation?: boolean;
    cause?: string;
    reason?: string;
}

function shouldRelocateForTrigger(trigger: TriggerInfo): boolean {
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

function pickRelocationTarget(cardState: CardState, gameState: GameState, sourceRow: number, sourceCol: number, deps: LivingWillDeps): CellPosition | null {
    const candidates = collectEmptyReviveCells(cardState, gameState, sourceRow, sourceCol, deps);
    if (!candidates.length) return null;
    const prng = getDefaultPrng(deps);
    const raw = Number(prng.random());
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
    const index = Math.floor(normalized * candidates.length);
    return candidates[index] || candidates[0] || null;
}

function restoreBaselineMarkers(cardState: CardState, gameState: GameState, row: number, col: number, baseline: LivingWillBaseline, deps: LivingWillDeps): any[] {
    const restoreMarkers = Array.isArray(baseline && baseline.markers) ? baseline.markers : [];
    const workModule = getCardWorkModule();
    const restored: any[] = [];
    for (const entry of restoreMarkers) {
        const owner = entry && entry.owner ? entry.owner : (baseline && baseline.owner ? baseline.owner : null);
        const data = cloneStructuredValue(entry && entry.data ? entry.data : {});
        const type = String(data && data.type ? data.type : '').toUpperCase();
        if (HYPERACTIVE_TYPES.has(type)) {
            data.hyperactiveSeq = allocateHyperactiveSeq(cardState);
        }
        if (type === 'WORK' && workModule && typeof workModule.placeWorkStone === 'function') {
            workModule.placeWorkStone(cardState, gameState, owner, row, col, {
                addMarker(cs: CardState, kind: string, markerRow: number, markerCol: number, markerOwner: PlayerKey, markerData: any) {
                    return addMarker(cs, markerRow, markerCol, markerOwner, markerData, kind);
                },
                removeMarkersAt
            });
            restored.push({ type: 'WORK' });
            continue;
        }
        const marker = addMarker(cardState, row, col, (owner || 'black') as PlayerKey, data, entry && entry.kind ? entry.kind : MARKER_KIND_SPECIAL);
        restored.push(marker);
        if (type === 'BREEDING' && marker && Number.isInteger(marker.id)) {
            ensureBreedingRuntime(cardState);
            const cs = cardState as any;
            cs.breedingFrontierByAnchorId[marker.id] = [];
        }
    }
    return restored;
}

function normalizeFlipPosition(raw: any): CellPosition | null {
    const row = Number.isInteger(raw && raw.row) ? raw.row : normalizeBoardIndex(raw && raw[0]);
    const col = Number.isInteger(raw && raw.col) ? raw.col : normalizeBoardIndex(raw && raw[1]);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row: row as number, col: col as number };
}

function applyRestoredStoneFlips(cardState: CardState, gameState: GameState, row: number, col: number, ownerKey: PlayerKey, deps: LivingWillDeps): CellPosition[] {
    if (!deps || typeof deps.getOccupiedOriginFlipsWithContext !== 'function') return [];
    const ownerValue = ownerKeyToValue(ownerKey);
    const context = typeof deps.getCardContext === 'function' ? deps.getCardContext(cardState) : {};
    const rawFlips = deps.getOccupiedOriginFlipsWithContext(gameState, row, col, ownerValue, context);
    if (!Array.isArray(rawFlips) || rawFlips.length === 0) return [];

    const boardOps = getBoardOps(deps);
    const flipped: CellPosition[] = [];
    const seen = new Set<string>();
    for (const raw of rawFlips) {
        const pos = normalizeFlipPosition(raw);
        if (!pos) continue;
        const key = `${pos.row},${pos.col}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!boardOps || typeof boardOps.changeAt !== 'function') {
            throw new Error('BoardOps.changeAt is required by CardLivingWill');
        }
        const changeRes = boardOps.changeAt(
            cardState,
            gameState,
            pos.row,
            pos.col,
            ownerKey,
            'LIVING_WILL',
            'living_will_restore_flip',
            {
                sourceSpecial: 'LIVING_WILL',
                restoredFromRow: row,
                restoredFromCol: col
            }
        );
        const changed = !!(changeRes && changeRes.changed);
        if (!changed) continue;
        if (typeof deps.clearBombAt === 'function') {
            deps.clearBombAt(cardState, pos.row, pos.col);
        }
        flipped.push(pos);
    }
    if (flipped.length && typeof deps.clearHyperactiveAtPositions === 'function') {
        deps.clearHyperactiveAtPositions(cardState, flipped);
    }
    if (flipped.length && typeof deps.addChargeWithTotal === 'function') {
        deps.addChargeWithTotal(cardState, ownerKey, flipped.length, {
            popupKind: 'board',
            sourceType: 'living_will_restore_flip_gain',
            anchorRow: row,
            anchorCol: col
        });
    }
    return flipped;
}

interface RestoreResult {
    restored: boolean;
    consumed: boolean;
    reason?: string;
    source?: CellPosition;
    destination?: CellPosition;
    owner?: PlayerKey;
    relocated?: boolean;
    flipped?: CellPosition[];
}

interface LivingWillTrigger extends RestoreTrigger {
    triggerKind?: string;
    flippedBy?: PlayerKey | null;
}

function restoreFromLivingWillSnapshot(cardState: CardState, gameState: GameState, livingWillMarker: any, trigger: LivingWillTrigger, deps: LivingWillDeps = {}): RestoreResult {
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

    const srcRow = sourceRow as number;
    const srcCol = sourceCol as number;

    const relocate = shouldRelocateForTrigger(trigger);
    const destination = relocate
        ? pickRelocationTarget(cardState, gameState, srcRow, srcCol, deps)
        : { row: srcRow, col: srcCol };

    removeMarkerById(cardState, snapshot && snapshot.id);
    emitPresentationEvent(cardState, {
        type: 'STATUS_REMOVED',
        row: srcRow,
        col: srcCol,
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

    // After null check above, destination is guaranteed to be non-null
    const destRow = destination.row;
    const destCol = destination.col;

    const boardOps = getBoardOps(deps);
    if (!boardOps || typeof boardOps.spawnAt !== 'function' || typeof boardOps.changeAt !== 'function') {
        return { restored: false, consumed: true, reason: 'board_ops_unavailable' };
    }

    removeNonBlockingMarkersAt(cardState, destRow, destCol);

    const destinationValue = getCellValue(gameState, destRow, destCol, cardState, deps);
    const visualMeta = buildRestoreVisualMeta(baseline, Object.assign({}, trigger, { relocated: relocate }));
    let boardResult = null;
    if (destinationValue === EMPTY) {
        boardResult = boardOps.spawnAt(
            cardState,
            gameState,
            destRow,
            destCol,
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
            destRow,
            destCol,
            baseline.owner,
            'LIVING_WILL',
            'living_will_restored',
            changeMeta
        );
    }

    if (!(boardResult && (boardResult.spawned || boardResult.changed || boardResult.presented || destinationValue !== EMPTY))) {
        return { restored: false, consumed: true, reason: 'board_restore_failed', destination: { row: destRow, col: destCol } };
    }

    restoreBaselineMarkers(cardState, gameState, destRow, destCol, baseline, deps);
    const flipped = applyRestoredStoneFlips(cardState, gameState, destRow, destCol, baseline.owner, deps);

    const result: RestoreResult = {
        restored: true,
        consumed: true,
        source: { row: srcRow, col: srcCol },
        destination: { row: destRow, col: destCol },
        owner: baseline.owner,
        relocated: relocate
    };
    if (flipped.length) result.flipped = flipped;
    return result;
}

interface ApplyLivingWillResult {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    markerId?: number | null;
    baselineOwner?: PlayerKey;
}

function applyLivingWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: LivingWillDeps = {}): ApplyLivingWillResult {
    const readCardPendingEffect = deps.readCardPendingEffect || ((state: CardState, owner: PlayerKey) => {
        const cs = state as any;
        return cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[owner] : null;
    });
    const clearCardPendingEffect = deps.clearCardPendingEffect || ((state: CardState, owner: PlayerKey) => {
        const cs = state as any;
        if (cs && cs.pendingEffectByPlayer) cs.pendingEffectByPlayer[owner] = null;
    });
    const getLivingWillTargets = deps.getLivingWillTargets || (() => []);

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'LIVING_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getLivingWillTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target: any) => (
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
    if (typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'STATUS_APPLIED',
            row,
            col,
            meta: {
                special: 'LIVING_WILL',
                owner: playerKey,
                reason: 'living_will_selected'
            }
        });
    }
    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        row,
        col,
        markerId: marker && marker.id ? marker.id : null,
        baselineOwner: baseline.owner
    };
}

interface ApplyLivingWillAfterFlipsResult {
    restored: CellPosition[];
    flipped?: CellPosition[];
}

function applyLivingWillAfterFlips(cardState: CardState, gameState: GameState, flips: any[], flipperKey: PlayerKey, deps: LivingWillDeps = {}): ApplyLivingWillAfterFlipsResult {
    const restored: CellPosition[] = [];
    const flipped: CellPosition[] = [];
    if (!Array.isArray(flips) || !flips.length) return { restored };
    const seen = new Set<string>();
    for (const raw of flips) {
        const row = Number.isInteger(raw && raw.row) ? raw.row : normalizeBoardIndex(raw && raw[0]);
        const col = Number.isInteger(raw && raw.col) ? raw.col : normalizeBoardIndex(raw && raw[1]);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const livingWillMarker = findLivingWillMarkerAt(cardState, row as number, col as number);
        if (!livingWillMarker) continue;
        const baseline = livingWillMarker.data && livingWillMarker.data.baseline;
        const currentOwner = normalizeOwnerKeyFromValue(getCellValue(gameState, row as number, col as number, cardState, deps));
        if (!baseline || !baseline.owner || currentOwner === baseline.owner) continue;
        const result = restoreFromLivingWillSnapshot(cardState, gameState, livingWillMarker, {
            triggerKind: 'flip',
            cause: 'LIVING_WILL',
            reason: 'living_will_flip_restore',
            sourceRow: row,
            sourceCol: col,
            flippedBy: flipperKey || null
        }, deps);
        if (result && result.restored) {
            restored.push(result.destination || { row: row as number, col: col as number });
            if (Array.isArray(result.flipped) && result.flipped.length) flipped.push(...result.flipped);
        }
    }
    const out: ApplyLivingWillAfterFlipsResult = { restored };
    if (flipped.length) out.flipped = flipped;
    return out;
}

export = {
    applyLivingWill,
    applyLivingWillAfterFlips,
    findLivingWillMarkerAt,
    shouldTriggerForSpecialLoss,
    restoreFromLivingWillSnapshot
};
