(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.StoryDeckLabRendererModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function clearElement(element) {
        if (!element) return;
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function createButton(text, className, onClick, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className || 'story-deck-lab-btn';
        button.textContent = text;
        if (opts.disabled) button.disabled = true;
        if (opts.title) button.title = opts.title;
        if (typeof onClick === 'function') {
            button.addEventListener('click', onClick);
        }
        return button;
    }

    function getCardDisplayTypeLabel(cardDef) {
        if (!cardDef || typeof cardDef !== 'object') return '';
        const label = String(cardDef.display_type_ja || cardDef.displayTypeJa || cardDef.displayTypeLabel || '').trim();
        return label || '';
    }

    function ensureCardBadgeRow(cardEl, cardDef) {
        if (!cardEl || !cardDef) return cardEl;

        let badgeRow = cardEl.querySelector('.card-badge-row');
        if (!badgeRow) {
            badgeRow = document.createElement('div');
            badgeRow.className = 'card-badge-row';
            cardEl.appendChild(badgeRow);
        }

        const typeLabel = getCardDisplayTypeLabel(cardDef);
        let typeBadge = badgeRow.querySelector('.card-type-badge');
        if (typeLabel) {
            if (!typeBadge) {
                typeBadge = document.createElement('div');
                typeBadge.className = 'card-type-badge';
                badgeRow.insertBefore(typeBadge, badgeRow.firstChild || null);
            }
            typeBadge.textContent = typeLabel;
        } else if (typeBadge) {
            typeBadge.remove();
        }

        const cost = Number(cardDef.cost) || 0;
        let costBadge = cardEl.querySelector('.card-cost-badge');
        if (!costBadge) {
            costBadge = document.createElement('div');
            costBadge.className = 'card-cost-badge';
        }
        costBadge.textContent = `コスト${cost}`;
        if (costBadge.parentElement !== badgeRow) {
            badgeRow.appendChild(costBadge);
        }

        return cardEl;
    }

    function createFallbackCardFace(cardDef) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card-item visible';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'card-name';
        nameSpan.textContent = cardDef && (cardDef.name || cardDef.name_ja) ? (cardDef.name || cardDef.name_ja) : String(cardDef && cardDef.id ? cardDef.id : '?');
        cardEl.appendChild(nameSpan);

        return ensureCardBadgeRow(cardEl, cardDef);
    }

    function getCardDisplayName(cardDef) {
        if (!cardDef || typeof cardDef !== 'object') return '?';
        const displayName = String(cardDef.name || cardDef.name_ja || cardDef.id || '?').trim();
        return displayName || '?';
    }

    function hydrateCardFace(cardEl, cardDef) {
        if (!cardEl || !cardDef) return cardEl;

        let nameEl = cardEl.querySelector('.card-name');
        if (!nameEl) {
            nameEl = document.createElement('span');
            nameEl.className = 'card-name';
            cardEl.insertBefore(nameEl, cardEl.firstChild || null);
        }
        if (!String(nameEl.textContent || '').trim()) {
            nameEl.textContent = getCardDisplayName(cardDef);
        }

        return ensureCardBadgeRow(cardEl, cardDef);
    }

    function createDeckCardElement(cardDef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const createCardFaceElement = (typeof window !== 'undefined' && typeof window.createCardFaceElement === 'function')
            ? window.createCardFaceElement
            : null;

        let cardEl = null;
        if (createCardFaceElement) {
            try {
                cardEl = createCardFaceElement(cardDef.id);
            } catch (e) {
                cardEl = null;
            }
        }
        if (!cardEl) {
            cardEl = createFallbackCardFace(cardDef);
        }
        hydrateCardFace(cardEl, cardDef);

        cardEl.classList.add('deck-builder-card');
        cardEl.dataset.cardId = cardDef.id;

        if (opts.disabled) {
            cardEl.classList.add('deck-builder-card-disabled');
        }
        if (opts.active) {
            cardEl.classList.add('deck-builder-card-active');
        }
        if (opts.clickable) {
            cardEl.classList.add('clickable');
        }

        const countBadge = document.createElement('div');
        countBadge.className = 'deck-builder-count-badge';
        countBadge.textContent = `x${Number(opts.count) || 0}`;
        cardEl.appendChild(countBadge);

        if (opts.footerText) {
            const footer = document.createElement('div');
            footer.className = 'deck-builder-card-footer';
            footer.textContent = String(opts.footerText);
            cardEl.appendChild(footer);
        }

        if (opts.clickable && typeof opts.onClick === 'function') {
            cardEl.addEventListener('click', opts.onClick);
        }

        return cardEl;
    }

    function renderSelectedCards(container, viewModel, handlers) {
        clearElement(container);
        if (!container) return;

        if (!viewModel.selectedCards.length) {
            const empty = document.createElement('div');
            empty.className = 'story-deck-lab-empty';
            empty.textContent = 'まだカードが入っていません';
            container.appendChild(empty);
            return;
        }

        viewModel.selectedCards.forEach((entry) => {
            const cardEl = createDeckCardElement(entry.cardDef, {
                count: entry.count,
                active: true,
                clickable: true,
                footerText: '押すと1枚戻す',
                onClick: () => handlers.onRemoveCard(entry.cardId)
            });
            container.appendChild(cardEl);
        });
    }

    function renderCandidateCards(container, viewModel, handlers) {
        clearElement(container);
        if (!container) return;

        if (!viewModel.candidateCards.length) {
            const empty = document.createElement('div');
            empty.className = 'story-deck-lab-empty';
            empty.textContent = '検索条件に一致するカードがありません';
            container.appendChild(empty);
            return;
        }

        viewModel.candidateCards.forEach((entry) => {
            const cardEl = createDeckCardElement(entry.cardDef, {
                count: entry.selectedCount,
                active: entry.selectedCount > 0,
                clickable: !entry.addDisabled,
                disabled: entry.addDisabled,
                footerText: '押すと追加',
                onClick: () => handlers.onAddCard(entry.cardId)
            });
            container.appendChild(cardEl);
        });
    }

    function renderStoryDeckLab(refs, viewModel, handlers) {
        const uiRefs = refs || {};
        const model = (viewModel && typeof viewModel === 'object') ? viewModel : {};
        const callbacks = (handlers && typeof handlers === 'object') ? handlers : {};

        if (uiRefs.ruleSetSelect) uiRefs.ruleSetSelect.value = model.ruleSetId || '';
        if (uiRefs.searchInput) uiRefs.searchInput.value = model.searchText || '';

        if (uiRefs.notice) {
            uiRefs.notice.textContent = model.noticeText || '';
            uiRefs.notice.className = `deck-builder-notice${model.noticeIsError ? ' is-error' : ''}`;
            uiRefs.notice.style.display = model.noticeText ? 'block' : 'none';
        }

        if (uiRefs.summary) {
            uiRefs.summary.textContent = `${model.summary.totalCount}/${model.summary.deckSize}枚 ・ 残り${model.summary.remainingCount}枚 ・ ${model.summary.distinctCount}種 ・ ${model.ruleSetDescription}`;
        }

        if (uiRefs.codeTextarea) {
            uiRefs.codeTextarea.value = model.codeValue || '';
            uiRefs.codeTextarea.placeholder = model.codePlaceholder || '';
        }
        if (uiRefs.copyBtn) uiRefs.copyBtn.disabled = !model.canCopyCode;
        if (uiRefs.clearBtn) uiRefs.clearBtn.disabled = model.summary.totalCount === 0;
        if (uiRefs.importBtn) uiRefs.importBtn.disabled = !model.canImportCode;
        if (uiRefs.selectedCountLabel) uiRefs.selectedCountLabel.textContent = `選択中カード (${model.selectedCards.length})`;
        if (uiRefs.candidateCountLabel) uiRefs.candidateCountLabel.textContent = `候補カード (${model.candidateCards.length})`;
        if (uiRefs.headerSummary) uiRefs.headerSummary.textContent = model.headerSummaryText || '';

        renderSelectedCards(uiRefs.selectedCards, model, callbacks);
        renderCandidateCards(uiRefs.candidateCards, model, callbacks);
    }

    return {
        renderStoryDeckLab
    };
}));
