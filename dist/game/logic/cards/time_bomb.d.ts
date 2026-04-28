/**
 * @file time_bomb.ts
 * @description Time Bomb helpers (Shared between Browser and Headless)
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
interface TimeBombDeps {
    addMarker?: (cs: CardState, kind: string, r: number, c: number, owner: PlayerKey, data: any) => {
        placed: boolean;
    };
    getTimeBombTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
    removeMarkersAt?: (cardState: CardState, row: number, col: number, options?: any) => void;
    destroyAt?: (cardState: CardState, gameState: GameState, row: number, col: number) => boolean;
    BoardOps?: any;
    specialStoneKind?: string;
}
declare function applyTimeBomb(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps?: TimeBombDeps): {
    placed: boolean;
    reason?: string;
};
declare function applyTimeBombWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: TimeBombDeps): {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
};
interface TickResult {
    exploded: Array<{
        row: number;
        col: number;
    }>;
    destroyed: Array<{
        row: number;
        col: number;
    }>;
}
declare function tickBombs(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps?: TimeBombDeps): TickResult;
interface TickBombAtResult {
    exploded: Array<{
        row: number;
        col: number;
    }>;
    destroyed: Array<{
        row: number;
        col: number;
    }>;
    removed: boolean;
}
declare function tickBombAt(cardState: CardState, gameState: GameState, bomb: any, activeKey: PlayerKey | undefined, deps?: TimeBombDeps): TickBombAtResult;
declare const _default: {
    applyTimeBomb: typeof applyTimeBomb;
    applyTimeBombWill: typeof applyTimeBombWill;
    tickBombs: typeof tickBombs;
    tickBombAt: typeof tickBombAt;
};
export = _default;
//# sourceMappingURL=time_bomb.d.ts.map