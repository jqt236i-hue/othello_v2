type CardDeckSetupDeps = {
    DeckSpecHelpers?: any;
    CardStateManager?: any;
    enabledCardIdSet?: Set<string>;
};

export function createCardDeckSetup(deps?: CardDeckSetupDeps) {
    const deckSpecHelpers = deps?.DeckSpecHelpers || null;
    const cardStateManager = deps?.CardStateManager || null;
    const enabledCardIdSet = deps?.enabledCardIdSet instanceof Set ? deps.enabledCardIdSet : new Set<string>();

    function getDefaultDeckSize() {
        if (deckSpecHelpers && typeof deckSpecHelpers.getDefaultDeckSize === 'function') {
            return deckSpecHelpers.getDefaultDeckSize();
        }
        return 30;
    }

    function buildDefaultDeckCardIds(prng: any) {
        if (!cardStateManager || typeof cardStateManager.createDefaultDeck !== 'function') {
            throw new Error('[cards.js] CardStateManager.createDefaultDeck not available');
        }
        return cardStateManager.createDefaultDeck(prng);
    }

    function expandInitialDeckSpec(deckSpec: any) {
        if (!deckSpec) return null;
        if (!deckSpecHelpers || typeof deckSpecHelpers.expandDeckSpec !== 'function') {
            throw new Error('DeckSpecHelpers is required for custom deck initialization');
        }
        return deckSpecHelpers.expandDeckSpec(deckSpec, { requireFullDeck: false });
    }

    function normalizeInitialDeckCardIds(deckCardIds: any) {
        if (!Array.isArray(deckCardIds)) return null;
        return deckCardIds.map((cardId: any, index: any) => {
            const normalizedCardId = String(cardId || '').trim();
            if (!normalizedCardId || !enabledCardIdSet.has(normalizedCardId)) {
                throw new Error(`Invalid initial deck card id at index ${index}: ${normalizedCardId || '(empty)'}`);
            }
            return normalizedCardId;
        });
    }

    function resolveExplicitInitialDeckCardIds(options: any, playerKey: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const deckCardIdsByPlayer = (opts.initialDeckCardIdsByPlayer && typeof opts.initialDeckCardIdsByPlayer === 'object')
            ? opts.initialDeckCardIdsByPlayer
            : null;
        const playerDeckCardIds = deckCardIdsByPlayer && Array.isArray(deckCardIdsByPlayer[playerKey])
            ? deckCardIdsByPlayer[playerKey]
            : null;
        const deckCardIds = playerDeckCardIds || (Array.isArray(opts.initialDeckCardIds) ? opts.initialDeckCardIds : null);
        if (deckCardIds) {
            return normalizeInitialDeckCardIds(deckCardIds);
        }

        const byPlayer = (opts.initialDeckSpecByPlayer && typeof opts.initialDeckSpecByPlayer === 'object')
            ? opts.initialDeckSpecByPlayer
            : null;
        const playerDeckSpec = byPlayer ? byPlayer[playerKey] : null;
        const deckSpec = playerDeckSpec || opts.initialDeckSpec || null;

        return deckSpec ? expandInitialDeckSpec(deckSpec) : null;
    }

    function resolveInitialDeckCardIdsByPlayer(options: any, prng: any) {
        const blackExplicitDeck = resolveExplicitInitialDeckCardIds(options, 'black');
        const whiteExplicitDeck = resolveExplicitInitialDeckCardIds(options, 'white');
        const sharedDefaultDeck = (!blackExplicitDeck && !whiteExplicitDeck)
            ? buildDefaultDeckCardIds(prng)
            : null;

        return {
            black: blackExplicitDeck
                ? blackExplicitDeck.slice()
                : (sharedDefaultDeck ? sharedDefaultDeck.slice() : buildDefaultDeckCardIds(prng)),
            white: whiteExplicitDeck
                ? whiteExplicitDeck.slice()
                : (sharedDefaultDeck ? sharedDefaultDeck.slice() : buildDefaultDeckCardIds(prng))
        };
    }

    return {
        getDefaultDeckSize,
        buildDefaultDeckCardIds,
        expandInitialDeckSpec,
        normalizeInitialDeckCardIds,
        resolveExplicitInitialDeckCardIds,
        resolveInitialDeckCardIdsByPlayer
    };
}
