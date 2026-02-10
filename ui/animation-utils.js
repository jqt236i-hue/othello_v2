/**
 * @file animation-utils.js
 * @description アニメーションユーティリティ
 * 石の配置・破壊・フェードアウトアニメーションを担当
 */
// Shared animation helpers (normalized) - resolved lazily via AnimationResolver
let __anim_res_utils = null;
try { __anim_res_utils = (typeof require === 'function') ? require('./animation-resolver') : (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); } catch (e) { __anim_res_utils = (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); }
function _getAnimationShared() { return (__anim_res_utils && typeof __anim_res_utils.getAnimationShared === 'function') ? __anim_res_utils.getAnimationShared() : null; }
function _isNoAnim() { const fn = (__anim_res_utils && typeof __anim_res_utils.isNoAnim === 'function') ? __anim_res_utils.isNoAnim() : function () { return false; }; return fn(); }
function _Timer() { return (__anim_res_utils && typeof __anim_res_utils.getTimer === 'function') ? __anim_res_utils.getTimer() : (function () {
    if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
    return {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
    };
})(); }
/**
 * 破壊アニメーション
 * Animate destruction at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
function animateDestroyAt(row, col, options) {
    // Unified destroy path: use the same fade-out logic as DESTROY playback.
    return animateFadeOutAt(row, col, options);
}

/**
 * フェードアウトアニメーション（破壊用）
 * Animate fade-out at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
function animateFadeOutAt(row, col, options) {
    const opts = options || {};
    return new Promise(resolve => {
        const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
        const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return resolve();
        let disc = cell.querySelector('.disc');
        let createdGhost = false;
        if (!disc && opts.createGhost) {
            disc = document.createElement('div');
            const color = opts.color;
            disc.className = 'disc ' + (color === BLACK ? 'black' : 'white');
            // Ensure it doesn't interfere with clicks
            disc.style.pointerEvents = 'none';
            cell.appendChild(disc);
            createdGhost = true;

            // Optional: apply special stone visual to match expected look before fading out
            if (opts.effectKey && typeof applyStoneVisualEffect === 'function') {
                applyStoneVisualEffect(disc, opts.effectKey, { owner: color });
            }
        }
        if (!disc) return resolve();

        // If already animating, resolve immediately
        if (disc.classList.contains('destroy-fade')) return resolve();

        const noAnim = _isNoAnim();
        if (noAnim) {
            if (createdGhost && disc.parentElement) {
                disc.parentElement.removeChild(disc);
            }
            return resolve();
        }

        // Ensure fade-out isn't overridden by other animation classes (e.g. leftover 'flip')
        disc.classList.remove('flip', 'shatter', 'breeding-spawn');
        void disc.offsetWidth;

        let resolved = false;
        let timerId = null;
        const safeResolve = () => {
            if (resolved) return;
            resolved = true;
            disc.removeEventListener('animationend', onEnd);
            if (timerId !== null) {
                try { _Timer().clearTimeout(timerId); } catch (e) {}
                timerId = null;
            }
            if (createdGhost && disc.parentElement) {
                disc.parentElement.removeChild(disc);
            }
            resolve();
        };

        // Safety timeout (DESTROY_FADE_MS + 200ms)
        const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS) ? SharedConstants.DESTROY_FADE_MS : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
        const startTs = Date.now();

        const onEnd = (ev) => {
            // Guard: if animationend fires immediately (duration 0), wait for the expected fade window.
            try {
                const elapsed = Date.now() - startTs;
                if (elapsed < fadeMs) return;
            } catch (e) { /* ignore */ }
            safeResolve();
        };
            const useAnimationEnd = !opts.createGhost; // Keep this line for clarity
        if (useAnimationEnd) disc.addEventListener('animationend', onEnd);
        disc.classList.add('destroy-fade');

        timerId = _Timer().setTimeout(safeResolve, fadeMs + 200);
    });
}

/**
 * 強い意志付与のフェードイン
 * @param {number} row
 * @param {number} col
 * @returns {Promise<void>}
 */
function animateStrongWillApply(row, col) {
    return new Promise(resolve => {
        const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return resolve();
        const disc = cell.querySelector('.disc');
        if (!disc) return resolve();

        // If no animations mode, resolve immediately
        if (_isNoAnim()) {
            resolve();
            return;
        }

        // Restart animation if needed
        disc.classList.remove('strong-will-apply');
        void disc.offsetWidth;
        disc.classList.add('strong-will-apply');

        let resolved = false;
        const safeResolve = () => {
            if (resolved) {
                return;
            }
            resolved = true;
            disc.removeEventListener('animationend', onEnd);
            disc.classList.remove('strong-will-apply');
            resolve();
        };
        const onEnd = (ev) => {
            safeResolve();
        };
        disc.addEventListener('animationend', onEnd);
        // Safety timeout
        const timerId = _Timer().setTimeout(safeResolve, 600);
    });
}

/**
 * 石配置アニメーション
 * Play hand animation for stone placement
 * @param {number} player - プレイヤー (BLACK or WHITE)
 * @param {number} row - 行
 * @param {number} col - 列
 * @param {Function} onComplete - 完了コールバック
 */
function playHandAnimation(player, row, col, onComplete) {
    const syncCardAnimating = (locked) => {
        if (typeof isCardAnimating !== 'undefined') isCardAnimating = !!locked;
        if (typeof window !== 'undefined') window.isCardAnimating = !!locked;
    };
    const refreshCardUi = () => {
        try {
            if (typeof renderCardUI === 'function') renderCardUI();
        } catch (e) { /* ignore */ }
    };
    const unlockProcessing = () => {
        if (typeof window !== 'undefined') window.isProcessing = false; else isProcessing = false;
    };
    if (typeof window !== 'undefined') window.isProcessing = true; else isProcessing = true; // Lock interactions

    const targetCell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (!targetCell) {
        unlockProcessing();
        syncCardAnimating(false);
        refreshCardUi();
        onComplete();
        return;
    }

    // No-Animation: short-circuit to immediate completion without toggling isCardAnimating
    if (_isNoAnim()) {
        // Ensure processing isn't left locked and call onComplete synchronously
        unlockProcessing();
        syncCardAnimating(false);
        refreshCardUi();
        onComplete();
        return;
    }

    // Mark that a UI card animation is in progress so Auto loop waits for visual completion
    syncCardAnimating(true);
    // Safety: clear the flag after a maximum duration in case animationend doesn't fire
    const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
    let handAnimationTimeout = _Timer().setTimeout(() => {
        syncCardAnimating(false);
        refreshCardUi();
    }, 3000, sc);

    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = targetCell.getBoundingClientRect();

    // Setup Hand
    handLayer.style.display = 'block';
    heldStone.style.display = 'block';
    heldStone.className = 'held-stone ' + (player === BLACK ? 'black' : 'white');

    // Calculate Position
    const cellCenterX = cellRect.left + (cellRect.width / 2);
    const cellCenterY = cellRect.top + (cellRect.height / 2);
    const wrapW = 120; // Matches CSS

    let startY, dropY, rotation, scale;

    if (player === BLACK) {
        // Human: From Bottom
        rotation = 0;
        scale = 0.8;
        dropY = cellCenterY - 55;
        startY = boardRect.bottom + 50;
    } else {
        // CPU: From Top
        rotation = 180;
        scale = 0.7;
        dropY = cellCenterY - 290;
        startY = boardRect.top - 250;
    }

    const dropX = cellCenterX - (wrapW / 2);

    // Set initial state
    handWrapper.style.transform = `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;

    // 1. Approach
    const approachAnim = handWrapper.animate([
        { transform: `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` },
        { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` }
    ], {
        duration: 400,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
    });

    approachAnim.onfinish = () => {
        // 2. Place (Bobbing effect)
        const bobOffset = (player === BLACK) ? 10 : -10;

        const placeAnim = handWrapper.animate([
            { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` },
            { transform: `translate(${dropX}px, ${dropY + bobOffset}px) rotate(${rotation}deg) scale(${scale * 0.95})` },
            { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` }
        ], {
            duration: 150,
            easing: 'ease-in-out'
        });

        // Reflect placement immediately when the hand starts the place motion.
        heldStone.style.display = 'none';
        // --- SOUND TRIGGER --- ensure audio context then play
        SoundEngine.init();
        SoundEngine.playStoneClack();
        onComplete(); // Trigger game logic immediately

        placeAnim.onfinish = () => {
            // 3. Retreat
            const retreatAnim = handWrapper.animate([
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 300,
                easing: 'ease-in',
                fill: 'forwards'
            });

            retreatAnim.onfinish = () => {
                handLayer.style.display = 'none';
                // Animation fully finished; clear card-animating flag and safety timeout
                if (handAnimationTimeout) {
                    _Timer().clearTimeout(handAnimationTimeout);
                    handAnimationTimeout = null;
                }
                syncCardAnimating(false);
                unlockProcessing();
                refreshCardUi();
            };
        };
    };
}

/**
 * ドロー時のハンド演出
 * Hand carries a card from deck to hand area.
 * @param {{player:string|number, cardId?:string|null, count?:number}} payload
 * @returns {Promise<void>}
 */
function playDrawCardHandAnimation(payload) {
    const data = payload || {};
    const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const toPlayerKey = (data.player === 'black' || data.player === blackVal || data.player === 1) ? 'black' : 'white';

    return new Promise(resolve => {
        const done = () => {
            try {
                if (typeof window !== 'undefined') window.__drawHandAnimActive = false;
            } catch (e) { /* ignore */ }
            try {
                if (typeof window !== 'undefined') {
                    window.__handFadeInHint = { playerKey: toPlayerKey, count: Number.isFinite(data.count) ? data.count : 1 };
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof renderCardUI === 'function') renderCardUI();
                const handSelector = toPlayerKey === 'black' ? '#hand-black' : '#hand-white';
                const latestCard = document.querySelector(`${handSelector} .card-item:last-child`);
                if (latestCard) {
                    latestCard.classList.remove('card-fade-prep');
                    latestCard.classList.add('card-fade-in');
                }
                if (typeof window !== 'undefined') {
                    window.__handFadeInHint = null;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.pulseDeckUI === 'function') {
                    __uiImpl.pulseDeckUI();
                }
            } catch (e) { /* ignore */ }

            resolve();
        };

        try {
            if (typeof window !== 'undefined') {
                if (window.__drawHandAnimActive) {
                    done();
                    return;
                }
                const now = Date.now();
                const last = Number(window.__lastDrawAnimAt || 0);
                if (now - last < 80) {
                    done();
                    return;
                }
                window.__lastDrawAnimAt = now;
                window.__drawHandAnimActive = true;
            }
        } catch (e) { /* ignore */ }

        if (_isNoAnim()) {
            done();
            return;
        }

        const deckEl = document.getElementById(toPlayerKey === 'black' ? 'deck-black' : 'deck-white');
        const handEl = document.getElementById(toPlayerKey === 'black' ? 'hand-black' : 'hand-white');
        const layerEl = (typeof handLayer !== 'undefined' && handLayer) ? handLayer : document.getElementById('handLayer');
        const wrapperEl = (typeof handWrapper !== 'undefined' && handWrapper) ? handWrapper : document.getElementById('handWrapper');
        const heldStoneEl = (typeof heldStone !== 'undefined' && heldStone) ? heldStone : document.getElementById('heldStone');

        if (!deckEl || !handEl || !layerEl || !wrapperEl || typeof wrapperEl.animate !== 'function') {
            done();
            return;
        }

        // Draw animation should never show placement stone visual.
        if (heldStoneEl) heldStoneEl.style.display = 'none';

        // Keep lock local to this animation only.
        if (typeof isCardAnimating !== 'undefined') isCardAnimating = true;
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let heldCard = null;
        let timeoutId = _Timer().setTimeout(() => {
            if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
            try { if (typeof window !== 'undefined') window.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
            try {
                if (heldCard && heldCard.parentElement) heldCard.parentElement.removeChild(heldCard);
            } catch (e) { /* ignore */ }
            layerEl.style.display = 'none';
            done();
        }, 2200, sc);

        const deckRect = deckEl.getBoundingClientRect();
        const handRect = handEl.getBoundingClientRect();

        const startX = deckRect.left + deckRect.width / 2 - 60;
        const endX = handRect.left + handRect.width / 2 - 60;
        const fromBottom = toPlayerKey === 'black';
        const startY = deckRect.top + (fromBottom ? -120 : -20);
        const endY = fromBottom ? (handRect.top - 105) : (handRect.top - 70);
        const rotation = fromBottom ? 0 : 180;
        const scale = fromBottom ? 0.76 : 0.72;

        layerEl.style.display = 'block';
        wrapperEl.style.transform = `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;

        heldCard = document.createElement('div');
        heldCard.className = `held-draw-card ${toPlayerKey === 'black' ? 'face-up' : 'face-down'}`;
        wrapperEl.appendChild(heldCard);

        const approach = wrapperEl.animate([
            { transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` },
            { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` }
        ], {
            duration: 140,
            easing: 'ease-out',
            fill: 'forwards'
        });

        approach.onfinish = () => {
            const carry = wrapperEl.animate([
                { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` },
                { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 360,
                easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                fill: 'forwards'
            });

            carry.onfinish = () => {
                // Release near hand and retreat.
                heldCard.style.display = 'none';
                const retreatY = fromBottom ? (handRect.bottom + 70) : (handRect.top - 210);
                const retreat = wrapperEl.animate([
                    { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` },
                    { transform: `translate(${endX}px, ${retreatY}px) rotate(${rotation}deg) scale(${scale})` }
                ], {
                    duration: 220,
                    easing: 'ease-in',
                    fill: 'forwards'
                });

                retreat.onfinish = () => {
                    try {
                        if (heldCard.parentElement) heldCard.parentElement.removeChild(heldCard);
                    } catch (e) { /* ignore */ }
                    layerEl.style.display = 'none';
                    if (timeoutId) {
                        _Timer().clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
                    try { if (typeof window !== 'undefined') window.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
                    done();
                };
            };
        };
    });
}

/**
 * カード使用時のハンド搬送演出
 * Hand carries a used card from hand side to charge UI.
 * @param {{player?:string|number, owner?:string|number, cardId?:string|null, cost?:number|null, name?:string|null}} payload
 * @returns {Promise<void>}
 */
function playCardUseHandAnimation(payload) {
    const data = payload || {};
    const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const owner = (data.owner !== undefined && data.owner !== null) ? data.owner : data.player;
    const ownerKey = (owner === 'black' || owner === blackVal || owner === 1) ? 'black' : 'white';
    const isPlayerSide = ownerKey === 'black';

    return new Promise(resolve => {
        try {
            if (typeof window !== 'undefined') {
                const now = Date.now();
                const last = Number(window.__lastCardUseAnimAt || 0);
                if (now - last < 80) {
                    resolve();
                    return;
                }
                window.__lastCardUseAnimAt = now;
            }
        } catch (e) { /* ignore */ }
        const done = () => resolve();
        const setCardAnimating = (locked) => {
            if (typeof isCardAnimating !== 'undefined') isCardAnimating = !!locked;
            if (typeof window !== 'undefined') window.isCardAnimating = !!locked;
        };

        if (_isNoAnim()) {
            done();
            return;
        }

        const chargeEl = document.getElementById(isPlayerSide ? 'charge-black' : 'charge-white');
        const handEl = document.getElementById(isPlayerSide ? 'hand-black' : 'hand-white');
        const layerEl = (typeof handLayer !== 'undefined' && handLayer) ? handLayer : document.getElementById('handLayer');
        const handSvgEl = document.getElementById('handSvg');
        const heldStoneEl = (typeof heldStone !== 'undefined' && heldStone) ? heldStone : document.getElementById('heldStone');
        if (!chargeEl || !handEl || !layerEl) {
            done();
            return;
        }

        const prevHandSvgVisibility = handSvgEl ? handSvgEl.style.visibility : '';
        if (handSvgEl) handSvgEl.style.visibility = 'hidden';
        const prevHeldStoneDisplay = heldStoneEl ? heldStoneEl.style.display : '';
        if (heldStoneEl) heldStoneEl.style.display = 'none';

        setCardAnimating(true);
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let movingCard = null;
        let timeoutId = _Timer().setTimeout(() => {
            if (movingCard && movingCard.parentElement) {
                try { movingCard.parentElement.removeChild(movingCard); } catch (e) { /* ignore */ }
            }
            if (handSvgEl) handSvgEl.style.visibility = prevHandSvgVisibility;
            if (heldStoneEl) heldStoneEl.style.display = prevHeldStoneDisplay;
            layerEl.style.display = 'none';
            setCardAnimating(false);
            done();
        }, 3200, sc);

        const handRect = handEl.getBoundingClientRect();
        const chargeRect = chargeEl.getBoundingClientRect();
        const explicitSourceCardEl = (data.sourceCardEl && typeof data.sourceCardEl.cloneNode === 'function') ? data.sourceCardEl : null;
        // IMPORTANT:
        // Do not auto-pick "last hand card" as animation source.
        // In AUTO mode the hand can update between decision/apply/render, causing visible card mismatch.
        // Prefer payload(cardId/name/cost) unless an explicit source element is supplied.
        const sourceCardEl = explicitSourceCardEl || null;
        const HOLD_MS = 850;
        const FADE_MS = 420;

        const cardDef = (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardDef === 'function' && data.cardId)
            ? CardLogic.getCardDef(data.cardId)
            : null;
        const cardName = data.name || (cardDef && cardDef.name) || '';
        const cardCost = Number.isFinite(data.cost) ? data.cost : ((cardDef && Number.isFinite(cardDef.cost)) ? cardDef.cost : null);

        layerEl.style.display = 'block';
        movingCard = sourceCardEl ? sourceCardEl.cloneNode(true) : document.createElement('div');
        if (!sourceCardEl) {
            movingCard.className = 'card-item visible';
            if (cardName) {
                const label = document.createElement('span');
                label.className = 'card-name';
                label.textContent = cardName;
                movingCard.appendChild(label);
                if (cardCost !== null) {
                    const badge = document.createElement('div');
                    badge.className = 'card-cost-badge';
                    badge.textContent = `コスト${cardCost}`;
                    movingCard.appendChild(badge);
                }
            }
        }
        movingCard.style.position = 'fixed';
        movingCard.style.pointerEvents = 'none';
        movingCard.style.zIndex = '1300';
        movingCard.style.transform = 'translate(0px, 0px)';
        movingCard.style.margin = '0';
        const srcRect = sourceCardEl ? sourceCardEl.getBoundingClientRect() : null;
        const cardWidth = srcRect ? srcRect.width : 91;
        const cardHeight = srcRect ? srcRect.height : 124;
        const startX = srcRect ? srcRect.left : (handRect.left + handRect.width / 2 - cardWidth / 2);
        const startY = srcRect ? srcRect.top : (handRect.top + handRect.height / 2 - cardHeight / 2);
        const targetX = chargeRect.left + chargeRect.width / 2 - cardWidth / 2;
        const targetY = isPlayerSide ? (chargeRect.top - cardHeight - 10) : (chargeRect.bottom + 10);
        movingCard.style.left = `${startX}px`;
        movingCard.style.top = `${startY}px`;
        movingCard.style.width = `${cardWidth}px`;
        movingCard.style.height = `${cardHeight}px`;
        layerEl.appendChild(movingCard);

        const dx = targetX - startX;
        const dy = targetY - startY;
        const approach = movingCard.animate([
            { transform: 'translate(0px, 0px)' },
            { transform: `translate(${dx}px, ${dy}px)` }
        ], {
            duration: 320,
            easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
            fill: 'forwards'
        });

        approach.onfinish = () => {
            const bob = isPlayerSide ? -8 : 8;
            const present = movingCard.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: `translate(${dx}px, ${dy + bob}px)` },
                { transform: `translate(${dx}px, ${dy}px)` }
            ], {
                duration: 170,
                easing: 'ease-in-out',
                fill: 'forwards'
            });

            present.onfinish = () => {
                const holdId = _Timer().setTimeout(() => {
                    const fade = movingCard.animate([
                        { opacity: 1 },
                        { opacity: 0 }
                    ], {
                        duration: FADE_MS,
                        easing: 'ease-out',
                        fill: 'forwards'
                    });
                    fade.onfinish = () => {
                        try {
                            if (movingCard.parentElement) movingCard.parentElement.removeChild(movingCard);
                        } catch (e) { /* ignore */ }
                        if (handSvgEl) handSvgEl.style.visibility = prevHandSvgVisibility;
                        if (heldStoneEl) heldStoneEl.style.display = prevHeldStoneDisplay;
                        layerEl.style.display = 'none';
                        if (timeoutId) {
                            _Timer().clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        setCardAnimating(false);
                        done();
                    };
                }, HOLD_MS, sc);
                if (holdId == null) {
                    // noop
                }
            };
        };
    });
}


/**
 * 多動石の移動アニメーション
 * Smoothly translate a disc from source cell to target cell.
 * @param {{row:number,col:number}} from
 * @param {{row:number,col:number}} to
 * @returns {Promise<void>}
 */
function animateHyperactiveMove(from, to) {
    return new Promise(resolve => {
        const fromCell = boardEl.querySelector(`.cell[data-row="${from.row}"][data-col="${from.col}"]`);
        const toCell = boardEl.querySelector(`.cell[data-row="${to.row}"][data-col="${to.col}"]`);
        if (!fromCell || !toCell) return resolve();

        let fromDisc = fromCell.querySelector('.disc');
        let sourceCell = fromCell;
        // Fallback for race: board may already be in "after" state (disc exists only at destination).
        if (!fromDisc) {
            const toDisc = toCell.querySelector('.disc');
            if (!toDisc) return resolve();
            fromDisc = toDisc;
            sourceCell = toCell;
        }
        // Move visuals must not inherit destroy/disappear state.
        fromDisc.classList.remove('destroy-fade', 'shatter');

        const fxLayer = document.getElementById('card-fx-layer') || boardEl;
        const fxRect = fxLayer.getBoundingClientRect();
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();

        // Follow the board grid linearly (cell-to-cell), including future multi-cell moves.
        const discScale = 0.82;
        const discInsetRatio = (1 - discScale) / 2;
        const startX = (fromRect.left - fxRect.left) + fromRect.width * discInsetRatio;
        const startY = (fromRect.top - fxRect.top) + fromRect.height * discInsetRatio;
        const endX = (toRect.left - fxRect.left) + toRect.width * discInsetRatio;
        const endY = (toRect.top - fxRect.top) + toRect.height * discInsetRatio;
        const travelPx = Math.hypot(toRect.left - fromRect.left, toRect.top - fromRect.top);
        const cellStepPx = Math.max(1, Math.min(fromRect.width, fromRect.height));
        const cellDistance = Math.max(1, travelPx / cellStepPx);
        const baseMoveMs = (typeof window !== 'undefined' && window.AnimationConstants && Number.isFinite(window.AnimationConstants.MOVE_MS))
            ? window.AnimationConstants.MOVE_MS
            : 300;
        const durationMs = Math.round(baseMoveMs * cellDistance);

// No-Animation: perform immediate move
    if (typeof _isNoAnim === 'function' && _isNoAnim()) {
        try {
            if (fromDisc.parentElement === fromCell) {
                fromCell.removeChild(fromDisc);
            }
            toCell.appendChild(fromDisc);
        } catch (e) { /* ignore */ }
        return resolve();
    }

    const ghost = fromDisc.cloneNode(true);
        ghost.classList.remove('destroy-fade', 'shatter');
        ghost.classList.add('hyperactive-move-ghost');
        ghost.style.position = 'absolute';
        ghost.style.left = `${startX}px`;
        ghost.style.top = `${startY}px`;
        ghost.style.width = `${fromRect.width * discScale}px`;
        ghost.style.height = `${fromRect.height * discScale}px`;
        ghost.style.pointerEvents = 'none';

        // Hide source disc; board re-render after the animation will remove it
        fromDisc.style.visibility = 'hidden';
        fxLayer.appendChild(ghost);

        const anim = ghost.animate([
            { transform: 'translate(0px, 0px)' },
            { transform: `translate(${endX - startX}px, ${endY - startY}px)` }
        ], {
            duration: durationMs,
            easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
            fill: 'forwards'
        });

        let finished = false;
        let timeoutId = null;
        const finish = () => {
            if (finished) return;
            finished = true;
            if (timeoutId !== null) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
            // Materialize the moved disc immediately so multiple hyperactive moves
            // don't look like teleporting/reappearing after a batch re-render.
            // (Final board state is still synced by emitBoardUpdate().)
            try {
                // Remove any existing disc in target (should be empty, but guard against stale DOM)
                const existing = toCell.querySelector('.disc');
                if (existing && existing !== fromDisc) {
                    existing.remove();
                }
                fromDisc.style.visibility = '';
                if (sourceCell === fromCell && fromDisc.parentElement === fromCell) {
                    fromCell.removeChild(fromDisc);
                }
                toCell.appendChild(fromDisc);
            } catch (e) {
                // ignore DOM move errors; board will re-render after this animation anyway
            }
            resolve();
        };

        anim.addEventListener('finish', finish, { once: true });
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        timeoutId = _Timer().setTimeout(finish, durationMs + 220, sc);
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animateDestroyAt,
        animateFadeOutAt,
        playHandAnimation,
        playDrawCardHandAnimation,
        playCardUseHandAnimation,
        animateHyperactiveMove,
        animateStrongWillApply
    };
}

if (typeof window !== 'undefined') {
    window.playDrawCardHandAnimation = playDrawCardHandAnimation;
    window.playCardUseHandAnimation = playCardUseHandAnimation;
}
