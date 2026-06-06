/**
 * @file observer-will.ts
 * @description Observer Will marker expiry and repayment resolution.
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

type RepaymentRef = {
    entry: any;
    index: number;
};

const OBSERVER_WILL_OBSERVED_COST_DELTA = 5;

function ownerKeyOf(playerKey: any): PlayerKey {
    return playerKey === 'white' ? 'white' : 'black';
}

function opponentKeyOf(playerKey: PlayerKey): PlayerKey {
    return playerKey === 'white' ? 'black' : 'white';
}

function normalizePositiveCopyId(cardCopyId: any): number | null {
    const n = Number(cardCopyId);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function getObserverWillModifierBucket(cardState: CardState, cardCopyId: any): any[] {
    const copyId = normalizePositiveCopyId(cardCopyId);
    if (!copyId || !cardState || !(cardState as any).cardCostModifiersByCopyId) return [];
    const bucket = (cardState as any).cardCostModifiersByCopyId[String(copyId)];
    return Array.isArray(bucket) ? bucket : [];
}

function hasObserverWillObservationCost(cardState: CardState, cardCopyId: any): boolean {
    return getObserverWillModifierBucket(cardState, cardCopyId).some((entry: any) => (
        entry &&
        String(entry.sourceType || '').toUpperCase() === 'OBSERVER_WILL' &&
        Number(entry.delta) === OBSERVER_WILL_OBSERVED_COST_DELTA
    ));
}

function addObserverWillObservationCostOnce(cardState: CardState, cardCopyId: any, deps: any, cardId?: any): boolean {
    const copyId = normalizePositiveCopyId(cardCopyId);
    if (!copyId || hasObserverWillObservationCost(cardState, copyId)) return false;
    if (!deps || typeof deps.addCardCostModifierForCopyId !== 'function') return false;
    if (typeof deps.isInviolableSpecialCardId === 'function' && deps.isInviolableSpecialCardId(cardId)) return false;
    deps.addCardCostModifierForCopyId(
        cardState,
        copyId,
        OBSERVER_WILL_OBSERVED_COST_DELTA,
        'OBSERVER_WILL'
    );
    return true;
}

function applyObserverWillObservedCostTax(cardState: CardState, ownerKey: PlayerKey, observedCopyIds: any[], deps: any, exemptCopyId?: any): Record<string, any> {
    const owner = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!owner || !Array.isArray(observedCopyIds)) {
        return { appliedCount: 0 };
    }
    const hand = cardState && (cardState as any).hands && Array.isArray((cardState as any).hands[owner])
        ? (cardState as any).hands[owner]
        : [];
    const exempt = normalizePositiveCopyId(exemptCopyId);
    let appliedCount = 0;
    let skippedSpecialCount = 0;
    for (let i = 0; i < observedCopyIds.length; i += 1) {
        const copyId = normalizePositiveCopyId(observedCopyIds[i]);
        if (!copyId || (exempt && copyId === exempt)) continue;
        const cardId = hand[i];
        if (typeof (deps && deps.isInviolableSpecialCardId) === 'function' && deps.isInviolableSpecialCardId(cardId)) {
            skippedSpecialCount += 1;
            continue;
        }
        if (addObserverWillObservationCostOnce(cardState, copyId, deps, cardId)) {
            appliedCount += 1;
        }
    }
    return { appliedCount, skippedSpecialCount };
}

function clearObserverWillObservationCost(cardState: CardState, cardCopyId: any): boolean {
    const copyId = normalizePositiveCopyId(cardCopyId);
    if (!copyId || !cardState || !(cardState as any).cardCostModifiersByCopyId) return false;
    const key = String(copyId);
    const bucket = (cardState as any).cardCostModifiersByCopyId[key];
    if (!Array.isArray(bucket) || bucket.length <= 0) return false;
    const nextBucket = bucket.filter((entry: any) => !(
        entry &&
        String(entry.sourceType || '').toUpperCase() === 'OBSERVER_WILL'
    ));
    if (nextBucket.length === bucket.length) return false;
    if (nextBucket.length > 0) {
        (cardState as any).cardCostModifiersByCopyId[key] = nextBucket;
    } else {
        delete (cardState as any).cardCostModifiersByCopyId[key];
    }
    return true;
}

function findObserverWillRepaymentEntry(repayments: any, markerData: any): RepaymentRef {
    if (!Array.isArray(repayments)) return { entry: null, index: -1 };
    const repaymentId = markerData && typeof markerData.repaymentId === 'string'
        ? markerData.repaymentId
        : null;
    if (repaymentId) {
        const index = repayments.findIndex((entry: any) => entry && entry.repaymentId === repaymentId);
        if (index >= 0) return { entry: repayments[index], index };
    }
    const markerId = Number(markerData && markerData.markerId);
    if (Number.isInteger(markerId) && markerId > 0) {
        const index = repayments.findIndex((entry: any) => entry && Number(entry.markerId) === markerId);
        if (index >= 0) return { entry: repayments[index], index };
    }
    const repaymentIndex = Number(markerData && markerData.repaymentIndex);
    if (Number.isInteger(repaymentIndex) && repayments[repaymentIndex]) {
        return { entry: repayments[repaymentIndex], index: repaymentIndex };
    }
    return { entry: null, index: -1 };
}

function applyObserverWillStoneReservation(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    if (!cardState || !(cardState as any).nextObserverWillStoneByPlayer) {
        return { applied: false, reason: 'not_armed' };
    }
    const reservation = (cardState as any).nextObserverWillStoneByPlayer[ownerKey];
    if (!reservation || reservation.sourceType !== 'OBSERVER_WILL') {
        return { applied: false, reason: 'not_armed' };
    }
    const markerKinds = deps && deps.MARKER_KINDS;
    const addMarker = deps && deps.addMarker;
    const manifestKind = markerKinds && markerKinds.MANIFEST_STONE ? markerKinds.MANIFEST_STONE : 'manifestStone';
    const registry = deps && deps.ManifestStoneRegistry;
    const markerData = registry && typeof registry.createManifestStoneMarkerData === 'function'
        ? registry.createManifestStoneMarkerData('OBSERVER_WILL', {
            repaymentId: typeof reservation.repaymentId === 'string' ? reservation.repaymentId : null,
            stolenCardId: reservation.stolenCardId || null,
            stolenCardCopyId: Number.isInteger(reservation.stolenCardCopyId) ? reservation.stolenCardCopyId : null,
            repaymentIndex: Number.isInteger(reservation.repaymentIndex) ? reservation.repaymentIndex : null
        })
        : {
            type: 'OBSERVER_WILL',
            remainingOwnerTurns: 5,
            absoluteProtected: true,
            sourceType: 'OBSERVER_WILL',
            repaymentId: typeof reservation.repaymentId === 'string' ? reservation.repaymentId : null,
            stolenCardId: reservation.stolenCardId || null,
            stolenCardCopyId: Number.isInteger(reservation.stolenCardCopyId) ? reservation.stolenCardCopyId : null,
            repaymentIndex: Number.isInteger(reservation.repaymentIndex) ? reservation.repaymentIndex : null,
            visualEffectKey: 'observerWillStone'
        };
    const marker = addMarker(cardState, manifestKind, row, col, ownerKey, markerData);
    const repayments = (cardState as any).observerWillRepaymentsByPlayer && (cardState as any).observerWillRepaymentsByPlayer[ownerKey];
    const repaymentRef = findObserverWillRepaymentEntry(repayments, reservation);
    if (repaymentRef.entry) {
        repaymentRef.entry.markerId = marker && marker.id ? marker.id : null;
    }
    (cardState as any).nextObserverWillStoneByPlayer[ownerKey] = null;
    return { applied: true, marker };
}

function hasActiveObserverWillReveal(cardState: CardState, viewerKey: PlayerKey, ownerKey: PlayerKey, deps: any): boolean {
    const viewer = viewerKey === 'white' ? 'white' : (viewerKey === 'black' ? 'black' : null);
    const owner = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!viewer || !owner || viewer === owner) return false;
    const getMarkers = deps && deps.getMarkers;
    const getActiveManifestMarkers = deps && deps.getActiveManifestMarkers;
    const isManifestStoneMarker = deps && deps.isManifestStoneMarker;
    const markers = typeof getActiveManifestMarkers === 'function'
        ? getActiveManifestMarkers(cardState)
        : getMarkers(cardState);
    return markers.some((entry: any) => {
        if (!entry || entry.owner !== viewer || !entry.data) return false;
        if (typeof getActiveManifestMarkers !== 'function' && typeof isManifestStoneMarker === 'function') {
            if (!isManifestStoneMarker(entry)) return false;
        } else if (typeof getActiveManifestMarkers !== 'function' && entry.kind !== 'manifestStone' && entry.kind !== 'specialStone') {
            return false;
        }
        if (String(entry.data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
        if (typeof getActiveManifestMarkers === 'function') return true;
        const remaining = Number(entry.data.remainingOwnerTurns);
        return !Number.isFinite(remaining) || remaining > 0;
    });
}

function revealObserverWillObservedHand(cardState: CardState, observerKey: PlayerKey, deps: any, ownerKeyOverride?: PlayerKey): number[] {
    const viewer = observerKey === 'white' ? 'white' : (observerKey === 'black' ? 'black' : null);
    if (!viewer || typeof (deps && deps.revealCurrentHandToViewer) !== 'function') return [];
    const opponentKey = ownerKeyOverride === 'white' || ownerKeyOverride === 'black'
        ? ownerKeyOverride
        : opponentKeyOf(viewer);
    if (opponentKey === viewer) return [];
    const observedCopyIds = deps.revealCurrentHandToViewer(cardState, viewer, opponentKey) || [];
    applyObserverWillObservedCostTax(cardState, opponentKey, observedCopyIds, deps);
    return observedCopyIds;
}

function observeActiveObserverWillHandForOwner(cardState: CardState, ownerKey: PlayerKey, deps: any): Record<string, any> {
    const owner = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!owner) return { applied: false, observedCopyIds: [] };
    const observerKey = opponentKeyOf(owner);
    if (!hasActiveObserverWillReveal(cardState, observerKey, owner, deps)) {
        return { applied: false, observedCopyIds: [] };
    }
    const observedCopyIds = revealObserverWillObservedHand(cardState, observerKey, deps, owner);
    return {
        applied: observedCopyIds.length > 0,
        observerKey,
        ownerKey: owner,
        observedCopyIds
    };
}

function collectObserverWillDestroyableOwnStones(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: any): Array<{ row: number; col: number }> {
    const out: Array<{ row: number; col: number }> = [];
    const ownerValue = playerKey === 'white' ? deps.WHITE : deps.BLACK;
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : [];
    for (let row = 0; row < board.length; row += 1) {
        const line = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < line.length; col += 1) {
            if (deps.getCellValueForCard(gameState, row, col) !== ownerValue) continue;
            if (deps.isAbsoluteProtectedCell(cardState, row, col)) continue;
            out.push({ row, col });
        }
    }
    return out;
}

function resolveObserverWillRepaymentTurnStartEntry(cardState: CardState, gameState: GameState, ownerKey: PlayerKey, rawEntry: any, prng: any, deps: any): Record<string, any> {
    const remainingBefore = Number.isFinite(Number(rawEntry && rawEntry.remainingOwnerTurns))
        ? Math.max(0, Math.floor(Number(rawEntry.remainingOwnerTurns)))
        : 0;
    if (remainingBefore <= 0) {
        return {
            entry: null,
            nextEntry: null,
            completed: true
        };
    }
    const repaymentAmount = Number.isFinite(Number(rawEntry && rawEntry.repaymentAmount))
        ? Math.max(0, Math.floor(Number(rawEntry.repaymentAmount)))
        : 0;
    const shortageDestroyCount = Number.isFinite(Number(rawEntry && rawEntry.shortageDestroyCount))
        ? Math.max(0, Math.floor(Number(rawEntry.shortageDestroyCount)))
        : 4;
    const chargeBefore = Number(cardState && (cardState as any).charge && (cardState as any).charge[ownerKey] || 0);
    const remainingAfter = Math.max(0, remainingBefore - 1);
    const entry: any = {
        sourceType: 'OBSERVER_WILL',
        stolenCardId: rawEntry && rawEntry.stolenCardId || null,
        repaymentAmount,
        shortageDestroyCount,
        remainingOwnerTurnsBefore: remainingBefore,
        remainingOwnerTurnsAfter: remainingAfter,
        chargeBefore,
        chargeAfter: chargeBefore,
        repaid: 0,
        shortage: false,
        destroyed: [],
        destroyedCount: 0,
        completed: remainingAfter <= 0
    };
    if (chargeBefore >= repaymentAmount) {
        const deltaRes = deps.addChargeValue(cardState, ownerKey, -repaymentAmount, 'observer_will_repayment');
        entry.repaid = Math.max(0, -(Number(deltaRes && deltaRes.delta) || 0));
        entry.chargeAfter = Number.isFinite(Number(deltaRes && deltaRes.after))
            ? Number(deltaRes.after)
            : Math.max(0, chargeBefore - repaymentAmount);
    } else {
        entry.shortage = true;
        const targets = deps.sampleRandomPositions(
            collectObserverWillDestroyableOwnStones(cardState, gameState, ownerKey, deps),
            shortageDestroyCount,
            prng
        );
        for (const target of targets) {
            const destroyRes = deps.destroyCellWithPresentation(
                cardState,
                gameState,
                target.row,
                target.col,
                'OBSERVER_WILL',
                'observer_will_repayment_shortage',
                { owner: ownerKey }
            );
            if (!destroyRes || !destroyRes.destroyed) continue;
            entry.destroyed.push({ row: target.row, col: target.col });
        }
        entry.destroyedCount = entry.destroyed.length;
    }
    return {
        entry,
        nextEntry: entry.completed
            ? null
            : {
                ...rawEntry,
                status: 'active',
                remainingOwnerTurns: remainingAfter,
                repaymentAmount,
                shortageDestroyCount
            },
        completed: entry.completed
    };
}

function findObserverWillMarker(cardState: CardState, row: number, col: number, ownerKey: PlayerKey, repaymentId: any, repaymentIndex: any, deps: any): any {
    const normalizedRepaymentId = typeof repaymentId === 'string' ? repaymentId : null;
    const normalizedRepaymentIndex = repaymentIndex === undefined || repaymentIndex === null
        ? null
        : Number(repaymentIndex);
    return deps.getMarkers(cardState).find((entry: any) => {
        if (!entry || entry.row !== row || entry.col !== col || entry.owner !== ownerKey || !entry.data) return false;
        if (typeof deps.isManifestStoneMarker === 'function' && !deps.isManifestStoneMarker(entry)) return false;
        if (typeof deps.isManifestStoneMarker !== 'function' && entry.kind !== 'manifestStone' && entry.kind !== 'specialStone') return false;
        if (String(entry.data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
        if (normalizedRepaymentId) return entry.data.repaymentId === normalizedRepaymentId;
        if (!Number.isInteger(normalizedRepaymentIndex)) return true;
        return Number(entry.data.repaymentIndex) === normalizedRepaymentIndex;
    }) || null;
}

function processObserverWillMarkerAtTurnStart(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    const marker = findObserverWillMarker(cardState, row, col, ownerKey, null, null, deps);
    if (!marker || !marker.data) return { applied: false, expired: [], repayment: null };
    const before = Number(marker.data.remainingOwnerTurns);
    if (!Number.isFinite(before)) return { applied: false, expired: [], repayment: null };
    const observedCopyIds = revealObserverWillObservedHand(cardState, ownerKey, deps);
    const after = Math.max(0, Math.trunc(before) - 1);
    marker.data.remainingOwnerTurns = after;
    if (after > 0) {
        return { applied: true, expired: [], remainingOwnerTurns: after, repayment: null, observedCopyIds };
    }
    const repayments = cardState && (cardState as any).observerWillRepaymentsByPlayer && (cardState as any).observerWillRepaymentsByPlayer[ownerKey];
    const markerRepaymentKey = {
        repaymentId: marker.data.repaymentId || null,
        markerId: marker.id || null,
        repaymentIndex: marker.data.repaymentIndex
    };
    let repaymentRef = findObserverWillRepaymentEntry(repayments, markerRepaymentKey);
    let repayment = null;
    let markerRemovedByRevert = false;
    if (deps.isMainBoardCellForCard(row, col, gameState)) {
        const revertRes = deps.revertSpecialStoneWithPresentation(
            cardState,
            gameState,
            row,
            col,
            'OBSERVER_WILL',
            ownerKey,
            'SYSTEM',
            'duration_end',
            {
                special: 'OBSERVER_WILL',
                owner: ownerKey,
                timer: 0,
                random: prng || null
            }
        );
        markerRemovedByRevert = !!(revertRes && revertRes.reverted);
        if (revertRes && revertRes.livingWillRestore && revertRes.livingWillRestore.restored) {
            if (repaymentRef.entry) {
                const restoredRow = Number.isInteger(revertRes.livingWillRestore.destination && revertRes.livingWillRestore.destination.row)
                    ? revertRes.livingWillRestore.destination.row
                    : row;
                const restoredCol = Number.isInteger(revertRes.livingWillRestore.destination && revertRes.livingWillRestore.destination.col)
                    ? revertRes.livingWillRestore.destination.col
                    : col;
                const restoredMarker = findObserverWillMarker(cardState, restoredRow, restoredCol, ownerKey, markerRepaymentKey.repaymentId, markerRepaymentKey.repaymentIndex, deps);
                repaymentRef.entry.markerId = restoredMarker && restoredMarker.id
                    ? restoredMarker.id
                    : repaymentRef.entry.markerId || null;
                repaymentRef.entry.status = 'waiting_for_marker_expire';
            }
            return {
                applied: true,
                expired: [],
                remainingOwnerTurns: 0,
                repayment: null,
                livingWillRestored: true
            };
        }
    }
    if (!markerRemovedByRevert) {
        deps.removeMarkerById(cardState, marker.id);
    }
    repaymentRef = findObserverWillRepaymentEntry(repayments, markerRepaymentKey);
    if (repaymentRef.entry && repaymentRef.index >= 0) {
        repaymentRef.entry.status = 'active';
        repaymentRef.entry.markerId = marker.id || repaymentRef.entry.markerId || null;
        const repaymentRes = resolveObserverWillRepaymentTurnStartEntry(
            cardState,
            gameState,
            ownerKey,
            repaymentRef.entry,
            prng,
            deps
        );
        repayment = repaymentRes && repaymentRes.entry ? repaymentRes.entry : null;
        if (repaymentRes && repaymentRes.nextEntry) {
            repayments[repaymentRef.index] = repaymentRes.nextEntry;
        } else {
            repayments.splice(repaymentRef.index, 1);
        }
    }
    const expired = [{
        row,
        col,
        owner: ownerKey,
        markerId: marker.id || null,
        stolenCardId: marker.data.stolenCardId || null
    }];
    return { applied: true, expired, remainingOwnerTurns: 0, repayment };
}

function processObserverWillRepaymentsAtTurnStart(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    const byPlayer = cardState && (cardState as any).observerWillRepaymentsByPlayer;
    const entries = byPlayer && Array.isArray(byPlayer[ownerKey]) ? byPlayer[ownerKey] : [];
    const summary: any = { entries: [], totalRepaid: 0, totalDestroyed: 0, completedCount: 0 };
    if (!entries.length) return summary;

    const nextEntries = [];
    for (const rawEntry of entries) {
        const status = String(rawEntry && rawEntry.status || '');
        if (status !== 'active') {
            nextEntries.push(rawEntry);
            continue;
        }
        const repaymentRes = resolveObserverWillRepaymentTurnStartEntry(cardState, gameState, ownerKey, rawEntry, prng, deps);
        const entry = repaymentRes && repaymentRes.entry ? repaymentRes.entry : null;
        if (!entry) {
            summary.completedCount += 1;
            continue;
        }
        summary.totalRepaid += Number(entry.repaid) || 0;
        summary.totalDestroyed += Number(entry.destroyedCount) || 0;
        if (repaymentRes && repaymentRes.nextEntry) nextEntries.push(repaymentRes.nextEntry);
        if (entry.completed) summary.completedCount += 1;
        summary.entries.push(entry);
    }
    if (byPlayer && typeof byPlayer === 'object') {
        byPlayer[ownerKey] = nextEntries;
    }
    return summary;
}

export = {
    applyObserverWillStoneReservation,
    hasActiveObserverWillReveal,
    revealObserverWillObservedHand,
    observeActiveObserverWillHandForOwner,
    applyObserverWillObservedCostTax,
    clearObserverWillObservationCost,
    processObserverWillMarkerAtTurnStart,
    processObserverWillRepaymentsAtTurnStart
};
