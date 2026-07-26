/** Non-board stone information presentation shared by Pixi and DOM compatibility input. */

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;

declare const gameState: any;

declare const cardState: any;

declare const MarkersAdapter: any;

declare const BLACK: number;

declare const WHITE: number;

declare const EMPTY: number;

let activePreparedVisualStateForDiff: { gameState: any; cardState: any } | null = null;

var SpecialStoneRegistryModule: any = null;

if (typeof require === 'function') {
    try { SpecialStoneRegistryModule = require('../../shared/special-stone-registry'); } catch (e: any) { /* ignore */ }
}

var StoneStatusSnapshotModule: any = null;

if (typeof require === 'function') {
    try { StoneStatusSnapshotModule = require('../../shared/stone-status-snapshot'); } catch (e: any) { /* ignore */ }
}

var SharedBoardUtilsModule: any = null;

if (typeof require === 'function') {
    try { SharedBoardUtilsModule = require('../../shared/shared-board-utils'); } catch (e: any) { /* ignore */ }
}

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getSpecialStoneRegistryForDiff() {
    if (SpecialStoneRegistryModule) return SpecialStoneRegistryModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SpecialStoneRegistry || null;
}

function _getStoneStatusSnapshotForDiff() {
    if (StoneStatusSnapshotModule) return StoneStatusSnapshotModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.StoneStatusSnapshot || null;
}

function _getSharedBoardUtilsForDiff() {
    if (SharedBoardUtilsModule) return SharedBoardUtilsModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SharedBoardUtils || null;
}


var SharedConstantsModuleForDiff: any = null;

if (typeof _require === 'function') {
    try { SharedConstantsModuleForDiff = _require('../../shared-constants'); } catch (e: any) { /* ignore */ }
}

if (!SharedConstantsModuleForDiff) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SharedConstants) {
            SharedConstantsModuleForDiff = (globalThis as any).SharedConstants;
        }
    } catch (e: any) { /* ignore */ }
}

var StoneInfoPanelModule: any = null;

if (typeof require === 'function') {
    try { StoneInfoPanelModule = require('./stone-info-panel'); } catch (e: any) { /* ignore */ }
}

var AppearanceResolverModule: any = null;

if (typeof require === 'function') {
    try { AppearanceResolverModule = require('../pixi/appearance-resolver'); } catch (e: any) { /* ignore */ }
}

var TextTermHighlighterModule: any = null;

if (typeof require === 'function') {
    try { TextTermHighlighterModule = require('../text-term-highlighter'); } catch (e: any) { /* ignore */ }
}

function _resolveNetworkVisualStateStoreForDiff() {
    try {
        if (typeof window !== 'undefined' && (window as any).NetworkVisualStateStore) {
            return (window as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkVisualStateStore) {
            return (globalThis as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveNetworkVisualRenderSnapshotForDiff() {
    const store = _resolveNetworkVisualStateStoreForDiff();
    try {
        const snapshot = store && typeof store.peekRenderSnapshot === 'function'
            ? store.peekRenderSnapshot()
            : (store && typeof store.getRenderSnapshot === 'function' ? store.getRenderSnapshot() : null);
        if (snapshot && snapshot.gameState && snapshot.cardState) return snapshot;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveGameStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.gameState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.gameState) return visualSnapshot.gameState;
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object') return window.gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object') return (globalThis as any).gameState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveCardStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.cardState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.cardState) return visualSnapshot.cardState;
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') {
            return (globalThis as any).cardState;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

const STONE_INFO_TAG_MEANINGS: Record<string, string> = Object.freeze({
    '多動状態': '両者ターン開始時にマス移動する状態。',
    '反転回避': '反転されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。移動先で挟める列があれば、その石の色で反転する。',
    '破壊回避': '破壊されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。空きマスがなければ回避できない。移動先で挟める列があれば、その石の色で反転する。',
    '復活': '失われた時に元の色や状態へ戻る。',
    '残りターン': 'この石状態や特殊石効果が残っているターン数。',
    '特殊石': '通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。',
    '抹消': 'そのマスの石を取り除きます。\n完全保護や反転保護でも防げません。',
    '穴マス': 'マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。',
    '絶対執行': '盤界の執行者専用の抹消。全ての保護を貫通して特殊石を穴マスにする。',
    '顕現石': '特殊カードによって盤面に現れる、特殊石とは別分類の不可侵石。',
    '繁殖生成石': '繁殖の意志でそのターンに新規生成された通常石。次の同一所有者ターン開始まで小さめの双葉表示になる。',
    '幽体': '反転・石破壊の対象にはなるが、その石自身は受けない。交換の意志の対象外。誘惑・捕獲は受け流し、入替や他の効果は通常どおり受ける。',
    '不可侵': '顕現石や特殊カードを、通常のカード効果や手札効果の対象から外す特殊カード固有の保護。',
    '反転保護': '反転されない。挟める列ごと無効化する。',
    '守る意志適用中': '守る意志または守護神の完全保護が重なっている。',
    '通常石': '通常の石。配置時に挟んだ列を反転できる。'
});

let _stoneInfoTagPanelRefs: any = null;

let _stoneInfoTagPanelState: { open: boolean; key: string | null } = {
    open: false,
    key: null
};

let _stoneInfoTagAutoDismissBound = false;

let _stoneInfoPanelRefs: any = null;

let _stoneInfoListRefs: any = null;

function _isBoardHiddenTrap(marker: any) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _normalizeSpecialStoneInfoType(rawType: any) {
    if (!rawType) return null;
    const registry = _getSpecialStoneRegistryForDiff();
    if (registry && typeof registry.normalizeSpecialStoneType === 'function') {
        return registry.normalizeSpecialStoneType(rawType);
    }
    return String(rawType).toUpperCase();
}

function _getSpecialStoneInfoForDiff(rawType: any) {
    const type = _normalizeSpecialStoneInfoType(rawType);
    if (!type) return null;
    const registry = _getSpecialStoneRegistryForDiff();
    if (registry && typeof registry.getSpecialStoneInfo === 'function') {
        return registry.getSpecialStoneInfo(type);
    }
    return null;
}

function _createSpecialStoneStatusSnapshotForDiff(input: any, options: any) {
    const snapshotModule = _getStoneStatusSnapshotForDiff();
    if (snapshotModule && typeof snapshotModule.createSpecialStoneStatusSnapshot === 'function') {
        return snapshotModule.createSpecialStoneStatusSnapshot(input, options);
    }
    return null;
}

function _buildSpecialStoneStatusTagsForDiff(inputs: any, options: any) {
    const snapshotModule = _getStoneStatusSnapshotForDiff();
    if (snapshotModule && typeof snapshotModule.buildSpecialStoneStatusTags === 'function') {
        return snapshotModule.buildSpecialStoneStatusTags(inputs, options);
    }
    return (options && options.includeSpecialStone === false) ? [] : ['特殊石'];
}

function _normalizeBoardCoord(value: any) {
    const num = Number(value);
    return Number.isInteger(num) ? num : null;
}

function _isSameBoardCoord(rowA: any, colA: any, rowB: any, colB: any) {
    const aRow = _normalizeBoardCoord(rowA);
    const aCol = _normalizeBoardCoord(colA);
    const bRow = _normalizeBoardCoord(rowB);
    const bCol = _normalizeBoardCoord(colB);
    return aRow !== null && aCol !== null && bRow !== null && bCol !== null && aRow === bRow && aCol === bCol;
}

function _ensureStoneInfoPanel() {
    if (typeof document === 'undefined') return null;
    const panel = StoneInfoPanelModule && typeof StoneInfoPanelModule.ensureStoneInfoPanel === 'function'
        ? StoneInfoPanelModule.ensureStoneInfoPanel(document)
        : null;
    _stoneInfoListRefs = null;
    return panel;
}

function _ensureStoneInfoDetailPanel() {
    if (typeof document === 'undefined') return null;
    const detail = StoneInfoPanelModule && typeof StoneInfoPanelModule.ensureStoneInfoDetailPanel === 'function'
        ? StoneInfoPanelModule.ensureStoneInfoDetailPanel(document)
        : null;
    if (!_stoneInfoPanelRefs || _stoneInfoPanelRefs.root !== detail) _stoneInfoPanelRefs = null;
    return detail;
}

function _bindStoneInfoMetaBadgeEvents(metaEl: any) {
    if (!metaEl || metaEl.dataset.boundBadgeClick === '1') return;
    metaEl.addEventListener('click', (event: any) => {
        const rawTarget = event ? (event.target as Element | null) : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);
        const chip = targetEl && typeof targetEl.closest === 'function'
            ? targetEl.closest('.stone-info-effect-tag-button')
            : null;
        if (!chip || !metaEl.contains(chip)) return;
        const badge = String(chip.getAttribute('data-badge') || '').trim();
        if (!badge) return;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        _toggleStoneInfoTagPanel(badge);
    });
    metaEl.dataset.boundBadgeClick = '1';
}

function _getStoneInfoPanelRefs() {
    const root = _ensureStoneInfoDetailPanel();
    if (!root) return null;
    if (
        _stoneInfoPanelRefs &&
        _stoneInfoPanelRefs.root === root &&
        _stoneInfoPanelRefs.name &&
        _stoneInfoPanelRefs.desc &&
        _stoneInfoPanelRefs.meta &&
        _stoneInfoPanelRefs.image &&
        _stoneInfoPanelRefs.root.isConnected
    ) {
        return _stoneInfoPanelRefs;
    }
    const name = root.querySelector('#stone-info-name');
    const desc = root.querySelector('#stone-info-desc');
    const meta = root.querySelector('#stone-info-meta');
    const image = root.querySelector('#stone-info-detail-image');
    const backdrop = document.getElementById('stone-info-detail-backdrop');
    if (!name || !desc || !meta || !image || !backdrop) return null;
    _bindStoneInfoMetaBadgeEvents(meta);
    _stoneInfoPanelRefs = { root, name, desc, meta, image, backdrop };
    return _stoneInfoPanelRefs;
}

function _getStoneInfoListRefs() {
    const panel = _ensureStoneInfoPanel();
    if (!panel) return null;
    if (
        _stoneInfoListRefs &&
        _stoneInfoListRefs.panel === panel &&
        _stoneInfoListRefs.title &&
        _stoneInfoListRefs.instruction &&
        _stoneInfoListRefs.list &&
        _stoneInfoListRefs.panel.isConnected
    ) {
        return _stoneInfoListRefs;
    }
    const title = panel.querySelector('#stone-info-list-title');
    const instruction = panel.querySelector('#stone-info-list-instruction');
    const list = panel.querySelector('#stone-info-list');
    if (!title || !instruction || !list) return null;
    _stoneInfoListRefs = { panel, title, instruction, list };
    return _stoneInfoListRefs;
}

function _renderDiffTermText(targetEl: any, text: any): void {
    if (!targetEl) return;
    if (TextTermHighlighterModule && typeof TextTermHighlighterModule.renderTextWithGameTermHighlights === 'function') {
        TextTermHighlighterModule.renderTextWithGameTermHighlights(targetEl, String(text || ''), {
            documentRef: targetEl.ownerDocument || (typeof document !== 'undefined' ? document : null),
            preserveLineBreaks: true
        });
        return;
    }
    targetEl.textContent = String(text || '');
}

function _hideStoneInfoDetailPanel() {
    _closeStoneInfoTagPanel();
    const refs = _getStoneInfoPanelRefs();
    if (!refs) return;
    refs.root.classList.remove('is-open');
    refs.root.setAttribute('aria-hidden', 'true');
    refs.backdrop.classList.remove('is-open');
    refs.backdrop.setAttribute('aria-hidden', 'true');
}

function _isStoneInfoDetailPanelVisible() {
    if (typeof document === 'undefined') return false;
    const panel = document.getElementById('stone-info-detail-panel');
    return !!(panel && panel.classList.contains('is-open'));
}

function _ensureStoneInfoTagPanel() {
    if (typeof document === 'undefined') return null;
    if (_stoneInfoTagPanelRefs && _stoneInfoTagPanelRefs.root && _stoneInfoTagPanelRefs.root.isConnected) {
        return _stoneInfoTagPanelRefs;
    }

    let root = document.getElementById('stone-info-tag-panel');
    if (!root) {
        root = document.createElement('div');
        root.id = 'stone-info-tag-panel';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'false');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div id="stone-info-tag-header">',
            '  <div id="stone-info-tag-title">詳細</div>',
            '  <button id="stone-info-tag-close-btn" type="button" aria-label="閉じる">×</button>',
            '</div>',
            '<div id="stone-info-tag-body"></div>'
        ].join('');
        document.body.appendChild(root);
    }

    _stoneInfoTagPanelRefs = {
        root,
        title: root.querySelector('#stone-info-tag-title'),
        body: root.querySelector('#stone-info-tag-body'),
        closeBtn: root.querySelector('#stone-info-tag-close-btn')
    };

    if (_stoneInfoTagPanelRefs.closeBtn && _stoneInfoTagPanelRefs.closeBtn.dataset.bound !== '1') {
        _stoneInfoTagPanelRefs.closeBtn.addEventListener('click', () => {
            _closeStoneInfoTagPanel();
        });
        _stoneInfoTagPanelRefs.closeBtn.dataset.bound = '1';
    }

    return _stoneInfoTagPanelRefs;
}

function _closeStoneInfoTagPanel() {
    const refs = _ensureStoneInfoTagPanel();
    if (!refs || !refs.root) return;
    refs.root.classList.remove('is-open');
    refs.root.setAttribute('aria-hidden', 'true');
    _stoneInfoTagPanelState = { open: false, key: null };
}

function _resolveStoneInfoTagMeaningKey(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return '';
    if (key.startsWith('反転回避')) return '反転回避';
    if (key.startsWith('破壊回避')) return '破壊回避';
    if (key.startsWith('復活')) return '復活';
    if (/^残り\d+(?:ターン|T)$/.test(key)) return '残りターン';
    return key;
}

function _toggleStoneInfoTagPanel(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return false;

    const isSame = _stoneInfoTagPanelState.open && _stoneInfoTagPanelState.key === key;
    if (isSame) {
        _closeStoneInfoTagPanel();
        return false;
    }

    const refs = _ensureStoneInfoTagPanel();
    if (!refs || !refs.root || !refs.title || !refs.body) return false;
    const meaningKey = _resolveStoneInfoTagMeaningKey(key);
    const meaning = STONE_INFO_TAG_MEANINGS[meaningKey] || `${key}の説明は未登録です。`;
    refs.title.textContent = key;
    refs.body.textContent = meaning;
    refs.root.classList.add('is-open');
    refs.root.setAttribute('aria-hidden', 'false');
    _stoneInfoTagPanelState = { open: true, key };
    return true;
}

function _bindStoneInfoTagAutoDismiss() {
    if (_stoneInfoTagAutoDismissBound || typeof document === 'undefined') return;
    _stoneInfoTagAutoDismissBound = true;

    document.addEventListener('pointerdown', (event: PointerEvent) => {
        if (!_stoneInfoTagPanelState.open) return;

        const rawTarget = event ? (event.target as Element | null) : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);

        if (targetEl && typeof targetEl.closest === 'function') {
            if (targetEl.closest('#stone-info-tag-panel')) return;
            if (targetEl.closest('#stone-info-meta')) return;
        }

        _closeStoneInfoTagPanel();
    }, true);
}

function _renderStoneInfoMetaBadges(metaEl: any, badges: any) {
    if (!metaEl) return;
    metaEl.textContent = '';

    const normalizedBadges = Array.from(new Set(
        (Array.isArray(badges) ? badges : [])
            .map((badge) => String(badge || '').trim())
            .filter((badge) => !!badge)
    ));

    if (!normalizedBadges.length) {
        metaEl.classList.add('is-empty');
        metaEl.removeAttribute('aria-label');
        _closeStoneInfoTagPanel();
        return;
    }

    metaEl.setAttribute('aria-label', '石効果タグ');
    metaEl.classList.remove('is-empty');
    for (const badge of normalizedBadges) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stone-info-effect-tag stone-info-effect-tag-button';
        chip.textContent = badge;
        chip.setAttribute('data-badge', badge);
        chip.setAttribute('aria-label', `${badge}の説明を表示`);
        metaEl.appendChild(chip);
    }
}

function _getMarkerKinds() {
    return (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', MANIFEST_STONE: 'manifestStone', BOMB: 'bomb' };
}

function _getMarkerEntriesAt(row: any, col: any) {
    const cardStateValue = _resolveCardStateForDiffRender();
    const markers = cardStateValue && Array.isArray(cardStateValue.markers) ? cardStateValue.markers : [];
    const kinds = _getMarkerKinds();
    const entries = [];

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.SPECIAL_STONE) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        if (_isBoardHiddenTrap(marker)) continue;
        entries.push({ kind: kinds.SPECIAL_STONE, marker });
    }

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.MANIFEST_STONE) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        entries.push({ kind: kinds.MANIFEST_STONE, marker });
    }

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.BOMB) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        entries.push({ kind: kinds.BOMB, marker });
    }

    return entries;
}

function _hasGuardMarkerAt(row: any, col: any) {
    const cardStateValue = _resolveCardStateForDiffRender();
    const markers = cardStateValue && Array.isArray(cardStateValue.markers) ? cardStateValue.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === _getMarkerKinds().SPECIAL_STONE &&
        _isSameBoardCoord(m.row, m.col, row, col) &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function _getEntryType(entry: any) {
    if (!entry || !entry.marker) return null;
    if (entry.kind === (_getMarkerKinds().BOMB)) {
        const bombType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : 'TIME_BOMB';
        return _normalizeSpecialStoneInfoType(bombType);
    }
    const markerType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : null;
    return _normalizeSpecialStoneInfoType(markerType);
}

function _isOverlayOnlyMarkerEntryForDiff(entry: any) {
    const type = _getEntryType(entry);
    return type === 'LIVING_WILL';
}

function _createEntryStatusInputForDiff(entry: any, hasGuard: any) {
    if (!entry || !entry.marker) return null;
    const type = _getEntryType(entry);
    if (!type) return null;
    const data = entry.marker.data || {};
    const isBomb = entry.kind === _getMarkerKinds().BOMB;
    return {
        kind: entry.kind,
        marker: entry.marker,
        type,
        timer: isBomb ? data.remainingTurns : data.remainingOwnerTurns,
        regenRemaining: data.regenRemaining,
        flipEvadeRemaining: data.flipEvadeRemaining,
        destroyEvadeRemaining: data.destroyEvadeRemaining,
        hasGuard: !!hasGuard
    };
}

function _buildSpecialStoneBadges(entries: any, hasGuard: any, primaryInput: any) {
    const resolvedEntries = Array.isArray(entries) ? entries : [];
    const statusInputs = resolvedEntries
        .map((entry) => _createEntryStatusInputForDiff(entry, false))
        .filter((input) => !!input);
    const rawPrimary = primaryInput || (statusInputs.length > 0 ? statusInputs[0] : null);
    const primary = rawPrimary ? Object.assign({}, rawPrimary, { hasGuard: !!hasGuard }) : null;
    return _buildSpecialStoneStatusTagsForDiff(statusInputs, {
        hasGuard,
        primary,
        livingWillAura: resolvedEntries.some((entry) => _isOverlayOnlyMarkerEntryForDiff(entry))
    });
}

const NORMAL_STONE_INFO = {
    black: {
        name: '黒石',
        desc: '通常の石。配置時に挟んだ列を反転できる。'
    },
    white: {
        name: '白石',
        desc: '通常の石。配置時に挟んだ列を反転できる。'
    }
};

const BREEDING_SPROUT_STONE_INFO = {
    black: {
        name: '黒石（繁殖生成）',
        desc: '繁殖の意志でこのターンに生成された石。次の同一所有者ターン開始まで「小さめ + 双葉」で表示される。石としての挙動は通常石と同じ。'
    },
    white: {
        name: '白石（繁殖生成）',
        desc: '繁殖の意志でこのターンに生成された石。次の同一所有者ターン開始まで「小さめ + 双葉」で表示される。石としての挙動は通常石と同じ。'
    }
};

function _getStoneOwnerAt(row: any, col: any) {
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const state = _resolveGameStateForDiffRender();
    if (!state) return null;
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (
        !sharedBoardUtils
        || typeof sharedBoardUtils.createBoardContext !== 'function'
        || typeof sharedBoardUtils.getCellValue !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext APIs are required by stone-info-controller');
    }
    const context = sharedBoardUtils.createBoardContext(state, _resolveCardStateForDiffRender());
    const owner = Number(sharedBoardUtils.getCellValue(context, Number(row), Number(col)));
    return owner === black || owner === white ? owner : null;
}

function _getNormalStoneInfo(row: any, col: any) {
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = _getStoneOwnerAt(row, col);
    if (owner === black) return NORMAL_STONE_INFO.black;
    if (owner === white) return NORMAL_STONE_INFO.white;
    return null;
}

function _getBreedingSproutOwnerKeyAt(row: any, col: any) {
    const cardStateValue = _resolveCardStateForDiffRender();
    if (!cardStateValue || typeof cardStateValue.breedingSproutByOwner !== 'object' || !cardStateValue.breedingSproutByOwner) {
        return null;
    }
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = _getStoneOwnerAt(row, col);
    if (owner !== black && owner !== white) return null;
    const ownerKey = owner === black ? 'black' : 'white';
    const positions = Array.isArray(cardStateValue.breedingSproutByOwner[ownerKey])
        ? cardStateValue.breedingSproutByOwner[ownerKey]
        : [];
    const isSprout = positions.some((point) => _isSameBoardCoord(point && point.row, point && point.col, row, col));
    return isSprout ? ownerKey : null;
}

function _getBreedingSproutStoneInfo(row: any, col: any) {
    const ownerKey = _getBreedingSproutOwnerKeyAt(row, col);
    if (ownerKey !== 'black' && ownerKey !== 'white') return null;
    return BREEDING_SPROUT_STONE_INFO[ownerKey] || null;
}

function _getCatalogSpecialType(cell: any) {
    const directType = _normalizeSpecialStoneInfoType(cell && cell.stone && cell.stone.specialType);
    if (directType) return directType;
    const markers = cell && Array.isArray(cell.markers) ? cell.markers : [];
    const primary = markers.find((marker: any) => (
        marker
        && marker.kind === 'special'
        && marker.data
        && marker.data.type
        && !_isOverlayOnlyMarkerEntryForDiff({ marker, kind: _getMarkerKinds().SPECIAL_STONE })
    ));
    if (primary) return _normalizeSpecialStoneInfoType(primary.data.type);
    const bomb = markers.find((marker: any) => marker && marker.kind === 'bomb');
    if (bomb) return _normalizeSpecialStoneInfoType(
        bomb.data && bomb.data.type ? bomb.data.type : 'TIME_BOMB'
    );
    const frozen = markers.find((marker: any) => marker && marker.kind === 'frozen');
    if (frozen) return 'FREEZE';
    return null;
}

function _hasCatalogMarker(cell: any, kind: string) {
    const markers = cell && Array.isArray(cell.markers) ? cell.markers : [];
    return markers.some((marker: any) => marker && marker.kind === kind);
}

function _resolveCatalogStoneImageUrl(frame: any, specialType: any, ownerKey: string) {
    const appearance = frame && frame.appearance ? frame.appearance : {};
    const fallback = ownerKey === 'white'
        ? String(appearance.whiteStoneImageUrl || '')
        : String(appearance.blackStoneImageUrl || '');
    if (!specialType || specialType === 'BREEDING_SPROUT') return fallback;
    if (
        AppearanceResolverModule
        && typeof AppearanceResolverModule.resolveSpecialStoneAppearanceResource === 'function'
    ) {
        try {
            const root = typeof window !== 'undefined' ? window : null;
            const resource = AppearanceResolverModule.resolveSpecialStoneAppearanceResource(
                root,
                specialType,
                ownerKey,
                typeof document !== 'undefined' ? document.baseURI : undefined
            );
            if (resource && resource.url) return String(resource.url);
        } catch (e: any) { /* the normal stone image remains a visible fallback */ }
    }
    return fallback;
}

function _getCatalogStoneName(specialType: any, ownerKey: string) {
    if (specialType === 'BREEDING_SPROUT') {
        return ownerKey === 'white'
            ? BREEDING_SPROUT_STONE_INFO.white.name
            : BREEDING_SPROUT_STONE_INFO.black.name;
    }
    if (specialType) {
        const info = _getSpecialStoneInfoForDiff(specialType);
        return info && info.name ? String(info.name) : String(specialType);
    }
    return ownerKey === 'white' ? NORMAL_STONE_INFO.white.name : NORMAL_STONE_INFO.black.name;
}

function renderCurrentStoneInfoPanel(frame: any) {
    const refs = _getStoneInfoListRefs();
    if (!refs) return false;
    refs.title.textContent = '盤上の石';
    refs.instruction.textContent = '石を選ぶと情報を表示';
    refs.panel.classList.add('visible');
    refs.panel.setAttribute('aria-hidden', 'false');

    const cells = frame && frame.model && Array.isArray(frame.model.cells)
        ? frame.model.cells
        : [];
    const groups = new Map<string, any>();
    for (const cell of cells) {
        if (!cell || !cell.stone) continue;
        const ownerKey = cell.stone.owner === 'white' ? 'white' : 'black';
        let specialType = _getCatalogSpecialType(cell);
        if (!specialType && _hasCatalogMarker(cell, 'breeding-sprout')) {
            specialType = 'BREEDING_SPROUT';
        }
        const key = specialType
            ? `special:${specialType}:${ownerKey}`
            : `normal:${ownerKey}`;
        const existing = groups.get(key);
        if (existing) {
            existing.count += 1;
            continue;
        }
        groups.set(key, {
            key,
            row: Number(cell.row),
            col: Number(cell.col),
            ownerKey,
            specialType,
            name: _getCatalogStoneName(specialType, ownerKey),
            imageUrl: _resolveCatalogStoneImageUrl(frame, specialType, ownerKey),
            count: 1
        });
    }

    const entries = Array.from(groups.values());
    const signature = JSON.stringify(entries.map((entry: any) => [
        entry.key,
        entry.row,
        entry.col,
        entry.count,
        entry.imageUrl
    ]));
    if (refs.list.getAttribute('data-stone-list-signature') === signature) return true;
    refs.list.setAttribute('data-stone-list-signature', signature);
    refs.list.textContent = '';

    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'stone-info-list-empty';
        empty.textContent = '盤上に石はありません';
        refs.list.appendChild(empty);
        return true;
    }

    for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stone-info-list-item';
        button.setAttribute('aria-label', `${entry.name}の情報を表示（盤上に${entry.count}個）`);
        button.setAttribute('data-stone-catalog-key', entry.key);
        if (entry.specialType === 'BREEDING_SPROUT') {
            button.classList.add('stone-info-list-item--sprout');
        }

        const visual = document.createElement('span');
        visual.className = 'stone-info-list-visual';
        const image = document.createElement('img');
        image.className = 'stone-info-list-image';
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        if (entry.imageUrl) image.src = entry.imageUrl;
        visual.appendChild(image);
        if (entry.specialType === 'BREEDING_SPROUT') {
            const sprout = document.createElement('span');
            sprout.className = 'stone-info-list-sprout';
            sprout.textContent = '♧';
            sprout.setAttribute('aria-hidden', 'true');
            visual.appendChild(sprout);
        }
        if (entry.count > 1) {
            const count = document.createElement('span');
            count.className = 'stone-info-list-count';
            count.textContent = `×${entry.count}`;
            count.setAttribute('aria-hidden', 'true');
            visual.appendChild(count);
        }

        const label = document.createElement('span');
        label.className = 'stone-info-list-label';
        label.textContent = entry.name;
        button.appendChild(visual);
        button.appendChild(label);
        button.addEventListener('click', () => {
            showSpecialStoneInfoAt(entry.row, entry.col, { imageUrl: entry.imageUrl });
        });
        refs.list.appendChild(button);
    }
    _ensureDetailDismissHandlers();
    return true;
}

function showSpecialStoneInfoAt(row: any, col: any, options?: any) {
    _closeStoneInfoTagPanel();
    const keepOrHideEmpty = () => {
        if (_isStoneInfoDetailPanelVisible()) _hideStoneInfoDetailPanel();
        return false;
    };
    const entries = _getMarkerEntriesAt(row, col);
    const entry = entries.find((one) => !_isOverlayOnlyMarkerEntryForDiff(one)) || null;
    let info: any = null;
    const badges = [];
    if (entry) {
        const type = _getEntryType(entry);
        if (!type) {
            return keepOrHideEmpty();
        }

        const hasGuard = _hasGuardMarkerAt(row, col);
        const primaryInput = _createEntryStatusInputForDiff(entry, hasGuard);
        const primarySnapshot = primaryInput
            ? _createSpecialStoneStatusSnapshotForDiff(primaryInput, { mode: 'info' })
            : null;
        info = primarySnapshot
            ? { name: primarySnapshot.name, desc: primarySnapshot.description }
            : (_getSpecialStoneInfoForDiff(type) || { name: type, desc: '効果情報は未登録です。' });
        badges.push(..._buildSpecialStoneBadges(entries, hasGuard, primaryInput));
    } else {
        const sproutInfo = _getBreedingSproutStoneInfo(row, col);
        if (sproutInfo) {
            info = sproutInfo;
            badges.push('繁殖生成石');
        } else {
            info = _getNormalStoneInfo(row, col);
            if (!info) {
                return keepOrHideEmpty();
            }
            if (entries.length > 0) {
                badges.push(..._buildSpecialStoneBadges(entries, _hasGuardMarkerAt(row, col), null));
            }
            badges.push('通常石');
        }
    }

    const refs = _getStoneInfoPanelRefs();
    if (!refs) return false;

    refs.name.textContent = info.name;
    _renderDiffTermText(refs.desc, info.desc);
    _renderStoneInfoMetaBadges(refs.meta, badges);
    const imageUrl = String(options && options.imageUrl || '').trim();
    if (imageUrl) {
        refs.image.src = imageUrl;
        refs.image.hidden = false;
    } else {
        refs.image.removeAttribute('src');
        refs.image.hidden = true;
    }
    refs.root.classList.add('is-open');
    refs.root.setAttribute('aria-hidden', 'false');
    refs.backdrop.classList.add('is-open');
    refs.backdrop.setAttribute('aria-hidden', 'false');
    _ensureDetailDismissHandlers();
    try { refs.root.focus({ preventScroll: true }); } catch (e: any) { refs.root.focus(); }

    return true;
}

let _outsideCloseHandlerBound = false;

function _ensureDetailDismissHandlers() {
    if (_outsideCloseHandlerBound || typeof document === 'undefined') return;
    _outsideCloseHandlerBound = true;
    if (StoneInfoPanelModule && typeof StoneInfoPanelModule.attachStoneInfoDetailDismissHandlers === 'function') {
        StoneInfoPanelModule.attachStoneInfoDetailDismissHandlers(document, {
            hideStoneInfoDetailPanel: _hideStoneInfoDetailPanel
        });
    }
    _bindStoneInfoTagAutoDismiss();
}

function getStoneInfoPresentationCapabilities() {
  return Object.freeze({
    renderCurrentStoneInfoPanel,
    hideStoneInfoDetailPanel: _hideStoneInfoDetailPanel,
    showSpecialStoneInfoAt
  });
}

export = {
    getStoneInfoPresentationCapabilities,
    renderCurrentStoneInfoPanel,
    showSpecialStoneInfoAt
};
