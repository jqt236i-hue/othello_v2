export function getTrapTargets(cardState: any, gameState: any, playerKey: any): any;
export function getTeleportTargets(cardState: any, gameState: any): any;
export function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any): any;
export function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any): any;
export function getTabooReverseCandidates(cardState: any, gameState: any, playerKey: any, row: any, col: any): {
    direction: any[];
    flips: {
        row: any;
        col: any;
    }[];
    score: number;
}[];
export function getSelectableTargets(cardState: any, gameState: any, playerKey: any): any;
export function getDestroyTargets(cardState: any, gameState: any): any;
export function getSwapTargets(cardState: any, gameState: any, playerKey: any): any;
export function getGuardTargets(cardState: any, gameState: any, playerKey: any): any;
export function getCaptureTargets(cardState: any, gameState: any, playerKey: any): any;
export function getTemptTargets(cardState: any, gameState: any, playerKey: any): any;
export function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any): any;
export function getSeedTargets(cardState: any, gameState: any, playerKey: any): any;
export function getCloneTargets(cardState: any, gameState: any, playerKey: any): any;
export function getSplitTargets(cardState: any, gameState: any, playerKey: any): any;
export function getBreedingTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getMeteorTargets(cardState: any, gameState: any, playerKey: any): any;
export function getFreezeTargets(cardState: any, gameState: any, playerKey: any): any;
export function getBlockadeTargets(cardState: any, gameState: any, playerKey: any): any;
export function getCellTeleportTargets(cardState: any, gameState: any): any;
export function getSniperTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getTimeBombTargets(cardState: any, gameState: any, playerKey: any): any;
export function getLightningTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getCrossBombTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getXBombTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getReinforcementTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
export function getEqualityTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
export function getCornerTributeTargets(cardState: any, gameState: any, playerKey: any): never[];
export function getLastResortTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
//# sourceMappingURL=target-resolver.d.ts.map