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

function formatSlotNumber(slotIndex: any): string {
  const numericIndex = Number(slotIndex);
  if (!Number.isFinite(numericIndex) || numericIndex < 0) return '';
  return String(Math.floor(numericIndex) + 1).padStart(2, '0');
}

function createSlotBadgeElement(slotIndex: any): HTMLElement | null {
  const label = formatSlotNumber(slotIndex);
  if (!label) return null;
  const badge = document.createElement('div');
  badge.className = 'deck-builder-slot-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = `No.${label}`;
  return badge;
}

function createActiveStripElement(): HTMLElement {
  // Kept as alias for callers that still need a "this is active" marker;
  // visually the wax seal is now the primary active indicator via createActiveSealElement.
  const strip = document.createElement('div');
  strip.className = 'deck-builder-active-strip';
  strip.setAttribute('aria-hidden', 'true');
  strip.textContent = 'IN USE';
  return strip;
}

function createActiveSealElement(deckName: any): HTMLElement {
  const seal = document.createElement('div');
  seal.className = 'deck-builder-active-seal';
  seal.setAttribute('role', 'img');
  seal.setAttribute('aria-label', `${String(deckName || 'このデッキ')} は現在使用中です`);
  seal.setAttribute('aria-hidden', 'false');
  const inner = document.createElement('div');
  inner.className = 'deck-builder-active-seal-inner';
  inner.setAttribute('aria-hidden', 'true');
  inner.textContent = 'IN USE';
  seal.appendChild(inner);
  return seal;
}

function createSlotLabelEnElement(label: any): HTMLElement | null {
  const text = String(label || '').trim();
  if (!text) return null;
  const el = document.createElement('div');
  el.className = 'deck-builder-slot-label-en';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  return el;
}

function createCountOrbElement(deckSize: any): HTMLElement {
  const orb = document.createElement('div');
  orb.className = 'deck-builder-slot-count-orb';
  const value = Math.max(0, Math.floor(Number(deckSize) || 0));
  const valueEl = document.createElement('div');
  valueEl.className = 'deck-builder-slot-count-value';
  valueEl.textContent = String(value);
  const unitEl = document.createElement('small');
  unitEl.className = 'deck-builder-slot-count-unit';
  unitEl.textContent = '枚';
  valueEl.appendChild(unitEl);
  orb.appendChild(valueEl);
  return orb;
}

function createTypeSwatchBarElement(breakdown: any[]): HTMLElement | null {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
  const segments: Array<{ typeKey: string; proportion: number }> = [];
  for (const entry of breakdown) {
    if (!entry || typeof entry !== 'object') continue;
    const typeKey = String(entry.typeKey || '').trim();
    const proportion = Number(entry.proportion) || 0;
    if (!typeKey || proportion <= 0) continue;
    segments.push({ typeKey, proportion });
    if (segments.length >= 6) break;
  }
  if (segments.length === 0) return null;

  const bar = document.createElement('div');
  bar.className = 'deck-builder-slot-type-bar';
  bar.setAttribute('aria-hidden', 'true');
  for (const seg of segments) {
    const span = document.createElement('span');
    span.className = `deck-builder-slot-type-seg is-${seg.typeKey}`;
    span.style.flexGrow = String(Math.max(0.5, seg.proportion * 100));
    bar.appendChild(span);
  }
  return bar;
}

function createEmptySlotCtaElements() {
  const halo = document.createElement('div');
  halo.className = 'deck-builder-empty-halo';
  halo.setAttribute('aria-hidden', 'true');

  const plus = document.createElement('div');
  plus.className = 'deck-builder-empty-plus';
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';

  const cta = document.createElement('div');
  cta.className = 'deck-builder-empty-cta';
  cta.setAttribute('aria-hidden', 'true');
  cta.textContent = 'クリックして構築';

  return { halo, plus, cta };
}

function createPresetCard(preset: any, actions: HTMLElement, options?: any): HTMLElement {
  const opts = (options && typeof options === 'object') ? options : {};
  const presetCard = document.createElement('div');
  presetCard.className = 'deck-builder-preset-card deck-builder-save-slot-card';
  const slotState = classifyPresetSlotState(preset);
  presetCard.classList.add(`is-${slotState}`);
  if (preset.isActive) {
    presetCard.classList.add('is-active');
  }
  const dominantTypeKey = preset && typeof preset.dominantTypeKey === 'string'
    ? preset.dominantTypeKey.trim()
    : '';
  if (dominantTypeKey) {
    presetCard.classList.add(`is-${dominantTypeKey}`);
  }
  if (typeof preset.id === 'string' && preset.id) {
    presetCard.dataset.presetId = preset.id;
  }
  presetCard.dataset.slotState = slotState;

  // Slot index dataset (used by JS hooks/tests even if badge isn't shown)
  if (typeof opts.slotIndex === 'number') {
    presetCard.dataset.slotIndex = String(opts.slotIndex);
  }

  // Empty slot — halo + plus + cta + slot number label only
  if (slotState === 'empty') {
    const { halo, plus, cta } = createEmptySlotCtaElements();

    // Hidden title for back-compat with old test/a11y expectations ("空きスロット N")
    if (typeof opts.slotIndex === 'number') {
      const hiddenTitle = document.createElement('div');
      hiddenTitle.className = 'deck-builder-preset-title deck-builder-empty-sr-title';
      hiddenTitle.textContent = `空きスロット ${opts.slotIndex + 1}`;
      presetCard.appendChild(hiddenTitle);
    }

    presetCard.appendChild(halo);
    presetCard.appendChild(plus);
    presetCard.appendChild(cta);
    presetCard.appendChild(actions);
    return presetCard;
  }

  // Filled slot — wax seal (active) + meta column + count orb + swatch bar + actions
  if (preset.isActive && slotState === 'active') {
    presetCard.appendChild(createActiveSealElement(preset.displayName));
  } else if (preset.isActive) {
    // Active but canUse === false (rare) — fall back to strip for accessibility
    presetCard.appendChild(createActiveStripElement());
  }

  // Meta column (label-en + title + summary)
  const meta = document.createElement('div');
  meta.className = 'deck-builder-slot-meta';

  const labelEnText = `${preset.slotNumberLabel || ''}${preset.isActive ? ' · IN USE' : ''}`;
  const labelEn = createSlotLabelEnElement(labelEnText);
  if (labelEn) meta.appendChild(labelEn);

  const title = document.createElement('div');
  title.className = 'deck-builder-preset-title';
  title.textContent = preset.displayName;
  meta.appendChild(title);

  const summary = document.createElement('div');
  summary.className = 'deck-builder-preset-summary';
  summary.textContent = preset.summaryText;
  meta.appendChild(summary);

  presetCard.appendChild(meta);

  // Count orb on the right (filled only)
  if (slotState === 'filled' || slotState === 'active') {
    if (typeof preset.deckSize === 'number') {
      presetCard.appendChild(createCountOrbElement(preset.deckSize));
    }
  }

  // Type swatch bar (filled only)
  if (slotState === 'filled' || slotState === 'active') {
    const swatchBar = createTypeSwatchBarElement(preset.typeBreakdown);
    if (swatchBar) presetCard.appendChild(swatchBar);
  }

  if (preset.noteText) {
    const note = document.createElement('div');
    note.className = `deck-builder-preset-note${preset.noteIsError ? ' is-error' : ''}`;
    note.textContent = preset.noteText;
    presetCard.appendChild(note);
  }

  presetCard.appendChild(actions);
  return presetCard;
}

function createBuiltInPresetCard(preset: any, actions: HTMLElement): HTMLElement {
  const card = document.createElement('div');
  card.className = 'deck-builder-preset-card deck-builder-builtin-card';
  const slotState = classifyPresetSlotState(preset);
  card.classList.add(`is-${slotState}`);
  if (preset.isActive) {
    card.classList.add('is-active');
  }
  const dominantTypeKey = preset && typeof preset.dominantTypeKey === 'string'
    ? preset.dominantTypeKey.trim()
    : '';
  if (dominantTypeKey) {
    card.classList.add(`is-${dominantTypeKey}`);
  }
  if (typeof preset.id === 'string' && preset.id) {
    card.dataset.presetId = preset.id;
  }
  card.dataset.slotState = slotState;

  if (preset.isActive) {
    card.appendChild(createActiveSealElement(preset.displayName));
  }

  const gem = document.createElement('div');
  gem.className = 'deck-builder-builtin-gem';
  gem.setAttribute('aria-hidden', 'true');
  card.appendChild(gem);

  const meta = document.createElement('div');
  meta.className = 'deck-builder-builtin-meta';

  const title = document.createElement('div');
  title.className = 'deck-builder-preset-title';
  title.textContent = preset.displayName;
  meta.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'deck-builder-preset-summary';
  sub.textContent = preset.summaryText;
  meta.appendChild(sub);

  card.appendChild(meta);
  card.appendChild(actions);
  return card;
}

function createDefaultDeckHero(viewModel: any, onUse: any, isActive: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = `deck-builder-preset-card deck-builder-standard-card deck-builder-default-hero ${isActive ? 'is-active' : 'is-filled'}`;
  card.dataset.slotState = 'standard';

  if (isActive) {
    card.appendChild(createActiveSealElement('デフォルトデッキ'));
  }

  const sigil = document.createElement('div');
  sigil.className = 'deck-builder-hero-sigil';
  sigil.setAttribute('aria-hidden', 'true');
  sigil.textContent = 'DEFAULT HERALD';
  card.appendChild(sigil);

  const title = document.createElement('div');
  title.className = 'deck-builder-preset-title';
  title.textContent = 'デフォルトデッキ';
  card.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'deck-builder-preset-summary';
  sub.innerHTML = '<b>30枚</b> · 有効カードから重複なしランダム';
  card.appendChild(sub);

  const metaRow = document.createElement('div');
  metaRow.className = 'deck-builder-hero-meta';
  const pill = document.createElement('span');
  pill.className = 'deck-builder-format-pill';
  pill.textContent = 'STANDARD';
  metaRow.appendChild(pill);
  const metaText = document.createElement('span');
  metaText.className = 'deck-builder-hero-meta-text';
  metaText.textContent = 'フォーマット: スタンダード';
  metaRow.appendChild(metaText);
  card.appendChild(metaRow);

  const cta = createButton('使 用', 'btn-small deck-builder-hero-cta', typeof onUse === 'function' ? onUse : undefined);
  card.appendChild(cta);

  return card;
}

function createSectionIcon(svgInner: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'deck-builder-section-icon';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = svgInner;
  return wrap;
}

const BUILT_IN_SECTION_ICON_SVG = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5l5-2 5 2v6.6c0 .9-.45 1.74-1.2 2.24L8 14.8l-3.8-1.46A2.5 2.5 0 0 1 3 11.1V4.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.6 7.6L7.2 9.2l3.2-3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SAVE_SLOT_SECTION_ICON_SVG = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 6.4h11.6" stroke="currentColor" stroke-width="1.3"/><path d="M5 9.4h2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

function renderPresetView(container: HTMLElement, viewModel: any, handlers: any): void {
  const atelier = document.createElement('section');
  atelier.className = 'deck-builder-atelier-shell';
  atelier.setAttribute('aria-label', 'デッキ構築アーカイブ');

  const rail = document.createElement('aside');
  rail.className = 'deck-builder-atelier-rail';
  rail.setAttribute('aria-hidden', 'true');
  const railMark = document.createElement('div');
  railMark.className = 'deck-builder-atelier-mark';
  railMark.textContent = 'CARD\nARCHIVE';
  rail.appendChild(railMark);
  const railLine = document.createElement('div');
  railLine.className = 'deck-builder-atelier-rail-line';
  rail.appendChild(railLine);
  const railIndex = document.createElement('div');
  railIndex.className = 'deck-builder-atelier-index';
  railIndex.textContent = '01 — DECKS';
  rail.appendChild(railIndex);

  const stage = document.createElement('div');
  stage.className = 'deck-builder-atelier-stage';
  const wrapper = document.createElement('div');
  wrapper.className = 'deck-builder-view deck-builder-view-presets';

  const intro = document.createElement('div');
  intro.className = 'deck-builder-intro';
  intro.textContent = '6つまで保存できます。使用で即時切替、編集で構築画面を開きます。';
  wrapper.appendChild(intro);

  const workspace = document.createElement('div');
  workspace.className = 'deck-builder-workspace';

  const loadoutColumn = document.createElement('section');
  loadoutColumn.className = 'deck-builder-loadout-column';
  loadoutColumn.setAttribute('aria-label', 'デフォルトデッキと固定プリセット');

  const defaultPresetRow = document.createElement('div');
  defaultPresetRow.className = 'deck-builder-default-preset-row deck-builder-fixed-library';

  const savedPresets = Array.isArray(viewModel.presets) ? viewModel.presets : [];
  const builtInPresets = Array.isArray(viewModel.builtInPresets) ? viewModel.builtInPresets : [];
  const isStandardActive = !savedPresets.some((preset: any) => preset && preset.isActive)
    && !builtInPresets.some((preset: any) => preset && preset.isActive);
  const standardCard = createDefaultDeckHero(viewModel, handlers.onUseStandard, isStandardActive);
  defaultPresetRow.appendChild(standardCard);

  if (builtInPresets.length > 0) {
    const builtInSection = document.createElement('div');
    builtInSection.className = 'deck-builder-built-in-preset-section';

    const builtInTitle = document.createElement('div');
    builtInTitle.className = 'deck-builder-section-title deck-builder-section-title-with-icon';
    builtInTitle.appendChild(createSectionIcon(BUILT_IN_SECTION_ICON_SVG));
    const builtInTitleText = document.createElement('span');
    builtInTitleText.className = 'deck-builder-section-title-text';
    builtInTitleText.textContent = '固定プリセットライブラリ';
    builtInTitle.appendChild(builtInTitleText);
    builtInSection.appendChild(builtInTitle);

    const builtInGrid = document.createElement('div');
    builtInGrid.className = 'deck-builder-built-in-preset-grid deck-builder-preset-grid';
    builtInPresets.forEach((preset: any) => {
      const actions = document.createElement('div');
      actions.className = 'deck-builder-actions-row';
      actions.appendChild(createButton('使用', 'btn-small', () => handlers.onUseBuiltInPreset(preset.id), { disabled: !preset.canUse }));
      actions.appendChild(createButton('編集', 'btn-small', () => handlers.onEditBuiltInPreset(preset.id), { disabled: !preset.canUse }));
      builtInGrid.appendChild(createBuiltInPresetCard(preset, actions));
    });
    builtInSection.appendChild(builtInGrid);
    defaultPresetRow.appendChild(builtInSection);
  }
  const saveSlotTitle = document.createElement('div');
  saveSlotTitle.className = 'deck-builder-section-title deck-builder-section-title-with-icon deck-builder-save-slot-title';
  saveSlotTitle.appendChild(createSectionIcon(SAVE_SLOT_SECTION_ICON_SVG));
  const saveSlotTitleText = document.createElement('span');
  saveSlotTitleText.className = 'deck-builder-section-title-text';
  saveSlotTitleText.textContent = '保存スロット';
  saveSlotTitle.appendChild(saveSlotTitleText);
  const saveSlotCounter = document.createElement('span');
  saveSlotCounter.className = 'deck-builder-section-counter';
  const filledCount = (Array.isArray(viewModel.presets) ? viewModel.presets : []).filter((p: any) => p && p.canUse).length;
  saveSlotCounter.textContent = `${filledCount}/6 使用中`;
  saveSlotTitle.appendChild(saveSlotCounter);

  const presetGrid = document.createElement('div');
  presetGrid.className = 'deck-builder-preset-grid deck-builder-workshop-grid';
  viewModel.presets.forEach((preset: any, slotIndex: number) => {
    const actions = document.createElement('div');
    actions.className = 'deck-builder-actions-row';
    actions.appendChild(createButton('使用', 'btn-small', () => handlers.onUsePreset(preset.id), { disabled: !preset.canUse }));
    actions.appendChild(createButton('編集', 'btn-small', () => handlers.onEditPreset(preset.id)));

    presetGrid.appendChild(createPresetCard(preset, actions, { slotIndex }));
  });

  loadoutColumn.appendChild(defaultPresetRow);

  const savedDeckColumn = document.createElement('section');
  savedDeckColumn.className = 'deck-builder-saved-deck-column';
  savedDeckColumn.setAttribute('aria-label', '保存スロット');
  savedDeckColumn.appendChild(saveSlotTitle);
  savedDeckColumn.appendChild(presetGrid);

  workspace.appendChild(loadoutColumn);
  workspace.appendChild(savedDeckColumn);
  wrapper.appendChild(workspace);

  stage.appendChild(wrapper);
  atelier.appendChild(rail);
  atelier.appendChild(stage);
  container.appendChild(atelier);
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
  codeLabel.className = 'deck-builder-section-title deck-builder-section-title-with-icon';
  codeLabel.appendChild(createSectionIcon('<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 4.5l-3 3.5 3 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 4.5l3 3.5-3 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3l-2 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'));
  const codeLabelText = document.createElement('span');
  codeLabelText.className = 'deck-builder-section-title-text';
  codeLabelText.textContent = 'deckCode';
  codeLabel.appendChild(codeLabelText);
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
  selectedTitle.className = 'deck-builder-section-title deck-builder-section-title-with-icon';
  selectedTitle.appendChild(createSectionIcon('<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.2" y="4" width="11.6" height="8" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 7h11.6" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="9.2" r="0.8" fill="currentColor"/><circle cx="11" cy="9.2" r="0.8" fill="currentColor"/></svg>'));
  const selectedTitleText = document.createElement('span');
  selectedTitleText.className = 'deck-builder-section-title-text';
  selectedTitleText.textContent = '選択中カード';
  selectedTitle.appendChild(selectedTitleText);
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
  candidateTitle.className = 'deck-builder-section-title deck-builder-section-title-with-icon';
  candidateTitle.appendChild(createSectionIcon('<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.6" y="2.6" width="4.6" height="4.6" rx="0.8" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="2.6" width="4.6" height="4.6" rx="0.8" stroke="currentColor" stroke-width="1.3"/><rect x="2.6" y="8.8" width="4.6" height="4.6" rx="0.8" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="8.8" width="4.6" height="4.6" rx="0.8" stroke="currentColor" stroke-width="1.3"/></svg>'));
  const candidateTitleText = document.createElement('span');
  candidateTitleText.className = 'deck-builder-section-title-text';
  candidateTitleText.textContent = '候補カード';
  candidateTitle.appendChild(candidateTitleText);
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
