type CardAvailabilityDeps = {
    constants?: {
        BLACK?: any;
        WHITE?: any;
    };
    resolveCoreLogicForCards?: () => any;
    getExpansionDescriptorsForCard?: (gameState: any) => any[];
    hasStandardLegalMoveForPlayer?: (cardState: any, gameState: any, playerKey: any) => boolean;
    getReinforcementWillTargets?: (cardState: any, gameState: any, playerKey: any) => any[];
};

export function createCardAvailability(deps?: CardAvailabilityDeps) {
    const BLACK = deps?.constants?.BLACK;
    const WHITE = deps?.constants?.WHITE;
    const resolveCoreLogicForCards = typeof deps?.resolveCoreLogicForCards === 'function'
        ? deps.resolveCoreLogicForCards
        : (() => null);
    const getExpansionDescriptorsForCard = typeof deps?.getExpansionDescriptorsForCard === 'function'
        ? deps.getExpansionDescriptorsForCard
        : (() => []);
    const hasStandardLegalMoveForPlayer = typeof deps?.hasStandardLegalMoveForPlayer === 'function'
        ? deps.hasStandardLegalMoveForPlayer
        : null;
    const getReinforcementWillTargets = typeof deps?.getReinforcementWillTargets === 'function'
        ? deps.getReinforcementWillTargets
        : null;

    function countDiscsForCardComparison(gameState: any) {
        const fallback = { black: 0, white: 0 };
        if (!gameState || !Array.isArray(gameState.board)) return fallback;

        const core = resolveCoreLogicForCards();
        if (core && typeof core.countDiscs === 'function') {
            try {
                const counted = core.countDiscs(gameState);
                if (
                    counted &&
                    Number.isFinite(Number(counted.black)) &&
                    Number.isFinite(Number(counted.white))
                ) {
                    return {
                        black: Number(counted.black),
                        white: Number(counted.white)
                    };
                }
            } catch (e) {
                // fall through
            }
        }

        let black = 0;
        let white = 0;
        for (let row = 0; row < gameState.board.length; row++) {
            const line = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === BLACK) black += 1;
                else if (line[col] === WHITE) white += 1;
            }
        }

        const expansions = getExpansionDescriptorsForCard(gameState);
        for (const expansion of expansions) {
            if (!expansion) continue;
            if (expansion.owner === BLACK) black += 1;
            else if (expansion.owner === WHITE) white += 1;
        }

        return { black, white };
    }

    function getDiscDisadvantageForPlayer(gameState: any, playerKey: any) {
        const counts = countDiscsForCardComparison(gameState);
        if (playerKey === 'white') return counts.black - counts.white;
        return counts.white - counts.black;
    }

    function getEqualityWillBoardCounts(gameState: any) {
        return countDiscsForCardComparison(gameState);
    }

    function hasFewerDiscsThanOpponentForPlayer(gameState: any, playerKey: any) {
        return getDiscDisadvantageForPlayer(gameState, playerKey) > 0;
    }

    function canUseLastResortForPlayer(cardState: any, gameState: any, playerKey: any) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        if (!hasStandardLegalMoveForPlayer) return false;
        if (hasStandardLegalMoveForPlayer(cardState, gameState, playerKey)) return false;
        return hasFewerDiscsThanOpponentForPlayer(gameState, playerKey);
    }

    function canUseEqualityWillForPlayer(cardState: any, gameState: any, playerKey: any) {
        void cardState;
        if (!gameState || !Array.isArray(gameState.board)) return false;
        return getDiscDisadvantageForPlayer(gameState, playerKey) >= 10;
    }

    function getReinforcementWillTargetCount(cardState: any, gameState: any, playerKey: any) {
        if (!getReinforcementWillTargets) return 0;
        return getReinforcementWillTargets(cardState, gameState, playerKey).length;
    }

    return {
        countDiscsForCardComparison,
        getDiscDisadvantageForPlayer,
        getEqualityWillBoardCounts,
        hasFewerDiscsThanOpponentForPlayer,
        canUseLastResortForPlayer,
        canUseEqualityWillForPlayer,
        getReinforcementWillTargetCount
    };
}
