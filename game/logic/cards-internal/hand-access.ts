type HandAccessDeps = {
    CardHandManagerModule?: any;
    CardStateManager?: any;
    defaultPrng?: any;
    getCardHandManagerContext?: () => any;
};

function requireHandManagerMethod(moduleRef: any, name: string) {
    const fn = moduleRef && moduleRef[name];
    if (typeof fn !== 'function') {
        throw new Error(`[cards.js] CardHandManager.${name} not available`);
    }
    return fn;
}

function requireStateManagerMethod(moduleRef: any, name: string) {
    const fn = moduleRef && moduleRef[name];
    if (typeof fn !== 'function') {
        throw new Error(`[cards.js] CardStateManager.${name} not available`);
    }
    return fn;
}

export function createCardHandAccess(deps?: HandAccessDeps) {
    const cardHandManagerModule = deps?.CardHandManagerModule || null;
    const cardStateManager = deps?.CardStateManager || null;
    const defaultPrng = deps?.defaultPrng;
    const getCardHandManagerContext = typeof deps?.getCardHandManagerContext === 'function'
        ? deps.getCardHandManagerContext
        : (() => null);

    function dealInitialHands(cardState: any, prng: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'dealInitialHands')(
            cardState,
            prng || defaultPrng,
            getCardHandManagerContext()
        );
    }

    function commitDraw(cardState: any, playerKey: any, prng: any) {
        return requireStateManagerMethod(cardStateManager, 'drawCard')(
            cardState,
            playerKey,
            prng || defaultPrng
        );
    }

    function ensureCardCopyState(cardState: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'ensureCardCopyState')(
            cardState,
            getCardHandManagerContext()
        );
    }

    function getHandCopyIdAt(cardState: any, playerKey: any, handIndex: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getHandCopyIdAt')(
            cardState,
            playerKey,
            handIndex,
            getCardHandManagerContext()
        );
    }

    function getHandCopyIds(cardState: any, playerKey: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getHandCopyIds')(
            cardState,
            playerKey,
            getCardHandManagerContext()
        );
    }

    function isCardCopyIdRevealedToViewer(cardState: any, viewerKey: any, cardCopyId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'isCardCopyIdRevealedToViewer')(
            cardState,
            viewerKey,
            cardCopyId,
            getCardHandManagerContext()
        );
    }

    function revealCurrentHandToViewer(cardState: any, viewerKey: any, ownerKey: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'revealCurrentHandToViewer')(
            cardState,
            viewerKey,
            ownerKey,
            getCardHandManagerContext()
        );
    }

    function addCardToHand(cardState: any, playerKey: any, cardId: any, opts?: any) {
        return requireStateManagerMethod(cardStateManager, 'addToHand')(
            cardState,
            playerKey,
            cardId,
            opts
        );
    }

    function addCardToDiscard(cardState: any, cardId: any, cardCopyId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'addCardToDiscard')(
            cardState,
            cardId,
            cardCopyId,
            getCardHandManagerContext()
        );
    }

    function removeHandCardAt(cardState: any, playerKey: any, handIndex: any) {
        return requireStateManagerMethod(cardStateManager, 'removeFromHand')(
            cardState,
            playerKey,
            handIndex
        );
    }

    function clearHandToDiscard(cardState: any, playerKey: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'clearHandToDiscard')(
            cardState,
            playerKey,
            getCardHandManagerContext()
        );
    }

    function moveDiscardCardToHandByCardId(cardState: any, playerKey: any, cardId: any, opts: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'moveDiscardCardToHandByCardId')(
            cardState,
            playerKey,
            cardId,
            getCardHandManagerContext(),
            opts
        );
    }

    function getCardDef(cardId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getCardDef')(
            cardId,
            getCardHandManagerContext()
        );
    }

    function getCardType(cardId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getCardType')(
            cardId,
            getCardHandManagerContext()
        );
    }

    function getCardDisplayName(cardId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getCardDisplayName')(
            cardId,
            getCardHandManagerContext()
        );
    }

    function getCardCodeName(displayName: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getCardCodeName')(
            displayName,
            getCardHandManagerContext()
        );
    }

    function getCardCost(cardId: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getCardCost')(
            cardId,
            getCardHandManagerContext()
        );
    }

    function canUseCard(cardState: any, playerKey: any, cardId: any, opts?: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'canUseCard')(
            cardState,
            playerKey,
            cardId,
            getCardHandManagerContext(),
            opts
        );
    }

    function ensureHandDestroyFlags(cardState: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'ensureHandDestroyFlags')(
            cardState,
            getCardHandManagerContext()
        );
    }

    function destroyHandCard(cardState: any, playerKey: any, cardId: any, opts: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'destroyHandCard')(
            cardState,
            playerKey,
            cardId,
            opts,
            getCardHandManagerContext()
        );
    }

    function getUsableCardIds(cardState: any, gameState: any, playerKey: any, opts?: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'getUsableCardIds')(
            cardState,
            gameState,
            playerKey,
            getCardHandManagerContext(),
            opts
        );
    }

    function hasUsableCard(cardState: any, gameState: any, playerKey: any) {
        return requireHandManagerMethod(cardHandManagerModule, 'hasUsableCard')(
            cardState,
            gameState,
            playerKey,
            getCardHandManagerContext()
        );
    }

    return {
        dealInitialHands,
        commitDraw,
        ensureCardCopyState,
        getHandCopyIdAt,
        getHandCopyIds,
        isCardCopyIdRevealedToViewer,
        revealCurrentHandToViewer,
        addCardToHand,
        addCardToDiscard,
        removeHandCardAt,
        clearHandToDiscard,
        moveDiscardCardToHandByCardId,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        canUseCard,
        ensureHandDestroyFlags,
        destroyHandCard,
        getUsableCardIds,
        hasUsableCard
    };
}
