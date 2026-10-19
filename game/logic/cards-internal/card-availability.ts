type CardAvailabilityDeps = {
    constants?: {
        BLACK?: any;
        WHITE?: any;
    };
    createBoardViewForCard?: (cardState: any, gameState: any) => any;
    hasStandardLegalMoveForPlayer?: (cardState: any, gameState: any, playerKey: any) => boolean;
    getReinforcementWillTargets?: (cardState: any, gameState: any, playerKey: any) => any[];
};

export function createCardAvailability(deps?: CardAvailabilityDeps) {
    const createBoardViewForCard = typeof deps?.createBoardViewForCard === 'function'
        ? deps.createBoardViewForCard
        : null;
    const hasStandardLegalMoveForPlayer = typeof deps?.hasStandardLegalMoveForPlayer === 'function'
        ? deps.hasStandardLegalMoveForPlayer
        : null;
    const getReinforcementWillTargets = typeof deps?.getReinforcementWillTargets === 'function'
        ? deps.getReinforcementWillTargets
        : null;

    function requireBoardView(cardState: any, gameState: any): any {
        if (!createBoardViewForCard) {
            throw new Error('[card-availability] createBoardViewForCard is required');
        }
        return createBoardViewForCard(cardState, gameState);
    }

    function countDiscsForCardComparison(cardState: any, gameState: any) {
        const counted = requireBoardView(cardState, gameState).count();
        return {
            black: Number(counted.black),
            white: Number(counted.white)
        };
    }

    function getDiscDisadvantageForPlayer(cardState: any, gameState: any, playerKey: any) {
        const counts = countDiscsForCardComparison(cardState, gameState);
        if (playerKey === 'white') return counts.black - counts.white;
        return counts.white - counts.black;
    }

    function hasFewerDiscsThanOpponentForPlayer(cardState: any, gameState: any, playerKey: any) {
        return getDiscDisadvantageForPlayer(cardState, gameState, playerKey) > 0;
    }

    function canUseLastResortForPlayer(cardState: any, gameState: any, playerKey: any) {
        requireBoardView(cardState, gameState);
        if (!hasStandardLegalMoveForPlayer) return false;
        if (hasStandardLegalMoveForPlayer(cardState, gameState, playerKey)) return false;
        return hasFewerDiscsThanOpponentForPlayer(cardState, gameState, playerKey);
    }

    function getReinforcementWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        if (!getReinforcementWillTargets) return 0;
        return getReinforcementWillTargets(cardState, gameState, playerKey).length;
    }

    function getSupportTroopsWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        if (!getReinforcementWillTargets) return 0;
        return getReinforcementWillTargets(cardState, gameState, playerKey).length;
    }

    return {
        countDiscsForCardComparison,
        getDiscDisadvantageForPlayer,
        hasFewerDiscsThanOpponentForPlayer,
        canUseLastResortForPlayer,
        getReinforcementWillTargetCount,
        getSupportTroopsWillTargetCount
    };
}
