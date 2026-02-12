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

// Shared animation helpers (normalized)
var AnimationShared = (typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);

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

const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 8;

function _isBoardHiddenTrap(marker) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // TRAP is hidden information on board after placement.
    // It should not be shown as a persistent special-stone visual to either side.
    return true;
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
        desc: 'ターン開始時に周囲を反転する。'
    },
    BREEDING: {
        name: '繁殖石',
        desc: '自ターン開始時に周囲に石を生成。'
    },
    ULTIMATE_DESTROY_GOD: {
        name: '究極破壊神',
        desc: 'ターン開始時に周囲の敵石を壊す。'
    },
    HYPERACTIVE: {
        name: '多動石',
        desc: 'ターン開始時にランダム方向1マスに移動。'
    },
    ULTIMATE_HYPERACTIVE: {
        name: '究極多動神',
        desc: 'ターン開始時に1マス移動を2回行い、隣接敵石を吹き飛ばす。'
    },
    REGEN: {
        name: '復活石',
        desc: '反転されると一度だけ元の色に戻る。'
    },
    GOLD: {
        name: '金石',
        desc: '配置直後に自壊し、そのターンの獲得布石を4倍にする。'
    },
    SILVER: {
        name: '銀石',
        desc: '配置直後に自壊し、そのターンの獲得布石を3倍にする。'
    },
    WORK: {
        name: '労働石',
        desc: '自ターン開始時に1→2→4→8→16布石獲得。'
    },
    TIME_BOMB: {
        name: '時限爆弾',
        desc: 'カウント0で周囲を巻き込んで壊す。'
    },
    CROSS_BOMB: {
        name: '十字爆弾',
        desc: 'カウント0で十字方向を巻き込んで壊す。'
    },
    GUARD: {
        name: '守る石',
        desc: '3ターン、反転/交換/破壊/誘惑を無効化する。'
    },
    TRAP: {
        name: '罠石',
        desc: '次の相手ターン中に反転されると発動する。'
    }
};

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
}

function _getMarkerKinds() {
    return (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
}

function _getMarkerEntryAt(row, col) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const kinds = _getMarkerKinds();
    const special = markers.find(m => (
        m &&
        m.kind === kinds.SPECIAL_STONE &&
        m.row === row &&
        m.col === col &&
        !_isBoardHiddenTrap(m)
    ));
    if (special) return { kind: kinds.SPECIAL_STONE, marker: special };
    const bomb = markers.find(m => m && m.kind === kinds.BOMB && m.row === row && m.col === col);
    if (bomb) return { kind: kinds.BOMB, marker: bomb };
    return null;
}

function _hasGuardMarkerAt(row, col) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some(m => (
        m &&
        m.kind === _getMarkerKinds().SPECIAL_STONE &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function _getEntryType(entry) {
    if (!entry || !entry.marker) return null;
    if (entry.kind === (_getMarkerKinds().BOMB)) {
        return (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : 'TIME_BOMB';
    }
    return (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : null;
}

function _getProtectionInfo(type, entry, hasGuard) {
    const flipProtectedTypes = new Set([
        'PROTECTED',
        'PERMA_PROTECTED',
        'DRAGON',
        'BREEDING',
        'ULTIMATE_DESTROY_GOD',
        'GUARD'
    ]);
    const isBomb = !!(entry && entry.kind === _getMarkerKinds().BOMB);
    const flipProtected = hasGuard ? true : (isBomb ? false : flipProtectedTypes.has(type));
    // Trap stone is intentionally not swap-protected on the rule side.
    const swapProtected = hasGuard ? true : (!!entry && type !== 'TRAP');
    const destroyProtected = hasGuard || type === 'GUARD';
    return {
        flipProtected,
        swapProtected,
        destroyProtected
    };
}

function showSpecialStoneInfoAt(row, col) {
    const entry = _getMarkerEntryAt(row, col);
    if (!entry) {
        _hideStoneInfoPanel();
        return false;
    }
    const type = _getEntryType(entry);
    if (!type) {
        _hideStoneInfoPanel();
        return false;
    }

    const info = SPECIAL_STONE_INFO[type] || { name: type, desc: '効果情報は未登録です。' };
    const hasGuard = _hasGuardMarkerAt(row, col);
    const protection = _getProtectionInfo(type, entry, hasGuard);

    const panel = _ensureStoneInfoPanel();
    if (!panel) return false;

    const nameEl = document.getElementById('stone-info-name');
    const descEl = document.getElementById('stone-info-desc');
    const metaEl = document.getElementById('stone-info-meta');
    if (!nameEl || !descEl || !metaEl) return false;

    nameEl.textContent = info.name;
    descEl.textContent = info.desc;
    const badges = [];
    if (hasGuard) badges.push('守る意志適用中');
    if (protection.flipProtected) badges.push('反転保護');
    if (protection.swapProtected) badges.push('交換保護');
    if (protection.destroyProtected) badges.push('破壊保護');
    metaEl.textContent = badges.join(' / ');
    metaEl.style.display = badges.length > 0 ? '' : 'none';

    panel.classList.add('visible');

    const cell = cellCache[row] && cellCache[row][col] ? cellCache[row][col] : null;
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
    boardEl.innerHTML = '';
    cellCache = [];

    for (let r = 0; r < 8; r++) {
        cellCache[r] = [];
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            attachBoardCellInteraction(cell, r, c);
            boardEl.appendChild(cell);
            cellCache[r][c] = cell;
        }
    }

    previousBoardState = null;
    console.log('[DiffRenderer] Board DOM initialized with cell cache');
}


/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
function buildCurrentCellState() {
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
    const freePlacementActive = pending && pending.type === 'FREE_PLACEMENT';
    const isHumanTurn = (gameState.currentPlayer === BLACK) ||
        (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE);
    const isSelectingTarget = !!(
        pending && (
            pending.stage === 'selectTarget' ||
            pending.type === 'DESTROY_ONE_STONE' ||
            pending.type === 'SWAP_WITH_ENEMY' ||
            pending.type === 'GUARD_WILL' ||
            pending.type === 'TEMPT_WILL'
        )
    );
    const showLegalHints = isHumanTurn && !isSelectingTarget;

    const legalMoves = showLegalHints ? getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones) : [];
    console.log('[DiffRenderer] getLegalMoves returned:', legalMoves.length, 'moves for player:', player);
    const legalSet = new Set(legalMoves.map(m => m.row + ',' + m.col));
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const selectableTargetSet = new Set(selectableTargets.map(p => p.row + ',' + p.col));

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const specialMap = new Map();
    const guardMap = new Map();
    const bombMap = new Map();
    const sproutMap = new Map();
    for (const m of markers) {
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
            if (_isBoardHiddenTrap(m)) continue;
            if (m.data.type === 'GUARD') {
                guardMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: m.data.remainingOwnerTurns
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
            const isLegal = showLegalHints && val === EMPTY && legalSet.has(key);
            const isLegalFree = showLegalHints && val === EMPTY && freePlacementActive;
            const isSelectableFriendly = isHumanTurn && selectableTargetSet.has(key);

            // Get special stone at this position
            const special = val !== EMPTY ? specialMap.get(key) : null;
            const guard = val !== EMPTY ? guardMap.get(key) : null;
            const bomb = val !== EMPTY ? bombMap.get(key) : null;

            // Normalize owner to BLACK/WHITE constant
            const getOwnerVal = (owner) => {
                if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
                return WHITE;
            };

            state[r][c] = {
                value: val,
                isLegal: isLegal && !isLegalFree,
                isLegalFree,
                isSelectableFriendly,
                breedingSprout: (val !== EMPTY) && sproutMap.has(key),
                // Unified special stone field
                special: special ? {
                    type: special.type,
                    owner: getOwnerVal(special.owner),
                    remainingOwnerTurns: special.remainingOwnerTurns
                } : null,
                guard: guard ? {
                    owner: getOwnerVal(guard.owner),
                    remainingOwnerTurns: guard.remainingOwnerTurns
                } : null,
                bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerVal(bomb.owner) } : null
            };
        }
    }
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
    if (a.isSelectableFriendly !== b.isSelectableFriendly) return false;
    if (!!a.breedingSprout !== !!b.breedingSprout) return false;

    // Compare unified special stone
    if ((a.special === null) !== (b.special === null)) return false;
    if (a.special && b.special) {
        if (a.special.type !== b.special.type) return false;
        if (a.special.owner !== b.special.owner) return false;
        if (a.special.remainingOwnerTurns !== b.special.remainingOwnerTurns) return false;
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

    return true;
}

function updateCellDOM(cell, state, row, col, prevState) {
    // If we have an active cross-fade or instant animation on the disc,
    // skip re-rendering this cell to avoid nuking the animation state.
    const currentDisc = cell.querySelector('.disc');
    if (currentDisc && (
        currentDisc.classList.contains('stone-hidden') ||
        currentDisc.classList.contains('stone-hidden-all') ||
        currentDisc.classList.contains('stone-instant') ||
        currentDisc.classList.contains('destroy-fade')
    )) {
        return;
    }

    // Also skip if an animation overlay is active in this cell
    if (cell.querySelector('.stone-fade-overlay')) {
        return;
    }

    // If a stone is being removed and playback didn't handle it, apply a fallback destroy-fade.
    // Exception: HYPERACTIVE source cells become EMPTY due to MOVE, not DESTROY.
    // Do not show destroy fade there.
    if (prevState && prevState.value !== EMPTY && state.value === EMPTY && currentDisc) {
        const wasHyperactiveStone = !!(prevState.special && prevState.special.type === 'HYPERACTIVE');
        if (wasHyperactiveStone) {
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
                try { cell.innerHTML = ''; } catch (e) { /* ignore */ }
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            }, fadeMs + 50);
            return;
        }
    }

    // Clear existing classes and content
    cell.className = 'cell';
    cell.innerHTML = '';

    // Add legal move indicators
    if (state.isLegalFree) {
        cell.classList.add('legal-free');
    } else if (state.isLegal) {
        cell.classList.add('legal');
    }
    if (state.isSelectableFriendly) {
        cell.classList.add('selectable-friendly');
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
                    state.special.type === 'DRAGON' ? 'dragon-timer'
                        : (state.special.type === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
                            : (state.special.type === 'BREEDING' ? 'breeding-timer'
                                : (state.special.type === 'WORK' ? 'work-timer' : 'special-timer')));
                const remaining = state.special.remainingOwnerTurns;
                timer.textContent = state.special.type === 'DRAGON'
                    ? Math.min(5, remaining)
                    : (state.special.type === 'BREEDING'
                        ? Math.min(3, remaining)
                        : (state.special.type === 'ULTIMATE_DESTROY_GOD' ? Math.min(3, remaining)
                            : (state.special.type === 'WORK' ? Math.min(5, remaining) : remaining)));
                disc.appendChild(timer);
            }
        }

        // Add bomb UI (independent of special effects)
        if (state.bomb) {
            const bombOwnerClass = state.bomb.owner === BLACK ? 'bomb-black' : 'bomb-white';
            disc.classList.add('bomb', 'special-stone', bombOwnerClass);
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = state.bomb.remainingTurns;
            disc.appendChild(timeLabel);
        }

        if (state.guard && typeof state.guard.remainingOwnerTurns === 'number') {
            const guardTimer = document.createElement('div');
            guardTimer.className = 'guard-timer';
            guardTimer.textContent = Math.max(0, state.guard.remainingOwnerTurns);
            disc.appendChild(guardTimer);
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

/**
 * 差分レンダリング実行
 * Execute differential rendering
 * @param {HTMLElement} boardEl - 盤面要素
 * @returns {number} 更新されたセル数
 */
function renderBoardDiff(boardEl) {
    // Single Visual Writer detection: prevent diff/rerender during active playback
    if (typeof window !== 'undefined' && window.VisualPlaybackActive === true) {
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
    suppressFallbackFlipThisRender = (typeof window !== 'undefined' && window.__suppressNextDiffFlip === true) || _hasPendingPlaybackEvents();
    if (suppressFallbackFlipThisRender) {
        try { window.__suppressNextDiffFlip = false; } catch (e) { /* ignore */ }
    }

    try {
        // 初回またはキャッシュが空の場合は全レンダリング
        if (!cellCache.length || cellCache[0].length === 0) {
            initializeBoardDOM(boardEl);
            previousBoardState = buildCurrentCellState();
            // Initial full render
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    updateCellDOM(cellCache[r][c], previousBoardState[r][c], r, c, null);
                }
            }
            console.log('[DiffRenderer] Initial full render complete');
            return 64;
        }

        const currentState = buildCurrentCellState();
        let updatedCount = 0;

        // 差分検出と更新
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const prev = previousBoardState ? previousBoardState[r][c] : null;
                const curr = currentState[r][c];

                if (!cellStatesEqual(prev, curr)) {
                    updateCellDOM(cellCache[r][c], curr, r, c, prev);
                    updatedCount++;
                }
            }
        }

        previousBoardState = currentState;

        if (updatedCount > 0) {
            console.log(`[DiffRenderer] Updated ${updatedCount}/64 cells`);
        }

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
    window.attachBoardCellInteraction = attachBoardCellInteraction;
    window.showSpecialStoneInfoAt = showSpecialStoneInfoAt;
}
