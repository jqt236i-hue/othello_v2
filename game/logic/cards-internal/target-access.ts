export {};

type TargetAccessDeps = {
    CardTargetsModule: any;
    CardSelectorsModule: any;
    TargetResolver: any;
    CardExpansionModule: any;
    CardShrinkModule: any;
    readCardPendingEffect: (cardState: any, playerKey: any) => any;
};

function resolveTargetResolverTargets(methodName: string, args: any[], deps: TargetAccessDeps) {
    const resolver = deps.TargetResolver;
    if (resolver && typeof resolver[methodName] === 'function') {
        return resolver[methodName].apply(resolver, args);
    }
    return [];
}

function getTemptWillTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardTargetsModule.getTemptWillTargets(cardState, gameState, playerKey);
}

function getCaptureWillTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardTargetsModule.getCaptureWillTargets(cardState, gameState, playerKey);
}

function getTemptTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getTemptTargets', [cardState, gameState, playerKey], deps);
}

function getCaptureTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCaptureTargets', [cardState, gameState, playerKey], deps);
}

function getDestroyTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getDestroyTargets', [cardState, gameState], deps);
}

function getReverseWillTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getReverseWillTargets', [cardState, gameState], deps);
}

function getSwapTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getSwapTargets', [cardState, gameState, playerKey], deps);
}

function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getPositionSwapTargets', [cardState, gameState, playerKey, pending], deps);
}

function getBreedingTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getBreedingTargets', [cardState, gameState, playerKey], deps);
}

function getSniperTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getSniperTargets', [cardState, gameState, playerKey], deps);
}

function getLightningTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getLightningTargets', [cardState, gameState, playerKey], deps);
}

function getCrossBombTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCrossBombTargets', [cardState, gameState, playerKey], deps);
}

function getXBombTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getXBombTargets', [cardState, gameState, playerKey], deps);
}

function getReinforcementTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getReinforcementTargets', [cardState, gameState, playerKey], deps);
}

function getEqualityTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getEqualityTargets', [cardState, gameState, playerKey], deps);
}

function getCornerTributeTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCornerTributeTargets', [cardState, gameState, playerKey], deps);
}

function getLastResortTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getLastResortTargets', [cardState, gameState, playerKey], deps);
}

function getTrapTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getTrapTargets', [cardState, gameState, playerKey], deps);
}

function getGuardTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getGuardTargets', [cardState, gameState, playerKey], deps);
}

function getLivingWillTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getLivingWillTargets(cardState, gameState, playerKey);
}

function getHyperactiveInheritTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getHyperactiveInheritTargets(cardState, gameState, playerKey);
}

function getExtendLifeTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getExtendLifeTargets(cardState, gameState, playerKey);
}

function getCorrosionTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getCorrosionTargets(cardState, gameState, playerKey);
}

function getTimeBombTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getTimeBombTargets', [cardState, gameState, playerKey], deps);
}

function getTeleportTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getTeleportTargets', [cardState, gameState], deps);
}

function getCloneTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCloneTargets', [cardState, gameState, playerKey], deps);
}

function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getBoardExpansionTargets', [cardState, gameState, playerKey], deps);
}

function getBoardExpansionGodCornerDescriptorsForCard(gameState: any, deps: TargetAccessDeps) {
    return deps.CardExpansionModule.getBoardExpansionGodCornerDescriptorsForCard(gameState);
}

function getBoardExpansionGodPendingSelectionsForCard(pending: any, deps: TargetAccessDeps) {
    return deps.CardExpansionModule.getBoardExpansionGodPendingSelectionsForCard(pending);
}

function getBoardExpansionGodAdditionsForCard(row: any, col: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardExpansionModule.getBoardExpansionGodAdditionsForCard(row, col, gameState);
}

function getBoardExpansionWillCellDescriptorsForCard(gameState: any, deps: TargetAccessDeps) {
    return deps.CardExpansionModule.getBoardExpansionWillCellDescriptorsForCard(gameState);
}

function ensureExpansionCellForCard(gameState: any, row: any, col: any, owner: any, deps: TargetAccessDeps) {
    return deps.CardExpansionModule.ensureExpansionCellForCard(gameState, row, col, owner);
}

function getBoardExpansionGodTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getBoardExpansionGodTargets(cardState, gameState, playerKey);
}

function getBoardExpansionGodRequiredSelectionCount(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    const selectedCount = getBoardExpansionGodPendingSelectionsForCard(pending, deps).length;
    const availableCount = getBoardExpansionGodTargets(cardState, gameState, playerKey, deps).length;
    const totalSelectableCount = selectedCount + availableCount;
    if (totalSelectableCount <= 0) return 0;
    return Math.min(2, totalSelectableCount);
}

function getBoardShrinkSelectionCount(deps: TargetAccessDeps) {
    return Math.max(1, Math.trunc(Number(deps.CardShrinkModule.BOARD_SHRINK_SELECTION_COUNT)));
}

function getBoardShrinkPendingSelectionsForCard(pending: any, deps: TargetAccessDeps) {
    return deps.CardShrinkModule.getBoardShrinkPendingSelectionsForCard(pending);
}

function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getBoardShrinkTargets', [cardState, gameState, playerKey], deps);
}

function getBoardShrinkGodTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getBoardShrinkGodTargets(cardState, gameState, playerKey);
}

function getCellTeleportDestinations(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getCellTeleportDestinations(cardState, gameState);
}

function getCellTeleportTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCellTeleportTargets', [cardState, gameState], deps);
}

function getBlockadeTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getBlockadeTargets', [cardState, gameState, playerKey], deps);
}

function getMeteorTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getMeteorTargets', [cardState, gameState, playerKey], deps);
}

function getFreezeTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getFreezeTargets', [cardState, gameState, playerKey], deps);
}

function getSeedTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getSeedTargets', [cardState, gameState, playerKey], deps);
}

function getStrongWindTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getStrongWindTargets(cardState, gameState);
}

function getSuperBuoyancyTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getSuperBuoyancyTargets(cardState, gameState);
}

function getBuoyancyTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getBuoyancyTargets(cardState, gameState);
}

function getSuperGravityTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getSuperGravityTargets(cardState, gameState);
}

function getSuperAttractionTargets(cardState: any, gameState: any, playerKey: any, pending: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getSuperAttractionTargets(cardState, gameState, playerKey, pending);
}

function getSuperAttractionPathPreview(cardState: any, gameState: any, from: any, to: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getSuperAttractionPathPreview(cardState, gameState, from, to);
}

function getGravityTargets(cardState: any, gameState: any, deps: TargetAccessDeps) {
    return deps.CardSelectorsModule.getGravityTargets(cardState, gameState);
}

function getSelectableTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getSelectableTargets', [cardState, gameState, playerKey], deps);
}

module.exports = {
    getTemptWillTargets,
    getCaptureWillTargets,
    getTemptTargets,
    getCaptureTargets,
    getDestroyTargets,
    getReverseWillTargets,
    getSwapTargets,
    getPositionSwapTargets,
    getBreedingTargets,
    getSniperTargets,
    getLightningTargets,
    getCrossBombTargets,
    getXBombTargets,
    getReinforcementTargets,
    getEqualityTargets,
    getCornerTributeTargets,
    getLastResortTargets,
    getTrapTargets,
    getGuardTargets,
    getLivingWillTargets,
    getHyperactiveInheritTargets,
    getExtendLifeTargets,
    getCorrosionTargets,
    getTimeBombTargets,
    getTeleportTargets,
    getCloneTargets,
    getBoardExpansionTargets,
    getBoardExpansionGodCornerDescriptorsForCard,
    getBoardExpansionGodPendingSelectionsForCard,
    getBoardExpansionGodAdditionsForCard,
    getBoardExpansionWillCellDescriptorsForCard,
    ensureExpansionCellForCard,
    getBoardExpansionGodTargets,
    getBoardExpansionGodRequiredSelectionCount,
    getBoardShrinkSelectionCount,
    getBoardShrinkPendingSelectionsForCard,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getCellTeleportDestinations,
    getCellTeleportTargets,
    getBlockadeTargets,
    getMeteorTargets,
    getFreezeTargets,
    getSeedTargets,
    getStrongWindTargets,
    getSuperBuoyancyTargets,
    getBuoyancyTargets,
    getSuperGravityTargets,
    getSuperAttractionTargets,
    getSuperAttractionPathPreview,
    getGravityTargets,
    getSelectableTargets
};
