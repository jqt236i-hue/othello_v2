"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function applyHeavenBlessingChoice(cardState, playerKey, selectedCardId, deps) {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const addCardToHand = deps && deps.addCardToHand;
    const MAX_HAND_SIZE = deps && deps.MAX_HAND_SIZE;
    if (typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof addCardToHand !== 'function') {
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
    const vanished = offers.filter((id) => id !== selectedCardId);
    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, selectedCardId, vanished };
}
function applyRevealHandWill(cardState, playerKey, deps) {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const revealCurrentHandToViewer = deps && deps.revealCurrentHandToViewer;
    if (typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof revealCurrentHandToViewer !== 'function') {
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
function parseHiddenHandToken(value) {
    if (typeof value !== 'string')
        return null;
    const m = /^__hidden_hand__:(black|white):(d+)$/.exec(value);
    if (!m)
        return null;
    return { owner: m[1], handIndex: Number(m[2]) };
}
function applyCondemnWill(cardState, playerKey, targetIndex, deps) {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const removeHandCardAt = deps && deps.removeHandCardAt;
    const addCardToDiscard = deps && deps.addCardToDiscard;
    if (typeof readCardPendingEffect !== 'function' ||
        typeof clearCardPendingEffect !== 'function' ||
        typeof removeHandCardAt !== 'function' ||
        typeof addCardToDiscard !== 'function') {
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
    const offer = offers.find((o) => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
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
const HandEffects = {
    applyHeavenBlessingChoice,
    applyRevealHandWill,
    parseHiddenHandToken,
    applyCondemnWill
};
module.exports = HandEffects;
//# sourceMappingURL=hand-effects.js.map