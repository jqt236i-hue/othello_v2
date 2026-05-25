declare const CardLogic: any;
declare const __non_webpack_require__: NodeRequire | undefined;
declare const ActionManager: any;
declare const BoardOps: any;
declare const CHARGE_MAX: any;
declare const Core: any;
declare const CoreLogic: any;
declare const HAND_LIMIT: any;
declare const HandAnimationUtilsModule: any;
declare const OwnerHelpers: any;
declare const PendingSelectionFlow: any;
declare const PlaybackStateManager: any;
declare const TurnPipeline: any;
declare const ensureCurrentPlayerCanActOrPass: any;
declare const getCardCostTier: any;
declare const handleCellClick: any;
declare const isCardAnimating: any;
declare const isProcessing: any;
declare const playCardUseHandAnimation: any;
declare const processPassTurn: any;
declare const waitForPlaybackIdle: any;

type CardInteractionRuntimeRoot = typeof globalThis & Record<string, any>;
type CardInteractionPlayerKey = 'black' | 'white';
type CardInteractionNullableRecord = Record<string, any> | null;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

// ===== Card UI State & Interaction (Refactored to use CardLogic) =====

function _resolveCardInteractionModule(options: {
    readDirect?: () => any;
    requirePath?: string;
    globalKey?: string;
}): any {
    const opts = options || {};
    if (typeof opts.readDirect === 'function') {
        try {
            const direct = opts.readDirect();
            if (direct) return direct;
        } catch (e) { /* ignore */ }
    }
    if (opts.requirePath) {
        try {
            const required = _require(opts.requirePath);
            if (required) return required;
        } catch (e) { /* ignore */ }
    }
    if (opts.globalKey) {
        try {
            if (typeof globalThis !== 'undefined') {
                return (globalThis as CardInteractionRuntimeRoot)[opts.globalKey] || null;
            }
        } catch (e) { /* ignore */ }
    }
    return null;
}

if (typeof CardLogic === 'undefined') {
    console.error('CardLogic is not loaded. Please include game/logic/cards.js');
}

// Note: Debug mode flags are stored on window object:
// - window.DEBUG_HUMAN_VS_HUMAN: HvH mode enabled
// - window.DEBUG_UNLIMITED_USAGE: Unlimited card usage mode

function _getDebugActions() {
    const resolved = _resolveDebugActionsRuntimeModule();
    if (resolved) return resolved;
    try {
        const required = _require('../game/debug/debug-actions');
        return _rememberResolvedDebugActions(required);
    } catch (e) { /* ignore */ }
    return null;
}

function _rememberResolvedDebugActions(candidate: any) {
    if (!candidate || typeof candidate !== 'object') return null;
    const hasFill = typeof candidate.fillDebugHand === 'function';
    const hasVisual = typeof candidate.applyVisualTestBoard === 'function';
    if (!hasFill && !hasVisual) return null;
    try {
        if (typeof window !== 'undefined') {
            window.DebugActions = candidate;
        }
    } catch (e) { /* ignore */ }
    return candidate;
}

function _resolveDebugActionsRuntimeModule() {
    try {
        if (typeof DebugActions !== 'undefined') {
            const direct = _rememberResolvedDebugActions(DebugActions);
            if (direct) return direct;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.DebugActions) {
            const globalResolved = _rememberResolvedDebugActions(window.DebugActions);
            if (globalResolved) return globalResolved;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.module && window.module.exports) {
            const moduleResolved = _rememberResolvedDebugActions(window.module.exports);
            if (moduleResolved) return moduleResolved;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.exports) {
            const exportsResolved = _rememberResolvedDebugActions(window.exports);
            if (exportsResolved) return exportsResolved;
        }
    } catch (e) { /* ignore */ }
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

function _isDebugHvHMode() {
    return window.DEBUG_HUMAN_VS_HUMAN === true;
}

function _isDebugUnlimitedUsage() {
    return window.DEBUG_UNLIMITED_USAGE === true;
}

function _isAutoModeActive() {
    return typeof window !== 'undefined' && window.AUTO_MODE_ACTIVE === true;
}

function ensureDebugActionsLoaded(cb: any) {
    try {
        if (typeof window === 'undefined') return cb && cb(null);
        if (!_isDebugAllowed()) return cb && cb(null);
        const existing = _resolveDebugActionsRuntimeModule();
        if (existing) return cb && cb(existing);
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
            const resolved = _resolveDebugActionsRuntimeModule();
            for (const fn of waiters) { try { fn(resolved); } catch (e) { /* Intentionally empty: one bad callback must not break others */ } }
        };
        s.onerror = () => {
            window.__debugActionsLoading = false;
            const waiters = window.__debugActionsWaiters || [];
            window.__debugActionsWaiters = [];
            for (const fn of waiters) { try { fn(null); } catch (e) { /* Intentionally empty: one bad callback must not break others */ } }
        };
        document.head.appendChild(s);
    } catch (e) { if (cb) cb(null); }
}
if (typeof window !== 'undefined') {
    window.ensureDebugActionsLoaded = ensureDebugActionsLoaded;
}

const _playbackStateModule = _resolveCardInteractionModule({
    readDirect: () => (typeof PlaybackStateManager !== 'undefined' ? PlaybackStateManager : null),
    requirePath: '../ui/playback-state-manager',
    globalKey: 'PlaybackStateManager'
});

const _ownerHelpersModule = _resolveCardInteractionModule({
    readDirect: () => (typeof OwnerHelpers !== 'undefined' ? OwnerHelpers : null),
    requirePath: '../utils/owner-helpers',
    globalKey: 'OwnerHelpers'
});

const _handAnimationUtilsModule = _resolveCardInteractionModule({
    readDirect: () => (typeof HandAnimationUtilsModule !== 'undefined' ? HandAnimationUtilsModule : null),
    requirePath: '../ui/animation-utils',
    globalKey: 'HandAnimationUtilsModule'
});

const _heavenSelectionByPlayer: Record<string, any> = { black: null, white: null };
let _heavenOverlayRefs: CardInteractionNullableRecord = null;
let _cardDetailExpanded = false;
let _cardDetailExpandedForCardId: any = null;
let _cardDetailTabRefs: CardInteractionNullableRecord = null;
let _cardDetailTabState = {
    open: false,
    mode: null as any,
    key: null as any,
    cardId: null as any
};
let _cardDetailLandscapeAnchorSyncInitialized = false;
let _cardDetailLandscapeAnchorResizeObserver = null;
let _cardDetailLandscapeAnchorRafId: any = null;
let _cardDetailTagAutoDismissBound = false;
const _hiddenHandTokenPattern = /^__hidden_hand__:(black|white):(\d+)$/;
const LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY = '__skipNextPlaybackSoundUntilByKey';
const LOCAL_PLAYBACK_SOUND_SKIP_MS = 5000;

const CARD_DETAIL_TAG_MEANINGS = Object.freeze({
    '多動状態': '両者ターン開始時マス移動する、基本ランダム移動。',
    '反転回避': '相手に石を置かれて反転されるとき、マス移動でその石だけ回避する。',
    '破壊回避': '破壊対象になったとき、空きマスへ移動してその石だけ回避する。',
    '特殊石': '通常石画像を使わない石。normal_stone-black.png / normal_stone-white.png 以外の見た目の石を指す。交換の意志の対象外。',
    '幽体': '反転・石破壊の対象にはなるが、その石自身は受けない。反転列の成立は無効化せず、交換以外の効果は通常どおり受ける。',
    '反転保護': '反転されない。挟める列ごと無効できる。',
    '完全保護': 'マス破壊以外の全ての効果を無効化。',
    'マス破壊': 'マスごと穴にして永続封鎖。誰も置けず、反転経路も遮断する。',
    '破壊／爆発': '石を消滅させる。完全保護以外の保護を貫通できる。',
    '連鎖反転': '通常反転の後さらに挟める列ができた場合追加で一方向だけ反転させる。',
    '禁忌反転': '挟めなくても反転可能。最も反転枚数が多い列1方向のみ。'
});

const RIBO_WILL_UNLOCK_TURN_INDEX = 19;

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

function _normalizeOwnerKey(ownerKey: any) {
    try {
        if (_ownerHelpersModule && typeof _ownerHelpersModule.normalizePlayerKey === 'function') {
            return _ownerHelpersModule.normalizePlayerKey(ownerKey, 'black');
        }
    } catch (e) { /* ignore */ }
    return ownerKey === 'white' ? 'white' : 'black';
}

function _isHiddenHandToken(cardId: any) {
    return _hiddenHandTokenPattern.test(String(cardId || ''));
}

function _getCardDisplayLabel(cardId: any, cardDef: any) {
    if (cardDef && cardDef.name) return cardDef.name;
    if (_isHiddenHandToken(cardId)) return '不明カード';
    return cardId || '-';
}

function _getCardDisplayTypeLabel(cardDef: any) {
    return String(cardDef && (cardDef.display_type_ja || cardDef.displayTypeJa) || '').trim();
}

function _getCardDisplayTypeKey(cardDef: any) {
    const typeLabel = _getCardDisplayTypeLabel(cardDef);
    const typeKeyMap: Record<string, string> = {
        '採掘': 'mining',
        '守護': 'guard',
        '戦闘': 'battle',
        '執行': 'judgment',
        '禁忌': 'taboo',
        '殲滅': 'annihilation',
        '繁栄': 'prosperity',
        '特殊': 'special'
    };
    return typeKeyMap[typeLabel] || '';
}

function _fitCardNameForDisplay(nameEl: any) {
    if (!nameEl) return;
    try {
        if (typeof window !== 'undefined' && typeof window.fitCardNameElement === 'function') {
            window.fitCardNameElement(nameEl);
        }
    } catch (e) { /* ignore */ }
}

function _appendCardDisplayBadges(cardEl: any, cardDef: any, cost: any, tier: any) {
    if (!cardEl) return;
    const badgeRow = document.createElement('div');
    badgeRow.className = 'card-badge-row';

    const typeLabel = _getCardDisplayTypeLabel(cardDef);
    const typeKey = _getCardDisplayTypeKey(cardDef);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }
    if (typeLabel) {
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-type-badge';
        const _iconMap: Record<string, string> = { '採掘':'\u26CF\uFE0E', '守護':'\u26E8\uFE0E', '戦闘':'\u2694\uFE0E', '執行':'\u2696\uFE0E', '禁忌':'\u26A0\uFE0E', '殲滅':'\u2620\uFE0E', '繁栄':'\u2728', '特殊':'\u2726' };
        const _icon = _iconMap[typeLabel] || '';
        typeBadge.textContent = _icon ? (_icon + ' ' + typeLabel) : typeLabel;
        badgeRow.appendChild(typeBadge);
    }

    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    if (tier) {
        costBadge.classList.add(`cost-tier-${tier}`);
    }
    const costValue = document.createElement('span');
    costValue.className = 'cost-value';
    costValue.textContent = cardDef ? String(cost) : '?';
    const costLabel = document.createElement('span');
    costLabel.className = 'cost-label';
    costLabel.textContent = 'cost';
    costBadge.appendChild(costValue);
    costBadge.appendChild(costLabel);
    badgeRow.appendChild(costBadge);

    cardEl.appendChild(badgeRow);
}

function _setSelectedCardSelection(cardId: any, ownerKey: any) {
    const stateRef = _getCardStateRef();
    if (!stateRef || typeof stateRef !== 'object') return;
    if (!cardId) {
        stateRef.selectedCardId = null;
        stateRef.selectedCardOwnerKey = null;
        return;
    }
    stateRef.selectedCardId = cardId;
    stateRef.selectedCardOwnerKey = _normalizeOwnerKey(ownerKey);
}

function _clearSelectedCardSelection() {
    const stateRef = _getCardStateRef();
    if (!stateRef || typeof stateRef !== 'object') return;
    stateRef.selectedCardId = null;
    stateRef.selectedCardOwnerKey = null;
}

function _getSelectedCardOwnerKey(defaultOwnerKey: any) {
    const stateRef = _getCardStateRef();
    if (stateRef && (stateRef.selectedCardOwnerKey === 'white' || stateRef.selectedCardOwnerKey === 'black')) {
        return stateRef.selectedCardOwnerKey;
    }
    return _normalizeOwnerKey(defaultOwnerKey);
}

const _cardInteractionEffectsModule = _resolveCardInteractionModule({
    readDirect: () => (typeof CardInteractionEffects !== 'undefined' ? CardInteractionEffects : null),
    requirePath: './card-interaction-effects'
});

const _pendingSelectionFlowModule = _resolveCardInteractionModule({
    readDirect: () => (typeof PendingSelectionFlow !== 'undefined' ? PendingSelectionFlow : null),
    requirePath: '../game/card-effects/selection-flow',
    globalKey: 'PendingSelectionFlow'
});

function _getPendingStateManagerForCardUi() {
    return _resolveCardInteractionModule({
        requirePath: '../game/logic/cards-internal/pending-state-manager',
        globalKey: 'CardPendingStateManager'
    });
}

function _isCancellablePendingSelectionForCardUi(pendingType: any) {
    const pendingStateManager = _getPendingStateManagerForCardUi();
    if (pendingStateManager && typeof pendingStateManager.isCancellablePendingType === 'function') {
        return pendingStateManager.isCancellablePendingType(pendingType);
    }
    return (
        pendingType === 'DESTROY_ONE_STONE' ||
        pendingType === 'POSITION_SWAP_WILL' ||
        pendingType === 'BOARD_EXPANSION_WILL' ||
        pendingType === 'BOARD_EXPANSION_GOD' ||
        pendingType === 'BOARD_SHRINK_WILL' ||
        pendingType === 'BOARD_SHRINK_GOD' ||
        pendingType === 'BLOCKADE_WILL' ||
        pendingType === 'METEOR_WILL' ||
        pendingType === 'FREEZE_WILL'
    );
}

function _isHandOverlayPendingTypeForCardUi(pendingType: any) {
    const normalizedType = String(pendingType || '').trim().toUpperCase();
    if (!normalizedType) return false;
    const pendingStateManager = _getPendingStateManagerForCardUi();
    if (pendingStateManager && typeof pendingStateManager.resolvePendingSelectionContract === 'function') {
        const contract = pendingStateManager.resolvePendingSelectionContract(normalizedType);
        if (contract && typeof contract.kind === 'string') {
            return contract.kind === 'hand_overlay';
        }
    }
    return (
        normalizedType === 'HEAVEN_BLESSING'
        || normalizedType === 'CONDEMN_WILL'
    );
}

function _normalizeCardDescText(text: any) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/。+/g, '。')
        .trim();
}

function _fallbackQuickCardEffect(cardDef: any) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '効果説明は準備中';
    const firstSentence = normalized.split('。').map(s => s.trim()).filter(Boolean)[0] || normalized;
    return firstSentence.length > 32 ? `${firstSentence.slice(0, 32)}...` : firstSentence;
}

function _fallbackDetailCardEffect(cardDef: any) {
    const normalized = _normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
    if (!normalized) return '詳細説明は準備中';
    return normalized.replace(/。/g, '。\n').trim();
}

function _getQuickCardEffect(cardDef: any) {
    if (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getQuickCardEffect === 'function') {
        return _cardInteractionEffectsModule.getQuickCardEffect(cardDef);
    }
    if (!cardDef) return 'カードを選択してください';
    return _fallbackQuickCardEffect(cardDef);
}

function _getDetailCardEffect(cardDef: any) {
    if (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getDetailCardEffect === 'function') {
        return _cardInteractionEffectsModule.getDetailCardEffect(cardDef, _resolveChargeMaxText);
    }
    if (!cardDef) return '';
    return _fallbackDetailCardEffect(cardDef);
}

function _resolveCardDescriptionTextsForCardUi(cardDef: any) {
    if (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.resolveCardDescriptionTexts === 'function') {
        return _cardInteractionEffectsModule.resolveCardDescriptionTexts(cardDef, {
            resolveChargeMaxText: _resolveChargeMaxText,
            quickTextMaxLength: 32
        });
    }

    const quickText = _cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getQuickCardEffect === 'function'
        ? _cardInteractionEffectsModule.getQuickCardEffect(cardDef, { maxLength: 32 })
        : _getQuickCardEffect(cardDef);
    const detailText = _cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.getDetailCardEffect === 'function'
        ? _cardInteractionEffectsModule.getDetailCardEffect(cardDef, _resolveChargeMaxText)
        : _getDetailCardEffect(cardDef);
    const distinctDetailText = _cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.resolveNonDuplicateDetailText === 'function'
        ? _cardInteractionEffectsModule.resolveNonDuplicateDetailText(quickText, detailText)
        : detailText;
    const effectTags = _cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.resolveCardEffectTags === 'function'
        ? _cardInteractionEffectsModule.resolveCardEffectTags(cardDef)
        : (_cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.resolveCardNumericTags === 'function'
            ? _cardInteractionEffectsModule.resolveCardNumericTags(cardDef)
            : [])
    ;
    const numericTags = _cardInteractionEffectsModule && typeof _cardInteractionEffectsModule.resolveCardNumericTags === 'function'
        ? _cardInteractionEffectsModule.resolveCardNumericTags(cardDef)
        : [];
    return {
        quickText,
        detailText,
        distinctDetailText,
        effectTags,
        numericTags
    };
}

function _buildCardDetailDisplayModel(cardDef: any, ownerKey: any) {
    if (!cardDef) {
        return {
            cardName: '-',
            summaryText: 'カードを選択してください',
            detailText: '',
            detailPanelText: '',
            liveStateText: '',
            tags: []
        };
    }

    const descriptionTexts = _resolveCardDescriptionTextsForCardUi(cardDef);
    const quickText = String(descriptionTexts && descriptionTexts.quickText ? descriptionTexts.quickText : '');
    const detailText = String(descriptionTexts && descriptionTexts.detailText ? descriptionTexts.detailText : '');
    const distinctDetailText = String(descriptionTexts && descriptionTexts.distinctDetailText ? descriptionTexts.distinctDetailText : '');

    return {
        cardName: cardDef.name || '?',
        summaryText: _stripCardDetailTagPhrases(quickText) || quickText,
        detailText,
        detailPanelText: distinctDetailText || detailText,
        liveStateText: _getCardDetailLiveStateText(cardDef, ownerKey),
        tags: Array.isArray(descriptionTexts && descriptionTexts.effectTags)
            ? descriptionTexts.effectTags
            : (Array.isArray(descriptionTexts && descriptionTexts.numericTags)
                ? descriptionTexts.numericTags
                : [])
    };
}

function _applyCardDetailDisplayModel(nameEl: any, descEl: any, detailStateEl: any, detailMoreEl: any, detailTagsEl: any, displayModel: any) {
    if (!nameEl || !descEl) return;
    const model = displayModel || _buildCardDetailDisplayModel(null, null);
    nameEl.textContent = model.cardName;
    descEl.textContent = model.summaryText;
    _renderCardDetailLiveState(detailStateEl, model.liveStateText);
    if (detailMoreEl) detailMoreEl.textContent = model.detailPanelText;
    _renderCardDetailEffectTags(detailTagsEl, model.tags);
}

function _getOverlayCardDescriptionText(cardDef: any, cardId: any) {
    if (cardDef && cardDef.desc) return cardDef.desc;
    if (_isHiddenHandToken(cardId)) return 'この対戦モードでは詳細は非公開です';
    if (!cardDef) return '説明なし';

    const descriptionTexts = _resolveCardDescriptionTextsForCardUi(cardDef);
    return String(
        (descriptionTexts && (descriptionTexts.detailText || descriptionTexts.quickText))
        || '説明なし'
    );
}

const _NORMAL_STONE_IMAGE_FILE_KEYS = Object.freeze([
    'normal_stone-black.png',
    'normal_stone-white.png',
    'normal-stone-black.png',
    'normal-stone-white.png'
]);

function _getGameVisualEffectsMapForCardDetail() {
    try {
        const root: CardInteractionRuntimeRoot | null = (typeof globalThis !== 'undefined')
            ? (globalThis as CardInteractionRuntimeRoot)
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

    try {
        const mod = _require('../game/visual-effects-map');
        if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
    } catch (e) { /* ignore */ }
    return null;
}

function _collectCardVisualImagePaths(cardType: any) {
    if (!cardType) return [];
    const map = _getGameVisualEffectsMapForCardDetail();
    if (!map || typeof map.getCardVisualImagePaths !== 'function') return [];
    return map.getCardVisualImagePaths(cardType);
}

function _usesNonNormalStoneImage(cardDef: any) {
    const cardType = cardDef && cardDef.type ? String(cardDef.type) : '';
    if (!cardType) return false;
    const map = _getGameVisualEffectsMapForCardDetail();
    if (map && typeof map.cardTypeUsesNonNormalStoneImage === 'function') {
        return map.cardTypeUsesNonNormalStoneImage(cardType);
    }
    const paths = _collectCardVisualImagePaths(cardType);
    if (!paths.length || !map || typeof map.isNormalStoneImagePath !== 'function') return false;
    return paths.some((path: any) => !map.isNormalStoneImagePath(path));
}

function _hasFlipEvasionTagSignal(sourceText: any) {
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

function _hasDestroyEvasionTagSignal(sourceText: any) {
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

function _hasPositiveProtectionTagSignal(sourceText: any, term: any) {
    const normalized = String(sourceText || '').replace(/\s+/g, '');
    if (!normalized || !term || !normalized.includes(term)) return false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negativePatterns = [
        new RegExp(`${escaped}(?:は|を)?持たない`),
        new RegExp(`${escaped}(?:は|を)?持たず`),
        new RegExp(`${escaped}なし`)
    ];
    return !negativePatterns.some((pattern) => pattern.test(normalized));
}

const CARD_DETAIL_EFFECT_TAG_TERMS = Object.freeze([
    '幽体',
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

function _collectCardDetailEffectTags(cardDef: any, quickText: any, detailText: any) {
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
        if (term === '反転保護') {
            if (_hasPositiveProtectionTagSignal(sourceText, term)) tags.push(term);
            continue;
        }
        if (sourceText.includes(term)) tags.push(term);
    }
    return tags;
}

function _stripCardDetailTagPhrases(text: any) {
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

function _ensureCardDetailLiveStateElement() {
    if (typeof document === 'undefined') return null;
    let stateEl = document.getElementById('card-detail-live-state');
    if (stateEl) return stateEl;
    const panelEl = document.getElementById('card-detail-panel');
    if (!panelEl) return null;
    stateEl = document.createElement('div');
    stateEl.id = 'card-detail-live-state';
    stateEl.setAttribute('aria-live', 'polite');
    const tagsEl = _ensureCardDetailEffectTagsElement();
    if (tagsEl && tagsEl.parentElement === panelEl) {
        panelEl.insertBefore(stateEl, tagsEl);
    } else {
        const detailMoreEl = document.getElementById('card-detail-more');
        if (detailMoreEl && detailMoreEl.parentElement === panelEl) {
            panelEl.insertBefore(stateEl, detailMoreEl);
        } else {
            panelEl.appendChild(stateEl);
        }
    }
    return stateEl;
}

function _getSalvationWillLiveStateText(ownerKey: any) {
    if (!ownerKey || !CardLogic || typeof CardLogic.getSalvationWillTargetCount !== 'function') return '';
    const count = Math.max(0, Number(CardLogic.getSalvationWillTargetCount(cardState, ownerKey)) || 0);
    return count <= 0 ? '救済不可能' : `${count}個救済可能`;
}

function _getEqualityWillLiveStateText() {
    if (!CardLogic || typeof CardLogic.getEqualityWillBoardCounts !== 'function') return '';
    const counts = CardLogic.getEqualityWillBoardCounts(gameState);
    const black = Math.max(0, Number(counts && counts.black) || 0);
    const white = Math.max(0, Number(counts && counts.white) || 0);
    return `（黒${black}／白${white}）`;
}

function _getReinforcementWillLiveStateText(ownerKey: any) {
    if (!ownerKey || !CardLogic || typeof CardLogic.getReinforcementWillTargetCount !== 'function') return '';
    const count = Math.max(0, Number(CardLogic.getReinforcementWillTargetCount(cardState, gameState, ownerKey)) || 0);
    return count <= 0 ? '増援不可能' : `${count}マス候補`;
}

function _getCardDetailLiveStateText(cardDef: any, ownerKey: any) {
    if (!cardDef || !ownerKey) return '';
    if (cardDef.type === 'SALVATION_WILL') {
        return _getSalvationWillLiveStateText(ownerKey);
    }
    if (cardDef.type === 'REINFORCEMENT_WILL') {
        return _getReinforcementWillLiveStateText(ownerKey);
    }
    if (cardDef.type === 'EQUALITY_WILL') {
        return _getEqualityWillLiveStateText();
    }
    if (cardDef.type === 'RIBO_WILL') {
        const turnIndex = Number(cardState && cardState.turnIndex);
        return Number.isFinite(turnIndex) && turnIndex < RIBO_WILL_UNLOCK_TURN_INDEX
            ? '18手後使用可能'
            : '';
    }
    return '';
}

function _renderCardDetailLiveState(stateEl: any, text: any) {
    if (!stateEl) return;
    const normalized = String(text || '').trim();
    stateEl.textContent = normalized;
    stateEl.style.display = normalized ? 'block' : 'none';
}

function _normalizeResolvedCardEffectTags(tags: any) {
    if (!Array.isArray(tags)) return [];
    const normalizedTags = [];
    const seen = new Set();
    for (const rawTag of tags) {
        if (!rawTag || typeof rawTag !== 'object') continue;
        const label = String(rawTag.label || '').trim();
        if (!label) continue;
        const kind = String(rawTag.kind || '').trim().toLowerCase();
        const dedupeKey = `${kind}:${label}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        normalizedTags.push({ kind, label });
    }
    return normalizedTags;
}

function _getCardEffectTagKindClass(kind: any) {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    if (!normalizedKind) return '';
    return `is-${normalizedKind.replace(/[^a-z0-9]+/g, '-')}`;
}

function _renderCardDetailEffectTags(tagsEl: any, tags: any) {
    if (!tagsEl) return;
    tagsEl.textContent = '';
    const normalizedTags = _normalizeResolvedCardEffectTags(tags);
    if (normalizedTags.length === 0) {
        tagsEl.style.display = 'none';
        return;
    }

    for (const tag of normalizedTags) {
        const chip = document.createElement('span');
        chip.className = 'card-detail-effect-tag';
        const kindClass = _getCardEffectTagKindClass(tag.kind);
        if (kindClass) chip.classList.add(kindClass);
        chip.textContent = tag.label;
        chip.setAttribute('data-card-tag-kind', tag.kind || '');
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

function _openCardDetailTabPanel(payload: any) {
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

function _toggleCardDetailTabPanel(payload: any) {
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

        const rawTarget: any = event ? event.target : null;
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

function _setPendingSelectionBusy(active: any) {
    if (_pendingSelectionFlowModule && typeof _pendingSelectionFlowModule.setSelectionBusy === 'function') {
        _pendingSelectionFlowModule.setSelectionBusy(active);
        try {
            const rootRef = _getUiRootRef();
            if (rootRef) {
                rootRef.isProcessing = !!active;
                rootRef.isCardAnimating = !!active;
            } else {
                (globalThis as CardInteractionRuntimeRoot).isProcessing = !!active;
                (globalThis as CardInteractionRuntimeRoot).isCardAnimating = !!active;
            }
        } catch (e) { /* ignore */ }
        return;
    }
    const normalized = !!active;
    const rootRef = _getUiRootRef();
    if (_playbackStateModule && typeof _playbackStateModule.setBusyState === 'function') {
        _playbackStateModule.setBusyState({
            processing: normalized,
            cardAnimating: normalized
        });
        try {
            if (rootRef) {
                rootRef.isProcessing = normalized;
                rootRef.isCardAnimating = normalized;
            } else {
                (globalThis as CardInteractionRuntimeRoot).isProcessing = normalized;
                (globalThis as CardInteractionRuntimeRoot).isCardAnimating = normalized;
            }
        } catch (e) { /* ignore */ }
        return;
    }
    try {
        if (rootRef) {
            rootRef.isProcessing = normalized;
            rootRef.isCardAnimating = normalized;
        } else {
            (globalThis as CardInteractionRuntimeRoot).isProcessing = normalized;
            (globalThis as CardInteractionRuntimeRoot).isCardAnimating = normalized;
        }
    } catch (e) { /* ignore */ }
}

function _getServerAuthoredCardUseClickBuffer() {
    const rootRef = _getUiRootRef();
    if (!rootRef) return null;
    if (!rootRef.__serverAuthoredCardUseClickBuffer || typeof rootRef.__serverAuthoredCardUseClickBuffer !== 'object') {
        rootRef.__serverAuthoredCardUseClickBuffer = {
            active: false,
            playerKey: null,
            ownerKey: null,
            cardId: null,
            click: null
        };
    }
    if (typeof rootRef.__captureServerAuthoredCardUseBoardClick !== 'function') {
        rootRef.__captureServerAuthoredCardUseBoardClick = function captureServerAuthoredCardUseBoardClick(row: any, col: any, playerKey: any) {
            const buffer = rootRef.__serverAuthoredCardUseClickBuffer;
            if (!buffer || buffer.active !== true) return false;
            const normalizedPlayer = _normalizeOwnerKey(playerKey);
            if (buffer.playerKey && normalizedPlayer && buffer.playerKey !== normalizedPlayer) return false;
            if (!Number.isFinite(Number(row)) || !Number.isFinite(Number(col))) return false;
            buffer.click = {
                row: Math.trunc(Number(row)),
                col: Math.trunc(Number(col)),
                playerKey: normalizedPlayer || buffer.playerKey || null
            };
            return true;
        };
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && globalThis !== rootRef) {
            (globalThis as CardInteractionRuntimeRoot).__serverAuthoredCardUseClickBuffer = rootRef.__serverAuthoredCardUseClickBuffer;
            (globalThis as CardInteractionRuntimeRoot).__captureServerAuthoredCardUseBoardClick = rootRef.__captureServerAuthoredCardUseBoardClick;
        }
    } catch (e) { /* ignore */ }
    return rootRef.__serverAuthoredCardUseClickBuffer;
}

function _beginServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any) {
    const buffer = _getServerAuthoredCardUseClickBuffer();
    if (!buffer) return;
    buffer.active = true;
    buffer.playerKey = _normalizeOwnerKey(playerKey);
    buffer.ownerKey = _normalizeOwnerKey(ownerKey);
    buffer.cardId = cardId || null;
    buffer.click = null;
}

function _consumeServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any) {
    const buffer = _getServerAuthoredCardUseClickBuffer();
    if (!buffer || buffer.active !== true) return null;
    const matches = (!buffer.playerKey || buffer.playerKey === _normalizeOwnerKey(playerKey))
        && (!buffer.ownerKey || buffer.ownerKey === _normalizeOwnerKey(ownerKey))
        && (!buffer.cardId || buffer.cardId === cardId);
    const click = matches && buffer.click ? buffer.click : null;
    buffer.active = false;
    buffer.playerKey = null;
    buffer.ownerKey = null;
    buffer.cardId = null;
    buffer.click = null;
    return click;
}

function _clearServerAuthoredCardUseClickBuffer() {
    const buffer = _getServerAuthoredCardUseClickBuffer();
    if (!buffer) return;
    buffer.active = false;
    buffer.playerKey = null;
    buffer.ownerKey = null;
    buffer.cardId = null;
    buffer.click = null;
}

function _createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any) {
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

function _finalizePendingSelectionAfterRun(playerKey: any, pendingType: any, runResult: any) {
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

function _clearHeavenSelection(playerKey: any) {
    if (!playerKey) return;
    _heavenSelectionByPlayer[playerKey] = null;
}

function _doesPlayerOwnCard(playerKey: any, cardId: any) {
    const stateRef = _getCardStateRef();
    if (!playerKey || !cardId || !stateRef || !stateRef.hands) return false;
    const hand = Array.isArray(stateRef.hands[playerKey]) ? stateRef.hands[playerKey] : [];
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

function _isSelectedCardUsableNow(playerKey: any, cardId: any, opts: any) {
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

function _getOwnerHandContainers(ownerKey: any) {
    if (typeof document === 'undefined') return [];
    const normalizedOwner = _normalizeOwnerKey(ownerKey);
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');
    const handElements = [handBlackEl, handWhiteEl].filter(Boolean);
    const ownerMatched = (_ownerHelpersModule && typeof _ownerHelpersModule.filterOwnerMatchedElements === 'function')
        ? _ownerHelpersModule.filterOwnerMatchedElements(handElements, normalizedOwner)
        : handElements.filter((handEl) => {
            const handOwner = handEl && handEl.dataset && handEl.dataset.ownerKey
                ? (handEl.dataset.ownerKey === 'white' ? 'white' : 'black')
                : null;
            return handOwner === normalizedOwner;
        });
    if (ownerMatched.length > 0) return ownerMatched;
    const legacyHandId = normalizedOwner === 'white' ? 'hand-white' : 'hand-black';
    const legacyHandEl = document.getElementById(legacyHandId);
    return legacyHandEl ? [legacyHandEl] : [];
}

function _queryOwnerHandElements(ownerKey: any, selector: any) {
    if (!selector || typeof document === 'undefined') return [];
    const matches: any[] = [];
    _getOwnerHandContainers(ownerKey).forEach((handEl: any) => {
        matches.push(...Array.from(handEl.querySelectorAll(selector)));
    });
    return matches;
}

function _findCardElementInOwnerHand(cardId: any, ownerKey: any) {
    if (!cardId || typeof document === 'undefined') return null;
    const normalizedOwner = _normalizeOwnerKey(ownerKey);
    const ownerMatched = _queryOwnerHandElements(normalizedOwner, `.card-item[data-card-id="${cardId}"]`).filter((candidate) => {
        const cardOwner = (_ownerHelpersModule && typeof _ownerHelpersModule.getElementOwnerKey === 'function')
            ? (_ownerHelpersModule.getElementOwnerKey(candidate) || normalizedOwner)
            : (candidate && candidate.dataset && candidate.dataset.ownerKey
                ? (candidate.dataset.ownerKey === 'white' ? 'white' : 'black')
                : normalizedOwner);
        return cardOwner === normalizedOwner;
    });

    if (ownerMatched.length > 0) {
        const visible = ownerMatched.find((el) => !el.classList.contains('hidden'));
        return visible || ownerMatched[0];
    }

    return null;
}

function _settleLingeringHandFadeForOwner(ownerKey: any) {
    const normalizedOwner = _normalizeOwnerKey(ownerKey);
    if (_handAnimationUtilsModule && typeof _handAnimationUtilsModule.settleOwnerHandFadeIn === 'function') {
        _handAnimationUtilsModule.settleOwnerHandFadeIn(normalizedOwner);
        return;
    }
    _queryOwnerHandElements(normalizedOwner, '.card-item.card-fade-prep, .card-item.card-fade-in').forEach((cardEl) => {
        cardEl.classList.remove('card-fade-prep');
        cardEl.classList.remove('card-fade-in');
        cardEl.style.removeProperty('--card-fade-in-duration');
    });
    try {
        if (typeof window === 'undefined') return;
        const activeState = (window.__handFadeInState && typeof window.__handFadeInState === 'object')
            ? window.__handFadeInState
            : null;
        const activeHint = (window.__handFadeInHint && typeof window.__handFadeInHint === 'object')
            ? window.__handFadeInHint
            : null;
        const activeStateOwner = activeState && (activeState.playerKey === 'white' || activeState.playerKey === 'black')
            ? activeState.playerKey
            : null;
        const activeHintOwner = activeHint && (activeHint.playerKey === 'white' || activeHint.playerKey === 'black')
            ? activeHint.playerKey
            : null;
        if (activeStateOwner === normalizedOwner) {
            window.__handFadeInState = null;
        }
        if (activeHintOwner === normalizedOwner) {
            window.__handFadeInHint = null;
        }
    } catch (e) { /* ignore */ }
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

function _getOverlayOfferKey(offer: any) {
    if (offer && typeof offer === 'object') {
        const idx = Number.isInteger(offer.handIndex) ? offer.handIndex : -1;
        return `${idx}:${offer.cardId || ''}`;
    }
    return String(offer || '');
}

function _resolveOverlayOfferByKey(offers: any, offerKey: any) {
    if (!Array.isArray(offers) || !offers.length) return null;
    for (const offer of offers) {
        if (_getOverlayOfferKey(offer) === offerKey) return offer;
    }
    return null;
}

function _renderHeavenOverlay(playerKey: any) {
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
        const typeKey = _getCardDisplayTypeKey(def);
        if (typeKey) {
            cardEl.dataset.cardType = typeKey;
        }
        if (selectedKey === offerKey) cardEl.classList.add('selected');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'card-name';
        nameSpan.textContent = _getCardDisplayLabel(cardId, def);
        cardEl.appendChild(nameSpan);
        _fitCardNameForDisplay(nameSpan);

        _appendCardDisplayBadges(cardEl, def, cost, tier);

        cardEl.addEventListener('click', () => {
            if (pendingType === 'HEAVEN_BLESSING') {
                playUiEffectSound('hand_card_select');
            }
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
    refs.detailDesc.textContent = _getOverlayCardDescriptionText(selectedDef, selectedCardId);

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

function _executeHeavenSelection(playerKey: any, selectedCardId: any) {
    if (!selectedCardId) return { ok: false, reason: 'no_selection' };
    if (!_canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    _setPendingSelectionBusy(true);
    playUiEffectSound('treasure_gain');
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

function _executeCondemnSelection(playerKey: any, targetIndex: any, targetCardId: any) {
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
        _renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual, null);
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
        _finalizePendingSelectionAfterRun(playerKey, 'CONDEMN_WILL', result);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) _setPendingSelectionBusy(false);
    }
}

let _boardOps: any = null;
function _getBoardOps() {
    if (_boardOps) return _boardOps;
    if (typeof BoardOps !== 'undefined') return BoardOps;
    try { _boardOps = _require('../game/logic/board_ops'); } catch (e) { _boardOps = null; }
    return _boardOps;
}

function _emitPresentationEvent(ev: any) {
    const ops = _getBoardOps();
    if (ops && typeof ops.emitPresentationEvent === 'function') {
        ops.emitPresentationEvent(cardState, ev);
        return true;
    }
    return false;
}

function _getUiRootRef(): CardInteractionRuntimeRoot | null {
    if (typeof window !== 'undefined' && window) return window;
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis as CardInteractionRuntimeRoot;
    } catch (e) { /* ignore */ }
    return null;
}

function _getCardStateRef() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') {
            return (globalThis as any).cardState;
        }
    } catch (e) { /* ignore */ }
    const rootRef = _getUiRootRef();
    if (rootRef && rootRef.cardState && typeof rootRef.cardState === 'object') return rootRef.cardState;
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    return null;
}

function _isProcessingNow() {
    const rootRef = _getUiRootRef();
    const managedProcessing = (_playbackStateModule && typeof _playbackStateModule.getProcessing === 'function')
        ? _playbackStateModule.getProcessing()
        : false;
    return (
        managedProcessing === true ||
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
    if (_playbackStateModule && typeof _playbackStateModule.getPlaybackStaleMs === 'function') {
        return _playbackStateModule.getPlaybackStaleMs({
            root: _getUiRootRef()
        });
    }
    const rootRef = _getUiRootRef();
    if (rootRef) {
        const ms = Number(rootRef.PASS_STALE_PLAYBACK_MS);
        if (Number.isFinite(ms) && ms > 0) return ms;
    }
    return 3500;
}

function _isVisualPlaybackRunningNow() {
    const rootRef = _getUiRootRef();
    if (_playbackStateModule && typeof _playbackStateModule.isPlaybackRunning === 'function') {
        return _playbackStateModule.isPlaybackRunning({ root: rootRef });
    }
    if (!_isVisualPlaybackActiveNow()) return false;
    if (rootRef && rootRef.AnimationEngine && typeof rootRef.AnimationEngine.isPlaying === 'boolean') {
        return rootRef.AnimationEngine.isPlaying === true;
    }
    return true;
}

function _isStaleVisualPlaybackLock() {
    const rootRef = _getUiRootRef();
    if (_playbackStateModule && typeof _playbackStateModule.isPlaybackStale === 'function') {
        return _playbackStateModule.isPlaybackStale({ root: rootRef });
    }
    if (!_isVisualPlaybackActiveNow()) return false;

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

function _clearCardUiBusyFlags(options: any) {
    const opts = options || {};
    const clearProcessing = opts.clearProcessing !== false;
    const clearPlayback = opts.clearPlayback === true;
    const rootRef = _getUiRootRef();

    try {
        if (_playbackStateModule && typeof _playbackStateModule.setBusyState === 'function') {
            const managerBusyState: Record<string, any> = { cardAnimating: false };
            if (clearProcessing) managerBusyState.processing = false;
            _playbackStateModule.setBusyState(managerBusyState);
        }
        if (rootRef) {
            if (clearProcessing) rootRef.isProcessing = false;
            rootRef.isCardAnimating = false;
        } else {
            if (clearProcessing) (globalThis as CardInteractionRuntimeRoot).isProcessing = false;
            (globalThis as CardInteractionRuntimeRoot).isCardAnimating = false;
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

function _armLocalPlaybackSoundSkip(soundKey: any) {
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

function _clearLocalPlaybackSoundSkip(soundKey: any) {
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
        if (_ownerHelpersModule && typeof _ownerHelpersModule.getCurrentMatchMode === 'function') {
            return _ownerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : null);
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
        if (_ownerHelpersModule && typeof _ownerHelpersModule.isNetworkMode === 'function') {
            return _ownerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    return _getCurrentMatchMode() === 'network';
}

function _isReversiMode() {
    try {
        if (_ownerHelpersModule && typeof _ownerHelpersModule.isReversiMode === 'function') {
            return _ownerHelpersModule.isReversiMode(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    const mode = String(_getCurrentMatchMode() || '').trim().toLowerCase();
    return mode === 'reversi' || mode === 'othello';
}

function _getNetworkLocalPlayerKey() {
    try {
        if (_ownerHelpersModule && typeof _ownerHelpersModule.resolveLocalPlayerKey === 'function') {
            return _ownerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
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
    const isDebugHvH = _isDebugHvHMode();
    if (_isNetworkMode()) return _getNetworkLocalPlayerKey();
    if (isDebugHvH) {
        // Mirror the renderer's inputPlayerKey formula: when FATE_WILL is active in HvH,
        // the controller takes ownership of input so actions are attributed to the controller,
        // not the victim (current player).
        const currentPlayerKey = gameState.currentPlayer === BLACK ? 'black' : 'white';
        const fwc = (typeof cardState !== 'undefined' && cardState && cardState.fateWillControllerByTurnOwner) || null;
        const controller = fwc && fwc[currentPlayerKey];
        return controller || currentPlayerKey;
    }
    return 'black';
}

// Returns the turn owner (victim) key when the local player is the FATE_WILL controller,
// null otherwise.
function _getFateWillTurnOwnerKeyForLocalController() {
    try {
        if (!cardState || !cardState.fateWillControllerByTurnOwner || !gameState) return null;
        const currentPlayerKey = gameState.currentPlayer === BLACK ? 'black' : 'white';
        const controller = cardState.fateWillControllerByTurnOwner[currentPlayerKey];
        if (!controller) return null;
        return _resolveInputPlayerKey() === controller ? currentPlayerKey : null;
    } catch (e) { return null; }
}

function _getCardUiActionOwnerKey(inputPlayerKey: any) {
    return _getFateWillTurnOwnerKeyForLocalController() || inputPlayerKey || _resolveInputPlayerKey();
}

function _hasPlayerUsedCardThisActiveTurn(playerKey: any) {
    const normalizedKey = _normalizeOwnerKey(playerKey);
    if (!cardState || typeof cardState !== 'object') return false;
    if (cardState.lastTurnStartedFor !== normalizedKey) return false;
    return !!(
        cardState.hasUsedCardThisTurnByPlayer
        && cardState.hasUsedCardThisTurnByPlayer[normalizedKey]
    );
}

function _canInputPlayerActNow() {
    const currentPlayerKey = gameState.currentPlayer === BLACK ? 'black' : 'white';
    const localKey = _resolveInputPlayerKey();
    // FATE_WILL: block the victim and allow only the controller.
    // Applies in network mode and in local non-HvH mode (in HvH both players share the device).
    const isDebugHvH = _isDebugHvHMode();
    if (_isNetworkMode() || !isDebugHvH) {
        const cs = (typeof cardState !== 'undefined' && cardState) ? cardState : null;
        const fwc = cs && cs.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            // controller can act; victim (turn owner) cannot
            return controller === localKey;
        }
    }
    if (localKey === currentPlayerKey) return true;
    // HvH + FATE_WILL: local player is controller, not turn owner.
    return _getFateWillTurnOwnerKeyForLocalController() !== null;
}

function _commitSharedStateSnapshot(stateKey: any, nextState: any) {
    if (!nextState) return null;

    const sharedRoots: CardInteractionRuntimeRoot[] = [];
    if (typeof globalThis !== 'undefined' && globalThis) sharedRoots.push(globalThis as CardInteractionRuntimeRoot);
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
        if (stateKey === 'cardState') (globalThis as CardInteractionRuntimeRoot).cardState = targetState;
        else (globalThis as CardInteractionRuntimeRoot).gameState = targetState;
        for (const root of sharedRoots) {
            root[stateKey] = targetState;
        }
        return targetState;
    }

    if (stateKey === 'cardState') (globalThis as CardInteractionRuntimeRoot).cardState = nextState;
    else (globalThis as CardInteractionRuntimeRoot).gameState = nextState;
    for (const root of sharedRoots) {
        root[stateKey] = nextState;
    }
    return nextState;
}

function _runPipelineAction(playerKey: any, action: any) {
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

    if (res.skippedLocalExecution !== true && typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
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

function _getRunResultPlaybackEvents(runResult: any) {
    const playbackEvents = (runResult && runResult.result && Array.isArray(runResult.result.playbackEvents))
        ? runResult.result.playbackEvents
        : [];
    return playbackEvents;
}

function _hasPlaybackEventType(runResult: any, eventType: any) {
    return _getRunResultPlaybackEvents(runResult).some((ev: any) => ev && ev.type === eventType);
}

function _hasHandRemovePlaybackEvent(runResult: any) {
    return _hasPlaybackEventType(runResult, 'hand_remove');
}

function _hasBoardMutatingPlaybackEvent(runResult: any) {
    const boardMutatingTypes = new Set([
        'place',
        'spawn',
        'flip',
        'destroy',
        'move',
        'status_applied',
        'status_removed',
        'capture_to_hand_animation'
    ]);
    return _getRunResultPlaybackEvents(runResult).some((ev: any) => (
        ev &&
        boardMutatingTypes.has(String(ev.type || '').toLowerCase())
    ));
}

function _getRunResultNextCardState(runResult: any) {
    const nextCardState = (runResult && runResult.result && runResult.result.nextCardState && typeof runResult.result.nextCardState === 'object')
        ? runResult.result.nextCardState
        : null;
    if (nextCardState) return nextCardState;
    return (cardState && typeof cardState === 'object') ? cardState : null;
}

function _doesRunResultEnterBoardTargetSelectionForOwner(runResult: any, ownerKey: any) {
    const normalizedOwnerKey = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!normalizedOwnerKey) return false;
    const nextCardState = _getRunResultNextCardState(runResult);
    if (!nextCardState || !nextCardState.pendingEffectByPlayer) return false;
    const pending = nextCardState.pendingEffectByPlayer[normalizedOwnerKey];
    if (!pending || pending.stage !== 'selectTarget') return false;
    return !_isHandOverlayPendingTypeForCardUi(pending.type);
}

function _getBoardTargetSelectionEntryContext(runResult: any, ownerKey: any) {
    const normalizedOwnerKey = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!normalizedOwnerKey) return null;
    const nextCardState = _getRunResultNextCardState(runResult);
    if (!nextCardState || !nextCardState.pendingEffectByPlayer) return null;
    const pending = nextCardState.pendingEffectByPlayer[normalizedOwnerKey];
    if (!pending || pending.stage !== 'selectTarget' || _isHandOverlayPendingTypeForCardUi(pending.type)) {
        return null;
    }
    return {
        playerKey: normalizedOwnerKey,
        pendingType: pending.type
    };
}

function _armBoardTargetSelectionEntryPlaybackContext(runResult: any, ownerKey: any) {
    if (!_playbackStateModule || typeof _playbackStateModule.armSelectionEntryPlaybackContext !== 'function') {
        return false;
    }
    const context = _getBoardTargetSelectionEntryContext(runResult, ownerKey);
    if (!context) return false;
    try {
        _playbackStateModule.armSelectionEntryPlaybackContext({
            playerKey: context.playerKey,
            pendingType: context.pendingType,
            source: 'card-interaction',
            reason: 'selection_entry_after_card_use',
            expiresAt: Date.now() + 2500
        });
        return true;
    } catch (e) {
        return false;
    }
}

function _getDeferredGeneratedThrowChainHandAddMeta(runResult: any) {
    const meta = runResult && runResult.result
        ? runResult.result.deferredGeneratedThrowChainHandAdd
        : null;
    return (meta && typeof meta === 'object') ? meta : null;
}

function _getRunResultPublishPromise(runResult: any) {
    const publishPromise = (runResult && runResult.result)
        ? runResult.result.publishPromise
        : null;
    return (publishPromise && typeof publishPromise.then === 'function')
        ? publishPromise
        : null;
}

function _renderCardUiSafely() {
    if (typeof renderCardUI !== 'function') return;
    try { renderCardUI(); } catch (e) { /* ignore */ }
}

function _handleServerAuthoredCardUse(playerKey: any, ownerKey: any, cardId: any, runResult: any) {
    const publishPromise = _getRunResultPublishPromise(runResult);
    if (!publishPromise) return false;

    _beginServerAuthoredCardUseClickBuffer(playerKey, ownerKey, cardId);
    _setPendingSelectionBusy(true);
    _renderCardUiSafely();

    Promise.resolve(publishPromise)
        .then((publishResult) => {
            _setPendingSelectionBusy(false);
            if (!publishResult || publishResult.ok !== true) {
                _clearServerAuthoredCardUseClickBuffer();
                const reason = publishResult && publishResult.reason
                    ? String(publishResult.reason)
                    : 'NETWORK_PUBLISH_FAILED';
                addLog(`カード使用に失敗しました (${reason})`);
                _renderCardUiSafely();
                if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
                    ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
                }
                return;
            }

            const bufferedClick = _consumeServerAuthoredCardUseClickBuffer(playerKey, ownerKey, cardId);
            if (cardState && cardState.selectedCardId === cardId && _getSelectedCardOwnerKey(playerKey) === ownerKey) {
                _clearSelectedCardSelection();
            }
            _renderCardUiSafely();
            const rootRef = _getUiRootRef();
            const globalRef: CardInteractionRuntimeRoot | null = (typeof globalThis !== 'undefined' && globalThis) ? (globalThis as CardInteractionRuntimeRoot) : null;
            const clickHandler = (typeof handleCellClick === 'function')
                ? handleCellClick
                : (rootRef && typeof rootRef.handleCellClick === 'function'
                    ? rootRef.handleCellClick
                    : (globalRef && typeof globalRef.handleCellClick === 'function' ? globalRef.handleCellClick : null));
            if (bufferedClick && typeof clickHandler === 'function') {
                try {
                    clickHandler(bufferedClick.row, bufferedClick.col);
                    return;
                } catch (e) { /* ignore */ }
            }
            if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
                ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
            }
        })
        .catch((error) => {
            _setPendingSelectionBusy(false);
            _clearServerAuthoredCardUseClickBuffer();
            const reason = (error && error.message)
                ? String(error.message)
                : 'PUBLISH_ERROR';
            addLog(`カード使用に失敗しました (${reason})`);
            _renderCardUiSafely();
            if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
                ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
            }
        });

    return true;
}

function _applyDeferredGeneratedThrowChainHandReveal(runResult: any) {
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

function _snapshotElementRect(element: any) {
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

function _resolveSelectedHandCardActionContext(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const isDebugUnlimited = opts.isDebugUnlimited === true;
    if (_isAutoModeActive()) return null;
    if (!isDebugUnlimited && opts.requireInteract !== false && !_canInteractWithCardUi()) return null;
    if (!isDebugUnlimited && opts.requireTurn !== false && !_canInputPlayerActNow()) return null;
    if (!cardState || cardState.selectedCardId === null) return null;

    const playerKey = _resolveInputPlayerKey();
    const actionPlayerKey = _getFateWillTurnOwnerKeyForLocalController() || playerKey;
    const cardId = cardState.selectedCardId;
    const selectedOwnerKey = _getSelectedCardOwnerKey(actionPlayerKey);

    if (selectedOwnerKey !== actionPlayerKey || !_doesPlayerOwnCard(actionPlayerKey, cardId)) {
        _clearSelectedCardSelection();
        addLog('自分の手札からカードを選択してください');
        renderCardUI();
        return null;
    }

    return {
        playerKey,
        actionPlayerKey,
        cardId,
        selectedOwnerKey
    };
}

function _runCardPipelineActionOrLogFailure(playerKey: any, action: any, failureMessage: any) {
    const result = _runPipelineAction(playerKey, action);
    if (result.ok) return result;
    const reason = result.rejectedReason || (result.result && result.result.rejectedReason) || null;
    addLog(`${failureMessage}${reason ? ` (${reason})` : ''}`);
    return null;
}

function _ensureCurrentPlayerCanActOrPassSafely() {
    if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
        try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
    }
}

function _finalizeCardActionUi(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const renderOptions = opts.renderImmediately === true
        ? { renderImmediately: true }
        : undefined;
    if (Object.prototype.hasOwnProperty.call(opts, 'delayHandVisual')) {
        _renderCardUiWithOptionalPlaybackDelay(opts.delayHandVisual === true, renderOptions);
    }
    if (opts.boardUpdateMode === 'immediate') {
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
    } else if (opts.boardUpdateMode === 'playback-aware') {
        _emitBoardUpdateWithOptionalPlaybackDelay(opts.delayBoardVisual === true);
    }
    _ensureCurrentPlayerCanActOrPassSafely();
}

function _attachCardUsePlaybackSourceElement(runResult: any, sourceCardEl: any, sourceCardRect: any) {
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

function _setCaptureReservedHandSlotState(nextState: any) {
    try {
        if (typeof window !== 'undefined') {
            window.__captureReservedHandSlotState = nextState || null;
        }
    } catch (e) { /* ignore */ }
}

function _primeCaptureReservedHandSlotState(runResult: any) {
    const playbackEvents = _getRunResultPlaybackEvents(runResult);
    const captureEvent = playbackEvents.find((ev: any) => ev && ev.type === 'capture_to_hand_animation');
    const target = captureEvent && Array.isArray(captureEvent.targets) && captureEvent.targets[0]
        ? captureEvent.targets[0]
        : null;
    const playerKey = target && (target.player === 'black' || target.player === 'white')
        ? target.player
        : null;
    if (!playerKey || !Number.isInteger(target && target.insertIndex)) {
        _setCaptureReservedHandSlotState(null);
        return false;
    }
    _setCaptureReservedHandSlotState({
        playerKey,
        handIndex: target.insertIndex,
        token: `capture-slot-${Date.now()}-${Math.random().toString(36).slice(2)}`
    });
    return true;
}

function _getWaitForPlaybackIdleFn() {
    const waitForPlaybackFn = (typeof waitForPlaybackIdle === 'function')
        ? waitForPlaybackIdle
        : ((typeof window !== 'undefined' && typeof window.waitForPlaybackIdle === 'function') ? window.waitForPlaybackIdle : null);
    return typeof waitForPlaybackFn === 'function' ? waitForPlaybackFn : null;
}

function _waitForCardUseAnimationIdle() {
    const scheduleNextTick = (callback: any) => {
        try {
            const rootRef = _getUiRootRef();
            if (rootRef && typeof rootRef.requestAnimationFrame === 'function') {
                rootRef.requestAnimationFrame(callback);
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(callback);
                return;
            }
        } catch (e) { /* ignore */ }
        setTimeout(callback, 16);
    };

    const waitForCardAnimationIdle = () => new Promise<void>((resolve) => {
        const tick = () => {
            try {
                if (!_isCardAnimatingNow()) {
                    resolve();
                    return;
                }
                if (_isStaleVisualPlaybackLock()) {
                    _releaseStaleVisualPlaybackLock();
                    if (!_isCardAnimatingNow()) {
                        resolve();
                        return;
                    }
                }
            } catch (e) {
                resolve();
                return;
            }
            scheduleNextTick(tick);
        };
        tick();
    });
    return waitForCardAnimationIdle();
}

function _renderCardUiWithOptionalPlaybackDelay(shouldDelay: any, options: any) {
    if (typeof renderCardUI !== 'function') return;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!shouldDelay) {
        renderCardUI();
        return;
    }
    if (opts.renderImmediately === true) {
        renderCardUI();
    }

    const waitForPlaybackFn = _getWaitForPlaybackIdleFn();
    if (typeof waitForPlaybackFn === 'function') {
        Promise.resolve(waitForPlaybackFn()).then(_renderCardUiSafely).catch(_renderCardUiSafely);
        return;
    }

    renderCardUI();
}

function _emitBoardUpdateWithOptionalPlaybackDelay(shouldDelay: any) {
    const renderBoardSync = () => {
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
    };
    const renderBoardSyncSafely = () => {
        try { renderBoardSync(); } catch (e) { /* ignore */ }
    };
    const renderBoardAfterCardAnimationIfNeeded = () => {
        if (!_isCardAnimatingNow()) {
            renderBoardSync();
            return;
        }
        Promise.resolve(_waitForCardUseAnimationIdle()).then(renderBoardSyncSafely).catch(renderBoardSyncSafely);
    };
    const renderBoardAfterCardAnimationIfNeededSafely = () => {
        try { renderBoardAfterCardAnimationIfNeeded(); } catch (e) { /* ignore */ }
    };
    if (!shouldDelay) {
        renderBoardSync();
        return;
    }

    const waitForPlaybackFn = _getWaitForPlaybackIdleFn();
    if (typeof waitForPlaybackFn === 'function') {
        Promise.resolve(waitForPlaybackFn()).then(renderBoardAfterCardAnimationIfNeededSafely).catch(renderBoardAfterCardAnimationIfNeededSafely);
        return;
    }

    renderBoardAfterCardAnimationIfNeeded();
}

function _getActiveNetworkMatchClient() {
    const networkRoot = _getNetworkMatchClientRoot();
    const networkClient = networkRoot ? networkRoot.NetworkMatchClient : null;
    if (!networkClient) return null;
    if (typeof networkClient.publishSnapshot !== 'function') return null;
    if (typeof networkClient.isActive !== 'function' || networkClient.isActive() !== true) return null;
    return networkClient;
}

function _getNetworkMatchClientRoot(): CardInteractionRuntimeRoot | null {
    if (typeof window !== 'undefined' && window && window.NetworkMatchClient) {
        return window;
    }
    return (typeof globalThis !== 'undefined' && globalThis && (globalThis as CardInteractionRuntimeRoot).NetworkMatchClient)
        ? (globalThis as CardInteractionRuntimeRoot)
        : null;
}

function _startNetworkOnlyPendingSelectionPublish(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const networkClient = _getActiveNetworkMatchClient();
    if (!networkClient) return false;

    const settleSuccessAfterPublish = () => {
        try {
            if (_playbackStateModule && typeof _playbackStateModule.clearPlaybackLock === 'function') {
                _playbackStateModule.clearPlaybackLock();
            }
        } catch (e) { /* ignore */ }
        _setPendingSelectionBusy(false);
        _renderCardUiSafely();
    };

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
            settleSuccessAfterPublish();
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
    if (!_isDebugHvHMode() && !_isDebugUnlimitedUsage()) return;
    const networkRoot = _getNetworkMatchClientRoot();
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

    const shouldFillWhite = _isDebugHvHMode();
    const dbg = _getDebugActions();
    if (!dbg || typeof dbg.fillDebugHand !== 'function') {
        ensureDebugActionsLoaded((loaded: any) => {
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

function _resolveCardDetailSelectionContext(playerKey: any) {
    const isDebugHvH = _isDebugHvHMode();
    const selectedId = cardState.selectedCardId;
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);
    const hasInspectableSelection = !!selectedId
        && _doesPlayerOwnCard(selectedOwnerKey, selectedId)
        && (selectedOwnerKey === playerKey || isDebugHvH);
    return {
        playerKey,
        selectedId,
        selectedOwnerKey,
        hasSelection: hasInspectableSelection && selectedOwnerKey === playerKey,
        normalizedSelectedId: hasInspectableSelection ? selectedId : null
    };
}

function _syncCardDetailExpandedSelection(normalizedSelectedId: any) {
    if (normalizedSelectedId && _cardDetailExpandedForCardId === normalizedSelectedId) return;
    _cardDetailExpanded = false;
    _cardDetailExpandedForCardId = normalizedSelectedId || null;
    if (!normalizedSelectedId || (_cardDetailTabState.open && _cardDetailTabState.mode === 'detail')) {
        _closeCardDetailTabPanel();
    }
}

function _resolveCardDetailActionState(selectionContext: any) {
    const isAutoMode = _isAutoModeActive();
    const canActThisTurn = _canInputPlayerActNow();
    const isDebugUnlimited = _isDebugUnlimitedUsage();
    _ensureHandDestroyFlags();
    const hasNotUsedThisTurn = isDebugUnlimited ? true : !_hasPlayerUsedCardThisActiveTurn(selectionContext.playerKey);
    const canInteract = isDebugUnlimited ? true : _canInteractWithCardUi();
    const selectedCardDef = selectionContext.hasSelection ? CardLogic.getCardDef(selectionContext.selectedId) : null;
    const cost = selectedCardDef ? (selectedCardDef.cost || 0) : 0;
    const canAfford = isDebugUnlimited ? true : (cardState.charge[selectionContext.playerKey] || 0) >= cost;
    const canUseSelectedCardByRules = selectionContext.hasSelection && _isSelectedCardUsableNow(
        selectionContext.playerKey,
        selectionContext.selectedId,
        isDebugUnlimited ? { skipCostAndTurnLimit: true } : undefined
    );
    const noLegalMoves = _getLegalMovesForCurrentPlayer().length === 0;
    const pending = cardState.pendingEffectByPlayer[selectionContext.playerKey];
    const isSelectingTarget = !!(pending && pending.stage === 'selectTarget');
    const isHeavenSelecting = !!(
        pending
        && (pending.type === 'HEAVEN_BLESSING' || pending.type === 'CONDEMN_WILL')
        && pending.stage === 'selectTarget'
    );

    let canUse = !isAutoMode
        && canActThisTurn
        && selectionContext.hasSelection
        && hasNotUsedThisTurn
        && canInteract
        && canAfford
        && canUseSelectedCardByRules;
    if (isDebugUnlimited) {
        canUse = selectionContext.hasSelection;
    }
    let canDestroy = !isAutoMode && canActThisTurn && selectionContext.hasSelection && canInteract;
    if (isDebugUnlimited) {
        canDestroy = selectionContext.hasSelection;
    }
    let reason = '';

    if (!selectionContext.hasSelection) {
        reason = selectionContext.selectedId ? '自分の手札からカードを選択してください' : '';
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

    const canShowPass = canActThisTurn && noLegalMoves && !isSelectingTarget;
    const canPassWhileBusy = !_isVisualPlaybackRunningNow() || _isStaleVisualPlaybackLock();
    const canPass = !isAutoMode && canShowPass && (canInteract || canPassWhileBusy);

    return {
        canActThisTurn,
        isDebugUnlimited,
        canInteract,
        selectedCardDef,
        cost,
        canAfford,
        pending,
        isSelectingTarget,
        isHeavenSelecting,
        canUse,
        canDestroy,
        canShowPass,
        canPass,
        reason
    };
}

function _syncReversiPassButton(actionState: any) {
    const passBtn = (document.getElementById('reversi-pass-btn') || document.getElementById('othello-pass-btn')) as HTMLButtonElement | null;
    if (!passBtn) return;
    const shouldShow = _isReversiMode() && actionState.canShowPass;
    passBtn.hidden = !shouldShow;
    passBtn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    passBtn.disabled = !shouldShow || !actionState.canPass;
}

function _getPendingSelectionPrompt(pending: any) {
    if (!pending || pending.stage !== 'selectTarget') return '';
    const simplePromptByType: Record<string, string> = {
        STRONG_WIND_WILL: '移動させる石を選んでください',
        BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
        SUPER_BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
        GRAVITY_WILL: '下方向へ移動させる石を選んでください',
        SUPER_GRAVITY_WILL: '下方向へ移動させる石を選んでください',
        SUPER_ATTRACTION_WILL: pending.firstTarget ? '引き寄せ先のマスを選んでください' : '引き寄せる石を選んでください',
        TELEPORT_WILL: 'テレポートさせる石を選んでください',
        CELL_TELEPORT_WILL: 'マステレポートさせるマスを選んでください',
        SWAP_WITH_ENEMY: '交換する敵石を選んでください',
        TRAP_WILL: '罠を設置する自分の石を選んでください（選択後にターン終了）',
        TEMPT_WILL: '対象の相手特殊石を選んでください',
        CAPTURE_WILL: '捕獲する相手特殊石を選んでください',
        GUARD_WILL: '守る石にする自分の石を選んでください',
        GUARDIAN_GOD: '守護神にする自分の石を選んでください',
        HYPERACTIVE_INHERIT_WILL: '多動を継承する自分の石を選んでください',
        TIME_BOMB: '時限爆弾にする自分の石を選んでください',
        CLONE_WILL: '周囲に空きがある自分の石を選んでください',
        BOARD_EXPANSION_WILL: '左右端マスを選んで盤面を拡張してください',
        BOARD_EXPANSION_GOD: '角マスを選んで盤面を拡張してください',
        CORROSION_WILL: '腐食の対象となる特殊石を選んでください',
        SEED_WILL: '種をまく空きマスを選んでください',
        BLOCKADE_WILL: '封鎖する空きマスを選んでください',
        METEOR_WILL: '隕石で破壊するマスを選んでください',
        FREEZE_WILL: '凍結するマスを選んでください',
        HEAVEN_BLESSING: '候補5枚から1枚選択してください',
        CONDEMN_WILL: '相手手札から破壊する1枚を選択してください'
    };
    if (simplePromptByType[pending.type]) {
        return simplePromptByType[pending.type];
    }
    if (pending.type === 'POSITION_SWAP_WILL') {
        const first = pending.firstTarget;
        return first
            ? `2つ目の石を選んでください（1つ目: ${posToNotation(first.row, first.col)}）`
            : '1つ目の石を選んでください（全ての石が対象）';
    }
    if (pending.type === 'BOARD_SHRINK_WILL') {
        const selectedCount = Number.isFinite(Number(pending.selectedCount)) ? Number(pending.selectedCount) : 0;
        const maxSelections = Number.isFinite(Number(pending.maxSelections)) ? Number(pending.maxSelections) : 3;
        const remainingSelections = Math.max(0, maxSelections - selectedCount);
        return remainingSelections < maxSelections
            ? `盤面縮小: 外周マスをあと${remainingSelections}つ選んでください`
            : '盤面縮小: 外周マスを3つ選んでください';
    }
    if (pending.type === 'BOARD_SHRINK_GOD') {
        const first = pending.firstTarget;
        return first
            ? `盤面縮小神: ${posToNotation(first.row, first.col)}から伸ばす辺方向を選んでください`
            : '盤面縮小神: 縮小する辺の角マスを選んでください';
    }
    if (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') {
        return pending.type === 'EXTEND_LIFE_GOD'
            ? '4倍延命する自分の特殊石を選んでください'
            : '延命する自分の特殊石を選んでください';
    }
    return '破壊対象を選んでください（キャンセル可）';
}

function updateCardDetailPanel() {
    _scheduleCardDetailLandscapeAnchorSync();

    const nameEl = document.getElementById('card-detail-name');
    const descEl = document.getElementById('card-detail-desc');
    const detailTagsEl = _ensureCardDetailEffectTagsElement();
    const detailStateEl = _ensureCardDetailLiveStateElement();
    const detailMoreEl = document.getElementById('card-detail-more');
    const detailBtn = document.getElementById('toggle-card-detail-btn');
    const detailActionsEl = document.getElementById('card-detail-actions');
    const destroyBtn = document.getElementById('destroy-card-btn');
    const useBtn = document.getElementById('use-card-btn');
    const passBtn = document.getElementById('pass-btn');
    const reasonEl = document.getElementById('use-card-reason');
    const cancelBtn = document.getElementById('cancel-card-btn');

    if (!nameEl || !descEl || !useBtn || !reasonEl) return;

    // FATE_WILL: controller uses victim's hand/charge/pending for all interaction checks.
    const playerKey = _getCardUiActionOwnerKey(_resolveInputPlayerKey());
    const selectionContext = _resolveCardDetailSelectionContext(playerKey);
    const { selectedId, selectedOwnerKey, hasSelection, normalizedSelectedId } = selectionContext;

    _syncCardDetailExpandedSelection(normalizedSelectedId);

    _closeCardDetailTagTabIfOpen();
    const selectedCardDef = normalizedSelectedId ? CardLogic.getCardDef(normalizedSelectedId) : null;
    const displayModel = _buildCardDetailDisplayModel(selectedCardDef, selectedOwnerKey);
    _applyCardDetailDisplayModel(nameEl, descEl, detailStateEl, detailMoreEl, detailTagsEl, displayModel);
    if (detailBtn) {
        const canToggle = !!selectedId;
        const detailTabOpen = !!(
            _cardDetailTabState.open &&
            _cardDetailTabState.mode === 'detail' &&
            _cardDetailTabState.cardId === (normalizedSelectedId || null)
        );
        (detailBtn as HTMLButtonElement).disabled = !canToggle;
        detailBtn.textContent = detailTabOpen ? '閉じる' : '詳細';
        detailBtn.setAttribute('aria-expanded', detailTabOpen ? 'true' : 'false');
    }
    if (detailMoreEl) {
        detailMoreEl.style.display = 'none';
    }

    const actionState = _resolveCardDetailActionState(selectionContext);
    if (!actionState.isHeavenSelecting) {
        _clearHeavenSelection(playerKey);
    }

    (useBtn as HTMLButtonElement).disabled = !actionState.canUse;

    if (destroyBtn) {
        (destroyBtn as HTMLButtonElement).disabled = !actionState.canDestroy;
        destroyBtn.textContent = '破壊';
    }

    if (hasSelection && !actionState.canAfford) {
        useBtn.textContent = '布石不足';
        // Diagnostic: log situations where UI shows charge but button disabled unexpectedly
        try {
            const chargeVal = (cardState && cardState.charge) ? cardState.charge[playerKey] : undefined;
            if (typeof chargeVal === 'number' && typeof actionState.cost === 'number' && chargeVal >= actionState.cost) {
                console.warn('[CARD_UI] USE DISABLED despite sufficient charge', { selectedId, cardId: selectedId, cost: actionState.cost, charge: chargeVal, hasUsedThisTurn: _hasPlayerUsedCardThisActiveTurn(playerKey), isProcessing: _isProcessingNow(), isCardAnimating: _isCardAnimatingNow(), currentPlayer: gameState && gameState.currentPlayer });
            }
        } catch (e) { /* ignore */ }
    } else {
        useBtn.textContent = '使用';
    }

    reasonEl.textContent = actionState.reason;

    if (actionState.isHeavenSelecting) {
        _closeCardDetailTabPanel();
        if (destroyBtn) destroyBtn.style.display = 'none';
        useBtn.style.display = 'none';
        if (detailBtn) detailBtn.style.display = 'none';
        if (detailActionsEl) detailActionsEl.style.display = 'none';
        if (passBtn) passBtn.style.display = 'none';
    } else {
        if (destroyBtn) destroyBtn.style.display = 'inline-block';
        useBtn.style.display = 'inline-block';
        if (detailBtn) detailBtn.style.display = 'inline-block';
        if (detailActionsEl) detailActionsEl.style.display = 'flex';
    }

    // 選択モード用のキャンセルボタン表示制御
    const selecting = actionState.isSelectingTarget;
    const cancellableSelecting = selecting &&
        _isCancellablePendingSelectionForCardUi(actionState.pending.type) &&
        actionState.canActThisTurn;
    if (cancelBtn) {
        cancelBtn.style.display = cancellableSelecting ? 'block' : 'none';
        cancelBtn.textContent = 'キャンセル';
        // Add specific listener for HvH mode to ensure it uses the correct context
        cancelBtn.onclick = () => cancelPendingSelection(playerKey);
    }
    if (selecting) {
        reasonEl.textContent = _getPendingSelectionPrompt(actionState.pending);
    }

    if (passBtn) {
        passBtn.style.display = actionState.canShowPass ? 'inline-block' : 'none';
        (passBtn as HTMLButtonElement).disabled = !actionState.canPass;
    }
    _syncReversiPassButton(actionState);

    _renderHeavenOverlay(playerKey);
}

function toggleCardDetailExpanded() {
    const selectedId = cardState ? cardState.selectedCardId : null;
    const playerKey = _getCardUiActionOwnerKey(_resolveInputPlayerKey());
    const selectedOwnerKey = _getSelectedCardOwnerKey(playerKey);
    if (!selectedId || selectedOwnerKey !== playerKey || !_doesPlayerOwnCard(playerKey, selectedId)) {
        _closeCardDetailTabPanel();
        updateCardDetailPanel();
        return;
    }

    const cardDef = CardLogic && typeof CardLogic.getCardDef === 'function'
        ? CardLogic.getCardDef(selectedId)
        : null;
    const displayModel = _buildCardDetailDisplayModel(cardDef, selectedOwnerKey);
    const body = String(displayModel.detailPanelText || '').trim() || '詳細説明は準備中です。';
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

function playUiEffectSound(effectKey: any) {
    try {
        if (typeof SoundEngine === 'undefined' || !SoundEngine) return;
        if (typeof SoundEngine.playEffectByKey !== 'function') return;
        SoundEngine.init();
        SoundEngine.playEffectByKey(effectKey);
    } catch (e) { /* ignore */ }
}

function onCardClick(cardId: any, ownerKey: any) {
    const isDebugUnlimited = _isDebugUnlimitedUsage();
    const isDebugHvH = _isDebugHvHMode();
    if (_isAutoModeActive()) return;
    const playerKey = _resolveInputPlayerKey();
    const actionOwnerKey = _getCardUiActionOwnerKey(playerKey);
    const clickedOwnerKey = (ownerKey === 'white' || ownerKey === 'black')
        ? ownerKey
        : null;
    const stateRef = _getCardStateRef();
    const pending = stateRef && stateRef.pendingEffectByPlayer ? stateRef.pendingEffectByPlayer[actionOwnerKey] : null;
    if (_isCardAnimatingNow() && !isDebugUnlimited && !_releaseStaleVisualPlaybackLock()) return;

    _closeCardDetailTagTabIfOpen();

    if (clickedOwnerKey && clickedOwnerKey !== actionOwnerKey) {
        const isFateWillController = actionOwnerKey !== playerKey;
        if (!isDebugHvH && !isFateWillController) return;
        if (!_doesPlayerOwnCard(clickedOwnerKey, cardId)) return;

        playUiEffectSound('hand_card_select');
        _settleLingeringHandFadeForOwner(clickedOwnerKey);

        if (stateRef && stateRef.selectedCardId === cardId && _getSelectedCardOwnerKey(actionOwnerKey) === clickedOwnerKey) {
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

    if (!_doesPlayerOwnCard(actionOwnerKey, cardId)) return;

    playUiEffectSound('hand_card_select');
    _settleLingeringHandFadeForOwner(actionOwnerKey);

    if (stateRef && stateRef.selectedCardId === cardId && _getSelectedCardOwnerKey(actionOwnerKey) === actionOwnerKey) {
        _clearSelectedCardSelection();
    } else {
        _setSelectedCardSelection(cardId, actionOwnerKey);
    }

    renderCardUI();
}

function destroySelectedHandCard() {
    const isDebugUnlimited = _isDebugUnlimitedUsage();
    const actionContext = _resolveSelectedHandCardActionContext({ isDebugUnlimited });
    if (!actionContext) return;
    const { playerKey, actionPlayerKey, cardId } = actionContext;

    _ensureHandDestroyFlags();

    const cardDef = CardLogic.getCardDef(cardId);
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('destroy_hand_card', playerKey, { destroyCardId: cardId })
        : { type: 'destroy_hand_card', destroyCardId: cardId };

    const result = _runCardPipelineActionOrLogFailure(playerKey, action, 'カード破壊に失敗しました');
    if (!result) return;

    playUiEffectSound('stone_destroy');

    const playerName = actionPlayerKey === 'black' ? '黒' : '白';
    addLog(`${playerName}が手札を破壊: ${cardDef ? cardDef.name : cardId}`);

    _clearSelectedCardSelection();
    _finalizeCardActionUi({
        delayHandVisual: _hasHandRemovePlaybackEvent(result),
        boardUpdateMode: 'immediate'
    });
}

function useSelectedCard() {
    const isDebugUnlimited = _isDebugUnlimitedUsage();
    const actionContext = _resolveSelectedHandCardActionContext({ isDebugUnlimited });
    if (!actionContext) return;
    const { playerKey, actionPlayerKey, cardId } = actionContext;

    if (!isDebugUnlimited && _hasPlayerUsedCardThisActiveTurn(actionPlayerKey)) return;

    const cardDef = CardLogic.getCardDef(cardId);

    // Charge Check (in debug mode, skip)
    const cost = cardDef ? cardDef.cost : 0;
    if (!isDebugUnlimited && (cardState.charge[actionPlayerKey] || 0) < cost) {
        addLog(`布石不足: ${cardDef ? cardDef.name : cardId} (必要: ${cost}, 所持: ${cardState.charge[actionPlayerKey] || 0})`);
        return;
    }
    if (!_isSelectedCardUsableNow(actionPlayerKey, cardId, isDebugUnlimited ? { skipCostAndTurnLimit: true } : undefined)) {
        addLog('このカードは現在使用できません（対象不足など）');
        renderCardUI();
        return;
    }
    // ownerKey = who holds the card (victim when FATE_WILL); playerKey = network auth key.
    const ownerKey = actionPlayerKey;
    const usedCardEl = _findCardElementInOwnerHand(cardId, ownerKey);
    const usedCardRect = _snapshotElementRect(usedCardEl);
    const debugOptions = isDebugUnlimited ? { ignoreCost: true, noConsume: true } : null;
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('use_card', playerKey, { useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions })
        : { type: 'use_card', useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions };

    const result = _runCardPipelineActionOrLogFailure(playerKey, action, 'カード使用に失敗しました');
    if (!result) return;
    const skippedLocalExecution = !!(
        result && (
            result.skippedLocalExecution === true
            || (result.result && result.result.skippedLocalExecution === true)
        )
    );
    if (skippedLocalExecution && _handleServerAuthoredCardUse(playerKey, ownerKey, cardId, result)) {
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
    const primedCaptureReservedHandSlot = _primeCaptureReservedHandSlotState(result);
    const hasCardUsePlayback = _hasPlaybackEventType(result, 'card_use_animation');
    const willPlayDirectCardUseAnimation = !hasCardUsePlayback && !skippedLocalExecution && typeof playCardUseHandAnimation === 'function';

    // Direct animation fallback for browser reliability.
    if (willPlayDirectCardUseAnimation) {
        try {
            playCardUseHandAnimation({
                player: playerKey,
                owner: ownerKey,
                cardId,
                cost: Number.isFinite(cost) ? cost : null,
                name: cardDef ? cardDef.name : null,
                sourceCardEl: usedCardEl || null,
                sourceCardRect: usedCardRect || null
            }).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    const shouldDelayPostUseHandVisual = !!(cardDef && (cardDef.type === 'TREASURE_BOX' || cardDef.type === 'REBUILD_WILL' || cardDef.type === 'SUPPLY_WILL'))
        || _hasHandRemovePlaybackEvent(result);
    const entersBoardTargetSelection = _doesRunResultEnterBoardTargetSelectionForOwner(result, actionPlayerKey);
    if (entersBoardTargetSelection) {
        _armBoardTargetSelectionEntryPlaybackContext(result, actionPlayerKey);
    }
    const shouldDelayBoardForSelectionEntry = false;
    const shouldDelayPostUseBoardVisual = _hasBoardMutatingPlaybackEvent(result) || shouldDelayBoardForSelectionEntry;
    _finalizeCardActionUi({
        delayHandVisual: shouldDelayPostUseHandVisual,
        renderImmediately: primedCaptureReservedHandSlot,
        boardUpdateMode: 'playback-aware',
        delayBoardVisual: shouldDelayPostUseBoardVisual
    });
}

function passCurrentTurn() {
    const isAutoMode = _isAutoModeActive();
    if (isAutoMode) return;
    if (!_canInputPlayerActNow()) return;

    const playerKey = _resolveInputPlayerKey();
    // FATE_WILL: pending effect is on the victim's (turn owner's) key.
    const pendingCheckKey = _getFateWillTurnOwnerKeyForLocalController() || playerKey;
    const pending = (cardState && cardState.pendingEffectByPlayer)
        ? cardState.pendingEffectByPlayer[pendingCheckKey]
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

function cancelPendingSelection(specificPlayerKey: any) {
    if (!_canInputPlayerActNow()) return;
    const playerKey = specificPlayerKey || _resolveInputPlayerKey();
    // FATE_WILL: pending effect is on the victim's key, not the controller's key.
    const fateWillVictimKey = specificPlayerKey ? null : _getFateWillTurnOwnerKeyForLocalController();
    const pendingCheckKey = fateWillVictimKey || playerKey;

    const pending = cardState.pendingEffectByPlayer[pendingCheckKey];
    if (!pending || pending.stage !== 'selectTarget') return;
    if (!_isCancellablePendingSelectionForCardUi(pending.type)) return;

    const isDebugUnlimited = _isDebugUnlimitedUsage();
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
    } else if (pending.type === 'DESTROY_ONE_STONE') {
        addLog(`${playerKey === 'black' ? '黒' : '白'}の破壊の意志をキャンセルしました`);
    } else {
        addLog(`${playerKey === 'black' ? '黒' : '白'}の対象選択をキャンセルしました`);
    }
    renderCardUI();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    else if (typeof renderBoard === 'function') renderBoard();
}

function cancelPendingDestroy(specificPlayerKey: any) {
    cancelPendingSelection(specificPlayerKey);
}

// Export functions to global window scope for event binding (onclick in HTML etc)
window.fillDebugHand = fillDebugHand;
window.updateCardDetailPanel = updateCardDetailPanel;
window.onCardClick = onCardClick;
window.destroySelectedHandCard = destroySelectedHandCard;
window.useSelectedCard = useSelectedCard;
window.toggleCardDetailExpanded = toggleCardDetailExpanded;
window.passCurrentTurn = passCurrentTurn;
window.cancelPendingDestroy = cancelPendingDestroy;
window.cancelPendingSelection = cancelPendingSelection;

_initCardDetailLandscapeAnchorSync();
_bindCardDetailTagAutoDismiss();

export = {
    fillDebugHand,
    updateCardDetailPanel,
    onCardClick,
    destroySelectedHandCard,
    useSelectedCard,
    toggleCardDetailExpanded,
    passCurrentTurn,
    cancelPendingDestroy,
    cancelPendingSelection
};
