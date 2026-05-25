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

function applyExecutionWill(cardState: CardState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const removeHandCardAt = deps && deps.removeHandCardAt;
    const addCardToDiscard = deps && deps.addCardToDiscard;
    const resolveDeterministicRandomIndex = deps && deps.resolveDeterministicRandomIndex;

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

    const requestedCount = Math.min(3, opponentHand.length);
    if (requestedCount <= 0) {
        clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'opponent_hand_empty', opponentKey, requestedCount: 0, destroyedCount: 0, destroyedCardIds: [] };
    }

    const destroyedCardIds: string[] = [];
    for (let destroyIndex = 0; destroyIndex < requestedCount; destroyIndex += 1) {
        if (opponentHand.length <= 0) break;
        const handIndex = resolveDeterministicRandomIndex(
            opponentHand.length,
            prng,
            null,
            'CardHandEffects.applyExecutionWill'
        );
        const removed = removeHandCardAt(cardState, opponentKey, handIndex);
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
    applyExecutionWill
};
