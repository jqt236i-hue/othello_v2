type CardInteractionHandDomDeps = {
    normalizeOwnerKey: (ownerKey: any) => 'black' | 'white';
    ownerHelpersModule?: any;
    handAnimationUtilsModule?: any;
    getDocumentRef: () => Document | null;
    getWindowRef: () => (Window & typeof globalThis) | null;
};

export function createCardInteractionHandDom(deps: CardInteractionHandDomDeps) {
    function getOwnerHandContainers(ownerKey: any) {
        const documentRef = typeof deps.getDocumentRef === 'function' ? deps.getDocumentRef() : null;
        if (!documentRef) return [];
        const normalizedOwner = deps.normalizeOwnerKey(ownerKey);
        const handBlackEl = documentRef.getElementById('hand-black');
        const handWhiteEl = documentRef.getElementById('hand-white');
        const handElements = [handBlackEl, handWhiteEl].filter(Boolean);
        const ownerHelpersModule = deps.ownerHelpersModule;
        const ownerMatched = (ownerHelpersModule && typeof ownerHelpersModule.filterOwnerMatchedElements === 'function')
            ? ownerHelpersModule.filterOwnerMatchedElements(handElements, normalizedOwner)
            : handElements.filter((handEl: any) => {
                const handOwner = handEl && handEl.dataset && handEl.dataset.ownerKey
                    ? (handEl.dataset.ownerKey === 'white' ? 'white' : 'black')
                    : null;
                return handOwner === normalizedOwner;
            });
        if (ownerMatched.length > 0) return ownerMatched;
        const legacyHandId = normalizedOwner === 'white' ? 'hand-white' : 'hand-black';
        const legacyHandEl = documentRef.getElementById(legacyHandId);
        return legacyHandEl ? [legacyHandEl] : [];
    }

    function queryOwnerHandElements(ownerKey: any, selector: any) {
        if (!selector) return [];
        const documentRef = typeof deps.getDocumentRef === 'function' ? deps.getDocumentRef() : null;
        if (!documentRef) return [];
        const matches: any[] = [];
        getOwnerHandContainers(ownerKey).forEach((handEl: any) => {
            matches.push(...Array.from(handEl.querySelectorAll(selector)));
        });
        return matches;
    }

    function findCardElementInOwnerHand(cardId: any, ownerKey: any, handIndex?: any) {
        if (!cardId) return null;
        const documentRef = typeof deps.getDocumentRef === 'function' ? deps.getDocumentRef() : null;
        if (!documentRef) return null;
        const normalizedOwner = deps.normalizeOwnerKey(ownerKey);
        const ownerHelpersModule = deps.ownerHelpersModule;
        const ownerMatched = queryOwnerHandElements(normalizedOwner, `.card-item[data-card-id="${cardId}"]`).filter((candidate) => {
            const cardOwner = (ownerHelpersModule && typeof ownerHelpersModule.getElementOwnerKey === 'function')
                ? (ownerHelpersModule.getElementOwnerKey(candidate) || normalizedOwner)
                : (candidate && candidate.dataset && candidate.dataset.ownerKey
                    ? (candidate.dataset.ownerKey === 'white' ? 'white' : 'black')
                    : normalizedOwner);
            return cardOwner === normalizedOwner;
        });

        if (ownerMatched.length > 0) {
            const requestedIndex = Number(handIndex);
            if (Number.isInteger(requestedIndex) && requestedIndex >= 0) {
                const indexed = ownerMatched.find((el) => Number(el && el.dataset ? el.dataset.handIndex : NaN) === Math.trunc(requestedIndex));
                if (indexed) return indexed;
            }
            const visible = ownerMatched.find((el) => !el.classList.contains('hidden'));
            return visible || ownerMatched[0];
        }

        return null;
    }

    function settleLingeringHandFadeForOwner(ownerKey: any) {
        const normalizedOwner = deps.normalizeOwnerKey(ownerKey);
        const handAnimationUtilsModule = deps.handAnimationUtilsModule;
        if (handAnimationUtilsModule && typeof handAnimationUtilsModule.settleOwnerHandFadeIn === 'function') {
            handAnimationUtilsModule.settleOwnerHandFadeIn(normalizedOwner);
            return;
        }
        queryOwnerHandElements(normalizedOwner, '.card-item.card-fade-prep, .card-item.card-fade-in').forEach((cardEl) => {
            cardEl.classList.remove('card-fade-prep');
            cardEl.classList.remove('card-fade-in');
            cardEl.style.removeProperty('--card-fade-in-duration');
        });
        try {
            const windowRef = typeof deps.getWindowRef === 'function' ? deps.getWindowRef() : null;
            if (!windowRef) return;
            const activeState = (windowRef.__handFadeInState && typeof windowRef.__handFadeInState === 'object')
                ? windowRef.__handFadeInState
                : null;
            const activeHint = (windowRef.__handFadeInHint && typeof windowRef.__handFadeInHint === 'object')
                ? windowRef.__handFadeInHint
                : null;
            const activeStateOwner = activeState && (activeState.playerKey === 'white' || activeState.playerKey === 'black')
                ? activeState.playerKey
                : null;
            const activeHintOwner = activeHint && (activeHint.playerKey === 'white' || activeHint.playerKey === 'black')
                ? activeHint.playerKey
                : null;
            if (activeStateOwner === normalizedOwner) {
                windowRef.__handFadeInState = null;
            }
            if (activeHintOwner === normalizedOwner) {
                windowRef.__handFadeInHint = null;
            }
        } catch (e) { /* ignore */ }
    }

    return {
        getOwnerHandContainers,
        queryOwnerHandElements,
        findCardElementInOwnerHand,
        settleLingeringHandFadeForOwner
    };
}

module.exports = {
    createCardInteractionHandDom
};
