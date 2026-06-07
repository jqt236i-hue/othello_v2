/**
 * @file board-executor.ts
 * @description Board Executor card and manifestation stone resolution.
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SpecialStoneRegistry = safeRequire('../../../shared/special-stone-registry');
const ManifestStoneRegistryFallback = safeRequire('../../../shared/manifest-stone-registry');

const BOARD_EXECUTOR_MARKER_TYPE = 'BOARD_EXECUTOR';
const BOARD_EXECUTOR_DURATION_OWNER_TURNS = 4;

const BOARD_EXECUTOR_FLIP_CHARGE_SOURCE_TYPES = new Set([
    'placement_flip_gain',
    'reverse_will_flip_gain',
    'swap_flip_gain',
    'dragon_immediate',
    'dragon_turn_start',
    'breeding_immediate',
    'breeding_turn_start',
    'hyperactive_turn_start',
    'robot_vacuum_turn_start',
    'ultimate_hyperactive_turn_start',
    'instant_hyperactive_immediate',
    'regen_capture_immediate',
    'regen_capture_turn_start',
    'seed_turn_start',
    'proliferation_turn_start',
    'stone_salvation_god_turn_start',
    'generated_spawn_turn_start',
    'clone_will_selection',
    'proliferation_immediate',
    'stone_salvation_god_immediate',
    'generated_spawn_immediate',
    'equality_will_immediate',
    'reinforcement_will_immediate',
    'support_troops_will_immediate',
    'salvation_will_immediate'
]);

function ownerKeyOf(playerKey: any): PlayerKey {
    return playerKey === 'white' ? 'white' : 'black';
}

function markerTypeOf(marker: any): string {
    return String(marker && marker.data && marker.data.type || '').trim().toUpperCase();
}

function markerOwnerOf(marker: any): PlayerKey {
    return ownerKeyOf(marker && marker.owner);
}

function getManifestRegistry(deps?: any): any {
    return (deps && deps.ManifestStoneRegistry) || ManifestStoneRegistryFallback;
}

function getMarkers(cardState: any, deps?: any): any[] {
    if (deps && typeof deps.getMarkers === 'function') {
        const markers = deps.getMarkers(cardState);
        return Array.isArray(markers) ? markers : [];
    }
    return cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
}

function isActiveMarker(marker: any): boolean {
    if (!marker || typeof marker !== 'object') return false;
    const remaining = Number(marker && marker.data && marker.data.remainingOwnerTurns);
    if (Object.prototype.hasOwnProperty.call(marker.data || {}, 'remainingOwnerTurns')) {
        return Number.isFinite(remaining) && remaining > 0;
    }
    return true;
}

function isManifestStoneType(rawType: any, deps?: any): boolean {
    const registry = getManifestRegistry(deps);
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

function isActiveBoardExecutorMarker(marker: any, deps?: any): boolean {
    const registry = getManifestRegistry(deps);
    if (registry && typeof registry.isActiveManifestStoneMarker === 'function') {
        return registry.isActiveManifestStoneMarker(marker) === true && markerTypeOf(marker) === BOARD_EXECUTOR_MARKER_TYPE;
    }
    return markerTypeOf(marker) === BOARD_EXECUTOR_MARKER_TYPE && isActiveMarker(marker);
}

function hasActiveBoardExecutor(cardState: CardState, deps?: any): boolean {
    return getMarkers(cardState, deps).some((marker) => isActiveBoardExecutorMarker(marker, deps));
}

function hasActiveBoardExecutorOwnedBy(cardState: CardState, playerKey: PlayerKey, deps?: any): boolean {
    const ownerKey = ownerKeyOf(playerKey);
    return getMarkers(cardState, deps).some((marker) => (
        isActiveBoardExecutorMarker(marker, deps) && markerOwnerOf(marker) === ownerKey
    ));
}

function countsAsBoardExecutorSpecialStone(marker: any): boolean {
    if (!marker || typeof marker !== 'object') return false;
    const type = markerTypeOf(marker);
    if (!type || isManifestStoneType(type)) return false;
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.countsAsSpecialStone === 'function') {
        return SpecialStoneRegistry.countsAsSpecialStone(type, marker.data) === true;
    }
    const kind = String(marker.kind || '').trim();
    return kind === 'specialStone' || kind === 'bomb';
}

function isBoardExecutorAffectedSpecialMarker(marker: any): boolean {
    if (!isActiveMarker(marker)) return false;
    if (!Number.isInteger(Number(marker.row)) || !Number.isInteger(Number(marker.col))) return false;
    return countsAsBoardExecutorSpecialStone(marker);
}

function collectBoardExecutorSpecialStoneCells(cardState: CardState, deps?: any): Array<{ row: number; col: number; owner: PlayerKey }> {
    const seen = new Set<string>();
    const cells: Array<{ row: number; col: number; owner: PlayerKey }> = [];
    for (const marker of getMarkers(cardState, deps)) {
        if (!isBoardExecutorAffectedSpecialMarker(marker)) continue;
        const row = Number(marker.row);
        const col = Number(marker.col);
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ row, col, owner: markerOwnerOf(marker) });
    }
    return cells;
}

function canUseBoardExecutor(cardState: CardState, playerKey: PlayerKey, deps?: any): boolean {
    const ownerKey = ownerKeyOf(playerKey);
    return getMarkers(cardState, deps).some((marker) => (
        isBoardExecutorAffectedSpecialMarker(marker) && markerOwnerOf(marker) === ownerKey
    ));
}

function ensureBoardExecutorState(cardState: any): void {
    if (!cardState.nextBoardExecutorStoneByPlayer || typeof cardState.nextBoardExecutorStoneByPlayer !== 'object') {
        cardState.nextBoardExecutorStoneByPlayer = { black: null, white: null };
    }
}

function applyBoardExecutorUsage(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureBoardExecutorState(cardState as any);
    if (!canUseBoardExecutor(cardState, ownerKey, deps)) {
        return { applied: false, reason: 'no_own_special_stone' };
    }
    if (!deps || typeof deps.applyCellRemovalAt !== 'function') {
        return { applied: false, reason: 'cell_removal_unavailable' };
    }
    const targets = collectBoardExecutorSpecialStoneCells(cardState, deps);
    const results: any[] = [];
    const run = () => {
        for (const target of targets) {
            const res = deps.applyCellRemovalAt(
                cardState,
                gameState,
                target.row,
                target.col,
                ownerKey,
                BOARD_EXECUTOR_MARKER_TYPE,
                'board_executor_special_stone_hole',
                {
                    ignoreAbsoluteProtection: true,
                    removalKind: 'board_executor_hole',
                    removalPolicy: 'board_executor',
                    randomSource: prng || null,
                    holeMeta: {
                        removalKind: 'board_executor_hole',
                        removalPolicy: 'board_executor'
                    }
                }
            );
            results.push({ row: target.row, col: target.col, result: res });
        }
        return results;
    };
    if (typeof deps.runCellRemovalBlock === 'function') {
        deps.runCellRemovalBlock(cardState, gameState, run, {
            cause: BOARD_EXECUTOR_MARKER_TYPE,
            reason: 'board_executor_special_stone_hole'
        });
    } else {
        run();
    }
    (cardState as any).nextBoardExecutorStoneByPlayer[ownerKey] = {
        sourceType: BOARD_EXECUTOR_MARKER_TYPE
    };
    return {
        applied: true,
        targets: results.filter((entry) => entry && entry.result && entry.result.applied)
    };
}

function applyBoardExecutorStoneReservation(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureBoardExecutorState(cardState as any);
    const reservation = (cardState as any).nextBoardExecutorStoneByPlayer[ownerKey];
    if (!reservation || reservation.sourceType !== BOARD_EXECUTOR_MARKER_TYPE) {
        return { applied: false, reason: 'not_armed' };
    }
    const markerKinds = deps && deps.MARKER_KINDS;
    const manifestKind = markerKinds && markerKinds.MANIFEST_STONE ? markerKinds.MANIFEST_STONE : 'manifestStone';
    const registry = getManifestRegistry(deps);
    const markerData = registry && typeof registry.createManifestStoneMarkerData === 'function'
        ? registry.createManifestStoneMarkerData(BOARD_EXECUTOR_MARKER_TYPE)
        : {
            type: BOARD_EXECUTOR_MARKER_TYPE,
            remainingOwnerTurns: BOARD_EXECUTOR_DURATION_OWNER_TURNS,
            absoluteProtected: true,
            sourceType: BOARD_EXECUTOR_MARKER_TYPE,
            visualEffectKey: 'boardExecutorStone'
        };
    const marker = deps.addMarker(cardState, manifestKind, row, col, ownerKey, markerData);
    (cardState as any).nextBoardExecutorStoneByPlayer[ownerKey] = null;
    return { applied: true, marker };
}

function processBoardExecutorHandTaxAtTurnStart(cardState: CardState, playerKey: PlayerKey, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    if (!hasActiveBoardExecutor(cardState, deps)) {
        return { applied: false, lost: 0, handCount: 0 };
    }
    const hand = cardState && (cardState as any).hands && Array.isArray((cardState as any).hands[ownerKey])
        ? (cardState as any).hands[ownerKey]
        : [];
    const handCount = hand.length;
    const taxableHandCount = Math.max(0, handCount - 1);
    const lost = taxableHandCount * taxableHandCount;
    if (lost > 0 && deps && typeof deps.addChargeValue === 'function') {
        deps.addChargeValue(cardState, ownerKey, -lost, 'board_executor_hand_tax', {
            sourceType: BOARD_EXECUTOR_MARKER_TYPE,
            handCount
        });
    }
    return { applied: true, player: ownerKey, lost, handCount };
}

function findBoardExecutorMarker(cardState: CardState, row: number, col: number, ownerKey: PlayerKey, deps: any): any {
    return getMarkers(cardState, deps).find((marker) => (
        marker &&
        Number(marker.row) === Number(row) &&
        Number(marker.col) === Number(col) &&
        markerOwnerOf(marker) === ownerKey &&
        markerTypeOf(marker) === BOARD_EXECUTOR_MARKER_TYPE
    )) || null;
}

function processBoardExecutorMarkerAtTurnStart(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    const marker = findBoardExecutorMarker(cardState, row, col, ownerKey, deps);
    if (!marker || !marker.data) return { applied: false, expired: null };
    const before = Number(marker.data.remainingOwnerTurns);
    if (!Number.isFinite(before)) return { applied: false, expired: null };
    const after = Math.max(0, Math.trunc(before) - 1);
    marker.data.remainingOwnerTurns = after;
    if (after > 0) {
        return { applied: true, remainingOwnerTurns: after, expired: null };
    }

    let markerRemovedByRevert = false;
    if (deps && typeof deps.isMainBoardCellForCard === 'function' && deps.isMainBoardCellForCard(row, col, gameState) && typeof deps.revertSpecialStoneWithPresentation === 'function') {
        const revertRes = deps.revertSpecialStoneWithPresentation(
            cardState,
            gameState,
            row,
            col,
            BOARD_EXECUTOR_MARKER_TYPE,
            ownerKey,
            'SYSTEM',
            'duration_end',
            {
                special: BOARD_EXECUTOR_MARKER_TYPE,
                owner: ownerKey,
                timer: 0,
                random: prng || null
            }
        );
        markerRemovedByRevert = !!(revertRes && revertRes.reverted);
    }
    if (!markerRemovedByRevert && deps && typeof deps.removeMarkerById === 'function') {
        deps.removeMarkerById(cardState, marker.id);
    }
    return {
        applied: true,
        remainingOwnerTurns: 0,
        expired: {
            row,
            col,
            owner: ownerKey,
            markerId: marker.id || null
        }
    };
}

function isBoardExecutorFlipChargeSource(meta: any): boolean {
    const sourceType = String(meta && meta.sourceType || '').trim();
    if (!sourceType) return false;
    if (BOARD_EXECUTOR_FLIP_CHARGE_SOURCE_TYPES.has(sourceType)) return true;
    return /_flip_gain$/.test(sourceType);
}

function resolveBoardExecutorChargeGainAmount(cardState: CardState, playerKey: PlayerKey, amount: any, meta?: any): number {
    const base = Number(amount);
    if (!Number.isFinite(base) || base <= 0) return Number.isFinite(base) ? base : 0;
    if (!isBoardExecutorFlipChargeSource(meta)) return base;
    return hasActiveBoardExecutorOwnedBy(cardState, ownerKeyOf(playerKey)) ? base * 2 : base;
}

export = {
    BOARD_EXECUTOR_MARKER_TYPE,
    BOARD_EXECUTOR_DURATION_OWNER_TURNS,
    canUseBoardExecutor,
    applyBoardExecutorUsage,
    applyBoardExecutorStoneReservation,
    processBoardExecutorHandTaxAtTurnStart,
    processBoardExecutorMarkerAtTurnStart,
    hasActiveBoardExecutor,
    hasActiveBoardExecutorOwnedBy,
    isBoardExecutorFlipChargeSource,
    resolveBoardExecutorChargeGainAmount
};
