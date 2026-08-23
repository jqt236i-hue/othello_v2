/** Non-board stone information presentation shared by Pixi and DOM compatibility input. */

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;
const RuntimeStateAccessModule = _require('../runtime-state-access');
const BoardVisualRenderStateSourceModule = _require('../board-visual/render-state-source');

declare const gameState: any;

declare const cardState: any;

declare const MarkersAdapter: any;

declare const BLACK: number;

declare const WHITE: number;

declare const EMPTY: number;

let BoardVisualRenderStateSourceForDiff: any = BoardVisualRenderStateSourceModule
  .createBoardVisualRenderStateSource({
    getVisualStore: () => null,
    getPresentationTimeline: () => null,
    getLocalPair: () => ({
      gameState: RuntimeStateAccessModule.resolveCurrentRuntimeObject('gameState', () => {
        try { return (typeof gameState !== 'undefined') ? gameState : null; }
        catch (e: any) { return null; }
      }),
      cardState: RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState', () => {
        try { return (typeof cardState !== 'undefined') ? cardState : null; }
        catch (e: any) { return null; }
      }) || {}
    })
  });

function configureBoardVisualRenderStateSource(source: any) {
    if (!source || typeof source.resolvePair !== 'function') {
        throw new Error('Stone info controller requires a board render-state source');
    }
    BoardVisualRenderStateSourceForDiff = source;
    return source;
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

var MarkersAdapterModuleForDiff: any = null;

if (typeof require === 'function') {
    try { MarkersAdapterModuleForDiff = require('../../game/logic/markers_adapter'); } catch (e: any) { /* ignore */ }
}

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getSpecialStoneRegistryForDiff() {
    const globalScope = _getGlobalScopeForDiff();
    if (globalScope.SpecialStoneRegistry) return globalScope.SpecialStoneRegistry;
    return SpecialStoneRegistryModule || null;
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

function _getMarkersAdapterForDiff() {
    if (MarkersAdapterModuleForDiff) return MarkersAdapterModuleForDiff;
    try {
        if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter) return MarkersAdapter;
    } catch (e: any) { /* ignore */ }
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.MarkersAdapter || null;
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

function _resolveGameStateForDiffRender() {
    return BoardVisualRenderStateSourceForDiff.resolvePair().gameState;
}

function _resolveCardStateForDiffRender() {
    return BoardVisualRenderStateSourceForDiff.resolvePair().cardState;
}

const STONE_INFO_TAG_MEANINGS: Record<string, string> = Object.freeze({
    '多動状態': '両者ターン開始時にマス移動する状態。',
    '反転回避': '反転されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。移動先で挟める列があれば、その石の色で反転する。',
    '破壊回避': '破壊されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。空きマスがなければ回避できない。移動先で挟める列があれば、その石の色で反転する。',
    '復活': '失われた時に元の色や状態へ戻る。',
    '残りターン': 'この石状態や特殊石効果が残っているターン数。',
    '特殊石': '通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。',
    '特殊マス': '石とは別に盤面へ残るマス効果。封鎖・凍結・種・毒・灼熱・治癒・流星穴が含まれる。',
    '毒状態': '毒マスによって石へ付く状態。残りターンが0になると通常の破壊を受け、完全保護で解除される。',
    '灼熱カウント': '灼熱マス上で同じ石が居続けられる残りターン。0になると通常の破壊を受ける。',
    '抹消': 'そのマスの石を取り除きます。\n完全保護や反転無効でも防げません。',
    '穴マス': 'マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。',
    '絶対執行': '盤界の執行者専用の抹消。不可侵以外の保護を貫通して特殊石を穴マスにする。',
    '顕現石': '特殊カードによって盤面に現れる、特殊石とは別分類の不可侵石。',
    '繁殖生成石': '繁殖の意志でそのターンに新規生成された通常石。次の同一所有者ターン開始まで小さめの双葉表示になる。',
    '幽体': '反転・石破壊の対象にはなるが、その石自身は受けない。交換の意志の対象外。誘惑・捕獲は受け流し、入替や他の効果は通常どおり受ける。',
    '不可侵': '顕現石や森羅万象神を、反転・破壊・状態付与・抹消・絶対執行など盤面干渉効果の対象から外す保護。',
    '反転無効': '反転されない。挟める列ごと無効化する。',
    '完全保護': '石に対する敵対的・強制的な効果を無効化する。セルそのものを消す効果は貫通する。',
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
        _stoneInfoPanelRefs.content &&
        _stoneInfoPanelRefs.visual &&
        _stoneInfoPanelRefs.image &&
        _stoneInfoPanelRefs.marker &&
        _stoneInfoPanelRefs.root.isConnected
    ) {
        return _stoneInfoPanelRefs;
    }
    const name = root.querySelector('#stone-info-name');
    const desc = root.querySelector('#stone-info-desc');
    const meta = root.querySelector('#stone-info-meta');
    const content = root.querySelector('#stone-info-detail-content');
    const visual = root.querySelector('#stone-info-detail-visual');
    const image = root.querySelector('#stone-info-detail-image');
    const marker = root.querySelector('#stone-info-detail-marker');
    const backdrop = document.getElementById('stone-info-detail-backdrop');
    if (!name || !desc || !meta || !content || !visual || !image || !marker || !backdrop) return null;
    _bindStoneInfoMetaBadgeEvents(meta);
    _stoneInfoPanelRefs = { root, name, desc, meta, content, visual, image, marker, backdrop };
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
    if (key.startsWith('毒状態')) return '毒状態';
    if (key.startsWith('灼熱カウント')) return '灼熱カウント';
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

    metaEl.setAttribute('aria-label', '効果タグ');
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
    const markersAdapter = _getMarkersAdapterForDiff();
    return (markersAdapter && markersAdapter.MARKER_KINDS)
        ? markersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', MANIFEST_STONE: 'manifestStone', BOMB: 'bomb' };
}

function _getMarkerEntriesAt(row: any, col: any) {
    const cardStateValue = _resolveCardStateForDiffRender();
    const markers = cardStateValue && Array.isArray(cardStateValue.markers) ? cardStateValue.markers : [];
    const kinds = _getMarkerKinds();
    const entries = [];
    const markersAdapter = _getMarkersAdapterForDiff();
    const specialStoneRegistry = _getSpecialStoneRegistryForDiff();
    const markerOccupiesCell = (
        specialStoneRegistry
        && typeof specialStoneRegistry.markerOccupiesCell === 'function'
    )
        ? specialStoneRegistry.markerOccupiesCell
        : (
            markersAdapter
            && typeof markersAdapter.markerOccupiesCell === 'function'
                ? markersAdapter.markerOccupiesCell
                : null
        );

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.SPECIAL_STONE) continue;
        const occupiesCell = markerOccupiesCell
            ? markerOccupiesCell(marker, row, col)
            : _isSameBoardCoord(marker.row, marker.col, row, col);
        if (!occupiesCell) continue;
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

const BOARD_MARKER_TYPE_BY_FRAME_KIND_FOR_DIFF: Record<string, string> = Object.freeze({
    blockade: 'BLOCKADE',
    frozen: 'FREEZE',
    seed: 'SEED',
    'poison-cell': 'POISON_CELL',
    'scorched-cell': 'SCORCHED_CELL',
    'healing-cell': 'HEALING_CELL'
});

const BOARD_MARKER_CATALOG_VISUALS_FOR_DIFF: Record<string, any> = Object.freeze({
    BLOCKADE: Object.freeze({ token: 'blockade', symbol: '封', imageUrl: 'assets/images/other/X.png' }),
    METEOR_HOLE: Object.freeze({ token: 'meteor-hole', symbol: '穴', imageUrl: '' }),
    FREEZE: Object.freeze({ token: 'freeze', symbol: '凍', imageUrl: 'assets/images/other/ICE.png' }),
    SEED: Object.freeze({ token: 'seed', symbol: '種', imageUrl: 'assets/images/other/seed.png' }),
    POISON_CELL: Object.freeze({ token: 'poison-cell', symbol: '毒', imageUrl: '' }),
    SCORCHED_CELL: Object.freeze({ token: 'scorched-cell', symbol: '灼', imageUrl: '' }),
    HEALING_CELL: Object.freeze({ token: 'healing-cell', symbol: '癒', imageUrl: '' })
});

function _normalizeFrameMarkerKindForDiff(rawKind: any): string {
    return String(rawKind || '').trim().toLowerCase().replace(/_/g, '-');
}

function _isBoardMarkerTypeForDiff(rawType: any): boolean {
    const type = _normalizeSpecialStoneInfoType(rawType);
    if (!type) return false;
    const registry = _getSpecialStoneRegistryForDiff();
    if (!registry || typeof registry.isBoardMarkerType !== 'function') {
        throw new Error('SpecialStoneRegistry.isBoardMarkerType is required by stone-info-controller');
    }
    return registry.isBoardMarkerType(type) === true;
}

function _getBoardMarkerTypeFromFrameMarkerForDiff(marker: any): string | null {
    if (!marker) return null;
    const kind = _normalizeFrameMarkerKindForDiff(marker.kind);
    const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
    const directType = _normalizeSpecialStoneInfoType(data.type);
    if (directType && _isBoardMarkerTypeForDiff(directType)) return directType;
    const inferredType = _normalizeSpecialStoneInfoType(BOARD_MARKER_TYPE_BY_FRAME_KIND_FOR_DIFF[kind]);
    return inferredType && _isBoardMarkerTypeForDiff(inferredType) ? inferredType : null;
}

function _getMarkerDurationValueForDiff(rawType: any, markerData: any): number | null {
    const type = _normalizeSpecialStoneInfoType(rawType);
    const data = markerData && typeof markerData === 'object' ? markerData : {};
    const registry = _getSpecialStoneRegistryForDiff();
    if (registry && typeof registry.getMarkerDurationValue === 'function') {
        const duration = registry.getMarkerDurationValue(type, data);
        return duration === null || duration === undefined ? null : Number(duration);
    }
    const raw = data.remainingTurns ?? data.remainingOwnerTurns;
    const value = Number(raw);
    return raw === null || raw === undefined || raw === '' || !Number.isFinite(value)
        ? null
        : Math.max(0, Math.trunc(value));
}

function _getBoardMarkerCatalogVisualForDiff(rawType: any) {
    const type = _normalizeSpecialStoneInfoType(rawType);
    return (type && BOARD_MARKER_CATALOG_VISUALS_FOR_DIFF[type])
        || { token: 'board-marker', symbol: 'マス', imageUrl: '' };
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
    const registryDuration = _getMarkerDurationValueForDiff(type, data);
    return {
        kind: entry.kind,
        marker: entry.marker,
        type,
        timer: registryDuration !== null
            ? registryDuration
            : (isBomb ? data.remainingTurns : data.remainingOwnerTurns),
        regenRemaining: data.regenRemaining,
        flipEvadeRemaining: data.flipEvadeRemaining,
        destroyEvadeRemaining: data.destroyEvadeRemaining,
        hasGuard: !!hasGuard
    };
}

function _buildSpecialStoneBadges(entries: any, hasGuard: any, primaryInput: any, options?: any) {
    const resolvedEntries = Array.isArray(entries) ? entries : [];
    const statusInputs = resolvedEntries
        .map((entry) => _createEntryStatusInputForDiff(entry, false))
        .filter((input) => !!input);
    const rawPrimary = primaryInput || (statusInputs.length > 0 ? statusInputs[0] : null);
    const primary = rawPrimary ? Object.assign({}, rawPrimary, { hasGuard: !!hasGuard }) : null;
    return _buildSpecialStoneStatusTagsForDiff(statusInputs, {
        hasGuard,
        primary,
        livingWillAura: resolvedEntries.some((entry) => _isOverlayOnlyMarkerEntryForDiff(entry)),
        includeSpecialStone: !(options && options.includeSpecialStone === false)
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
        && !_isBoardHiddenTrap({ data: marker.data })
        && !_isOverlayOnlyMarkerEntryForDiff({ marker, kind: _getMarkerKinds().SPECIAL_STONE })
    ));
    if (primary) return _normalizeSpecialStoneInfoType(primary.data.type);
    const bomb = markers.find((marker: any) => marker && marker.kind === 'bomb');
    if (bomb) return _normalizeSpecialStoneInfoType(
        bomb.data && bomb.data.type ? bomb.data.type : 'TIME_BOMB'
    );
    return null;
}

function _hasCatalogMarker(cell: any, kind: string) {
    const markers = cell && Array.isArray(cell.markers) ? cell.markers : [];
    return markers.some((marker: any) => marker && marker.kind === kind);
}

const STONE_STATUS_TYPE_BY_FRAME_KIND_FOR_DIFF: Record<string, string> = Object.freeze({
    guard: 'GUARD',
    'living-will-aura': 'LIVING_WILL',
    poisoned: 'POISONED',
    scorched: 'SCORCHED'
});

function _getStoneStatusTypeFromFrameMarkerForDiff(marker: any): string | null {
    if (!marker) return null;
    const kind = _normalizeFrameMarkerKindForDiff(marker.kind);
    const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
    const directType = _normalizeSpecialStoneInfoType(
        data.type || (kind === 'special' ? marker.value : null)
    );
    if (directType) return directType;
    if (kind === 'bomb') return 'TIME_BOMB';
    return _normalizeSpecialStoneInfoType(STONE_STATUS_TYPE_BY_FRAME_KIND_FOR_DIFF[kind]);
}

function _createCatalogStatusInputFromFrameMarkerForDiff(marker: any): any {
    const type = _getStoneStatusTypeFromFrameMarkerForDiff(marker);
    if (!type || _isBoardMarkerTypeForDiff(type) || type === 'TRAP') return null;
    const kind = _normalizeFrameMarkerKindForDiff(marker.kind);
    const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
    const timer = _getMarkerDurationValueForDiff(type, data);
    return Object.assign({}, data, {
        kind: kind === 'bomb' ? _getMarkerKinds().BOMB : _getMarkerKinds().SPECIAL_STONE,
        type,
        timer: timer !== null
            ? timer
            : (kind === 'bomb' ? data.remainingTurns : data.remainingOwnerTurns)
    });
}

function _createCatalogStoneDetailForDiff(cell: any, specialType: any, ownerKey: string) {
    const markers = cell && Array.isArray(cell.markers) ? cell.markers : [];
    const statusInputs = markers
        .map((marker: any) => _createCatalogStatusInputFromFrameMarkerForDiff(marker))
        .filter((input: any) => !!input);
    const normalizedType = _normalizeSpecialStoneInfoType(specialType);
    let primaryInput = normalizedType && normalizedType !== 'BREEDING_SPROUT'
        ? statusInputs.find((input: any) => input.type === normalizedType) || null
        : null;
    if (normalizedType && normalizedType !== 'BREEDING_SPROUT') {
        const stoneStatus = cell && cell.stone && cell.stone.status && typeof cell.stone.status === 'object'
            ? cell.stone.status
            : {};
        const nestedSpecial = stoneStatus.special && typeof stoneStatus.special === 'object'
            ? stoneStatus.special
            : {};
        const combined = Object.assign({}, stoneStatus, nestedSpecial, primaryInput || {}, {
            type: normalizedType
        });
        const duration = _getMarkerDurationValueForDiff(normalizedType, combined);
        if (duration !== null) combined.timer = duration;
        primaryInput = combined;
        const primaryIndex = statusInputs.findIndex((input: any) => input.type === normalizedType);
        if (primaryIndex >= 0) {
            statusInputs[primaryIndex] = primaryInput;
        } else {
            statusInputs.unshift(primaryInput);
        }
    }
    const hasGuard = statusInputs.some((input: any) => input.type === 'GUARD');
    const livingWillAura = statusInputs.some((input: any) => input.type === 'LIVING_WILL');
    return {
        subjectKind: 'stone',
        type: normalizedType,
        ownerKey,
        isSprout: normalizedType === 'BREEDING_SPROUT',
        primaryInput,
        statusInputs,
        hasGuard,
        livingWillAura
    };
}

function _createCatalogBoardMarkerDetailForDiff(marker: any, rawType: any) {
    const type = _normalizeSpecialStoneInfoType(rawType);
    const data = marker && marker.data && typeof marker.data === 'object' ? marker.data : {};
    const markerData = Object.assign({}, data, { type });
    const duration = _getMarkerDurationValueForDiff(type, markerData);
    const primaryInput = Object.assign({}, markerData, {
        kind: _getMarkerKinds().SPECIAL_STONE,
        type,
        timer: duration
    });
    return {
        subjectKind: 'board-marker',
        type,
        ownerKey: marker && marker.owner ? String(marker.owner) : null,
        sourcePlayer: markerData.sourcePlayer || null,
        visualVariant: markerData.visualVariant || null,
        duration,
        primaryInput,
        statusInputs: [primaryInput],
        hasGuard: false,
        livingWillAura: false
    };
}

function _buildCatalogDetailSignatureForDiff(detail: any): string {
    if (!detail) return '';
    return JSON.stringify({
        subjectKind: detail.subjectKind,
        type: detail.type,
        ownerKey: detail.ownerKey,
        sourcePlayer: detail.sourcePlayer,
        visualVariant: detail.visualVariant,
        duration: detail.duration,
        isSprout: detail.isSprout,
        primaryInput: detail.primaryInput,
        statusInputs: detail.statusInputs,
        hasGuard: detail.hasGuard,
        livingWillAura: detail.livingWillAura
    });
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
    refs.title.textContent = '盤上の石・マス';
    refs.instruction.textContent = '石・マスを選ぶと情報を表示';
    refs.list.setAttribute('aria-label', '盤上の石・マス');
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
        const projectedSpecial = (
            cell.stone.status
            && cell.stone.status.special
            && typeof cell.stone.status.special === 'object'
        )
            ? cell.stone.status.special
            : null;
        if (
            specialType === 'SHINRA_BANSHO_GOD'
            && projectedSpecial
            && (
                Number(projectedSpecial.footprintRowOffset) !== 0
                || Number(projectedSpecial.footprintColOffset) !== 0
            )
        ) {
            continue;
        }
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
        const detail = _createCatalogStoneDetailForDiff(cell, specialType, ownerKey);
        groups.set(key, {
            key,
            row: Number(cell.row),
            col: Number(cell.col),
            subjectKind: 'stone',
            ownerKey,
            specialType,
            name: _getCatalogStoneName(specialType, ownerKey),
            imageUrl: _resolveCatalogStoneImageUrl(frame, specialType, ownerKey),
            visualKind: 'image',
            visualToken: '',
            visualSymbol: '',
            duration: null,
            detail,
            detailSignature: _buildCatalogDetailSignatureForDiff(detail),
            count: 1
        });
    }

    for (const cell of cells) {
        if (!cell) continue;
        const markers = Array.isArray(cell.markers) ? cell.markers : [];
        for (const marker of markers) {
            const specialType = _getBoardMarkerTypeFromFrameMarkerForDiff(marker);
            if (!specialType) continue;
            if (specialType === 'SEED' && cell.stone) continue;
            const detail = _createCatalogBoardMarkerDetailForDiff(marker, specialType);
            const durationKey = detail.duration === null ? 'no-timer' : String(detail.duration);
            const key = `board-marker:${specialType}:${durationKey}`;
            const existing = groups.get(key);
            if (existing) {
                existing.count += 1;
                continue;
            }
            const info = _getSpecialStoneInfoForDiff(specialType);
            const visual = _getBoardMarkerCatalogVisualForDiff(specialType);
            groups.set(key, {
                key,
                row: Number(cell.row),
                col: Number(cell.col),
                subjectKind: 'board-marker',
                ownerKey: detail.ownerKey,
                specialType,
                name: info && info.name ? String(info.name) : specialType,
                imageUrl: String(visual.imageUrl || ''),
                visualKind: visual.imageUrl ? 'image' : 'cell-tile',
                visualToken: String(visual.token || 'board-marker'),
                visualSymbol: String(visual.symbol || 'マス'),
                duration: detail.duration,
                detail,
                detailSignature: _buildCatalogDetailSignatureForDiff(detail),
                count: 1
            });
        }
    }

    const entries = Array.from(groups.values());
    const signature = JSON.stringify(entries.map((entry: any) => [
        entry.key,
        entry.row,
        entry.col,
        entry.count,
        entry.imageUrl,
        entry.visualKind,
        entry.visualToken,
        entry.duration,
        entry.detailSignature
    ]));
    if (refs.list.getAttribute('data-stone-list-signature') === signature) return true;
    refs.list.setAttribute('data-stone-list-signature', signature);
    refs.list.textContent = '';

    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'stone-info-list-empty';
        empty.textContent = '盤上に石・マスはありません';
        refs.list.appendChild(empty);
        return true;
    }

    for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stone-info-list-item';
        const durationLabel = entry.subjectKind === 'board-marker' && entry.duration !== null
            ? `、残り${entry.duration}ターン`
            : '';
        button.setAttribute('aria-label', `${entry.name}の情報を表示（盤上に${entry.count}個${durationLabel}）`);
        button.setAttribute('data-stone-catalog-key', entry.key);
        button.setAttribute('data-stone-catalog-subject', entry.subjectKind);
        if (entry.specialType === 'BREEDING_SPROUT') {
            button.classList.add('stone-info-list-item--sprout');
        }

        const visual = document.createElement('span');
        visual.className = 'stone-info-list-visual';
        if (entry.subjectKind === 'board-marker') {
            visual.classList.add(
                'stone-info-list-visual--board-marker',
                `stone-info-marker-visual--${entry.visualToken}`
            );
        }
        if (entry.imageUrl) {
            const image = document.createElement('img');
            image.className = 'stone-info-list-image';
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            image.src = entry.imageUrl;
            visual.appendChild(image);
        } else if (entry.subjectKind === 'board-marker') {
            const markerTile = document.createElement('span');
            markerTile.className = `stone-info-marker-tile stone-info-marker-tile--${entry.visualToken}`;
            markerTile.textContent = entry.visualSymbol;
            markerTile.setAttribute('aria-hidden', 'true');
            visual.appendChild(markerTile);
        }
        if (entry.specialType === 'BREEDING_SPROUT') {
            const sprout = document.createElement('span');
            sprout.className = 'stone-info-list-sprout';
            sprout.textContent = '♧';
            sprout.setAttribute('aria-hidden', 'true');
            visual.appendChild(sprout);
        }
        if (entry.subjectKind === 'board-marker' && entry.duration !== null) {
            const timer = document.createElement('span');
            timer.className = 'stone-info-list-marker-timer';
            timer.textContent = String(entry.duration);
            timer.setAttribute('aria-hidden', 'true');
            visual.appendChild(timer);
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
            showSpecialStoneInfoAt(entry.row, entry.col, {
                imageUrl: entry.imageUrl,
                catalogEntry: entry
            });
        });
        refs.list.appendChild(button);
    }
    _ensureDetailDismissHandlers();
    return true;
}

function _buildCatalogStatusBadgesForDiff(detail: any, includeSpecialStone: boolean): string[] {
    const statusInputs = detail && Array.isArray(detail.statusInputs) ? detail.statusInputs : [];
    const stoneOverlayInputs = statusInputs.filter((input: any) => (
        input && (input.type === 'POISONED' || input.type === 'SCORCHED')
    ));
    const sharedStatusInputs = statusInputs.filter((input: any) => (
        !input || (input.type !== 'POISONED' && input.type !== 'SCORCHED')
    ));
    const primary = detail && detail.primaryInput
        ? Object.assign({}, detail.primaryInput, { hasGuard: detail.hasGuard === true })
        : null;
    const badges = _buildSpecialStoneStatusTagsForDiff(sharedStatusInputs, {
        hasGuard: detail && detail.hasGuard === true,
        primary,
        livingWillAura: detail && detail.livingWillAura === true,
        includeSpecialStone
    });
    for (const input of stoneOverlayInputs) {
        const timer = input && input.timer !== null && input.timer !== undefined && Number.isFinite(Number(input.timer))
            ? Math.max(0, Math.trunc(Number(input.timer)))
            : null;
        const label = input.type === 'POISONED' ? '毒状態' : '灼熱カウント';
        badges.push(timer === null ? label : `${label} 残り${timer}T`);
    }
    return badges;
}

function _resolveCatalogEntryDetailForDiff(entry: any) {
    const detail = entry && entry.detail ? entry.detail : null;
    if (!detail) return null;
    const badges: string[] = [];
    let info: any = null;
    let detailBackgroundImage = '';
    if (detail.subjectKind === 'board-marker') {
        const snapshot = detail.primaryInput
            ? _createSpecialStoneStatusSnapshotForDiff(detail.primaryInput, { mode: 'info' })
            : null;
        const registryInfo = _getSpecialStoneInfoForDiff(detail.type);
        info = snapshot
            ? { name: snapshot.name, desc: snapshot.description }
            : (registryInfo || { name: String(detail.type || ''), desc: '効果情報は未登録です。' });
        badges.push('特殊マス');
        badges.push(..._buildCatalogStatusBadgesForDiff(detail, false));
        detailBackgroundImage = String(registryInfo && registryInfo.detailBackgroundImage || '').trim();
    } else if (detail.isSprout) {
        info = detail.ownerKey === 'white'
            ? BREEDING_SPROUT_STONE_INFO.white
            : BREEDING_SPROUT_STONE_INFO.black;
        badges.push('繁殖生成石');
    } else if (detail.type) {
        const snapshot = detail.primaryInput
            ? _createSpecialStoneStatusSnapshotForDiff(detail.primaryInput, { mode: 'info' })
            : null;
        const registryInfo = _getSpecialStoneInfoForDiff(detail.type);
        info = snapshot
            ? { name: snapshot.name, desc: snapshot.description }
            : (registryInfo || { name: String(detail.type), desc: '効果情報は未登録です。' });
        badges.push(..._buildCatalogStatusBadgesForDiff(detail, true));
        detailBackgroundImage = String(registryInfo && registryInfo.detailBackgroundImage || '').trim();
    } else {
        info = detail.ownerKey === 'white' ? NORMAL_STONE_INFO.white : NORMAL_STONE_INFO.black;
        badges.push(..._buildCatalogStatusBadgesForDiff(detail, true));
        badges.push('通常石');
    }
    return { info, badges, detailBackgroundImage };
}

function _renderStoneInfoDetailVisualForDiff(refs: any, entry: any, rawImageUrl: any) {
    const imageUrl = String(rawImageUrl || '').trim();
    const isBoardMarker = !!(entry && entry.subjectKind === 'board-marker');
    const visualToken = String(entry && entry.visualToken || 'board-marker');
    const visualSymbol = String(entry && entry.visualSymbol || 'マス');
    refs.image.removeAttribute('src');
    refs.image.hidden = true;
    refs.marker.className = 'stone-info-marker-tile';
    refs.marker.textContent = '';
    refs.marker.hidden = true;

    let hasVisual = false;
    if (imageUrl) {
        refs.image.src = imageUrl;
        refs.image.hidden = false;
        hasVisual = true;
    } else if (isBoardMarker) {
        refs.marker.classList.add(
            `stone-info-marker-tile--${visualToken}`,
            'stone-info-marker-tile--detail'
        );
        refs.marker.textContent = visualSymbol;
        refs.marker.hidden = false;
        hasVisual = true;
    }
    refs.visual.hidden = !hasVisual;
    refs.content.classList.toggle('has-visual', hasVisual);
}

function showSpecialStoneInfoAt(row: any, col: any, options?: any) {
    _closeStoneInfoTagPanel();
    const keepOrHideEmpty = () => {
        if (_isStoneInfoDetailPanelVisible()) _hideStoneInfoDetailPanel();
        return false;
    };
    const catalogEntry = options && options.catalogEntry ? options.catalogEntry : null;
    const entries = catalogEntry ? [] : _getMarkerEntriesAt(row, col);
    const entry = catalogEntry
        ? null
        : (entries.find((one) => !_isOverlayOnlyMarkerEntryForDiff(one)) || null);
    let info: any = null;
    let detailBackgroundImage = '';
    const badges = [];
    if (catalogEntry) {
        const resolved = _resolveCatalogEntryDetailForDiff(catalogEntry);
        if (!resolved || !resolved.info) return keepOrHideEmpty();
        info = resolved.info;
        detailBackgroundImage = resolved.detailBackgroundImage;
        badges.push(...resolved.badges);
    } else if (entry) {
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
        const registryInfo = _getSpecialStoneInfoForDiff(type);
        detailBackgroundImage = String(registryInfo && registryInfo.detailBackgroundImage || '').trim();
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
    _renderStoneInfoDetailVisualForDiff(
        refs,
        catalogEntry,
        options && options.imageUrl
    );
    if (detailBackgroundImage) {
        let resolvedBackground = detailBackgroundImage;
        try {
            resolvedBackground = new URL(detailBackgroundImage, document.baseURI).href;
        } catch (e: any) { /* retain the canonical relative asset path */ }
        refs.root.style.setProperty('--stone-info-detail-background-image', `url("${resolvedBackground.replace(/"/g, '\\"')}")`);
        refs.root.classList.add('has-special-background');
    } else {
        refs.root.style.removeProperty('--stone-info-detail-background-image');
        refs.root.classList.remove('has-special-background');
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
    configureBoardVisualRenderStateSource,
    getStoneInfoPresentationCapabilities,
    renderCurrentStoneInfoPanel,
    showSpecialStoneInfoAt
};
