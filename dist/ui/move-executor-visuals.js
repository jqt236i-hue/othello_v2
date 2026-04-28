"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let AnimationShared = (typeof _require === 'function') ? _require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
let PlaybackStateModule = (typeof _require === 'function') ? (function () {
    try {
        return _require('./playback-state-manager');
    }
    catch (e) {
        return (typeof window !== 'undefined' ? window.PlaybackStateManager : null);
    }
}()) : (typeof window !== 'undefined' ? window.PlaybackStateManager : null);
let AnimationUtilsModule = (typeof _require === 'function') ? (function () {
    try {
        return _require('./animation-utils');
    }
    catch (e) {
        return (typeof window !== 'undefined' ? window : null);
    }
}()) : (typeof window !== 'undefined' ? window : null);
function _isPlaybackActiveForLegacyVisuals() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return false;
}
function _assertNotDuringPlayback() {
    if (_isPlaybackActiveForLegacyVisuals()) {
        if (typeof window !== 'undefined' && window.__DEV__ === true) {
            throw new Error('Legacy visual helper called during active VisualPlayback (dev fail-fast)');
        }
        else {
            console.error('Legacy visual helper called during active VisualPlayback. Aborting playback and syncing final state (prod fallback)');
            if (typeof window !== 'undefined') {
                window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
                window.__telemetry__.singleVisualWriterHits = (window.__telemetry__.singleVisualWriterHits || 0) + 1;
            }
            if (typeof AnimationEngine !== 'undefined' && AnimationEngine && typeof AnimationEngine.abortAndSync === 'function') {
                AnimationEngine.abortAndSync();
            }
            return false;
        }
    }
    return true;
}
let _isNoAnim = (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () {
    try {
        if (typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true)
            return true;
        if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search))
            return true;
        if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1'))
            return true;
    }
    catch (e) { }
    return false;
};
function applyFlipAnimations(flipsToAnimate) {
    if (!_assertNotDuringPlayback())
        return;
    requestAnimationFrame(() => {
        flipsToAnimate.forEach(([r, c]) => {
            const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            const disc = cell ? cell.querySelector('.disc') : null;
            if (disc) {
                if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
                    AnimationShared.removeFlip(disc);
                }
                else {
                    disc.classList.remove('flip');
                }
                void disc.offsetWidth;
                console.log(`Suppressed flip animation for (${r},${c})`);
            }
        });
    });
}
const StoneVisuals = (typeof _require === 'function') ? _require('./stone-visuals') : (typeof window !== 'undefined' ? window.StoneVisuals : null);
function setDiscColorAt(row, col, color) {
    if (!_assertNotDuringPlayback())
        return;
    if (StoneVisuals && typeof StoneVisuals.setDiscColorAt === 'function')
        return StoneVisuals.setDiscColorAt(row, col, color);
    const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    disc.classList.remove('black', 'white');
    disc.classList.add(color === BLACK ? 'black' : 'white');
    if (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function') {
        window.setDiscStoneImage(disc, color);
    }
}
function removeBombOverlayAt(row, col) {
    if (!_assertNotDuringPlayback())
        return;
    if (StoneVisuals && typeof StoneVisuals.removeBombOverlayAt === 'function')
        return StoneVisuals.removeBombOverlayAt(row, col);
    const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    disc.classList.remove('bomb', 'bomb-black', 'bomb-white');
    const timer = disc.querySelector('.bomb-timer');
    if (timer)
        timer.remove();
    const icon = disc.querySelector('.bomb-icon');
    if (icon)
        icon.remove();
}
function clearAllStoneVisualEffectsAt(row, col) {
    if (!_assertNotDuringPlayback())
        return;
    if (StoneVisuals && typeof StoneVisuals.clearAllStoneVisualEffectsAt === 'function')
        return StoneVisuals.clearAllStoneVisualEffectsAt(row, col);
    const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    disc.classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
    delete disc.dataset.ud;
    delete disc.dataset.breeding;
    try {
        if (typeof STONE_VISUAL_EFFECTS !== 'undefined' && STONE_VISUAL_EFFECTS) {
            for (const k of Object.keys(STONE_VISUAL_EFFECTS)) {
                const eff = STONE_VISUAL_EFFECTS[k];
                if (eff && eff.cssClass)
                    disc.classList.remove(eff.cssClass);
            }
        }
    }
    catch (e) {
        // visuals only
    }
    disc.style.removeProperty('--special-stone-image');
    disc.style.removeProperty('--disc-overlay-image');
    disc.style.removeProperty('--disc-overlay-scale');
    disc.style.removeProperty('--dragon-image-path');
    disc.style.removeProperty('--breeding-image-path');
    if (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function') {
        window.setDiscStoneImage(disc, disc.classList.contains('white') ? WHITE : BLACK);
    }
}
function syncDiscVisualToCurrentState(row, col) {
    if (!_assertNotDuringPlayback())
        return;
    if (StoneVisuals && typeof StoneVisuals.syncDiscVisualToCurrentState === 'function')
        return StoneVisuals.syncDiscVisualToCurrentState(row, col);
    const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const isBombCategoryMarker = (marker) => {
        if (!marker || typeof marker !== 'object')
            return false;
        if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
        const category = String(data && data.category ? data.category : '').trim().toLowerCase();
        const type = String(data && data.type ? data.type : '').trim().toUpperCase();
        return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
    };
    let bomb = null;
    if (cardState && Array.isArray(cardState.markers)) {
        bomb = (typeof MarkersAdapter !== 'undefined'
            && MarkersAdapter
            && typeof MarkersAdapter.findBombMarkerAt === 'function')
            ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
            : (cardState.markers.find((m) => isBombCategoryMarker(m) && m.row === row && m.col === col) || null);
        if (bomb && bomb.data) {
            bomb = { row, col, remainingTurns: bomb.data.remainingTurns, owner: bomb.owner };
        }
    }
    if (!bomb) {
        removeBombOverlayAt(row, col);
    }
    else {
        const bombOwner = (bomb.owner === 'black' || bomb.owner === BLACK || bomb.owner === 1) ? BLACK : WHITE;
        disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
        if (!disc.querySelector('.bomb-timer')) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = bomb.remainingTurns;
            disc.appendChild(timeLabel);
        }
        else {
            try {
                disc.querySelector('.bomb-timer').textContent = bomb.remainingTurns;
            }
            catch (e) { /* ignore */ }
        }
    }
    clearAllStoneVisualEffectsAt(row, col);
    let special = null;
    if (cardState && Array.isArray(cardState.markers)) {
        const s = cardState.markers.find((m) => (m.kind === markerKinds.SPECIAL_STONE
            && !isBombCategoryMarker(m)
            && m.row === row
            && m.col === col)) || null;
        if (s && s.data) {
            special = { row, col, type: s.data.type, owner: s.owner, remainingOwnerTurns: s.data.remainingOwnerTurns, regenRemaining: s.data.regenRemaining };
        }
    }
    if (!special)
        return;
    const ownerVal = (special.owner === 'black') ? BLACK : (special.owner === 'white') ? WHITE : (Number.isFinite(special.owner) ? special.owner : null);
    const effectKey = (typeof getEffectKeyForSpecialType === 'function') ? getEffectKeyForSpecialType(special.type) : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        if (special.type === 'REGEN' && (special.regenRemaining || 0) <= 0) {
            return;
        }
        applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
    }
}
const TIME_BOMB_TURNS = (typeof CardLogic !== 'undefined' && Number.isFinite(CardLogic.TIME_BOMB_TURNS))
    ? CardLogic.TIME_BOMB_TURNS
    : 3;
function getFlipAnimMs() {
    return (typeof FLIP_ANIMATION_DURATION_MS !== 'undefined' && Number.isFinite(FLIP_ANIMATION_DURATION_MS))
        ? FLIP_ANIMATION_DURATION_MS
        : 600;
}
function getPhaseGapMs() {
    return (typeof PHASE_GAP_MS !== 'undefined' && Number.isFinite(PHASE_GAP_MS))
        ? PHASE_GAP_MS
        : 200;
}
function getTurnTransitionGapMs() {
    return (typeof TURN_TRANSITION_GAP_MS !== 'undefined' && Number.isFinite(TURN_TRANSITION_GAP_MS))
        ? TURN_TRANSITION_GAP_MS
        : getPhaseGapMs();
}
async function animateFlipsWithDeferredColor(flips, fromColor, toColor, options) {
    if (!_assertNotDuringPlayback())
        return;
    if (!flips || flips.length === 0)
        return;
    const opts = arguments[3] && typeof arguments[3] === 'object' ? arguments[3] : {};
    const skipVisualSync = opts.skipVisualSync || null;
    const applyColorAfterFlip = !!opts.applyColorAfterFlip;
    const delay = getFlipAnimMs();
    const discsToAnimate = [];
    if (applyColorAfterFlip) {
        for (const [r, c] of flips) {
            setDiscColorAt(r, c, fromColor);
            if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
                syncDiscVisualToCurrentState(r, c);
            }
            const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            const disc = cell ? cell.querySelector('.disc') : null;
            if (!disc)
                continue;
            discsToAnimate.push({ r, c, disc });
        }
        await new Promise(resolve => requestAnimationFrame(() => {
            for (const { r, c, disc } of discsToAnimate) {
                if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
                    AnimationShared.removeFlip(disc);
                }
                else {
                    disc.classList.remove('flip');
                }
                void disc.offsetWidth;
                console.log(`Deferred flip suppressed for (${r},${c}) with color-after option`);
            }
            setTimeout(resolve, delay);
        }));
        for (const [r, c] of flips) {
            setDiscColorAt(r, c, toColor);
            if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
                syncDiscVisualToCurrentState(r, c);
            }
        }
    }
    else {
        for (const [r, c] of flips) {
            setDiscColorAt(r, c, toColor);
            if (!skipVisualSync || !skipVisualSync.has(`${r},${c}`)) {
                syncDiscVisualToCurrentState(r, c);
            }
            const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            const disc = cell ? cell.querySelector('.disc') : null;
            if (!disc)
                continue;
            discsToAnimate.push({ r, c, disc });
        }
        await new Promise(resolve => requestAnimationFrame(() => {
            for (const { r, c, disc } of discsToAnimate) {
                if (typeof AnimationShared !== 'undefined' && AnimationShared && AnimationShared.removeFlip) {
                    AnimationShared.removeFlip(disc);
                }
                else {
                    disc.classList.remove('flip');
                }
                void disc.offsetWidth;
                console.log(`Deferred flip suppressed for (${r},${c})`);
            }
            setTimeout(resolve, delay);
        }));
    }
}
async function animateRegenBack(regenedPositions, flipperColor) {
    if (!_assertNotDuringPlayback())
        return;
    if (!regenedPositions || regenedPositions.length === 0)
        return;
    const ownerColor = -flipperColor;
    const durationMs = 600;
    for (const { row, col } of regenedPositions) {
        const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        const disc = cell ? cell.querySelector('.disc') : null;
        if (!disc)
            continue;
        setDiscColorAt(row, col, ownerColor);
        await crossfadeStoneVisual(disc, {
            effectKey: 'regenStone',
            owner: ownerColor,
            durationMs,
            autoFadeOut: true
        });
    }
}
function applyPendingSpecialstoneVisual(move, pendingType) {
    if (!_assertNotDuringPlayback())
        return;
    if (!pendingType)
        return;
    const placedCell = boardEl.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
    const disc = placedCell ? placedCell.querySelector('.disc') : null;
    if (!disc)
        return;
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
    const effectKey = (typeof getEffectKeyForPendingType === 'function')
        ? getEffectKeyForPendingType(pendingType)
        : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        applyStoneVisualEffect(disc, effectKey, { owner: move.player });
    }
}
function waitForPlaybackIdle() {
    return new Promise(resolve => {
        try {
            if (typeof window === 'undefined')
                return resolve();
            const startDeadline = Date.now() + 250;
            const tick = () => {
                try {
                    if (_isPlaybackActiveForLegacyVisuals()) {
                        const waitEnd = () => {
                            if (!_isPlaybackActiveForLegacyVisuals())
                                return resolve();
                            try {
                                requestAnimationFrame(waitEnd);
                            }
                            catch (e) {
                                setTimeout(waitEnd, 16);
                            }
                        };
                        return waitEnd();
                    }
                    if (Date.now() > startDeadline)
                        return resolve();
                    try {
                        requestAnimationFrame(tick);
                    }
                    catch (e) {
                        setTimeout(tick, 16);
                    }
                }
                catch (e) {
                    resolve();
                }
            };
            try {
                requestAnimationFrame(tick);
            }
            catch (e) {
                setTimeout(tick, 0);
            }
        }
        catch (e) {
            resolve();
        }
    });
}
async function animateHyperactiveMoveChain(moves) {
    const animateMove = (AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function')
        ? AnimationUtilsModule.animateHyperactiveMove
        : (typeof animateHyperactiveMove === 'function' ? animateHyperactiveMove : null);
    const path = Array.isArray(moves) ? moves.filter((move) => !!(move && move.from && move.to)) : [];
    if (!animateMove || path.length === 0)
        return;
    let carryDisc = null;
    if (path.length > 1 && typeof boardEl !== 'undefined' && boardEl && typeof boardEl.querySelector === 'function') {
        const lastMove = path[path.length - 1];
        const lastToCell = boardEl.querySelector(`.cell[data-row="${lastMove.to.row}"][data-col="${lastMove.to.col}"]`);
        const lastToDisc = lastToCell ? lastToCell.querySelector('.disc') : null;
        if (lastToDisc) {
            carryDisc = lastToDisc;
        }
    }
    for (const move of path) {
        if (carryDisc) {
            await animateMove(move.from, move.to, { carryDisc });
        }
        else {
            await animateMove(move.from, move.to);
        }
    }
}
function hasPlaybackEngine() {
    const engine = (typeof PlaybackEngine !== 'undefined' && PlaybackEngine)
        ? PlaybackEngine
        : ((typeof window !== 'undefined' && window.PlaybackEngine) ? window.PlaybackEngine : null);
    return !!(engine && typeof engine.playPresentationEvents === 'function');
}
async function runMoveVisualSequence(move, hadSelection, phases, effects, immediate) {
    if (!_assertNotDuringPlayback())
        return;
    if (typeof window !== 'undefined') {
        if (window.__moveVisualSequenceActive) {
            console.warn('[Visuals] Reentrant runMoveVisualSequence detected - ignoring to avoid recursion');
            return;
        }
        window.__moveVisualSequenceActive = true;
    }
    try {
        const primaryFlips = phases.primaryFlips || [];
        const chainFlips = phases.chainFlips || [];
        const regenCaptureFlips = phases.regenCaptureFlips || [];
        const regened = phases.regened || [];
        const totalFlipCount = primaryFlips.length + chainFlips.length + regenCaptureFlips.length;
        const movedPlayer = getPlayerName(move.player);
        if (typeof logPlacementEffects === 'function') {
            logPlacementEffects(effects, move.player);
        }
        addLog(LOG_MESSAGES.placedWithFlips(movedPlayer, posToNotation(move.row, move.col), totalFlipCount));
        if (regened.length > 0)
            addLog(LOG_MESSAGES.regenTriggered(regened.length));
        if (regenCaptureFlips.length > 0)
            addLog(LOG_MESSAGES.regenCapture(regenCaptureFlips.length));
        if (typeof resetRenderStats === 'function')
            resetRenderStats();
        if (typeof BoardUpdateDispatch !== 'undefined' && BoardUpdateDispatch && typeof BoardUpdateDispatch.requestBoardUpdate === 'function') {
            BoardUpdateDispatch.requestBoardUpdate();
        }
        else {
            emitBoardUpdate();
        }
        if (hadSelection && typeof emitCardStateChange === 'function')
            emitCardStateChange();
        try {
            if (effects && effects.workPlaced) {
                console.log('[Visuals] workPlaced detected — syncing visuals for placed cell', move.row, move.col);
                syncDiscVisualToCurrentState(move.row, move.col);
                if (typeof ensureWorkVisualsApplied === 'function')
                    ensureWorkVisualsApplied();
            }
            if (effects && effects.hyperactivePlaced) {
                const hasImmediateHyperactiveMove = !!(immediate &&
                    Array.isArray(immediate.hyperactiveMoved) &&
                    immediate.hyperactiveMoved.length > 0);
                if (hasImmediateHyperactiveMove) {
                    console.log('[Visuals] hyperactivePlaced with immediate move detected — syncing placed cell before movement', move.row, move.col);
                    syncDiscVisualToCurrentState(move.row, move.col);
                }
                else {
                    console.log('[Visuals] hyperactivePlaced detected — relying on diff-renderer visuals');
                }
            }
        }
        catch (e) {
            /* defensive */
        }
        if (chainFlips.length > 0) {
            for (const [r, c] of chainFlips)
                setDiscColorAt(r, c, -move.player);
        }
        if (regenCaptureFlips.length > 0) {
            for (const [r, c] of regenCaptureFlips)
                setDiscColorAt(r, c, move.player);
        }
        if (primaryFlips.length > 0) {
            await animateFlipsWithDeferredColor(primaryFlips, -move.player, move.player);
        }
        if (chainFlips.length > 0) {
            await animateFlipsWithDeferredColor(chainFlips, -move.player, move.player);
        }
        if (regened.length > 0) {
            for (const p of regened)
                setDiscColorAt(p.row, p.col, move.player);
            await animateRegenBack(regened, move.player);
        }
        if (regenCaptureFlips.length > 0) {
            await animateFlipsWithDeferredColor(regenCaptureFlips, move.player, -move.player);
        }
        if (immediate.dragonConverted && immediate.dragonConverted.length > 0) {
            const coords = immediate.dragonConverted.map((p) => [p.row, p.col]);
            await animateFlipsWithDeferredColor(coords, -move.player, move.player, { applyColorAfterFlip: true });
        }
        if (immediate.breedingSpawned && immediate.breedingSpawned.length > 0) {
            const BREEDING_FADE_MS = 350;
            for (const spawn of immediate.breedingSpawned) {
                const cell = boardEl.querySelector(`.cell[data-row="${spawn.row}"][data-col="${spawn.col}"]`);
                if (cell) {
                    let disc = cell.querySelector('.disc');
                    if (!disc) {
                        disc = document.createElement('div');
                        disc.className = 'disc ' + (player === BLACK ? 'black' : 'white');
                        cell.appendChild(disc);
                    }
                    else {
                        try {
                            disc.style.opacity = '';
                        }
                        catch (e) { }
                    }
                    await new Promise(resolve => setTimeout(resolve, BREEDING_FADE_MS));
                }
            }
        }
        if (immediate.udgDestroyed && immediate.udgDestroyed.length > 0) {
            for (const p of immediate.udgDestroyed)
                await animateFadeOutAt(p.row, p.col);
        }
        if (immediate.hyperactiveMoved && immediate.hyperactiveMoved.length > 0) {
            for (const m of immediate.hyperactiveMoved) {
                if (typeof animateHyperactiveMove === 'function')
                    await animateHyperactiveMove(m.from, m.to);
            }
        }
        emitGameStateChange();
    }
    finally {
        if (typeof window !== 'undefined')
            window.__moveVisualSequenceActive = false;
    }
}
if (typeof window !== 'undefined') {
    window.applyFlipAnimations = applyFlipAnimations;
    window.setDiscColorAt = setDiscColorAt;
    window.removeBombOverlayAt = removeBombOverlayAt;
    window.clearAllStoneVisualEffectsAt = clearAllStoneVisualEffectsAt;
    window.syncDiscVisualToCurrentState = syncDiscVisualToCurrentState;
    window.getFlipAnimMs = getFlipAnimMs;
    window.getPhaseGapMs = getPhaseGapMs;
    window.getTurnTransitionGapMs = getTurnTransitionGapMs;
    window.animateFlipsWithDeferredColor = animateFlipsWithDeferredColor;
    window.animateRegenBack = animateRegenBack;
    window.applyPendingSpecialstoneVisual = applyPendingSpecialstoneVisual;
    window.waitForPlaybackIdle = waitForPlaybackIdle;
    if (typeof window.runMoveVisualSequence !== 'function')
        window.runMoveVisualSequence = runMoveVisualSequence;
}
try {
    const gameVisuals = _require('../game/move-executor-visuals');
    if (gameVisuals && typeof gameVisuals.setUIImpl === 'function') {
        gameVisuals.setUIImpl({
            applyFlipAnimations,
            setDiscColorAt,
            removeBombOverlayAt,
            clearAllStoneVisualEffectsAt,
            syncDiscVisualToCurrentState,
            getFlipAnimMs,
            getPhaseGapMs,
            getTurnTransitionGapMs,
            animateFlipsWithDeferredColor,
            animateRegenBack,
            animateFadeOutAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateFadeOutAt === 'function'
                ? AnimationUtilsModule.animateFadeOutAt
                : undefined,
            animateDestroyAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateDestroyAt === 'function'
                ? AnimationUtilsModule.animateDestroyAt
                : undefined,
            animateHyperactiveMove: AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function'
                ? AnimationUtilsModule.animateHyperactiveMove
                : undefined,
            animateHyperactiveMoveChain,
            hasPlaybackEngine,
            applyPendingSpecialstoneVisual,
            waitForPlayback: waitForPlaybackIdle,
            runMoveVisualSequence
        });
    }
}
catch (e) { /* not available in some environments */ }
const MoveExecutorVisualsModule = {
    applyFlipAnimations,
    setDiscColorAt,
    removeBombOverlayAt,
    clearAllStoneVisualEffectsAt,
    syncDiscVisualToCurrentState,
    getFlipAnimMs,
    getPhaseGapMs,
    getTurnTransitionGapMs,
    animateFlipsWithDeferredColor,
    animateRegenBack,
    animateFadeOutAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateFadeOutAt === 'function'
        ? AnimationUtilsModule.animateFadeOutAt
        : (typeof animateFadeOutAt === 'function' ? animateFadeOutAt : undefined),
    animateDestroyAt: AnimationUtilsModule && typeof AnimationUtilsModule.animateDestroyAt === 'function'
        ? AnimationUtilsModule.animateDestroyAt
        : (typeof animateDestroyAt === 'function' ? animateDestroyAt : undefined),
    animateHyperactiveMove: AnimationUtilsModule && typeof AnimationUtilsModule.animateHyperactiveMove === 'function'
        ? AnimationUtilsModule.animateHyperactiveMove
        : (typeof animateHyperactiveMove === 'function' ? animateHyperactiveMove : undefined),
    animateHyperactiveMoveChain,
    hasPlaybackEngine,
    applyPendingSpecialstoneVisual,
    waitForPlaybackIdle,
    runMoveVisualSequence
};
module.exports = MoveExecutorVisualsModule;
//# sourceMappingURL=move-executor-visuals.js.map