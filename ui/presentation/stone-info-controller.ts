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

function _getBoardValueConstantsForDiff() {
    const shared = SharedConstantsModuleForDiff;
    return {
        BLACK: shared && Number.isFinite(Number(shared.BLACK))
            ? Number(shared.BLACK)
            : ((typeof BLACK !== 'undefined') ? BLACK : 1),
        WHITE: shared && Number.isFinite(Number(shared.WHITE))
            ? Number(shared.WHITE)
            : ((typeof WHITE !== 'undefined') ? WHITE : -1),
        EMPTY: shared && Number.isFinite(Number(shared.EMPTY))
            ? Number(shared.EMPTY)
            : ((typeof EMPTY !== 'undefined') ? EMPTY : 0)
    };
}

function _getBoardShapeForDiff(gameState: any) {
    const board = (gameState && Array.isArray(gameState.board)) ? gameState.board : null;
    let rows = Array.isArray(board) ? board.length : 8;
    let cols = 0;
    if (Array.isArray(board)) {
        for (const row of board) {
            if (Array.isArray(row)) cols = Math.max(cols, row.length);
        }
    }
    if (!Number.isInteger(rows) || rows <= 0) rows = 8;
    if (!Number.isInteger(cols) || cols <= 0) cols = 8;
    return { rows, cols };
}

function _normalizeBoardShapeInputForDiff(shapeOrGameState: any) {
    const rows = Number(shapeOrGameState && shapeOrGameState.rows);
    const cols = Number(shapeOrGameState && shapeOrGameState.cols);
    if (Number.isFinite(rows) && Number.isFinite(cols)) {
        return {
            rows: Math.max(1, Math.trunc(rows)),
            cols: Math.max(1, Math.trunc(cols))
        };
    }
    return _getBoardShapeForDiff(shapeOrGameState);
}

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

function _isMainBoardCellForDiff(row: any, col: any, shapeOrGameState?: any) {
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < shape.rows && col >= 0 && col < shape.cols;
}

function _resolveExpansionSideForDiff(side: any, row: any, col: any, shapeOrGameState: any) {
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (sharedBoardUtils && typeof sharedBoardUtils.resolveExpansionSide === 'function') {
        const resolved = sharedBoardUtils.resolveExpansionSide(side, row, col, shapeOrGameState);
        if (resolved) return resolved;
    }
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (col === -1) return 'left';
    if (col === shape.cols) return 'right';
    if (row === -1) return 'top';
    if (row === shape.rows) return 'bottom';
    return null;
}

function _isExpansionCoordinateForDiff(row: any, col: any, shapeOrGameState: any) {
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (sharedBoardUtils && typeof sharedBoardUtils.isExpansionCoordinate === 'function') {
        return !!sharedBoardUtils.isExpansionCoordinate(row, col, shapeOrGameState);
    }
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (row < -1 || row > shape.rows || col < -1 || col > shape.cols) return false;
    if (_isMainBoardCellForDiff(row, col, shape)) return false;
    return true;
}

function _getExpansionDescriptorsForDiff(gameState: any): any[] {
    const boardShape = _getBoardShapeForDiff(gameState);
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (sharedBoardUtils && typeof sharedBoardUtils.collectExpansionDescriptors === 'function') {
        return sharedBoardUtils.collectExpansionDescriptors(expansion, gameState);
    }

    const out: any[] = [];
    const pushDescriptor = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = boardShape.cols;
            if (!Number.isInteger(row) && side === 'top') row = -1;
            if (!Number.isInteger(row) && side === 'bottom') row = boardShape.rows;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = boardShape.cols;
            if (side === 'top') row = -1;
            if (side === 'bottom') row = boardShape.rows;
        }

        if (!_isExpansionCoordinateForDiff(row, col, boardShape)) return;
        if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
        const constants = _getBoardValueConstantsForDiff();
        out.push({
            row,
            col,
            side: _resolveExpansionSideForDiff(side, row, col, boardShape),
            owner: (owner === constants.BLACK || owner === constants.WHITE) ? owner : constants.EMPTY
        });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushDescriptor(cell);
        }
    }

    if (out.length === 0 && expansion.active === true) {
        pushDescriptor(expansion);
    }

    return out;
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
    _stoneInfoPanelRefs = null;
    return panel;
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
    const panel = _ensureStoneInfoPanel();
    if (!panel) return null;
    if (
        _stoneInfoPanelRefs &&
        _stoneInfoPanelRefs.panel === panel &&
        _stoneInfoPanelRefs.name &&
        _stoneInfoPanelRefs.desc &&
        _stoneInfoPanelRefs.meta &&
        _stoneInfoPanelRefs.panel.isConnected
    ) {
        return _stoneInfoPanelRefs;
    }
    const name = panel.querySelector('#stone-info-name');
    const desc = panel.querySelector('#stone-info-desc');
    const meta = panel.querySelector('#stone-info-meta');
    if (!name || !desc || !meta) return null;
    _bindStoneInfoMetaBadgeEvents(meta);
    _stoneInfoPanelRefs = { panel, name, desc, meta };
    return _stoneInfoPanelRefs;
}

const STONE_INFO_IDLE_STATE = {
    name: '石情報',
    desc: '石をタップまたはホバーして表示'
};

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

function _showIdleStoneInfoPanel() {
    const refs = _getStoneInfoPanelRefs();
    if (!refs) return;
    refs.name.textContent = STONE_INFO_IDLE_STATE.name;
    _renderDiffTermText(refs.desc, STONE_INFO_IDLE_STATE.desc);
    _renderStoneInfoMetaBadges(refs.meta, []);
    refs.panel.classList.add('visible');
    refs.panel.setAttribute('aria-hidden', 'false');
    refs.panel.setAttribute('data-stone-info-state', 'idle');
    refs.panel.style.removeProperty('left');
    refs.panel.style.removeProperty('top');
}

function _hideStoneInfoPanel() {
    _closeStoneInfoTagPanel();
    const panel = _ensureStoneInfoPanel();
    if (!panel) return;
    if (panel.getAttribute('data-stone-info-state') === 'content' && panel.classList.contains('visible')) {
        panel.setAttribute('aria-hidden', 'false');
        return;
    }
    _showIdleStoneInfoPanel();
}

function _isStoneInfoPanelVisible() {
    if (typeof document === 'undefined') return false;
    const panel = document.getElementById('stone-info-panel');
    return !!(panel && panel.classList.contains('visible'));
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
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
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
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
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

    if (_isMainBoardCellForDiff(row, col)) {
        const board = (state && Array.isArray(state.board)) ? state.board : null;
        const rowValues = board && Array.isArray(board[row]) ? board[row] : null;
        const value = Number(rowValues ? rowValues[col] : NaN);
        if (value === black || value === white) return value;
        return null;
    }

    const expansion = _getExpansionDescriptorsForDiff(state).find((cell) => (
        cell && _isSameBoardCoord(cell.row, cell.col, row, col)
    ));
    if (!expansion) return null;
    const owner = Number(expansion.owner);
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
    const cardStateValue = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
        ? cardState
        : null;
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

function showSpecialStoneInfoAt(row: any, col: any, options?: any) {
    _closeStoneInfoTagPanel();
    const preserveOnEmpty = !!(options && options.preserveOnEmpty);
    const keepOrHideEmpty = () => {
        if (preserveOnEmpty && _isStoneInfoPanelVisible()) return false;
        _hideStoneInfoPanel();
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

    refs.panel.classList.add('visible');
    refs.panel.setAttribute('aria-hidden', 'false');
    refs.panel.setAttribute('data-stone-info-state', 'content');
    refs.panel.style.removeProperty('left');
    refs.panel.style.removeProperty('top');

    return true;
}

let _outsideCloseHandlerBound = false;

function _ensureOutsideCloseHandler() {
    if (_outsideCloseHandlerBound || typeof document === 'undefined') return;
    _outsideCloseHandlerBound = true;
    if (StoneInfoPanelModule && typeof StoneInfoPanelModule.attachStoneInfoPanelDismissHandlers === 'function') {
        StoneInfoPanelModule.attachStoneInfoPanelDismissHandlers(document, {
            bindTagAutoDismiss: _bindStoneInfoTagAutoDismiss,
            hideStoneInfoPanel: _hideStoneInfoPanel
        });
        return;
    }
    _bindStoneInfoTagAutoDismiss();
}

function getStoneInfoPresentationCapabilities() {
  return Object.freeze({
    showIdleStoneInfoPanel: _showIdleStoneInfoPanel,
    ensureOutsideCloseHandler: _ensureOutsideCloseHandler,
    showSpecialStoneInfoAt
  });
}

export = { getStoneInfoPresentationCapabilities, showSpecialStoneInfoAt };
