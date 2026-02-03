/**
 * Stone Visual Cross-Fade Utility
 * 
 * Provides smooth, non-disappearing cross-fade transitions for stone visual changes.
 * Uses CSS transitions + requestAnimationFrame for precise timing.
 * 
 * @module ui/stone-visuals
 */

/**
 * Cross-fade a stone's visual appearance using opacity transitions
 * 
 * @param {HTMLElement} disc - The disc element to animate
 * @param {Object} options - Animation options
 * @param {string} options.effectKey - The stone effect key (e.g., 'regenStone')
 * @param {number} [options.owner] - Owner color (BLACK or WHITE)
 * @param {number} [options.durationMs=600] - Fade duration in milliseconds
 * @param {boolean} [options.fadeIn=true] - Whether to fade in (true) or out (false)
 * @param {boolean} [options.autoFadeOut=false] - Auto fade-out after fade-in
 * @returns {Promise<void>}
 * 
 * @example
 * // Fade in regen stone
 * await crossfadeStoneVisual(disc, { effectKey: 'regenStone', owner: BLACK });
 * 
 * // Fade out
 * await crossfadeStoneVisual(disc, { effectKey: 'regenStone', fadeIn: false });
 * 
 * // Auto fade-in then fade-out
 * await crossfadeStoneVisual(disc, { 
 *   effectKey: 'regenStone', 
 *   owner: BLACK,
 *   autoFadeOut: true 
 * });
 */

// Shared animation helpers (normalized)
var AnimationShared = (typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
var _isNoAnim = (AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () { return false; };
var _Timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer : function () {
    if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
    return {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
    };
};
// If global NOANIM mode is active, mark the root element so CSS fallbacks can disable
// transitions/animations as a safety net (no behavioral change when not present).
try {
    if (typeof window !== 'undefined' && _isNoAnim() && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.add('no-anim');
    }
} catch (e) { }

async function crossfadeStoneVisual(disc, options = {}) {
    console.log('[VISUAL_DEBUG] crossfadeStoneVisual invoked', options && options.effectKey);
    // Simplified: remove overlay-based cross-fade and apply final visual state immediately.
    // This function no longer performs opacity transitions or creates overlays.
    const {
        effectKey,
        owner,
        newColor = null, // Optional: new stone color (BLACK=1, WHITE=-1)
        fadeWholeStone = false // kept for compatibility with callers
    } = options;

    if (!disc || !disc.parentElement) return;

    // Apply final color immediately
    if (newColor !== null) {
        disc.classList.remove('black', 'white');
        disc.classList.add(newColor === 1 ? 'black' : 'white');
    }

    // Apply visual effect immediately (no animation)
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        try { console.log('[VISUAL_DEBUG] crossfade attempting applyStoneVisualEffect', effectKey); } catch (e) {}
        try { applyStoneVisualEffect(disc, effectKey, { owner }); } catch (e) { console.warn('[VISUAL_DEBUG] applyStoneVisualEffect threw', e); }
        try { console.log('[VISUAL_DEBUG] crossfade after apply classes:', disc && disc.className); } catch (e) {}
    }

    // Clean up any overlay remnants if present
    try {
        const overlay = disc.parentElement.querySelector('.stone-fade-overlay');
        if (overlay) overlay.remove();
    } catch (e) { }

    // Ensure disc is visible and not instant-hidden
    disc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
    try { disc.style.opacity = ''; } catch (e) { }

    return;
}

// Export for window or module systems
if (typeof window !== 'undefined') {
    window.crossfadeStoneVisual = crossfadeStoneVisual;
}

// --- Additional helpers: centralize stone DOM helpers used across UI ---
const TIME_BOMB_TURNS = (typeof CardLogic !== 'undefined' && Number.isFinite(CardLogic.TIME_BOMB_TURNS))
    ? CardLogic.TIME_BOMB_TURNS
    : 3;

function setDiscColorAt(row, col, color) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc) return;
    disc.classList.remove('black', 'white');
    disc.classList.add(color === (typeof BLACK !== 'undefined' ? BLACK : 1) ? 'black' : 'white');
}

function removeBombOverlayAt(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc) return;
    disc.classList.remove('bomb', 'bomb-black', 'bomb-white');
    const timer = disc.querySelector('.bomb-timer');
    if (timer) timer.remove();
    const icon = disc.querySelector('.bomb-icon');
    if (icon) icon.remove();
}

function clearAllStoneVisualEffectsAt(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc) return;

    disc.classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
    delete disc.dataset.ud;
    delete disc.dataset.breeding;

    // Remove any known visual-effect classes without touching gameplay/animation classes.
    try {
        if (typeof STONE_VISUAL_EFFECTS !== 'undefined' && STONE_VISUAL_EFFECTS) {
            for (const k of Object.keys(STONE_VISUAL_EFFECTS)) {
                const eff = STONE_VISUAL_EFFECTS[k];
                if (eff && eff.cssClass) disc.classList.remove(eff.cssClass);
            }
        }
    } catch (e) {
        // visuals only
    }

    // Clear CSS vars used by overlay visuals.
    disc.style.removeProperty('--special-stone-image');
    disc.style.removeProperty('--dragon-image-path');
    disc.style.removeProperty('--breeding-image-path');
}

function syncDiscVisualToCurrentState(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc) return;

    // Bomb overlay is separate from STONE_VISUAL_EFFECTS.
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    let bomb = null;
    if (cardState && Array.isArray(cardState.markers)) {
        bomb = cardState.markers.find(m => m.kind === markerKinds.BOMB && m.row === row && m.col === col) || null;
        if (bomb && bomb.data) {
            bomb = { row, col, remainingTurns: bomb.data.remainingTurns, owner: bomb.owner };
        }
    }
    if (!bomb) {
        removeBombOverlayAt(row, col);
    } else {
        const bombOwner = (bomb.owner === 'black' || bomb.owner === BLACK || bomb.owner === 1) ? BLACK : WHITE;
        disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
        if (!disc.querySelector('.bomb-timer')) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = bomb.remainingTurns;
            disc.appendChild(timeLabel);
        } else {
            try { disc.querySelector('.bomb-timer').textContent = bomb.remainingTurns; } catch (e) { /* ignore */ }
        }
    }

    clearAllStoneVisualEffectsAt(row, col);

    let special = null;
    if (cardState && Array.isArray(cardState.markers)) {
        const s = cardState.markers.find(m => m.kind === markerKinds.SPECIAL_STONE && m.row === row && m.col === col) || null;
        if (s && s.data) {
            special = { row, col, type: s.data.type, owner: s.owner, remainingOwnerTurns: s.data.remainingOwnerTurns, regenRemaining: s.data.regenRemaining };
        }
    }
    if (!special) return;

    const ownerVal = (special.owner === 'black') ? BLACK : (special.owner === 'white') ? WHITE : (Number.isFinite(special.owner) ? special.owner : null);
    const effectKey = (typeof getEffectKeyForSpecialType === 'function') ? getEffectKeyForSpecialType(special.type) : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        // [Regen Fix] Do not show icon if regen is already consumed (until turn end)
        if (special.type === 'REGEN' && (special.regenRemaining || 0) <= 0) return;
        applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
    }
}

function applyPendingSpecialstoneVisual(move, pendingType) {
    if (!pendingType) return;

    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const placedCell = root.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
    const disc = placedCell ? placedCell.querySelector('.disc') : null;
    if (!disc) return;

    if (pendingType === 'TIME_BOMB') {
        const ownerClass = move.player === BLACK ? 'bomb-black' : 'bomb-white';
        disc.classList.add('bomb', 'special-stone', ownerClass);
        if (!disc.querySelector('.bomb-timer')) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = TIME_BOMB_TURNS;
            disc.appendChild(timeLabel);
        }
    }

    const effectKey = (typeof getEffectKeyForPendingType === 'function') ? getEffectKeyForPendingType(pendingType) : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function') applyStoneVisualEffect(disc, effectKey, { owner: move.player });
}

if (typeof window !== 'undefined') {
    // Expose helpers to legacy consumers
    try { window.StoneVisuals = window.StoneVisuals || {}; Object.assign(window.StoneVisuals, { crossfadeStoneVisual, setDiscColorAt, removeBombOverlayAt, clearAllStoneVisualEffectsAt, syncDiscVisualToCurrentState, applyPendingSpecialstoneVisual }); } catch (e) {}
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { crossfadeStoneVisual, setDiscColorAt, removeBombOverlayAt, clearAllStoneVisualEffectsAt, syncDiscVisualToCurrentState, applyPendingSpecialstoneVisual };
}
