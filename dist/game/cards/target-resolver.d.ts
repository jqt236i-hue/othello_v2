declare function getTrapTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getTeleportTargets(cardState: any, gameState: any): any;
declare function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getTabooReverseCandidates(cardState: any, gameState: any, playerKey: any, row: any, col: any): {
    direction: any[];
    flips: {
        row: any;
        col: any;
    }[];
    score: number;
}[];
declare function getSelectableTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getDestroyTargets(cardState: any, gameState: any): any;
declare function getSwapTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getGuardTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getCaptureTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getTemptTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any): any;
declare function getSeedTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getCloneTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getSplitTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getBreedingTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getMeteorTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getFreezeTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getBlockadeTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getCellTeleportTargets(cardState: any, gameState: any): any;
declare function getSniperTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getTimeBombTargets(cardState: any, gameState: any, playerKey: any): any;
declare function getLightningTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getCrossBombTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getXBombTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getReinforcementTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
declare function getEqualityTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
declare function getCornerTributeTargets(cardState: any, gameState: any, playerKey: any): never[];
declare function getLastResortTargets(cardState: any, gameState: any, playerKey: any): {
    row: any;
    col: any;
}[];
declare const _default: {
    getTrapTargets: typeof getTrapTargets;
    getTeleportTargets: typeof getTeleportTargets;
    getBoardExpansionTargets: typeof getBoardExpansionTargets;
    getBoardShrinkTargets: typeof getBoardShrinkTargets;
    getTabooReverseCandidates: typeof getTabooReverseCandidates;
    getSelectableTargets: typeof getSelectableTargets;
    getDestroyTargets: typeof getDestroyTargets;
    getSwapTargets: typeof getSwapTargets;
    getGuardTargets: typeof getGuardTargets;
    getCaptureTargets: typeof getCaptureTargets;
    getTemptTargets: typeof getTemptTargets;
    getPositionSwapTargets: typeof getPositionSwapTargets;
    getSeedTargets: typeof getSeedTargets;
    getCloneTargets: typeof getCloneTargets;
    getSplitTargets: typeof getSplitTargets;
    getBreedingTargets: typeof getBreedingTargets;
    getMeteorTargets: typeof getMeteorTargets;
    getFreezeTargets: typeof getFreezeTargets;
    getBlockadeTargets: typeof getBlockadeTargets;
    getCellTeleportTargets: typeof getCellTeleportTargets;
    getSniperTargets: typeof getSniperTargets;
    getTimeBombTargets: typeof getTimeBombTargets;
    getLightningTargets: typeof getLightningTargets;
    getCrossBombTargets: typeof getCrossBombTargets;
    getXBombTargets: typeof getXBombTargets;
    getReinforcementTargets: typeof getReinforcementTargets;
    getEqualityTargets: typeof getEqualityTargets;
    getCornerTributeTargets: typeof getCornerTributeTargets;
    getLastResortTargets: typeof getLastResortTargets;
};
export = _default;
//# sourceMappingURL=target-resolver.d.ts.map