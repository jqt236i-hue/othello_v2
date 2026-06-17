declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

declare var CardInteractionEffects: any;
declare var CARD_DEFS: any;

'use strict';

const RULES_HELP_EFFECT_GLOSSARY = Object.freeze([
  Object.freeze({ label: '特殊石', description: '通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。' }),
  Object.freeze({ label: '穴マス化', description: 'マスを永続の穴にする。穴マスには誰も置けず、移動先にもならず、反転経路も遮断する。' }),
  Object.freeze({ label: '不可侵', description: '顕現石や特殊カードを、通常のカード効果や手札効果の対象から外す特殊カード固有の保護。' }),
  Object.freeze({ label: '反転保護', description: '反転されない。挟める列ごと無効できる。' }),
  Object.freeze({ label: '完全保護', description: '石に対する敵対的・強制的な効果を無効化。自分への強化・維持効果は受けられ、マス破壊は貫通する。' }),
  Object.freeze({ label: '反転回避', description: '相手に石を置かれて反転されるとき、元位置から最も近い有効な空きマスへ移動してその石だけ回避する。隣接に空きがなくても空きマスが1つでもあれば長距離移動で回避する。' }),
  Object.freeze({ label: '破壊回避', description: '破壊対象になったとき、最短の空きマスへ移動してその石だけ回避する。隣接に空きがなくても空きマスが1つでもあれば長距離移動で回避する。' }),
  Object.freeze({ label: '多動状態', description: '両者ターン開始時マス移動する、基本ランダム移動。' }),
  Object.freeze({ label: '幽体', description: '反転・破壊の対象にはなるが、その石自身は受けない。反転列の成立は無効化せず、交換以外の効果は通常どおり受ける。' }),
  Object.freeze({ label: '絶対保護', description: 'テレポート・位置交換・マス破壊・意志の喪失を含む全ての効果を無効化。解除されない。' }),
  Object.freeze({ label: 'マス破壊', description: 'マスごと穴にして永続封鎖。誰も置けず、反転経路も遮断する。' }),
  Object.freeze({ label: '破壊／爆発', description: '石を消滅させる。完全保護以外の保護を貫通できる。' }),
  Object.freeze({ label: '連鎖反転', description: '通常反転の後さらに挟める列ができた場合追加で一方向だけ反転させる。' }),
  Object.freeze({ label: '禁忌反転', description: '挟めなくても反転可能。絶対保護を除いて強制反転し、実際に反転する枚数が最大の列1方向のみ選ぶ。' }),
  Object.freeze({ label: '封鎖', description: '一時的にそのマスを塞ぐ。両者とも置けず、移動でも入れない。' }),
  Object.freeze({ label: '凍結', description: 'そのマスと上の石の反転・破壊・持続減少を止める。' }),
  Object.freeze({ label: '時間停止', description: '発動したプレイヤーが2ターン連続で行動する。' })
]);
function _safeText(value: any, fallback: any): string {
  const text = String(value || '').trim();
  if (text) return text;
  return String(fallback || '');
}

function _requireFirstRulesHelpModuleOrNull(paths: string[]): any {
  for (const path of paths) {
    try {
      return _require(path);
    } catch (e) {
      /* ignore */
    }
  }
  return null;
}

const _textTermHighlighterModule = _requireFirstRulesHelpModuleOrNull([
  '../text-term-highlighter',
  '../../ui/text-term-highlighter'
]);
const GAME_TERM_GLOSSARY = _textTermHighlighterModule && typeof _textTermHighlighterModule.getGameTermGlossary === 'function'
  ? _textTermHighlighterModule.getGameTermGlossary()
  : RULES_HELP_EFFECT_GLOSSARY;
const GAME_TERM_GLOSSARY_BY_LABEL = new Map<string, any>(
  (GAME_TERM_GLOSSARY as any).map((entry: any) => [entry.label, entry])
);

function _renderHelpText(targetEl: any, text: string): void {
  if (!targetEl) return;
  if (_textTermHighlighterModule && typeof _textTermHighlighterModule.renderTextWithGameTermHighlights === 'function') {
    _textTermHighlighterModule.renderTextWithGameTermHighlights(targetEl, String(text || ''), {
      documentRef: targetEl.ownerDocument || (typeof document !== 'undefined' ? document : null),
      preserveLineBreaks: true
    });
    return;
  }
  targetEl.textContent = String(text || '');
}

function _resolveRulesHelpCardInteractionEffectsModule(): any {
  if (typeof (CardInteractionEffects as any) !== 'undefined' && (CardInteractionEffects as any)) return (CardInteractionEffects as any);
  if (typeof window !== 'undefined' && (window as any).CardInteractionEffects) return (window as any).CardInteractionEffects;
  if (typeof _require === 'function') {
    return _requireFirstRulesHelpModuleOrNull([
      '../../cards/card-interaction-effects',
      '../cards/card-interaction-effects'
    ]);
  }
  return null;
}

const _rulesHelpCardInteractionEffectsModule = _resolveRulesHelpCardInteractionEffectsModule();

function _normalizeCardDescText(text: any): string {
  if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.normalizeCardDescText === 'function') {
    return _rulesHelpCardInteractionEffectsModule.normalizeCardDescText(text);
  }
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/。+/g, '。')
    .trim();
}

function _splitHelpSentences(text: string): string[] {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sentences: string[] = [];
  for (const line of lines) {
    const chunks = line.match(/[^。！？!?]+[。！？!?]?/g);
    if (!chunks || chunks.length === 0) {
      sentences.push(line);
      continue;
    }
    for (const chunk of chunks) {
      const normalized = chunk.trim();
      if (normalized) sentences.push(normalized);
    }
  }
  return sentences;
}

function _buildHelpComparisonKey(text: string): string {
  if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.buildCardDescComparisonKey === 'function') {
    return _rulesHelpCardInteractionEffectsModule.buildCardDescComparisonKey(text);
  }
  return _normalizeCardDescText(text)
    .replace(/[\s\u3000]/g, '')
    .replace(/[。\.。,，:：;；!！?？'"“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
    .toLowerCase();
}

function _isHelpPlaceholderText(text: string): boolean {
  const key = _buildHelpComparisonKey(text);
  if (!key) return true;
  return key === _buildHelpComparisonKey('効果説明は準備中')
    || key === _buildHelpComparisonKey('詳細説明は準備中')
    || key === _buildHelpComparisonKey('効果説明が未登録です');
}

function _resolveNonDuplicateDetailText(quickText: string, detailText: string): string {
  if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.resolveNonDuplicateDetailText === 'function') {
    return _rulesHelpCardInteractionEffectsModule.resolveNonDuplicateDetailText(quickText, detailText);
  }

  const quick = _safeText(quickText, '');
  const detail = _safeText(detailText, '');
  if (!detail) return '';
  if (!quick) return detail;

  const quickKey = _buildHelpComparisonKey(quick);
  const detailKey = _buildHelpComparisonKey(detail);
  if (!detailKey) return '';
  if (!quickKey) return detail;
  if (detailKey === quickKey) return '';

  const detailSentences = String(detail)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (detailSentences.length === 0) return detail;

  const keepSentences: string[] = [];
  const seenSentenceKeys = new Set<string>();
  for (const sentence of detailSentences) {
    const sentenceKey = _buildHelpComparisonKey(sentence);
    if (!sentenceKey) continue;
    const isExactDuplicate = sentenceKey === quickKey;
    const isContainedDuplicate = sentenceKey.length >= 12
      && quickKey.length >= 12
      && (quickKey.includes(sentenceKey) || sentenceKey.includes(quickKey));
    if (isExactDuplicate || isContainedDuplicate) continue;
    if (seenSentenceKeys.has(sentenceKey)) continue;
    seenSentenceKeys.add(sentenceKey);
    keepSentences.push(sentence);
  }

  if (keepSentences.length === 0) return '';
  if (keepSentences.length === detailSentences.length) return detail;
  return keepSentences.join('\n');
}

function _fallbackQuickCardEffect(cardDef: any): string {
  const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
  if (!normalized) return '効果説明は準備中';
  const firstSentence = normalized.split('。').map((s: string) => s.trim()).filter(Boolean)[0] || normalized;
  return firstSentence.length > 38 ? `${firstSentence.slice(0, 38)}...` : firstSentence;
}

function _fallbackDetailCardEffect(cardDef: any): string {
  const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
  if (!normalized) return '詳細説明は準備中';
  return normalized.replace(/。/g, '。\n').trim();
}

function _resolveCardDescriptionTexts(cardDef: any): any {
  if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.resolveCardDescriptionTexts === 'function') {
    return _rulesHelpCardInteractionEffectsModule.resolveCardDescriptionTexts(cardDef, {
      resolveChargeMaxText: () => '99',
      quickTextMaxLength: 38
    });
  }

  const quickText = _rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.getQuickCardEffect === 'function'
    ? _rulesHelpCardInteractionEffectsModule.getQuickCardEffect(cardDef, { maxLength: 38 })
    : _fallbackQuickCardEffect(cardDef);
  const detailText = _rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.getDetailCardEffect === 'function'
    ? _rulesHelpCardInteractionEffectsModule.getDetailCardEffect(cardDef, () => '99')
    : _fallbackDetailCardEffect(cardDef);
  const effectTags = _rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.resolveCardEffectTags === 'function'
    ? _rulesHelpCardInteractionEffectsModule.resolveCardEffectTags(cardDef)
    : (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.resolveCardNumericTags === 'function'
      ? _rulesHelpCardInteractionEffectsModule.resolveCardNumericTags(cardDef)
      : [])
  ;
  const numericTags = _rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.resolveCardNumericTags === 'function'
    ? _rulesHelpCardInteractionEffectsModule.resolveCardNumericTags(cardDef)
    : [];
  return {
    quickText,
    detailText,
    distinctDetailText: _resolveNonDuplicateDetailText(quickText, detailText),
    effectTags,
    numericTags
  };
}

function _getSharedVisualEffectsMap(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).GameVisualEffectsMap && (window as any).GameVisualEffectsMap.STONE_VISUAL_EFFECTS) {
      return (window as any).GameVisualEffectsMap;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof _require === 'function') {
      const mod = _require('../../game/visual-effects-map');
      if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function _resolveSpecialStoneImagePath(cardType: string): string | null {
  const map = _getSharedVisualEffectsMap();
  if (!map || !map.PENDING_TYPE_TO_EFFECT_KEY || !map.STONE_VISUAL_EFFECTS) return null;
  const effectKey = map.PENDING_TYPE_TO_EFFECT_KEY[cardType];
  if (!effectKey) return null;
  const effect = map.STONE_VISUAL_EFFECTS[effectKey];
  if (!effect || typeof effect !== 'object') return null;
  if (effect.imagePathByOwner && effect.imagePathByOwner['1']) return String(effect.imagePathByOwner['1']);
  if (effect.imagePathByPlayer && effect.imagePathByPlayer.black) return String(effect.imagePathByPlayer.black);
  if (effect.imagePath) return String(effect.imagePath);
  return null;
}

function _normalizeCatalogCards(rawCards: any[]): any[] {
  if (!Array.isArray(rawCards)) return [];
  const normalized: any[] = [];
  const seen = new Set<string>();
  for (const raw of rawCards) {
    if (!raw || typeof raw !== 'object') continue;
    const id = _safeText(raw.id || raw.type, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = _safeText(raw.name || raw.name_ja || raw.type, id);
    const desc = _safeText(raw.desc || raw.desc_ja, '効果説明が未登録です。');
    const type = _safeText(raw.type, '');
    const displayTypeLabel = _safeText(raw.display_type_ja || raw.displayTypeLabel || raw.displayTypeJa, '');
    const cost = Number(raw.cost);
    normalized.push({
      id,
      name,
      type,
      desc,
      displayTypeLabel,
      cost: Number.isFinite(cost) ? cost : null
    });
  }
  return normalized;
}

function _normalizeCatalogFilterText(text: any): string {
  return _normalizeCardDescText(text)
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase();
}

function _sortCatalogCards(cards: any[]): any[] {
  return cards.slice().sort((a: any, b: any) => {
    const costA = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
    const costB = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
    if (costA !== costB) return costA - costB;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
  });
}

function _readCatalogCards(): any[] {
  let cards: any[] = [];
  try {
    const root = (typeof window !== 'undefined' && window) ? window : ((typeof globalThis !== 'undefined') ? globalThis as any : null);
    if (root && root.CardCatalog && Array.isArray(root.CardCatalog.cards)) {
      cards = _normalizeCatalogCards(root.CardCatalog.cards);
      if (cards.length > 0) return _sortCatalogCards(cards);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof (CARD_DEFS as any) !== 'undefined' && Array.isArray(CARD_DEFS)) {
      cards = _normalizeCatalogCards(CARD_DEFS as any);
    }
  } catch (e) { /* ignore */ }
  return _sortCatalogCards(cards);
}

function setupRulesHelp(rulesHelpBtn: HTMLElement, rulesHelpPanel: HTMLElement): void {
  if (!rulesHelpBtn || !rulesHelpPanel) return;
  const docRef = rulesHelpPanel.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const rulesHelpBackdrop = docRef ? docRef.getElementById('rules-help-backdrop') : null;
  const closeBtn = rulesHelpPanel.querySelector('#rules-help-close-btn');
  const tabButtons = Array.from(rulesHelpPanel.querySelectorAll('[data-help-tab]'));
  const tabPages = Array.from(rulesHelpPanel.querySelectorAll('[data-help-page]'));
  const cardListEl = rulesHelpPanel.querySelector('#rules-help-card-list');
  const cardNameEl = rulesHelpPanel.querySelector('#rules-help-card-name');
  const cardDescEl = rulesHelpPanel.querySelector('#rules-help-card-desc');
  const cardSearchInput = rulesHelpPanel.querySelector('#rules-help-card-search') as HTMLInputElement | null;
  const tagFiltersEl = rulesHelpPanel.querySelector('#rules-help-card-tag-filters') as HTMLElement | null;
  const filterStatusEl = rulesHelpPanel.querySelector('#rules-help-card-filter-status') as HTMLElement | null;
  const filterClearBtn = rulesHelpPanel.querySelector('#rules-help-card-filter-clear') as HTMLButtonElement | null;
  const effectsListEl = rulesHelpPanel.querySelector('#rules-help-effects-list') as HTMLElement | null;
  const catalogCards = _readCatalogCards();
  const cardDescriptionTextsById = new Map<string, any>();
  const cardSearchTextById = new Map<string, string>();
  const activeTagLabels = new Set<string>();

  let isOpen = false;
  let selectedCardId: string | null = null;
  let tagPopoverEl: HTMLElement | null = null;

  function getCardDescriptionTexts(card: any): any {
    const cardId = _safeText(card && card.id, '');
    if (cardId && cardDescriptionTextsById.has(cardId)) {
      return cardDescriptionTextsById.get(cardId);
    }
    const descriptionTexts = _resolveCardDescriptionTexts(card);
    if (cardId) cardDescriptionTextsById.set(cardId, descriptionTexts);
    return descriptionTexts;
  }

  function getCardDisplayTypeLabel(card: any): string {
    return _safeText(card && (card.displayTypeLabel || card.display_type_ja || card.displayTypeJa), '');
  }

  function getCardLabel(card: any): string {
    if (!card) return '';
    const costText = Number.isFinite(card.cost) ? String(card.cost) : '-';
    const typeLabel = getCardDisplayTypeLabel(card);
    return typeLabel ? `${typeLabel} コスト${costText} ${card.name}` : `コスト${costText} ${card.name}`;
  }

  function createTypeBadge(label: string): HTMLSpanElement {
    const badge = document.createElement('span');
    badge.className = 'rules-help-type-badge';
    badge.textContent = label;
    return badge;
  }

  function createCardMetaRow(card: any, className: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = className;

    const typeLabel = getCardDisplayTypeLabel(card);
    if (typeLabel) {
      row.appendChild(createTypeBadge(typeLabel));
    }

    const costText = Number.isFinite(card && card.cost) ? String(card.cost) : '-';
    const costEl = document.createElement('span');
    costEl.className = 'rules-help-card-cost-label';
    costEl.textContent = `コスト${costText}`;
    row.appendChild(costEl);

    return row;
  }

  function getCardEffectTags(card: any): any[] {
    const descriptionTexts = getCardDescriptionTexts(card);
    return Array.isArray(descriptionTexts && descriptionTexts.effectTags)
      ? descriptionTexts.effectTags
      : (Array.isArray(descriptionTexts && descriptionTexts.numericTags)
        ? descriptionTexts.numericTags
        : []);
  }

  function getNormalizedCardEffectTags(card: any): any[] {
    return _normalizeResolvedCardEffectTags(getCardEffectTags(card));
  }

  function getCardSearchText(card: any): string {
    const cardId = _safeText(card && card.id, '');
    if (cardId && cardSearchTextById.has(cardId)) {
      return cardSearchTextById.get(cardId) as string;
    }

    const descriptionTexts = getCardDescriptionTexts(card);
    const tags = getNormalizedCardEffectTags(card);
    const costText = Number.isFinite(card && card.cost) ? `コスト${card.cost}` : '';
    const searchText = [
      card && card.name,
      getCardDisplayTypeLabel(card),
      costText,
      card && card.desc,
      descriptionTexts && descriptionTexts.quickText,
      descriptionTexts && descriptionTexts.detailText,
      descriptionTexts && descriptionTexts.distinctDetailText,
      tags.map((tag: any) => tag.label).join(' ')
    ].map((part) => _safeText(part, '')).filter(Boolean).join(' ');
    const normalized = _normalizeCatalogFilterText(searchText);
    if (cardId) cardSearchTextById.set(cardId, normalized);
    return normalized;
  }

  function getSearchTerms(): string[] {
    if (!cardSearchInput) return [];
    return String(cardSearchInput.value || '')
      .split(/[\s\u3000]+/)
      .map((term) => _normalizeCatalogFilterText(term))
      .filter(Boolean);
  }

  function cardMatchesActiveTags(card: any): boolean {
    if (activeTagLabels.size === 0) return true;
    const labels = new Set(getNormalizedCardEffectTags(card).map((tag: any) => tag.label));
    for (const label of activeTagLabels) {
      if (!labels.has(label)) return false;
    }
    return true;
  }

  function cardMatchesSearchTerms(card: any, searchTerms: string[]): boolean {
    if (!searchTerms.length) return true;
    const searchText = getCardSearchText(card);
    return searchTerms.every((term) => searchText.includes(term));
  }

  function getFilteredCatalogCards(): any[] {
    const searchTerms = getSearchTerms();
    return catalogCards.filter((card: any) => (
      cardMatchesActiveTags(card) && cardMatchesSearchTerms(card, searchTerms)
    ));
  }

  function updateFilterStatus(filteredCount: number): void {
    const totalCount = catalogCards.length;
    if (filterStatusEl) {
      const searchText = cardSearchInput ? String(cardSearchInput.value || '').trim() : '';
      const tagText = Array.from(activeTagLabels).join(' / ');
      const suffixParts: string[] = [];
      if (searchText) suffixParts.push(`検索: ${searchText}`);
      if (tagText) suffixParts.push(`タグ: ${tagText}`);
      filterStatusEl.textContent = suffixParts.length
        ? `${filteredCount} / ${totalCount}枚（${suffixParts.join('、')}）`
        : `${filteredCount} / ${totalCount}枚`;
    }
    if (filterClearBtn) {
      const hasSearch = !!(cardSearchInput && String(cardSearchInput.value || '').trim());
      const hasFilters = hasSearch || activeTagLabels.size > 0;
      filterClearBtn.disabled = !hasFilters;
      filterClearBtn.setAttribute('aria-disabled', hasFilters ? 'false' : 'true');
    }
  }

  function updateTagFilterButtons(): void {
    if (!tagFiltersEl) return;
    const buttons = Array.from(tagFiltersEl.querySelectorAll('.rules-help-card-tag-filter'));
    for (const button of buttons) {
      const label = button.getAttribute('data-card-tag-label') || '';
      const active = activeTagLabels.has(label);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function renderNoCatalogMatches(): void {
    if (cardListEl) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'rules-help-card-empty';
      emptyEl.textContent = catalogCards.length
        ? '条件に合うカードがありません'
        : 'カード情報が見つかりません';
      cardListEl.appendChild(emptyEl);
    }
    selectedCardId = null;
    if (cardNameEl) cardNameEl.textContent = catalogCards.length ? '検索結果なし' : 'カード情報が見つかりません';
    if (cardDescEl) {
      cardDescEl.textContent = catalogCards.length
        ? '検索語やタグを減らすと見つかるかもしれません。'
        : 'カード図鑑の読み込みに失敗しました。';
    }
  }

  function resolveEffectGlossaryEntry(label: string): any {
    const normalizedLabel = _safeText(label, '');
    return GAME_TERM_GLOSSARY_BY_LABEL.get(normalizedLabel) || null;
  }

  function closeTagPopover(): void {
    if (!tagPopoverEl) return;
    tagPopoverEl.classList.remove('is-open');
    tagPopoverEl.setAttribute('aria-hidden', 'true');
  }

  function ensureTagPopover(): HTMLElement | null {
    if (tagPopoverEl && rulesHelpPanel.contains(tagPopoverEl)) return tagPopoverEl;

    const popover = document.createElement('div');
    popover.className = 'rules-help-tag-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.setAttribute('aria-hidden', 'true');
    popover.setAttribute('aria-labelledby', 'rules-help-tag-popover-title');

    const headerEl = document.createElement('div');
    headerEl.className = 'rules-help-tag-popover-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-tag-popover-title';
    titleEl.id = 'rules-help-tag-popover-title';
    headerEl.appendChild(titleEl);

    const closeEl = document.createElement('button');
    closeEl.type = 'button';
    closeEl.className = 'rules-help-tag-popover-close';
    closeEl.setAttribute('aria-label', '効果タグ説明を閉じる');
    closeEl.textContent = '×';
    closeEl.addEventListener('click', (event: Event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      closeTagPopover();
    });
    headerEl.appendChild(closeEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'rules-help-tag-popover-body';

    popover.appendChild(headerEl);
    popover.appendChild(bodyEl);
    rulesHelpPanel.appendChild(popover);
    tagPopoverEl = popover;
    return popover;
  }

  function openTagPopover(label: string): boolean {
    const normalizedLabel = _safeText(label, '');
    if (!normalizedLabel) return false;

    const popover = ensureTagPopover();
    if (!popover) return false;
    const entry = resolveEffectGlossaryEntry(normalizedLabel);
    const titleEl = popover.querySelector('.rules-help-tag-popover-title') as HTMLElement | null;
    const bodyEl = popover.querySelector('.rules-help-tag-popover-body') as HTMLElement | null;
    if (titleEl) titleEl.textContent = normalizedLabel;
    if (bodyEl) _renderHelpText(bodyEl, entry ? entry.description : `${normalizedLabel}の説明は未登録です。`);
    popover.classList.add('is-open');
    popover.setAttribute('aria-hidden', 'false');
    const closeEl = popover.querySelector('.rules-help-tag-popover-close') as HTMLButtonElement | null;
    if (closeEl && typeof closeEl.focus === 'function') closeEl.focus();
    return true;
  }

  function createCardListContent(card: any): DocumentFragment {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createCardMetaRow(card, 'rules-help-card-item-meta'));

    const nameEl = document.createElement('span');
    nameEl.className = 'rules-help-card-item-name';
    nameEl.textContent = card.name;
    fragment.appendChild(nameEl);

    return fragment;
  }

  function renderSelectedCardHeading(card: any): void {
    if (!cardNameEl) return;
    cardNameEl.innerHTML = '';
    cardNameEl.appendChild(createCardMetaRow(card, 'rules-help-card-name-meta'));

    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-card-title';
    titleEl.textContent = card.name;
    cardNameEl.appendChild(titleEl);
  }

  function createCardSection(title: string, bodyText: string): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'rules-help-card-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-card-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'rules-help-card-section-body';
    _renderHelpText(bodyEl, bodyText);
    section.appendChild(bodyEl);
    return section;
  }

  function _normalizeResolvedCardEffectTags(tags: any[]): any[] {
    if (!Array.isArray(tags)) return [];
    const normalizedTags: any[] = [];
    const seen = new Set<string>();
    for (const rawTag of tags) {
      if (!rawTag || typeof rawTag !== 'object') continue;
      const label = _safeText(rawTag.label, '');
      if (!label) continue;
      const kind = _safeText(rawTag.kind, '').toLowerCase();
      const dedupeKey = `${kind}:${label}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      normalizedTags.push({ kind, label });
    }
    return normalizedTags;
  }

  function shouldHideCardTagFromFilter(tag: any): boolean {
    const kind = _safeText(tag && tag.kind, '').toLowerCase();
    const label = _safeText(tag && tag.label, '');
    return (
      kind === 'duration-turns' ||
      kind === 'delayed-activation-turns' ||
      /^\d+ターン(?:持続|継続)$/.test(label) ||
      /^\d+ターン後に発動$/.test(label)
    );
  }

  function _getCardEffectTagKindClass(kind: string): string {
    const normalizedKind = _safeText(kind, '').toLowerCase();
    if (!normalizedKind) return '';
    return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
  }

  const tagFilterSortOrder = new Map<string, number>([
    ['特殊石', 10],
    ['穴マス化', 20],
    ['不可侵', 30],
    ['反転保護', 40],
    ['完全保護', 50],
    ['反転回避', 60],
    ['破壊回避', 70]
  ]);

  function getTagFilterSortRank(label: string): number {
    const normalizedLabel = _safeText(label, '');
    return tagFilterSortOrder.has(normalizedLabel)
      ? Number(tagFilterSortOrder.get(normalizedLabel))
      : 1000;
  }

  function createCardEffectTagSection(tags: any[]): HTMLDivElement | null {
    const normalizedTags = _normalizeResolvedCardEffectTags(tags);
    if (normalizedTags.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'rules-help-card-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-card-section-title';
    titleEl.textContent = '効果タグ';
    section.appendChild(titleEl);

    const listEl = document.createElement('div');
    listEl.className = 'rules-help-card-tag-list';
    for (const tag of normalizedTags) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rules-help-card-tag rules-help-card-tag-button';
      const kindClass = _getCardEffectTagKindClass(tag.kind);
      if (kindClass) chip.classList.add(kindClass);
      chip.textContent = tag.label;
      chip.setAttribute('data-card-tag-kind', tag.kind || '');
      chip.setAttribute('data-card-tag-label', tag.label);
      chip.setAttribute('aria-label', `${tag.label}の説明を表示`);
      chip.addEventListener('click', (event: Event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        openTagPopover(tag.label);
      });
      listEl.appendChild(chip);
    }
    section.appendChild(listEl);
    return section;
  }

  function createSpecialStoneVisual(path: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'rules-help-card-visual';

    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-card-section-title';
    titleEl.textContent = '特殊石ビジュアル';
    wrap.appendChild(titleEl);

    const img = document.createElement('img');
    img.className = 'rules-help-card-visual-image';
    img.src = path;
    img.alt = '特殊石の見た目';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      try { wrap.remove(); } catch (e) { /* ignore */ }
    });
    wrap.appendChild(img);

    const note = document.createElement('div');
    note.className = 'rules-help-card-visual-note';
    note.textContent = '特殊石化したときの見た目（黒側）';
    wrap.appendChild(note);
    return wrap;
  }

  function updateSelectedCard(cardId: string): void {
    if (!cardId) return;
    const card = catalogCards.find((entry: any) => entry.id === cardId);
    if (!card) return;
    selectedCardId = card.id;
    renderSelectedCardHeading(card);
    if (cardDescEl) {
      const descriptionTexts = getCardDescriptionTexts(card);
      const effectTags = getCardEffectTags(card);
      const quick = _safeText(descriptionTexts && descriptionTexts.quickText, card.desc);
      const detail = _safeText(descriptionTexts && descriptionTexts.distinctDetailText, '');
      cardDescEl.innerHTML = '';
      const tagSectionEl = createCardEffectTagSection(effectTags);
      if (tagSectionEl) {
        cardDescEl.appendChild(tagSectionEl);
      }
      cardDescEl.appendChild(createCardSection('簡易説明', quick));
      if (detail) {
        cardDescEl.appendChild(createCardSection('詳細効果', detail));
      }

      const specialStoneImagePath = _resolveSpecialStoneImagePath(card.type);
      if (specialStoneImagePath) {
        cardDescEl.appendChild(createSpecialStoneVisual(specialStoneImagePath));
      }
    }

    if (cardListEl) {
      const buttons = Array.from(cardListEl.querySelectorAll('.rules-help-card-item'));
      for (const button of buttons) {
        const active = button.getAttribute('data-card-id') === selectedCardId;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      }
    }
  }

  function renderCatalogCards(): void {
    if (!cardListEl) return;
    cardListEl.innerHTML = '';
    const filteredCards = getFilteredCatalogCards();
    updateFilterStatus(filteredCards.length);
    updateTagFilterButtons();

    if (!filteredCards.length) {
      renderNoCatalogMatches();
      return;
    }

    for (const card of filteredCards) {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'rules-help-card-item';
      itemBtn.setAttribute('data-card-id', card.id);
      itemBtn.setAttribute('role', 'option');
      itemBtn.setAttribute('aria-selected', 'false');
      itemBtn.setAttribute('aria-label', getCardLabel(card));
      itemBtn.appendChild(createCardListContent(card));
      itemBtn.addEventListener('click', () => {
        updateSelectedCard(card.id);
      });
      cardListEl.appendChild(itemBtn);
    }

    const selectedStillVisible = !!selectedCardId && filteredCards.some((card: any) => card.id === selectedCardId);
    updateSelectedCard(selectedStillVisible ? selectedCardId as string : filteredCards[0].id);
  }

  function renderTagFilters(): void {
    if (!tagFiltersEl) return;
    tagFiltersEl.innerHTML = '';

    const tagEntries: any[] = [];
    const seen = new Set<string>();
    for (const card of catalogCards) {
      for (const tag of getNormalizedCardEffectTags(card)) {
        const label = _safeText(tag && tag.label, '');
        if (!label || seen.has(label) || shouldHideCardTagFromFilter(tag)) continue;
        seen.add(label);
        const count = catalogCards.filter((entry: any) => (
          getNormalizedCardEffectTags(entry).some((entryTag: any) => entryTag.label === label)
        )).length;
        tagEntries.push({ label, kind: _safeText(tag && tag.kind, ''), count });
      }
    }

    if (!tagEntries.length) {
      const emptyEl = document.createElement('span');
      emptyEl.className = 'rules-help-card-tag-filter-empty';
      emptyEl.textContent = '効果タグなし';
      tagFiltersEl.appendChild(emptyEl);
      return;
    }

    tagEntries.sort((a, b) => {
      const rankDiff = getTagFilterSortRank(a && a.label) - getTagFilterSortRank(b && b.label);
      if (rankDiff !== 0) return rankDiff;
      return _safeText(a && a.label, '').localeCompare(_safeText(b && b.label, ''), 'ja');
    });

    for (const tag of tagEntries) {
      const filterBtn = document.createElement('button');
      filterBtn.type = 'button';
      filterBtn.className = 'rules-help-card-tag-filter';
      const kindClass = _getCardEffectTagKindClass(tag.kind);
      if (kindClass) filterBtn.classList.add(kindClass);
      filterBtn.textContent = tag.label;
      filterBtn.setAttribute('data-card-tag-label', tag.label);
      filterBtn.setAttribute('aria-pressed', 'false');
      filterBtn.setAttribute('aria-label', `${tag.label}で絞り込み（${tag.count}枚）`);
      filterBtn.addEventListener('click', (event: Event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (activeTagLabels.has(tag.label)) {
          activeTagLabels.delete(tag.label);
        } else {
          activeTagLabels.add(tag.label);
        }
        renderCatalogCards();
      });
      tagFiltersEl.appendChild(filterBtn);
    }
  }

  function renderEffectsList(): void {
    if (!effectsListEl) return;
    effectsListEl.innerHTML = '';
    for (const entry of GAME_TERM_GLOSSARY as any) {
      if (!entry || !entry.label) continue;
      const itemEl = document.createElement('div');
      itemEl.className = 'rules-help-effect-item';

      const termEl = document.createElement('dt');
      const termButton = document.createElement('button');
      termButton.type = 'button';
      termButton.className = 'rules-help-effect-term-button';
      termButton.textContent = entry.label;
      termButton.setAttribute('aria-label', `${entry.label}の説明を表示`);
      termButton.addEventListener('click', (event: Event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        openTagPopover(entry.label);
      });
      termEl.appendChild(termButton);
      itemEl.appendChild(termEl);

      const descriptionEl = document.createElement('dd');
      _renderHelpText(descriptionEl, entry.description);
      itemEl.appendChild(descriptionEl);
      effectsListEl.appendChild(itemEl);
    }
  }

  function activateTab(tabKey: string): void {
    if (!tabButtons.length || !tabPages.length) return;
    const targetKey = String(tabKey || '').trim();
    for (const tabBtn of tabButtons) {
      const active = tabBtn.getAttribute('data-help-tab') === targetKey;
      tabBtn.classList.toggle('is-active', active);
      tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
      tabBtn.setAttribute('tabindex', active ? '0' : '-1');
    }
    for (const page of tabPages) {
      const active = page.getAttribute('data-help-page') === targetKey;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
  }

  function openPanel(): void {
    isOpen = true;
    if (rulesHelpBackdrop) {
      rulesHelpBackdrop.classList.add('is-open');
      rulesHelpBackdrop.setAttribute('aria-hidden', 'false');
    }
    rulesHelpPanel.classList.add('is-open');
    rulesHelpPanel.setAttribute('aria-hidden', 'false');
    rulesHelpBtn.setAttribute('aria-expanded', 'true');
    if (tabButtons.length > 0) {
      const activeTab = tabButtons.find((button: any) => button.classList.contains('is-active'));
      const tabKey = activeTab ? activeTab.getAttribute('data-help-tab') : tabButtons[0].getAttribute('data-help-tab');
      activateTab(tabKey as string);
    }
  }

  function closePanel(): void {
    isOpen = false;
    closeTagPopover();
    if (rulesHelpBackdrop) {
      rulesHelpBackdrop.classList.remove('is-open');
      rulesHelpBackdrop.setAttribute('aria-hidden', 'true');
    }
    rulesHelpPanel.classList.remove('is-open');
    rulesHelpPanel.setAttribute('aria-hidden', 'true');
    rulesHelpBtn.setAttribute('aria-expanded', 'false');
  }

  rulesHelpBtn.addEventListener('click', (event: Event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (event: Event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      closePanel();
    });
  }

  for (const tabBtn of tabButtons) {
    tabBtn.addEventListener('click', (event: Event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      activateTab(tabBtn.getAttribute('data-help-tab') as string);
    });
  }

  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!isOpen) return;
    const target = event ? event.target as Node : null;
    if (!target) return;
    if (rulesHelpPanel.contains(target) || rulesHelpBtn.contains(target)) return;
    closePanel();
  }, true);

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!isOpen) return;
    if (!event || event.key !== 'Escape') return;
    if (tagPopoverEl && tagPopoverEl.getAttribute('aria-hidden') === 'false') {
      event.preventDefault();
      closeTagPopover();
      return;
    }
    closePanel();
  });

  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', () => {
      renderCatalogCards();
    });
  }

  if (filterClearBtn) {
    filterClearBtn.addEventListener('click', (event: Event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (cardSearchInput) cardSearchInput.value = '';
      activeTagLabels.clear();
      renderCatalogCards();
      if (cardSearchInput && typeof cardSearchInput.focus === 'function') {
        cardSearchInput.focus();
      }
    });
  }

  renderTagFilters();
  renderEffectsList();
  renderCatalogCards();
  if (tabButtons.length > 0) {
    const activeTab = tabButtons.find((button: any) => button.classList.contains('is-active'));
    activateTab(activeTab ? activeTab.getAttribute('data-help-tab') as string : tabButtons[0].getAttribute('data-help-tab') as string);
  }
}

const RulesHelpModule = {
  setupRulesHelp
};

export = RulesHelpModule;
