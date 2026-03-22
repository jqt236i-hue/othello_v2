/**
 * @file rules-help.js
 * @description Help modal handlers (catalog / glossary / rules / updates)
 */

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
                    '水晶の意志コスト7から8に変更、カードビジュアルのカラーリングを変更',
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

function _safeText(value, fallback) {
    const text = String(value || '').trim();
    if (text) return text;
    return String(fallback || '');
}

function _escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const _effectTermsPattern = (() => {
    const sorted = EFFECT_GLOSSARY_TERMS
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((term) => _escapeRegExp(term));
    if (!sorted.length) return null;
    return new RegExp(`(${sorted.join('|')})`, 'g');
})();

function _highlightEffectTerms(escapedText) {
    if (!_effectTermsPattern) return escapedText;
    return String(escapedText || '').replace(_effectTermsPattern, '<span class="rules-help-term-highlight">$1</span>');
}

function _formatHelpText(text) {
    const escaped = _escapeHtml(text);
    const highlighted = _highlightEffectTerms(escaped);
    return highlighted.replace(/\n/g, '<br>');
}

function _normalizeCardDescText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/。+/g, '。')
        .trim();
}

function _splitHelpSentences(text) {
    const lines = String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const sentences = [];
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

function _buildHelpComparisonKey(text) {
    return _normalizeCardDescText(text)
        .replace(/[\s\u3000]/g, '')
        .replace(/[。\.、,，:：;；!！?？'"“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
        .toLowerCase();
}

function _isHelpPlaceholderText(text) {
    const key = _buildHelpComparisonKey(text);
    if (!key) return true;
    return key === _buildHelpComparisonKey('効果説明は準備中')
        || key === _buildHelpComparisonKey('詳細説明は準備中')
        || key === _buildHelpComparisonKey('効果説明が未登録です');
}

function _resolveNonDuplicateDetailText(quickText, detailText) {
    const quick = _safeText(quickText, '');
    const detail = _safeText(detailText, '');
    if (!detail) return '';
    if (!quick) return detail;
    if (_isHelpPlaceholderText(detail)) return '';

    const quickKey = _buildHelpComparisonKey(quick);
    const detailKey = _buildHelpComparisonKey(detail);
    if (!detailKey) return '';
    if (!quickKey) return detail;
    if (detailKey === quickKey) return '';

    const detailSentences = _splitHelpSentences(detail);
    if (detailSentences.length === 0) return '';

    const keepSentences = [];
    const seenSentenceKeys = new Set();
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

const _rulesHelpCardInteractionEffectsModule = (() => {
    if (typeof CardInteractionEffects !== 'undefined' && CardInteractionEffects) return CardInteractionEffects;
    if (typeof window !== 'undefined' && window.CardInteractionEffects) return window.CardInteractionEffects;
    if (typeof require === 'function') {
        try { return require('../../cards/card-interaction-effects'); } catch (e) { /* ignore */ }
        try { return require('../cards/card-interaction-effects'); } catch (e) { /* ignore */ }
    }
    return null;
})();

function _fallbackQuickCardEffect(cardDef) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '効果説明は準備中';
    const firstSentence = normalized.split('。').map((s) => s.trim()).filter(Boolean)[0] || normalized;
    return firstSentence.length > 38 ? `${firstSentence.slice(0, 38)}...` : firstSentence;
}

function _fallbackDetailCardEffect(cardDef) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '詳細説明は準備中';
    return normalized.replace(/。/g, '。\n').trim();
}

function _getQuickCardEffect(cardDef) {
    if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.getQuickCardEffect === 'function') {
        return _rulesHelpCardInteractionEffectsModule.getQuickCardEffect(cardDef);
    }
    return _fallbackQuickCardEffect(cardDef);
}

function _getDetailCardEffect(cardDef) {
    if (_rulesHelpCardInteractionEffectsModule && typeof _rulesHelpCardInteractionEffectsModule.getDetailCardEffect === 'function') {
        return _rulesHelpCardInteractionEffectsModule.getDetailCardEffect(cardDef, () => '99');
    }
    return _fallbackDetailCardEffect(cardDef);
}

function _getSharedVisualEffectsMap() {
    try {
        if (typeof window !== 'undefined' && window.GameVisualEffectsMap && window.GameVisualEffectsMap.STONE_VISUAL_EFFECTS) {
            return window.GameVisualEffectsMap;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const mod = require('../../game/visual-effects-map');
            if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _resolveSpecialStoneImagePath(cardType) {
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

function _normalizeCatalogCards(rawCards) {
    if (!Array.isArray(rawCards)) return [];
    const normalized = [];
    const seen = new Set();
    for (const raw of rawCards) {
        if (!raw || typeof raw !== 'object') continue;
        const id = _safeText(raw.id || raw.type, '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const name = _safeText(raw.name || raw.name_ja || raw.type, id);
        const desc = _safeText(raw.desc || raw.desc_ja, '効果説明が未登録です。');
        const type = _safeText(raw.type, '');
        const cost = Number(raw.cost);
        normalized.push({
            id,
            name,
            type,
            desc,
            cost: Number.isFinite(cost) ? cost : null
        });
    }
    return normalized;
}

function _sortCatalogCards(cards) {
    return cards.slice().sort((a, b) => {
        const costA = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
        const costB = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
        if (costA !== costB) return costA - costB;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
    });
}

function _readCatalogCards() {
    let cards = [];
    try {
        const root = (typeof window !== 'undefined' && window) ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
        if (root && root.CardCatalog && Array.isArray(root.CardCatalog.cards)) {
            cards = _normalizeCatalogCards(root.CardCatalog.cards);
            if (cards.length > 0) return _sortCatalogCards(cards);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS)) {
            cards = _normalizeCatalogCards(CARD_DEFS);
        }
    } catch (e) { /* ignore */ }
    return _sortCatalogCards(cards);
}

function createHelpUpdateSection(title, items) {
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

function renderHelpUpdates(updateListEl) {
    if (!updateListEl) return;
    updateListEl.innerHTML = '';

    if (!HELP_UPDATE_HISTORY.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'rules-help-update-empty';
        emptyEl.textContent = 'アップデート情報はまだありません。';
        updateListEl.appendChild(emptyEl);
        return;
    }

    for (const release of HELP_UPDATE_HISTORY) {
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

function setupRulesHelp(rulesHelpBtn, rulesHelpPanel) {
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
    let selectedCardId = null;

    function getCardLabel(card) {
        if (!card) return '';
        const costText = Number.isFinite(card.cost) ? String(card.cost) : '-';
        return `コスト${costText} ${card.name}`;
    }

    function createCardSection(title, bodyText) {
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

    function createSpecialStoneVisual(path) {
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

    function updateSelectedCard(cardId) {
        if (!cardId) return;
        const card = catalogCards.find((entry) => entry.id === cardId);
        if (!card) return;
        selectedCardId = card.id;
        if (cardNameEl) cardNameEl.textContent = getCardLabel(card);
        if (cardDescEl) {
            const quick = _safeText(_getQuickCardEffect(card), card.desc);
            const detail = _resolveNonDuplicateDetailText(quick, _getDetailCardEffect(card));
            cardDescEl.innerHTML = '';
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

    function renderCatalogCards() {
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
            itemBtn.textContent = getCardLabel(card);
            itemBtn.addEventListener('click', () => {
                updateSelectedCard(card.id);
            });
            cardListEl.appendChild(itemBtn);
        }

        updateSelectedCard(catalogCards[0].id);
    }

    function activateTab(tabKey) {
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

    function openPanel() {
        isOpen = true;
        rulesHelpPanel.classList.add('is-open');
        rulesHelpPanel.setAttribute('aria-hidden', 'false');
        rulesHelpBtn.setAttribute('aria-expanded', 'true');
        if (tabButtons.length > 0) {
            const activeTab = tabButtons.find((button) => button.classList.contains('is-active'));
            const tabKey = activeTab ? activeTab.getAttribute('data-help-tab') : tabButtons[0].getAttribute('data-help-tab');
            activateTab(tabKey);
        }
    }

    function closePanel() {
        isOpen = false;
        rulesHelpPanel.classList.remove('is-open');
        rulesHelpPanel.setAttribute('aria-hidden', 'true');
        rulesHelpBtn.setAttribute('aria-expanded', 'false');
    }

    rulesHelpBtn.addEventListener('click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (isOpen) {
            closePanel();
        } else {
            openPanel();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            closePanel();
        });
    }

    for (const tabBtn of tabButtons) {
        tabBtn.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            activateTab(tabBtn.getAttribute('data-help-tab'));
        });
    }

    document.addEventListener('pointerdown', (event) => {
        if (!isOpen) return;
        const target = event ? event.target : null;
        if (!target) return;
        if (rulesHelpPanel.contains(target) || rulesHelpBtn.contains(target)) return;
        closePanel();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (!isOpen) return;
        if (!event || event.key !== 'Escape') return;
        closePanel();
    });

    renderCatalogCards();
    renderHelpUpdates(updatesListEl);
    if (tabButtons.length > 0) {
        const activeTab = tabButtons.find((button) => button.classList.contains('is-active'));
        activateTab(activeTab ? activeTab.getAttribute('data-help-tab') : tabButtons[0].getAttribute('data-help-tab'));
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupRulesHelp
    };
}

if (typeof window !== 'undefined') {
    window.setupRulesHelp = setupRulesHelp;
}
