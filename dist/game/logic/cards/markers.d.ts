/**
 * @file markers.ts
 * @description Marker helpers (Shared between Browser and Headless)
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
declare function ensureMarkers(cardState: CardState): void;
declare function getMarkers(cardState: CardState): any[];
declare function getMarkerCategory(marker: any): string | null;
declare function isBombCategoryMarker(marker: any): boolean;
declare function isSpecialStoneMarker(marker: any): boolean;
declare function getBombMarkerType(marker: any): string | null;
declare function getSpecialMarkers(cardState: CardState): any[];
declare function getBombMarkers(cardState: CardState): any[];
declare function getBlockadeMarkers(cardState: CardState): any[];
declare function getBlockingMarkers(cardState: CardState): any[];
declare function isFrozenCellForCard(cardState: CardState, row: number, col: number): boolean;
declare function isMeteorHoleCell(cardState: CardState, row: number, col: number): boolean;
declare function isGuardProtectedCell(cardState: CardState, row: number, col: number): boolean;
declare function findSpecialMarkerAt(cardState: CardState, row: number, col: number, type?: string, owner?: PlayerKey): any;
declare function findBombMarkerAt(cardState: CardState, row: number, col: number): any;
interface RemoveMarkersOptions {
    kind?: string;
    category?: string;
    type?: string;
    owner?: PlayerKey;
}
declare function removeMarkersAt(cardState: CardState, row: number, col: number, options?: RemoveMarkersOptions): void;
declare function getSpecialMarkerAt(cardState: CardState, row: number, col: number): {
    kind: string;
    category: string | null;
    marker: any;
} | null;
declare function isSpecialStoneAt(cardState: CardState, row: number, col: number): boolean;
declare function getSpecialOwnerAt(cardState: CardState, row: number, col: number): PlayerKey | null;
declare function clearStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number): void;
declare function getStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number): string | null;
declare function setStoneIdAtForCard(cardState: CardState, gameState: GameState, row: number, col: number, stoneId: string | null): boolean;
interface Position {
    row: number;
    col: number;
}
declare function swapCellCoordinates(cardState: CardState, gameState: GameState, posA: Position, posB: Position): void;
declare function addMarker(cardState: CardState, kind: string, row: number, col: number, owner: PlayerKey, data: any): any;
declare function removeMarkerById(cardState: CardState, markerId: number): boolean;
interface ExtendLifeDeps {
    getExtendLifeTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
}
declare function applyExtendLifeWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: ExtendLifeDeps): {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    previousRemainingOwnerTurns?: number;
    newRemainingOwnerTurns?: number;
    multiplier?: number;
    cardType?: string;
};
declare function applyExtendLifeGod(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: ExtendLifeDeps): {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    previousRemainingOwnerTurns?: number;
    newRemainingOwnerTurns?: number;
    multiplier?: number;
    cardType?: string;
};
interface CorrosionDeps {
    getCorrosionTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
}
declare function applyCorrosionWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: CorrosionDeps): {
    applied: boolean;
    reason?: string;
    affectedCount: number;
    details: any[];
};
declare const _default: {
    MARKER_KINDS: any;
    MARKER_CATEGORIES: any;
    ensureMarkers: typeof ensureMarkers;
    getMarkers: typeof getMarkers;
    getMarkerCategory: typeof getMarkerCategory;
    getBombMarkerType: typeof getBombMarkerType;
    isBombCategoryMarker: typeof isBombCategoryMarker;
    isSpecialStoneMarker: typeof isSpecialStoneMarker;
    getSpecialMarkers: typeof getSpecialMarkers;
    getBombMarkers: typeof getBombMarkers;
    getBlockadeMarkers: typeof getBlockadeMarkers;
    getBlockingMarkers: typeof getBlockingMarkers;
    isFrozenCellForCard: typeof isFrozenCellForCard;
    isMeteorHoleCell: typeof isMeteorHoleCell;
    isGuardProtectedCell: typeof isGuardProtectedCell;
    findSpecialMarkerAt: typeof findSpecialMarkerAt;
    findBombMarkerAt: typeof findBombMarkerAt;
    removeMarkersAt: typeof removeMarkersAt;
    getSpecialMarkerAt: typeof getSpecialMarkerAt;
    isSpecialStoneAt: typeof isSpecialStoneAt;
    getSpecialOwnerAt: typeof getSpecialOwnerAt;
    clearStoneIdAtForCard: typeof clearStoneIdAtForCard;
    getStoneIdAtForCard: typeof getStoneIdAtForCard;
    setStoneIdAtForCard: typeof setStoneIdAtForCard;
    swapCellCoordinates: typeof swapCellCoordinates;
    addMarker: typeof addMarker;
    removeMarkerById: typeof removeMarkerById;
    applyExtendLifeWill: typeof applyExtendLifeWill;
    applyExtendLifeGod: typeof applyExtendLifeGod;
    applyCorrosionWill: typeof applyCorrosionWill;
};
export = _default;
//# sourceMappingURL=markers.d.ts.map