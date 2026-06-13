export {};

type OverlayRefs = {
    root: any;
    offers: any;
    warning: any;
    detailName: any;
    detailDesc: any;
    selectBtn: any;
    reason: any;
} | null;

type OverlayViewDeps = {
    getDocumentRef: () => any;
    getWindowRef: () => any;
    getOverlayRefs: () => OverlayRefs;
    setOverlayRefs: (refs: OverlayRefs) => any;
    getCardStateValue: () => any;
    getHandLimit: () => number;
    getHeavenSelection: (playerKey: any) => any;
    setHeavenSelection: (playerKey: any, offerKey: any) => any;
    resolveCardDef: (cardId: any) => any;
    getCardCostTier: (cost: any) => any;
    getCardDisplayTypeKey: (cardDef: any) => any;
    getCardDisplayLabel: (cardId: any, cardDef: any) => any;
    fitCardNameForDisplay: (nameEl: any) => any;
    appendCardDisplayBadges: (cardEl: any, cardDef: any, cost: any, tier: any) => any;
    createCardFaceElement?: (cardId: any, options?: any) => any;
    getOverlayCardDescriptionText: (cardDef: any, cardId: any) => any;
    canInteractWithCardUi?: () => boolean;
    playUiEffectSound: (effectKey: any) => any;
    executeHeavenSelection: (playerKey: any, selectedCardId: any) => any;
    executeCondemnSelection: (playerKey: any, targetIndex: any, targetCardId: any) => any;
    executeObserverWillSelection: (playerKey: any, targetIndex: any, targetCardId: any) => any;
};

function ensureHeavenOverlay(deps: OverlayViewDeps) {
    const documentRef = deps.getDocumentRef();
    if (!documentRef) return null;
    const existingRefs = deps.getOverlayRefs();
    if (existingRefs && existingRefs.root && existingRefs.root.isConnected) {
        return existingRefs;
    }
    let root = documentRef.getElementById('heaven-blessing-overlay');
    if (!root) {
        root = documentRef.createElement('div');
        root.id = 'heaven-blessing-overlay';
        root.className = 'heaven-blessing-overlay';
        root.innerHTML = [
            '<div class="heaven-blessing-backdrop"></div>',
            '<div class="heaven-blessing-panel">',
            '  <div class="heaven-blessing-title">天の恵み</div>',
            '  <div class="heaven-blessing-subtitle">候補から1枚を選んで獲得</div>',
            '  <div class="heaven-blessing-warning" id="heaven-blessing-warning" hidden></div>',
            '  <div class="heaven-blessing-offers" id="heaven-blessing-offers"></div>',
            '  <div class="heaven-blessing-detail">',
            '    <div class="heaven-blessing-detail-name" id="heaven-blessing-detail-name">-</div>',
            '    <div class="heaven-blessing-detail-desc" id="heaven-blessing-detail-desc">カードを選択してください</div>',
            '    <button class="heaven-blessing-select-btn" id="heaven-blessing-select-btn" disabled>選択</button>',
            '    <div class="heaven-blessing-reason" id="heaven-blessing-reason"></div>',
            '  </div>',
            '</div>'
        ].join('');
        documentRef.body.appendChild(root);
    }
    const refs = {
        root,
        offers: root.querySelector('#heaven-blessing-offers'),
        warning: root.querySelector('#heaven-blessing-warning'),
        detailName: root.querySelector('#heaven-blessing-detail-name'),
        detailDesc: root.querySelector('#heaven-blessing-detail-desc'),
        selectBtn: root.querySelector('#heaven-blessing-select-btn'),
        reason: root.querySelector('#heaven-blessing-reason')
    };
    deps.setOverlayRefs(refs);
    return refs;
}

function hideHeavenOverlay(deps: OverlayViewDeps) {
    const refs = ensureHeavenOverlay(deps);
    if (!refs || !refs.root) return;
    refs.root.classList.remove('active');
}

function positionHeavenOverlayNearBoard(deps: OverlayViewDeps) {
    const refs = ensureHeavenOverlay(deps);
    if (!refs || !refs.root) return;
    const panel = refs.root.querySelector('.heaven-blessing-panel');
    const documentRef = deps.getDocumentRef();
    const windowRef = deps.getWindowRef();
    if (!panel || !documentRef || !windowRef) return;
    const boardFrame = documentRef.getElementById('board-frame');
    if (!boardFrame || !boardFrame.getBoundingClientRect) return;
    const rect = boardFrame.getBoundingClientRect();
    const targetLeft = Math.round(rect.left + (rect.width / 2));
    const liftUpPx = Math.round((96 / 2.54) * 5);
    let targetTop = Math.round(rect.bottom + 18 - liftUpPx);
    const estimatedHeight = 230;
    const maxTop = Math.max(12, windowRef.innerHeight - estimatedHeight - 8);
    if (targetTop > maxTop) targetTop = maxTop;
    if (targetTop < 12) targetTop = 12;
    panel.style.left = `${targetLeft}px`;
    panel.style.top = `${targetTop}px`;
    panel.style.transform = 'translate(-50%, 0)';
}

function getOverlayOfferKey(offer: any) {
    if (offer && typeof offer === 'object') {
        const idx = Number.isInteger(offer.handIndex) ? offer.handIndex : -1;
        return `${idx}:${offer.cardId || ''}`;
    }
    return String(offer || '');
}

function resolveOverlayOfferByKey(offers: any, offerKey: any) {
    if (!Array.isArray(offers) || !offers.length) return null;
    for (const offer of offers) {
        if (getOverlayOfferKey(offer) === offerKey) return offer;
    }
    return null;
}

function getOverlayOfferOwnerKey(pendingType: any, playerKey: any) {
    if (pendingType === 'CONDEMN_WILL' || pendingType === 'OBSERVER_WILL') {
        return playerKey === 'black' ? 'white' : 'black';
    }
    return playerKey;
}

function isHandOverlayPendingType(pendingType: any): boolean {
    return pendingType === 'HEAVEN_BLESSING' || pendingType === 'CONDEMN_WILL' || pendingType === 'OBSERVER_WILL';
}

function createFallbackOfferCard(cardId: any, cardDef: any, deps: OverlayViewDeps) {
    const cardEl = deps.getDocumentRef().createElement('div');
    cardEl.className = 'card-item visible';
    cardEl.dataset.cardId = cardId;
    const cost = cardDef ? (cardDef.cost || 0) : 0;
    const tier = deps.getCardCostTier(cost);
    cardEl.classList.add(`cost-tier-${tier}`);
    const typeKey = deps.getCardDisplayTypeKey(cardDef);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }
    const nameSpan = deps.getDocumentRef().createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = deps.getCardDisplayLabel(cardId, cardDef);
    cardEl.appendChild(nameSpan);
    deps.fitCardNameForDisplay(nameSpan);
    deps.appendCardDisplayBadges(cardEl, cardDef, cost, tier);
    return cardEl;
}

function createOverlayOfferCard(cardId: any, cardDef: any, ownerKey: any, deps: OverlayViewDeps) {
    if (typeof deps.createCardFaceElement === 'function') {
        try {
            const cardEl = deps.createCardFaceElement(cardId, { ownerKey });
            const nameEl = cardEl && typeof cardEl.querySelector === 'function'
                ? cardEl.querySelector('.card-name')
                : null;
            if (cardEl && (!nameEl || nameEl.textContent !== '?')) {
                return cardEl;
            }
        } catch (e) { /* fallback below */ }
    }
    return createFallbackOfferCard(cardId, cardDef, deps);
}

function renderHeavenOverlay(playerKey: any, deps: OverlayViewDeps) {
    const refs = ensureHeavenOverlay(deps);
    if (!refs || !refs.root) return;
    const cardStateValue = deps.getCardStateValue();
    const pending = cardStateValue && cardStateValue.pendingEffectByPlayer ? cardStateValue.pendingEffectByPlayer[playerKey] : null;
    const pendingType = pending && pending.type ? pending.type : null;
    const isSelecting = !!(pending && pending.stage === 'selectTarget' && isHandOverlayPendingType(pendingType));
    if (!isSelecting) {
        hideHeavenOverlay(deps);
        return;
    }
    const titleEl = refs.root.querySelector('.heaven-blessing-title');
    const subtitleEl = refs.root.querySelector('.heaven-blessing-subtitle');
    if (titleEl) titleEl.textContent = pendingType === 'CONDEMN_WILL' ? '断罪の意志' : (pendingType === 'OBSERVER_WILL' ? '盤理の観測者' : '天の恵み');
    if (subtitleEl) subtitleEl.textContent = pendingType === 'CONDEMN_WILL'
        ? '相手手札から1枚を選んで破壊'
        : (pendingType === 'OBSERVER_WILL' ? '相手手札から1枚を選んで獲得' : '候補から1枚を選んで獲得');
    if (refs.warning) {
        const showObserverWarning = pendingType === 'OBSERVER_WILL';
        refs.warning.hidden = !showObserverWarning;
        refs.warning.textContent = showObserverWarning
            ? '観測済みの相手手札はコスト+5。選択したカードは0コストで獲得。'
            : '';
    }

    const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
    if (!offers.length) {
        refs.root.classList.add('active');
        refs.offers.innerHTML = '';
        refs.detailName.textContent = '候補なし';
        refs.detailDesc.textContent = (pendingType === 'CONDEMN_WILL' || pendingType === 'OBSERVER_WILL') ? '対象カードがありません' : '候補カードがありません';
        refs.selectBtn.disabled = true;
        refs.reason.textContent = '';
        return;
    }

    let selectedKey = deps.getHeavenSelection(playerKey);
    if (!selectedKey || !resolveOverlayOfferByKey(offers, selectedKey)) {
        selectedKey = getOverlayOfferKey(offers[0]);
        deps.setHeavenSelection(playerKey, selectedKey);
    }

    const handSize = (cardStateValue && cardStateValue.hands && Array.isArray(cardStateValue.hands[playerKey])) ? cardStateValue.hands[playerKey].length : 0;
    const handFull = (pendingType === 'HEAVEN_BLESSING') ? (handSize >= deps.getHandLimit()) : false;

    refs.offers.innerHTML = '';
    for (const offer of offers) {
        const offerKey = getOverlayOfferKey(offer);
        const cardId = (offer && typeof offer === 'object') ? offer.cardId : offer;
        const def = deps.resolveCardDef(cardId);
        const offerOwnerKey = getOverlayOfferOwnerKey(pendingType, playerKey);
        const cardEl = createOverlayOfferCard(cardId, def, offerOwnerKey, deps);
        cardEl.classList.add('heaven-offer-card');
        cardEl.dataset.cardId = cardId;
        if (selectedKey === offerKey) cardEl.classList.add('selected');
        cardEl.addEventListener('click', () => {
            if (pendingType === 'HEAVEN_BLESSING' || pendingType === 'OBSERVER_WILL') {
                deps.playUiEffectSound('hand_card_select');
            }
            deps.setHeavenSelection(playerKey, offerKey);
            renderHeavenOverlay(playerKey, deps);
        });
        refs.offers.appendChild(cardEl);
    }

    const selectedOffer = resolveOverlayOfferByKey(offers, selectedKey);
    const selectedCardId = (selectedOffer && typeof selectedOffer === 'object') ? selectedOffer.cardId : selectedOffer;
    const selectedDef = deps.resolveCardDef(selectedCardId);
    refs.detailName.textContent = deps.getCardDisplayLabel(selectedCardId, selectedDef);
    refs.detailDesc.textContent = deps.getOverlayCardDescriptionText(selectedDef, selectedCardId);
    refs.selectBtn.textContent = pendingType === 'CONDEMN_WILL' ? '破壊' : (pendingType === 'OBSERVER_WILL' ? '奪う' : '選択');
    const canInteract = typeof deps.canInteractWithCardUi === 'function'
        ? deps.canInteractWithCardUi() !== false
        : true;
    refs.selectBtn.disabled = handFull || !selectedOffer || !canInteract;
    refs.selectBtn.onclick = () => {
        if (!canInteract) return;
        if (!selectedOffer) return;
        if (pendingType === 'CONDEMN_WILL') {
            const targetIndex = (selectedOffer && typeof selectedOffer === 'object') ? selectedOffer.handIndex : null;
            deps.executeCondemnSelection(playerKey, targetIndex, selectedCardId);
            return;
        }
        if (pendingType === 'OBSERVER_WILL') {
            const targetIndex = (selectedOffer && typeof selectedOffer === 'object') ? selectedOffer.handIndex : null;
            deps.executeObserverWillSelection(playerKey, targetIndex, selectedCardId);
            return;
        }
        deps.executeHeavenSelection(playerKey, selectedCardId);
    };
    refs.reason.textContent = handFull
        ? '手札上限のため選択できません'
        : (!canInteract ? '演出中...' : '');
    refs.root.classList.add('active');
    positionHeavenOverlayNearBoard(deps);
}

module.exports = {
    ensureHeavenOverlay,
    hideHeavenOverlay,
    positionHeavenOverlayNearBoard,
    getOverlayOfferKey,
    resolveOverlayOfferByKey,
    renderHeavenOverlay
};
