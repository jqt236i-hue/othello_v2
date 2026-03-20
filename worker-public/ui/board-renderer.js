/**
 * @file board-renderer.js
 * @description 盤面レンダリング（差分レンダリング対応版）
 * Board rendering with differential rendering support
 */

/**
 * 盤面を描画（差分レンダリング使用）
 * Render board using differential rendering for performance
 * 
 * Note: Requires diff-renderer.js to be loaded first
 */
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

function _isVisualPlaybackActiveForBoardRenderer() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return (typeof window !== 'undefined' && window.VisualPlaybackActive === true);
}

function _hasPendingPlaybackEventsForBoardRenderer() {
    try {
        const state = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            ? cardState
            : ((typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') ? window.cardState : null);
        if (!state) return false;

        const pending = [];
        if (Array.isArray(state.presentationEvents)) pending.push(...state.presentationEvents);
        if (Array.isArray(state._presentationEventsPersist)) pending.push(...state._presentationEventsPersist);
        return pending.some((ev) => ev && ev.type === 'PLAYBACK_EVENTS');
    } catch (e) {
        return false;
    }
}

function _shouldSkipBoardRenderForPlayback() {
    return _isVisualPlaybackActiveForBoardRenderer() || _hasPendingPlaybackEventsForBoardRenderer();
}

function _isTimeStopActiveForBoardRenderer() {
    try {
        const state = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            ? cardState
            : ((typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') ? window.cardState : null);
        const remainingByPlayer = state && state.timeStopConsecutiveTurnsRemainingByPlayer;
        if (!remainingByPlayer || typeof remainingByPlayer !== 'object') return false;
        const blackRemaining = Number(remainingByPlayer.black);
        const whiteRemaining = Number(remainingByPlayer.white);
        return (Number.isFinite(blackRemaining) && blackRemaining > 0) || (Number.isFinite(whiteRemaining) && whiteRemaining > 0);
    } catch (e) {
        return false;
    }
}

function _syncTimeStopClassForBoardRenderer() {
    if (typeof document === 'undefined') return;
    const active = _isTimeStopActiveForBoardRenderer();
    try {
        if (document.documentElement && document.documentElement.classList) {
            document.documentElement.classList.toggle('time-stop-active', active);
        }
        if (document.body && document.body.classList) {
            document.body.classList.toggle('time-stop-active', active);
        }
    } catch (e) {
        // UI only
    }
}

function renderBoard() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    // Determine whether we are in a "target selection" card mode.
    // In selection mode, normal "placeable move" hints must not appear.
    try {
        const player = gameState.currentPlayer;
        const playerKey = getPlayerKey(player);
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        const isSelectingTarget = !!(
            pending && (
                pending.stage === 'selectTarget' ||
                pending.type === 'DESTROY_ONE_STONE' ||
                pending.type === 'SWAP_WITH_ENEMY' ||
                pending.type === 'GUARD_WILL' ||
                pending.type === 'GUARDIAN_GOD' ||
                pending.type === 'HYPERACTIVE_INHERIT_WILL' ||
                pending.type === 'TEMPT_WILL' ||
                pending.type === 'CLONE_WILL' ||
                pending.type === 'BOARD_EXPANSION_WILL' ||
                pending.type === 'BOARD_EXPANSION_GOD' ||
                pending.type === 'EXTEND_LIFE_WILL' ||
                pending.type === 'EXTEND_LIFE_GOD' ||
                pending.type === 'CORROSION_WILL'
            )
        );
        if (boardEl) boardEl.classList.toggle('selection-mode', isSelectingTarget);
    } catch (e) {
        // UI only
    }

    // Use differential rendering if available
    if (typeof renderBoardDiff === 'function') {
        renderBoardDiff(boardEl);
    } else {
        // diff-renderer is required; avoid legacy full render path
        console.error('[Board Renderer] diff-renderer.js not loaded; rendering skipped');
        return;
    }

    updateOccupancyUI();
    renderCardUI();
}

/**
 * フォールバック：全セル再描画
 * Fallback: Full board re-render (legacy method)
 */
function _isBoardHiddenTrapForBoardRenderer(marker) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _isFlipEvadeSpecialTypeForBoard(type) {
    const typeUpper = String(type || '').toUpperCase();
    return (
        typeUpper === 'HYPERACTIVE' ||
        typeUpper === 'EXTREME_HYPERACTIVE' ||
        typeUpper === 'ESCAPE_HYPERACTIVE' ||
        typeUpper === 'ULTIMATE_HYPERACTIVE' ||
        typeUpper === 'WILL_HUNTER_KING'
    );
}

function _isDestroyEvadeSpecialTypeForBoard(type) {
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'WILL_HUNTER_KING' || typeUpper === 'ULTIMATE_HYPERACTIVE';
}

function _resolveSpecialDisplayTurnsForBoard(data) {
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') {
        const regenRemaining = Number(data && data.regenRemaining);
        if (Number.isFinite(regenRemaining)) return Math.max(0, Math.trunc(regenRemaining));
    }
    return undefined;
}

function _applyDoubleDigitTimerClassForBoard(timerElement, rawValue) {
    if (!timerElement) return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;
    if (Math.abs(Math.trunc(numericValue)) >= 10) {
        timerElement.classList.add('timer-double-digit');
    }
}

function _resolveNetworkLocalPlayerKeyForBoard() {
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

function _canLocalPlayerControlCurrentTurnForBoard() {
    let isNetworkMode = false;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            isNetworkMode = OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null);
        } else {
            let matchMode = null;
            try {
                matchMode = (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                    ? window.getCurrentMatchMode()
                    : (typeof window !== 'undefined' ? window.MATCH_MODE : null);
            } catch (e) { /* ignore */ }
            isNetworkMode = matchMode === 'network';
        }
    } catch (e) { /* ignore */ }
    if (!isNetworkMode) return true;
    const currentPlayerKey = gameState.currentPlayer === WHITE ? 'white' : 'black';
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForBoard();
    return currentPlayerKey === localPlayerKey;
}

function renderBoardFull() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    boardEl.innerHTML = '';
    const player = gameState.currentPlayer;
    const context = CardLogic.getCardContext(cardState);
    const playerKey = getPlayerKey(player);
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    const freePlacementActive = !!(pending && (
        (typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.isFreePlacementPendingType === 'function' &&
            CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'
    ));
    const isSelectingTarget = !!(
        pending && (
            pending.stage === 'selectTarget' ||
            pending.type === 'DESTROY_ONE_STONE' ||
            pending.type === 'SWAP_WITH_ENEMY' ||
            pending.type === 'GUARD_WILL' ||
            pending.type === 'GUARDIAN_GOD' ||
            pending.type === 'HYPERACTIVE_INHERIT_WILL' ||
            pending.type === 'TEMPT_WILL' ||
            pending.type === 'CLONE_WILL' ||
            pending.type === 'BOARD_EXPANSION_WILL' ||
            pending.type === 'BOARD_EXPANSION_GOD' ||
            pending.type === 'EXTEND_LIFE_WILL' ||
            pending.type === 'EXTEND_LIFE_GOD' ||
            pending.type === 'CORROSION_WILL'
        )
    );
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const selectableTargetSet = new Set(selectableTargets.map(p => p.row + ',' + p.col));
    const isNetworkMode = !!(OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function'
        ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
        : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
            ? window.getCurrentMatchMode() === 'network'
            : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network')));
    const isHumanTurn = isNetworkMode
        ? _canLocalPlayerControlCurrentTurnForBoard()
        : ((gameState.currentPlayer === BLACK) ||
            (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE));
    const showLegalHints = isHumanTurn && !isSelectingTarget && _canLocalPlayerControlCurrentTurnForBoard();

    let normalLegalSet = new Set();
    if (showLegalHints) {
        const legalMoves = getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones);
        normalLegalSet = new Set(legalMoves.map(m => `${m.row},${m.col}`));
    }

    const tabooLegalSet = new Set();
    if (showLegalHints && isTabooReversePending && typeof CardLogic.getTabooReverseCandidates === 'function') {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, playerKey, r, c);
                if (!Array.isArray(candidates) || candidates.length === 0) continue;
                tabooLegalSet.add(`${r},${c}`);
            }
        }
    }
    const legalSet = new Set([...normalLegalSet, ...tabooLegalSet]);

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const specialMap = new Map();
    const guardMap = new Map();
    const inheritedMap = new Map();
    const bombMap = new Map();
    const sproutMap = new Map();
    for (const m of markers) {
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
            if (_isBoardHiddenTrapForBoardRenderer(m)) continue;
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
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: _resolveSpecialDisplayTurnsForBoard(m.data),
                destroyEvadeRemaining: _isDestroyEvadeSpecialTypeForBoard(markerTypeUpper)
                    ? (
                        Number.isFinite(Number(m.data.destroyEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 1 : null)
                    )
                    : null,
                flipEvadeRemaining: _isFlipEvadeSpecialTypeForBoard(markerTypeUpper)
                    ? (
                        Number.isFinite(Number(m.data.flipEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : ((markerTypeUpper === 'ULTIMATE_HYPERACTIVE' || markerTypeUpper === 'EXTREME_HYPERACTIVE') ? 3 : null)
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

    // Helper for effect key mapping: delegate to canonical visual-effects map.
    const getEffectKeyForType = (type) => {
        if (typeof getEffectKeyForSpecialType === 'function') return getEffectKeyForSpecialType(type);
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
    };

    // Helper to normalize owner
    const getOwnerVal = (owner) => {
        if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
        return WHITE;
    };

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Human turn gets legal move hints (Black always, White in HvH)
            const key = r + ',' + c;
            if (showLegalHints && gameState.board[r][c] === EMPTY) {
                if (freePlacementActive) {
                    cell.classList.add('legal-free');
                } else if (legalSet.has(key)) {
                    cell.classList.add('legal');
                }
                if (tabooLegalSet.has(key)) {
                    cell.classList.add('effect-target-highlight');
                }
            }
            if (isHumanTurn && selectableTargetSet.has(key)) {
                cell.classList.add('selectable-friendly');
            }

            const val = gameState.board[r][c];
            if (val !== EMPTY) {
                cell.classList.add('has-disc');
                const disc = document.createElement('div');
                disc.className = 'disc ' + (val === BLACK ? 'black' : 'white');
                ensureDiscSkeleton(disc);
                setDiscStoneImage(disc, val);
                const discHud = getDiscHudRoot(disc);

                // Unified special stone visual effect
                const special = specialMap.get(key);
                const inheritedData = inheritedMap.get(key);
                const specialCanShowFlipEvade = !!(
                    special &&
                    _isFlipEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(special.flipEvadeRemaining))
                );
                const specialCanShowDestroyEvade = !!(
                    special &&
                    _isDestroyEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(special.destroyEvadeRemaining))
                );
                const specialFlipEvade = specialCanShowFlipEvade
                    ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
                    : null;
                const inheritedFlipEvade = (inheritedData && Number.isFinite(Number(inheritedData.flipEvadeRemaining)))
                    ? Math.max(0, Math.trunc(Number(inheritedData.flipEvadeRemaining)))
                    : null;
                const mergedFlipEvade = (specialFlipEvade !== null && inheritedFlipEvade !== null)
                    ? (specialFlipEvade + inheritedFlipEvade)
                    : null;
                const specialFlipEvadeForDisplay = mergedFlipEvade !== null ? mergedFlipEvade : specialFlipEvade;
                const inheritedFlipEvadeForDisplay = mergedFlipEvade !== null ? null : inheritedFlipEvade;
                if (special) {
                    const effectKey = getEffectKeyForType(special.type);
                    if (effectKey) {
                        applyStoneVisualEffect(disc, effectKey, { owner: getOwnerVal(special.owner) });
                    }
                    // Robust fallback: ensure reveal-only trap image is visible if visual-map lookup/DI fails.
                    if (special.type === 'TRAP_REVEAL' && typeof applyTrapStoneFallbackVisual === 'function') {
                        applyTrapStoneFallbackVisual(disc, getOwnerVal(special.owner));
                    }

                    // Ensure WORK visuals are applied even if mapping returns null
                    if (special.type === 'WORK') {
                        applyStoneVisualEffect(disc, 'workStone', { owner: getOwnerVal(special.owner) });
                    }

                    // Add timer for effects with remaining turns
                    if (special.remainingOwnerTurns !== undefined) {
                        const timer = document.createElement('div');
                        timer.className =
                            (special.type === 'DRAGON' || special.type === 'DESTROY_DRAGON') ? 'dragon-timer'
                                : (special.type === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
                                    : (special.type === 'BREEDING' ? 'breeding-timer'
                                        : (special.type === 'WORK' ? 'work-timer' : 'special-timer')));
                        const remaining = Math.max(0, Math.trunc(Number(special.remainingOwnerTurns)));
                        timer.textContent = String(remaining);
                        _applyDoubleDigitTimerClassForBoard(timer, remaining);
                        discHud.appendChild(timer);
                    }

                    if (specialCanShowFlipEvade && Number.isFinite(specialFlipEvadeForDisplay)) {
                        const evadeTimer = document.createElement('div');
                        evadeTimer.className = 'stone-timer flip-evade-timer';
                        const evadeRemaining = Math.max(0, Math.trunc(specialFlipEvadeForDisplay));
                        evadeTimer.textContent = String(evadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(evadeTimer, evadeRemaining);
                        discHud.appendChild(evadeTimer);
                    }

                    if (specialCanShowDestroyEvade) {
                        const destroyEvadeTimer = document.createElement('div');
                        destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                        const destroyEvadeRemaining = Math.max(0, Math.trunc(Number(special.destroyEvadeRemaining)));
                        destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(destroyEvadeTimer, destroyEvadeRemaining);
                        discHud.appendChild(destroyEvadeTimer);
                    }
                }

                // 爆弾チェック
                const bomb = bombMap.get(key);
                if (bomb) {
                    const bombOwner = getOwnerVal(bomb.owner);
                    if (typeof applyStoneVisualEffect === 'function') {
                        applyStoneVisualEffect(disc, 'timeBombStone', { owner: bombOwner });
                    }
                    disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
                    const timeLabel = document.createElement('div');
                    timeLabel.className = 'bomb-timer';
                    const bombRemaining = Math.max(0, Math.trunc(Number(bomb.remainingTurns)));
                    timeLabel.textContent = String(bombRemaining);
                    _applyDoubleDigitTimerClassForBoard(timeLabel, bombRemaining);
                    discHud.appendChild(timeLabel);
                }

                const guardData = guardMap.get(key);
                if (guardData && typeof guardData.remainingOwnerTurns === 'number') {
                    const guardTimer = document.createElement('div');
                    guardTimer.className = 'guard-timer';
                    const guardRemaining = Math.max(0, Math.trunc(guardData.remainingOwnerTurns));
                    guardTimer.textContent = String(guardRemaining);
                    _applyDoubleDigitTimerClassForBoard(guardTimer, guardRemaining);
                    discHud.appendChild(guardTimer);
                }

                if (inheritedData && typeof inheritedData.remainingOwnerTurns === 'number') {
                    const inheritedTimer = document.createElement('div');
                    inheritedTimer.className = 'stone-timer special-timer inherited-hyperactive-timer';
                    const inheritedRemaining = Math.max(0, Math.trunc(inheritedData.remainingOwnerTurns));
                    inheritedTimer.textContent = String(inheritedRemaining);
                    _applyDoubleDigitTimerClassForBoard(inheritedTimer, inheritedRemaining);
                    discHud.appendChild(inheritedTimer);
                }
                if (Number.isFinite(inheritedFlipEvadeForDisplay)) {
                    const evadeTimer = document.createElement('div');
                    evadeTimer.className = 'stone-timer flip-evade-timer';
                    const inheritedEvadeRemaining = Math.max(0, Math.trunc(inheritedFlipEvadeForDisplay));
                    evadeTimer.textContent = String(inheritedEvadeRemaining);
                    _applyDoubleDigitTimerClassForBoard(evadeTimer, inheritedEvadeRemaining);
                    discHud.appendChild(evadeTimer);
                }
                if (sproutMap.has(key)) {
                    disc.classList.add('breeding-sprout');
                    const sproutIcon = document.createElement('div');
                    sproutIcon.className = 'breeding-sprout-icon';
                    discHud.appendChild(sproutIcon);
                }

                cell.appendChild(disc);
            }

            if (typeof attachBoardCellInteraction === 'function') {
                attachBoardCellInteraction(cell, r, c);
            } else {
                cell.addEventListener('click', () => handleCellClick(r, c));
            }
            boardEl.appendChild(cell);
        }
    }
}

// NOTE:
// Animation helpers (destroy/fade-out) are intentionally defined in `ui/animation-utils.js`.
// Keeping a second copy here risks load-order bugs (different class names / CSS wiring).

function updateOccupancyUI() {
    const counts = countDiscs(gameState);
    const total = counts.black + counts.white;

    let blackPct = 50, whitePct = 50;
    if (total > 0) {
        blackPct = Math.round((counts.black / total) * 100);
        whitePct = 100 - blackPct;
    }

    const blackEl = document.getElementById('occ-black');
    const whiteEl = document.getElementById('occ-white');

    if (blackEl) blackEl.innerHTML = `<div class="occ-dot"></div>黒 ${blackPct}%`;
    if (whiteEl) whiteEl.innerHTML = `<div class="occ-dot"></div>白 ${whitePct}%`;
}

function _findDirectDiscChildByClass(disc, className) {
    if (!disc || !disc.children) return null;
    for (const child of disc.children) {
        if (child && child.classList && child.classList.contains(className)) return child;
    }
    return null;
}

function _resolveDiscOwnerDescriptor(owner) {
    const blackValue = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const whiteValue = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const normalized = (owner === whiteValue || owner === -1 || owner === 'white' || owner === '-1')
        ? 'white'
        : 'black';
    return normalized === 'white'
        ? {
            key: 'white',
            value: whiteValue,
            className: 'white',
            baseImage: 'var(--normal-stone-white-image)',
            fallbackColor: '#ffffff'
        }
        : {
            key: 'black',
            value: blackValue,
            className: 'black',
            baseImage: 'var(--normal-stone-black-image)',
            fallbackColor: '#050505'
        };
}

function _areStoneBaseImagesReady() {
    try {
        return !!(
            typeof document !== 'undefined' &&
            document &&
            document.documentElement &&
            document.documentElement.classList &&
            document.documentElement.classList.contains('stone-base-images-ready')
        );
    } catch (e) {
        return false;
    }
}

function _resolveDiscImageState(renderState, baseImage) {
    if (renderState && typeof renderState.imageState === 'string' && renderState.imageState) {
        return renderState.imageState;
    }
    const hasBaseImage = typeof baseImage === 'string' && baseImage.trim() && baseImage !== 'none';
    return (hasBaseImage && _areStoneBaseImagesReady()) ? 'loaded' : 'fallback';
}

function ensureDiscSkeleton(disc) {
    if (!disc || typeof document === 'undefined' || typeof disc.appendChild !== 'function') {
        return { face: null, base: null, overlay: null, hud: null };
    }

    let face = _findDirectDiscChildByClass(disc, 'disc__face');
    let hud = _findDirectDiscChildByClass(disc, 'disc__hud');

    if (!face) {
        face = document.createElement('div');
        face.className = 'disc__face';
        if (disc.firstChild) disc.insertBefore(face, disc.firstChild);
        else disc.appendChild(face);
    }
    if (!hud) {
        hud = document.createElement('div');
        hud.className = 'disc__hud';
        disc.appendChild(hud);
    }

    let base = _findDirectDiscChildByClass(face, 'disc__base-image');
    if (!base) {
        base = document.createElement('div');
        base.className = 'disc__base-image';
        face.appendChild(base);
    }

    let overlay = _findDirectDiscChildByClass(face, 'disc__overlay-image');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'disc__overlay-image';
        face.appendChild(overlay);
    }

    const childrenToMove = [];
    for (const child of Array.from(disc.childNodes)) {
        if (child === face || child === hud) continue;
        childrenToMove.push(child);
    }
    for (const child of childrenToMove) {
        hud.appendChild(child);
    }

    return { face, base, overlay, hud };
}

function getDiscHudRoot(disc) {
    const skeleton = ensureDiscSkeleton(disc);
    return (skeleton && skeleton.hud) ? skeleton.hud : disc;
}

function applyDiscRenderState(disc, renderState = {}) {
    if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;

    const blackValue = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const whiteValue = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = (renderState.owner !== undefined && renderState.owner !== null)
        ? renderState.owner
        : (disc.classList && disc.classList.contains('white') ? whiteValue : blackValue);
    const ownerDescriptor = _resolveDiscOwnerDescriptor(owner);
    const requestedRenderMode = renderState.renderMode || 'base-only';
    const baseImage = renderState.baseImage || ownerDescriptor.baseImage;
    const overlayImage = renderState.overlayImage || null;
    const overlayScale = Number(renderState.scale);
    const imageState = _resolveDiscImageState(renderState, baseImage);
    const renderMode = ((requestedRenderMode === 'replace' || requestedRenderMode === 'overlay') && !overlayImage)
        ? 'base-only'
        : requestedRenderMode;
    const fallbackColor = imageState === 'fallback'
        ? (
            Object.prototype.hasOwnProperty.call(renderState, 'baseFallbackColor')
                ? renderState.baseFallbackColor
                : ownerDescriptor.fallbackColor
        )
        : 'transparent';

    ensureDiscSkeleton(disc);

    try { disc.dataset.renderMode = renderMode; } catch (e) { /* ignore */ }
    try { disc.dataset.effect = renderState.effectKey || 'normal'; } catch (e) { /* ignore */ }
    try { disc.dataset.imageState = imageState; } catch (e) { /* ignore */ }
    try { disc.style.setProperty('--disc-base-image', baseImage); } catch (e) { /* ignore */ }
    try { disc.style.setProperty('--stone-image', baseImage); } catch (e) { /* ignore */ }
    try { disc.style.setProperty('--disc-base-fallback-color', fallbackColor || 'transparent'); } catch (e) { /* ignore */ }
    try { disc.style.removeProperty('--disc-base-color'); } catch (e) { /* ignore */ }

    if (overlayImage) {
        try { disc.style.setProperty('--disc-overlay-image', overlayImage); } catch (e) { /* ignore */ }
        try { disc.style.setProperty('--special-stone-image', overlayImage); } catch (e) { /* ignore */ }
    } else {
        try { disc.style.removeProperty('--disc-overlay-image'); } catch (e) { /* ignore */ }
        try { disc.style.removeProperty('--special-stone-image'); } catch (e) { /* ignore */ }
    }

    if (Number.isFinite(overlayScale) && overlayScale > 0 && overlayScale !== 1) {
        try { disc.style.setProperty('--disc-overlay-scale', String(overlayScale)); } catch (e) { /* ignore */ }
    } else {
        try { disc.style.removeProperty('--disc-overlay-scale'); } catch (e) { /* ignore */ }
    }
}

// Expose in CommonJS for tests and in browser globals for legacy callers
function setDiscStoneImage(disc, val) {
    applyDiscRenderState(disc, {
        owner: val,
        renderMode: 'base-only',
        effectKey: 'normal'
    });
}

// Expose in CommonJS for tests and in browser globals for legacy callers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderBoard,
        renderBoardFull,
        updateOccupancyUI,
        ensureDiscSkeleton,
        getDiscHudRoot,
        applyDiscRenderState,
        setDiscStoneImage
    };
}
if (typeof window !== 'undefined') {
    // Prefer board-renderer as the canonical renderBoard implementation.
    window.renderBoard = renderBoard;
    window.updateOccupancyUI = window.updateOccupancyUI || updateOccupancyUI;
    window.ensureDiscSkeleton = window.ensureDiscSkeleton || ensureDiscSkeleton;
    window.getDiscHudRoot = window.getDiscHudRoot || getDiscHudRoot;
    window.applyDiscRenderState = window.applyDiscRenderState || applyDiscRenderState;
    window.setDiscStoneImage = window.setDiscStoneImage || setDiscStoneImage;
}
