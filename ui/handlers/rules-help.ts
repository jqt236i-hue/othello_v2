declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

declare var CardInteractionEffects: any;
declare var CARD_DEFS: any;

'use strict';

const EFFECT_GLOSSARY_TERMS = Object.freeze([
  'マス破壊',
  '破壊／爆発',
  '連鎖反転',
  '禁忌反転',
  '封鎖',
  '凍結',
  '時間停止',
  '特殊石',
  '幽体',
  '反転保護',
  '完全保護',
  '絶対保護',
  '反転回避',
  '破壊回避',
  '多動状態'
]);

const HELP_UPDATE_HISTORY = Object.freeze([
  Object.freeze({
    version: 'v1.0',
    sections: Object.freeze([
      Object.freeze({
        title: 'バランス調整',
        items: Object.freeze([
          '繁殖の意志の持続ターンを3から5ターンに変更',
          '延命の意志のコストを2から4に変更',
          '演算の意志コスト7から6に変更、数字マス布石効果を2倍へ調整',
          '最後の切り札を仕様変更\nコスト12→9に減少\n使用条件を石数負け＋合法手なしのときに変更\n自由配置を2回から3回に増加'
        ])
      }),
      Object.freeze({
        title: '新カード',
        items: Object.freeze([
          '時間停石を実装\nコスト0\n使用時にランダムで自石3個を破壊\n5ターン後に時間停止を発動し、2ターン連続で行動できる。',
          '延命神を実装\nコスト10\n自分の特殊石1つの持続ターンを4倍にする。'
        ])
      }),
      Object.freeze({
        title: 'ネット対戦',
        items: Object.freeze([
          'ネット対戦関連の問題を修正'
        ])
      })
    ])
  })
]);

function _safeText(value: any, fallback: any): string {
  const text = String(value || '').trim();
  if (text) return text;
  return String(fallback || '');
}

function _escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _escapeRegExp(text: string): string {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const _effectTermsPattern = (() => {
  const sorted = (EFFECT_GLOSSARY_TERMS as any)
    .slice()
    .sort((a: string, b: string) => b.length - a.length)
    .map((term: string) => _escapeRegExp(term));
  if (!sorted.length) return null;
  return new RegExp(`(${sorted.join('|')})`, 'g');
})();

function _highlightEffectTerms(escapedText: string): string {
  if (!_effectTermsPattern) return escapedText;
  return String(escapedText || '').replace(_effectTermsPattern, '<span class="rules-help-term-highlight">$1</span>');
}

function _formatHelpText(text: string): string {
  const escaped = _escapeHtml(text);
  const highlighted = _highlightEffectTerms(escaped);
  return highlighted.replace(/\n/g, '<br>');
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

const _rulesHelpCardInteractionEffectsModule = (() => {
  if (typeof (CardInteractionEffects as any) !== 'undefined' && (CardInteractionEffects as any)) return (CardInteractionEffects as any);
  if (typeof window !== 'undefined' && (window as any).CardInteractionEffects) return (window as any).CardInteractionEffects;
  if (typeof _require === 'function') {
    return _requireFirstRulesHelpModuleOrNull([
      '../../cards/card-interaction-effects',
      '../cards/card-interaction-effects'
    ]);
  }
  return null;
})();

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

function createHelpUpdateSection(title: string, items: any[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'rules-help-update-section';

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'rules-help-update-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);
  }

  const listEl = document.createElement('ul');
  listEl.className = 'rules-help-update-items';
  for (const itemText of Array.isArray(items) ? items : []) {
    const itemEl = document.createElement('li');
    itemEl.className = 'rules-help-update-item';
    itemEl.innerHTML = _formatHelpText(itemText);
    listEl.appendChild(itemEl);
  }
  section.appendChild(listEl);
  return section;
}

function renderHelpUpdates(updateListEl: HTMLElement | null): void {
  if (!updateListEl) return;
  updateListEl.innerHTML = '';

  if (!(HELP_UPDATE_HISTORY as any).length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'rules-help-update-empty';
    emptyEl.textContent = 'アップデート情報はまだありません。';
    updateListEl.appendChild(emptyEl);
    return;
  }

  for (const release of HELP_UPDATE_HISTORY as any) {
    const article = document.createElement('article');
    article.className = 'rules-help-update-version';

    const versionEl = document.createElement('div');
    versionEl.className = 'rules-help-update-version-title';
    versionEl.textContent = _safeText(release && release.version, 'version');
    article.appendChild(versionEl);

    const sections = Array.isArray(release && release.sections) ? release.sections : [];
    for (const section of sections) {
      article.appendChild(createHelpUpdateSection(
        _safeText(section && section.title, ''),
        Array.isArray(section && section.items) ? section.items : []
      ));
    }

    updateListEl.appendChild(article);
  }
}

function setupRulesHelp(rulesHelpBtn: HTMLElement, rulesHelpPanel: HTMLElement): void {
  if (!rulesHelpBtn || !rulesHelpPanel) return;
  const closeBtn = rulesHelpPanel.querySelector('#rules-help-close-btn');
  const tabButtons = Array.from(rulesHelpPanel.querySelectorAll('[data-help-tab]'));
  const tabPages = Array.from(rulesHelpPanel.querySelectorAll('[data-help-page]'));
  const cardListEl = rulesHelpPanel.querySelector('#rules-help-card-list');
  const cardNameEl = rulesHelpPanel.querySelector('#rules-help-card-name');
  const cardDescEl = rulesHelpPanel.querySelector('#rules-help-card-desc');
  const updatesListEl = rulesHelpPanel.querySelector('#rules-help-updates-list');
  const catalogCards = _readCatalogCards();

  let isOpen = false;
  let selectedCardId: string | null = null;

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
    bodyEl.innerHTML = _formatHelpText(bodyText);
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

  function _getCardEffectTagKindClass(kind: string): string {
    const normalizedKind = _safeText(kind, '').toLowerCase();
    if (!normalizedKind) return '';
    return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
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
      const chip = document.createElement('span');
      chip.className = 'rules-help-card-tag';
      const kindClass = _getCardEffectTagKindClass(tag.kind);
      if (kindClass) chip.classList.add(kindClass);
      chip.textContent = tag.label;
      chip.setAttribute('data-card-tag-kind', tag.kind || '');
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
      const descriptionTexts = _resolveCardDescriptionTexts(card);
      const effectTags = Array.isArray(descriptionTexts && descriptionTexts.effectTags)
        ? descriptionTexts.effectTags
        : (Array.isArray(descriptionTexts && descriptionTexts.numericTags)
          ? descriptionTexts.numericTags
          : []);
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

    if (!catalogCards.length) {
      if (cardNameEl) cardNameEl.textContent = 'カード情報が見つかりません';
      if (cardDescEl) cardDescEl.textContent = 'カード図鑑の読み込みに失敗しました。';
      return;
    }

    for (const card of catalogCards) {
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

    updateSelectedCard(catalogCards[0].id);
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
    closePanel();
  });

  renderCatalogCards();
  renderHelpUpdates(updatesListEl as HTMLElement);
  if (tabButtons.length > 0) {
    const activeTab = tabButtons.find((button: any) => button.classList.contains('is-active'));
    activateTab(activeTab ? activeTab.getAttribute('data-help-tab') as string : tabButtons[0].getAttribute('data-help-tab') as string);
  }
}

const RulesHelpModule = {
  setupRulesHelp
};

export = RulesHelpModule;
