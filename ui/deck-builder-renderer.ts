'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DeckSpecHelpers = _require('../shared/deck-spec');

let TextTermHighlighterModule: any = null;
try {
  TextTermHighlighterModule = _require('./text-term-highlighter');
} catch (e) {
  TextTermHighlighterModule = null;
}

function ensureDeckSpecHelpers(): any {
  if (!DeckSpecHelpers || typeof DeckSpecHelpers.getEnabledCardDefs !== 'function') {
    throw new Error('DeckSpecHelpers is required');
  }
  return DeckSpecHelpers;
}

function clearElement(element: HTMLElement | null): void {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderGameTermText(element: HTMLElement | null, text: string, options?: { preserveLineBreaks?: boolean }): void {
  if (!element) return;
  const normalized = String(text || '');
  if (TextTermHighlighterModule && typeof TextTermHighlighterModule.renderTextWithGameTermHighlights === 'function') {
    TextTermHighlighterModule.renderTextWithGameTermHighlights(element, normalized, {
      documentRef: element.ownerDocument || document,
      preserveLineBreaks: !!(options && options.preserveLineBreaks)
    });
    return;
  }
  element.textContent = normalized;
}

function measureElementOffsetWithinContainer(container: HTMLElement | null, element: HTMLElement | null): { top: number; left: number } | null {
  if (!container || !element) return null;
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

function captureBodyScrollState(container: HTMLElement | null, options: any): any {
  if (!container) return null;

  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.preserveBodyScroll !== true) return null;

  const anchorSelector = typeof opts.anchorSelector === 'string' ? opts.anchorSelector.trim() : '';
  const anchorElement = opts.anchorElement && typeof opts.anchorElement === 'object'
    ? opts.anchorElement
    : null;
  const anchorTarget = anchorElement || (anchorSelector ? container.querySelector(anchorSelector) : null);

  return {
    scrollTop: Number(container.scrollTop) || 0,
    scrollLeft: Number(container.scrollLeft) || 0,
    anchorSelector,
    anchorOffset: measureElementOffsetWithinContainer(container, anchorTarget as HTMLElement)
  };
}

function restoreBodyScrollState(container: HTMLElement | null, scrollState: any): void {
  if (!container || !scrollState) return;

  container.scrollTop = scrollState.scrollTop;
  container.scrollLeft = scrollState.scrollLeft;

  if (!scrollState.anchorSelector || !scrollState.anchorOffset) {
    return;
  }

  const anchorElement = container.querySelector(scrollState.anchorSelector);
  const nextAnchorOffset = measureElementOffsetWithinContainer(container, anchorElement as HTMLElement);
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

function getCardDisplayTypeLabel(cardDef: any): string {
  if (!cardDef || typeof cardDef !== 'object') return '';
  const label = String(cardDef.display_type_ja || cardDef.displayTypeJa || cardDef.displayTypeLabel || '').trim();
  return label || '';
}

function getCardDisplayTypeKey(cardDef: any): string {
  const label = getCardDisplayTypeLabel(cardDef);
  const typeKeyMap: Record<string, string> = { '採掘':'mining', '守護':'guard', '戦闘':'battle', '執行':'judgment', '禁忌':'taboo', '殲滅':'annihilation', '繁栄':'prosperity', '特殊':'special' };
  return typeKeyMap[label] || '';
}

function applyCardSpecialArtIfAvailable(cardEl: HTMLElement, cardDef: any): HTMLElement {
  if (!cardEl || !cardDef) return cardEl;
  if (typeof window !== 'undefined' && typeof (window as any).applyCardSpecialArtToFace === 'function') {
    (window as any).applyCardSpecialArtToFace(cardEl, cardDef, { cardId: cardDef.id });
  }
  return cardEl;
}

function ensureCardBadges(cardEl: HTMLElement, cardDef: any): HTMLElement {
  if (!cardEl || !cardDef) return cardEl;

  const typeKey = getCardDisplayTypeKey(cardDef);
  if (typeKey) {
    cardEl.dataset.cardType = typeKey;
  } else {
    delete cardEl.dataset.cardType;
  }

  const cost = Number(cardDef.cost) || 0;
  let costBadge = cardEl.querySelector('.card-cost-badge');
  if (!costBadge) {
    costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
  }
  (costBadge as HTMLElement).textContent = '';
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

function createFallbackCardFace(cardDef: any): HTMLElement {
  const cardEl = document.createElement('div');
  cardEl.className = 'card-item visible';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'card-name';
  nameSpan.textContent = cardDef && cardDef.name ? cardDef.name : String(cardDef && cardDef.id ? cardDef.id : '?');
  cardEl.appendChild(nameSpan);
  try {
    if (typeof window !== 'undefined' && typeof (window as any).fitCardNameElement === 'function') {
      (window as any).fitCardNameElement(nameSpan);
    }
  } catch (e) { /* ignore */ }

  applyCardSpecialArtIfAvailable(cardEl, cardDef);
  return ensureCardBadges(cardEl, cardDef);
}

function createDeckCardElement(cardDef: any, options?: any): HTMLElement {
  const opts = (options && typeof options === 'object') ? options : {};
  const createCardFaceElement = (typeof window !== 'undefined' && typeof (window as any).createCardFaceElement === 'function')
    ? (window as any).createCardFaceElement
    : null;

  let cardEl: HTMLElement | null = null;
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
  applyCardSpecialArtIfAvailable(cardEl, cardDef);
  ensureCardBadges(cardEl, cardDef);

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

  if (opts.detailButton !== false) {
    const detailButton = document.createElement('button');
    detailButton.type = 'button';
    detailButton.className = 'deck-builder-card-detail-btn';
    detailButton.textContent = '詳細';
    detailButton.setAttribute('aria-label', `${cardDef && cardDef.name ? cardDef.name : 'カード'} の効果詳細`);
    detailButton.setAttribute('aria-pressed', opts.detailActive ? 'true' : 'false');
    detailButton.addEventListener('click', (event: any) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof opts.onDetailClick === 'function') {
        opts.onDetailClick(event);
      }
    });
    cardEl.appendChild(detailButton);
  }

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

function createCardEffectTextBlock(label: string, text: string, className: string): HTMLElement | null {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  const block = document.createElement('div');
  block.className = className;

  const labelEl = document.createElement('div');
  labelEl.className = 'deck-builder-card-detail-label';
  labelEl.textContent = label;
  block.appendChild(labelEl);

  const textEl = document.createElement('div');
  textEl.className = 'deck-builder-card-detail-text';
  renderGameTermText(textEl, normalized, { preserveLineBreaks: true });
  block.appendChild(textEl);

  return block;
}

function getDeckBuilderTagKindClass(kind: any): string {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  if (!normalizedKind) return '';
  return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
}

function formatDeckBuilderDetailTagLabel(tag: any): string {
  const label = String(tag && tag.label || '').trim();
  const kind = String(tag && tag.kind || '').trim().toLowerCase();
  const value = Math.floor(Number(tag && tag.value));
  if (Number.isFinite(value) && value > 0) {
    if (kind === 'flip-evasion') return `反転回避${value}回`;
    if (kind === 'destroy-evasion') return `破壊回避${value}回`;
  }
  return label;
}

function normalizeDeckBuilderDetailTags(tags: any): any[] {
  if (!Array.isArray(tags)) return [];
  const normalizedTags: any[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (!tag || typeof tag !== 'object') continue;
    const label = formatDeckBuilderDetailTagLabel(tag);
    if (!label) continue;
    const kind = String(tag.kind || '').trim().toLowerCase();
    const dedupeKey = `${kind}:${label}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalizedTags.push({ kind, label });
  }
  return normalizedTags;
}

function createDeckBuilderDetailTagsBlock(tags: any): HTMLElement | null {
  const normalizedTags = normalizeDeckBuilderDetailTags(tags);
  if (normalizedTags.length === 0) return null;

  const block = document.createElement('div');
  block.className = 'deck-builder-card-detail-tag-block';

  const labelEl = document.createElement('div');
  labelEl.className = 'deck-builder-card-detail-label';
  labelEl.textContent = '効果タグ';
  block.appendChild(labelEl);

  const listEl = document.createElement('div');
  listEl.className = 'deck-builder-card-detail-tag-list';
  for (const tag of normalizedTags) {
    const chip = document.createElement('span');
    chip.className = 'card-detail-effect-tag deck-builder-card-detail-tag';
    const kindClass = getDeckBuilderTagKindClass(tag.kind);
    if (kindClass) chip.classList.add(kindClass);
    chip.textContent = tag.label;
    chip.setAttribute('data-card-tag-kind', tag.kind || '');
    chip.setAttribute('data-card-tag-label', tag.label);
    listEl.appendChild(chip);
  }
  block.appendChild(listEl);

  return block;
}

function createEditorCardDetailPopup(detailCard: any, handlers: any): HTMLElement | null {
  if (!detailCard || typeof detailCard !== 'object') return null;

  const backdrop = document.createElement('div');
  backdrop.className = 'deck-builder-card-detail-popup-backdrop';

  const popup = document.createElement('section');
  popup.className = 'deck-builder-card-detail-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', `${detailCard.cardName || 'カード'} の効果詳細`);
  popup.addEventListener('click', (event: any) => {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  });

  const header = document.createElement('div');
  header.className = 'deck-builder-card-detail-header';

  const title = document.createElement('div');
  title.className = 'deck-builder-card-detail-title';
  title.textContent = detailCard.cardName || 'カード効果';
  header.appendChild(title);

  const closeButton = createButton('×', 'btn-small deck-builder-card-detail-popup-close', () => {
    if (handlers && typeof handlers.onEditorCloseCardDetail === 'function') {
      handlers.onEditorCloseCardDetail();
    }
  });
  closeButton.setAttribute('aria-label', 'カード効果を閉じる');
  header.appendChild(closeButton);
  popup.appendChild(header);

  const quickBlock = createCardEffectTextBlock('効果', detailCard.quickText, 'deck-builder-card-detail-summary');
  if (quickBlock) popup.appendChild(quickBlock);

  const tagsBlock = createDeckBuilderDetailTagsBlock(detailCard.effectTags);
  if (tagsBlock) popup.appendChild(tagsBlock);

  const detailBlock = createCardEffectTextBlock('詳細効果', detailCard.detailText, 'deck-builder-card-detail-body');
  if (detailBlock) popup.appendChild(detailBlock);

  backdrop.appendChild(popup);
  return backdrop;
}

function createButton(text: string, className: string, onClick?: () => void, options?: any): HTMLButtonElement {
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

function classifyPresetSlotState(preset: any): string {
  if (!preset) return 'empty';
  if (preset.isActive) return 'active';
  if (preset.canUse) return 'filled';
  if (preset.noteIsError) return 'invalid';
  return 'empty';
}

function createPresetCard(preset: any, actions: HTMLElement): HTMLElement {
  const presetCard = document.createElement('div');
  presetCard.className = 'deck-builder-preset-card';
  const slotState = classifyPresetSlotState(preset);
  presetCard.classList.add(`is-${slotState}`);
  if (preset.isActive) {
    presetCard.classList.add('is-active');
  }
  if (typeof preset.id === 'string' && preset.id) {
    presetCard.dataset.presetId = preset.id;
  }
  presetCard.dataset.slotState = slotState;

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

  presetCard.appendChild(actions);
  return presetCard;
}

function renderPresetView(container: HTMLElement, viewModel: any, handlers: any): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'deck-builder-view deck-builder-view-presets';

  const intro = document.createElement('div');
  intro.className = 'deck-builder-intro';
  intro.textContent = '6つまで保存できます。使用で即時切替、編集で構築画面を開きます。';
  wrapper.appendChild(intro);

  const defaultPresetRow = document.createElement('div');
  defaultPresetRow.className = 'deck-builder-default-preset-row';

  const standardCard = document.createElement('div');
  standardCard.className = 'deck-builder-preset-card deck-builder-standard-card is-filled';
  standardCard.dataset.slotState = 'standard';
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
  defaultPresetRow.appendChild(standardCard);

  const builtInPresets = Array.isArray(viewModel.builtInPresets) ? viewModel.builtInPresets : [];
  if (builtInPresets.length > 0) {
    const builtInSection = document.createElement('div');
    builtInSection.className = 'deck-builder-built-in-preset-section';

    const builtInTitle = document.createElement('div');
    builtInTitle.className = 'deck-builder-section-title';
    builtInTitle.textContent = 'デフォルトプリセットデッキ';
    builtInSection.appendChild(builtInTitle);

    const builtInGrid = document.createElement('div');
    builtInGrid.className = 'deck-builder-built-in-preset-grid deck-builder-preset-grid';
    builtInPresets.forEach((preset: any) => {
      const actions = document.createElement('div');
      actions.className = 'deck-builder-actions-row';
      actions.appendChild(createButton('使用', 'btn-small', () => handlers.onUseBuiltInPreset(preset.id), { disabled: !preset.canUse }));
      actions.appendChild(createButton('編集', 'btn-small', () => handlers.onEditBuiltInPreset(preset.id), { disabled: !preset.canUse }));
      builtInGrid.appendChild(createPresetCard(preset, actions));
    });
    builtInSection.appendChild(builtInGrid);
    defaultPresetRow.appendChild(builtInSection);
  }
  wrapper.appendChild(defaultPresetRow);

  const presetGrid = document.createElement('div');
  presetGrid.className = 'deck-builder-preset-grid';
  viewModel.presets.forEach((preset: any) => {
    const actions = document.createElement('div');
    actions.className = 'deck-builder-actions-row';
    actions.appendChild(createButton('使用', 'btn-small', () => handlers.onUsePreset(preset.id), { disabled: !preset.canUse }));
    actions.appendChild(createButton('編集', 'btn-small', () => handlers.onEditPreset(preset.id)));

    presetGrid.appendChild(createPresetCard(preset, actions));
  });
  wrapper.appendChild(presetGrid);

  container.appendChild(wrapper);
}

function renderEditorView(container: HTMLElement, viewModel: any, handlers: any): void {
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

  const destinationRow = document.createElement('label');
  destinationRow.className = 'deck-builder-name-row deck-builder-destination-row';
  const destinationLabel = document.createElement('span');
  destinationLabel.textContent = '保存先';
  destinationRow.appendChild(destinationLabel);
  const destinationSelect = document.createElement('select');
  destinationSelect.className = 'deck-builder-preset-destination-select compact-select';
  const presetOptions = Array.isArray(editor.presetOptions) ? editor.presetOptions : [];
  presetOptions.forEach((preset: any) => {
    const option = document.createElement('option');
    option.value = String(preset && preset.id || '');
    option.textContent = String(preset && preset.label || preset && preset.id || '');
    destinationSelect.appendChild(option);
  });
  destinationSelect.value = String(editor.destinationPresetId || '');
  destinationSelect.addEventListener('change', () => {
    handlers.onEditorDestinationChange(destinationSelect.value);
  });
  destinationRow.appendChild(destinationSelect);
  wrapper.appendChild(destinationRow);

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

  const detailPopup = createEditorCardDetailPopup(editor.detailCard, handlers);
  if (detailPopup) {
    wrapper.appendChild(detailPopup);
  }

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
  } else {
    const selectedGrid = document.createElement('div');
    selectedGrid.className = 'deck-builder-card-grid deck-builder-selected-grid';
    editor.selectedCards.forEach((entry: any) => {
      const selectedCard = createDeckCardElement(entry.cardDef, {
        count: entry.count,
        clickable: true,
        active: true,
        detailActive: editor.detailCard && editor.detailCard.cardId === entry.cardId,
        onDetailClick: (event: any) => handlers.onEditorShowCardDetail(entry.cardId, event, 'deck-builder-selected-grid'),
        footerText: '押すと1枚戻す',
        onClick: (event: any) => handlers.onEditorRemoveCard(entry.cardId, event)
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
  editor.candidateCards.forEach((entry: any) => {
    const candidateCard = createDeckCardElement(entry.cardDef, {
      count: entry.selectedCount,
      clickable: !entry.disabledAdd,
      disabled: entry.disabledAdd,
      detailActive: editor.detailCard && editor.detailCard.cardId === entry.cardId,
      onDetailClick: (event: any) => handlers.onEditorShowCardDetail(entry.cardId, event, 'deck-builder-candidate-grid'),
      footerText: entry.footerText,
      onClick: (event: any) => handlers.onEditorAddCard(entry.cardId, event)
    });
    candidateGrid.appendChild(candidateCard);
  });
  candidateSection.appendChild(candidateGrid);
  wrapper.appendChild(candidateSection);

  container.appendChild(wrapper);
}

function renderDeckBuilder(refs: any, viewModel: any, handlers: any, options?: any): void {
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

  if (!uiRefs.body) return;
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

export = DeckBuilderRendererModule;
