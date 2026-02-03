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
    const unlockProcessing = () => {
        if (typeof window !== 'undefined') window.isProcessing = false; else isProcessing = false;
    };
    if (typeof window !== 'undefined') window.isProcessing = true; else isProcessing = true; // Lock interactions

    const targetCell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (!targetCell) {
        unlockProcessing();
        if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
        onComplete();
        return;
    }

    // No-Animation: short-circuit to immediate completion without toggling isCardAnimating
    if (_isNoAnim()) {
        // Ensure processing isn't left locked and call onComplete synchronously
        unlockProcessing();
        if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
        onComplete();
        return;
    }

    // Mark that a UI card animation is in progress so Auto loop waits for visual completion
    if (typeof isCardAnimating !== 'undefined') isCardAnimating = true;
    // Safety: clear the flag after a maximum duration in case animationend doesn't fire
    const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
    let handAnimationTimeout = _Timer().setTimeout(() => { if (typeof isCardAnimating !== 'undefined') isCardAnimating = false; }, 3000, sc);

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

        // Drop stone midway
        _Timer().setTimeout(() => {
            heldStone.style.display = 'none';
            // --- SOUND TRIGGER --- ensure audio context then play
            SoundEngine.init();
            SoundEngine.playStoneClack();

            onComplete(); // Trigger game logic
        }, 100);

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
                if (typeof isCardAnimating !== 'undefined') isCardAnimating = false;
                unlockProcessing();
            };
        };
    };
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

        const fromDisc = fromCell.querySelector('.disc');
        if (!fromDisc) return resolve();

        const fxLayer = document.getElementById('card-fx-layer') || boardEl;
        const fxRect = fxLayer.getBoundingClientRect();
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const discRect = fromDisc.getBoundingClientRect();

        // Preserve the disc's actual offset inside the cell to avoid curved/stepped motion
        const offsetX = discRect.left - fromRect.left;
        const offsetY = discRect.top - fromRect.top;
        const startX = discRect.left - fxRect.left;
        const startY = discRect.top - fxRect.top;
        const endX = (toRect.left - fxRect.left) + offsetX;
        const endY = (toRect.top - fxRect.top) + offsetY;

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
        ghost.classList.add('hyperactive-move-ghost');
        ghost.style.position = 'absolute';
        ghost.style.left = `${startX}px`;
        ghost.style.top = `${startY}px`;
        ghost.style.width = `${discRect.width}px`;
        ghost.style.height = `${discRect.height}px`;
        ghost.style.pointerEvents = 'none';

        // Hide source disc; board re-render after the animation will remove it
        fromDisc.style.visibility = 'hidden';
        fxLayer.appendChild(ghost);

        const anim = ghost.animate([
            { transform: 'translate(0px, 0px)' },
            { transform: `translate(${endX - startX}px, ${endY - startY}px)` }
        ], {
            duration: 260,
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
                if (fromDisc.parentElement === fromCell) {
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
        timeoutId = _Timer().setTimeout(finish, 400, sc);
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animateDestroyAt,
        animateFadeOutAt,
        playHandAnimation,
        animateHyperactiveMove,
        animateStrongWillApply
    };
}
