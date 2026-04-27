/**
 * @file context.ts
 * @description Helper to obtain card-related context for CoreLogic and move generation.
 * Provides a safe fallback when CardLogic is not available (e.g., during early bootstrap or tests).
 */

import { CardState } from '../../src/types';

interface MarkerData {
    row: number;
    col: number;
    remainingTurns?: number;
    owner: string | number;
    placedTurn?: number;
    createdSeq?: number;
}

interface BlockedMarkerData {
    row: number;
    col: number;
    type: string | null;
    remainingOwnerTurns?: number;
    owner: string | number;
}

interface SafeCardContext {
    protectedStones: Array<{row: number; col: number}>;
    permaProtectedStones: Array<{row: number; col: number}>;
    bombs: MarkerData[];
    blockedCells: BlockedMarkerData[];
}

function mapBombMarkers(cardState: CardState | null | undefined): MarkerData[] {
    if (!cardState) return [];
    if (typeof (globalThis as any).MarkersAdapter !== 'undefined' && (globalThis as any).MarkersAdapter && typeof (globalThis as any).MarkersAdapter.getBombMarkers === 'function') {
        return (globalThis as any).MarkersAdapter.getBombMarkers(cardState).map((m: any) => ({
            row: m.row,
            col: m.col,
            remainingTurns: m.data ? m.data.remainingTurns : undefined,
            owner: m.owner,
            placedTurn: m.data ? m.data.placedTurn : undefined,
            createdSeq: m.createdSeq
        }));
    }
    return [];
}

function mapBlockedMarkers(cardState: CardState | null | undefined): BlockedMarkerData[] {
    if (!cardState || !Array.isArray(cardState.markers)) return [];
    return cardState.markers
        .filter((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.data &&
            (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE')
        ))
        .map((m: any) => ({
            row: m.row,
            col: m.col,
            type: m.data ? m.data.type : null,
            remainingOwnerTurns: m.data ? m.data.remainingOwnerTurns : undefined,
            owner: m.owner
        }));
}

function getSafeCardContext(
    cardState: CardState | null | undefined,
    protectedStones?: Array<{row: number; col: number}>,
    permaProtectedStones?: Array<{row: number; col: number}>
): SafeCardContext {
    // Prefer CardLogic when available
    if (typeof (globalThis as any).CardLogic !== 'undefined' && (globalThis as any).CardLogic && typeof (globalThis as any).CardLogic.getCardContext === 'function') {
        try {
            return (globalThis as any).CardLogic.getCardContext(cardState);
        } catch (e: any) {
            console.warn('[getSafeCardContext] CardLogic.getCardContext threw — falling back to safe context:', e && e.message);
        }
    }

    // Try requiring the local game logic implementation
    if (typeof require === 'function') {
        try {
            const cardsImpl = require('./cards');
            if (cardsImpl && typeof cardsImpl.getCardContext === 'function') {
                return cardsImpl.getCardContext(cardState);
            }
        } catch (_e) { /* ignore */ }
    }

    // Last-resort safe fallback
    return {
        protectedStones: protectedStones || [],
        permaProtectedStones: permaProtectedStones || [],
        bombs: mapBombMarkers(cardState),
        blockedCells: mapBlockedMarkers(cardState)
    };
}

export = {
    getSafeCardContext,
    mapBombMarkers,
    mapBlockedMarkers,
    mapBlockadeMarkers: mapBlockedMarkers
};
