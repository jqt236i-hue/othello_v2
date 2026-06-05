type OfferBuildersDeps = {
    cardDefs?: any[];
    heavenBlessingOfferCount?: number;
    isInviolableSpecialCardId?: (cardId: unknown) => boolean;
};

function createDeterministicRandomSource(seedText: any) {
    const text = String(seedText || '');
    let state = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
        state ^= text.charCodeAt(i);
        state = Math.imul(state, 16777619) >>> 0;
    }
    return {
        random: function () {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 0x100000000;
        }
    };
}

export function createOfferBuilders(deps?: OfferBuildersDeps) {
    const cardDefs = Array.isArray(deps?.cardDefs) ? deps?.cardDefs : [];
    const heavenBlessingOfferCount = Number.isFinite(Number(deps?.heavenBlessingOfferCount))
        ? Math.max(1, Math.trunc(Number(deps?.heavenBlessingOfferCount)))
        : 5;
    const isInviolableSpecialCardId = typeof deps?.isInviolableSpecialCardId === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    function buildHeavenBlessingSeedHint(cardState: any, playerKey: any) {
        const normalizedPlayerKey = playerKey === 'white' ? 'white' : 'black';
        return `${normalizedPlayerKey}|${cardState && Number.isFinite(Number(cardState.turnIndex)) ? Number(cardState.turnIndex) : 0}|${(cardState && cardState.hands && Array.isArray(cardState.hands[normalizedPlayerKey])) ? cardState.hands[normalizedPlayerKey].length : 0}|${(cardState && cardState.charge && Number.isFinite(cardState.charge[normalizedPlayerKey])) ? cardState.charge[normalizedPlayerKey] : 0}`;
    }

    function buildHeavenBlessingOffers(cardIdToExclude: any, prng: any, seedHint: any) {
        const pool = cardDefs
            .filter((c: any) => c && c.enabled !== false && c.id && c.id !== cardIdToExclude)
            .map((c: any) => c.id)
            .filter((cardId: any) => !isInviolableSpecialCardId(cardId));
        if (pool.length === 0) return [];

        const randomSource = (prng && typeof prng.random === 'function')
            ? prng
            : createDeterministicRandomSource(`heaven:${String(cardIdToExclude || '')}:${String(seedHint || '')}:${pool.length}`);
        const out = [];
        while (pool.length > 0 && out.length < heavenBlessingOfferCount) {
            const idx = Math.floor(randomSource.random() * pool.length);
            out.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return out;
    }

    function buildCondemnOffers(cardState: any, playerKey: any) {
        if (!cardState || !cardState.hands) return [];
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[opponentKey]) ? cardState.hands[opponentKey] : [];
        return hand
            .map((cardId: any, handIndex: any) => ({ handIndex, cardId }))
            .filter((offer: any) => !isInviolableSpecialCardId(offer.cardId));
    }

    return {
        buildHeavenBlessingSeedHint,
        buildHeavenBlessingOffers,
        buildCondemnOffers
    };
}
