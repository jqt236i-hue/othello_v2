/**
 * @file diff-renderer.js
 * @description 差分レンダリングシステム - Virtual DOM的なアプローチで盤面更新を最適化
 * Differential rendering system for optimized board updates
 */

/**
 * @typedef {Object} CellState
 * @property {number} value - セルの値 (BLACK=1, WHITE=-1, EMPTY=0)
 * @property {boolean} isLegal - 合法手かどうか
 * @property {boolean} isLegalFree - 自由配置可能かどうか
 * @property {boolean} isTabooLegal - 禁忌の反転で置けるかどうか
 * @property {boolean} isExtendLifeTarget - 延命カード選択対象かどうか
 * @property {boolean} isProtected - 一時保護されているか
 * @property {boolean} isPermaProtected - 永久保護されているか
 * @property {string|null} permaOwner - 永久保護の所有者 ('black'|'white'|null)
 * @property {Object|null} bomb - 爆弾情報 {remainingTurns: number}
 * @property {Object|null} dragon - 龍情報 {owner: number, remainingOwnerTurns: number}
 * @property {boolean} breedingSprout - 繁殖生成の1ターン草表示
 */

/**
 * 前回のレンダリング状態を保持
 * Stores previous render state for diff calculation
 * @type {Array<Array<CellState>>|null}
 */
let previousBoardState = null;

/**
 * DOM要素キャッシュ - セル要素の参照を保持
 * Cache of cell DOM elements for fast access
 * @type {Array<Array<HTMLElement>>}
 */
let cellCache = [];
let cellCacheMap = new Map();
let boardDomSignature = null;

function _isMainBoardCellForDiff(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
}

function _resolveExpansionSideForDiff(side, row, col) {
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (col === -1) return 'left';
    if (col === 8) return 'right';
    if (row === -1) return 'top';
    if (row === 8) return 'bottom';
    return null;
}

function _isExpansionCoordinateForDiff(row, col) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (row < -1 || row > 8 || col < -1 || col > 8) return false;
    if (_isMainBoardCellForDiff(row, col)) return false;
    return true;
}

function _applyExpansionCellPositionForDiff(cell, row, col) {
    if (!cell) return;

    if (row === -1) {
        cell.style.top = '-12.5%';
    } else if (row === 8) {
        cell.style.top = '100%';
    } else {
        cell.style.top = `${row * 12.5}%`;
    }

    if (col === -1) {
        cell.style.left = '-12.5%';
        cell.style.right = '';
    } else if (col === 8) {
        cell.style.left = '';
        cell.style.right = '-12.5%';
    } else {
        cell.style.left = `${col * 12.5}%`;
        cell.style.right = '';
    }

    cell.style.bottom = '';
}

function _getExpansionDescriptorsForDiff(gameState) {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];

    const out = [];
    const pushDescriptor = (source, legacyRow, legacyOwner) => {
        let side = null;
        let row = null;
        let col = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = 8;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = 8;
        }

        if (!_isExpansionCoordinateForDiff(row, col)) return;
        if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
        out.push({
            row,
            col,
            side: _resolveExpansionSideForDiff(side, row, col),
            owner: (owner === BLACK || owner === WHITE) ? owner : EMPTY
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

function _getExpansionDescriptorForDiff(gameState) {
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    return descriptors.length > 0 ? descriptors[0] : null;
}

function _getBoardDomSignatureForDiff(gameState) {
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    if (!descriptors.length) return 'base';
    const tokens = descriptors
        .map((desc) => `${desc.row},${desc.col}`)
        .sort();
    return `expanded:${tokens.join('|')}`;
}

function _getExpansionStateListForDiff(state) {
    if (state && Array.isArray(state._expansionCells)) return state._expansionCells.filter(Boolean);
    if (state && state._expansionCell) return [state._expansionCell];
    return [];
}

function _getExpansionRevealKeysForDiff(previousState, nextDescriptors, allowReveal) {
    if (!allowReveal) return new Set();
    const previousKeys = new Set(
        _getExpansionStateListForDiff(previousState)
            .map((exp) => `${exp.row},${exp.col}`)
    );
    return new Set(
        (Array.isArray(nextDescriptors) ? nextDescriptors : [])
            .filter(Boolean)
            .map((exp) => `${exp.row},${exp.col}`)
            .filter((key) => !previousKeys.has(key))
    );
}

function _applyDoubleDigitTimerClassForDiff(timerElement, rawValue) {
    if (!timerElement) return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;
    if (Math.abs(Math.trunc(numericValue)) >= 10) {
        timerElement.classList.add('timer-double-digit');
    }
}

function _resolveSpecialDisplayTurnsForDiff(data) {
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') {
        const regenRemaining = Number(data && data.regenRemaining);
        if (Number.isFinite(regenRemaining)) return Math.max(0, Math.trunc(regenRemaining));
    }
    return undefined;
}

function _cacheCell(row, col, cell) {
    if (!cellCache[row]) cellCache[row] = [];
    cellCache[row][col] = cell;
    cellCacheMap.set(`${row},${col}`, cell);
}

function _getCachedCell(row, col) {
    return cellCacheMap.get(`${row},${col}`) || null;
}

// Shared animation helpers (normalized)
var AnimationShared = (typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
var OwnerHelpersModule = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) OwnerHelpersModule = globalThis.OwnerHelpers;
    } catch (e) { /* ignore */ }
}
var PlaybackStateModule = null;
if (typeof require === 'function') {
    try { PlaybackStateModule = require('./playback-state-manager'); } catch (e) { /* ignore */ }
}
if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) PlaybackStateModule = globalThis.PlaybackStateManager;
    } catch (e) { /* ignore */ }
}

function _isVisualPlaybackActiveForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return (typeof window !== 'undefined' && window.VisualPlaybackActive === true);
}

function _consumeSuppressNextDiffFlipForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.consumeSuppressNextDiffFlip === 'function') {
        return PlaybackStateModule.consumeSuppressNextDiffFlip() === true;
    }
    const active = (typeof window !== 'undefined' && window.__suppressNextDiffFlip === true);
    if (active) {
        try { window.__suppressNextDiffFlip = false; } catch (e) { /* ignore */ }
    }
    return active;
}

// Internal (per-render) flag to suppress fallback flip animation.
// AnimationEngine already animates flip events; DiffRenderer is used to sync final DOM state after playback.
let suppressFallbackFlipThisRender = false;

function _hasPendingPlaybackEvents() {
    try {
        if (typeof cardState === 'undefined' || !cardState) return false;
        const pending = [];
        if (Array.isArray(cardState.presentationEvents)) pending.push(...cardState.presentationEvents);
        if (Array.isArray(cardState._presentationEventsPersist)) pending.push(...cardState._presentationEventsPersist);
        return pending.some(ev => ev && ev.type === 'PLAYBACK_EVENTS');
    } catch (e) {
        return false;
    }
}

function _resolveGameStateForDiffRender() {
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object') return window.gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.gameState && typeof globalThis.gameState === 'object') return globalThis.gameState;
    } catch (e) { /* ignore */ }
    return null;
}

function _resolveCardStateForDiffRender() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object') return globalThis.cardState;
    } catch (e) { /* ignore */ }
    return {};
}

function _buildEmptyCellStateForDiffRender() {
    const emptyVal = (typeof EMPTY !== 'undefined') ? EMPTY : 0;
    const state = [];
    for (let r = 0; r < 8; r++) {
        state[r] = [];
        for (let c = 0; c < 8; c++) {
            state[r][c] = {
                value: emptyVal,
                isLegal: false,
                isLegalFree: false,
                isTabooLegal: false,
                isSelectableFriendly: false,
                isExtendLifeTarget: false,
                breedingSprout: false,
                boardBonus: null,
                special: null,
                inherited: null,
                guard: null,
                bomb: null,
                blockade: null,
                frozen: null,
                destroyEvadeRemaining: null
            };
        }
    }
    state._expansionCells = [];
    state._expansionCell = null;
    return state;
}

function _resolveFlipEvadeDisplayForDiff(special, inherited) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsFlipEvade = (
        specialTypeUpper === 'HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'ESCAPE_HYPERACTIVE' ||
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING'
    );
    const specialEvade = (special && specialSupportsFlipEvade && Number.isFinite(Number(special.flipEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
        : null;
    const inheritedEvade = (inherited && Number.isFinite(Number(inherited.flipEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(inherited.flipEvadeRemaining)))
        : null;
    if (specialEvade !== null && inheritedEvade !== null) {
        return {
            special: specialEvade + inheritedEvade,
            inherited: null
        };
    }
    return {
        special: specialEvade,
        inherited: inheritedEvade
    };
}

const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 8;
const STONE_INFO_TAG_MEANINGS = Object.freeze({
    '多動状態': '両者ターン開始時にマス移動する状態。',
    '反転回避': '反転対象になったとき、マス移動でその石だけ回避する。',
    '破壊回避': '破壊対象になったとき、空きマスへ移動してその石だけ回避する。',
    '特殊石': '通常石画像を使わない石。normal_stone-black.png / normal_stone-white.png 以外の見た目の石。',
    '反転保護': '反転されない。挟める列ごと無効化する。',
    '破壊保護': '破壊効果を受けない。',
    '守る意志適用中': '守る意志または守護神の完全保護が重なっている。',
    '通常石': '通常の石。配置時に挟んだ列を反転できる。'
});
let _stoneInfoTagPanelRefs = null;
let _stoneInfoTagPanelState = {
    open: false,
    key: null
};
let _stoneInfoTagAutoDismissBound = false;

function _isBoardHiddenTrap(marker) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // TRAP is hidden information on board after placement.
    // It should not be shown as a persistent special-stone visual to either side.
    return true;
}

function _resolveNetworkLocalPlayerKeyForDiff() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
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

const SPECIAL_STONE_INFO = {
    PROTECTED: {
        name: '弱い石',
        desc: '次の自分ターン開始まで反転されない。'
    },
    PERMA_PROTECTED: {
        name: '強い石',
        desc: '反転されない。'
    },
    DRAGON: {
        name: '究極反転龍',
        desc: '配置ターン即時＋自ターン開始時に周囲8マスの敵石を反転。5ターンで消滅。'
    },
    BREEDING: {
        name: '繁殖石',
        desc: '配置時と自ターン開始時に周囲へ石を1つ生成。前回生成石起点で拡散し、3ターン持続。'
    },
    ULTIMATE_DESTROY_GOD: {
        name: '究極破壊神',
        desc: '配置ターン即時＋自ターン開始時に周囲8マスの敵石を破壊。5ターンで消滅。'
    },
    DESTROY_DRAGON: {
        name: '破壊龍',
        desc: '配置時と自ターン開始時に周囲8マスの敵石をランダム1個だけ破壊。3ターンで消滅。'
    },
    SNIPER: {
        name: '狙撃石',
        desc: '自ターン開始時に最も近い敵石を1つ破壊。同距離ならランダム。5ターンで消滅。'
    },
    LIGHTNING: {
        name: '落雷石',
        desc: '配置ターン即時＋自ターン開始時に盤面上のランダムな敵石を1つ破壊。5ターン持続。反転保護を持つ特殊石。'
    },
    HYPERACTIVE: {
        name: '多動石',
        desc: '両者ターン開始時に周囲の空きへ1マス移動。移動後に挟めば反転。反転対象時は1回だけマス移動で回避する。'
    },
    EXTREME_HYPERACTIVE: {
        name: '極悪多動魔',
        desc: '両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時は1回だけマス移動で回避する。'
    },
    ESCAPE_HYPERACTIVE: {
        name: '逃亡石',
        desc: '両者ターン開始時に近くの石から逃げるように1マス移動。移動先で挟める石があれば反転可能。反転対象時は1回だけマス移動で回避し、移動先が無いと周囲8マスを爆破して消滅する。'
    },
    ROBOT_VACUUM: {
        name: 'ロボット掃除機石',
        desc: '両者ターン開始時に敵石へ近づくよう1マス移動し、移動後に周囲8マスの敵石を吸い込んで破壊する。吸い込み1個につき布石+3。守る石の完全保護は吸い込めず、5ターンで消滅。'
    },
    GLUTTONOUS: {
        name: '悪食石',
        desc: '両者ターン開始時に1マス移動し、隣接敵石があれば優先して進入して捕食する。隣接敵石が無い時は敵に近づくよう移動し、2連続で捕食失敗すると飢えて消滅する。反転保護を持つ特殊石。'
    },
    ULTIMATE_HYPERACTIVE: {
        name: '究極多動神',
        desc: '両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。反転対象時はマス移動で回避（最大5回）。移動先が無いと消滅。10ターン後は自己消滅する。'
    },
    INHERITED_HYPERACTIVE: {
        name: '継承多動石',
        desc: '両者ターン開始時に周囲の空きへ1マス移動。移動後に挟めば反転。反転対象時は1回だけマス移動で回避し、回避後は通常どおり反転される。10ターン持続（所有者ターン開始時のみ減算）。'
    },
    REGEN: {
        name: '復活石',
        desc: '反転された時に1回だけ元の色へ戻り、その位置から挟める列を反転する。'
    },
    GOLD: {
        name: '金石',
        desc: '配置直後に自壊し、そのターンの獲得布石を4倍にする。'
    },
    RAINBOW: {
        name: '虹石',
        desc: '配置直後に自壊し、そのターンの獲得布石を6倍にする。'
    },
    SILVER: {
        name: '銀石',
        desc: '配置直後に自壊し、そのターンの獲得布石を3倍にする。'
    },
    WORK: {
        name: '労働石',
        desc: '石が残っている間、自ターン開始時に1→2→4→8→16の順で布石獲得。'
    },
    TIME_BOMB: {
        name: '時限爆弾',
        desc: '3ターン後に周囲9マスを爆破。反転されると解除。'
    },
    CROSS_BOMB: {
        name: '十字爆弾',
        desc: '通常反転の直後に即起爆し、中心と縦横2マスの石を爆破。'
    },
    X_BOMB: {
        name: 'クロス爆弾',
        desc: '通常反転の直後に即起爆し、中心と斜め2マスの石を爆破。'
    },
    GUARD: {
        name: '守る石',
        desc: '3ターン、反転/交換/破壊/誘惑を無効化する。'
    },
    TRAP: {
        name: '罠石',
        desc: '次の相手ターン中に反転されると発動する。'
    },
    FREEZE: {
        name: '凍結マス',
        desc: '5ターンの間このマスを凍結する。石がある場合はその石ごと凍結され、凍結中の石は反転・破壊・移動されない。凍結マスには配置・移動できず、反転経路も遮断する。'
    },
    BLOCKADE: {
        name: '封鎖マス',
        desc: 'このマスには3ターンの間、配置・移動で入れない。'
    },
    OBSERVER: {
        name: '盤理の観測者石',
        desc: '所有者ターン開始時に30%で発動し、布石を1〜5獲得する。5ターン持続。'
    },
    WILL_HUNTER_KING: {
        name: '意志狩りの王',
        desc: '自ターン開始時に敵石1つを狙い、特殊石があれば優先してその方向へ移動しながら斬撃で破壊する。反転回避2回と破壊回避2回を持ち、8ターン後に自己消滅する。'
    },
    METEOR_HOLE: {
        name: '流星穴',
        desc: '隕石で破壊された永続穴。このマスには配置・移動で入れず、反転経路も遮断する。'
    }
};

const SPECIAL_STONE_INFO_TYPE_ALIASES = {
    ULTIMATE_HYPERACTIVE_GOD: 'ULTIMATE_HYPERACTIVE',
    EXTREME_HYPERACTIVE_WILL: 'EXTREME_HYPERACTIVE'
};

function _normalizeSpecialStoneInfoType(rawType) {
    if (!rawType) return null;
    const asString = String(rawType);
    return SPECIAL_STONE_INFO_TYPE_ALIASES[asString] || asString;
}

function _normalizeBoardCoord(value) {
    const num = Number(value);
    return Number.isInteger(num) ? num : null;
}

function _isSameBoardCoord(rowA, colA, rowB, colB) {
    const aRow = _normalizeBoardCoord(rowA);
    const aCol = _normalizeBoardCoord(colA);
    const bRow = _normalizeBoardCoord(rowB);
    const bCol = _normalizeBoardCoord(colB);
    return aRow !== null && aCol !== null && bRow !== null && bCol !== null && aRow === bRow && aCol === bCol;
}

function _ensureStoneInfoPanel() {
    if (typeof document === 'undefined') return null;
    let panel = document.getElementById('stone-info-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'stone-info-panel';
    panel.className = 'stone-info-panel';
    panel.innerHTML = [
        '<div id="stone-info-name" class="stone-info-name"></div>',
        '<div id="stone-info-desc" class="stone-info-desc"></div>',
        '<div id="stone-info-meta" class="stone-info-meta"></div>'
    ].join('');
    document.body.appendChild(panel);
    return panel;
}

function _hideStoneInfoPanel() {
    const panel = _ensureStoneInfoPanel();
    if (!panel) return;
    panel.classList.remove('visible');
    _closeStoneInfoTagPanel();
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

function _toggleStoneInfoTagPanel(tag) {
    const key = String(tag || '').trim();
    if (!key) return false;

    const isSame = _stoneInfoTagPanelState.open && _stoneInfoTagPanelState.key === key;
    if (isSame) {
        _closeStoneInfoTagPanel();
        return false;
    }

    const refs = _ensureStoneInfoTagPanel();
    if (!refs || !refs.root || !refs.title || !refs.body) return false;
    const meaning = STONE_INFO_TAG_MEANINGS[key] || `${key}の説明は未登録です。`;
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

    document.addEventListener('pointerdown', (event) => {
        if (!_stoneInfoTagPanelState.open) return;

        const rawTarget = event ? event.target : null;
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

function _renderStoneInfoMetaBadges(metaEl, badges) {
    if (!metaEl) return;
    metaEl.textContent = '';

    const normalizedBadges = Array.from(new Set(
        (Array.isArray(badges) ? badges : [])
            .map((badge) => String(badge || '').trim())
            .filter((badge) => !!badge)
    ));

    if (!normalizedBadges.length) {
        metaEl.style.display = 'none';
        _closeStoneInfoTagPanel();
        return;
    }

    metaEl.setAttribute('aria-label', '石効果タグ');
    for (const badge of normalizedBadges) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stone-info-effect-tag stone-info-effect-tag-button';
        chip.textContent = badge;
        chip.setAttribute('aria-label', `${badge}の説明を表示`);
        chip.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            _toggleStoneInfoTagPanel(badge);
        });
        metaEl.appendChild(chip);
    }

    metaEl.style.display = 'flex';
}

function _getMarkerKinds() {
    return (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
}

function _getMarkerEntriesAt(row, col) {
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
        if (!marker || marker.kind !== kinds.BOMB) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        entries.push({ kind: kinds.BOMB, marker });
    }

    return entries;
}

function _getMarkerEntryAt(row, col) {
    const entries = _getMarkerEntriesAt(row, col);
    return entries.length > 0 ? entries[0] : null;
}

function _hasGuardMarkerAt(row, col) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some(m => (
        m &&
        m.kind === _getMarkerKinds().SPECIAL_STONE &&
        _isSameBoardCoord(m.row, m.col, row, col) &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function _getEntryType(entry) {
    if (!entry || !entry.marker) return null;
    if (entry.kind === (_getMarkerKinds().BOMB)) {
        const bombType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : 'TIME_BOMB';
        return _normalizeSpecialStoneInfoType(bombType);
    }
    const markerType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : null;
    return _normalizeSpecialStoneInfoType(markerType);
}

function _getProtectionInfo(type, entry, hasGuard) {
    const flipProtectedTypes = new Set([
        'PROTECTED',
        'PERMA_PROTECTED',
        'DRAGON',
        'BREEDING',
        'LIGHTNING',
        'GLUTTONOUS',
        'DESTROY_DRAGON',
        'ULTIMATE_DESTROY_GOD',
        'GUARD'
    ]);
    const isBomb = !!(entry && entry.kind === _getMarkerKinds().BOMB);
    const remaining = Number(entry && entry.marker && entry.marker.data ? entry.marker.data.remainingOwnerTurns : NaN);
    const ultimateProtectionActive = !(
        type === 'ULTIMATE_HYPERACTIVE' &&
        Number.isFinite(remaining) &&
        remaining <= 0
    );
    const flipProtected = hasGuard ? true : (isBomb ? false : (flipProtectedTypes.has(type) && ultimateProtectionActive));
    const destroyProtected = hasGuard || type === 'GUARD';
    return {
        flipProtected,
        destroyProtected
    };
}

const STONE_INFO_MOBILITY_TYPES = new Set([
    'HYPERACTIVE',
    'ESCAPE_HYPERACTIVE',
    'INHERITED_HYPERACTIVE',
    'EXTREME_HYPERACTIVE',
    'ULTIMATE_HYPERACTIVE'
]);

const STONE_INFO_FLIP_EVADE_TYPES = new Set([
    'HYPERACTIVE',
    'ESCAPE_HYPERACTIVE',
    'INHERITED_HYPERACTIVE',
    'EXTREME_HYPERACTIVE',
    'ULTIMATE_HYPERACTIVE',
    'WILL_HUNTER_KING'
]);

const STONE_INFO_DESTROY_EVADE_TYPES = new Set([
    'WILL_HUNTER_KING'
]);

function _hasActiveFlipEvadeForEntry(type, entry) {
    if (!type || !entry || !STONE_INFO_FLIP_EVADE_TYPES.has(type)) return false;
    const data = entry && entry.marker && entry.marker.data ? entry.marker.data : null;
    const remainingOwnerTurns = Number(data ? data.remainingOwnerTurns : NaN);
    if (type === 'ULTIMATE_HYPERACTIVE' && Number.isFinite(remainingOwnerTurns) && remainingOwnerTurns <= 0) {
        return false;
    }

    const rawRemaining = Number(data ? data.flipEvadeRemaining : NaN);
    const defaultRemaining = type === 'ULTIMATE_HYPERACTIVE' ? 5 : 1;
    const normalizedRemaining = Number.isFinite(rawRemaining)
        ? Math.max(0, Math.trunc(rawRemaining))
        : defaultRemaining;
    return normalizedRemaining > 0;
}

function _buildSpecialStoneBadges(entries, hasGuard, protection) {
    const badges = [];
    const resolvedEntries = Array.isArray(entries) ? entries : [];
    const contexts = resolvedEntries
        .map((entry) => ({ entry, type: _getEntryType(entry) }))
        .filter((ctx) => !!ctx.type);

    if (hasGuard) badges.push('守る意志適用中');
    badges.push('特殊石');

    if (contexts.some((ctx) => STONE_INFO_MOBILITY_TYPES.has(ctx.type))) {
        badges.push('多動状態');
    }
    if (contexts.some((ctx) => _hasActiveFlipEvadeForEntry(ctx.type, ctx.entry))) {
        badges.push('反転回避');
    }
    if (contexts.some((ctx) => {
        if (!ctx || !ctx.type || !STONE_INFO_DESTROY_EVADE_TYPES.has(ctx.type)) return false;
        const data = ctx.entry && ctx.entry.marker && ctx.entry.marker.data ? ctx.entry.marker.data : null;
        const remaining = Number(data ? data.destroyEvadeRemaining : NaN);
        return Number.isFinite(remaining) && Math.max(0, Math.trunc(remaining)) > 0;
    })) {
        badges.push('破壊回避');
    }

    if (protection.flipProtected) badges.push('反転保護');
    if (protection.destroyProtected) badges.push('破壊保護');

    return badges;
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

function _getStoneOwnerAt(row, col) {
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

function _getNormalStoneInfo(row, col) {
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = _getStoneOwnerAt(row, col);
    if (owner === black) return NORMAL_STONE_INFO.black;
    if (owner === white) return NORMAL_STONE_INFO.white;
    return null;
}

function showSpecialStoneInfoAt(row, col) {
    _closeStoneInfoTagPanel();
    const entries = _getMarkerEntriesAt(row, col);
    const entry = entries.length > 0 ? entries[0] : null;
    let info = null;
    const badges = [];
    if (entry) {
        const type = _getEntryType(entry);
        if (!type) {
            _hideStoneInfoPanel();
            return false;
        }

        info = SPECIAL_STONE_INFO[type] || { name: type, desc: '効果情報は未登録です。' };
        const hasGuard = _hasGuardMarkerAt(row, col);
        const protection = _getProtectionInfo(type, entry, hasGuard);
        badges.push(..._buildSpecialStoneBadges(entries, hasGuard, protection));
    } else {
        info = _getNormalStoneInfo(row, col);
        if (!info) {
            _hideStoneInfoPanel();
            return false;
        }
        badges.push('通常石');
    }

    const panel = _ensureStoneInfoPanel();
    if (!panel) return false;

    const nameEl = document.getElementById('stone-info-name');
    const descEl = document.getElementById('stone-info-desc');
    const metaEl = document.getElementById('stone-info-meta');
    if (!nameEl || !descEl || !metaEl) return false;

    nameEl.textContent = info.name;
    descEl.textContent = info.desc;
    _renderStoneInfoMetaBadges(metaEl, badges);

    panel.classList.add('visible');

    const cell = _getCachedCell(row, col);
    if (cell && typeof window !== 'undefined') {
        const rect = cell.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const margin = 10;
        const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
        const left = Math.min(maxLeft, Math.max(margin, rect.left + 6));
        const topCandidate = rect.top - panelRect.height - 8;
        const top = topCandidate < margin ? Math.min(window.innerHeight - panelRect.height - margin, rect.bottom + 8) : topCandidate;
        panel.style.left = `${left}px`;
        panel.style.top = `${Math.max(margin, top)}px`;
    }

    return true;
}

let _outsideCloseHandlerBound = false;
function _ensureOutsideCloseHandler() {
    if (_outsideCloseHandlerBound || typeof document === 'undefined') return;
    _outsideCloseHandlerBound = true;
    _bindStoneInfoTagAutoDismiss();
    document.addEventListener('pointerdown', (ev) => {
        const panel = document.getElementById('stone-info-panel');
        if (!panel || !panel.classList.contains('visible')) return;
        const target = ev.target;
        if (panel.contains(target)) return;
        const board = document.getElementById('board');
        if (board && board.contains(target)) return;
        _hideStoneInfoPanel();
    }, true);
}

function attachBoardCellInteraction(cell, row, col) {
    if (!cell) return;

    let pressTimer = null;
    let pressActive = false;
    let longPressed = false;
    let startX = 0;
    let startY = 0;

    const clearPress = () => {
        pressActive = false;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    cell.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        _ensureOutsideCloseHandler();
        clearPress();
        longPressed = false;
        pressActive = true;
        startX = Number(ev.clientX || 0);
        startY = Number(ev.clientY || 0);
        pressTimer = setTimeout(() => {
            if (!pressActive) return;
            longPressed = true;
            showSpecialStoneInfoAt(row, col);
        }, LONG_PRESS_MS);
    });

    cell.addEventListener('pointermove', (ev) => {
        if (!pressActive) return;
        const dx = Math.abs(Number(ev.clientX || 0) - startX);
        const dy = Math.abs(Number(ev.clientY || 0) - startY);
        if (dx > LONG_PRESS_MOVE_CANCEL_PX || dy > LONG_PRESS_MOVE_CANCEL_PX) {
            clearPress();
        }
    });

    cell.addEventListener('pointerup', (ev) => {
        if (!pressActive && !longPressed) return;
        const wasLongPressed = longPressed;
        clearPress();
        if (wasLongPressed) {
            ev.preventDefault();
            return;
        }
        _hideStoneInfoPanel();
        handleCellClick(row, col);
    });

    cell.addEventListener('pointercancel', () => clearPress());
    cell.addEventListener('mouseleave', () => clearPress());
}

/**
 * 盤面を初期化（最初の1回のみ全レンダリング）
 * Initialize board with full rendering (first time only)
 * @param {HTMLElement} boardEl - 盤面要素
 */
function initializeBoardDOM(boardEl) {
    const gameState = _resolveGameStateForDiffRender();
    const expansions = _getExpansionDescriptorsForDiff(gameState);
    boardEl.innerHTML = '';
    cellCache = [];
    cellCacheMap = new Map();

    boardEl.classList.remove('board-expanded-left', 'board-expanded-right', 'board-expanded-top', 'board-expanded-bottom');
    if (expansions.some((exp) => exp && exp.side === 'left')) boardEl.classList.add('board-expanded-left');
    if (expansions.some((exp) => exp && exp.side === 'right')) boardEl.classList.add('board-expanded-right');
    if (expansions.some((exp) => exp && exp.side === 'top')) boardEl.classList.add('board-expanded-top');
    if (expansions.some((exp) => exp && exp.side === 'bottom')) boardEl.classList.add('board-expanded-bottom');

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            attachBoardCellInteraction(cell, r, c);
            boardEl.appendChild(cell);
            _cacheCell(r, c, cell);
        }
    }

    for (const expansion of expansions) {
        if (!expansion) continue;
        const cell = document.createElement('div');
        cell.className = `cell cell-expanded cell-expanded-${expansion.side}`;
        cell.dataset.row = String(expansion.row);
        cell.dataset.col = String(expansion.col);
        _applyExpansionCellPositionForDiff(cell, expansion.row, expansion.col);
        attachBoardCellInteraction(cell, expansion.row, expansion.col);
        boardEl.appendChild(cell);
        _cacheCell(expansion.row, expansion.col, cell);
    }

    boardDomSignature = _getBoardDomSignatureForDiff(gameState);

    previousBoardState = null;
    console.log('[DiffRenderer] Board DOM initialized with cell cache');
}


/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
function buildCurrentCellState() {
    const gameState = _resolveGameStateForDiffRender();
    const cardState = _resolveCardStateForDiffRender();
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8) {
        return _buildEmptyCellStateForDiffRender();
    }

    const player = gameState.currentPlayer;
    // Minimal, single-site guard: if cardState is missing or incomplete, use an empty context
    // to avoid throwing inside CardLogic.getCardContext during early-init race.
    let context;
    if (cardState && Array.isArray(cardState.markers)) {
        context = CardLogic.getCardContext(cardState);
    } else {
        console.warn('[DiffRenderer] cardState missing or incomplete — using empty CardContext to continue rendering');
        context = { protectedStones: [], permaProtectedStones: [], bombs: [] };
    }
    const playerKey = getPlayerKey(player);
    const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
    const freePlacementActive = !!(pending && (
        (typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.isFreePlacementPendingType === 'function' &&
            CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'
    ));
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    let canControlCurrentTurn = true;
    try {
        const isNetworkMode = (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function')
            ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
            : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                ? window.getCurrentMatchMode() === 'network'
                : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network'));
        if (isNetworkMode) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff();
            canControlCurrentTurn = playerKey === localPlayerKey;
        }
    } catch (e) { /* ignore */ }
    const isHumanTurn = (gameState.currentPlayer === BLACK) ||
        (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE);
    const isSelectingTarget = !!(
        pending && (
            pending.stage === 'selectTarget' ||
            pending.type === 'DESTROY_ONE_STONE' ||
            pending.type === 'SWAP_WITH_ENEMY' ||
            pending.type === 'GUARD_WILL' ||
            pending.type === 'GUARDIAN_GOD' ||
            pending.type === 'HYPERACTIVE_INHERIT_WILL' ||
            pending.type === 'TEMPT_WILL' ||
            pending.type === 'BOARD_EXPANSION_WILL' ||
            pending.type === 'BOARD_EXPANSION_GOD' ||
            pending.type === 'EXTEND_LIFE_WILL' ||
            pending.type === 'CORROSION_WILL'
        )
    );
    const isExtendLifeSelection = !!(
        pending &&
        pending.type === 'EXTEND_LIFE_WILL' &&
        (pending.stage === 'selectTarget' || pending.stage == null)
    );
    const showLegalHints = isHumanTurn && !isSelectingTarget && canControlCurrentTurn;
    const expansions = _getExpansionDescriptorsForDiff(gameState);

    let normalLegalSet = new Set();
    if (showLegalHints) {
        const legalMoves = getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones);
        normalLegalSet = new Set(legalMoves.map(m => `${m.row},${m.col}`));
    }

    const tabooLegalSet = new Set();
    if (showLegalHints && isTabooReversePending && typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getTabooReverseCandidates === 'function') {
        const addTabooCell = (row, col) => {
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            const key = `${row},${col}`;
            const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
            if (!Array.isArray(candidates) || candidates.length === 0) return;
            tabooLegalSet.add(key);
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                addTabooCell(r, c);
            }
        }
        for (const expansion of expansions) {
            if (!expansion || Number(expansion.owner) !== EMPTY) continue;
            addTabooCell(expansion.row, expansion.col);
        }
    }
    const legalSet = new Set([...normalLegalSet, ...tabooLegalSet]);
    console.log('[DiffRenderer] legal hint cells:', legalSet.size, 'player:', player, 'taboo:', isTabooReversePending, 'tabooCells:', tabooLegalSet.size);
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const selectableTargetSet = new Set(selectableTargets.map(p => p.row + ',' + p.col));

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const boardBonusByCell = (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
        ? cardState.boardBonusByCell
        : {};
    const boardBonusConsumedByCell = (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
        ? cardState.boardBonusConsumedByCell
        : {};
    const specialMap = new Map();
    const guardMap = new Map();
    const inheritedMap = new Map();
    const bombMap = new Map();
    const blockadeMap = new Map();
    const freezeMap = new Map();
    const sproutMap = new Map();
    for (const m of markers) {
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
            if (_isBoardHiddenTrap(m)) continue;
            if (m.data.type === 'INHERITED_HYPERACTIVE') {
                inheritedMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns,
                    flipEvadeRemaining: Number.isFinite(Number(m.data.flipEvadeRemaining))
                        ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                        : null
                });
                continue;
            }
            if (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE') {
                blockadeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    type: m.data.type,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'FREEZE') {
                freezeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'GUARD') {
                guardMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            const markerTypeUpper = String(m.data.type || '').toUpperCase();
            const markerSupportsFlipEvade = (
                markerTypeUpper === 'HYPERACTIVE' ||
                markerTypeUpper === 'EXTREME_HYPERACTIVE' ||
                markerTypeUpper === 'ESCAPE_HYPERACTIVE' ||
                markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
                markerTypeUpper === 'WILL_HUNTER_KING'
            );
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: _resolveSpecialDisplayTurnsForDiff(m.data),
                destroyEvadeRemaining: Number.isFinite(Number(m.data.destroyEvadeRemaining))
                    ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                    : null,
                flipEvadeRemaining: markerSupportsFlipEvade
                    ? (
                        Number.isFinite(Number(m.data.flipEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 5 : null)
                    )
                    : 0
            });
        } else if (m.kind === markerKinds.BOMB && m.data) {
            bombMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                remainingTurns: m.data.remainingTurns,
                owner: m.owner
            });
        }
    }
    try {
        const sproutByOwner = (cardState && cardState.breedingSproutByOwner && typeof cardState.breedingSproutByOwner === 'object')
            ? cardState.breedingSproutByOwner
            : { black: [], white: [] };
        const addSprout = (ownerKey, positions) => {
            const ownerVal = ownerKey === 'black' ? BLACK : WHITE;
            if (!Array.isArray(positions)) return;
            for (const p of positions) {
                if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
                if (p.row < 0 || p.row >= 8 || p.col < 0 || p.col >= 8) continue;
                if (gameState.board[p.row][p.col] !== ownerVal) continue;
                sproutMap.set(`${p.row},${p.col}`, true);
            }
        };
        addSprout('black', sproutByOwner.black);
        addSprout('white', sproutByOwner.white);
    } catch (e) { /* ignore */ }

    const state = [];
    for (let r = 0; r < 8; r++) {
        state[r] = [];
        for (let c = 0; c < 8; c++) {
            const key = r + ',' + c;
            const val = gameState.board[r][c];
            const blockade = blockadeMap.get(key) || null;
            const frozen = freezeMap.get(key) || null;
            const isLegal = showLegalHints && val === EMPTY && legalSet.has(key);
            const isTabooLegal = showLegalHints && val === EMPTY && tabooLegalSet.has(key);
            const isLegalFree = showLegalHints && val === EMPTY && freePlacementActive;
            const isSelectableFriendly = isHumanTurn && selectableTargetSet.has(key);
            const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
            const bonusValueRaw = (val === EMPTY && !blockade && !frozen && boardBonusConsumedByCell[key] !== true)
                ? Number(boardBonusByCell[key] || 0)
                : 0;
            const boardBonus = Number.isFinite(bonusValueRaw) && bonusValueRaw > 0 ? bonusValueRaw : null;

            // Get special stone at this position
            const special = val !== EMPTY ? specialMap.get(key) : null;
            const inherited = val !== EMPTY ? inheritedMap.get(key) : null;
            const guard = val !== EMPTY ? guardMap.get(key) : null;
            const bomb = val !== EMPTY ? bombMap.get(key) : null;
            const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special, inherited);
            const specialSupportsFlipEvade = !!(
                special &&
                (
                    String(special.type || '').toUpperCase() === 'HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'WILL_HUNTER_KING'
                )
            );

            // Normalize owner to BLACK/WHITE constant
            const getOwnerVal = (owner) => {
                if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
                return WHITE;
            };

            state[r][c] = {
                value: val,
                isLegal: isLegal && !isLegalFree,
                isLegalFree,
                isTabooLegal,
                isSelectableFriendly,
                isExtendLifeTarget,
                breedingSprout: (val !== EMPTY) && sproutMap.has(key),
                boardBonus,
                // Unified special stone field
                special: special ? {
                    type: special.type,
                    owner: getOwnerVal(special.owner),
                    remainingOwnerTurns: special.remainingOwnerTurns,
                    flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay.special : 0,
                    destroyEvadeRemaining: special.destroyEvadeRemaining
                } : null,
                inherited: inherited ? {
                    owner: getOwnerVal(inherited.owner),
                    remainingOwnerTurns: inherited.remainingOwnerTurns,
                    flipEvadeRemaining: flipEvadeDisplay.inherited
                } : null,
                guard: guard ? {
                    owner: getOwnerVal(guard.owner),
                    remainingOwnerTurns: guard.remainingOwnerTurns
                } : null,
                bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerVal(bomb.owner) } : null,
                blockade: blockade ? {
                    type: blockade.type,
                    owner: getOwnerVal(blockade.owner),
                    remainingOwnerTurns: blockade.remainingOwnerTurns
                } : null,
                frozen: frozen ? {
                    owner: getOwnerVal(frozen.owner),
                    remainingOwnerTurns: frozen.remainingOwnerTurns
                } : null,
                destroyEvadeRemaining: special ? special.destroyEvadeRemaining : null
            };
        }
    }

    state._expansionCells = [];
    for (const expansion of expansions) {
        if (!expansion) continue;
        const expKey = `${expansion.row},${expansion.col}`;
        const expVal = expansion.owner;
        const isLegal = showLegalHints && expVal === EMPTY && legalSet.has(expKey);
        const isTabooLegal = showLegalHints && expVal === EMPTY && tabooLegalSet.has(expKey);
        const isLegalFree = showLegalHints && expVal === EMPTY && freePlacementActive;
        const isSelectableFriendly = isHumanTurn && selectableTargetSet.has(expKey);
        const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
        const blockade = blockadeMap.get(expKey) || null;
        const special = expVal !== EMPTY ? specialMap.get(expKey) : null;
        const inherited = expVal !== EMPTY ? inheritedMap.get(expKey) : null;
        const guard = expVal !== EMPTY ? guardMap.get(expKey) : null;
        const bomb = expVal !== EMPTY ? bombMap.get(expKey) : null;
        const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special, inherited);
        const specialSupportsFlipEvade = !!(
            special &&
            (
                String(special.type || '').toUpperCase() === 'HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'WILL_HUNTER_KING'
            )
        );

        const getOwnerVal = (owner) => {
            if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
            return WHITE;
        };

        state._expansionCells.push({
            row: expansion.row,
            col: expansion.col,
            side: expansion.side,
            value: expVal,
            isLegal: isLegal && !isLegalFree,
            isLegalFree,
            isTabooLegal,
            isSelectableFriendly,
            isExtendLifeTarget,
            breedingSprout: false,
            boardBonus: null,
            frozen: freezeMap.get(expKey) ? {
                owner: getOwnerVal(freezeMap.get(expKey).owner),
                remainingOwnerTurns: freezeMap.get(expKey).remainingOwnerTurns
            } : null,
            special: special ? {
                type: special.type,
                owner: getOwnerVal(special.owner),
                remainingOwnerTurns: special.remainingOwnerTurns,
                flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay.special : 0,
                destroyEvadeRemaining: special.destroyEvadeRemaining
            } : null,
            inherited: inherited ? {
                owner: getOwnerVal(inherited.owner),
                remainingOwnerTurns: inherited.remainingOwnerTurns,
                flipEvadeRemaining: flipEvadeDisplay.inherited
            } : null,
            guard: guard ? {
                owner: getOwnerVal(guard.owner),
                remainingOwnerTurns: guard.remainingOwnerTurns
            } : null,
            bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerVal(bomb.owner) } : null,
            blockade: blockade ? {
                type: blockade.type,
                owner: getOwnerVal(blockade.owner),
                remainingOwnerTurns: blockade.remainingOwnerTurns
            } : null,
            destroyEvadeRemaining: special ? special.destroyEvadeRemaining : null
        });
    }
    state._expansionCell = state._expansionCells.length > 0 ? state._expansionCells[0] : null;
    return state;
}

/**
 * 2つのセル状態を比較
 * Compare two cell states for equality
 * @param {CellState|null} a - 前回の状態
 * @param {CellState} b - 現在の状態
 * @returns {boolean} 同一かどうか
 */
function cellStatesEqual(a, b) {
    if (!a) return false;
    if (a.value !== b.value) return false;
    if (a.isLegal !== b.isLegal) return false;
    if (a.isLegalFree !== b.isLegalFree) return false;
    if (!!a.isTabooLegal !== !!b.isTabooLegal) return false;
    if (a.isSelectableFriendly !== b.isSelectableFriendly) return false;
    if (!!a.isExtendLifeTarget !== !!b.isExtendLifeTarget) return false;
    if (!!a.breedingSprout !== !!b.breedingSprout) return false;
    if (a.boardBonus !== b.boardBonus) return false;

    // Compare unified special stone
    if ((a.special === null) !== (b.special === null)) return false;
    if (a.special && b.special) {
        if (a.special.type !== b.special.type) return false;
        if (a.special.owner !== b.special.owner) return false;
        if (a.special.remainingOwnerTurns !== b.special.remainingOwnerTurns) return false;
        if (a.special.flipEvadeRemaining !== b.special.flipEvadeRemaining) return false;
        if (a.special.destroyEvadeRemaining !== b.special.destroyEvadeRemaining) return false;
    }

    if ((a.inherited === null) !== (b.inherited === null)) return false;
    if (a.inherited && b.inherited) {
        if (a.inherited.owner !== b.inherited.owner) return false;
        if (a.inherited.remainingOwnerTurns !== b.inherited.remainingOwnerTurns) return false;
        if (a.inherited.flipEvadeRemaining !== b.inherited.flipEvadeRemaining) return false;
    }

    if ((a.guard === null) !== (b.guard === null)) return false;
    if (a.guard && b.guard) {
        if (a.guard.owner !== b.guard.owner) return false;
        if (a.guard.remainingOwnerTurns !== b.guard.remainingOwnerTurns) return false;
    }

    // Compare bomb state
    if ((a.bomb === null) !== (b.bomb === null)) return false;
    if (a.bomb && b.bomb) {
        if (a.bomb.remainingTurns !== b.bomb.remainingTurns) return false;
        if (a.bomb.owner !== b.bomb.owner) return false;
    }

    if ((a.blockade === null) !== (b.blockade === null)) return false;
    if (a.blockade && b.blockade) {
        if ((a.blockade.type || null) !== (b.blockade.type || null)) return false;
        if (a.blockade.remainingOwnerTurns !== b.blockade.remainingOwnerTurns) return false;
        if (a.blockade.owner !== b.blockade.owner) return false;
    }

    if ((a.frozen === null) !== (b.frozen === null)) return false;
    if (a.frozen && b.frozen) {
        if (a.frozen.remainingOwnerTurns !== b.frozen.remainingOwnerTurns) return false;
        if (a.frozen.owner !== b.frozen.owner) return false;
    }

    return true;
}

function updateCellDOM(cell, state, row, col, prevState) {
    const isExpansionCell = _isExpansionCoordinateForDiff(row, col);
    const expansionSide = _resolveExpansionSideForDiff(state && state.side ? state.side : null, row, col);

    // If a destroy-fade is actively running on this disc, skip re-rendering this cell
    // so we don't interrupt the disappearance animation.
    const currentDisc = cell.querySelector('.disc');
    if (currentDisc && currentDisc.classList.contains('destroy-fade')) {
        return;
    }

    // Recover from stale hidden classes/styles that can remain after playback race conditions.
    // During active playback we still skip to avoid clobbering in-flight transitions.
    if (currentDisc && (
        currentDisc.classList.contains('stone-hidden') ||
        currentDisc.classList.contains('stone-hidden-all') ||
        currentDisc.classList.contains('stone-instant')
    )) {
        const isPlaybackActive = _isVisualPlaybackActiveForDiff();
        if (isPlaybackActive) return;
        try {
            currentDisc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
            currentDisc.style.opacity = '';
            currentDisc.style.visibility = '';
        } catch (e) { /* ignore */ }
    }

    // Also skip if an animation overlay is active in this cell
    if (cell.querySelector('.stone-fade-overlay')) {
        return;
    }

    // If a stone is being removed and playback didn't handle it, apply a fallback destroy-fade.
    // Exception: HYPERACTIVE source cells become EMPTY due to MOVE, not DESTROY.
    // Do not show destroy fade there.
    if (prevState && prevState.value !== EMPTY && state.value === EMPTY && currentDisc) {
        const wasHyperactiveStone = !!(
            prevState.special &&
            (prevState.special.type === 'HYPERACTIVE' || prevState.special.type === 'EXTREME_HYPERACTIVE' || prevState.special.type === 'ESCAPE_HYPERACTIVE')
        );
        if (wasHyperactiveStone) {
            cell.classList.remove('has-disc');
            cell.innerHTML = '';
            return;
        }
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        if (!noAnim) {
            currentDisc.classList.add('destroy-fade');
            const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS)
                ? SharedConstants.DESTROY_FADE_MS
                : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
            const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn, ms) => setTimeout(fn, ms) });
            timer.setTimeout(() => {
                try {
                    cell.classList.remove('has-disc');
                    cell.innerHTML = '';
                } catch (e) { /* ignore */ }
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            }, fadeMs + 50);
            return;
        }
    }

    // Clear existing classes and content
    cell.className = 'cell';
    cell.innerHTML = '';
    if (isExpansionCell) {
        cell.classList.add('cell-expanded');
        if (expansionSide) {
            cell.classList.add(`cell-expanded-${expansionSide}`);
        }
        _applyExpansionCellPositionForDiff(cell, row, col);
    } else {
        cell.style.top = '';
        cell.style.left = '';
        cell.style.right = '';
        cell.style.bottom = '';
    }

    // Add legal move indicators
    if (state.isLegalFree && !state.blockade && !state.frozen) {
        cell.classList.add('legal-free');
    } else if (state.isLegal && !state.blockade && !state.frozen) {
        cell.classList.add('legal');
    }
    if (state.isTabooLegal && !state.blockade && !state.frozen) {
        cell.classList.add('effect-target-highlight');
    }
    if (state.isSelectableFriendly && !state.blockade && !state.frozen) {
        cell.classList.add('selectable-friendly');
    }
    if (state.isExtendLifeTarget && !state.blockade && !state.frozen) {
        cell.classList.add('selectable-friendly-no-circle');
    }

    if (state.blockade) {
        cell.classList.add('blocked-cell');
        const blockedType = String(state.blockade.type || '').toUpperCase();
        if (blockedType === 'METEOR_HOLE') {
            cell.classList.add('meteor-hole-cell');
            const holeMark = document.createElement('div');
            holeMark.className = 'meteor-hole-mark';
            cell.appendChild(holeMark);
        } else {
            const blockadeMark = document.createElement('div');
            blockadeMark.className = 'blockade-mark';
            const remain = Number(state.blockade.remainingOwnerTurns);
            if (Number.isFinite(remain)) {
                const turnLabel = document.createElement('div');
                turnLabel.className = 'blockade-turn';
                turnLabel.textContent = String(Math.max(0, remain));
                blockadeMark.appendChild(turnLabel);
            }
            cell.appendChild(blockadeMark);
        }
    }

    if (state.value === EMPTY && Number.isFinite(state.boardBonus) && state.boardBonus > 0) {
        cell.classList.add('has-board-bonus');
        const bonusLabel = document.createElement('div');
        bonusLabel.className = 'board-bonus-number';
        bonusLabel.textContent = String(state.boardBonus);
        cell.appendChild(bonusLabel);
    }

    // Create disc if occupied
    if (state.value !== EMPTY) {
        cell.classList.add('has-disc');
        const disc = document.createElement('div');
        disc.className = 'disc ' + (state.value === BLACK ? 'black' : 'white');

        // Ensure per-disc overlay image var is set (used by .disc::after)
        try {
            if (typeof setDiscStoneImage === 'function') {
                setDiscStoneImage(disc, state.value);
            } else if (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function') {
                window.setDiscStoneImage(disc, state.value);
            } else {
                // Fallback: set CSS var directly
                try { disc.style.setProperty('--stone-image', (state.value === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)')); } catch (e) { }
            }
        } catch (e) { /* ignore */ }

        const normalizeOwnerVal = (owner) => {
            if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
            return WHITE;
        };
        const canShowSpecialFlipEvade = !!(
            state.special &&
            (
                String(state.special.type || '').toUpperCase() === 'HYPERACTIVE' ||
                String(state.special.type || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ||
                String(state.special.type || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ||
                String(state.special.type || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE' ||
                String(state.special.type || '').toUpperCase() === 'WILL_HUNTER_KING'
            ) &&
            Number.isFinite(state.special.flipEvadeRemaining)
        );
        const canShowDestroyEvade = !!(
            state.special &&
            String(state.special.type || '').toUpperCase() === 'WILL_HUNTER_KING' &&
            Number.isFinite(state.special.destroyEvadeRemaining)
        );

        // Unified special stone visual effect
        if (state.special) {
            const effectKey = getEffectKeyForType(state.special.type);
            if (effectKey) {
                applyStoneVisualEffect(disc, effectKey, { owner: normalizeOwnerVal(state.special.owner) });
            }
            // Robust fallback: ensure reveal-only trap image is visible if visual-map lookup/DI fails.
            if (state.special.type === 'TRAP_REVEAL' && typeof applyTrapStoneFallbackVisual === 'function') {
                applyTrapStoneFallbackVisual(disc, normalizeOwnerVal(state.special.owner));
            }

            // Ensure WORK visuals are applied even if mapping lookup fails
            if (state.special.type === 'WORK') {
                applyStoneVisualEffect(disc, 'workStone', { owner: normalizeOwnerVal(state.special.owner) });
            }

            // Add timer for effects with remaining turns
            if (state.special.remainingOwnerTurns !== undefined) {
                const timer = document.createElement('div');
                timer.className =
                    (state.special.type === 'DRAGON' || state.special.type === 'DESTROY_DRAGON' || state.special.type === 'LIGHTNING') ? 'dragon-timer'
                        : (state.special.type === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
                            : (state.special.type === 'BREEDING' ? 'breeding-timer'
                                : (state.special.type === 'WORK' ? 'work-timer' : 'special-timer')));
                const remaining = Math.max(0, Math.trunc(Number(state.special.remainingOwnerTurns)));
                timer.textContent = String(remaining);
                _applyDoubleDigitTimerClassForDiff(timer, remaining);
                disc.appendChild(timer);
            }

            if (canShowSpecialFlipEvade) {
                const evadeTimer = document.createElement('div');
                evadeTimer.className = 'stone-timer flip-evade-timer';
                const specialEvadeRemaining = Math.max(0, Math.trunc(state.special.flipEvadeRemaining));
                evadeTimer.textContent = String(specialEvadeRemaining);
                _applyDoubleDigitTimerClassForDiff(evadeTimer, specialEvadeRemaining);
                disc.appendChild(evadeTimer);
            }

            if (canShowDestroyEvade) {
                const destroyEvadeTimer = document.createElement('div');
                destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                const destroyEvadeRemaining = Math.max(0, Math.trunc(state.special.destroyEvadeRemaining));
                destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                _applyDoubleDigitTimerClassForDiff(destroyEvadeTimer, destroyEvadeRemaining);
                disc.appendChild(destroyEvadeTimer);
            }
        }

        // Add bomb UI (independent of special effects)
        if (state.bomb) {
            const bombOwnerClass = state.bomb.owner === BLACK ? 'bomb-black' : 'bomb-white';
            disc.classList.add('bomb', 'special-stone', bombOwnerClass);
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            const bombRemaining = Math.max(0, Math.trunc(Number(state.bomb.remainingTurns)));
            timeLabel.textContent = String(bombRemaining);
            _applyDoubleDigitTimerClassForDiff(timeLabel, bombRemaining);
            disc.appendChild(timeLabel);
        }

        if (state.guard && typeof state.guard.remainingOwnerTurns === 'number') {
            const guardTimer = document.createElement('div');
            guardTimer.className = 'guard-timer';
            const guardRemaining = Math.max(0, Math.trunc(state.guard.remainingOwnerTurns));
            guardTimer.textContent = String(guardRemaining);
            _applyDoubleDigitTimerClassForDiff(guardTimer, guardRemaining);
            disc.appendChild(guardTimer);
        }

        if (state.inherited && typeof state.inherited.remainingOwnerTurns === 'number') {
            const inheritedTimer = document.createElement('div');
            inheritedTimer.className = 'stone-timer special-timer inherited-hyperactive-timer';
            const inheritedRemaining = Math.max(0, Math.trunc(state.inherited.remainingOwnerTurns));
            inheritedTimer.textContent = String(inheritedRemaining);
            _applyDoubleDigitTimerClassForDiff(inheritedTimer, inheritedRemaining);
            disc.appendChild(inheritedTimer);
        }

        if (
            state.inherited &&
            Number.isFinite(state.inherited.flipEvadeRemaining) &&
            !canShowSpecialFlipEvade
        ) {
            const evadeTimer = document.createElement('div');
            evadeTimer.className = 'stone-timer flip-evade-timer';
            const inheritedEvadeRemaining = Math.max(0, Math.trunc(state.inherited.flipEvadeRemaining));
            evadeTimer.textContent = String(inheritedEvadeRemaining);
            _applyDoubleDigitTimerClassForDiff(evadeTimer, inheritedEvadeRemaining);
            disc.appendChild(evadeTimer);
        }

        if (state.breedingSprout) {
            disc.classList.add('breeding-sprout');
            const sproutIcon = document.createElement('div');
            sproutIcon.className = 'breeding-sprout-icon';
            disc.appendChild(sproutIcon);
        }

        cell.appendChild(disc);

        // Fallback flip animation in case PlaybackEngine path fails:
        // when a stone stays occupied but owner changes, add a quick flip class.
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        if (!suppressFallbackFlipThisRender && !noAnim && prevState && prevState.value !== EMPTY && prevState.value !== state.value) {
            const flipMs = (typeof window !== 'undefined' && window.AnimationConstants && window.AnimationConstants.FLIP_MS) ? window.AnimationConstants.FLIP_MS : 600;
            try {
                if (AnimationShared && AnimationShared.triggerFlip) AnimationShared.triggerFlip(disc);
                const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn, ms) => setTimeout(fn, ms) });
                timer.setTimeout(() => { try { if (AnimationShared && AnimationShared.removeFlip) AnimationShared.removeFlip(disc); else disc.classList.remove('flip'); } catch (e) { } }, flipMs);
            } catch (e) { /* ignore */ }
        }

    }

    if (state.frozen) {
        cell.classList.add('frozen-cell');
        const freezeMark = document.createElement('div');
        freezeMark.className = 'freeze-mark';
        const remain = Number(state.frozen.remainingOwnerTurns);
        if (Number.isFinite(remain)) {
            const turnLabel = document.createElement('div');
            turnLabel.className = 'freeze-turn';
            turnLabel.textContent = String(Math.max(0, Math.trunc(remain)));
            freezeMark.appendChild(turnLabel);
        }
        cell.appendChild(freezeMark);
    }
}

/**
 * Map special stone type to visual effect key
 * @param {string} type - Special stone type
 * @returns {string|null} Effect key for applyStoneVisualEffect
 */
function getEffectKeyForType(type) {
    // Delegate to the canonical map in visual-effects-map.js when available.
    if (typeof getEffectKeyForSpecialType === 'function') {
        return getEffectKeyForSpecialType(type);
    }
    try {
        if (typeof SPECIAL_TYPE_TO_EFFECT_KEY !== 'undefined' && SPECIAL_TYPE_TO_EFFECT_KEY) {
            return SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.SPECIAL_TYPE_TO_EFFECT_KEY) {
            return window.SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function reconcileCellHasDiscClasses(boardEl) {
    if (!boardEl || typeof boardEl.querySelectorAll !== 'function') return;
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach((cell) => {
        try {
            const hasDisc = !!cell.querySelector('.disc');
            if (hasDisc) cell.classList.add('has-disc');
            else cell.classList.remove('has-disc');
        } catch (e) { /* ignore */ }
    });
}

/**
 * 差分レンダリング実行
 * Execute differential rendering
 * @param {HTMLElement} boardEl - 盤面要素
 * @returns {number} 更新されたセル数
 */
function renderBoardDiff(boardEl) {
    // Single Visual Writer detection: prevent diff/rerender during active playback
    if (_isVisualPlaybackActiveForDiff()) {
        if (typeof window !== 'undefined' && window.__DEV__ === true) {
            throw new Error('renderBoardDiff called during active VisualPlayback (dev fail-fast)');
        } else {
            // Do not abort playback here; aborting causes animations to disappear mid-sequence.
            // Instead, skip this render. AnimationEngine requests a final emitBoardUpdate after playback ends.
            console.warn('renderBoardDiff called during active VisualPlayback. Skipping diff render until playback ends.');
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.singleVisualWriterHits = (window.__telemetry__.singleVisualWriterHits || 0) + 1; }
            return 0;
        }
    }

    // One-shot suppression set by AnimationEngine at the end of playback.
    // This prevents DiffRenderer from replaying the fallback ".flip" when syncing the final board state.
    suppressFallbackFlipThisRender = _consumeSuppressNextDiffFlipForDiff() || _hasPendingPlaybackEvents();

    try {
        const gameState = _resolveGameStateForDiffRender();
        const nextSignature = _getBoardDomSignatureForDiff(gameState);
        // 初回またはキャッシュが空の場合は全レンダリング
        if (!cellCacheMap.size || boardDomSignature !== nextSignature) {
            const nextExpansions = _getExpansionDescriptorsForDiff(gameState);
            const revealExpansionKeys = _getExpansionRevealKeysForDiff(
                previousBoardState,
                nextExpansions,
                !!cellCacheMap.size && boardDomSignature !== null
            );
            initializeBoardDOM(boardEl);
            previousBoardState = buildCurrentCellState();
            // Initial full render
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const cell = _getCachedCell(r, c);
                    if (cell) updateCellDOM(cell, previousBoardState[r][c], r, c, null);
                }
            }
            const initialExpansions = _getExpansionStateListForDiff(previousBoardState);
            for (const exp of initialExpansions) {
                if (!exp) continue;
                const expCell = _getCachedCell(exp.row, exp.col);
                if (expCell) {
                    updateCellDOM(expCell, exp, exp.row, exp.col, null);
                    if (revealExpansionKeys.has(`${exp.row},${exp.col}`)) {
                        expCell.classList.add('cell-expanded-reveal');
                    }
                }
            }
            reconcileCellHasDiscClasses(boardEl);
            console.log('[DiffRenderer] Initial full render complete');
            return cellCacheMap.size;
        }

        const currentState = buildCurrentCellState();
        let updatedCount = 0;

        // 差分検出と更新
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const prev = previousBoardState ? previousBoardState[r][c] : null;
                const curr = currentState[r][c];

                if (!cellStatesEqual(prev, curr)) {
                    const cell = _getCachedCell(r, c);
                    if (cell) {
                        updateCellDOM(cell, curr, r, c, prev);
                        updatedCount++;
                    }
                }
            }
        }

        const prevExpList = _getExpansionStateListForDiff(previousBoardState);
        const currExpList = _getExpansionStateListForDiff(currentState);
        const prevExpMap = new Map(prevExpList.filter(Boolean).map((exp) => [`${exp.row},${exp.col}`, exp]));
        const currExpMap = new Map(currExpList.filter(Boolean).map((exp) => [`${exp.row},${exp.col}`, exp]));
        const expansionKeys = new Set([...prevExpMap.keys(), ...currExpMap.keys()]);
        for (const key of expansionKeys) {
            const prevExp = prevExpMap.get(key) || null;
            const currExp = currExpMap.get(key) || null;
            if (!currExp) continue;
            if (!cellStatesEqual(prevExp, currExp)) {
                const cell = _getCachedCell(currExp.row, currExp.col);
                if (cell) {
                    updateCellDOM(cell, currExp, currExp.row, currExp.col, prevExp);
                    updatedCount++;
                }
            }
        }

        previousBoardState = currentState;

        if (updatedCount > 0) {
            console.log(`[DiffRenderer] Updated ${updatedCount}/${cellCacheMap.size} cells`);
        }

        reconcileCellHasDiscClasses(boardEl);

        return updatedCount;
    } finally {
        suppressFallbackFlipThisRender = false;
    }
}

/**
 * 強制的に全セルを再レンダリング
 * Force full re-render of all cells
 * @param {HTMLElement} boardEl - 盤面要素
 */
function forceFullRender(boardEl) {
    previousBoardState = null;
    cellCache = [];
    cellCacheMap = new Map();
    boardDomSignature = null;
    initializeBoardDOM(boardEl);
    renderBoardDiff(boardEl);
    console.log('[DiffRenderer] Full render forced');
}

/**
 * レンダリング統計をリセット
 * Reset rendering statistics
 */
function resetRenderStats() {
    previousBoardState = null;
    boardDomSignature = null;
}

// Export helpers for Node/Jest test harness
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeBoardDOM,
        buildCurrentCellState,
        renderBoardDiff,
        forceFullRender,
        resetRenderStats,
        attachBoardCellInteraction,
        showSpecialStoneInfoAt
    };
}
if (typeof window !== 'undefined') {
    window.forceFullRender = forceFullRender;
    window.resetRenderStats = resetRenderStats;
    window.attachBoardCellInteraction = attachBoardCellInteraction;
    window.showSpecialStoneInfoAt = showSpecialStoneInfoAt;
}
