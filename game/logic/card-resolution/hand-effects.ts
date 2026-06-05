/**
 * @file hand-effects.ts
 * @description Hand effects: Heaven Blessing, Reveal Hand, Condemn, Execution
 */

import type { CardState, PlayerKey } from '../../../src/types';

function applyHeavenBlessingChoice(cardState: CardState, playerKey: PlayerKey, selectedCardId: string, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const addCardToHand = deps && deps.addCardToHand;
    const MAX_HAND_SIZE = deps && deps.MAX_HAND_SIZE;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof addCardToHand !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'HEAVEN_BLESSING' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'pending_not_found' };
    }

    const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
    if (!offers.length) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'offers_not_found' };
    }
    if (!selectedCardId || !offers.includes(selectedCardId)) {
        return { applied: false, reason: 'invalid_target' };
    }
    if (!cardState.hands || !Array.isArray(cardState.hands[playerKey])) {
        return { applied: false, reason: 'invalid_hand' };
    }
    if (cardState.hands[playerKey].length >= MAX_HAND_SIZE) {
        return { applied: false, reason: 'hand_full' };
    }

    const added = addCardToHand(cardState, playerKey, selectedCardId);
    if (!added) {
        return { applied: false, reason: 'hand_full' };
    }
    const vanished = offers.filter((id: string) => id !== selectedCardId);
    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, selectedCardId, vanished };
}

function applyRevealHandWill(cardState: CardState, playerKey: PlayerKey, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const revealCurrentHandToViewer = deps && deps.revealCurrentHandToViewer;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof revealCurrentHandToViewer !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'REVEAL_HAND_WILL' || pending.stage !== null) {
        return { applied: false, reason: 'pending_not_found' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
    if (!opponentHand) {
        return { applied: false, reason: 'invalid_hand' };
    }
    if (opponentHand.length <= 0) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'opponent_hand_empty', opponentKey, revealedCount: 0 };
    }

    const revealedCopyIds = revealCurrentHandToViewer(cardState, playerKey, opponentKey);
    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        opponentKey,
        revealedCount: revealedCopyIds.length
    };
}

function parseHiddenHandToken(value: any): { owner: PlayerKey; handIndex: number } | null {
    if (typeof value !== 'string') return null;
    const m = /^__hidden_hand__:(black|white):(\d+)$/.exec(value);
    if (!m) return null;
    return { owner: m[1] as PlayerKey, handIndex: Number(m[2]) };
}

function applyCondemnWill(cardState: CardState, playerKey: PlayerKey, targetIndex: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const removeHandCardAt = deps && deps.removeHandCardAt;
    const addCardToDiscard = deps && deps.addCardToDiscard;
    const isInviolableSpecialCardId = typeof (deps && deps.isInviolableSpecialCardId) === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof removeHandCardAt !== 'function' ||
        typeof addCardToDiscard !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'CONDEMN_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'pending_not_found' };
    }

    const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
    if (!offers.length) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'offers_not_found' };
    }

    if (!Number.isInteger(targetIndex)) {
        return { applied: false, reason: 'invalid_target' };
    }
    const offer = offers.find((o: any) => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
    if (!offer || !offer.cardId) {
        return { applied: false, reason: 'invalid_target' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
    if (!opponentHand) {
        return { applied: false, reason: 'invalid_hand' };
    }
    if (targetIndex < 0 || targetIndex >= opponentHand.length) {
        return { applied: false, reason: 'invalid_target' };
    }
    if (isInviolableSpecialCardId(opponentHand[targetIndex])) {
        return { applied: false, reason: 'inviolable_special_card' };
    }
    const removed = removeHandCardAt(cardState, opponentKey, targetIndex);
    if (!removed) {
        return { applied: false, reason: 'invalid_target' };
    }
    const handCardId = removed.cardId;
    const handToken = parseHiddenHandToken(handCardId);
    const offerToken = parseHiddenHandToken(offer.cardId);
    const destroyedCardId = handToken && !offerToken ? offer.cardId : handCardId;
    addCardToDiscard(cardState, handCardId, removed.cardCopyId);
    cardState.selectedCardId = null;
    cardState.selectedCardOwnerKey = null;
    clearCardPendingEffect(cardState, playerKey);

    return { applied: true, destroyedCardId };
}

function ensureObserverWillState(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.nextObserverWillStoneByPlayer || typeof cardState.nextObserverWillStoneByPlayer !== 'object') {
        cardState.nextObserverWillStoneByPlayer = { black: null, white: null };
    }
    if (!cardState.observerWillRepaymentsByPlayer || typeof cardState.observerWillRepaymentsByPlayer !== 'object') {
        cardState.observerWillRepaymentsByPlayer = { black: [], white: [] };
    }
    if (!Array.isArray(cardState.observerWillRepaymentsByPlayer.black)) cardState.observerWillRepaymentsByPlayer.black = [];
    if (!Array.isArray(cardState.observerWillRepaymentsByPlayer.white)) cardState.observerWillRepaymentsByPlayer.white = [];
    if (!Number.isFinite(Number(cardState._nextObserverWillRepaymentSeq)) || Number(cardState._nextObserverWillRepaymentSeq) < 1) {
        cardState._nextObserverWillRepaymentSeq = deriveNextObserverWillRepaymentSeq(cardState);
    }
}

function allocateObserverWillRepaymentId(cardState: any, playerKey: PlayerKey): string {
    ensureObserverWillState(cardState);
    const seq = Math.max(1, Math.floor(Number(cardState._nextObserverWillRepaymentSeq) || 1));
    cardState._nextObserverWillRepaymentSeq = seq + 1;
    return `observer_will_repay_${playerKey}_${seq}`;
}

function deriveNextObserverWillRepaymentSeq(cardState: any): number {
    let maxSeq = 0;
    const visit = (value: any) => {
        if (!value || typeof value !== 'object') return;
        const repaymentId = typeof value.repaymentId === 'string' ? value.repaymentId : '';
        const match = /^observer_will_repay_(?:black|white)_(\d+)$/.exec(repaymentId);
        if (!match) return;
        maxSeq = Math.max(maxSeq, Number(match[1]) || 0);
    };
    const byPlayer = cardState && cardState.observerWillRepaymentsByPlayer;
    for (const playerKey of ['black', 'white']) {
        const entries = byPlayer && Array.isArray(byPlayer[playerKey]) ? byPlayer[playerKey] : [];
        entries.forEach(visit);
    }
    const reservations = cardState && cardState.nextObserverWillStoneByPlayer;
    visit(reservations && reservations.black);
    visit(reservations && reservations.white);
    return maxSeq + 1;
}

function applyObserverWillChoice(cardState: CardState, gameState: any, playerKey: PlayerKey, targetIndex: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const removeHandCardAt = deps && deps.removeHandCardAt;
    const addCardToHand = deps && deps.addCardToHand;
    const setCardCostOverrideForCopyId = deps && deps.setCardCostOverrideForCopyId;
    const applyObserverWillObservedCostTax = deps && deps.applyObserverWillObservedCostTax;
    const clearObserverWillObservationCost = deps && deps.clearObserverWillObservationCost;
    const getCardCost = deps && deps.getCardCost;
    const revealCurrentHandToViewer = deps && deps.revealCurrentHandToViewer;
    const isInviolableSpecialCardId = typeof (deps && deps.isInviolableSpecialCardId) === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof removeHandCardAt !== 'function' ||
        typeof addCardToHand !== 'function' ||
        typeof setCardCostOverrideForCopyId !== 'function' ||
        typeof applyObserverWillObservedCostTax !== 'function' ||
        typeof clearObserverWillObservationCost !== 'function' ||
        typeof getCardCost !== 'function' ||
        typeof revealCurrentHandToViewer !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'OBSERVER_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'pending_not_found' };
    }
    const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
    if (!offers.length) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'offers_not_found' };
    }
    if (!Number.isInteger(targetIndex)) {
        return { applied: false, reason: 'invalid_target' };
    }
    const offer = offers.find((o: any) => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
    if (!offer || !offer.cardId) {
        return { applied: false, reason: 'invalid_target' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
    if (!opponentHand || targetIndex < 0 || targetIndex >= opponentHand.length) {
        return { applied: false, reason: 'invalid_target' };
    }
    if (isInviolableSpecialCardId(opponentHand[targetIndex])) {
        return { applied: false, reason: 'inviolable_special_card' };
    }

    const observedCopyIds = revealCurrentHandToViewer(cardState, playerKey, opponentKey) || [];
    const removed = removeHandCardAt(cardState, opponentKey, targetIndex);
    if (!removed || !removed.cardId || !removed.cardCopyId) {
        return { applied: false, reason: 'invalid_target' };
    }
    const added = addCardToHand(cardState, playerKey, removed.cardId, {
        cardCopyId: removed.cardCopyId,
        ignoreHandLimit: true
    });
    if (!added) {
        return { applied: false, reason: 'hand_full' };
    }

    clearObserverWillObservationCost(cardState, removed.cardCopyId);
    setCardCostOverrideForCopyId(cardState, removed.cardCopyId, 0, 'OBSERVER_WILL');
    applyObserverWillObservedCostTax(cardState, opponentKey, observedCopyIds, removed.cardCopyId);

    ensureObserverWillState(cardState);
    const baseCost = Math.max(0, Math.floor(Number(getCardCost(removed.cardId)) || 0));
    const repaymentAmount = Math.max(0, Math.ceil(baseCost * 0.2));
    const repaymentId = allocateObserverWillRepaymentId(cardState as any, playerKey);
    const repaymentEntry = {
        sourceType: 'OBSERVER_WILL',
        repaymentId,
        status: 'waiting_for_marker_expire',
        stolenCardId: removed.cardId,
        stolenCardCopyId: removed.cardCopyId,
        baseCost,
        repaymentAmount,
        remainingOwnerTurns: 9,
        shortageDestroyCount: 4,
        markerId: null
    };
    (cardState as any).observerWillRepaymentsByPlayer[playerKey].push(repaymentEntry);
    (cardState as any).nextObserverWillStoneByPlayer[playerKey] = {
        sourceType: 'OBSERVER_WILL',
        repaymentId,
        stolenCardId: removed.cardId,
        stolenCardCopyId: removed.cardCopyId,
        repaymentIndex: (cardState as any).observerWillRepaymentsByPlayer[playerKey].length - 1,
        createdTurnNumber: gameState && Number.isFinite(Number(gameState.turnNumber)) ? Number(gameState.turnNumber) : null
    };

    cardState.selectedCardId = null;
    cardState.selectedCardOwnerKey = null;
    clearCardPendingEffect(cardState, playerKey);

    return {
        applied: true,
        opponentKey,
        stolenCardId: removed.cardId,
        stolenCardCopyId: removed.cardCopyId,
        repaymentAmount
    };
}

function applyExecutionWill(cardState: CardState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const removeHandCardAt = deps && deps.removeHandCardAt;
    const addCardToDiscard = deps && deps.addCardToDiscard;
    const resolveDeterministicRandomIndex = deps && deps.resolveDeterministicRandomIndex;
    const isInviolableSpecialCardId = typeof (deps && deps.isInviolableSpecialCardId) === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof removeHandCardAt !== 'function' ||
        typeof addCardToDiscard !== 'function' ||
        typeof resolveDeterministicRandomIndex !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'EXECUTION_WILL' || pending.stage !== null) {
        return { applied: false, reason: 'pending_not_found' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
    if (!opponentHand) {
        return { applied: false, reason: 'invalid_hand' };
    }

    const eligibleCount = opponentHand.filter((cardId: any) => !isInviolableSpecialCardId(cardId)).length;
    const requestedCount = Math.min(3, eligibleCount);
    if (requestedCount <= 0) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'opponent_hand_empty', opponentKey, requestedCount: 0, destroyedCount: 0, destroyedCardIds: [] };
    }

    const destroyedCardIds: string[] = [];
    for (let destroyIndex = 0; destroyIndex < requestedCount; destroyIndex += 1) {
        const eligibleIndexes = opponentHand
            .map((cardId: any, handIndex: number) => ({ cardId, handIndex }))
            .filter((entry: any) => !isInviolableSpecialCardId(entry.cardId))
            .map((entry: any) => entry.handIndex);
        if (eligibleIndexes.length <= 0) break;
        const handIndex = resolveDeterministicRandomIndex(
            eligibleIndexes.length,
            prng,
            null,
            'CardHandEffects.applyExecutionWill'
        );
        const removed = removeHandCardAt(cardState, opponentKey, eligibleIndexes[handIndex]);
        if (!removed || !removed.cardId) break;
        addCardToDiscard(cardState, removed.cardId, removed.cardCopyId);
        destroyedCardIds.push(removed.cardId);
    }

    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: destroyedCardIds.length > 0,
        opponentKey,
        requestedCount,
        destroyedCount: destroyedCardIds.length,
        destroyedCardIds
    };
}

export = {
    applyHeavenBlessingChoice,
    applyRevealHandWill,
    parseHiddenHandToken,
    applyCondemnWill,
    applyObserverWillChoice,
    applyExecutionWill
};
