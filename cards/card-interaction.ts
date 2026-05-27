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
const _networkOnlyPendingSelectionPublishLocks: Record<string, boolean> = { black: false, white: false };
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
    '完全保護': '石に対する敵対的・強制的な効果を無効化。自分への強化・維持効果は受けられ、マス破壊は貫通する。',
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

function _getCardCostTierForCardUi(cost: any) {
    try {
        if (typeof getCardCostTier === 'function') {
            const tier = getCardCostTier(cost);
            if (tier) return tier;
        }
    } catch (e) { /* ignore */ }
    try {
        const helpers = _require('../shared/playback-event-helpers');
        if (helpers && typeof helpers.getCardCostTier === 'function') {
            const tier = helpers.getCardCostTier(cost);
            if (tier) return tier;
        }
    } catch (e) { /* ignore */ }
    const safeCost = Number.isFinite(Number(cost)) ? Number(cost) : 0;
    if (safeCost === 0) return 'white';
    if (safeCost >= 31) return 'special';
    if (safeCost >= 21) return 'gold';
    if (safeCost >= 16) return 'purple';
    if (safeCost >= 11) return 'blue';
    if (safeCost >= 6) return 'red';
    return 'gray';
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

const _cardInteractionPendingNetworkModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-pending-network'
});

const _cardInteractionClickBufferModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-click-buffer'
});

const _cardInteractionOverlaySelectionModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-overlay-selection'
});

const _cardInteractionOverlayViewModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-overlay-view'
});

const _cardInteractionDetailPanelModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-detail-panel'
});

const _cardInteractionDetailActionsModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-detail-actions'
});

const _cardInteractionDetailTabModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-detail-tab'
});

const _cardInteractionHandDomModule = _resolveCardInteractionModule({
    requirePath: './card-interaction-hand-dom'
});

function _getCardInteractionPendingNetworkDeps() {
    return {
        getUiRootRef: _getUiRootRef,
        readDirectWaitForPlaybackIdle: () => (typeof waitForPlaybackIdle === 'function' ? waitForPlaybackIdle : null),
        isCardAnimatingNow: _isCardAnimatingNow,
        isStaleVisualPlaybackLock: _isStaleVisualPlaybackLock,
        releaseStaleVisualPlaybackLock: _releaseStaleVisualPlaybackLock,
        renderCardUiSafely: _renderCardUiSafely,
        playbackStateManager: _playbackStateModule,
        setPendingSelectionBusy: _setPendingSelectionBusy,
        normalizeOwnerKey: _normalizeOwnerKey,
        publishLocks: _networkOnlyPendingSelectionPublishLocks
    };
}

function _getCardInteractionClickBufferDeps() {
    return {
        getUiRootRef: _getUiRootRef,
        normalizeOwnerKey: _normalizeOwnerKey
    };
}

function _getCardInteractionOverlaySelectionDeps() {
    return {
        getCardStateValue: () => cardState,
        getGameStateValue: () => gameState,
        pendingSelectionFlowModule: _pendingSelectionFlowModule,
        actionManager: (typeof ActionManager !== 'undefined') ? ActionManager : null,
        canInteractWithCardUi: _canInteractWithCardUi,
        setPendingSelectionBusy: _setPendingSelectionBusy,
        playUiEffectSound,
        resolveCardDef: (cardId: any) => ((typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(cardId)
            : null),
        startNetworkOnlyPendingSelectionPublish: _startNetworkOnlyPendingSelectionPublish,
        clearHeavenSelection: _clearHeavenSelection,
        hideHeavenOverlay: _hideHeavenOverlay,
        runPipelineAction: _runPipelineAction,
        addLog,
        renderCardUI: (typeof renderCardUI === 'function') ? renderCardUI : null,
        emitBoardUpdate: (typeof emitBoardUpdate === 'function') ? emitBoardUpdate : null,
        renderBoard: (typeof renderBoard === 'function') ? renderBoard : null,
        hasHandRemovePlaybackEvent: _hasHandRemovePlaybackEvent,
        renderCardUiWithOptionalPlaybackDelay: _renderCardUiWithOptionalPlaybackDelay,
        ensureCurrentPlayerCanActOrPass: (typeof ensureCurrentPlayerCanActOrPass === 'function') ? ensureCurrentPlayerCanActOrPass : null,
        ensureCurrentPlayerCanActOrPassSafely: _ensureCurrentPlayerCanActOrPassSafely,
        getRunResultPlaybackEvents: _getRunResultPlaybackEvents,
        getCardDisplayLabel: _getCardDisplayLabel
    };
}

function _getCardInteractionOverlayViewDeps() {
    return {
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        getWindowRef: () => (typeof window !== 'undefined' ? window : null),
        getOverlayRefs: () => _heavenOverlayRefs,
        setOverlayRefs: (refs: any) => { _heavenOverlayRefs = refs; },
        getCardStateValue: () => cardState,
        getHandLimit: () => ((typeof HAND_LIMIT !== 'undefined') ? HAND_LIMIT : 5),
        getHeavenSelection: (playerKey: any) => _heavenSelectionByPlayer[playerKey],
        setHeavenSelection: (playerKey: any, offerKey: any) => { _heavenSelectionByPlayer[playerKey] = offerKey; },
        resolveCardDef: (cardId: any) => ((typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(cardId)
            : null),
        getCardCostTier: _getCardCostTierForCardUi,
        getCardDisplayTypeKey: _getCardDisplayTypeKey,
        getCardDisplayLabel: _getCardDisplayLabel,
        fitCardNameForDisplay: _fitCardNameForDisplay,
        appendCardDisplayBadges: _appendCardDisplayBadges,
        getOverlayCardDescriptionText: _getOverlayCardDescriptionText,
        playUiEffectSound,
        executeHeavenSelection: _executeHeavenSelection,
        executeCondemnSelection: _executeCondemnSelection
    };
}

const _cardInteractionDetailPanel = (_cardInteractionDetailPanelModule && typeof _cardInteractionDetailPanelModule.createCardInteractionDetailPanel === 'function')
    ? _cardInteractionDetailPanelModule.createCardInteractionDetailPanel({
        effectsModule: _cardInteractionEffectsModule,
        getQuickCardEffect: _getQuickCardEffect,
        getDetailCardEffect: _getDetailCardEffect,
        resolveChargeMaxText: _resolveChargeMaxText,
        isHiddenHandToken: _isHiddenHandToken,
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        getCardStateValue: () => cardState,
        getGameStateValue: () => gameState,
        getCardLogic: () => ((typeof CardLogic !== 'undefined') ? CardLogic : null),
        getRiboWillUnlockTurnIndex: () => RIBO_WILL_UNLOCK_TURN_INDEX
    })
    : null;

const _cardInteractionDetailActions = (_cardInteractionDetailActionsModule && typeof _cardInteractionDetailActionsModule.createCardInteractionDetailActions === 'function')
    ? _cardInteractionDetailActionsModule.createCardInteractionDetailActions({
        isAutoModeActive: _isAutoModeActive,
        canInputPlayerActNow: _canInputPlayerActNow,
        isDebugUnlimitedUsage: _isDebugUnlimitedUsage,
        ensureHandDestroyFlags: _ensureHandDestroyFlags,
        hasPlayerUsedCardThisActiveTurn: _hasPlayerUsedCardThisActiveTurn,
        canInteractWithCardUi: _canInteractWithCardUi,
        isSelectionSettlementLocked: _isSelectionSettlementLocked,
        getCardDef: (cardId: any) => ((typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(cardId)
            : null),
        getCardStateValue: () => cardState,
        isSelectedCardUsableNow: _isSelectedCardUsableNow,
        getLegalMovesForCurrentPlayer: _getLegalMovesForCurrentPlayer,
        isVisualPlaybackRunningNow: _isVisualPlaybackRunningNow,
        isStaleVisualPlaybackLock: _isStaleVisualPlaybackLock,
        isReversiMode: _isReversiMode,
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        posToNotation: (row: any, col: any) => (typeof posToNotation === 'function'
            ? posToNotation(row, col)
            : `${Number(row)},${Number(col)}`)
    })
    : null;

const _cardInteractionDetailTab = (_cardInteractionDetailTabModule && typeof _cardInteractionDetailTabModule.createCardInteractionDetailTab === 'function')
    ? _cardInteractionDetailTabModule.createCardInteractionDetailTab({
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        getWindowRef: () => (typeof window !== 'undefined' ? window : null),
        getTabRefs: () => _cardDetailTabRefs,
        setTabRefs: (refs: any) => { _cardDetailTabRefs = refs; },
        getTabState: () => _cardDetailTabState,
        setTabState: (state: any) => { _cardDetailTabState = state; },
        setExpandedState: (open: any, cardId: any) => {
            _cardDetailExpanded = !!open;
            _cardDetailExpandedForCardId = open ? cardId : null;
        },
        getAutoDismissBound: () => _cardDetailTagAutoDismissBound,
        setAutoDismissBound: (bound: any) => { _cardDetailTagAutoDismissBound = !!bound; },
        updateCardDetailPanel
    })
    : null;

const _cardInteractionHandDom = (_cardInteractionHandDomModule && typeof _cardInteractionHandDomModule.createCardInteractionHandDom === 'function')
    ? _cardInteractionHandDomModule.createCardInteractionHandDom({
        normalizeOwnerKey: _normalizeOwnerKey,
        ownerHelpersModule: _ownerHelpersModule,
        handAnimationUtilsModule: _handAnimationUtilsModule,
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        getWindowRef: () => (typeof window !== 'undefined' ? window : null)
    })
    : null;

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
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.resolveCardDescriptionTextsForCardUi === 'function') {
        return _cardInteractionDetailPanel.resolveCardDescriptionTextsForCardUi(cardDef);
    }
    return { quickText: '', detailText: '', distinctDetailText: '', effectTags: [], numericTags: [] };
}

function _buildCardDetailDisplayModel(cardDef: any, ownerKey: any) {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.buildCardDetailDisplayModel === 'function') {
        return _cardInteractionDetailPanel.buildCardDetailDisplayModel(cardDef, ownerKey);
    }
    return { cardName: '-', summaryText: 'カードを選択してください', detailText: '', detailPanelText: '', liveStateText: '', tags: [] };
}

function _applyCardDetailDisplayModel(nameEl: any, descEl: any, detailStateEl: any, detailMoreEl: any, detailTagsEl: any, displayModel: any) {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.applyCardDetailDisplayModel === 'function') {
        _cardInteractionDetailPanel.applyCardDetailDisplayModel(nameEl, descEl, detailStateEl, detailMoreEl, detailTagsEl, displayModel);
        return;
    }
}

function _getOverlayCardDescriptionText(cardDef: any, cardId: any) {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.getOverlayCardDescriptionText === 'function') {
        return _cardInteractionDetailPanel.getOverlayCardDescriptionText(cardDef, cardId);
    }
    return _isHiddenHandToken(cardId) ? 'この対戦モードでは詳細は非公開です' : '説明なし';
}

function _ensureCardDetailEffectTagsElement() {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.ensureCardDetailEffectTagsElement === 'function') {
        return _cardInteractionDetailPanel.ensureCardDetailEffectTagsElement();
    }
    return null;
}

function _ensureCardDetailLiveStateElement() {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.ensureCardDetailLiveStateElement === 'function') {
        return _cardInteractionDetailPanel.ensureCardDetailLiveStateElement();
    }
    return null;
}

function _renderCardDetailLiveState(stateEl: any, text: any) {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.renderCardDetailLiveState === 'function') {
        _cardInteractionDetailPanel.renderCardDetailLiveState(stateEl, text);
    }
}

function _renderCardDetailEffectTags(tagsEl: any, tags: any) {
    if (_cardInteractionDetailPanel && typeof _cardInteractionDetailPanel.renderCardDetailEffectTags === 'function') {
        _cardInteractionDetailPanel.renderCardDetailEffectTags(tagsEl, tags);
    }
}

function _ensureCardDetailTabPanel() {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.ensureCardDetailTabPanel === 'function') {
        return _cardInteractionDetailTab.ensureCardDetailTabPanel();
    }
    return null;
}

function _closeCardDetailTabPanel() {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.closeCardDetailTabPanel === 'function') {
        _cardInteractionDetailTab.closeCardDetailTabPanel();
    }
}

function _openCardDetailTabPanel(payload: any) {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.openCardDetailTabPanel === 'function') {
        return _cardInteractionDetailTab.openCardDetailTabPanel(payload);
    }
    return false;
}

function _toggleCardDetailTabPanel(payload: any) {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.toggleCardDetailTabPanel === 'function') {
        return _cardInteractionDetailTab.toggleCardDetailTabPanel(payload);
    }
    return false;
}

function _isCardDetailTagTabOpen() {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.isCardDetailTagTabOpen === 'function') {
        return _cardInteractionDetailTab.isCardDetailTagTabOpen();
    }
    return false;
}

function _closeCardDetailTagTabIfOpen() {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.closeCardDetailTagTabIfOpen === 'function') {
        return _cardInteractionDetailTab.closeCardDetailTagTabIfOpen();
    }
    return false;
}

function _bindCardDetailTagAutoDismiss() {
    if (_cardInteractionDetailTab && typeof _cardInteractionDetailTab.bindCardDetailTagAutoDismiss === 'function') {
        _cardInteractionDetailTab.bindCardDetailTagAutoDismiss();
    }
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

function _isSelectionSettlementLocked() {
    if (_pendingSelectionFlowModule && typeof _pendingSelectionFlowModule.isSelectionSettlementLocked === 'function') {
        try {
            return _pendingSelectionFlowModule.isSelectionSettlementLocked() === true;
        } catch (e) { /* ignore */ }
    }
    return false;
}

function _getServerAuthoredCardUseClickBuffer() {
    if (_cardInteractionClickBufferModule && typeof _cardInteractionClickBufferModule.getServerAuthoredCardUseClickBuffer === 'function') {
        return _cardInteractionClickBufferModule.getServerAuthoredCardUseClickBuffer(_getCardInteractionClickBufferDeps());
    }
    return null;
}

function _beginServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any) {
    if (_cardInteractionClickBufferModule && typeof _cardInteractionClickBufferModule.beginServerAuthoredCardUseClickBuffer === 'function') {
        _cardInteractionClickBufferModule.beginServerAuthoredCardUseClickBuffer(playerKey, ownerKey, cardId, _getCardInteractionClickBufferDeps());
    }
}

function _consumeServerAuthoredCardUseClickBuffer(playerKey: any, ownerKey: any, cardId: any) {
    if (_cardInteractionClickBufferModule && typeof _cardInteractionClickBufferModule.consumeServerAuthoredCardUseClickBuffer === 'function') {
        return _cardInteractionClickBufferModule.consumeServerAuthoredCardUseClickBuffer(playerKey, ownerKey, cardId, _getCardInteractionClickBufferDeps());
    }
    return null;
}

function _clearServerAuthoredCardUseClickBuffer() {
    if (_cardInteractionClickBufferModule && typeof _cardInteractionClickBufferModule.clearServerAuthoredCardUseClickBuffer === 'function') {
        _cardInteractionClickBufferModule.clearServerAuthoredCardUseClickBuffer(_getCardInteractionClickBufferDeps());
    }
}

function _createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any) {
    if (_cardInteractionOverlaySelectionModule && typeof _cardInteractionOverlaySelectionModule.createPendingSelectionAction === 'function') {
        return _cardInteractionOverlaySelectionModule.createPendingSelectionAction(playerKey, pendingType, actionPayload, _getCardInteractionOverlaySelectionDeps());
    }
    return null;
}

function _finalizePendingSelectionAfterRun(playerKey: any, pendingType: any, runResult: any) {
    if (_cardInteractionOverlaySelectionModule && typeof _cardInteractionOverlaySelectionModule.finalizePendingSelectionAfterRun === 'function') {
        _cardInteractionOverlaySelectionModule.finalizePendingSelectionAfterRun(playerKey, pendingType, runResult, _getCardInteractionOverlaySelectionDeps());
    }
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
    if (_cardInteractionHandDom && typeof _cardInteractionHandDom.getOwnerHandContainers === 'function') {
        return _cardInteractionHandDom.getOwnerHandContainers(ownerKey);
    }
    return [];
}

function _queryOwnerHandElements(ownerKey: any, selector: any) {
    if (_cardInteractionHandDom && typeof _cardInteractionHandDom.queryOwnerHandElements === 'function') {
        return _cardInteractionHandDom.queryOwnerHandElements(ownerKey, selector);
    }
    return [];
}

function _findCardElementInOwnerHand(cardId: any, ownerKey: any) {
    if (_cardInteractionHandDom && typeof _cardInteractionHandDom.findCardElementInOwnerHand === 'function') {
        return _cardInteractionHandDom.findCardElementInOwnerHand(cardId, ownerKey);
    }
    return null;
}

function _settleLingeringHandFadeForOwner(ownerKey: any) {
    if (_cardInteractionHandDom && typeof _cardInteractionHandDom.settleLingeringHandFadeForOwner === 'function') {
        _cardInteractionHandDom.settleLingeringHandFadeForOwner(ownerKey);
    }
}

function _ensureHeavenOverlay() {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.ensureHeavenOverlay === 'function') {
        return _cardInteractionOverlayViewModule.ensureHeavenOverlay(_getCardInteractionOverlayViewDeps());
    }
    return null;
}

function _hideHeavenOverlay() {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.hideHeavenOverlay === 'function') {
        _cardInteractionOverlayViewModule.hideHeavenOverlay(_getCardInteractionOverlayViewDeps());
    }
}

function _positionHeavenOverlayNearBoard() {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.positionHeavenOverlayNearBoard === 'function') {
        _cardInteractionOverlayViewModule.positionHeavenOverlayNearBoard(_getCardInteractionOverlayViewDeps());
    }
}

function _getOverlayOfferKey(offer: any) {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.getOverlayOfferKey === 'function') {
        return _cardInteractionOverlayViewModule.getOverlayOfferKey(offer);
    }
    return String(offer || '');
}

function _resolveOverlayOfferByKey(offers: any, offerKey: any) {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.resolveOverlayOfferByKey === 'function') {
        return _cardInteractionOverlayViewModule.resolveOverlayOfferByKey(offers, offerKey);
    }
    return null;
}

function _renderHeavenOverlay(playerKey: any) {
    if (_cardInteractionOverlayViewModule && typeof _cardInteractionOverlayViewModule.renderHeavenOverlay === 'function') {
        _cardInteractionOverlayViewModule.renderHeavenOverlay(playerKey, _getCardInteractionOverlayViewDeps());
    }
}

function _executeHeavenSelection(playerKey: any, selectedCardId: any) {
    if (_cardInteractionOverlaySelectionModule && typeof _cardInteractionOverlaySelectionModule.executeHeavenSelection === 'function') {
        return _cardInteractionOverlaySelectionModule.executeHeavenSelection(playerKey, selectedCardId, _getCardInteractionOverlaySelectionDeps());
    }
    return { ok: false, reason: 'overlay_selection_unavailable' };
}

function _executeCondemnSelection(playerKey: any, targetIndex: any, targetCardId: any) {
    if (_cardInteractionOverlaySelectionModule && typeof _cardInteractionOverlaySelectionModule.executeCondemnSelection === 'function') {
        return _cardInteractionOverlaySelectionModule.executeCondemnSelection(playerKey, targetIndex, targetCardId, _getCardInteractionOverlaySelectionDeps());
    }
    return { ok: false, reason: 'overlay_selection_unavailable' };
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
    if (_isSelectionSettlementLocked()) return false;
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

function _ensureBoardPendingSelectionAfterCardUse(runResult: any, ownerKey: any, cardId: any, cardDef: any) {
    const normalizedOwnerKey = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!normalizedOwnerKey || !cardDef || typeof cardDef.type !== 'string') return false;

    const pendingType = String(cardDef.type || '').trim().toUpperCase();
    if (!pendingType || _isHandOverlayPendingTypeForCardUi(pendingType)) return false;

    const pendingStateManager = _getPendingStateManagerForCardUi();
    if (!pendingStateManager || typeof pendingStateManager.requiresTargetSelection !== 'function') return false;
    if (pendingStateManager.requiresTargetSelection(pendingType) !== true) return false;

    const stateRef = _getCardStateRef();
    if (!stateRef || typeof stateRef !== 'object') return false;
    if (!stateRef.pendingEffectByPlayer || typeof stateRef.pendingEffectByPlayer !== 'object') {
        stateRef.pendingEffectByPlayer = { black: null, white: null };
    }
    const currentPending = stateRef.pendingEffectByPlayer[normalizedOwnerKey];
    if (currentPending && currentPending.stage === 'selectTarget') return false;

    const nextCardState = _getRunResultNextCardState(runResult);
    const nextPending = (nextCardState && nextCardState.pendingEffectByPlayer)
        ? nextCardState.pendingEffectByPlayer[normalizedOwnerKey]
        : null;
    let pendingToApply = nextPending && nextPending.stage === 'selectTarget'
        ? nextPending
        : null;

    if (!pendingToApply && typeof pendingStateManager.createPendingEffectState === 'function') {
        pendingToApply = pendingStateManager.createPendingEffectState({
            cardType: pendingType,
            cardId,
            needsSelection: true
        });
    }
    if (!pendingToApply || pendingToApply.stage !== 'selectTarget') return false;

    stateRef.pendingEffectByPlayer[normalizedOwnerKey] = { ...pendingToApply };
    if (nextCardState && typeof nextCardState === 'object') {
        if (!nextCardState.pendingEffectByPlayer || typeof nextCardState.pendingEffectByPlayer !== 'object') {
            nextCardState.pendingEffectByPlayer = { black: null, white: null };
        }
        nextCardState.pendingEffectByPlayer[normalizedOwnerKey] = { ...pendingToApply };
    }
    return true;
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
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.getWaitForPlaybackIdleFn === 'function') {
        return _cardInteractionPendingNetworkModule.getWaitForPlaybackIdleFn(_getCardInteractionPendingNetworkDeps());
    }
    return null;
}

function _getTrackedWaitForPlaybackIdlePromise() {
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.getTrackedWaitForPlaybackIdlePromise === 'function') {
        return _cardInteractionPendingNetworkModule.getTrackedWaitForPlaybackIdlePromise(_getCardInteractionPendingNetworkDeps());
    }
    return null;
}

function _waitForCardUseAnimationIdle() {
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.waitForCardUseAnimationIdle === 'function') {
        return _cardInteractionPendingNetworkModule.waitForCardUseAnimationIdle(_getCardInteractionPendingNetworkDeps());
    }
    return Promise.resolve();
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
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.getActiveNetworkMatchClient === 'function') {
        return _cardInteractionPendingNetworkModule.getActiveNetworkMatchClient();
    }
    return null;
}

function _getNetworkMatchClientRoot(): CardInteractionRuntimeRoot | null {
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.getNetworkMatchClientRoot === 'function') {
        return _cardInteractionPendingNetworkModule.getNetworkMatchClientRoot();
    }
    return null;
}

function _startNetworkOnlyPendingSelectionPublish(options: any) {
    if (_cardInteractionPendingNetworkModule && typeof _cardInteractionPendingNetworkModule.startNetworkOnlyPendingSelectionPublish === 'function') {
        return _cardInteractionPendingNetworkModule.startNetworkOnlyPendingSelectionPublish(options, _getCardInteractionPendingNetworkDeps());
    }
    return false;
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
    if (_cardInteractionDetailActions && typeof _cardInteractionDetailActions.resolveCardDetailActionState === 'function') {
        return _cardInteractionDetailActions.resolveCardDetailActionState(selectionContext);
    }
    return {
        canActThisTurn: false,
        isDebugUnlimited: false,
        canInteract: false,
        selectedCardDef: null,
        cost: 0,
        canAfford: false,
        pending: null,
        isSelectingTarget: false,
        isHeavenSelecting: false,
        canUse: false,
        canDestroy: false,
        canShowPass: false,
        canPass: false,
        reason: ''
    };
}

function _syncReversiPassButton(actionState: any) {
    if (_cardInteractionDetailActions && typeof _cardInteractionDetailActions.syncReversiPassButton === 'function') {
        _cardInteractionDetailActions.syncReversiPassButton(actionState);
    }
}

function _getPendingSelectionPrompt(pending: any) {
    if (_cardInteractionDetailActions && typeof _cardInteractionDetailActions.getPendingSelectionPrompt === 'function') {
        return _cardInteractionDetailActions.getPendingSelectionPrompt(pending);
    }
    return '';
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
    if (!isDebugUnlimited && !_canInteractWithCardUi()) return;
    const playerKey = _resolveInputPlayerKey();
    const actionOwnerKey = _getCardUiActionOwnerKey(playerKey);
    const clickedOwnerKey = (ownerKey === 'white' || ownerKey === 'black')
        ? ownerKey
        : null;
    const stateRef = _getCardStateRef();
    const pending = stateRef && stateRef.pendingEffectByPlayer ? stateRef.pendingEffectByPlayer[actionOwnerKey] : null;

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
    _ensureBoardPendingSelectionAfterCardUse(result, actionPlayerKey, cardId, cardDef);
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
    if (_isSelectionSettlementLocked()) return;

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
    if (_isSelectionSettlementLocked()) return;
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
