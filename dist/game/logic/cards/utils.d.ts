export function getSpecialMarkerAt(cardState: any, row: any, col: any): {
    kind: string;
    category: any;
    marker: any;
} | null;
export function getRenderedSpecialMarkerAt(cardState: any, row: any, col: any): {
    kind: string;
    category: any;
    marker: any;
} | null;
export function getRenderedNonNormalStoneMarkerAt(cardState: any, row: any, col: any): {
    kind: string;
    category: any;
    marker: any;
} | null;
export function isFrozenCell(cardState: any, row: any, col: any): boolean;
export function isNonNormalStoneVisualAt(cardState: any, row: any, col: any): boolean;
export function isSpecialStoneAt(cardState: any, row: any, col: any): boolean;
export function getSpecialOwnerAt(cardState: any, row: any, col: any): any;
export function getGameVisualEffectsMap(): any;
export function resolveSpecialEffectKey(type: any): any;
export function isBoardHiddenTrapMarker(marker: any): boolean;
export function isBoardCellModifierMarker(marker: any): boolean;
export function isMarkerRenderedAsSpecialStone(entry: any): boolean;
export function isNormalStoneForPlayer(cardState: any, gameState: any, playerKey: any, row: any, col: any): boolean;
export function normalizePlayerKey(playerKey: any): any;
export function setChargeWithDelta(cardState: any, playerKey: any, nextValue: any, reason: any, meta: any): {
    changed: boolean;
    before: number;
    after: number;
    delta: number;
};
export function addChargeWithDelta(cardState: any, playerKey: any, amount: any, reason: any, meta: any): {
    changed: boolean;
    before: number;
    after: number;
    delta: number;
};
//# sourceMappingURL=utils.d.ts.map