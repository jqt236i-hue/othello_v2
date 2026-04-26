(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardStateFactory = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const FALLBACK_PRNG = {
        shuffle: (array) => array,
        random: () => {
            throw new Error('PRNG.random() called without injected PRNG. Inject a deterministic PRNG for rule logic.');
        }
    };

    function getConstants(context) {
        return (context && context.constants && typeof context.constants === 'object')
            ? context.constants
            : {};
    }

    function getDefaultPrng(context) {
        const defaultPrng = context && context.defaultPrng;
        if (defaultPrng && typeof defaultPrng.shuffle === 'function' && typeof defaultPrng.random === 'function') {
            return defaultPrng;
        }
        return FALLBACK_PRNG;
    }

    function requireContextFunction(context, name) {
        const value = context && context[name];
        if (typeof value !== 'function') {
            throw new Error('[state-factory] ' + name + ' not available');
        }
        return value;
    }

    function clonePresentationEvents(events) {
        if (!Array.isArray(events)) return [];
        return events.map((event) => {
            if (!event || typeof event !== 'object') return event;
            const nextEvent = { ...event };
            if (event.meta && typeof event.meta === 'object') {
                nextEvent.meta = { ...event.meta };
            }
            return nextEvent;
        });
    }

    function createCardState(prng, options, context) {
        const p = prng || getDefaultPrng(context);
        const resolveCardBoardConfig = requireContextFunction(context, 'resolveCardBoardConfig');
        const resolveInitialDeckCardIdsByPlayer = requireContextFunction(context, 'resolveInitialDeckCardIdsByPlayer');
        const buildInitialBoardBonusMap = requireContextFunction(context, 'buildInitialBoardBonusMap');
        const createStoneIdBoard = requireContextFunction(context, 'createStoneIdBoard');
        const getOpeningPlacementsForState = requireContextFunction(context, 'getOpeningPlacementsForState');
        const ensureCardCopyState = requireContextFunction(context, 'ensureCardCopyState');

        const boardConfig = resolveCardBoardConfig(options && options.boardConfig);
        const initialDeckCardIdsByPlayer = resolveInitialDeckCardIdsByPlayer(options, p);

        const buildDeck = (playerKey) => {
            const deck = Array.isArray(initialDeckCardIdsByPlayer[playerKey])
                ? initialDeckCardIdsByPlayer[playerKey].slice()
                : [];
            p.shuffle(deck);
            return deck;
        };

        const blackDeck = buildDeck('black');
        const whiteDeck = buildDeck('white');
        const boardBonusByCell = buildInitialBoardBonusMap(p, boardConfig);
        const stoneIdMap = createStoneIdBoard(boardConfig);
        const openingPlacements = getOpeningPlacementsForState(boardConfig);
        openingPlacements.forEach((stone, index) => {
            stoneIdMap[stone.row][stone.col] = 's' + String(index + 1);
        });

        const cardState = {
            boardConfig,
            decks: {
                black: blackDeck,
                white: whiteDeck
            },
            deck: blackDeck.slice(),
            discard: [],
            initialDeckSize: blackDeck.length,
            initialDeckSizeByPlayer: { black: blackDeck.length, white: whiteDeck.length },
            reshuffleRequiresFullCycle: false,
            hands: { black: [], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            _activeTurnPlayer: null,
            turnCountByPlayer: { black: 0, white: 0 },
            timeStopConsecutiveTurnsRemainingByPlayer: { black: 0, white: 0 },
            observerTriviaBaseByPlayer: { black: null, white: null },
            observerTriviaCursorByPlayer: { black: null, white: null },
            _nextCardCopySeq: 1,
            _handCopyIdsByPlayer: { black: [], white: [] },
            _deckCopyIdsByPlayer: { black: [], white: [] },
            _discardCopyIds: [],
            _revealedHandCopyIdsByViewer: { black: [], white: [] },
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: { black: null, white: null },
            activeEffectsByPlayer: { black: [], white: [] },
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,
            presentationEvents: [],
            _nextStoneId: openingPlacements.length + 1,
            stoneIdMap,
            expansionStoneIdByCell: {},
            hyperactiveSeqCounter: 0,
            lastUsedCardByPlayer: { black: null, white: null },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            chargeDeltaEvents: [],
            _nextChargeDeltaSeq: 1,
            riboRepaymentsByPlayer: { black: [], white: [] },
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },
            infinitePlaceActiveByPlayer: { black: false, white: false },
            multiPlaceSourceTypeByPlayer: { black: null, white: null },
            boardBonusByCell,
            boardBonusConsumedByCell: {},
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false },
            breedingFrontierByAnchorId: {},
            breedingSproutByOwner: { black: [], white: [] },
            _breedingSproutClearedTokenByOwner: { black: null, white: null },
            prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: null, white: null }
        };
        ensureCardCopyState(cardState);
        return cardState;
    }

    function copyCardState(cs, context) {
        const constants = getConstants(context);
        const resolveCardBoardConfig = requireContextFunction(context, 'resolveCardBoardConfig');
        const createStoneIdBoard = requireContextFunction(context, 'createStoneIdBoard');
        const cloneSalvationDestroyedLedger = requireContextFunction(context, 'cloneSalvationDestroyedLedger');
        const ensureCardCopyState = requireContextFunction(context, 'ensureCardCopyState');

        const RIBO_WILL_OWNER_TURNS = constants.RIBO_WILL_OWNER_TURNS;
        const RIBO_WILL_REPAYMENT_AMOUNT = constants.RIBO_WILL_REPAYMENT_AMOUNT;
        const RIBO_WILL_SHORTAGE_DESTROY_COUNT = constants.RIBO_WILL_SHORTAGE_DESTROY_COUNT;

        const cardState = (cs && typeof cs === 'object') ? cs : {};
        const hands = (cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : {};
        const pendingEffectByPlayer = (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
            ? cardState.pendingEffectByPlayer
            : {};
        const activeEffectsByPlayer = (cardState.activeEffectsByPlayer && typeof cardState.activeEffectsByPlayer === 'object')
            ? cardState.activeEffectsByPlayer
            : {};
        const workAnchorPosByPlayer = (cardState.workAnchorPosByPlayer && typeof cardState.workAnchorPosByPlayer === 'object')
            ? cardState.workAnchorPosByPlayer
            : {};
        const workNextPlacementArmedByPlayer = (cardState.workNextPlacementArmedByPlayer && typeof cardState.workNextPlacementArmedByPlayer === 'object')
            ? cardState.workNextPlacementArmedByPlayer
            : {};

        const boardConfig = resolveCardBoardConfig(cardState.boardConfig || cardState);
        const legacyDeck = Array.isArray(cardState.deck) ? cardState.deck.slice() : [];
        const decks = (cardState.decks && typeof cardState.decks === 'object')
            ? {
                black: Array.isArray(cardState.decks.black) ? cardState.decks.black.slice() : legacyDeck.slice(),
                white: Array.isArray(cardState.decks.white) ? cardState.decks.white.slice() : legacyDeck.slice()
            }
            : { black: legacyDeck.slice(), white: legacyDeck.slice() };
        const initialDeckSizeByPlayer = (cardState.initialDeckSizeByPlayer && typeof cardState.initialDeckSizeByPlayer === 'object')
            ? {
                black: Number.isFinite(cardState.initialDeckSizeByPlayer.black) ? cardState.initialDeckSizeByPlayer.black : decks.black.length,
                white: Number.isFinite(cardState.initialDeckSizeByPlayer.white) ? cardState.initialDeckSizeByPlayer.white : decks.white.length
            }
            : {
                black: Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : decks.black.length,
                white: Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : decks.white.length
            };

        const nextState = {
            boardConfig,
            decks,
            deck: decks.black.slice(),
            discard: Array.isArray(cardState.discard) ? cardState.discard.slice() : [],
            hands: {
                black: Array.isArray(hands.black) ? hands.black.slice() : [],
                white: Array.isArray(hands.white) ? hands.white.slice() : []
            },
            turnIndex: Number.isFinite(Number(cardState.turnIndex)) ? Number(cardState.turnIndex) : 0,
            lastTurnStartedFor: (typeof cardState.lastTurnStartedFor === 'string') ? cardState.lastTurnStartedFor : null,
            _activeTurnPlayer: (typeof cardState._activeTurnPlayer === 'string') ? cardState._activeTurnPlayer : null,
            turnCountByPlayer: {
                black: Number.isFinite(Number(cardState.turnCountByPlayer && cardState.turnCountByPlayer.black))
                    ? Number(cardState.turnCountByPlayer.black)
                    : 0,
                white: Number.isFinite(Number(cardState.turnCountByPlayer && cardState.turnCountByPlayer.white))
                    ? Number(cardState.turnCountByPlayer.white)
                    : 0
            },
            timeStopConsecutiveTurnsRemainingByPlayer: {
                black: Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer && cardState.timeStopConsecutiveTurnsRemainingByPlayer.black))
                    ? Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black)))
                    : 0,
                white: Number.isFinite(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer && cardState.timeStopConsecutiveTurnsRemainingByPlayer.white))
                    ? Math.max(0, Math.floor(Number(cardState.timeStopConsecutiveTurnsRemainingByPlayer.white)))
                    : 0
            },
            observerTriviaBaseByPlayer: (cardState.observerTriviaBaseByPlayer && typeof cardState.observerTriviaBaseByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cardState.observerTriviaBaseByPlayer.black)) ? Number(cardState.observerTriviaBaseByPlayer.black) : null,
                    white: Number.isFinite(Number(cardState.observerTriviaBaseByPlayer.white)) ? Number(cardState.observerTriviaBaseByPlayer.white) : null
                }
                : { black: null, white: null },
            observerTriviaCursorByPlayer: (cardState.observerTriviaCursorByPlayer && typeof cardState.observerTriviaCursorByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cardState.observerTriviaCursorByPlayer.black)) ? Number(cardState.observerTriviaCursorByPlayer.black) : null,
                    white: Number.isFinite(Number(cardState.observerTriviaCursorByPlayer.white)) ? Number(cardState.observerTriviaCursorByPlayer.white) : null
                }
                : { black: null, white: null },
            _nextCardCopySeq: Number.isFinite(Number(cardState._nextCardCopySeq))
                ? Math.max(1, Math.floor(Number(cardState._nextCardCopySeq)))
                : 1,
            _handCopyIdsByPlayer: {
                black: Array.isArray(cardState._handCopyIdsByPlayer && cardState._handCopyIdsByPlayer.black)
                    ? cardState._handCopyIdsByPlayer.black.slice()
                    : [],
                white: Array.isArray(cardState._handCopyIdsByPlayer && cardState._handCopyIdsByPlayer.white)
                    ? cardState._handCopyIdsByPlayer.white.slice()
                    : []
            },
            _deckCopyIdsByPlayer: {
                black: Array.isArray(cardState._deckCopyIdsByPlayer && cardState._deckCopyIdsByPlayer.black)
                    ? cardState._deckCopyIdsByPlayer.black.slice()
                    : [],
                white: Array.isArray(cardState._deckCopyIdsByPlayer && cardState._deckCopyIdsByPlayer.white)
                    ? cardState._deckCopyIdsByPlayer.white.slice()
                    : []
            },
            _discardCopyIds: Array.isArray(cardState._discardCopyIds) ? cardState._discardCopyIds.slice() : [],
            _revealedHandCopyIdsByViewer: {
                black: Array.isArray(cardState._revealedHandCopyIdsByViewer && cardState._revealedHandCopyIdsByViewer.black)
                    ? cardState._revealedHandCopyIdsByViewer.black.slice()
                    : [],
                white: Array.isArray(cardState._revealedHandCopyIdsByViewer && cardState._revealedHandCopyIdsByViewer.white)
                    ? cardState._revealedHandCopyIdsByViewer.white.slice()
                    : []
            },
            selectedCardId: cardState.selectedCardId || null,
            hasUsedCardThisTurnByPlayer: {
                black: !!(cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer.black),
                white: !!(cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer.white)
            },
            hasDestroyedCardThisTurnByPlayer: {
                black: !!(cardState.hasDestroyedCardThisTurnByPlayer && cardState.hasDestroyedCardThisTurnByPlayer.black),
                white: !!(cardState.hasDestroyedCardThisTurnByPlayer && cardState.hasDestroyedCardThisTurnByPlayer.white)
            },
            pendingEffectByPlayer: {
                black: pendingEffectByPlayer.black ? { ...pendingEffectByPlayer.black } : null,
                white: pendingEffectByPlayer.white ? { ...pendingEffectByPlayer.white } : null
            },
            activeEffectsByPlayer: {
                black: Array.isArray(activeEffectsByPlayer.black) ? activeEffectsByPlayer.black.map((effect) => ({ ...effect })) : [],
                white: Array.isArray(activeEffectsByPlayer.white) ? activeEffectsByPlayer.white.map((effect) => ({ ...effect })) : []
            },
            markers: Array.isArray(cardState.markers)
                ? cardState.markers.map((marker) => ({ ...marker, data: { ...(marker && marker.data ? marker.data : {}) } }))
                : [],
            _nextMarkerId: Number.isFinite(Number(cardState._nextMarkerId)) ? Number(cardState._nextMarkerId) : 1,
            _nextCreatedSeq: Number.isFinite(Number(cardState._nextCreatedSeq)) ? Number(cardState._nextCreatedSeq) : 1,
            presentationEvents: clonePresentationEvents(cardState.presentationEvents),
            _presentationEventsPersist: clonePresentationEvents(cardState._presentationEventsPersist),
            _nextStoneId: Number.isFinite(Number(cardState._nextStoneId)) ? Math.max(1, Math.floor(Number(cardState._nextStoneId))) : 1,
            stoneIdMap: (Array.isArray(cardState.stoneIdMap) ? cardState.stoneIdMap : createStoneIdBoard(boardConfig)).map((row) => row.slice()),
            expansionStoneIdByCell: (cardState.expansionStoneIdByCell && typeof cardState.expansionStoneIdByCell === 'object')
                ? { ...cardState.expansionStoneIdByCell }
                : {},
            hyperactiveSeqCounter: Number.isFinite(Number(cardState.hyperactiveSeqCounter)) ? Number(cardState.hyperactiveSeqCounter) : 0,
            lastUsedCardByPlayer: {
                black: (cardState.lastUsedCardByPlayer && cardState.lastUsedCardByPlayer.black) || null,
                white: (cardState.lastUsedCardByPlayer && cardState.lastUsedCardByPlayer.white) || null
            },
            cardUseCountByPlayer: {
                black: Number.isFinite(Number(cardState.cardUseCountByPlayer && cardState.cardUseCountByPlayer.black)) ? Number(cardState.cardUseCountByPlayer.black) : 0,
                white: Number.isFinite(Number(cardState.cardUseCountByPlayer && cardState.cardUseCountByPlayer.white)) ? Number(cardState.cardUseCountByPlayer.white) : 0
            },
            totalFlipCountByPlayer: {
                black: Number.isFinite(Number(cardState.totalFlipCountByPlayer && cardState.totalFlipCountByPlayer.black)) ? Number(cardState.totalFlipCountByPlayer.black) : 0,
                white: Number.isFinite(Number(cardState.totalFlipCountByPlayer && cardState.totalFlipCountByPlayer.white)) ? Number(cardState.totalFlipCountByPlayer.white) : 0
            },
            cornerCaptureCountByPlayer: {
                black: Number.isFinite(Number(cardState.cornerCaptureCountByPlayer && cardState.cornerCaptureCountByPlayer.black)) ? Number(cardState.cornerCaptureCountByPlayer.black) : 0,
                white: Number.isFinite(Number(cardState.cornerCaptureCountByPlayer && cardState.cornerCaptureCountByPlayer.white)) ? Number(cardState.cornerCaptureCountByPlayer.white) : 0
            },
            charge: {
                black: Number.isFinite(Number(cardState.charge && cardState.charge.black)) ? Number(cardState.charge.black) : 0,
                white: Number.isFinite(Number(cardState.charge && cardState.charge.white)) ? Number(cardState.charge.white) : 0
            },
            chargeGainedTotal: {
                black: Number.isFinite(Number(cardState.chargeGainedTotal && cardState.chargeGainedTotal.black)) ? Number(cardState.chargeGainedTotal.black) : 0,
                white: Number.isFinite(Number(cardState.chargeGainedTotal && cardState.chargeGainedTotal.white)) ? Number(cardState.chargeGainedTotal.white) : 0
            },
            chargeDeltaEvents: Array.isArray(cardState.chargeDeltaEvents) ? cardState.chargeDeltaEvents.map((event) => ({ ...event })) : [],
            _nextChargeDeltaSeq: Number.isFinite(Number(cardState._nextChargeDeltaSeq)) ? Number(cardState._nextChargeDeltaSeq) : 1,
            riboRepaymentsByPlayer: {
                black: Array.isArray(cardState.riboRepaymentsByPlayer && cardState.riboRepaymentsByPlayer.black)
                    ? cardState.riboRepaymentsByPlayer.black.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : [],
                white: Array.isArray(cardState.riboRepaymentsByPlayer && cardState.riboRepaymentsByPlayer.white)
                    ? cardState.riboRepaymentsByPlayer.white.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : []
            },
            extraPlaceRemainingByPlayer: {
                black: Number.isFinite(Number(cardState.extraPlaceRemainingByPlayer && cardState.extraPlaceRemainingByPlayer.black)) ? Number(cardState.extraPlaceRemainingByPlayer.black) : 0,
                white: Number.isFinite(Number(cardState.extraPlaceRemainingByPlayer && cardState.extraPlaceRemainingByPlayer.white)) ? Number(cardState.extraPlaceRemainingByPlayer.white) : 0
            },
            infinitePlaceActiveByPlayer: {
                black: !!(cardState.infinitePlaceActiveByPlayer && cardState.infinitePlaceActiveByPlayer.black),
                white: !!(cardState.infinitePlaceActiveByPlayer && cardState.infinitePlaceActiveByPlayer.white)
            },
            multiPlaceSourceTypeByPlayer: {
                black: (cardState.multiPlaceSourceTypeByPlayer && typeof cardState.multiPlaceSourceTypeByPlayer.black === 'string') ? cardState.multiPlaceSourceTypeByPlayer.black : null,
                white: (cardState.multiPlaceSourceTypeByPlayer && typeof cardState.multiPlaceSourceTypeByPlayer.white === 'string') ? cardState.multiPlaceSourceTypeByPlayer.white : null
            },
            boardBonusByCell: (cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? { ...cardState.boardBonusByCell }
                : {},
            boardBonusConsumedByCell: (cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? { ...cardState.boardBonusConsumedByCell }
                : {},
            workAnchorPosByPlayer: {
                black: workAnchorPosByPlayer.black ? { ...workAnchorPosByPlayer.black } : null,
                white: workAnchorPosByPlayer.white ? { ...workAnchorPosByPlayer.white } : null
            },
            workNextPlacementArmedByPlayer: {
                black: !!workNextPlacementArmedByPlayer.black,
                white: !!workNextPlacementArmedByPlayer.white
            },
            initialDeckSize: Number.isFinite(Number(cardState.initialDeckSize)) ? Number(cardState.initialDeckSize) : decks.black.length,
            initialDeckSizeByPlayer,
            reshuffleRequiresFullCycle: cardState.reshuffleRequiresFullCycle !== false,
            breedingFrontierByAnchorId: (cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object')
                ? Object.fromEntries(Object.entries(cardState.breedingFrontierByAnchorId).map(([key, positions]) => [
                    String(key),
                    Array.isArray(positions) ? positions.map((position) => ({ row: position.row, col: position.col })) : []
                ]))
                : {},
            breedingSproutByOwner: {
                black: Array.isArray(cardState.breedingSproutByOwner && cardState.breedingSproutByOwner.black)
                    ? cardState.breedingSproutByOwner.black.map((position) => ({ row: position.row, col: position.col }))
                    : [],
                white: Array.isArray(cardState.breedingSproutByOwner && cardState.breedingSproutByOwner.white)
                    ? cardState.breedingSproutByOwner.white.map((position) => ({ row: position.row, col: position.col }))
                    : []
            },
            _breedingSproutClearedTokenByOwner: (cardState._breedingSproutClearedTokenByOwner && typeof cardState._breedingSproutClearedTokenByOwner === 'object')
                ? {
                    black: cardState._breedingSproutClearedTokenByOwner.black || null,
                    white: cardState._breedingSproutClearedTokenByOwner.white || null
                }
                : { black: null, white: null },
            prevOpponentTurnDestroyedStonesByPlayer: cloneSalvationDestroyedLedger(
                cardState.prevOpponentTurnDestroyedStonesByPlayer || cardState.prevOpponentTurnDestroyedNormalByPlayer
            ),
            fateWillControllerByTurnOwner: (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
                ? {
                    black: cardState.fateWillControllerByTurnOwner.black || null,
                    white: cardState.fateWillControllerByTurnOwner.white || null
                }
                : { black: null, white: null }
        };
        ensureCardCopyState(nextState);
        return nextState;
    }

    return {
        createCardState,
        copyCardState
    };
}));