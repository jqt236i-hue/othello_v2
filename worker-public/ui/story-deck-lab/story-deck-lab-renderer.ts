'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function clearElement(element: HTMLElement | null): void {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createButton(text: string, className: string, onClick?: () => void, options?: any): HTMLButtonElement {
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

function ensureCardBadgeRow(cardEl: HTMLElement, cardDef: any): HTMLElement {
  if (!cardEl || !cardDef) return cardEl;

  const typeLabel = getCardDisplayTypeLabel(cardDef);
  const typeKey = getCardDisplayTypeKey(cardDef);
  if (typeKey) {
    cardEl.dataset.cardType = typeKey;
  }
  let badgeRow = cardEl.querySelector('.card-badge-row') as HTMLElement | null;
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
  } else if (typeBadge) {
    typeBadge.remove();
  }
  if (badgeRow && !badgeRow.querySelector('.card-type-badge')) {
    badgeRow.remove();
    badgeRow = null;
  }

  const cost = Number(cardDef.cost) || 0;
  let costBadge = cardEl.querySelector('.card-cost-badge') as HTMLElement | null;
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

function createFallbackCardFace(cardDef: any): HTMLElement {
  const cardEl = document.createElement('div');
  cardEl.className = 'card-item visible';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'card-name';
  nameSpan.textContent = cardDef && (cardDef.name || cardDef.name_ja) ? (cardDef.name || cardDef.name_ja) : String(cardDef && cardDef.id ? cardDef.id : '?');
  cardEl.appendChild(nameSpan);
  try {
    if (typeof window !== 'undefined' && typeof (window as any).fitCardNameElement === 'function') {
      (window as any).fitCardNameElement(nameSpan);
    }
  } catch (e) { /* ignore */ }

  applyCardSpecialArtIfAvailable(cardEl, cardDef);
  return ensureCardBadgeRow(cardEl, cardDef);
}

function getCardDisplayName(cardDef: any): string {
  if (!cardDef || typeof cardDef !== 'object') return '?';
  const displayName = String(cardDef.name || cardDef.name_ja || cardDef.id || '?').trim();
  return displayName || '?';
}

function hydrateCardFace(cardEl: HTMLElement, cardDef: any): HTMLElement {
  if (!cardEl || !cardDef) return cardEl;

  let nameEl = cardEl.querySelector('.card-name') as HTMLElement | null;
  if (!nameEl) {
    nameEl = document.createElement('span');
    nameEl.className = 'card-name';
    cardEl.insertBefore(nameEl, cardEl.firstChild || null);
  }
  if (!String(nameEl.textContent || '').trim()) {
    nameEl.textContent = getCardDisplayName(cardDef);
  }
  try {
    if (typeof window !== 'undefined' && typeof (window as any).fitCardNameElement === 'function') {
      (window as any).fitCardNameElement(nameEl);
    }
  } catch (e) { /* ignore */ }

  applyCardSpecialArtIfAvailable(cardEl, cardDef);
  return ensureCardBadgeRow(cardEl, cardDef);
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

function renderSelectedCards(container: HTMLElement | null, viewModel: any, handlers: any): void {
  clearElement(container);
  if (!container) return;

  if (!viewModel.selectedCards.length) {
    const empty = document.createElement('div');
    empty.className = 'story-deck-lab-empty';
    empty.textContent = 'まだカードが入っていません';
    container.appendChild(empty);
    return;
  }

  viewModel.selectedCards.forEach((entry: any) => {
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

function renderCandidateCards(container: HTMLElement | null, viewModel: any, handlers: any): void {
  clearElement(container);
  if (!container) return;

  if (!viewModel.candidateCards.length) {
    const empty = document.createElement('div');
    empty.className = 'story-deck-lab-empty';
    empty.textContent = '検索条件に一致するカードがありません';
    container.appendChild(empty);
    return;
  }

  viewModel.candidateCards.forEach((entry: any) => {
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

function renderStoryDeckLab(refs: any, viewModel: any, handlers: any): void {
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

const StoryDeckLabRenderer = {
  renderStoryDeckLab
};

export = StoryDeckLabRenderer;
