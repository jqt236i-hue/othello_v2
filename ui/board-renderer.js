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
function renderBoard() {
    // Single Visual Writer: skip renders during active playback
    if (typeof window !== 'undefined' && window.VisualPlaybackActive === true) {
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
                pending.type === 'INHERIT_WILL' ||
                pending.type === 'TEMPT_WILL'
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
function renderBoardFull() {
    // Single Visual Writer: skip renders during active playback
    if (typeof window !== 'undefined' && window.VisualPlaybackActive === true) {
        return;
    }
    boardEl.innerHTML = '';
    const player = gameState.currentPlayer;
    const context = CardLogic.getCardContext(cardState);
    const legalMoves = getLegalMoves(gameState, player, context);
    const legalSet = new Set(legalMoves.map(m => m.row + ',' + m.col));
    const playerKey = getPlayerKey(player);
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const freePlacementActive = pending && pending.type === 'FREE_PLACEMENT';
    const isSelectingTarget = !!(
        pending && (
            pending.stage === 'selectTarget' ||
            pending.type === 'DESTROY_ONE_STONE' ||
            pending.type === 'SWAP_WITH_ENEMY' ||
            pending.type === 'INHERIT_WILL' ||
            pending.type === 'TEMPT_WILL'
        )
    );
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const selectableTargetSet = new Set(selectableTargets.map(p => p.row + ',' + p.col));
    const isHumanTurn = (gameState.currentPlayer === BLACK) ||
        (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE);
    const showLegalHints = isHumanTurn && !isSelectingTarget;

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const specialMap = new Map();
    const bombMap = new Map();
    for (const m of markers) {
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
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

    // Helper for effect key mapping: delegate to canonical visual-effects map
    const getEffectKeyForType = (type) => {
        if (typeof getEffectKeyForSpecialType === 'function') return getEffectKeyForSpecialType(type);
        const map = {
            'PROTECTED': 'protectedStoneTemporary',
            'PERMA_PROTECTED': 'protectedStone',
            'DRAGON': 'ultimateDragon',
            'BREEDING': 'breedingStone',
            'ULTIMATE_DESTROY_GOD': 'ultimateDestroyGod',
            'HYPERACTIVE': 'hyperactiveStone',
            'GOLD': 'goldStone',
            'SILVER': 'silverStone',
            'REGEN': 'regenStone',
            'WORK': 'workStone'
        };
        return map[type] || null;
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
            }
            if (isHumanTurn && selectableTargetSet.has(key)) {
                cell.classList.add('selectable-friendly');
            }

            const val = gameState.board[r][c];
            if (val !== EMPTY) {
                const disc = document.createElement('div');
                disc.className = 'disc ' + (val === BLACK ? 'black' : 'white');
                // Set element-level CSS var for the overlay image (used by .disc::after)
                setDiscStoneImage(disc, val);

                // Unified special stone visual effect
                const special = specialMap.get(key);
                if (special) {
                    const effectKey = getEffectKeyForType(special.type);
                    if (effectKey) {
                        applyStoneVisualEffect(disc, effectKey, { owner: getOwnerVal(special.owner) });
                    }

                    // Ensure WORK visuals are applied even if mapping returns null
                    if (special.type === 'WORK') {
                        applyStoneVisualEffect(disc, 'workStone', { owner: getOwnerVal(special.owner) });
                    }

                    // Add timer for effects with remaining turns
                    if (special.remainingOwnerTurns !== undefined) {
                        const timer = document.createElement('div');
                        timer.className =
                            special.type === 'DRAGON' ? 'dragon-timer'
                                : (special.type === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
                                    : (special.type === 'BREEDING' ? 'breeding-timer'
                                        : (special.type === 'WORK' ? 'work-timer' : 'special-timer')));
                        const remaining = special.remainingOwnerTurns;
                        timer.textContent = special.type === 'DRAGON'
                            ? Math.min(5, remaining)
                            : (special.type === 'BREEDING'
                                ? Math.min(3, remaining)
                                : (special.type === 'ULTIMATE_DESTROY_GOD' ? Math.min(3, remaining)
                                    : (special.type === 'WORK' ? Math.min(5, remaining) : remaining)));
                        disc.appendChild(timer);
                    }
                }

                // 爆弾チェック
                const bomb = bombMap.get(key);
                if (bomb) {
                    const bombOwner = getOwnerVal(bomb.owner);
                    disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
                    const timeLabel = document.createElement('div');
                    timeLabel.className = 'bomb-timer';
                    timeLabel.textContent = bomb.remainingTurns;
                    disc.appendChild(timeLabel);
                }

                cell.appendChild(disc);
            }

            cell.addEventListener('click', () => handleCellClick(r, c));
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

// Expose in CommonJS for tests and in browser globals for legacy callers
function setDiscStoneImage(disc, val) {
    try { disc.style.setProperty('--stone-image', (val === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)')); } catch (e) {}
}

// Expose in CommonJS for tests and in browser globals for legacy callers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderBoard,
        renderBoardFull,
        updateOccupancyUI,
        setDiscStoneImage
    };
}
if (typeof window !== 'undefined') {
    // Prefer board-renderer as the canonical renderBoard implementation.
    window.renderBoard = renderBoard;
    window.updateOccupancyUI = window.updateOccupancyUI || updateOccupancyUI;
}
