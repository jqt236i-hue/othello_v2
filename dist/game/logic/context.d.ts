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
    protectedStones: Array<{
        row: number;
        col: number;
    }>;
    permaProtectedStones: Array<{
        row: number;
        col: number;
    }>;
    bombs: MarkerData[];
    blockedCells: BlockedMarkerData[];
}
declare function mapBombMarkers(cardState: CardState | null | undefined): MarkerData[];
declare function mapBlockedMarkers(cardState: CardState | null | undefined): BlockedMarkerData[];
declare function getSafeCardContext(cardState: CardState | null | undefined, protectedStones?: Array<{
    row: number;
    col: number;
}>, permaProtectedStones?: Array<{
    row: number;
    col: number;
}>): SafeCardContext;
declare const _default: {
    getSafeCardContext: typeof getSafeCardContext;
    mapBombMarkers: typeof mapBombMarkers;
    mapBlockedMarkers: typeof mapBlockedMarkers;
    mapBlockadeMarkers: typeof mapBlockedMarkers;
};
export = _default;
//# sourceMappingURL=context.d.ts.map