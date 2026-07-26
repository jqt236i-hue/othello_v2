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
    const WHITE = deps?.constants?.WHITE;
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

    function getEqualityWillBoardCounts(cardState: any, gameState: any) {
        return countDiscsForCardComparison(cardState, gameState);
    }

    function normalizePlayerKey(playerKey: any) {
        return playerKey === 'white' || playerKey === WHITE ? 'white' : 'black';
    }

    function readCharge(cardState: any, playerKey: any) {
        const normalized = normalizePlayerKey(playerKey);
        const raw = Number(cardState && cardState.charge && cardState.charge[normalized]);
        return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    }

    function getEqualityWillChargeState(cardState: any, playerKey: any) {
        const normalized = normalizePlayerKey(playerKey);
        const opponentKey = normalized === 'white' ? 'black' : 'white';
        return {
            own: readCharge(cardState, normalized),
            opponent: readCharge(cardState, opponentKey)
        };
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

    function canUseEqualityWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        void gameState;
        return getEqualityWillChargeState(cardState, playerKey).own === 0;
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
        getEqualityWillBoardCounts,
        getEqualityWillChargeState,
        hasFewerDiscsThanOpponentForPlayer,
        canUseLastResortForPlayer,
        canUseEqualityWillForPlayer,
        getReinforcementWillTargetCount,
        getSupportTroopsWillTargetCount
    };
}
