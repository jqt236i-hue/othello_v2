import type { CardStateDeckHandServices, CardMarkerProtectionServices, CardResolutionServices } from '../card-runtime-contracts';

type CardDomainAccessorDependencies = {
    CardDeckSetupModule: CardStateDeckHandServices['deckSetup'];
    DeckSpecHelpers: CardStateDeckHandServices['deckSpec'];
    CardStateManager: CardStateDeckHandServices['stateManager'];
    ENABLED_CARD_ID_SET: ReadonlySet<string>;
    CardHandAccessModule: CardStateDeckHandServices['handAccess'];
    CardHandManagerModule: CardStateDeckHandServices['handManager'];
    defaultPrng: { shuffle: (array: any) => any; random: () => number; };
    getCardHandManagerContext: () => any;
    CardAvailabilityModule: CardStateDeckHandServices['availability'];
    BLACK: number;
    WHITE: number;
    createBoardViewForCard: (cardState: any, gameState: any) => any;
    hasStandardLegalMoveForPlayer: (cardState: any, gameState: any, playerKey: any) => boolean;
    getReinforcementWillTargets: (cardState: any, gameState: any, playerKey: any) => any;
    CardOfferBuildersModule: CardStateDeckHandServices['offerBuilders'];
    CARD_DEFS: readonly Readonly<Record<string, unknown>>[];
    HEAVEN_BLESSING_OFFER_COUNT: number;
    isInviolableSpecialCardId: (cardId: unknown) => boolean;
    CardEffectTargetCountsModule: CardStateDeckHandServices['targetCounts'];
    ensureMarkers: (cardState: any) => any;
    getSpecialMarkers: (cardState: any) => any;
    getBombMarkers: (cardState: any) => any;
    getMarkerRuleClass: (marker: any) => any;
    requireCardMarkersMethod: (name: 'canLossWillRevertMarker') => CardMarkerProtectionServices['markers']['canLossWillRevertMarker'];
    isInviolableCell: (cardState: any, row: any, col: any) => any;
    findManifestMarkerAt: (cardState: any, row: any, col: any, type?: any, owner?: any) => any;
    isFrozenCellForCard: (cardState: any, row: any, col: any) => any;
    hasBoardShapeCellForCard: (cardState: any, gameState: any, row: any, col: any) => any;
    ensureSalvationDestroyedLedger: (cardState: any) => any;
    CardSalvationEffectModule: CardStateDeckHandServices['salvationEffect'];
    readCardPendingEffect: (cardState: any, playerKey: any) => any;
    clearCardPendingEffect: (cardState: any, playerKey: any, options?: any) => boolean;
    resolveRandomBoardSpawnEffectUsage: (cardState: any, gameState: any, playerKey: any, requestedCount: any, prng: any, cause: any, reason: any, options?: any) => any;
    CardLossEffectModule: CardStateDeckHandServices['lossEffect'];
    emitPresentationEvent: (cardState: any, ev: any) => any;
    CardLivingWillModule: CardResolutionServices['livingWill'];
    getLivingWillModuleContext: () => any;
    EMPTY: number;
    CardFateEffectModule: CardStateDeckHandServices['fateEffect'];
};

/** Per-runtime lazy domain instances; no invocation state or whole CardLogic facade is retained. */
export function createCardDomainAccessors(deps: CardDomainAccessorDependencies) {
    const {
        CardDeckSetupModule,
        DeckSpecHelpers,
        CardStateManager,
        ENABLED_CARD_ID_SET,
        CardHandAccessModule,
        CardHandManagerModule,
        defaultPrng,
        getCardHandManagerContext,
        CardAvailabilityModule,
        BLACK,
        WHITE,
        createBoardViewForCard,
        hasStandardLegalMoveForPlayer,
        getReinforcementWillTargets,
        CardOfferBuildersModule,
        CARD_DEFS,
        HEAVEN_BLESSING_OFFER_COUNT,
        isInviolableSpecialCardId,
        CardEffectTargetCountsModule,
        ensureMarkers,
        getSpecialMarkers,
        getBombMarkers,
        getMarkerRuleClass,
        requireCardMarkersMethod,
        isInviolableCell,
        findManifestMarkerAt,
        isFrozenCellForCard,
        hasBoardShapeCellForCard,
        ensureSalvationDestroyedLedger,
        CardSalvationEffectModule,
        readCardPendingEffect,
        clearCardPendingEffect,
        resolveRandomBoardSpawnEffectUsage,
        CardLossEffectModule,
        emitPresentationEvent,
        CardLivingWillModule,
        getLivingWillModuleContext,
        EMPTY,
        CardFateEffectModule
    } = deps;
    let CardDeckSetupCache: any = null;
    let CardHandAccessCache: any = null;
    let CardAvailabilityCache: any = null;
    let CardOfferBuildersCache: any = null;
    let CardEffectTargetCountsCache: any = null;
    let CardSalvationEffectCache: any = null;
    let CardLossEffectCache: any = null;
    let CardFateEffectCache: any = null;

    function getCardDeckSetup() {
        if (CardDeckSetupCache) return CardDeckSetupCache;
        if (!CardDeckSetupModule || typeof CardDeckSetupModule.createCardDeckSetup !== 'function') {
            return null;
        }
        CardDeckSetupCache = CardDeckSetupModule.createCardDeckSetup({
            DeckSpecHelpers,
            CardStateManager,
            enabledCardIdSet: ENABLED_CARD_ID_SET
        });
        return CardDeckSetupCache;
    }

    function requireCardDeckSetup() {
        const cardDeckSetup = getCardDeckSetup();
        if (!cardDeckSetup) {
            throw new Error('[cards.js] CardDeckSetup not available');
        }
        return cardDeckSetup;
    }

    function getCardHandAccess() {
        if (CardHandAccessCache) return CardHandAccessCache;
        if (!CardHandAccessModule || typeof CardHandAccessModule.createCardHandAccess !== 'function') {
            return null;
        }
        CardHandAccessCache = CardHandAccessModule.createCardHandAccess({
            CardHandManagerModule,
            CardStateManager,
            defaultPrng,
            getCardHandManagerContext
        });
        return CardHandAccessCache;
    }

    function requireCardHandAccess() {
        const cardHandAccess = getCardHandAccess();
        if (!cardHandAccess) {
            throw new Error('[cards.js] CardHandAccess not available');
        }
        return cardHandAccess;
    }

    function getCardAvailability() {
        if (CardAvailabilityCache) return CardAvailabilityCache;
        if (!CardAvailabilityModule || typeof CardAvailabilityModule.createCardAvailability !== 'function') {
            return null;
        }
        CardAvailabilityCache = CardAvailabilityModule.createCardAvailability({
            constants: { BLACK, WHITE },
            createBoardViewForCard,
            hasStandardLegalMoveForPlayer,
            getReinforcementWillTargets
        });
        return CardAvailabilityCache;
    }

    function requireCardAvailability() {
        const cardAvailability = getCardAvailability();
        if (!cardAvailability) {
            throw new Error('[cards.js] CardAvailability not available');
        }
        return cardAvailability;
    }

    function getCardOfferBuilders() {
        if (CardOfferBuildersCache) return CardOfferBuildersCache;
        if (!CardOfferBuildersModule || typeof CardOfferBuildersModule.createOfferBuilders !== 'function') {
            return null;
        }
        CardOfferBuildersCache = CardOfferBuildersModule.createOfferBuilders({
            cardDefs: CARD_DEFS,
            heavenBlessingOfferCount: HEAVEN_BLESSING_OFFER_COUNT,
            isInviolableSpecialCardId
        });
        return CardOfferBuildersCache;
    }

    function requireCardOfferBuilders() {
        const cardOfferBuilders = getCardOfferBuilders();
        if (!cardOfferBuilders) {
            throw new Error('[cards.js] CardOfferBuilders not available');
        }
        return cardOfferBuilders;
    }

    function getCardEffectTargetCounts() {
        if (CardEffectTargetCountsCache) return CardEffectTargetCountsCache;
        if (!CardEffectTargetCountsModule || typeof CardEffectTargetCountsModule.createEffectTargetCounts !== 'function') {
            return null;
        }
        CardEffectTargetCountsCache = CardEffectTargetCountsModule.createEffectTargetCounts({
            ensureMarkers,
            getSpecialMarkers,
            getBombMarkers,
            getMarkerRuleClass,
            canLossWillRevertMarker: requireCardMarkersMethod('canLossWillRevertMarker'),
            isInviolableCell,
            findManifestMarkerAt,
            isFrozenCellForCard,
            hasBoardShapeCellForCard,
            ensureSalvationDestroyedLedger
        });
        return CardEffectTargetCountsCache;
    }

    function requireCardEffectTargetCounts() {
        const cardEffectTargetCounts = getCardEffectTargetCounts();
        if (!cardEffectTargetCounts) {
            throw new Error('[cards.js] CardEffectTargetCounts not available');
        }
        return cardEffectTargetCounts;
    }

    function getCardSalvationEffect() {
        if (CardSalvationEffectCache) return CardSalvationEffectCache;
        if (!CardSalvationEffectModule || typeof CardSalvationEffectModule.createCardSalvationEffect !== 'function') {
            return null;
        }
        CardSalvationEffectCache = CardSalvationEffectModule.createCardSalvationEffect({
            readCardPendingEffect,
            ensureSalvationDestroyedLedger,
            clearCardPendingEffect,
            resolveRandomBoardSpawnEffectUsage
        });
        return CardSalvationEffectCache;
    }

    function requireCardSalvationEffect() {
        const cardSalvationEffect = getCardSalvationEffect();
        if (!cardSalvationEffect) {
            throw new Error('[cards.js] CardSalvationEffect not available');
        }
        return cardSalvationEffect;
    }

    function getCardLossEffect() {
        if (CardLossEffectCache) return CardLossEffectCache;
        if (!CardLossEffectModule || typeof CardLossEffectModule.createCardLossEffect !== 'function') {
            return null;
        }
        CardLossEffectCache = CardLossEffectModule.createCardLossEffect({
            readCardPendingEffect,
            clearCardPendingEffect,
            collectLossWillRemovals: (cardState: any) => requireCardEffectTargetCounts().collectLossWillRemovals(cardState),
            createBoardViewForCard,
            emitPresentationEvent,
            findLivingWillMarkerAt: CardLivingWillModule && typeof CardLivingWillModule.findLivingWillMarkerAt === 'function'
                ? CardLivingWillModule.findLivingWillMarkerAt
                : null,
            restoreFromLivingWillSnapshot: CardLivingWillModule && typeof CardLivingWillModule.restoreFromLivingWillSnapshot === 'function'
                ? CardLivingWillModule.restoreFromLivingWillSnapshot
                : null,
            getLivingWillModuleContext,
            emptyValue: EMPTY
        });
        return CardLossEffectCache;
    }

    function requireCardLossEffect() {
        const cardLossEffect = getCardLossEffect();
        if (!cardLossEffect) {
            throw new Error('[cards.js] CardLossEffect not available');
        }
        return cardLossEffect;
    }

    function getCardFateEffect() {
        if (CardFateEffectCache) return CardFateEffectCache;
        if (!CardFateEffectModule || typeof CardFateEffectModule.createCardFateEffect !== 'function') {
            return null;
        }
        CardFateEffectCache = CardFateEffectModule.createCardFateEffect({
            readCardPendingEffect,
            clearCardPendingEffect
        });
        return CardFateEffectCache;
    }

    function requireCardFateEffect() {
        const cardFateEffect = getCardFateEffect();
        if (!cardFateEffect) {
            throw new Error('[cards.js] CardFateEffect not available');
        }
        return cardFateEffect;
    }

    return { getCardDeckSetup, requireCardDeckSetup, getCardHandAccess, requireCardHandAccess, getCardAvailability, requireCardAvailability, getCardOfferBuilders, requireCardOfferBuilders, getCardEffectTargetCounts, requireCardEffectTargetCounts, getCardSalvationEffect, requireCardSalvationEffect, getCardLossEffect, requireCardLossEffect, getCardFateEffect, requireCardFateEffect };
}
