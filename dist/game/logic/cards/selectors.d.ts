/**
 * @file selectors.ts
 * @description Card selectable-target helpers (Shared between Browser and Headless)
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
declare function isBlockedCell(cardState: CardState, row: number, col: number): boolean;
interface TargetCell {
    row: number;
    col: number;
    side?: string | null;
}
declare function getDestroyTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getSwapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getPositionSwapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey, pending: any): TargetCell[];
interface DestinationCell extends TargetCell {
    side?: string | null;
    active?: boolean;
}
declare function getStrongWindTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getSuperBuoyancyTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getSuperGravityTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getTrapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getGuardTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getLivingWillTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getHyperactiveInheritTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getTimeBombTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getTeleportTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getCloneTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getSplitTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getBoardExpansionTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getBoardExpansionGodTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
declare function getCellTeleportDestinations(cardState: CardState, gameState: GameState): DestinationCell[];
declare function getCellTeleportTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getBlockadeTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getMeteorTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getBoardShrinkTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[];
interface CornerTarget {
    row: number;
    col: number;
    lineTargets?: any[];
    corner?: {
        row: number;
        col: number;
    };
    direction?: any;
    lineCells?: {
        row: number;
        col: number;
    }[];
    lineKey?: string | null;
}
declare function getBoardShrinkGodTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): CornerTarget[];
declare function getFreezeTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare function getSeedTargets(cardState: CardState, gameState: GameState): TargetCell[];
declare const _default: {
    getDestroyTargets: typeof getDestroyTargets;
    getSwapTargets: typeof getSwapTargets;
    getPositionSwapTargets: typeof getPositionSwapTargets;
    getStrongWindTargets: typeof getStrongWindTargets;
    getSuperBuoyancyTargets: typeof getSuperBuoyancyTargets;
    getSuperGravityTargets: typeof getSuperGravityTargets;
    getTrapTargets: typeof getTrapTargets;
    getGuardTargets: typeof getGuardTargets;
    getLivingWillTargets: typeof getLivingWillTargets;
    getHyperactiveInheritTargets: typeof getHyperactiveInheritTargets;
    getTimeBombTargets: typeof getTimeBombTargets;
    getTeleportTargets: typeof getTeleportTargets;
    getCellTeleportTargets: typeof getCellTeleportTargets;
    getCellTeleportDestinations: typeof getCellTeleportDestinations;
    getCloneTargets: typeof getCloneTargets;
    getSplitTargets: typeof getSplitTargets;
    getBoardExpansionTargets: typeof getBoardExpansionTargets;
    getBoardExpansionGodTargets: typeof getBoardExpansionGodTargets;
    getBlockadeTargets: typeof getBlockadeTargets;
    getMeteorTargets: typeof getMeteorTargets;
    getBoardShrinkTargets: typeof getBoardShrinkTargets;
    getBoardShrinkGodTargets: typeof getBoardShrinkGodTargets;
    getFreezeTargets: typeof getFreezeTargets;
    getSeedTargets: typeof getSeedTargets;
    isBlockedCell: typeof isBlockedCell;
};
export = _default;
//# sourceMappingURL=selectors.d.ts.map