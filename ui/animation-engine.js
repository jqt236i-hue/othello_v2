/**
 * @file animation-engine.js
 * @description The "Single Visual Writer" – Centralized event-driven animation engine.
 * strictly adheres to 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./animation-constants'),
            require('./stone-visuals')
        );
    } else {
        root.AnimationEngine = factory(root.AnimationConstants, { crossfadeStoneVisual: root.crossfadeStoneVisual });
    }
}(typeof self !== 'undefined' ? self : this, function (Constants, Visuals) {

    const { EVENT_TYPES, FLIP_MS, PHASE_GAP_MS, FADE_IN_MS, FADE_OUT_MS, OVERLAY_CROSSFADE_MS, MOVE_MS } = Constants;

    // Shared animation helpers (resolved lazily via AnimationResolver)
    let __anim_res = null;
    try { __anim_res = (typeof require === 'function') ? require('./animation-resolver') : (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); } catch (e) { __anim_res = (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); }
    function _getAnimationShared() { return (__anim_res && typeof __anim_res.getAnimationShared === 'function') ? __anim_res.getAnimationShared() : null; }
    function _isNoAnim() { const fn = (__anim_res && typeof __anim_res.isNoAnim === 'function') ? __anim_res.isNoAnim() : function () { return false; }; return fn(); }
    function _Timer() { return (__anim_res && typeof __anim_res.getTimer === 'function') ? __anim_res.getTimer() : (function () {
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

    // Ensure minimal telemetry helpers exist even without initializeUI
    if (typeof window !== 'undefined') {
        window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
        if (typeof window.getTelemetrySnapshot !== 'function') {
            window.getTelemetrySnapshot = function () { return Object.assign({}, window.__telemetry__); };
        }
        if (typeof window.resetTelemetry !== 'function') {
            window.resetTelemetry = function () { window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };
        }
    }

    // use the _Timer from AnimationShared (declared above) to avoid duplication

    class PlaybackEngine {
        constructor() {
            this.isPlaying = false;
            this.boardEl = document.getElementById('board');
            this.isAborted = false;
            this.playbackScope = null;
            this._remainingEvents = [];
            this._watchdogId = null;
        }

        /**
         * Play a sequence of PlaybackEvents.
         * @param {Array} events - Ordered PlaybackEvents
         * @returns {Promise<void>}
         */
        async play(events) {
            // No events: just ensure flags are clean and return.
            if (!events || events.length === 0) {
                this.setGlobalInteractionLock(false);
                if (typeof window !== 'undefined') window.VisualPlaybackActive = false;
                return;
            }

            // Only suppress DiffRenderer's fallback flip animation when this playback actually includes flip events.
            // Otherwise, if flip events were dropped (e.g., missing BoardOps CHANGE events), suppressing would remove
            // the last-resort visual cue and make flips appear instantaneous.
            const shouldSuppressNextDiffFlip = events.some(e => e && e.type === EVENT_TYPES.FLIP);

            if (this.isPlaying) {
                console.warn('[AnimationEngine] Already playing. Aborting previous...');
                this.isAborted = true;
                // Wait a short settle period
                await new Promise(r => _Timer().setTimeout(r, 100));
                this.isAborted = false;
            }

            // Setup playback scope and flags
            this.isPlaying = true;
            this.playbackScope = (typeof TimerRegistry !== 'undefined' && TimerRegistry.newScope) ? TimerRegistry.newScope() : null;
                // expose scope for animations to register timers under
                if (typeof window !== 'undefined') window._currentPlaybackScope = this.playbackScope;

            // VisualPlaybackActive is the single source of truth during playback
            try {
                window.VisualPlaybackActive = true;
                this.setGlobalInteractionLock(true);

                // Watchdog to prevent permanent freezes
                const WATCHDOG_TIMEOUT_MS = (typeof window !== 'undefined' && Number.isFinite(window.PLAYBACK_WATCHDOG_MS)) ? window.PLAYBACK_WATCHDOG_MS : 10000;
                if (this.playbackScope !== null) {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS, this.playbackScope);
                } else {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS);
                }

                // Group by phase
                const phases = this.groupByPhase(events);
                const sortedPhases = Object.keys(phases).sort((a, b) => Number(a) - Number(b));

                for (const phase of sortedPhases) {
                    if (this.isAborted) break;

                    // Remove processed phases from remainingEvents
                    this._remainingEvents = this._remainingEvents.filter(ev => Number(ev.phase || 0) > Number(phase));

                    const phaseEvents = phases[phase];
                    await this.executePhase(phaseEvents);

                    // Gap between readable phases (Section 3)
                    if (phase !== sortedPhases[sortedPhases.length - 1]) {
                        // Avoid a noticeable delay between "place/spawn" and immediate flips.
                        // Visually, flips should start as soon as possible after the move is applied.
                        const nextPhaseKey = sortedPhases[sortedPhases.indexOf(phase) + 1];
                        const nextEvents = phases[nextPhaseKey] || [];
                        const hasPlaceOrSpawn = phaseEvents.some(e => e && (e.type === EVENT_TYPES.PLACE || e.type === EVENT_TYPES.SPAWN));
                        const nextHasFlip = nextEvents.some(e => e && e.type === EVENT_TYPES.FLIP);
                        if (!(hasPlaceOrSpawn && nextHasFlip)) {
                            await this._sleep(PHASE_GAP_MS);
                        }
                    }
                }
            } catch (err) {
                console.error('[AnimationEngine] Playback error:', err);
            } finally {
                // cleanup watchdog & scope
                if (this.playbackScope !== null) {
                    _Timer().clearScope(this.playbackScope);
                    this.playbackScope = null;
                }
                // remove exposed scope
                if (typeof window !== 'undefined' && window._currentPlaybackScope) delete window._currentPlaybackScope;
                if (this._watchdogId) {
                    _Timer().clearTimeout(this._watchdogId);
                    this._watchdogId = null;
                }
                this.isPlaying = false;
                this.setGlobalInteractionLock(false);
                window.VisualPlaybackActive = false;

                 // One-shot flag for DiffRenderer:
                 // After playback, AnimationEngine triggers `emitBoardUpdate()` to sync any non-animated UI (timers, hints).
                 // DiffRenderer has a fallback "owner changed => add .flip" animation which would otherwise replay flips,
                 // making stones appear to flip twice. This flag is consumed/cleared by ui/diff-renderer.js.
                 if (shouldSuppressNextDiffFlip) {
                     try { window.__suppressNextDiffFlip = true; } catch (e) { /* ignore */ }
                 }
                 // After playback completes, request a final board diff render to ensure DOM matches state.
                 // This avoids stale visuals when diff rendering was suppressed during playback.
                 try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
             }
        }

        groupByPhase(events) {
            return events.reduce((acc, ev) => {
                const p = ev.phase || 0;
                if (!acc[p]) acc[p] = [];
                acc[p].push(ev);
                return acc;
            }, {});
        }

        async executePhase(phaseEvents) {
            // Batch flip events within the same phase so that multiple flips animate together.
            const flips = phaseEvents.filter(ev => ev && ev.type === EVENT_TYPES.FLIP);
            const nonFlips = phaseEvents.filter(ev => !ev || ev.type !== EVENT_TYPES.FLIP);

            const promises = [];
            if (flips.length) promises.push(this.executeFlipBatch(flips));
            if (nonFlips.length) promises.push(...nonFlips.map(ev => this.executeEvent(ev)));
            await Promise.all(promises);
        }

        async _sleep(ms) {
            if (_isNoAnim()) return Promise.resolve();
            return new Promise(resolve => {
                const id = _Timer().setTimeout(resolve, ms, this.playbackScope);
            });
        }

        async handleWatchdog() {
            console.warn('[AnimationEngine] WATCHDOG fired. Forcing playback abort and sync.');
            // Telemetry increment
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.watchdogFired = (window.__telemetry__.watchdogFired || 0) + 1; }
            // Clear timers in this scope and mark aborted
            try {
                if (this.playbackScope !== null) _Timer().clearScope(this.playbackScope);
            } catch (e) { /* best-effort */ }
            this.isAborted = true;
            // Apply final state by requesting a full board sync
            try {
                if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
            } catch (e) { console.error('[AnimationEngine] watchdog emitBoardUpdate failed', e); }
            // Ensure flags cleared
            this.setGlobalInteractionLock(false);
            window.VisualPlaybackActive = false;
        }

        // Abort externally and apply final state (used by Single Visual Writer fallback)
        abortAndSync() {
            console.warn('[AnimationEngine] abortAndSync called — stopping playback and syncing state');
            // Telemetry increment for aborts
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.abortCount = (window.__telemetry__.abortCount || 0) + 1; }
            try {
                if (this.playbackScope !== null) _Timer().clearScope(this.playbackScope);
            } catch (e) { }
            this.isAborted = true;
            this.setGlobalInteractionLock(false);
            window.VisualPlaybackActive = false;
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { }
        }

        async executeEvent(ev) {
            switch (ev.type) {
                case EVENT_TYPES.PLACE:
                    return this.handlePlace(ev);
                case EVENT_TYPES.FLIP:
                    return this.handleFlip(ev);
                case EVENT_TYPES.DESTROY:
                    return this.handleDestroy(ev);
                case EVENT_TYPES.SPAWN:
                    return this.handleSpawn(ev);
                case EVENT_TYPES.MOVE:
                    return this.handleMove(ev);
                case EVENT_TYPES.STATUS_APPLIED:
                case EVENT_TYPES.STATUS_REMOVED:
                    return this.handleStatusChange(ev);
                case EVENT_TYPES.LOG:
                    this.log(ev.message);
                    return Promise.resolve();
                default:
                    console.warn('[AnimationEngine] Unhandled event type:', ev.type);
                    // Fallback: apply state immediately (Section 1.1)
                    this.applyFinalStates(ev);
                    return Promise.resolve();
            }
        }

        // --- Visual Primitive Handlers ---

        async handlePlace(ev) {
            for (const t of ev.targets) {
                const cell = this.getCellEl(t.r, t.col);
                if (!cell) continue;

                const after = t.after || {};
                const disc = this.createDisc(after);

                // Section 5.1: Disc appears with final color/visuals immediately.
                // Optional fade-in.
                cell.innerHTML = '';
                cell.appendChild(disc);

                disc.classList.add('stone-instant', 'stone-hidden-all');
                disc.offsetHeight; // force reflow
                disc.classList.remove('stone-instant');
                disc.classList.remove('stone-hidden-all');
                // FADE_IN_MS is handled by CSS transition on .disc
            }
            // Do not block subsequent phases (e.g., immediate flips) on fade-in.
            return Promise.resolve();
        }

        async handleFlip(ev) {
            const promises = ev.targets.map(async t => {
                const cell = this.getCellEl(t.r, t.col);
                if (!cell) return;
                const disc = cell.querySelector('.disc');
                if (!disc) {
                    // If the disc is already removed, create a ghost and animate fade directly.
                    try {
                        const ghost = document.createElement('div');
                        let ownerColor = null;
                        if (t && (t.ownerBefore === 'black' || t.ownerBefore === 'white')) {
                            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
                            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
                            ownerColor = (t.ownerBefore === 'black') ? blackVal : whiteVal;
                        }
                        ghost.className = 'disc ' + ((ownerColor === (typeof BLACK !== 'undefined' ? BLACK : 1)) ? 'black' : 'white');
                        ghost.style.pointerEvents = 'none';
                        ghost.classList.add('destroy-fade');
                        cell.appendChild(ghost);
                        await this._sleep(FADE_OUT_MS);
                        if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
                    } catch (e) { /* ignore */ }
                    return;
                }

                const after = t.after || {};

                // More natural flip: animate immediately and swap the visual state at mid-flip.
                // This makes the color change feel simultaneous with the flip motion.
                if (_isNoAnim()) {
                    this.syncDiscVisual(disc, after);
                    try { disc.classList.remove('flip'); } catch (e) { }
                    return;
                }

                // Best-effort: set a "before" visual if the payload provides it.
                // If not provided, keep the current DOM visual as-is.
                try {
                    if (t.ownerBefore === 'black' || t.ownerBefore === 'white') {
                        const before = { color: (t.ownerBefore === 'black') ? 1 : -1, special: t.specialBefore || null, timer: t.timerBefore || null };
                        this.syncDiscVisual(disc, before);
                    }
                } catch (e) { /* ignore */ }

                // Trigger flip animation immediately
                try { const _as = _getAnimationShared(); if (_as && _as.triggerFlip) _as.triggerFlip(disc); } catch (e) { /* defensive */ }

                // Swap visuals exactly mid-way so color change aligns with motion start
                await this._sleep(FLIP_MS / 2);
                this.syncDiscVisual(disc, after);

                // Finish motion and clean up
                await this._sleep(FLIP_MS / 2);
                try { const _as = _getAnimationShared(); if (_as && _as.removeFlip) _as.removeFlip(disc); } catch (e) { }
            });
            await Promise.all(promises);
        }

        // Batch handler so that multiple flips in the same phase animate simultaneously
        async executeFlipBatch(flipEvents) {
            const allTargets = [];
            for (const ev of flipEvents) {
                for (const t of ev.targets || []) {
                    allTargets.push(t);
                }
            }
            if (!allTargets.length) return;
            // Reuse handleFlip logic with a synthetic event that contains all targets
            await this.handleFlip({ targets: allTargets });
        }

        async handleDestroy(ev) {
            const promises = ev.targets.map(async t => {
                const cell = this.getCellEl(t.r, t.col);
                const disc = cell?.querySelector('.disc');
                if (!disc) return;

                // Section 5.3: Fade out using animateFadeOutAt (waits for animationend + safety timeout)
                if (typeof animateFadeOutAt === 'function') {
                    let ownerColor = null;
                    if (t && (t.ownerBefore === 'black' || t.ownerBefore === 'white')) {
                        const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
                        const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
                        ownerColor = (t.ownerBefore === 'black') ? blackVal : whiteVal;
                    }
                    await animateFadeOutAt(t.r, t.col, { createGhost: true, color: ownerColor });

                    // If no destroy-fade is visible (e.g., disc removed too early), force a ghost fade.
                    try {
                        const hasFade = cell.querySelector('.disc.destroy-fade');
                        if (!hasFade) {
                            const ghost = document.createElement('div');
                            const ownerClass = (ownerColor === (typeof BLACK !== 'undefined' ? BLACK : 1)) ? 'black' : 'white';
                            ghost.className = 'disc ' + ownerClass;
                            ghost.style.pointerEvents = 'none';
                            ghost.classList.add('destroy-fade');
                            cell.appendChild(ghost);
                            await this._sleep(FADE_OUT_MS);
                            if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
                        }
                    } catch (e) { /* ignore */ }
                } else {
                    // Fallback: apply class and sleep
                    if (!disc) return;
                    disc.classList.add('destroy-fade');
                    await this._sleep(FADE_OUT_MS);
                }
                cell.innerHTML = '';
            });
            await Promise.all(promises);
        }

        async handleSpawn(ev) {
            // Spawn is similar to place but explicitly for card-induced spawning
            return this.handlePlace(ev);
        }

        async handleMove(ev) {
            const promises = ev.targets.map(async t => {
                const fromCell = this.getCellEl(t.from.r, t.from.col);
                const toCell = this.getCellEl(t.to.r, t.to.col);
                const disc = fromCell?.querySelector('.disc');
                if (!disc || !toCell) return;

                // Section 5.5: Straight-line interpolation via ghost
                const fromRect = fromCell.getBoundingClientRect();
                const toRect = toCell.getBoundingClientRect();

                // If no-animations mode, skip animation and perform immediate DOM move
                if (_isNoAnim()) {
                    try {
                        toCell.innerHTML = '';
                        disc.style.visibility = 'visible';
                        toCell.appendChild(disc);
                        fromCell.innerHTML = '';
                    } catch (e) {
                        // best-effort
                    }
                    return;
                }

                const ghost = disc.cloneNode(true);
                ghost.classList.add('stone-instant');
                document.body.appendChild(ghost);

                ghost.style.position = 'fixed';
                ghost.style.top = `${fromRect.top + fromRect.height * 0.09}px`;
                ghost.style.left = `${fromRect.left + fromRect.width * 0.09}px`;
                ghost.style.width = `${fromRect.width * 0.82}px`;
                ghost.style.height = `${fromRect.height * 0.82}px`;
                ghost.style.margin = '0';
                ghost.style.zIndex = '1000';

                disc.style.visibility = 'hidden';

                const anim = ghost.animate([
                    { transform: 'translate(0, 0)' },
                    { transform: `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)` }
                ], {
                    duration: MOVE_MS,
                    easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)'
                });

                await anim.finished;

                // Cleanup
                toCell.innerHTML = '';
                disc.style.visibility = 'visible';
                toCell.appendChild(disc);
                fromCell.innerHTML = '';
                ghost.remove();
            });
            await Promise.all(promises);
        }

        async handleStatusChange(ev) {
            const promises = ev.targets.map(async t => {
                const disc = await this.waitForDisc(t.r, t.col, 4);
                if (!disc) return;

                const after = t.after || {};
                const effectKey = window.getEffectKeyForSpecialType(after.special);

                // Section 1.5: True Cross-Fade via overlay
                if (Visuals.crossfadeStoneVisual) {
                    await Visuals.crossfadeStoneVisual(disc, {
                        effectKey: effectKey,
                        owner: after.color, // Usually owner is same as color for these
                        durationMs: OVERLAY_CROSSFADE_MS,
                        newColor: after.color,
                        fadeIn: !!after.special
                    });
                    // Ensure timer UI is updated immediately after status changes.
                    this.syncDiscVisual(disc, after);
                } else {
                    this.syncDiscVisual(disc, after);
                }
            });
            await Promise.all(promises);
        }

        // --- Helpers ---

        getCellEl(r, c) {
            return this.boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        }

        async waitForDisc(r, c, attempts) {
            let remaining = Number.isFinite(attempts) ? attempts : 1;
            while (remaining > 0) {
                const cell = this.getCellEl(r, c);
                const disc = cell ? cell.querySelector('.disc') : null;
                if (disc) return disc;
                remaining -= 1;
                await new Promise(resolve => {
                    try {
                        requestAnimationFrame(() => setTimeout(resolve, 0));
                    } catch (e) {
                        setTimeout(resolve, 0);
                    }
                });
            }
            return null;
        }

        createDisc(state) {
            const disc = document.createElement('div');
            disc.className = 'disc';
            this.syncDiscVisual(disc, state);
            return disc;
        }

        syncDiscVisual(disc, state) {
            if (!state) return;
            disc.classList.remove('black', 'white');
            if (state.color === 1) disc.classList.add('black');
            else if (state.color === -1) disc.classList.add('white');

            if (state.special) {
                const effectKey = window.getEffectKeyForSpecialType(state.special);
                if (window.applyStoneVisualEffect && effectKey) {
                    const ownerVal = (state.owner !== undefined && state.owner !== null) ? state.owner : state.color;
                    window.applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
                }
            } else {
                // Clear all special icons
                disc.classList.remove('special-stone');
                disc.style.removeProperty('--special-stone-image');
            }

            // Timer handling
            const existingTimer = disc.querySelector('.stone-timer');
            if (state.timer != null && state.timer > 0) {
                if (!existingTimer) {
                    const timer = document.createElement('div');
                    timer.className = 'stone-timer bomb-timer'; // reuse class for now
                    timer.textContent = state.timer;
                    disc.appendChild(timer);
                } else {
                    existingTimer.textContent = state.timer;
                }
            } else if (existingTimer) {
                existingTimer.remove();
            }
        }

        applyFinalStates(ev) {
            // Fallback: use per-target provided 'after' states when available
            for (const t of ev.targets || []) {
                const state = t.after || { color: 0, special: null, timer: null };
                const [r, c] = [t.r, t.col];
                const cell = this.getCellEl(r, c);
                if (!cell) continue;
                if (state.color === 0) {
                    cell.innerHTML = '';
                } else {
                    let disc = cell.querySelector('.disc');
                    if (!disc) {
                        disc = this.createDisc(state);
                        cell.appendChild(disc);
                    }
                    this.syncDiscVisual(disc, state);
                }
            }
        }

        setGlobalInteractionLock(locked) {
            window.isProcessing = locked;
            window.isCardAnimating = locked; // legacy flag
            // VisualPlaybackActive is the single source of truth for playback state
            window.VisualPlaybackActive = locked;
            if (this.boardEl) {
                if (locked) this.boardEl.classList.add('playback-locked');
                else this.boardEl.classList.remove('playback-locked');
            }
        }

        log(msg) {
            if (window.addLog) window.addLog(msg);
            else console.log('[LOG]', msg);
        }
    }

    return new PlaybackEngine();
}));
