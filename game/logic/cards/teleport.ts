/**
 * @file teleport.ts
 * @description Teleport helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');
import RandomSourceImport = require('../cards-internal/random-source');
import SpecialStoneRegistryImport = require('../../../shared/special-stone-registry-static');
import SelectorsCoreUtils = require('./selectors-core-utils');

const SharedConstants: any = SharedConstantsImport;
const RandomSourceModule: any = RandomSourceImport;
const SpecialStoneRegistry: any = SpecialStoneRegistryImport;

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;

interface TeleportDeps {
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    getTeleportTargets?(cardState: CardState, gameState: GameState): Array<{row: number; col: number}>;
    getTeleportDestinations?(cardState: CardState, gameState: GameState): Array<{row: number; col: number}>;
    moveAt?(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number, source: string, tag: string): any;
    getMarkers?(cardState: CardState): any[];
    isBoardMarker?(marker: any): boolean;
}

interface TeleportResult {
    applied: boolean;
    reason?: string;
    from?: { row: number; col: number };
    to?: { row: number; col: number };
}

function resolveRandomSource(prng?: { random(): number }) {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(prng, null, 'CardTeleport');
    }
    if (prng && typeof prng.random === 'function') return prng;
    throw new Error('CardTeleport requires an injected deterministic PRNG.');
}

function resolveRandomIndex(randomSource: { random(): number }, length: number): number {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function') {
        return RandomSourceModule.resolveRandomIndex(length, randomSource, null, 'CardTeleport');
    }
    if (!Number.isInteger(length) || length <= 0) return 0;
    const raw = Math.floor(randomSource.random() * length);
    if (!Number.isInteger(raw)) return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function getMarkers(cardState: CardState, deps: TeleportDeps): any[] {
    if (deps && typeof deps.getMarkers === 'function') {
        return deps.getMarkers(cardState);
    }
    return Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
}

function moveMarkers(cardState: CardState, fromRow: number, fromCol: number, toRow: number, toCol: number, deps: TeleportDeps) {
    const markers = getMarkers(cardState, deps);
    for (const marker of markers) {
        if (!marker) continue;
        if (marker.row !== fromRow || marker.col !== fromCol) continue;
        const markerClassifier = deps && typeof deps.isBoardMarker === 'function'
            ? deps.isBoardMarker
            : SpecialStoneRegistry && SpecialStoneRegistry.isBoardMarker;
        if (typeof markerClassifier !== 'function') {
            throw new Error('SpecialStoneRegistry.isBoardMarker is required by CardTeleport');
        }
        const boardMarker = markerClassifier(marker);
        if (boardMarker) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function applyTeleportWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng?: { random(): number }, deps: TeleportDeps = {}): TeleportResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'TELEPORT_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const getTeleportTargets = deps.getTeleportTargets || (() => []);
    const getTeleportDestinations = deps.getTeleportDestinations || (() => []);
    const moveAt = deps.moveAt || null;

    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null) return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY) return { applied: false, reason: 'empty' };
    if (SelectorsCoreUtils.isCardMovementProtectedCell(cardState, row, col)) {
        return { applied: false, reason: 'movement_protected' };
    }

    const targets = getTeleportTargets(cardState, gameState);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const destinations = getTeleportDestinations(cardState, gameState);
    if (!Array.isArray(destinations) || !destinations.length) {
        return { applied: false, reason: 'no_destination' };
    }

    const randomSource = resolveRandomSource(prng);
    const to = destinations[resolveRandomIndex(randomSource, destinations.length)] || destinations[0];

    if (typeof moveAt === 'function') {
        const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'TELEPORT_WILL', 'teleport_move');
        if (!result || !result.moved) {
            return { applied: false, reason: 'move_failed' };
        }
        if (result.markerHandled !== true) {
            moveMarkers(cardState, row, col, to.row, to.col, deps);
        }
    } else {
        const cleared = setCellValueForCard(gameState, row, col, EMPTY);
        const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
        if (!cleared || !placed) {
            return { applied: false, reason: 'move_failed' };
        }
        moveMarkers(cardState, row, col, to.row, to.col, deps);
    }

    cs.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, from: { row, col }, to };
}

export = {
    applyTeleportWill
};
