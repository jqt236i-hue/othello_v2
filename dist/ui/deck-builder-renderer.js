'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const DeckSpecHelpers = _require('../shared/deck-spec');
function ensureDeckSpecHelpers() {
    if (!DeckSpecHelpers || typeof DeckSpecHelpers.getEnabledCardDefs !== 'function') {
        throw new Error('DeckSpecHelpers is required');
    }
    return DeckSpecHelpers;
}
function clearElement(element) {
    if (!element)
        return;
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}
function measureElementOffsetWithinContainer(container, element) {
    if (!container || !element)
        return null;
    if (typeof container.getBoundingClientRect !== 'function' || typeof element.getBoundingClientRect !== 'function') {
        return null;
    }
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const top = Number(elementRect && elementRect.top) - Number(containerRect && containerRect.top);
    const left = Number(elementRect && elementRect.left) - Number(containerRect && containerRect.left);
    if (!Number.isFinite(top) || !Number.isFinite(left)) {
        return null;
    }
    return { top, left };
}
function captureBodyScrollState(container, options) {
    if (!container)
        return null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.preserveBodyScroll !== true)
        return null;
    const anchorSelector = typeof opts.anchorSelector === 'string' ? opts.anchorSelector.trim() : '';
    const anchorElement = opts.anchorElement && typeof opts.anchorElement === 'object'
        ? opts.anchorElement
        : null;
    const anchorTarget = anchorElement || (anchorSelector ? container.querySelector(anchorSelector) : null);
    return {
        scrollTop: Number(container.scrollTop) || 0,
        scrollLeft: Number(container.scrollLeft) || 0,
        anchorSelector,
        anchorOffset: measureElementOffsetWithinContainer(container, anchorTarget)
    };
}
function restoreBodyScrollState(container, scrollState) {
    if (!container || !scrollState)
        return;
    container.scrollTop = scrollState.scrollTop;
    container.scrollLeft = scrollState.scrollLeft;
    if (!scrollState.anchorSelector || !scrollState.anchorOffset) {
        return;
    }
    const anchorElement = container.querySelector(scrollState.anchorSelector);
    const nextAnchorOffset = measureElementOffsetWithinContainer(container, anchorElement);
    if (!nextAnchorOffset) {
        return;
    }
    const deltaTop = nextAnchorOffset.top - scrollState.anchorOffset.top;
    const deltaLeft = nextAnchorOffset.left - scrollState.anchorOffset.left;
    if (Number.isFinite(deltaTop) && deltaTop !== 0) {
        container.scrollTop = (Number(container.scrollTop) || 0) + deltaTop;
    }
    if (Number.isFinite(deltaLeft) && deltaLeft !== 0) {
        container.scrollLeft = (Number(container.scrollLeft) || 0) + deltaLeft;
    }
}
function getCardDisplayTypeLabel(cardDef) {
    if (!cardDef || typeof cardDef !== 'object')
        return '';
    const label = String(cardDef.display_type_ja || cardDef.displayTypeJa || cardDef.displayTypeLabel || '').trim();
    return label || '';
}
function getCardDisplayTypeKey(cardDef) {
    const label = getCardDisplayTypeLabel(cardDef);
    const typeKeyMap = { '採掘': 'mining', '守護': 'guard', '戦闘': 'battle', '執行': 'judgment', '禁忌': 'taboo', '殲滅': 'annihilation', '繁栄': 'prosperity', '特殊': 'special' };
    return typeKeyMap[label] || '';
}
function applyCardSpecialArtIfAvailable(cardEl, cardDef) {
    if (!cardEl || !cardDef)
        return cardEl;
    if (typeof window !== 'undefined' && typeof window.applyCardSpecialArtToFace === 'function') {
        window.applyCardSpecialArtToFace(cardEl, cardDef, { cardId: cardDef.id });
    }
    return cardEl;
}
function ensureCardBadgeRow(cardEl, cardDef) {
    if (!cardEl || !cardDef)
        return cardEl;
    const typeLabel = getCardDisplayTypeLabel(cardDef);
    const typeKey = getCardDisplayTypeKey(cardDef);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }
    let badgeRow = cardEl.querySelector('.card-badge-row');
    let typeBadge = badgeRow ? badgeRow.querySelector('.card-type-badge') : null;
    if (typeLabel) {
        if (!badgeRow) {
            badgeRow = document.createElement('div');
            badgeRow.className = 'card-badge-row';
            cardEl.appendChild(badgeRow);
        }
        if (!typeBadge) {
            typeBadge = document.createElement('div');
            typeBadge.className = 'card-type-badge';
            badgeRow.insertBefore(typeBadge, badgeRow.firstChild || null);
        }
        typeBadge.textContent = typeLabel;
    }
    else if (typeBadge) {
        typeBadge.remove();
    }
    if (badgeRow && !badgeRow.querySelector('.card-type-badge')) {
        badgeRow.remove();
        badgeRow = null;
    }
    const cost = Number(cardDef.cost) || 0;
    let costBadge = cardEl.querySelector('.card-cost-badge');
    if (!costBadge) {
        costBadge = document.createElement('div');
        costBadge.className = 'card-cost-badge';
    }
    costBadge.textContent = '';
    const _cv = document.createElement('span');
    _cv.className = 'cost-value';
    _cv.textContent = String(cost);
    const _cl = document.createElement('span');
    _cl.className = 'cost-label';
    _cl.textContent = 'cost';
    costBadge.appendChild(_cv);
    costBadge.appendChild(_cl);
    if (costBadge.parentElement !== cardEl) {
        cardEl.appendChild(costBadge);
    }
    return cardEl;
}
function createFallbackCardFace(cardDef) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = cardDef && cardDef.name ? cardDef.name : String(cardDef && cardDef.id ? cardDef.id : '?');
    cardEl.appendChild(nameSpan);
    try {
        if (typeof window !== 'undefined' && typeof window.fitCardNameElement === 'function') {
            window.fitCardNameElement(nameSpan);
        }
    }
    catch (e) { /* ignore */ }
    applyCardSpecialArtIfAvailable(cardEl, cardDef);
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
        }
        catch (e) {
            cardEl = null;
        }
    }
    if (!cardEl) {
        cardEl = createFallbackCardFace(cardDef);
    }
    applyCardSpecialArtIfAvailable(cardEl, cardDef);
    ensureCardBadgeRow(cardEl, cardDef);
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
function createButton(text, className, onClick, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || 'btn-small';
    button.textContent = text;
    if (opts.disabled) {
        button.disabled = true;
    }
    if (opts.title) {
        button.title = opts.title;
    }
    if (typeof onClick === 'function') {
        button.addEventListener('click', onClick);
    }
    return button;
}
function renderPresetView(container, viewModel, handlers) {
    const wrapper = document.createElement('div');
    wrapper.className = 'deck-builder-view deck-builder-view-presets';
    const intro = document.createElement('div');
    intro.className = 'deck-builder-intro';
    intro.textContent = '3つまで保存できます。使用で即時切替、編集で構築画面を開きます。';
    wrapper.appendChild(intro);
    const standardCard = document.createElement('div');
    standardCard.className = 'deck-builder-preset-card deck-builder-standard-card';
    const standardTitle = document.createElement('div');
    standardTitle.className = 'deck-builder-preset-title';
    standardTitle.textContent = 'デフォルトデッキ';
    standardCard.appendChild(standardTitle);
    const standardSummary = document.createElement('div');
    standardSummary.className = 'deck-builder-preset-summary';
    standardSummary.textContent = viewModel.standardSummaryText;
    standardCard.appendChild(standardSummary);
    const standardActions = document.createElement('div');
    standardActions.className = 'deck-builder-actions-row';
    standardActions.appendChild(createButton('使用', 'btn-small', handlers.onUseStandard));
    standardCard.appendChild(standardActions);
    wrapper.appendChild(standardCard);
    const presetGrid = document.createElement('div');
    presetGrid.className = 'deck-builder-preset-grid';
    viewModel.presets.forEach((preset) => {
        const presetCard = document.createElement('div');
        presetCard.className = 'deck-builder-preset-card';
        if (preset.isActive) {
            presetCard.classList.add('is-active');
        }
        const title = document.createElement('div');
        title.className = 'deck-builder-preset-title';
        title.textContent = preset.displayName;
        presetCard.appendChild(title);
        const summary = document.createElement('div');
        summary.className = 'deck-builder-preset-summary';
        summary.textContent = preset.summaryText;
        presetCard.appendChild(summary);
        if (preset.noteText) {
            const note = document.createElement('div');
            note.className = `deck-builder-preset-note${preset.noteIsError ? ' is-error' : ''}`;
            note.textContent = preset.noteText;
            presetCard.appendChild(note);
        }
        const actions = document.createElement('div');
        actions.className = 'deck-builder-actions-row';
        actions.appendChild(createButton('使用', 'btn-small', () => handlers.onUsePreset(preset.id), { disabled: !preset.canUse }));
        actions.appendChild(createButton('編集', 'btn-small', () => handlers.onEditPreset(preset.id)));
        presetCard.appendChild(actions);
        presetGrid.appendChild(presetCard);
    });
    wrapper.appendChild(presetGrid);
    container.appendChild(wrapper);
}
function renderEditorView(container, viewModel, handlers) {
    const editor = viewModel.editor;
    const wrapper = document.createElement('div');
    wrapper.className = 'deck-builder-view deck-builder-view-editor';
    const topRow = document.createElement('div');
    topRow.className = 'deck-builder-editor-top';
    const headingGroup = document.createElement('div');
    headingGroup.className = 'deck-builder-editor-heading';
    const title = document.createElement('div');
    title.className = 'deck-builder-editor-title';
    title.textContent = editor.titleText;
    headingGroup.appendChild(title);
    const summary = document.createElement('div');
    summary.className = 'deck-builder-editor-summary';
    summary.textContent = editor.summaryText;
    headingGroup.appendChild(summary);
    topRow.appendChild(headingGroup);
    topRow.appendChild(createButton('戻る', 'btn-small', handlers.onEditorBack));
    wrapper.appendChild(topRow);
    const nameRow = document.createElement('label');
    nameRow.className = 'deck-builder-name-row';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = '名前';
    nameRow.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.value = editor.nameValue;
    nameInput.placeholder = 'プリセット名';
    nameInput.addEventListener('input', () => {
        handlers.onEditorNameInput(nameInput.value);
    });
    nameRow.appendChild(nameInput);
    wrapper.appendChild(nameRow);
    const actionRow = document.createElement('div');
    actionRow.className = 'deck-builder-actions-row';
    actionRow.appendChild(createButton('保存', 'btn-small', handlers.onEditorSave, { disabled: !editor.canSave }));
    actionRow.appendChild(createButton('使用', 'btn-small', handlers.onEditorUse, { disabled: !editor.canUse }));
    actionRow.appendChild(createButton('コード読込', 'btn-small', handlers.onEditorImportCode));
    actionRow.appendChild(createButton('コードコピー', 'btn-small', handlers.onEditorCopyCode, { disabled: !editor.canCopy }));
    wrapper.appendChild(actionRow);
    const codeBlock = document.createElement('div');
    codeBlock.className = 'deck-builder-code-block';
    const codeLabel = document.createElement('div');
    codeLabel.className = 'deck-builder-section-title';
    codeLabel.textContent = 'deckCode';
    codeBlock.appendChild(codeLabel);
    const codeInput = document.createElement('textarea');
    codeInput.className = 'deck-builder-code-input';
    codeInput.rows = 3;
    codeInput.value = editor.codeInputValue;
    codeInput.placeholder = 'D1C1:...';
    codeInput.addEventListener('input', () => {
        handlers.onEditorCodeInput(codeInput.value);
    });
    codeBlock.appendChild(codeInput);
    wrapper.appendChild(codeBlock);
    const selectedSection = document.createElement('div');
    selectedSection.className = 'deck-builder-section';
    const selectedTitle = document.createElement('div');
    selectedTitle.className = 'deck-builder-section-title';
    selectedTitle.textContent = '選択中カード';
    selectedSection.appendChild(selectedTitle);
    if (editor.selectedCards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'deck-builder-empty';
        empty.textContent = 'まだカードが入っていません';
        selectedSection.appendChild(empty);
    }
    else {
        const selectedGrid = document.createElement('div');
        selectedGrid.className = 'deck-builder-card-grid deck-builder-selected-grid';
        editor.selectedCards.forEach((entry) => {
            const selectedCard = createDeckCardElement(entry.cardDef, {
                count: entry.count,
                clickable: true,
                active: true,
                footerText: '押すと1枚戻す',
                onClick: (event) => handlers.onEditorRemoveCard(entry.cardId, event)
            });
            selectedGrid.appendChild(selectedCard);
        });
        selectedSection.appendChild(selectedGrid);
    }
    wrapper.appendChild(selectedSection);
    const candidateSection = document.createElement('div');
    candidateSection.className = 'deck-builder-section';
    const candidateTitle = document.createElement('div');
    candidateTitle.className = 'deck-builder-section-title';
    candidateTitle.textContent = '候補カード';
    candidateSection.appendChild(candidateTitle);
    const candidateGrid = document.createElement('div');
    candidateGrid.className = 'deck-builder-card-grid deck-builder-candidate-grid';
    editor.candidateCards.forEach((entry) => {
        const candidateCard = createDeckCardElement(entry.cardDef, {
            count: entry.selectedCount,
            clickable: !entry.disabledAdd,
            disabled: entry.disabledAdd,
            footerText: entry.footerText,
            onClick: (event) => handlers.onEditorAddCard(entry.cardId, event)
        });
        candidateGrid.appendChild(candidateCard);
    });
    candidateSection.appendChild(candidateGrid);
    wrapper.appendChild(candidateSection);
    container.appendChild(wrapper);
}
function renderDeckBuilder(refs, viewModel, handlers, options) {
    const uiRefs = refs || {};
    const model = (viewModel && typeof viewModel === 'object') ? viewModel : {};
    const callbacks = (handlers && typeof handlers === 'object') ? handlers : {};
    const renderOptions = (options && typeof options === 'object') ? options : {};
    const bodyScrollState = captureBodyScrollState(uiRefs.body, renderOptions);
    if (uiRefs.overlay) {
        uiRefs.overlay.classList.toggle('is-open', model.overlayOpen === true);
        uiRefs.overlay.setAttribute('aria-hidden', model.overlayOpen === true ? 'false' : 'true');
    }
    if (uiRefs.openBtn) {
        uiRefs.openBtn.setAttribute('aria-expanded', model.overlayOpen === true ? 'true' : 'false');
    }
    if (uiRefs.headerSummary) {
        uiRefs.headerSummary.textContent = model.headerSummaryText || '';
    }
    if (uiRefs.controlSummary) {
        uiRefs.controlSummary.textContent = model.controlSummaryText || '';
        uiRefs.controlSummary.classList.toggle('is-room-override', model.roomOverrideActive === true);
    }
    if (!uiRefs.body)
        return;
    clearElement(uiRefs.body);
    if (model.noticeText) {
        const notice = document.createElement('div');
        notice.className = `deck-builder-notice${model.noticeIsError ? ' is-error' : ''}`;
        notice.textContent = model.noticeText;
        uiRefs.body.appendChild(notice);
    }
    if (model.effectiveSummaryText) {
        const effectiveSummary = document.createElement('div');
        effectiveSummary.className = 'deck-builder-effective-summary';
        effectiveSummary.textContent = model.effectiveSummaryText;
        uiRefs.body.appendChild(effectiveSummary);
    }
    if (model.view === 'editor') {
        renderEditorView(uiRefs.body, model, callbacks);
        restoreBodyScrollState(uiRefs.body, bodyScrollState);
        return;
    }
    renderPresetView(uiRefs.body, model, callbacks);
    restoreBodyScrollState(uiRefs.body, bodyScrollState);
}
const DeckBuilderRendererModule = {
    renderDeckBuilder,
    getEnabledCardDefs: () => ensureDeckSpecHelpers().getEnabledCardDefs()
};
module.exports = DeckBuilderRendererModule;
//# sourceMappingURL=deck-builder-renderer.js.map