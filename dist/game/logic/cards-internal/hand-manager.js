"use strict";
/**
 * @file hand-manager.ts
 * @description Card hand management shared between Browser and Headless.
 */
function getConstants(context) {
    const constants = (context && context.constants) || {};
    return {
        CARD_DEFS: Array.isArray(constants.CARD_DEFS) ? constants.CARD_DEFS : [],
        CARD_TYPE_BY_ID: (constants.CARD_TYPE_BY_ID && typeof constants.CARD_TYPE_BY_ID === 'object') ? constants.CARD_TYPE_BY_ID : {},
        MAX_HAND_SIZE: Number.isFinite(Number(constants.MAX_HAND_SIZE))
            ? Math.max(0, Math.trunc(Number(constants.MAX_HAND_SIZE)))
            : 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: Number.isFinite(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
            ? Math.trunc(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
            : 19
    };
}
function getHelpers(context) {
    return (context && context.helpers) || {};
}
function getModules(context) {
    return (context && context.modules) || {};
}
function getCardDefsModule(context) {
    const modules = getModules(context);
    return modules.CardDefsModule || modules.cardDefsModule || null;
}
function getCardCostsModule(context) {
    const modules = getModules(context);
    return modules.CardCostsModule || modules.cardCostsModule || null;
}
function getCardSelectorsModule(context) {
    const modules = getModules(context);
    return modules.CardSelectorsModule || modules.cardSelectorsModule || null;
}
function normalizestring(playerKey) {
    return playerKey === 'white' ? 'white' : 'black';
}
function ensureHands(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return { black: [], white: [] };
    if (!cardState.hands || typeof cardState.hands !== 'object') {
        cardState.hands = { black: [], white: [] };
        return cardState.hands;
    }
    if (!Array.isArray(cardState.hands.black))
        cardState.hands.black = [];
    if (!Array.isArray(cardState.hands.white))
        cardState.hands.white = [];
    return cardState.hands;
}
function ensureDecks(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return { black: [], white: [] };
    if (!cardState.decks || typeof cardState.decks !== 'object') {
        cardState.decks = {
            black: Array.isArray(cardState.deck) ? cardState.deck.slice() : [],
            white: []
        };
        return cardState.decks;
    }
    if (!Array.isArray(cardState.decks.black)) {
        cardState.decks.black = Array.isArray(cardState.deck) ? cardState.deck.slice() : [];
    }
    if (!Array.isArray(cardState.decks.white))
        cardState.decks.white = [];
    return cardState.decks;
}
function ensureDiscard(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return [];
    if (!Array.isArray(cardState.discard))
        cardState.discard = [];
    return cardState.discard;
}
function ensureCopySeq(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return 1;
    const existing = Number(cardState._nextCardCopySeq);
    const next = Number.isInteger(existing) && existing > 0 ? existing : 1;
    cardState._nextCardCopySeq = next;
    return next;
}
function allocateNextCardCopyId(cardState) {
    const next = ensureCopySeq(cardState);
    cardState._nextCardCopySeq = next + 1;
    return next;
}
function normalizeSingleCopyId(cardState, value) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0)
        return numeric;
    return allocateNextCardCopyId(cardState);
}
function ensurePlayerCopyIdBuckets(cardState, fieldName) {
    if (!cardState || typeof cardState !== 'object') {
        return { black: [], white: [] };
    }
    if (!cardState[fieldName] || typeof cardState[fieldName] !== 'object') {
        cardState[fieldName] = { black: [], white: [] };
        return cardState[fieldName];
    }
    if (!Array.isArray(cardState[fieldName].black))
        cardState[fieldName].black = [];
    if (!Array.isArray(cardState[fieldName].white))
        cardState[fieldName].white = [];
    return cardState[fieldName];
}
function normalizeCopyIdArray(cardState, source, targetLength) {
    const length = Number.isFinite(Number(targetLength))
        ? Math.max(0, Math.trunc(Number(targetLength)))
        : 0;
    const next = Array.isArray(source) ? source.slice(0, length) : [];
    for (let index = 0; index < length; index += 1) {
        next[index] = normalizeSingleCopyId(cardState, next[index]);
    }
    return next;
}
function normalizeRevealCopyIdList(source) {
    const next = [];
    const seen = new Set();
    const values = Array.isArray(source) ? source : [];
    for (const rawValue of values) {
        const numeric = Number(rawValue);
        if (!Number.isInteger(numeric) || numeric <= 0 || seen.has(numeric))
            continue;
        seen.add(numeric);
        next.push(numeric);
    }
    return next;
}
function syncNextCardCopySeq(cardState, buckets) {
    if (!cardState || typeof cardState !== 'object')
        return 1;
    let maxCopyId = 0;
    const sources = Array.isArray(buckets) ? buckets : [];
    for (const bucket of sources) {
        if (!Array.isArray(bucket))
            continue;
        for (const rawValue of bucket) {
            const numeric = Number(rawValue);
            if (Number.isInteger(numeric) && numeric > maxCopyId) {
                maxCopyId = numeric;
            }
        }
    }
    const next = ensureCopySeq(cardState);
    if (maxCopyId >= next) {
        cardState._nextCardCopySeq = maxCopyId + 1;
    }
    return cardState._nextCardCopySeq;
}
function ensureCardCopyState(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return null;
    ensureCopySeq(cardState);
    const hands = ensureHands(cardState);
    const decks = ensureDecks(cardState);
    const discard = ensureDiscard(cardState);
    const handCopyIdsByPlayer = ensurePlayerCopyIdBuckets(cardState, '_handCopyIdsByPlayer');
    handCopyIdsByPlayer.black = normalizeCopyIdArray(cardState, handCopyIdsByPlayer.black, hands.black.length);
    handCopyIdsByPlayer.white = normalizeCopyIdArray(cardState, handCopyIdsByPlayer.white, hands.white.length);
    const deckCopyIdsByPlayer = ensurePlayerCopyIdBuckets(cardState, '_deckCopyIdsByPlayer');
    deckCopyIdsByPlayer.black = normalizeCopyIdArray(cardState, deckCopyIdsByPlayer.black, decks.black.length);
    deckCopyIdsByPlayer.white = normalizeCopyIdArray(cardState, deckCopyIdsByPlayer.white, decks.white.length);
    cardState._discardCopyIds = normalizeCopyIdArray(cardState, cardState._discardCopyIds, discard.length);
    const revealedHandCopyIdsByViewer = ensurePlayerCopyIdBuckets(cardState, '_revealedHandCopyIdsByViewer');
    revealedHandCopyIdsByViewer.black = normalizeRevealCopyIdList(revealedHandCopyIdsByViewer.black);
    revealedHandCopyIdsByViewer.white = normalizeRevealCopyIdList(revealedHandCopyIdsByViewer.white);
    syncNextCardCopySeq(cardState, [
        handCopyIdsByPlayer.black,
        handCopyIdsByPlayer.white,
        deckCopyIdsByPlayer.black,
        deckCopyIdsByPlayer.white,
        cardState._discardCopyIds,
        revealedHandCopyIdsByViewer.black,
        revealedHandCopyIdsByViewer.white
    ]);
    return {
        handCopyIdsByPlayer,
        deckCopyIdsByPlayer,
        discardCopyIds: cardState._discardCopyIds,
        revealedHandCopyIdsByViewer
    };
}
function getHandCopyIdAt(cardState, playerKey, handIndex) {
    const copyState = ensureCardCopyState(cardState);
    const ownerKey = normalizestring(playerKey);
    if (!copyState || !Number.isInteger(handIndex) || handIndex < 0)
        return null;
    const copyIds = copyState.handCopyIdsByPlayer[ownerKey];
    if (!Array.isArray(copyIds) || handIndex >= copyIds.length)
        return null;
    return copyIds[handIndex] || null;
}
function getHandCopyIds(cardState, playerKey) {
    const copyState = ensureCardCopyState(cardState);
    const ownerKey = normalizestring(playerKey);
    if (!copyState)
        return [];
    return Array.isArray(copyState.handCopyIdsByPlayer[ownerKey])
        ? copyState.handCopyIdsByPlayer[ownerKey].slice()
        : [];
}
function isCardCopyIdRevealedToViewer(cardState, viewerKey, cardCopyId) {
    const copyState = ensureCardCopyState(cardState);
    const viewer = normalizestring(viewerKey);
    const numeric = Number(cardCopyId);
    if (!copyState || !Number.isInteger(numeric) || numeric <= 0)
        return false;
    const revealed = copyState.revealedHandCopyIdsByViewer[viewer];
    return Array.isArray(revealed) && revealed.includes(numeric);
}
function revealCurrentHandToViewer(cardState, viewerKey, ownerKey) {
    const copyState = ensureCardCopyState(cardState);
    if (!copyState)
        return [];
    const viewer = normalizestring(viewerKey);
    const owner = normalizestring(ownerKey);
    const handCopyIds = Array.isArray(copyState.handCopyIdsByPlayer[owner])
        ? copyState.handCopyIdsByPlayer[owner]
        : [];
    if (!handCopyIds.length)
        return [];
    const revealLedger = copyState.revealedHandCopyIdsByViewer[viewer];
    const seen = new Set(revealLedger);
    for (const copyId of handCopyIds) {
        if (!Number.isInteger(copyId) || copyId <= 0 || seen.has(copyId))
            continue;
        revealLedger.push(copyId);
        seen.add(copyId);
    }
    return handCopyIds.slice();
}
function addCardToHand(cardState, playerKey, cardId, context, opts) {
    const { MAX_HAND_SIZE } = getConstants(context);
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = hands[ownerKey];
    const options = (opts && typeof opts === 'object') ? opts : {};
    const autoDestroyOnEntry = getCardType(cardId, context) === 'TIME_STOP_GOD';
    if (!Array.isArray(hand))
        return null;
    if (!autoDestroyOnEntry && !options.ignoreHandLimit && hand.length >= MAX_HAND_SIZE)
        return null;
    const cardCopyId = normalizeSingleCopyId(cardState, options.cardCopyId);
    const requestedInsertIndex = Number(options.insertIndex);
    const insertIndex = Number.isInteger(requestedInsertIndex)
        ? Math.max(0, Math.min(hand.length, requestedInsertIndex))
        : hand.length;
    hand.splice(insertIndex, 0, cardId);
    copyState.handCopyIdsByPlayer[ownerKey].splice(insertIndex, 0, cardCopyId);
    if (autoDestroyOnEntry) {
        const removedCardId = hand.splice(insertIndex, 1)[0];
        const removedCopyId = normalizeSingleCopyId(cardState, copyState.handCopyIdsByPlayer[ownerKey].splice(insertIndex, 1)[0]);
        addCardToDiscard(cardState, removedCardId, removedCopyId);
    }
    return {
        cardId,
        cardCopyId,
        handIndex: insertIndex
    };
}
function addCardToDiscard(cardState, cardId, cardCopyId) {
    const discard = ensureDiscard(cardState);
    const copyState = ensureCardCopyState(cardState);
    const normalizedCopyId = normalizeSingleCopyId(cardState, cardCopyId);
    discard.push(cardId);
    copyState.discardCopyIds.push(normalizedCopyId);
    return {
        cardId,
        cardCopyId: normalizedCopyId,
        discardIndex: discard.length - 1
    };
}
function popDeckCard(cardState, playerKey) {
    const ownerKey = normalizestring(playerKey);
    const decks = ensureDecks(cardState);
    const copyState = ensureCardCopyState(cardState);
    const deck = Array.isArray(decks[ownerKey]) ? decks[ownerKey] : null;
    if (!deck || deck.length <= 0)
        return null;
    const cardId = deck.pop();
    const cardCopyId = normalizeSingleCopyId(cardState, copyState.deckCopyIdsByPlayer[ownerKey].pop());
    return { cardId, cardCopyId };
}
function removeHandCardAt(cardState, playerKey, handIndex) {
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || !Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length)
        return null;
    const cardId = hand.splice(handIndex, 1)[0];
    const cardCopyId = normalizeSingleCopyId(cardState, copyState.handCopyIdsByPlayer[ownerKey].splice(handIndex, 1)[0]);
    return { cardId, cardCopyId, handIndex };
}
function clearHandToDiscard(cardState, playerKey) {
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || hand.length <= 0) {
        return { destroyedCards: [], destroyedCopyIds: [] };
    }
    const destroyedCards = hand.splice(0, hand.length);
    const rawCopyIds = copyState.handCopyIdsByPlayer[ownerKey].splice(0, copyState.handCopyIdsByPlayer[ownerKey].length);
    const destroyedCopyIds = destroyedCards.map((_, index) => normalizeSingleCopyId(cardState, rawCopyIds[index]));
    ensureDiscard(cardState).push(...destroyedCards);
    copyState.discardCopyIds.push(...destroyedCopyIds);
    return { destroyedCards, destroyedCopyIds };
}
function moveDiscardCardToHandByCardId(cardState, playerKey, cardId, context, opts) {
    const discard = ensureDiscard(cardState);
    const copyState = ensureCardCopyState(cardState);
    const discardIndex = discard.lastIndexOf(cardId);
    if (discardIndex < 0)
        return null;
    const removedCardId = discard.splice(discardIndex, 1)[0];
    const removedCopyId = normalizeSingleCopyId(cardState, copyState.discardCopyIds.splice(discardIndex, 1)[0]);
    const added = addCardToHand(cardState, playerKey, removedCardId, context, {
        ...(opts && typeof opts === 'object' ? opts : {}),
        cardCopyId: removedCopyId
    });
    if (added)
        return added;
    discard.splice(discardIndex, 0, removedCardId);
    copyState.discardCopyIds.splice(discardIndex, 0, removedCopyId);
    return null;
}
function hasTargets(targets, minimumCount) {
    const safeMinimumCount = Number.isFinite(Number(minimumCount))
        ? Math.max(1, Math.trunc(Number(minimumCount)))
        : 1;
    return Array.isArray(targets) && targets.length >= safeMinimumCount;
}
function invokeLocalSelector(context, methodName, args) {
    const helpers = getHelpers(context);
    const selector = helpers[methodName];
    if (typeof selector !== 'function')
        return null;
    try {
        return selector.apply(null, args);
    }
    catch (e) {
        return null;
    }
}
function invokeModuleSelector(context, methodName, args) {
    const selectorsModule = getCardSelectorsModule(context);
    if (!selectorsModule || typeof selectorsModule[methodName] !== 'function')
        return null;
    try {
        return selectorsModule[methodName].apply(selectorsModule, args);
    }
    catch (e) {
        return null;
    }
}
function requireLocalTargets(context, methodName, args, minimumCount) {
    const targets = invokeLocalSelector(context, methodName, args);
    return targets === null ? true : hasTargets(targets, minimumCount);
}
function requireModuleTargets(context, methodName, args, minimumCount) {
    const targets = invokeModuleSelector(context, methodName, args);
    return targets === null ? true : hasTargets(targets, minimumCount);
}
function dealInitialHands(cardState, prng, context) {
    if (!cardState || typeof cardState !== 'object')
        return;
    if (!cardState.turnCountByPlayer || typeof cardState.turnCountByPlayer !== 'object') {
        cardState.turnCountByPlayer = { black: 0, white: 0 };
        return;
    }
    cardState.turnCountByPlayer.black = 0;
    cardState.turnCountByPlayer.white = 0;
}
function commitDraw(cardState, playerKey, prng, context) {
    const { MAX_HAND_SIZE } = getConstants(context);
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || hand.length >= MAX_HAND_SIZE)
        return null;
    const drawn = popDeckCard(cardState, playerKey);
    if (!drawn || !drawn.cardId)
        return null;
    const added = addCardToHand(cardState, playerKey, drawn.cardId, context, { cardCopyId: drawn.cardCopyId });
    if (added && added.cardId)
        return added.cardId;
    const decks = ensureDecks(cardState);
    const copyState = ensureCardCopyState(cardState);
    decks[ownerKey].push(drawn.cardId);
    copyState.deckCopyIdsByPlayer[ownerKey].push(drawn.cardCopyId);
    return null;
}
function getCardDef(cardId, context) {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardDef === 'function') {
        return defsModule.getCardDef(cardId);
    }
    const { CARD_DEFS } = getConstants(context);
    return CARD_DEFS.find((card) => card && card.id === cardId) || null;
}
function getCardType(cardId, context) {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardType === 'function') {
        return defsModule.getCardType(cardId);
    }
    const { CARD_TYPE_BY_ID } = getConstants(context);
    return CARD_TYPE_BY_ID[cardId] || null;
}
function getCardDisplayName(cardId, context) {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardDisplayName === 'function') {
        return defsModule.getCardDisplayName(cardId);
    }
    const def = getCardDef(cardId, context);
    return def ? def.name : '';
}
function getCardCodeName(displayName, context) {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardCodeName === 'function') {
        return defsModule.getCardCodeName(displayName);
    }
    const { CARD_DEFS } = getConstants(context);
    const def = CARD_DEFS.find((card) => card && card.name === displayName);
    return def ? def.id : null;
}
function getCardCost(cardId, context) {
    const costsModule = getCardCostsModule(context);
    if (costsModule && typeof costsModule.getCardCost === 'function') {
        return costsModule.getCardCost(cardId);
    }
    const def = getCardDef(cardId, context);
    return def ? def.cost : 0;
}
function canUseCard(cardState, playerKey, cardId, context, opts) {
    const { RIBO_WILL_UNLOCK_TURN_INDEX } = getConstants(context);
    const hands = cardState && cardState.hands;
    if (!hands || !Array.isArray(hands[playerKey]))
        return false;
    const skipCostAndTurnLimit = opts && opts.skipCostAndTurnLimit;
    const hasLiveTurnUsageFlag = !skipCostAndTurnLimit
        && cardState
        && cardState.lastTurnStartedFor === playerKey
        && cardState.hasUsedCardThisTurnByPlayer
        && cardState.hasUsedCardThisTurnByPlayer[playerKey];
    if (hasLiveTurnUsageFlag)
        return false;
    if (!hands[playerKey].includes(cardId))
        return false;
    if (!skipCostAndTurnLimit) {
        const cost = getCardCost(cardId, context);
        if (!cardState.charge || Number(cardState.charge[playerKey] || 0) < cost)
            return false;
    }
    const cardType = getCardType(cardId, context);
    if (cardType === 'RIBO_WILL' && Number(cardState.turnIndex || 0) < RIBO_WILL_UNLOCK_TURN_INDEX) {
        return false;
    }
    return true;
}
function ensureHandDestroyFlags(cardState) {
    if (!cardState || typeof cardState !== 'object')
        return;
    if (!cardState.hasDestroyedCardThisTurnByPlayer || typeof cardState.hasDestroyedCardThisTurnByPlayer !== 'object') {
        cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'black')) {
        cardState.hasDestroyedCardThisTurnByPlayer.black = false;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'white')) {
        cardState.hasDestroyedCardThisTurnByPlayer.white = false;
    }
}
function destroyHandCard(cardState, playerKey, cardId, opts, context) {
    if (!cardState || !cardState.hands)
        return { applied: false, reason: 'invalid_state' };
    const ownerKey = normalizestring(playerKey);
    const hand = Array.isArray(cardState.hands[ownerKey]) ? cardState.hands[ownerKey] : null;
    if (!hand)
        return { applied: false, reason: 'invalid_hand' };
    ensureHandDestroyFlags(cardState);
    const index = hand.indexOf(cardId);
    if (index < 0)
        return { applied: false, reason: 'card_not_in_hand' };
    const removed = removeHandCardAt(cardState, ownerKey, index);
    if (!removed)
        return { applied: false, reason: 'card_not_in_hand' };
    addCardToDiscard(cardState, removed.cardId, removed.cardCopyId);
    cardState.hasDestroyedCardThisTurnByPlayer[ownerKey] = true;
    return { applied: true, destroyedCardId: removed.cardId, destroyedCardCopyId: removed.cardCopyId };
}
function getUsableCardIds(cardState, gameState, playerKey, context, opts) {
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey]))
        return [];
    const helpers = getHelpers(context);
    const hand = cardState.hands[playerKey];
    const res = [];
    for (const cardId of hand) {
        if (!canUseCard(cardState, playerKey, cardId, context, opts))
            continue;
        const def = getCardDef(cardId, context);
        if (!def)
            continue;
        const type = def.type;
        if (type === 'CONDEMN_WILL') {
            const opponentKey = playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                ? cardState.hands[opponentKey]
                : [];
            if (opponentHand.length === 0)
                continue;
        }
        if (type === 'REVEAL_HAND_WILL') {
            const opponentKey = playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                ? cardState.hands[opponentKey]
                : [];
            if (opponentHand.length === 0)
                continue;
        }
        if (type === 'SALVATION_WILL') {
            const salvationLedger = cardState.prevOpponentTurnDestroyedStonesByPlayer
                || cardState.prevOpponentTurnDestroyedNormalByPlayer;
            const salvationList = salvationLedger && salvationLedger[playerKey];
            if (!Array.isArray(salvationList) || salvationList.length === 0)
                continue;
        }
        if (gameState) {
            if (type === 'LAST_RESORT') {
                if (typeof helpers.canUseLastResortForPlayer !== 'function')
                    continue;
                if (!helpers.canUseLastResortForPlayer(cardState, gameState, playerKey))
                    continue;
            }
            if (type === 'EQUALITY_WILL') {
                if (typeof helpers.canUseEqualityWillForPlayer !== 'function')
                    continue;
                if (!helpers.canUseEqualityWillForPlayer(cardState, gameState, playerKey))
                    continue;
            }
            if (type === 'REINFORCEMENT_WILL') {
                if (typeof helpers.canUseReinforcementWillForPlayer !== 'function')
                    continue;
                if (!helpers.canUseReinforcementWillForPlayer(cardState, gameState, playerKey))
                    continue;
            }
            if (type === 'TIME_STOP_GOD') {
                if (typeof helpers.canUseTimeStopGodForPlayer !== 'function')
                    continue;
                if (!helpers.canUseTimeStopGodForPlayer(cardState, gameState, playerKey))
                    continue;
            }
            if (type === 'CORNER_TRIBUTE') {
                if (typeof helpers.countOpponentOccupiedCornersForPlayer !== 'function')
                    continue;
                if (helpers.countOpponentOccupiedCornersForPlayer(cardState, gameState, playerKey) < 4)
                    continue;
            }
            if (type === 'TEMPT_WILL' && !requireLocalTargets(context, 'getTemptWillTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'TRAP_WILL' && !requireLocalTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1))
                continue;
            if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireLocalTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'HYPERACTIVE_INHERIT_WILL' && !requireLocalTargets(context, 'getHyperactiveInheritTargets', [cardState, gameState, playerKey], 1))
                continue;
            if ((type === 'EXTEND_LIFE_WILL' || type === 'EXTEND_LIFE_GOD') && !requireLocalTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'CORROSION_WILL' && !requireLocalTargets(context, 'getCorrosionTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'TIME_BOMB' && !requireLocalTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'TELEPORT_WILL' && !requireLocalTargets(context, 'getTeleportTargets', [cardState, gameState], 1))
                continue;
            if (type === 'CELL_TELEPORT_WILL' && !requireLocalTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1))
                continue;
            if (type === 'SUPER_BUOYANCY_WILL' && !requireLocalTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1))
                continue;
            if (type === 'SUPER_GRAVITY_WILL' && !requireLocalTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1))
                continue;
            if (type === 'CLONE_WILL' && !requireLocalTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'POSITION_SWAP_WILL') {
                const getOccupiedBoardShapeCellsForCard = helpers.getOccupiedBoardShapeCellsForCard;
                const occupied = typeof getOccupiedBoardShapeCellsForCard === 'function'
                    ? getOccupiedBoardShapeCellsForCard(cardState, gameState).length
                    : 0;
                if (occupied < 2)
                    continue;
            }
            if (type === 'BOARD_EXPANSION_WILL' && !requireLocalTargets(context, 'getBoardExpansionTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BOARD_EXPANSION_GOD' && !requireLocalTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BOARD_SHRINK_WILL' && !requireLocalTargets(context, 'getBoardShrinkTargets', [cardState, gameState, playerKey], 3))
                continue;
            if (type === 'BOARD_SHRINK_GOD' && !requireLocalTargets(context, 'getBoardShrinkGodTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BLOCKADE_WILL' && !requireLocalTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'METEOR_WILL' && !requireLocalTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'FREEZE_WILL' && !requireLocalTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'SEED_WILL' && !requireLocalTargets(context, 'getSeedTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'DESTROY_ONE_STONE' && !requireModuleTargets(context, 'getDestroyTargets', [cardState, gameState], 1))
                continue;
            if (type === 'STRONG_WIND_WILL' && !requireModuleTargets(context, 'getStrongWindTargets', [cardState, gameState], 1))
                continue;
            if (type === 'SUPER_BUOYANCY_WILL' && !requireModuleTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1))
                continue;
            if (type === 'SUPER_GRAVITY_WILL' && !requireModuleTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1))
                continue;
            if (type === 'SWAP_WITH_ENEMY' && !requireModuleTargets(context, 'getSwapTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'POSITION_SWAP_WILL' && !requireModuleTargets(context, 'getPositionSwapTargets', [cardState, gameState, playerKey, null], 2))
                continue;
            if (type === 'TRAP_WILL' && !requireModuleTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1))
                continue;
            if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireModuleTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'HYPERACTIVE_INHERIT_WILL' && !requireModuleTargets(context, 'getHyperactiveInheritTargets', [cardState, gameState, playerKey], 1))
                continue;
            if ((type === 'EXTEND_LIFE_WILL' || type === 'EXTEND_LIFE_GOD') && !requireModuleTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'TIME_BOMB' && !requireModuleTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'TELEPORT_WILL' && !requireModuleTargets(context, 'getTeleportTargets', [cardState, gameState], 1))
                continue;
            if (type === 'CELL_TELEPORT_WILL' && !requireModuleTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1))
                continue;
            if (type === 'CLONE_WILL' && !requireModuleTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BOARD_EXPANSION_GOD' && !requireModuleTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BOARD_SHRINK_WILL' && !requireModuleTargets(context, 'getBoardShrinkTargets', [cardState, gameState, playerKey], 3))
                continue;
            if (type === 'BOARD_SHRINK_GOD' && !requireModuleTargets(context, 'getBoardShrinkGodTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'BLOCKADE_WILL' && !requireModuleTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'METEOR_WILL' && !requireModuleTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'FREEZE_WILL' && !requireModuleTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1))
                continue;
            if (type === 'SEED_WILL' && !requireModuleTargets(context, 'getSeedTargets', [cardState, gameState, playerKey], 1))
                continue;
        }
        res.push(cardId);
    }
    return res;
}
function hasUsableCard(cardState, gameState, playerKey, context) {
    return getUsableCardIds(cardState, gameState, playerKey, context).length > 0;
}
module.exports = {
    dealInitialHands,
    commitDraw,
    getCardDef,
    getCardType,
    getCardDisplayName,
    getCardCodeName,
    getCardCost,
    canUseCard,
    ensureHandDestroyFlags,
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
    destroyHandCard,
    getUsableCardIds,
    hasUsableCard
};
//# sourceMappingURL=hand-manager.js.map