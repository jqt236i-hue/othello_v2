// ===== Card Rendering =====

function getCardCostTier(cost) {
    const safeCost = Number.isFinite(cost) ? cost : 0;
    if (safeCost >= 21) return 'gold';
    if (safeCost >= 16) return 'purple';
    if (safeCost >= 11) return 'blue';
    if (safeCost >= 6) return 'red';
    return 'gray';
}

function renderCardUI() {
    // Get elements
    const deckBlackEl = document.getElementById('deck-black');
    const deckWhiteEl = document.getElementById('deck-white');
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');

    // Update charge display
    const chargeBlackEl = document.getElementById('charge-black');
    const chargeWhiteEl = document.getElementById('charge-white');
    if (chargeBlackEl) {
        chargeBlackEl.textContent = `布石: ${cardState.charge.black || 0} / 30`;
    }
    if (chargeWhiteEl) {
        chargeWhiteEl.textContent = `布石: ${cardState.charge.white || 0} / 30`;
    }

    // Update deck visuals (shared deck - both show same count)
    const deckCount = cardState.deck.length;
    const totalDeck = Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : 30;
    const deckRatio = Math.max(0, Math.min(1, deckCount / Math.max(1, totalDeck)));

    // Set visuals for Black deck (shared)
    if (deckBlackEl) {
        deckBlackEl.style.setProperty('--deck-ratio', deckRatio);
        const countLabel = deckBlackEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${deckCount}/${totalDeck}`;
    }

    // Set visuals for White deck (shared - same values)
    if (deckWhiteEl) {
        deckWhiteEl.style.setProperty('--deck-ratio', deckRatio);
        const countLabel = deckWhiteEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${deckCount}/${totalDeck}`;
    }

    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;

    // Render player's hand (visible cards with click handlers)
    if (handBlackEl) {
        handBlackEl.innerHTML = '';
        const isBlackTurn = gameState.currentPlayer === BLACK;
        // Allow visual interaction unless an animation is playing.
        // Keep actual 'use' guarded elsewhere to prevent action during processing.
        const isAnimating = ((typeof isCardAnimating !== 'undefined' && !!isCardAnimating) || (typeof window !== 'undefined' && !!window.isCardAnimating) || (typeof window !== 'undefined' && window.VisualPlaybackActive === true));
        const playerKey = isDebugHvH ? (gameState.currentPlayer === BLACK ? 'black' : 'white') : 'black';
        const pending = cardState.pendingEffectByPlayer[playerKey];
        const allowDuringAnimForSell = !!(pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget');
        const canInteract = !isAnimating || allowDuringAnimForSell;
        const fadeState = (typeof window !== 'undefined')
            ? (window.__handFadeInState || window.__handFadeInHint || null)
            : null;
        const fadePlayerKey = fadeState && fadeState.playerKey ? fadeState.playerKey : null;
        const fadeCount = fadeState && Number.isFinite(fadeState.count) ? fadeState.count : 0;
        const shouldFadeBlack = fadePlayerKey === 'black' && fadeCount > 0;
        const blackHandLen = cardState.hands.black.length;

        cardState.hands.black.forEach((cardId, idx) => {
            const cardDef = CARD_DEFS.find(c => c.id === cardId);
            const cardEl = document.createElement('div');
            cardEl.className = 'card-item visible';

            // Determine usability: same rules as use-button
            const cost = cardDef ? (cardDef.cost || 0) : 0;
            const costTier = getCardCostTier(cost);
            const tierClass = `cost-tier-${costTier}`;
            cardEl.classList.add(tierClass);
            const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
            const hasNotUsedThisTurn = isDebugUnlimited ? true : !cardState.hasUsedCardThisTurnByPlayer[playerKey];
            const canAfford = isDebugUnlimited ? true : ((cardState.charge[playerKey] || 0) >= cost);
            const usable = (isBlackTurn || (isDebugHvH && gameState.currentPlayer === BLACK)) && canInteract && hasNotUsedThisTurn && canAfford;

            // Add clickable class if it's black's turn and can interact (or debug HvH mode)
            if ((isBlackTurn || (isDebugHvH && gameState.currentPlayer === BLACK)) && canInteract) {
                cardEl.classList.add('clickable');
            }

            // Add usable class only when the card can actually be used now
            if (usable) {
                cardEl.classList.add('usable');
            }

            // Add selected class if this card is selected
            if (cardState.selectedCardId === cardId) {
                cardEl.classList.add('selected');
            }

            // Card name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'card-name';
            nameSpan.textContent = cardDef ? cardDef.name : '?';
            cardEl.appendChild(nameSpan);

            // Cost badge
            const costBadge = document.createElement('div');
            costBadge.className = 'card-cost-badge';
            costBadge.classList.add(tierClass);
            costBadge.textContent = `コスト${cost}`;
            cardEl.appendChild(costBadge);

            cardEl.dataset.cardId = cardId;

            if (shouldFadeBlack && idx >= Math.max(0, blackHandLen - fadeCount)) {
                // Mark the newest N cards as hidden before the fade-in animation starts.
                cardEl.classList.add('card-fade-prep');
            }

            // Click handler for black hand cards only
            cardEl.addEventListener('click', () => onCardClick(cardId));

            handBlackEl.appendChild(cardEl);
        });
    }

    // Render opponent's hand
    if (handWhiteEl) {
        handWhiteEl.innerHTML = '';
        const fadeState = (typeof window !== 'undefined')
            ? (window.__handFadeInState || window.__handFadeInHint || null)
            : null;
        const fadePlayerKey = fadeState && fadeState.playerKey ? fadeState.playerKey : null;
        const fadeCount = fadeState && Number.isFinite(fadeState.count) ? fadeState.count : 0;
        const shouldFadeWhite = fadePlayerKey === 'white' && fadeCount > 0;
        const whiteHandLen = cardState.hands.white.length;
        cardState.hands.white.forEach((cardId, idx) => {
            const cardEl = document.createElement('div');
            const canShow = isDebugHvH === true;
            if (!canShow) {
                cardEl.className = 'card-item hidden';
                // Keep only dataset for animation lookup; do not reveal actual info
                cardEl.dataset.cardId = cardId;
                cardEl.textContent = 'CARD';
            } else {
                const cardDef = CARD_DEFS.find(c => c.id === cardId);
                cardEl.className = 'card-item visible';
                const isWhiteTurn = gameState.currentPlayer === WHITE;
                const isAnimating = ((typeof isCardAnimating !== 'undefined' && !!isCardAnimating) || (typeof window !== 'undefined' && !!window.isCardAnimating) || (typeof window !== 'undefined' && window.VisualPlaybackActive === true));
                const playerKey = 'white';
                const pending = cardState.pendingEffectByPlayer[playerKey];
                const allowDuringAnimForSell = !!(pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget');
                const canInteract = !isAnimating || allowDuringAnimForSell;
                const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
                const hasNotUsedThisTurn = isDebugUnlimited ? true : !cardState.hasUsedCardThisTurnByPlayer[playerKey];
                const cost = cardDef ? (cardDef.cost || 0) : 0;
                const costTier = getCardCostTier(cost);
                const tierClass = `cost-tier-${costTier}`;
                cardEl.classList.add(tierClass);
                const canAfford = isDebugUnlimited ? true : ((cardState.charge[playerKey] || 0) >= cost);
                const usable = (isWhiteTurn || (isDebugHvH && gameState.currentPlayer === WHITE)) && canInteract && hasNotUsedThisTurn && canAfford;
                if ((isWhiteTurn || (isDebugHvH && gameState.currentPlayer === WHITE)) && canInteract) {
                    cardEl.classList.add('clickable');
                }
                if (usable) {
                    cardEl.classList.add('usable');
                }
                if (cardState.selectedCardId === cardId) {
                    cardEl.classList.add('selected');
                }
                const nameSpan = document.createElement('span');
                nameSpan.className = 'card-name';
                nameSpan.textContent = cardDef ? cardDef.name : '?';
                cardEl.appendChild(nameSpan);
                const costBadge = document.createElement('div');
                costBadge.className = 'card-cost-badge';
                costBadge.classList.add(tierClass);
                costBadge.textContent = `コスト${cost}`;
                cardEl.appendChild(costBadge);
                cardEl.addEventListener('click', () => onCardClick(cardId));
            }
            if (shouldFadeWhite && idx >= Math.max(0, whiteHandLen - fadeCount)) {
                cardEl.classList.add('card-fade-prep');
            }
            handWhiteEl.appendChild(cardEl);
        });
    }

    // Update Card Detail Panel
    updateCardDetailPanel();

    // Update Discard Display
    const discardCountEl = document.getElementById('discard-count');
    if (discardCountEl) {
        discardCountEl.textContent = cardState.discard.length;
    }

    // Update Active Effect Slots (Phase 2: always empty)
    const activeBlackEl = document.getElementById('active-black');
    const activeWhiteEl = document.getElementById('active-white');
    if (activeBlackEl) {
        const content = activeBlackEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = (cardState.activeEffectsByPlayer && cardState.activeEffectsByPlayer.black) || [];
            content.textContent = effects.length > 0 ? effects.map(e => e.name).join(', ') : 'なし';
        }
    }
    if (activeWhiteEl) {
        const content = activeWhiteEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = cardState.activeEffectsByPlayer.white;
            content.textContent = effects.length > 0 ? effects.map(e => e.name).join(', ') : 'なし';
        }
    }
}


