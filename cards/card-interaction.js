// ===== Card UI State & Interaction (Refactored to use CardLogic) =====

if (typeof CardLogic === 'undefined') {
    console.error('CardLogic is not loaded. Please include game/logic/cards.js');
}

// Note: Debug mode flags are stored on window object:
// - window.DEBUG_HUMAN_VS_HUMAN: HvH mode enabled
// - window.DEBUG_UNLIMITED_USAGE: Unlimited card usage mode

function _getDebugActions() {
    if (typeof DebugActions !== 'undefined') return DebugActions;
    if (typeof require === 'function') {
        try { return require('../game/debug/debug-actions'); } catch (e) { /* ignore */ }
    }
    return null;
}

function _isDebugAllowed() {
    try {
        if (typeof window === 'undefined') return false;
        if (window.DEBUG_MODE_ALLOWED === true) return true;
        if (window.DEBUG_MODE_ALLOWED === false) return false;
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        return /[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs);
    } catch (e) {
        return false;
    }
}

function ensureDebugActionsLoaded(cb) {
    try {
        if (typeof window === 'undefined') return cb && cb(null);
        if (!_isDebugAllowed()) return cb && cb(null);
        if (typeof DebugActions !== 'undefined') return cb && cb(DebugActions);
        if (window.__debugActionsLoading) {
            window.__debugActionsWaiters = window.__debugActionsWaiters || [];
            if (cb) window.__debugActionsWaiters.push(cb);
            return;
        }
        window.__debugActionsLoading = true;
        window.__debugActionsWaiters = window.__debugActionsWaiters || [];
        if (cb) window.__debugActionsWaiters.push(cb);
        const s = document.createElement('script');
        s.src = 'game/debug/debug-actions.js';
        s.async = false;
        s.onload = () => {
            window.__debugActionsLoading = false;
            window.__debugActionsLoaded = true;
            const waiters = window.__debugActionsWaiters || [];
            window.__debugActionsWaiters = [];
            for (const fn of waiters) { try { fn(DebugActions); } catch (e) {} }
        };
        s.onerror = () => {
            window.__debugActionsLoading = false;
            const waiters = window.__debugActionsWaiters || [];
            window.__debugActionsWaiters = [];
            for (const fn of waiters) { try { fn(null); } catch (e) {} }
        };
        document.head.appendChild(s);
    } catch (e) { if (cb) cb(null); }
}
if (typeof window !== 'undefined') {
    window.ensureDebugActionsLoaded = ensureDebugActionsLoaded;
}

const _playbackStateModule = (() => {
    if (typeof PlaybackStateManager !== 'undefined' && PlaybackStateManager) return PlaybackStateManager;
    if (typeof require === 'function') {
        try { return require('../ui/playback-state-manager'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) return globalThis.PlaybackStateManager;
    } catch (e) { /* ignore */ }
    return null;
})();

const _sellSelectionByPlayer = { black: null, white: null };
const _heavenSelectionByPlayer = { black: null, white: null };
let _heavenOverlayRefs = null;
let _cardDetailExpanded = false;
let _cardDetailExpandedForCardId = null;
let _cardDetailTabRefs = null;
let _cardDetailTabState = {
    open: false,
    mode: null,
    key: null,
    cardId: null
};
let _cardDetailLandscapeAnchorSyncInitialized = false;
let _cardDetailLandscapeAnchorResizeObserver = null;
let _cardDetailLandscapeAnchorRafId = null;
let _cardDetailTagAutoDismissBound = false;
const _hiddenHandTokenPattern = /^__hidden_hand__:(black|white):(\d+)$/;
const LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY = '__skipNextPlaybackSoundUntilByKey';
const LOCAL_PLAYBACK_SOUND_SKIP_MS = 5000;

const CARD_DETAIL_TAG_MEANINGS = Object.freeze({
    '多動状態': '両者ターン開始時マス移動する、基本ランダム移動。',
    '反転回避': '相手に石を置かれて反転されるとき、マス移動でその石だけ回避する。',
    '破壊回避': '破壊対象になったとき、空きマスへ移動してその石だけ回避する。',
    '特殊石': '通常石画像を使わない石。normal_stone-black.png / normal_stone-white.png 以外の見た目の石を指す。交換の意志の対象外。',
    '反転保護': '反転されない。挟める列ごと無効できる。',
    '完全保護': 'マス破壊以外の全ての効果を無効化。',
    'マス破壊': 'マスごと穴にして永続封鎖。誰も置けず、反転経路も遮断する。',
    '破壊／爆発': '石を消滅させる。完全保護以外の保護を貫通できる。',
    '連鎖反転': '通常反転の後さらに挟める列ができた場合追加で一方向だけ反転させる。',
    '禁忌反転': '挟めなくても反転可能。最も反転枚数が多い列1方向のみ。'
});

function _resolveChargeMaxText() {
    try {
        if (typeof CHARGE_MAX !== 'undefined' && Number.isFinite(Number(CHARGE_MAX))) {
            return String(Number(CHARGE_MAX));
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && Number.isFinite(Number(window.CHARGE_MAX))) {
            return String(Number(window.CHARGE_MAX));
        }
    } catch (e) { /* ignore */ }
    return '99';
}

function _isLandscapeCardDetailAnchorTarget() {
    if (typeof window === 'undefined') return false;
    const width = Number(window.innerWidth || 0);
    const height = Number(window.innerHeight || 0);
    return width > height && width >= 901;
}

function _clearCardDetailLandscapeAnchorReserve() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root || !root.style) return;
    root.style.removeProperty('--card-detail-landscape-bottom-reserve');
}

function _syncCardDetailLandscapeAnchorReserve() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root || !root.style) return;
    if (!_isLandscapeCardDetailAnchorTarget()) {
        _clearCardDetailLandscapeAnchorReserve();
        return;
    }
    const sidePanel = document.getElementById('side-panel');
    if (!sidePanel || typeof sidePanel.getBoundingClientRect !== 'function') {
        _clearCardDetailLandscapeAnchorReserve();
        return;
    }
    const rect = sidePanel.getBoundingClientRect();
    if (!Number.isFinite(rect.top)) {
        _clearCardDetailLandscapeAnchorReserve();
        return;
    }
    const panelEl = document.getElementById('card-detail-panel');
    const cpuLabelEl = document.getElementById('cpu-level-label');
    const panelRect = panelEl && typeof panelEl.getBoundingClientRect === 'function'
        ? panelEl.getBoundingClientRect()
        : null;
    const cpuLabelRect = cpuLabelEl && typeof cpuLabelEl.getBoundingClientRect === 'function'
        ? cpuLabelEl.getBoundingClientRect()
        : null;

    const reserveMin = 170;
    const reserveFromSidePanel = Math.round((window.innerHeight - rect.top) + 20);
    const reserveSafeFloor = Math.max(120, reserveFromSidePanel);
    let reserve = Math.max(reserveMin, reserveFromSidePanel);

    if (cpuLabelRect && Number.isFinite(cpuLabelRect.bottom)) {
        const panelHeight = (panelRect && Number.isFinite(panelRect.height) && panelRect.height > 0)
            ? panelRect.height
            : 220;
        const desiredTop = Math.round(cpuLabelRect.bottom + 12);
        const reserveMaxForCpuLabel = Math.max(120, Math.floor(window.innerHeight - desiredTop - panelHeight));
        reserve = Math.max(reserveSafeFloor, Math.min(reserve, reserveMaxForCpuLabel));
    }

    root.style.setProperty('--card-detail-landscape-bottom-reserve', `${reserve}px`);
}

function _scheduleCardDetailLandscapeAnchorSync() {
    if (typeof window === 'undefined') return;
    if (_cardDetailLandscapeAnchorRafId !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(_cardDetailLandscapeAnchorRafId);
    }
    if (typeof window.requestAnimationFrame === 'function') {
        _cardDetailLandscapeAnchorRafId = window.requestAnimationFrame(() => {
            _cardDetailLandscapeAnchorRafId = null;
            _syncCardDetailLandscapeAnchorReserve();
        });
        return;
    }
    _cardDetailLandscapeAnchorRafId = null;
    _syncCardDetailLandscapeAnchorReserve();
}

function _initCardDetailLandscapeAnchorSync() {
    if (_cardDetailLandscapeAnchorSyncInitialized) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    _cardDetailLandscapeAnchorSyncInitialized = true;

    const sidePanel = document.getElementById('side-panel');
    if (typeof ResizeObserver === 'function' && sidePanel) {
        _cardDetailLandscapeAnchorResizeObserver = new ResizeObserver(() => {
            _scheduleCardDetailLandscapeAnchorSync();
        });
        try {
            _cardDetailLandscapeAnchorResizeObserver.observe(sidePanel);
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('resize', _scheduleCardDetailLandscapeAnchorSync, { passive: true });
    window.addEventListener('orientationchange', _scheduleCardDetailLandscapeAnchorSync, { passive: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _scheduleCardDetailLandscapeAnchorSync, { once: true });
    }
    _scheduleCardDetailLandscapeAnchorSync();
}

function _normalizeOwnerKey(ownerKey) {
    return ownerKey === 'white' ? 'white' : 'black';
}

function _isHiddenHandToken(cardId) {
    return _hiddenHandTokenPattern.test(String(cardId || ''));
}

function _getCardDisplayLabel(cardId, cardDef) {
    if (cardDef && cardDef.name) return cardDef.name;
    if (_isHiddenHandToken(cardId)) return '不明カード';
    return cardId || '-';
}

function _setSelectedCardSelection(cardId, ownerKey) {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardId) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
        return;
    }
    cardState.selectedCardId = cardId;
    cardState.selectedCardOwnerKey = _normalizeOwnerKey(ownerKey);
}

function _clearSelectedCardSelection() {
    if (!cardState || typeof cardState !== 'object') return;
    cardState.selectedCardId = null;
    cardState.selectedCardOwnerKey = null;
}

function _getSelectedCardOwnerKey(defaultOwnerKey) {
    if (cardState && (cardState.selectedCardOwnerKey === 'white' || cardState.selectedCardOwnerKey === 'black')) {
        return cardState.selectedCardOwnerKey;
    }
    return _normalizeOwnerKey(defaultOwnerKey);
}

const _cardInteractionEffectsModule = (() => {
    if (typeof CardInteractionEffects !== 'undefined' && CardInteractionEffects) return CardInteractionEffects;
    if (typeof require === 'function') {
        try { return require('./card-interaction-effects'); } catch (e) { /* ignore */ }
    }
    return null;
})();

const _pendingSelectionFlowModule = (() => {
    if (typeof PendingSelectionFlow !== 'undefined' && PendingSelectionFlow) return PendingSelectionFlow;
    if (typeof require === 'function') {
        try { return require('../game/card-effects/selection-flow'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) return globalThis.PendingSelectionFlow;
    } catch (e) { /* ignore */ }
    return null;
})();

function _normalizeCardDescText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/。+/g, '。')
        .trim();
}

function _fallbackQuickCardEffect(cardDef) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '効果説明は準備中';
    const firstSentence = normalized.split('。').map(s => s.trim()).filter(Boolean)[0] || normalized;
    return firstSentence.length > 32 ? `${firstSentence.slice(0, 32)}...` : firstSentence;
}

function _fallbackDetailCardEffect(cardDef) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '詳細説明は準備中';
    return normalized.replace(/。/g, '。\n').trim();
}

function _getQuickCardEffect(cardDef) {
    if (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getQuickCardEffect === 'function') {
        return _cardInteractionEffectsModule.getQuickCardEffect(cardDef);
    }
    if (!cardDef) return 'カードを選択してください';
    return _fallbackQuickCardEffect(cardDef);
}

function _getDetailCardEffect(cardDef) {
    if (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getDetailCardEffect === 'function') {
        return _cardInteractionEffectsModule.getDetailCardEffect(cardDef, _resolveChargeMaxText);
    }
    if (!cardDef) return '';
    return _fallbackDetailCardEffect(cardDef);
}

const _NORMAL_STONE_IMAGE_FILE_KEYS = Object.freeze([
    'normal_stone-black.png',
    'normal_stone-white.png',
    'normal-stone-black.png',
    'normal-stone-white.png'
]);

function _getGameVisualEffectsMapForCardDetail() {
    try {
        const root = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof window !== 'undefined' ? window : null);
        if (
            root &&
            root.GameVisualEffectsMap &&
            root.GameVisualEffectsMap.STONE_VISUAL_EFFECTS &&
            (
                root.GameVisualEffectsMap.PENDING_TYPE_TO_EFFECT_KEY ||
                typeof root.GameVisualEffectsMap.getEffectKeyForPendingType === 'function'
            )
        ) {
            return root.GameVisualEffectsMap;
        }
    } catch (e) { /* ignore */ }

    if (typeof require === 'function') {
        try {
            const mod = require('../game/visual-effects-map');
            if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
        } catch (e) { /* ignore */ }
    }
    return null;
}

function _collectCardVisualImagePaths(cardType) {
    if (!cardType) return [];
    const map = _getGameVisualEffectsMapForCardDetail();
    if (!map || !map.STONE_VISUAL_EFFECTS) return [];

    const effectKey = (map.PENDING_TYPE_TO_EFFECT_KEY && map.PENDING_TYPE_TO_EFFECT_KEY[cardType])
        || (typeof map.getEffectKeyForPendingType === 'function' ? map.getEffectKeyForPendingType(cardType) : null);
    if (!effectKey) return [];

    const effect = map.STONE_VISUAL_EFFECTS[effectKey];
    if (!effect || typeof effect !== 'object') return [];

    const paths = [];
    if (typeof effect.imagePath === 'string') paths.push(effect.imagePath);
    if (effect.imagePathByOwner && typeof effect.imagePathByOwner === 'object') {
        for (const value of Object.values(effect.imagePathByOwner)) {
            if (typeof value === 'string') paths.push(value);
        }
    }
    if (effect.imagePathByPlayer && typeof effect.imagePathByPlayer === 'object') {
        for (const value of Object.values(effect.imagePathByPlayer)) {
            if (typeof value === 'string') paths.push(value);
        }
    }
    return paths;
}

function _isNormalStoneImagePath(imagePath) {
    const normalized = String(imagePath || '').toLowerCase();
    if (!normalized) return false;
    return _NORMAL_STONE_IMAGE_FILE_KEYS.some((key) => normalized.includes(key));
}

function _usesNonNormalStoneImage(cardDef) {
    const cardType = cardDef && cardDef.type ? String(cardDef.type) : '';
    if (!cardType) return false;
    const paths = _collectCardVisualImagePaths(cardType);
    if (!paths.length) return false;
    return paths.some((path) => !_isNormalStoneImagePath(path));
}

function _hasFlipEvasionTagSignal(sourceText) {
    const normalized = String(sourceText || '').replace(/\s+/g, '');
    if (!normalized) return false;
    if (normalized.includes('反転回避')) return true;

    const patterns = [
        /反転対象(?:になった時|になったとき|時)?[^。！？!?]*回避/,
        /反転される(?:とき|時)[^。！？!?]*回避/,
        /反転対象時は[^。！？!?]*回避/
    ];
    return patterns.some((pattern) => pattern.test(normalized));
}

function _hasDestroyEvasionTagSignal(sourceText) {
    const normalized = String(sourceText || '').replace(/\s+/g, '');
    if (!normalized) return false;
    if (normalized.includes('破壊回避')) return true;

    const patterns = [
        /破壊対象(?:になった時|になったとき|時)?[^。！？!?]*回避/,
        /破壊され(?:そうになるとき|そうになったとき|るとき|る時)[^。！？!?]*回避/,
        /破壊ターゲット[^。！？!?]*回避/
    ];
    return patterns.some((pattern) => pattern.test(normalized));
}

const CARD_DETAIL_EFFECT_TAG_TERMS = Object.freeze([
    '反転保護',
    '特殊石',
    '完全保護',
    '反転回避',
    '破壊回避',
    '多動状態',
    'マス破壊',
    '破壊／爆発',
    '連鎖反転',
    '禁忌反転'
]);

function _collectCardDetailEffectTags(cardDef, quickText, detailText) {
    const sourceText = [
        String(quickText || ''),
        String(detailText || ''),
        String(cardDef && cardDef.desc ? cardDef.desc : '')
    ].join('\n');
    if (!sourceText) return [];

    const usesNonNormalStoneImage = _usesNonNormalStoneImage(cardDef);
    const hasFlipEvasionTagSignal = _hasFlipEvasionTagSignal(sourceText);
    const hasDestroyEvasionTagSignal = _hasDestroyEvasionTagSignal(sourceText);
    const tags = [];
    for (const term of CARD_DETAIL_EFFECT_TAG_TERMS) {
        if (term === '特殊石') {
            if (usesNonNormalStoneImage) tags.push(term);
            continue;
        }
        if (term === '反転回避') {
            if (sourceText.includes(term) || hasFlipEvasionTagSignal) tags.push(term);
            continue;
        }
        if (term === '破壊回避') {
            if (sourceText.includes(term) || hasDestroyEvasionTagSignal) tags.push(term);
            continue;
        }
        if (sourceText.includes(term)) tags.push(term);
    }
    return tags;
}

function _stripCardDetailTagPhrases(text) {
    let normalized = String(text || '');
    if (!normalized) return '';
    const patterns = [
        /反転保護を持つ特殊石として扱われ、/g,
        /反転保護を持つ特殊石として扱う。?/g,
        /反転保護を持つ特殊石。?/g,
        /反転保護を持つ。?/g,
        /特殊石として扱われ、/g,
        /特殊石として扱う。?/g
    ];
    for (const pattern of patterns) {
        normalized = normalized.replace(pattern, '');
    }
    normalized = normalized
        .replace(/\s+/g, ' ')
        .replace(/。{2,}/g, '。')
        .replace(/^\s*[、。]+/, '')
        .replace(/[、。]+\s*$/, '')
        .trim();
    if (!normalized) return '';
    if (!/[。！？!?]$/.test(normalized)) normalized = `${normalized}。`;
    return normalized;
}

function _ensureCardDetailEffectTagsElement() {
    if (typeof document === 'undefined') return null;
    let tagsEl = document.getElementById('card-detail-effect-tags');
    if (tagsEl) return tagsEl;
    const panelEl = document.getElementById('card-detail-panel');
    if (!panelEl) return null;
    tagsEl = document.createElement('div');
    tagsEl.id = 'card-detail-effect-tags';
    tagsEl.setAttribute('aria-label', 'カード効果タグ');
    const detailMoreEl = document.getElementById('card-detail-more');
    if (detailMoreEl && detailMoreEl.parentElement === panelEl) {
        panelEl.insertBefore(tagsEl, detailMoreEl);
    } else {
        panelEl.appendChild(tagsEl);
    }
    return tagsEl;
}

function _renderCardDetailEffectTags(tagsEl, tags) {
    if (!tagsEl) return;
    tagsEl.textContent = '';
    if (!Array.isArray(tags) || tags.length === 0) {
        tagsEl.style.display = 'none';
        return;
    }

    const selectedCardId = cardState && cardState.selectedCardId ? String(cardState.selectedCardId) : null;
    for (const tag of tags) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'card-detail-effect-tag card-detail-effect-tag-button';
        chip.textContent = tag;
        chip.setAttribute('aria-label', `${tag}の説明を表示`);
        chip.addEventListener('click', () => {
            const meaning = CARD_DETAIL_TAG_MEANINGS[tag] || `${tag}の説明は未登録です。`;
            _toggleCardDetailTabPanel({
                mode: 'tag',
                key: tag,
                cardId: selectedCardId,
                title: tag,
                body: meaning
            });
            updateCardDetailPanel();
        });
        tagsEl.appendChild(chip);
    }
    tagsEl.style.display = 'flex';
}

function _ensureCardDetailTabPanel() {
    if (typeof document === 'undefined') return null;
    if (_cardDetailTabRefs && _cardDetailTabRefs.root && _cardDetailTabRefs.root.isConnected) {
        return _cardDetailTabRefs;
    }

    let root = document.getElementById('card-detail-tab-panel');
    if (!root) {
        root = document.createElement('div');
        root.id = 'card-detail-tab-panel';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'false');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div id="card-detail-tab-header">',
            '  <div id="card-detail-tab-title">詳細</div>',
            '  <button id="card-detail-tab-close-btn" type="button" aria-label="閉じる">×</button>',
            '</div>',
            '<div id="card-detail-tab-body"></div>'
        ].join('');
        document.body.appendChild(root);
    }

    _cardDetailTabRefs = {
        root,
        title: root.querySelector('#card-detail-tab-title'),
        body: root.querySelector('#card-detail-tab-body'),
        closeBtn: root.querySelector('#card-detail-tab-close-btn')
    };

    if (_cardDetailTabRefs.closeBtn && _cardDetailTabRefs.closeBtn.dataset.bound !== '1') {
        _cardDetailTabRefs.closeBtn.addEventListener('click', () => {
            _closeCardDetailTabPanel();
            updateCardDetailPanel();
        });
        _cardDetailTabRefs.closeBtn.dataset.bound = '1';
    }

    return _cardDetailTabRefs;
}

function _closeCardDetailTabPanel() {
    const refs = _ensureCardDetailTabPanel();
    if (!refs || !refs.root) return;
    refs.root.classList.remove('is-open');
    refs.root.setAttribute('aria-hidden', 'true');
    _cardDetailTabState = { open: false, mode: null, key: null, cardId: null };
    _cardDetailExpanded = false;
    _cardDetailExpandedForCardId = null;
}

function _openCardDetailTabPanel(payload) {
    const refs = _ensureCardDetailTabPanel();
    if (!refs || !refs.root || !refs.title || !refs.body) return false;

    const title = payload && payload.title ? String(payload.title) : '詳細';
    const body = payload && payload.body ? String(payload.body) : '説明は準備中です。';
    const mode = payload && payload.mode ? String(payload.mode) : 'detail';
    const key = payload && payload.key ? String(payload.key) : null;
    const cardId = payload && payload.cardId ? String(payload.cardId) : null;

    refs.title.textContent = title;
    refs.body.textContent = body;
    refs.root.classList.add('is-open');
    refs.root.setAttribute('aria-hidden', 'false');

    _cardDetailTabState = { open: true, mode, key, cardId };
    if (mode === 'detail') {
        _cardDetailExpanded = true;
        _cardDetailExpandedForCardId = cardId;
    }
    return true;
}

function _toggleCardDetailTabPanel(payload) {
    const mode = payload && payload.mode ? String(payload.mode) : 'detail';
    const key = payload && payload.key ? String(payload.key) : null;
    const cardId = payload && payload.cardId ? String(payload.cardId) : null;

    const isSame = _cardDetailTabState.open &&
        _cardDetailTabState.mode === mode &&
        _cardDetailTabState.key === key &&
        _cardDetailTabState.cardId === cardId;

    if (isSame) {
        _closeCardDetailTabPanel();
        return false;
    }

    return _openCardDetailTabPanel(payload);
}

function _isCardDetailTagTabOpen() {
    return !!(_cardDetailTabState && _cardDetailTabState.open && _cardDetailTabState.mode === 'tag');
}

function _closeCardDetailTagTabIfOpen() {
    if (!_isCardDetailTagTabOpen()) return false;
    _closeCardDetailTabPanel();
    return true;
}

function _bindCardDetailTagAutoDismiss() {
    if (_cardDetailTagAutoDismissBound) return;
    if (typeof document === 'undefined') return;

    const outsidePointerEvent = (typeof window !== 'undefined' && typeof window.PointerEvent === 'function')
        ? 'pointerdown'
        : 'mousedown';

    document.addEventListener(outsidePointerEvent, (event) => {
        if (!_isCardDetailTagTabOpen()) return;

        const rawTarget = event ? event.target : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);

        if (targetEl && typeof targetEl.closest === 'function') {
            if (targetEl.closest('#card-detail-tab-panel')) return;
            if (targetEl.closest('#card-detail-effect-tags')) return;
        }

        _closeCardDetailTagTabIfOpen();
    }, true);

    _cardDetailTagAutoDismissBound = true;
}

function _clearSellSelection(playerKey) {
    if (!playerKey) return;
    const prev = _sellSelectionByPlayer[playerKey];
    _sellSelectionByPlayer[playerKey] = null;
    if (cardState && cardState.selectedCardId === prev) {
        const selectedOwnerKey = (cardState.selectedCardOwnerKey === 'white' || cardState.selectedCardOwnerKey === 'black')
            ? cardState.selectedCardOwnerKey
            : null;
        if (!selectedOwnerKey || selectedOwnerKey === _normalizeOwnerKey(playerKey)) {
            _clearSelectedCardSelection();
        }
    }
}

function _setPendingSelectionBusy(active) {
    if (_pendingSelectionFlowModule && typeof _pendingSelectionFlowModule.setSelectionBusy === 'function') {
        _pendingSelectionFlowModule.setSelectionBusy(active);
        return;
    }
    const normalized = !!active;
    const rootRef = _getUiRootRef();
    try { if (typeof isProcessing !== 'undefined') isProcessing = normalized; } catch (e) { /* ignore */ }
    try { if (typeof isCardAnimating !== 'undefined') isCardAnimating = normalized; } catch (e) { /* ignore */ }
    try {
        if (rootRef) {
            rootRef.isProcessing = normalized;
            rootRef.isCardAnimating = normalized;
        }
    } catch (e) { /* ignore */ }
}

function _createPendingSelectionAction(playerKey, pendingType, actionPayload) {
    if (_pendingSelectionFlowModule && typeof _pendingSelectionFlowModule.createPendingSelectionAction === 'function') {
        return _pendingSelectionFlowModule.createPendingSelectionAction(playerKey, pendingType, actionPayload, { cardState });
    }
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('place', playerKey, actionPayload)
        : Object.assign({ type: 'place' }, actionPayload || {});
    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }
    return action;
}

function _finalizePendingSelectionAfterRun(playerKey, pendingType, runResult) {
    const playbackEvents = _getRunResultPlaybackEvents(runResult);

    if (!_pendingSelectionFlowModule || typeof _pendingSelectionFlowModule.finalizePendingSelectionFlow !== 'function') {
        _setPendingSelectionBusy(false);
        if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
        return;
    }

    Promise.resolve(_pendingSelectionFlowModule.finalizePendingSelectionFlow({
        playerKey,
        pendingType,
        playbackEvents,
        gameStateValue: gameState,
        cardStateValue: cardState,
        ensureCurrentPlayerCanActOrPass: typeof ensureCurrentPlayerCanActOrPass === 'function'
            ? ensureCurrentPlayerCanActOrPass
            : null
    })).catch(() => {
        _setPendingSelectionBusy(false);
        if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
    });
}

function _executeSellSelection(playerKey, sellCardId) {
    if (!sellCardId) return { ok: false, reason: 'no_sell_card' };
    if (!_canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    _setPendingSelectionBusy(true);
    let completed = false;

    try {
        const soldCardDef = CardLogic.getCardDef(sellCardId);
        const action = _createPendingSelectionAction(playerKey, 'SELL_CARD_WILL', { sellCardId });
        const gain = soldCardDef ? (soldCardDef.cost || 0) : 0;

        if (_startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                _clearSellSelection(playerKey);
                if (typeof renderCardUI === 'function') renderCardUI();
            },
            onFailure: () => {
                _clearLocalPlaybackSoundSkip('charge_gain_common');
                if (typeof renderCardUI === 'function') renderCardUI();
                addLog('売却に失敗しました');
                _setPendingSelectionBusy(false);
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }

        const result = _runPipelineAction(playerKey, action);
        if (!result.ok) return result;

        addLog(`${playerKey === 'black' ? '黒' : '白'}が${soldCardDef ? soldCardDef.name : sellCardId}を売却（+${gain}）`);
        _clearSellSelection(playerKey);
        const shouldDelayPostActionHandVisual = _hasHandRemovePlaybackEvent(result);
        _renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual);
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
        _finalizePendingSelectionAfterRun(playerKey, 'SELL_CARD_WILL', result);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) _setPendingSelectionBusy(false);
    }
}

function _clearHeavenSelection(playerKey) {
    if (!playerKey) return;
    _heavenSelectionByPlayer[playerKey] = null;
}

function _doesPlayerOwnCard(playerKey, cardId) {
    if (!playerKey || !cardId || !cardState || !cardState.hands) return false;
    const hand = Array.isArray(cardState.hands[playerKey]) ? cardState.hands[playerKey] : [];
    return hand.includes(cardId);
}

function _ensureHandDestroyFlags() {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.hasDestroyedCardThisTurnByPlayer || typeof cardState.hasDestroyedCardThisTurnByPlayer !== 'object') {
        cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'black')) {
        cardState.hasDestroyedCardThisTurnByPlayer.black = false;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'white')) {
        cardState.hasDestroyedCardThisTurnByPlayer.white = false;
    }
}

function _isSelectedCardUsableNow(playerKey, cardId, opts) {
    if (!playerKey || !cardId || !cardState || !gameState) return false;
    if (!_doesPlayerOwnCard(playerKey, cardId)) return false;

    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getUsableCardIds === 'function') {
            const usableIds = CardLogic.getUsableCardIds(cardState, gameState, playerKey, opts) || [];
            return usableIds.includes(cardId);
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.canUseCard === 'function') {
            return !!CardLogic.canUseCard(cardState, playerKey, cardId);
        }
    } catch (e) { /* ignore */ }

    return true;
}

function _findCardElementInOwnerHand(cardId, ownerKey) {
    if (!cardId || typeof document === 'undefined') return null;
    const normalizedOwner = ownerKey === 'white' ? 'white' : 'black';
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');
    const handElements = [handBlackEl, handWhiteEl].filter(Boolean);
    const ownerMatched = [];

    for (const handEl of handElements) {
        const handOwner = handEl && handEl.dataset && handEl.dataset.ownerKey
            ? (handEl.dataset.ownerKey === 'white' ? 'white' : 'black')
            : null;
        const candidates = Array.from(handEl.querySelectorAll(`.card-item[data-card-id="${cardId}"]`));
        for (const candidate of candidates) {
            const cardOwner = candidate && candidate.dataset && candidate.dataset.ownerKey
                ? (candidate.dataset.ownerKey === 'white' ? 'white' : 'black')
                : handOwner;
            if (cardOwner && cardOwner !== normalizedOwner) continue;
            ownerMatched.push(candidate);
        }
    }

    if (ownerMatched.length > 0) {
        const visible = ownerMatched.find((el) => !el.classList.contains('hidden'));
        return visible || ownerMatched[0];
    }

    const legacyHandId = normalizedOwner === 'white' ? 'hand-white' : 'hand-black';
    const legacyHandEl = document.getElementById(legacyHandId);
    if (!legacyHandEl) return null;
    const legacyCandidates = Array.from(legacyHandEl.querySelectorAll(`.card-item[data-card-id="${cardId}"]`));
    if (!legacyCandidates.length) return null;
    const legacyVisible = legacyCandidates.find((el) => !el.classList.contains('hidden'));
    return legacyVisible || legacyCandidates[0];
}

function _ensureHeavenOverlay() {
    if (typeof document === 'undefined') return null;
    if (_heavenOverlayRefs && _heavenOverlayRefs.root && _heavenOverlayRefs.root.isConnected) {
        return _heavenOverlayRefs;
    }

    let root = document.getElementById('heaven-blessing-overlay');
    if (!root) {
        root = document.createElement('div');
        root.id = 'heaven-blessing-overlay';
        root.className = 'heaven-blessing-overlay';
        root.innerHTML = [
            '<div class="heaven-blessing-backdrop"></div>',
            '<div class="heaven-blessing-panel">',
            '  <div class="heaven-blessing-title">天の恵み</div>',
            '  <div class="heaven-blessing-subtitle">候補から1枚を選んで獲得</div>',
            '  <div class="heaven-blessing-offers" id="heaven-blessing-offers"></div>',
            '  <div class="heaven-blessing-detail">',
            '    <div class="heaven-blessing-detail-name" id="heaven-blessing-detail-name">-</div>',
            '    <div class="heaven-blessing-detail-desc" id="heaven-blessing-detail-desc">カードを選択してください</div>',
            '    <button class="heaven-blessing-select-btn" id="heaven-blessing-select-btn" disabled>選択</button>',
            '    <div class="heaven-blessing-reason" id="heaven-blessing-reason"></div>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(root);
    }

    _heavenOverlayRefs = {
        root,
        offers: root.querySelector('#heaven-blessing-offers'),
        detailName: root.querySelector('#heaven-blessing-detail-name'),
        detailDesc: root.querySelector('#heaven-blessing-detail-desc'),
        selectBtn: root.querySelector('#heaven-blessing-select-btn'),
        reason: root.querySelector('#heaven-blessing-reason')
    };

    return _heavenOverlayRefs;
}

function _hideHeavenOverlay() {
    const refs = _ensureHeavenOverlay();
    if (!refs || !refs.root) return;
    refs.root.classList.remove('active');
}

function _positionHeavenOverlayNearBoard() {
    const refs = _ensureHeavenOverlay();
    if (!refs || !refs.root) return;
    const panel = refs.root.querySelector('.heaven-blessing-panel');
    if (!panel) return;

    const boardFrame = document.getElementById('board-frame');
    if (!boardFrame || !boardFrame.getBoundingClientRect) return;
    const rect = boardFrame.getBoundingClientRect();
    const targetLeft = Math.round(rect.left + (rect.width / 2));
    const liftUpPx = Math.round((96 / 2.54) * 5); // 5cm
    let targetTop = Math.round(rect.bottom + 18 - liftUpPx);

    const estimatedHeight = 230;
    const maxTop = Math.max(12, window.innerHeight - estimatedHeight - 8);
    if (targetTop > maxTop) targetTop = maxTop;
    if (targetTop < 12) targetTop = 12;

    panel.style.left = `${targetLeft}px`;
    panel.style.top = `${targetTop}px`;
    panel.style.transform = 'translate(-50%, 0)';
}

function _getOverlayOfferKey(offer) {
    if (offer && typeof offer === 'object') {
        const idx = Number.isInteger(offer.handIndex) ? offer.handIndex : -1;
        return `${idx}:${offer.cardId || ''}`;
    }
    return String(offer || '');
}

function _resolveOverlayOfferByKey(offers, offerKey) {
    if (!Array.isArray(offers) || !offers.length) return null;
    for (const offer of offers) {
        if (_getOverlayOfferKey(offer) === offerKey) return offer;
    }
    return null;
}

function _renderHeavenOverlay(playerKey) {
    const refs = _ensureHeavenOverlay();
    if (!refs || !refs.root) return;

    const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
    const pendingType = pending && pending.type ? pending.type : null;
    const isSelecting = !!(pending && pending.stage === 'selectTarget' && (pendingType === 'HEAVEN_BLESSING' || pendingType === 'CONDEMN_WILL'));
    if (!isSelecting) {
        _hideHeavenOverlay();
        return;
    }
    const titleEl = refs.root.querySelector('.heaven-blessing-title');
    const subtitleEl = refs.root.querySelector('.heaven-blessing-subtitle');
    if (titleEl) titleEl.textContent = pendingType === 'CONDEMN_WILL' ? '断罪の意志' : '天の恵み';
    if (subtitleEl) subtitleEl.textContent = pendingType === 'CONDEMN_WILL' ? '相手手札から1枚を選んで破壊' : '候補から1枚を選んで獲得';

    const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
    if (!offers.length) {
        refs.root.classList.add('active');
        refs.offers.innerHTML = '';
        refs.detailName.textContent = '候補なし';
        refs.detailDesc.textContent = pendingType === 'CONDEMN_WILL' ? '対象カードがありません' : '候補カードがありません';
        refs.selectBtn.disabled = true;
        refs.reason.textContent = '';
        return;
    }

    let selectedKey = _heavenSelectionByPlayer[playerKey];
    if (!selectedKey || !_resolveOverlayOfferByKey(offers, selectedKey)) {
        selectedKey = _getOverlayOfferKey(offers[0]);
        _heavenSelectionByPlayer[playerKey] = selectedKey;
    }

    const handSize = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])) ? cardState.hands[playerKey].length : 0;
    const handLimit = (typeof HAND_LIMIT !== 'undefined') ? HAND_LIMIT : 5;
    const handFull = (pendingType === 'HEAVEN_BLESSING') ? (handSize >= handLimit) : false;

    refs.offers.innerHTML = '';
    for (const offer of offers) {
        const offerKey = _getOverlayOfferKey(offer);
        const cardId = (offer && typeof offer === 'object') ? offer.cardId : offer;
        const def = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(cardId)
            : null;
        const cardEl = document.createElement('div');
        cardEl.className = 'card-item visible heaven-offer-card';
        cardEl.dataset.cardId = cardId;
        const cost = def ? (def.cost || 0) : 0;
        const tier = getCardCostTier(cost);
        cardEl.classList.add(`cost-tier-${tier}`);
        if (selectedKey === offerKey) cardEl.classList.add('selected');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'card-name';
        nameSpan.textContent = _getCardDisplayLabel(cardId, def);
        cardEl.appendChild(nameSpan);

        const costBadge = document.createElement('div');
        costBadge.className = 'card-cost-badge';
        costBadge.classList.add(`cost-tier-${tier}`);
        costBadge.textContent = def ? `コスト${cost}` : 'コスト?';
        cardEl.appendChild(costBadge);

        cardEl.addEventListener('click', () => {
            _heavenSelectionByPlayer[playerKey] = offerKey;
            _renderHeavenOverlay(playerKey);
        });

        refs.offers.appendChild(cardEl);
    }

    const selectedOffer = _resolveOverlayOfferByKey(offers, selectedKey);
    const selectedCardId = (selectedOffer && typeof selectedOffer === 'object') ? selectedOffer.cardId : selectedOffer;
    const selectedDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? CardLogic.getCardDef(selectedCardId)
        : null;
    refs.detailName.textContent = _getCardDisplayLabel(selectedCardId, selectedDef);
    refs.detailDesc.textContent = selectedDef && selectedDef.desc
        ? selectedDef.desc
        : (_isHiddenHandToken(selectedCardId) ? 'この対戦モードでは詳細は非公開です' : '説明なし');

    refs.selectBtn.textContent = pendingType === 'CONDEMN_WILL' ? '破壊' : '選択';
    refs.selectBtn.disabled = handFull || !selectedOffer;
    refs.selectBtn.onclick = () => {
        if (!selectedOffer) return;
        if (pendingType === 'CONDEMN_WILL') {
            const targetIndex = (selectedOffer && typeof selectedOffer === 'object') ? selectedOffer.handIndex : null;
            _executeCondemnSelection(playerKey, targetIndex, selectedCardId);
            return;
        }
        _executeHeavenSelection(playerKey, selectedCardId);
    };

    refs.reason.textContent = handFull ? '手札上限のため選択できません' : '';
    refs.root.classList.add('active');
    _positionHeavenOverlayNearBoard();
}

function _executeHeavenSelection(playerKey, selectedCardId) {
    if (!selectedCardId) return { ok: false, reason: 'no_selection' };
    if (!_canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    _setPendingSelectionBusy(true);
    let completed = false;

    try {
        const def = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(selectedCardId)
            : null;

        const action = _createPendingSelectionAction(playerKey, 'HEAVEN_BLESSING', { heavenBlessingCardId: selectedCardId });

        if (_startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                _clearHeavenSelection(playerKey);
                _hideHeavenOverlay();
            },
            onFailure: () => {
                if (typeof renderCardUI === 'function') renderCardUI();
                addLog('天の恵みの選択送信に失敗しました');
                _setPendingSelectionBusy(false);
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }

        const result = _runPipelineAction(playerKey, action);
        if (!result.ok) return result;

        addLog(`${playerKey === 'black' ? '黒' : '白'}が天の恵みで${def ? def.name : selectedCardId}を獲得`);
        _clearHeavenSelection(playerKey);
        _hideHeavenOverlay();
        renderCardUI();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
        _finalizePendingSelectionAfterRun(playerKey, 'HEAVEN_BLESSING', result);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) _setPendingSelectionBusy(false);
    }
}

function _executeCondemnSelection(playerKey, targetIndex, targetCardId) {
    if (!Number.isInteger(targetIndex)) return { ok: false, reason: 'no_selection' };
    if (!_canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    _setPendingSelectionBusy(true);
    let completed = false;

    try {
        const targetDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(targetCardId)
            : null;

        const action = _createPendingSelectionAction(playerKey, 'CONDEMN_WILL', { condemnTargetIndex: targetIndex });

        if (_startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                _clearHeavenSelection(playerKey);
                _hideHeavenOverlay();
            },
            onFailure: () => {
                if (typeof renderCardUI === 'function') renderCardUI();
                addLog('断罪の意志の選択送信に失敗しました');
                _setPendingSelectionBusy(false);
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }

        const result = _runPipelineAction(playerKey, action);
        if (!result.ok) {
            return result;
        }

        addLog(`${playerKey === 'black' ? '黒' : '白'}が断罪の意志で${_getCardDisplayLabel(targetCardId, targetDef)}を破壊`);
        _clearHeavenSelection(playerKey);
        _hideHeavenOverlay();
        const shouldDelayPostActionHandVisual = _hasHandRemovePlaybackEvent(result);
        _renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual);
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
        _finalizePendingSelectionAfterRun(playerKey, 'CONDEMN_WILL', result);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) _setPendingSelectionBusy(false);
    }
}

let _boardOps = null;
function _getBoardOps() {
    if (_boardOps) return _boardOps;
    if (typeof BoardOps !== 'undefined') return BoardOps;
    if (typeof require === 'function') {
        try { _boardOps = require('../game/logic/board_ops'); } catch (e) { _boardOps = null; }
    }
    return _boardOps;
}

function _emitPresentationEvent(ev) {
    const ops = _getBoardOps();
    if (ops && typeof ops.emitPresentationEvent === 'function') {
        ops.emitPresentationEvent(cardState, ev);
        return true;
    }
    return false;
}

function _getUiRootRef() {
    if (typeof window !== 'undefined' && window) return window;
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
    } catch (e) { /* ignore */ }
    return null;
}

function _isProcessingNow() {
    const rootRef = _getUiRootRef();
    return (
        (typeof isProcessing !== 'undefined' && !!isProcessing) ||
        !!(rootRef && rootRef.isProcessing)
    );
}

function _isCardAnimatingNow() {
    const rootRef = _getUiRootRef();
    const managedAnimating = (_playbackStateModule && typeof _playbackStateModule.getCardAnimating === 'function')
        ? _playbackStateModule.getCardAnimating()
        : false;
    return (
        (typeof isCardAnimating !== 'undefined' && !!isCardAnimating) ||
        managedAnimating === true ||
        !!(rootRef && rootRef.isCardAnimating) ||
        _isVisualPlaybackActiveNow()
    );
}

function _isCardUiBusy() {
    return _isProcessingNow() || _isCardAnimatingNow();
}

function _isVisualPlaybackActiveNow() {
    if (_playbackStateModule && typeof _playbackStateModule.getPlaybackActive === 'function') {
        return _playbackStateModule.getPlaybackActive() === true;
    }
    const rootRef = _getUiRootRef();
    return !!(rootRef && rootRef.VisualPlaybackActive === true);
}

function _getVisualPlaybackStaleMs() {
    const rootRef = _getUiRootRef();
    if (rootRef) {
        const ms = Number(rootRef.PASS_STALE_PLAYBACK_MS);
        if (Number.isFinite(ms) && ms > 0) return ms;
    }
    return 3500;
}

function _isVisualPlaybackRunningNow() {
    if (!_isVisualPlaybackActiveNow()) return false;
    const rootRef = _getUiRootRef();
    if (rootRef && rootRef.AnimationEngine && typeof rootRef.AnimationEngine.isPlaying === 'boolean') {
        return rootRef.AnimationEngine.isPlaying === true;
    }
    return true;
}

function _isStaleVisualPlaybackLock() {
    if (!_isVisualPlaybackActiveNow()) return false;

    const rootRef = _getUiRootRef();

    if (rootRef && rootRef.AnimationEngine && typeof rootRef.AnimationEngine.isPlaying === 'boolean') {
        return rootRef.AnimationEngine.isPlaying !== true;
    }

    if (rootRef) {
        const startedAt = (_playbackStateModule && typeof _playbackStateModule.getPlaybackStartedAt === 'function')
            ? _playbackStateModule.getPlaybackStartedAt()
            : Number(rootRef.__playbackActiveSince);
        if (Number.isFinite(startedAt)) {
            return (Date.now() - startedAt) > _getVisualPlaybackStaleMs();
        }
    }

    return false;
}

function _clearPlaybackLockedDomState() {
    if (typeof document === 'undefined') return;
    const board = document.getElementById('board');
    if (board && board.classList) board.classList.remove('playback-locked');
    if (document.body && document.body.classList) document.body.classList.remove('playback-locked');
}

function _clearCardUiBusyFlags(options) {
    const opts = options || {};
    const clearProcessing = opts.clearProcessing !== false;
    const clearPlayback = opts.clearPlayback === true;
    const rootRef = _getUiRootRef();

    try {
        if (clearProcessing && typeof isProcessing !== 'undefined') isProcessing = false;
        if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
        if (rootRef) {
            if (clearProcessing) rootRef.isProcessing = false;
            rootRef.isCardAnimating = false;
        }
        if (clearPlayback) {
            if (_playbackStateModule && typeof _playbackStateModule.clearPlaybackLock === 'function') {
                _playbackStateModule.clearPlaybackLock();
            } else if (rootRef) {
                rootRef.VisualPlaybackActive = false;
                rootRef.__playbackActiveSince = null;
            }
            _clearPlaybackLockedDomState();
        }
    } catch (e) { /* ignore */ }
}

function _releaseStaleVisualPlaybackLock() {
    if (_isProcessingNow()) return false;
    if (!_isStaleVisualPlaybackLock()) return false;

    _clearCardUiBusyFlags({ clearProcessing: false, clearPlayback: true });

    return true;
}

function _armLocalPlaybackSoundSkip(soundKey) {
    const key = String(soundKey || '').trim();
    if (!key) return false;
    const rootRef = _getUiRootRef();
    if (!rootRef) return false;
    const registry = (rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY] && typeof rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY] === 'object')
        ? rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY]
        : {};
    registry[key] = Date.now() + LOCAL_PLAYBACK_SOUND_SKIP_MS;
    rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY] = registry;
    return true;
}

function _clearLocalPlaybackSoundSkip(soundKey) {
    const key = String(soundKey || '').trim();
    if (!key) return false;
    const rootRef = _getUiRootRef();
    if (!rootRef) return false;
    const registry = rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY];
    if (!registry || typeof registry !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(registry, key)) return false;
    try {
        delete registry[key];
        if (Object.keys(registry).length === 0) {
            delete rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY];
        }
    } catch (e) {
        registry[key] = 0;
    }
    return true;
}

function _canInteractWithCardUi() {
    if (!_isCardUiBusy()) return true;
    return _releaseStaleVisualPlaybackLock();
}

function _resolveCoreApi() {
    if (typeof Core !== 'undefined' && Core && typeof Core.getLegalMoves === 'function') return Core;
    if (typeof CoreLogic !== 'undefined' && CoreLogic && typeof CoreLogic.getLegalMoves === 'function') return CoreLogic;
    return null;
}

function _getLegalMovesForCurrentPlayer() {
    if (!gameState || !cardState) return [];
    const playerValue = gameState.currentPlayer;
    const core = _resolveCoreApi();
    if (!core) return [];

    try {
        const ctx = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardContext === 'function')
            ? CardLogic.getCardContext(cardState)
            : { protectedStones: [], permaProtectedStones: [], bombs: [] };
        return core.getLegalMoves(gameState, playerValue, ctx) || [];
    } catch (e) {
        return [];
    }
}

function _getCurrentMatchMode() {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.getCurrentMatchMode === 'function') {
            return OwnerHelpers.getCurrentMatchMode(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function') {
            return window.getCurrentMatchMode();
        }
        if (typeof window !== 'undefined' && window.MATCH_MODE) {
            return String(window.MATCH_MODE);
        }
    } catch (e) { /* ignore */ }
    return 'cpu';
}

function _isNetworkMode() {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.isNetworkMode === 'function') {
            return OwnerHelpers.isNetworkMode(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    return _getCurrentMatchMode() === 'network';
}

function _getNetworkLocalPlayerKey() {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.resolveLocalPlayerKey === 'function') {
            return OwnerHelpers.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                const seatKey = window.NetworkMatchClient.getSeatKey();
                if (seatKey === 'white' || seatKey === 'black') return seatKey;
            }
            const directKeys = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
            for (const key of directKeys) {
                if (key === 'white' || key === 'black') return key;
            }
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function _resolveInputPlayerKey() {
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    if (_isNetworkMode()) return _getNetworkLocalPlayerKey();
    return isDebugHvH ? (gameState.currentPlayer === BLACK ? 'black' : 'white') : 'black';
}

function _canInputPlayerActNow() {
    const currentPlayerKey = gameState.currentPlayer === BLACK ? 'black' : 'white';
    return _resolveInputPlayerKey() === currentPlayerKey;
}

function _commitSharedStateSnapshot(stateKey, nextState) {
    if (!nextState) return null;

    const sharedRoots = [];
    if (typeof globalThis !== 'undefined' && globalThis) sharedRoots.push(globalThis);
    if (typeof window !== 'undefined' && window && !sharedRoots.includes(window)) sharedRoots.push(window);

    let localState = null;
    try {
        localState = stateKey === 'cardState' ? cardState : gameState;
    } catch (e) {
        localState = null;
    }

    const targetState = (localState && typeof localState === 'object')
        ? localState
        : (() => {
            for (const root of sharedRoots) {
                if (root && root[stateKey] && typeof root[stateKey] === 'object') {
                    return root[stateKey];
                }
            }
            return null;
        })();

    if (targetState && typeof nextState === 'object') {
        if (targetState !== nextState) {
            for (const key in targetState) delete targetState[key];
            Object.assign(targetState, nextState);
        }
        if (stateKey === 'cardState') cardState = targetState;
        else gameState = targetState;
        for (const root of sharedRoots) {
            root[stateKey] = targetState;
        }
        return targetState;
    }

    if (stateKey === 'cardState') cardState = nextState;
    else gameState = nextState;
    for (const root of sharedRoots) {
        root[stateKey] = nextState;
    }
    return nextState;
}

function _runPipelineAction(playerKey, action) {
    if (typeof TurnPipelineUIAdapter === 'undefined' || typeof TurnPipeline === 'undefined') {
        console.error('[CARD_UI] TurnPipeline/Adapter not available for action', action);
        return { ok: false, rejectedReason: 'PIPELINE_UNAVAILABLE' };
    }

    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        try { if (typeof showResult === 'function') showResult(); } catch (e) { /* ignore */ }
        return { ok: false, rejectedReason: 'GAME_ALREADY_OVER' };
    }

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline);
    if (res.ok === false) return res;

    if (res.nextCardState) _commitSharedStateSnapshot('cardState', res.nextCardState);
    if (res.nextGameState) _commitSharedStateSnapshot('gameState', res.nextGameState);

    if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
        try {
            ActionManager.ActionManager.recordAction(action);
            ActionManager.ActionManager.incrementTurnIndex();
        } catch (e) { /* ignore */ }
    }

    if (res.playbackEvents && res.playbackEvents.length) {
        _emitPresentationEvent({ type: 'PLAYBACK_EVENTS', events: res.playbackEvents, meta: { actionType: action.type, cardId: action.useCardId || null } });
    }

    const gameOverNow = (typeof isGameOver === 'function' && gameState && isGameOver(gameState));
    if (gameOverNow) {
        try { if (typeof showResult === 'function') showResult(); } catch (e) { /* ignore */ }
    }

    return { ok: true, result: res, gameOver: gameOverNow };
}

function _getRunResultPlaybackEvents(runResult) {
    const playbackEvents = (runResult && runResult.result && Array.isArray(runResult.result.playbackEvents))
        ? runResult.result.playbackEvents
        : [];
    return playbackEvents;
}

function _hasPlaybackEventType(runResult, eventType) {
    return _getRunResultPlaybackEvents(runResult).some((ev) => ev && ev.type === eventType);
}

function _hasHandRemovePlaybackEvent(runResult) {
    return _hasPlaybackEventType(runResult, 'hand_remove');
}

function _getDeferredGeneratedThrowChainHandAddMeta(runResult) {
    const meta = runResult && runResult.result
        ? runResult.result.deferredGeneratedThrowChainHandAdd
        : null;
    return (meta && typeof meta === 'object') ? meta : null;
}

function _applyDeferredGeneratedThrowChainHandReveal(runResult) {
    const meta = _getDeferredGeneratedThrowChainHandAddMeta(runResult);
    if (!meta || String(meta.reason || '').toLowerCase() !== 'generated_throw_chain') return false;

    const rootRef = _getUiRootRef();
    if (!rootRef) return false;

    const ownerKey = meta.playerKey === 'white' ? 'white' : 'black';
    const nextCardState = (runResult && runResult.result && runResult.result.nextCardState)
        ? runResult.result.nextCardState
        : cardState;
    const hand = (nextCardState && nextCardState.hands && Array.isArray(nextCardState.hands[ownerKey]))
        ? nextCardState.hands[ownerKey]
        : [];
    const hiddenCount = Number.isFinite(Number(meta.count))
        ? Math.max(1, Math.trunc(Number(meta.count)))
        : 1;

    rootRef.__handSequentialRevealState = {
        playerKey: ownerKey,
        visibleCount: Math.max(0, hand.length - hiddenCount),
        reason: 'generated_throw_chain'
    };
    return true;
}

function _snapshotElementRect(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    try {
        const rect = element.getBoundingClientRect();
        const left = Number(rect && rect.left);
        const top = Number(rect && rect.top);
        const width = Number(rect && rect.width);
        const height = Number(rect && rect.height);
        const right = Number(rect && rect.right);
        const bottom = Number(rect && rect.bottom);
        if (![left, top, width, height, right, bottom].every(Number.isFinite)) return null;
        return { left, top, width, height, right, bottom };
    } catch (e) {
        return null;
    }
}

function _attachCardUsePlaybackSourceElement(runResult, sourceCardEl, sourceCardRect) {
    if ((!sourceCardEl || typeof sourceCardEl.cloneNode !== 'function') && !sourceCardRect) return;
    const playbackEvents = _getRunResultPlaybackEvents(runResult);
    for (const ev of playbackEvents) {
        if (!ev || ev.type !== 'card_use_animation') continue;
        if (Array.isArray(ev.targets) && ev.targets.length > 0) {
            for (const target of ev.targets) {
                if (!target || typeof target !== 'object') continue;
                if (!target.sourceCardEl && sourceCardEl && typeof sourceCardEl.cloneNode === 'function') {
                    target.sourceCardEl = sourceCardEl;
                }
                if (!target.sourceCardRect && sourceCardRect) {
                    target.sourceCardRect = sourceCardRect;
                }
            }
            continue;
        }
        if (!ev.sourceCardEl && sourceCardEl && typeof sourceCardEl.cloneNode === 'function') ev.sourceCardEl = sourceCardEl;
        if (!ev.sourceCardRect && sourceCardRect) ev.sourceCardRect = sourceCardRect;
    }
}

function _renderCardUiWithOptionalPlaybackDelay(shouldDelay) {
    if (typeof renderCardUI !== 'function') return;
    if (!shouldDelay) {
        renderCardUI();
        return;
    }

    const waitForPlaybackFn = (typeof waitForPlaybackIdle === 'function')
        ? waitForPlaybackIdle
        : ((typeof window !== 'undefined' && typeof window.waitForPlaybackIdle === 'function') ? window.waitForPlaybackIdle : null);
    if (typeof waitForPlaybackFn === 'function') {
        Promise.resolve(waitForPlaybackFn()).then(() => {
            try { renderCardUI(); } catch (e) { /* ignore */ }
        }).catch(() => {
            try { renderCardUI(); } catch (e) { /* ignore */ }
        });
        return;
    }

    renderCardUI();
}

function _getActiveNetworkMatchClient() {
    const networkRoot = (typeof window !== 'undefined' && window && window.NetworkMatchClient)
        ? window
        : ((typeof globalThis !== 'undefined' && globalThis && globalThis.NetworkMatchClient) ? globalThis : null);
    const networkClient = networkRoot ? networkRoot.NetworkMatchClient : null;
    if (!networkClient) return null;
    if (typeof networkClient.publishSnapshot !== 'function') return null;
    if (typeof networkClient.isActive !== 'function' || networkClient.isActive() !== true) return null;
    return networkClient;
}

function _startNetworkOnlyPendingSelectionPublish(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const networkClient = _getActiveNetworkMatchClient();
    if (!networkClient) return false;

    Promise.resolve()
        .then(() => networkClient.publishSnapshot({
            playerKey: opts.playerKey,
            actionType: 'place',
            playbackEvents: [],
            action: opts.action
        }))
        .then((publishResult) => {
            if (!publishResult || publishResult.ok !== true) {
                if (typeof opts.onFailure === 'function') {
                    opts.onFailure(publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
                }
                return;
            }
            if (typeof opts.onSuccess === 'function') {
                opts.onSuccess(publishResult);
            }
        })
        .catch(() => {
            if (typeof opts.onFailure === 'function') {
                opts.onFailure({ ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
            }
        });

    return true;
}

// Fill hand with all card types for debug testing
function fillDebugHand() {
    if (!_isDebugAllowed()) return;
    if (!window.DEBUG_HUMAN_VS_HUMAN && !window.DEBUG_UNLIMITED_USAGE) return;
    const networkRoot = (typeof window !== 'undefined' && window && window.NetworkMatchClient)
        ? window
        : ((typeof globalThis !== 'undefined' && globalThis && globalThis.NetworkMatchClient) ? globalThis : null);
    const networkClient = networkRoot
        ? networkRoot.NetworkMatchClient
        : null;
    if (
        networkClient
        && typeof networkClient.publishSnapshot === 'function'
        && typeof networkClient.isActive === 'function'
        && networkClient.isActive()
    ) {
        Promise.resolve(networkClient.publishSnapshot({
            actionType: 'debug_fill_hand',
            playbackEvents: [],
            action: { type: 'debug_fill_hand' }
        })).then((result) => {
            if (result && result.ok === false) {
                addLog('🐛 デバッグ: 自席手札の補充に失敗');
                return;
            }
            addLog('🐛 デバッグ: 自席の手札を全種類で補充');
        }).catch(() => {
            addLog('🐛 デバッグ: 自席手札の補充に失敗');
        });
        return;
    }

    const shouldFillWhite = window.DEBUG_HUMAN_VS_HUMAN === true;
    const dbg = _getDebugActions();
    if (!dbg || typeof dbg.fillDebugHand !== 'function') {
        ensureDebugActionsLoaded((loaded) => {
            if (!loaded || typeof loaded.fillDebugHand !== 'function') {
                console.warn('[CARD_UI] DebugActions.fillDebugHand not available');
                return;
            }
            loaded.fillDebugHand(cardState, { fillWhite: shouldFillWhite });
            addLog('🐛 デバッグ: 全種類のカードを手札に追加');
            if (typeof renderCardUI === 'function') renderCardUI();
        });
        return;
    }
    dbg.fillDebugHand(cardState, { fillWhite: shouldFillWhite });
    addLog('🐛 デバッグ: 全種類のカードを手札に追加');
    if (typeof renderCardUI === 'function') renderCardUI();
}

function updateCardDetailPanel() {
    _scheduleCardDetailLandscapeAnchorSync();

    const nameEl = document.getElementById('card-detail-name');
    const descEl = document.getElementById('card-detail-desc');
    const detailTagsEl = _ensureCardDetailEffectTagsElement();
    const detailMoreEl = document.getElementById('card-detail-more');
    const detailBtn = document.getElementById('toggle-card-detail-btn');
    const detailActionsEl = document.getElementById('card-detail-actions');
    const destroyBtn = document.getElementById('destroy-card-btn');
    const useBtn = document.getElementById('use-card-btn');
    const passBtn = document.getElementById('pass-btn');
    const sellBtn = document.getElementById('sell-card-btn');
    const reasonEl = document.getElementById('use-card-reason');
    const cancelBtn = document.getElementById('cancel-card-btn');

    if (!nameEl || !descEl || !useBtn || !reasonEl) return;

    const playerKey = _resolveInputPlayerKey();
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const selectedId = cardState.selectedCardId;
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);
    const hasInspectableSelection = !!selectedId
        && _doesPlayerOwnCard(selectedOwnerKey, selectedId)
        && (selectedOwnerKey === playerKey || isDebugHvH);
    const hasSelection = hasInspectableSelection && selectedOwnerKey === playerKey;
    const normalizedSelectedId = hasInspectableSelection ? selectedId : null;

    if (!normalizedSelectedId || _cardDetailExpandedForCardId !== normalizedSelectedId) {
        _cardDetailExpanded = false;
        _cardDetailExpandedForCardId = normalizedSelectedId || null;
        if (!normalizedSelectedId || (_cardDetailTabState.open && _cardDetailTabState.mode === 'detail')) {
            _closeCardDetailTabPanel();
        }
    }

    if (normalizedSelectedId) {
        const cardDef = CardLogic.getCardDef(normalizedSelectedId);
        const quickText = _getQuickCardEffect(cardDef);
        const detailText = _getDetailCardEffect(cardDef);
        const tags = _collectCardDetailEffectTags(cardDef, quickText, detailText);
        nameEl.textContent = cardDef ? cardDef.name : '?';
        descEl.textContent = _stripCardDetailTagPhrases(quickText) || quickText;
        if (detailMoreEl) detailMoreEl.textContent = detailText;
        _renderCardDetailEffectTags(detailTagsEl, tags);
    } else {
        nameEl.textContent = '-';
        descEl.textContent = 'カードを選択してください';
        if (detailMoreEl) detailMoreEl.textContent = '';
        _renderCardDetailEffectTags(detailTagsEl, []);
    }
    if (detailBtn) {
        const canToggle = !!selectedId;
        const detailTabOpen = !!(
            _cardDetailTabState.open &&
            _cardDetailTabState.mode === 'detail' &&
            _cardDetailTabState.cardId === (normalizedSelectedId || null)
        );
        detailBtn.disabled = !canToggle;
        detailBtn.textContent = detailTabOpen ? '閉じる' : '詳細';
        detailBtn.setAttribute('aria-expanded', detailTabOpen ? 'true' : 'false');
    }
    if (detailMoreEl) {
        detailMoreEl.style.display = 'none';
    }

    // Determine if use button should be enabled
    const isAutoMode = typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true;
    const canActThisTurn = _canInputPlayerActNow();
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true;
    _ensureHandDestroyFlags();
    // カード使用は毎ターン1回（毎ターン開始時にリセット）、ただしデバッグモードでは制限なし
    const hasNotUsedThisTurn = isDebugUnlimited ? true : !cardState.hasUsedCardThisTurnByPlayer[playerKey];
    const canInteract = isDebugUnlimited ? true : _canInteractWithCardUi();

    // Check charge (デバッグモードでは無視)
    const cardDef = hasSelection ? CardLogic.getCardDef(selectedId) : null;
    const cost = cardDef ? (cardDef.cost || 0) : 0;
    const canAfford = isDebugUnlimited ? true : (cardState.charge[playerKey] || 0) >= cost;
    const canUseSelectedCardByRules = hasSelection && _isSelectedCardUsableNow(
        playerKey, selectedId, isDebugUnlimited ? { skipCostAndTurnLimit: true } : undefined);
    const legalMoves = _getLegalMovesForCurrentPlayer();
    const noLegalMoves = legalMoves.length === 0;
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const isSelectingTarget = !!(pending && pending.stage === 'selectTarget');
    const isSellSelecting = !!(pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget');
    const isHeavenSelecting = !!(pending && (pending.type === 'HEAVEN_BLESSING' || pending.type === 'CONDEMN_WILL') && pending.stage === 'selectTarget');
    const selectedSellCardId = _sellSelectionByPlayer[playerKey];
    if (!isSellSelecting && selectedSellCardId) {
        _clearSellSelection(playerKey);
    }
    if (!isHeavenSelecting) {
        _clearHeavenSelection(playerKey);
    }

    let canUse = !isAutoMode && canActThisTurn && hasSelection && hasNotUsedThisTurn && canInteract && canAfford && canUseSelectedCardByRules;
    if (isDebugUnlimited) {
        canUse = hasSelection;
    }
    let canDestroy = !isAutoMode && canActThisTurn && hasSelection && canInteract;
    if (isDebugUnlimited) {
        canDestroy = hasSelection;
    }
    let reason = '';

    if (!hasSelection) {
        reason = selectedId ? '自分の手札からカードを選択してください' : '';
    } else if (!isDebugUnlimited && !canActThisTurn) {
        reason = '自分のターンではありません';
        canUse = false;
    } else if (isAutoMode) {
        reason = 'AUTO進行中...';
        canUse = false;
    } else if (!hasNotUsedThisTurn) {
        reason = 'このターンは既に使用済み';
        canUse = false;
    } else if (!canAfford) {
        reason = '';
        canUse = false;
    } else if (!canUseSelectedCardByRules) {
        reason = '現在このカードは使用できません（対象不足など）';
        canUse = false;
    } else if (!canInteract) {
        reason = '演出中...';
        canUse = false;
    }

    useBtn.disabled = !canUse;

    if (destroyBtn) {
        destroyBtn.disabled = !canDestroy;
        destroyBtn.textContent = '破壊';
    }

    if (hasSelection && !canAfford) {
        useBtn.textContent = '布石不足';
        // Diagnostic: log situations where UI shows charge but button disabled unexpectedly
        try {
            const chargeVal = (cardState && cardState.charge) ? cardState.charge[playerKey] : undefined;
            if (typeof chargeVal === 'number' && typeof cost === 'number' && chargeVal >= cost) {
                console.warn('[CARD_UI] USE DISABLED despite sufficient charge', { selectedId, cardId: selectedId, cost, charge: chargeVal, hasUsedThisTurn: cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey], isProcessing: _isProcessingNow(), isCardAnimating: _isCardAnimatingNow(), currentPlayer: gameState && gameState.currentPlayer });
            }
        } catch (e) { /* ignore */ }
    } else {
        useBtn.textContent = '使用';
    }

    reasonEl.textContent = reason;

    if (isSellSelecting) {
        _closeCardDetailTabPanel();
        if (destroyBtn) destroyBtn.style.display = 'none';
        useBtn.style.display = 'none';
        if (detailBtn) detailBtn.style.display = 'none';
        if (detailActionsEl) detailActionsEl.style.display = 'none';
        if (passBtn) passBtn.style.display = 'none';
        if (sellBtn) {
            sellBtn.style.display = 'inline-block';
            sellBtn.disabled = !selectedSellCardId;
        }
    } else if (isHeavenSelecting) {
        _closeCardDetailTabPanel();
        if (destroyBtn) destroyBtn.style.display = 'none';
        useBtn.style.display = 'none';
        if (detailBtn) detailBtn.style.display = 'none';
        if (detailActionsEl) detailActionsEl.style.display = 'none';
        if (passBtn) passBtn.style.display = 'none';
        if (sellBtn) sellBtn.style.display = 'none';
    } else {
        if (destroyBtn) destroyBtn.style.display = 'inline-block';
        useBtn.style.display = 'inline-block';
        if (detailBtn) detailBtn.style.display = 'inline-block';
        if (detailActionsEl) detailActionsEl.style.display = 'flex';
        if (sellBtn) sellBtn.style.display = 'none';
    }

    // 選択モード用のキャンセルボタン表示制御
    const selecting = pending && pending.stage === 'selectTarget' &&
        (
            pending.type === 'DESTROY_ONE_STONE' ||
            pending.type === 'STRONG_WIND_WILL' ||
            pending.type === 'SUPER_BUOYANCY_WILL' ||
            pending.type === 'SUPER_GRAVITY_WILL' ||
            pending.type === 'TELEPORT_WILL' ||
            pending.type === 'CELL_TELEPORT_WILL' ||
            pending.type === 'POSITION_SWAP_WILL' ||
            pending.type === 'TRAP_WILL' ||
            pending.type === 'GUARD_WILL' ||
            pending.type === 'GUARDIAN_GOD' ||
            pending.type === 'HYPERACTIVE_INHERIT_WILL' ||
            pending.type === 'TIME_BOMB' ||
            pending.type === 'CLONE_WILL' ||
            pending.type === 'SPLIT_WILL' ||
            pending.type === 'EXTEND_LIFE_WILL' ||
            pending.type === 'EXTEND_LIFE_GOD' ||
            pending.type === 'METEOR_WILL' ||
            pending.type === 'SELL_CARD_WILL'
        );
    const cancellableSelecting = selecting &&
        (pending.type === 'DESTROY_ONE_STONE' || pending.type === 'POSITION_SWAP_WILL' || pending.type === 'METEOR_WILL');
    if (cancelBtn) {
        cancelBtn.style.display = cancellableSelecting ? 'block' : 'none';
        cancelBtn.textContent = 'キャンセル';
        // Add specific listener for HvH mode to ensure it uses the correct context
        cancelBtn.onclick = () => cancelPendingSelection(playerKey);
    }
    if (selecting) {
        if (pending.type === 'STRONG_WIND_WILL') {
            reasonEl.textContent = '移動させる石を選んでください';
        } else if (pending.type === 'SUPER_BUOYANCY_WILL') {
            reasonEl.textContent = '上方向へ移動させる石を選んでください';
        } else if (pending.type === 'SUPER_GRAVITY_WILL') {
            reasonEl.textContent = '下方向へ移動させる石を選んでください';
        } else if (pending.type === 'TELEPORT_WILL') {
            reasonEl.textContent = 'テレポートさせる石を選んでください';
        } else if (pending.type === 'CELL_TELEPORT_WILL') {
            reasonEl.textContent = 'マステレポートさせるマスを選んでください';
        } else if (pending.type === 'POSITION_SWAP_WILL') {
            const first = pending.firstTarget;
            reasonEl.textContent = first
                ? `2つ目の石を選んでください（1つ目: ${posToNotation(first.row, first.col)}）`
                : '1つ目の石を選んでください（全ての石が対象）';
        } else if (pending.type === 'TRAP_WILL') {
            reasonEl.textContent = '罠を設置する自分の石を選んでください（選択後にターン終了）';
        } else if (pending.type === 'GUARD_WILL') {
            reasonEl.textContent = '守る石にする自分の石を選んでください';
        } else if (pending.type === 'GUARDIAN_GOD') {
            reasonEl.textContent = '守護神にする自分の石を選んでください';
        } else if (pending.type === 'HYPERACTIVE_INHERIT_WILL') {
            reasonEl.textContent = '多動を継承する自分の石を選んでください';
        } else if (pending.type === 'TIME_BOMB') {
            reasonEl.textContent = '時限爆弾にする自分の石を選んでください';
        } else if (pending.type === 'CLONE_WILL') {
            reasonEl.textContent = '周囲に空きがある自分の石を選んでください';
        } else if (pending.type === 'SPLIT_WILL') {
            reasonEl.textContent = '分裂させる自分の石を選んでください（持続ターンは半減）';
        } else if (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') {
            reasonEl.textContent = pending.type === 'EXTEND_LIFE_GOD'
                ? '4倍延命する自分の特殊石を選んでください'
                : '延命する自分の特殊石を選んでください';
        } else if (pending.type === 'METEOR_WILL') {
            reasonEl.textContent = '隕石で破壊するマスを選んでください';
        } else if (pending.type === 'SELL_CARD_WILL') {
            reasonEl.textContent = selectedSellCardId
                ? '売却対象を選択済みです。売却ボタンで確定してください'
                : '売却するカードを手札から1枚選んでください';
        } else if (pending.type === 'HEAVEN_BLESSING') {
            reasonEl.textContent = '候補5枚から1枚選択してください';
        } else if (pending.type === 'CONDEMN_WILL') {
            reasonEl.textContent = '相手手札から破壊する1枚を選択してください';
        } else {
            reasonEl.textContent = '破壊対象を選んでください（キャンセル可）';
        }
    }

    if (passBtn) {
        if (isSellSelecting) {
            passBtn.style.display = 'none';
            passBtn.disabled = true;
            return;
        }
        const canShowPass = canActThisTurn &&
            noLegalMoves &&
            !isSelectingTarget;
        const canPassWhileBusy = !_isVisualPlaybackRunningNow() || _isStaleVisualPlaybackLock();
        const canPass = !isAutoMode &&
            canShowPass &&
            (canInteract || canPassWhileBusy);
        passBtn.style.display = canShowPass ? 'inline-block' : 'none';
        passBtn.disabled = !canPass;
    }

    _renderHeavenOverlay(playerKey);
}

function toggleCardDetailExpanded() {
    const selectedId = cardState ? cardState.selectedCardId : null;
    const playerKey = _resolveInputPlayerKey();
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);
    if (!selectedId || selectedOwnerKey !== playerKey || !_doesPlayerOwnCard(playerKey, selectedId)) {
        _closeCardDetailTabPanel();
        updateCardDetailPanel();
        return;
    }

    const cardDef = CardLogic && typeof CardLogic.getCardDef === 'function'
        ? CardLogic.getCardDef(selectedId)
        : null;
    const detailText = _getDetailCardEffect(cardDef);
    const body = String(detailText || '').trim() || '詳細説明は準備中です。';
    const title = cardDef && cardDef.name
        ? `${cardDef.name} の詳細効果`
        : '詳細効果';

    _toggleCardDetailTabPanel({
        mode: 'detail',
        key: String(selectedId),
        cardId: String(selectedId),
        title,
        body
    });
    updateCardDetailPanel();
}

function playUiEffectSound(effectKey) {
    try {
        if (typeof SoundEngine === 'undefined' || !SoundEngine) return;
        if (typeof SoundEngine.playEffectByKey !== 'function') return;
        SoundEngine.init();
        SoundEngine.playEffectByKey(effectKey);
    } catch (e) { /* ignore */ }
}

function onCardClick(cardId, ownerKey) {
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true;
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    if (typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true) return;
    const playerKey = _resolveInputPlayerKey();
    const clickedOwnerKey = (ownerKey === 'white' || ownerKey === 'black')
        ? ownerKey
        : null;
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const allowDuringAnimForSell = !!(pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget');
    if (_isCardAnimatingNow() && !isDebugUnlimited && !allowDuringAnimForSell && !_releaseStaleVisualPlaybackLock()) return;

    _closeCardDetailTagTabIfOpen();

    if (clickedOwnerKey && clickedOwnerKey !== playerKey) {
        if (!isDebugHvH || !_doesPlayerOwnCard(clickedOwnerKey, cardId)) return;

        playUiEffectSound('hand_card_select');

        if (cardState.selectedCardId === cardId && _getSelectedCardOwnerKey(playerKey) === clickedOwnerKey) {
            _clearSelectedCardSelection();
        } else {
            _setSelectedCardSelection(cardId, clickedOwnerKey);
        }

        renderCardUI();
        return;
    }
    if (pending && (pending.type === 'HEAVEN_BLESSING' || pending.type === 'CONDEMN_WILL') && pending.stage === 'selectTarget') {
        return;
    }
    if (pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget') {
        if (!_doesPlayerOwnCard(playerKey, cardId)) return;
        if (_sellSelectionByPlayer[playerKey] === cardId) {
            _sellSelectionByPlayer[playerKey] = null;
            if (cardState.selectedCardId === cardId && _getSelectedCardOwnerKey(playerKey) === playerKey) {
                _clearSelectedCardSelection();
            }
        } else {
            _sellSelectionByPlayer[playerKey] = cardId;
            _setSelectedCardSelection(cardId, playerKey);
        }
        renderCardUI();
        return;
    }

    if (!_doesPlayerOwnCard(playerKey, cardId)) return;

    playUiEffectSound('hand_card_select');

    if (cardState.selectedCardId === cardId && _getSelectedCardOwnerKey(playerKey) === playerKey) {
        _clearSelectedCardSelection();
    } else {
        _setSelectedCardSelection(cardId, playerKey);
    }

    renderCardUI();
}

function confirmSellCardSelection() {
    if (typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true) return false;
    const playerKey = _resolveInputPlayerKey();
    const pending = cardState.pendingEffectByPlayer[playerKey];
    if (!pending || pending.type !== 'SELL_CARD_WILL' || pending.stage !== 'selectTarget') return false;

    const sellCardId = _sellSelectionByPlayer[playerKey];
    if (!sellCardId) {
        addLog('売却するカードを先に選んでください');
        renderCardUI();
        return false;
    }

    const result = _executeSellSelection(playerKey, sellCardId);
    if (!result.ok) {
        addLog('売却に失敗しました');
        return false;
    }
    return true;
}

function destroySelectedHandCard() {
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true;
    if (typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true) return;
    if (!isDebugUnlimited && !_canInteractWithCardUi()) return;
    if (!isDebugUnlimited && !_canInputPlayerActNow()) return;
    if (cardState.selectedCardId === null) return;

    const playerKey = _resolveInputPlayerKey();
    const cardId = cardState.selectedCardId;
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);

    if (selectedOwnerKey !== playerKey || !_doesPlayerOwnCard(playerKey, cardId)) {
        _clearSelectedCardSelection();
        addLog('自分の手札からカードを選択してください');
        renderCardUI();
        return;
    }

    _ensureHandDestroyFlags();

    const cardDef = CardLogic.getCardDef(cardId);
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('destroy_hand_card', playerKey, { destroyCardId: cardId })
        : { type: 'destroy_hand_card', destroyCardId: cardId };

    const result = _runPipelineAction(playerKey, action);
    if (!result.ok) {
        const reason = result.rejectedReason || (result.result && result.result.rejectedReason) || null;
        addLog(`カード破壊に失敗しました${reason ? ` (${reason})` : ''}`);
        return;
    }

    const playerName = playerKey === 'black' ? '黒' : '白';
    addLog(`${playerName}が手札を破壊: ${cardDef ? cardDef.name : cardId}`);

    _clearSelectedCardSelection();

    const shouldDelayPostActionHandVisual = _hasHandRemovePlaybackEvent(result);
    _renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual);
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    else if (typeof renderBoard === 'function') renderBoard();
    if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
        try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
    }
}

function useSelectedCard() {
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true;
    if (typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true) return;
    if (!isDebugUnlimited && !_canInteractWithCardUi()) return;
    if (!isDebugUnlimited && !_canInputPlayerActNow()) return;
    if (cardState.selectedCardId === null) return;

    // Determine playerKey
    const playerKey = _resolveInputPlayerKey();
    const cardId = cardState.selectedCardId;
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);

    if (selectedOwnerKey !== playerKey || !_doesPlayerOwnCard(playerKey, cardId)) {
        _clearSelectedCardSelection();
        addLog('自分の手札からカードを選択してください');
        renderCardUI();
        return;
    }

    if (!isDebugUnlimited && cardState.hasUsedCardThisTurnByPlayer[playerKey]) return;

    const cardDef = CardLogic.getCardDef(cardId);

    // Charge Check (in debug mode, skip)
    const cost = cardDef ? cardDef.cost : 0;
    if (!isDebugUnlimited && (cardState.charge[playerKey] || 0) < cost) {
        addLog(`布石不足: ${cardDef ? cardDef.name : cardId} (必要: ${cost}, 所持: ${cardState.charge[playerKey] || 0})`);
        return;
    }
    if (!_isSelectedCardUsableNow(playerKey, cardId, isDebugUnlimited ? { skipCostAndTurnLimit: true } : undefined)) {
        addLog('このカードは現在使用できません（対象不足など）');
        renderCardUI();
        return;
    }
    // Determine ownerKey (actual hand holding the card)
    const ownerKey = playerKey;
    const usedCardEl = _findCardElementInOwnerHand(cardId, ownerKey);
    const usedCardRect = _snapshotElementRect(usedCardEl);
    const debugOptions = isDebugUnlimited ? { ignoreCost: true, noConsume: true } : null;
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('use_card', playerKey, { useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions })
        : { type: 'use_card', useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions };

    const result = _runPipelineAction(playerKey, action);
    if (!result.ok) {
        const reason = result.rejectedReason || (result.result && result.result.rejectedReason) || null;
        addLog(`カード使用に失敗しました${reason ? ` (${reason})` : ''}`);
        return;
    }

    if (isDebugUnlimited) {
        addLog(`🐛 デバッグ: コスト無視 & 回数制限無視`);
    }

    // Store card def for display
    if (cardDef) {
        cardState.lastUsedCardByPlayer[playerKey] = { id: cardDef.id, name: cardDef.name, desc: cardDef.desc };
    }

    // Log
    const playerName = playerKey === 'black' ? '黒' : '白';
    if (!_isNetworkMode()) {
        addLog(`${playerName}がカードを使用: ${cardDef ? cardDef.name : cardId} (布石 -${isDebugUnlimited ? 0 : cost})`);
    }

    // Clear selection
    _clearSelectedCardSelection();

    _applyDeferredGeneratedThrowChainHandReveal(result);

    _attachCardUsePlaybackSourceElement(result, usedCardEl, usedCardRect);
    const hasCardUsePlayback = _hasPlaybackEventType(result, 'card_use_animation');
    const skippedLocalExecution = !!(
        result && (
            result.skippedLocalExecution === true
            || (result.result && result.result.skippedLocalExecution === true)
        )
    );

    // Direct animation fallback for browser reliability.
    if (!hasCardUsePlayback && !skippedLocalExecution) {
        try {
            if (typeof playCardUseHandAnimation === 'function') {
                playCardUseHandAnimation({
                    player: playerKey,
                    owner: ownerKey,
                    cardId,
                    cost: Number.isFinite(cost) ? cost : null,
                    name: cardDef ? cardDef.name : null,
                    sourceCardEl: usedCardEl || null,
                    sourceCardRect: usedCardRect || null
                }).catch(() => {});
            }
        } catch (e) { /* ignore */ }
    }

    const shouldDelayPostUseHandVisual = !!(cardDef && (cardDef.type === 'TREASURE_BOX' || cardDef.type === 'REBUILD_WILL' || cardDef.type === 'SUPPLY_WILL'))
        || _hasHandRemovePlaybackEvent(result);
    _renderCardUiWithOptionalPlaybackDelay(shouldDelayPostUseHandVisual);
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    else if (typeof renderBoard === 'function') renderBoard();
    if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
        try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
    }
}

function passCurrentTurn() {
    const isAutoMode = typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true;
    if (isAutoMode) return;
    if (!_canInputPlayerActNow()) return;

    const playerKey = _resolveInputPlayerKey();
    const pending = (cardState && cardState.pendingEffectByPlayer)
        ? cardState.pendingEffectByPlayer[playerKey]
        : null;
    const legalMoves = _getLegalMovesForCurrentPlayer();
    if (legalMoves.length > 0) return;
    if (pending && pending.stage === 'selectTarget') return;

    if (_isCardUiBusy()) {
        const staleVisualLock = _isStaleVisualPlaybackLock();
        if (_isVisualPlaybackRunningNow() && !staleVisualLock) return;
        _clearCardUiBusyFlags({ clearProcessing: true, clearPlayback: staleVisualLock });
    }

    if (typeof processPassTurn === 'function') {
        processPassTurn(playerKey, false);
    }
}

function cancelPendingSelection(specificPlayerKey) {
    const playerKey = specificPlayerKey || _resolveInputPlayerKey();

    const pending = cardState.pendingEffectByPlayer[playerKey];
    if (!pending || pending.stage !== 'selectTarget') return;
    if (pending.type !== 'DESTROY_ONE_STONE' && pending.type !== 'POSITION_SWAP_WILL') return;

    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true;
    const cancelOptions = isDebugUnlimited ? { refundCost: false, resetUsage: false, noConsume: true } : null;
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('cancel_card', playerKey, { cancelOptions })
        : { type: 'cancel_card', cancelOptions };

    const result = _runPipelineAction(playerKey, action);
    if (!result.ok) {
        addLog(`キャンセルに失敗しました`);
        return;
    }

    if (pending.type === 'POSITION_SWAP_WILL') {
        addLog(`${playerKey === 'black' ? '黒' : '白'}の入替の意志をキャンセルしました`);
    } else {
        addLog(`${playerKey === 'black' ? '黒' : '白'}の破壊神をキャンセルしました`);
    }
    renderCardUI();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    else if (typeof renderBoard === 'function') renderBoard();
}

function cancelPendingDestroy(specificPlayerKey) {
    cancelPendingSelection(specificPlayerKey);
}

// Export functions to global window scope for event binding (onclick in HTML etc)
window.fillDebugHand = fillDebugHand;
window.updateCardDetailPanel = updateCardDetailPanel;
window.onCardClick = onCardClick;
window.destroySelectedHandCard = destroySelectedHandCard;
window.useSelectedCard = useSelectedCard;
window.toggleCardDetailExpanded = toggleCardDetailExpanded;
window.confirmSellCardSelection = confirmSellCardSelection;
window.passCurrentTurn = passCurrentTurn;
window.cancelPendingDestroy = cancelPendingDestroy;
window.cancelPendingSelection = cancelPendingSelection;

_initCardDetailLandscapeAnchorSync();
_bindCardDetailTagAutoDismiss();
