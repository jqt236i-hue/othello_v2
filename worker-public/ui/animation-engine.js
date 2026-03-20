/**
 * @file animation-engine.js
 * @description The "Single Visual Writer" – Centralized event-driven animation engine.
 * strictly adheres to 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./animation-constants'),
            require('./stone-visuals'),
            require('./playback-state-manager')
        );
    } else {
        root.AnimationEngine = factory(root.AnimationConstants, { crossfadeStoneVisual: root.crossfadeStoneVisual }, root.PlaybackStateManager);
    }
}(typeof self !== 'undefined' ? self : this, function (Constants, Visuals, PlaybackStateManager) {

    const { EVENT_TYPES, FLIP_MS, PHASE_GAP_MS, FADE_IN_MS, BREEDING_SPAWN_FADE_MS, REGEN_CONSUME_FADE_MS, FADE_OUT_MS, OVERLAY_CROSSFADE_MS, MOVE_MS, OBSERVER_BUBBLE_MS, OBSERVER_BUBBLE_FADE_MS } = Constants;
    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const EFFECT_TARGET_HIGHLIGHT_CLASS = 'effect-target-highlight';
    const LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY = '__skipNextPlaybackSoundUntilByKey';

    function hasRegenBackFlip(events) {
        return (events || []).some(e =>
            e &&
            e.type === EVENT_TYPES.FLIP &&
            Array.isArray(e.targets) &&
            e.targets.some(t => t && t.cause === REGEN_CAUSE && t.reason === REGEN_TRIGGER_REASON)
        );
    }

    // Shared animation helpers (deduplicated)
    var AnimationShared = (typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
    var _isNoAnim = (AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () { return false; };
    var OwnerHelpersModule = (function () {
        if (typeof require === 'function') {
            try {
                return require('../utils/owner-helpers');
            } catch (e) {
                return null;
            }
        }
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers) return OwnerHelpers;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) return globalThis.OwnerHelpers;
        } catch (e) { /* ignore */ }
        return null;
    }());
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
    var PlaybackState = PlaybackStateManager || null;

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

    function _getUiRootRef() {
        if (typeof window !== 'undefined' && window) return window;
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e) { /* ignore */ }
        return null;
    }

    function _consumeLocalPlaybackSoundSkip(soundKey) {
        const normalizedKey = String(soundKey || '').trim();
        if (!normalizedKey) return false;
        const rootRef = _getUiRootRef();
        if (!rootRef) return false;
        const registry = rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY];
        if (!registry || typeof registry !== 'object') return false;
        const expiresAt = Number(registry[normalizedKey]);
        if (!Number.isFinite(expiresAt)) return false;
        try {
            delete registry[normalizedKey];
            if (Object.keys(registry).length === 0) {
                delete rootRef[LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY];
            }
        } catch (e) {
            registry[normalizedKey] = 0;
        }
        return expiresAt >= Date.now();
    }

    class PlaybackEngine {
        constructor() {
            this.isPlaying = false;
            this.boardEl = document.getElementById('board');
            this.isAborted = false;
            this._watchdogFired = false;
            this.playbackScope = null;
            this._remainingEvents = [];
            this._watchdogId = null;
            this._phaseContext = null;
        }

        _toBoardIndex(value) {
            if (value === null || typeof value === 'undefined') return null;
            if (typeof value === 'boolean') return null;
            if (typeof value === 'string' && value.trim() === '') return null;
            const n = Number(value);
            if (!Number.isFinite(n)) return null;
            return Math.trunc(n);
        }

        _normalizeCellRef(ref) {
            const src = (ref && typeof ref === 'object') ? ref : {};
            const out = Object.assign({}, src);
            const rowRaw = Object.prototype.hasOwnProperty.call(src, 'r') ? src.r : src.row;
            const colRaw = Object.prototype.hasOwnProperty.call(src, 'col')
                ? src.col
                : (Object.prototype.hasOwnProperty.call(src, 'c') ? src.c : src.column);
            const row = this._toBoardIndex(rowRaw);
            const col = this._toBoardIndex(colRaw);
            if (row !== null) out.r = row;
            if (col !== null) out.col = col;
            return out;
        }

        _normalizeTarget(target, eventType) {
            const src = (target && typeof target === 'object') ? target : {};
            const out = Object.assign({}, src);
            if (eventType === EVENT_TYPES.MOVE) {
                const fallbackFrom = { row: src.prevRow, col: src.prevCol };
                const fallbackTo = { row: src.row, col: src.col };
                out.from = this._normalizeCellRef(src.from || fallbackFrom);
                out.to = this._normalizeCellRef(src.to || fallbackTo);
                return out;
            }
            const normalized = this._normalizeCellRef(src);
            if (Object.prototype.hasOwnProperty.call(normalized, 'r')) out.r = normalized.r;
            if (Object.prototype.hasOwnProperty.call(normalized, 'col')) out.col = normalized.col;
            return out;
        }

        _normalizeEvent(ev) {
            if (!ev || typeof ev !== 'object') return ev;
            const out = Object.assign({}, ev);
            if (Array.isArray(ev.targets)) {
                out.targets = ev.targets.map((t) => this._normalizeTarget(t, ev.type));
            }
            return out;
        }

        _resolveSniperSource(target) {
            const t = (target && typeof target === 'object') ? target : {};
            const meta = (t.meta && typeof t.meta === 'object') ? t.meta : {};
            const sourceRow = this._toBoardIndex(
                Object.prototype.hasOwnProperty.call(t, 'sourceRow') ? t.sourceRow : meta.sourceRow
            );
            const sourceCol = this._toBoardIndex(
                Object.prototype.hasOwnProperty.call(t, 'sourceCol') ? t.sourceCol : meta.sourceCol
            );
            if (sourceRow === null || sourceCol === null) return null;
            return { row: sourceRow, col: sourceCol };
        }

        _resolveRobotVacuumSource(target) {
            return this._resolveSniperSource(target);
        }

        _resolveDestroyDragonSource(target) {
            return this._resolveSniperSource(target);
        }

        _getTargetCause(target) {
            return String(target && target.cause ? target.cause : '').toUpperCase();
        }

        _getTargetReason(target) {
            return String(target && target.reason ? target.reason : '').toLowerCase();
        }

        _isSuperCrushCause(cause) {
            return cause === 'SUPER_BUOYANCY_WILL' || cause === 'SUPER_GRAVITY_WILL';
        }

        _resolveSuperCrushCollisionDelayMs(target) {
            const cause = this._getTargetCause(target);
            if (!this._isSuperCrushCause(cause)) return 0;

            const meta = (target && typeof target.meta === 'object') ? target.meta : null;
            const progressRaw = Number(meta && meta.collisionProgress);
            if (!Number.isFinite(progressRaw)) return 0;

            const moveDurationMs = Math.max(1, Math.round(Number(MOVE_MS) || 400));
            // Keep destroy slightly before move arrival so destination replacement never erases timing.
            const normalizedProgress = Math.max(0, Math.min(0.88, progressRaw));
            const delayMs = Math.round(moveDurationMs * normalizedProgress);
            return delayMs > 0 ? delayMs : 0;
        }

        _resolveOwnerColorFromBefore(ownerBefore) {
            if (ownerBefore !== 'black' && ownerBefore !== 'white') return null;
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
            return ownerBefore === 'black' ? blackVal : whiteVal;
        }

        _resolveOwnerClassFromColor(ownerColor) {
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            return ownerColor === blackVal ? 'black' : 'white';
        }

        _normalizePlayerKeyOptional(value) {
            if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
                const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(value);
                if (normalized === 'black' || normalized === 'white') return normalized;
            }
            if (value === 'black' || value === 1 || value === '1') return 'black';
            if (value === 'white' || value === -1 || value === '-1') return 'white';
            return null;
        }

        _normalizePlayerKey(value) {
            return this._normalizePlayerKeyOptional(value) || 'black';
        }

        _getCurrentMatchMode() {
            try {
                if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
                    return String(OwnerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : null) || 'cpu').toLowerCase();
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function') {
                    return String(window.getCurrentMatchMode() || 'cpu').toLowerCase();
                }
                if (typeof window !== 'undefined' && window) {
                    const matchMode = window.MATCH_MODE || window.__MATCH_MODE;
                    if (matchMode) return String(matchMode).toLowerCase();
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function') {
                    return String(globalThis.getCurrentMatchMode() || 'cpu').toLowerCase();
                }
                if (typeof globalThis !== 'undefined') {
                    const matchMode = globalThis.MATCH_MODE || globalThis.__MATCH_MODE;
                    if (matchMode) return String(matchMode).toLowerCase();
                }
            } catch (e) { /* ignore */ }

            return 'cpu';
        }

        _resolveLocalSeatKey() {
            try {
                if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.resolveLocalPlayerKey === 'function') {
                    return this._normalizePlayerKey(OwnerHelpers.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null));
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                    return this._normalizePlayerKey(window.NetworkMatchClient.getSeatKey());
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && window) {
                    const candidates = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
                    for (const one of candidates) {
                        if (one === 'white' || one === -1 || one === '-1') return 'white';
                        if (one === 'black' || one === 1 || one === '1') return 'black';
                    }
                }
            } catch (e) { /* ignore */ }

            return 'black';
        }

        _resolveCardUseOwnerKey(target) {
            const t = (target && typeof target === 'object') ? target : {};
            if (Object.prototype.hasOwnProperty.call(t, 'owner') && t.owner !== null && typeof t.owner !== 'undefined' && t.owner !== '') {
                return this._normalizePlayerKey(t.owner);
            }
            if (Object.prototype.hasOwnProperty.call(t, 'player') && t.player !== null && typeof t.player !== 'undefined' && t.player !== '') {
                return this._normalizePlayerKey(t.player);
            }
            return null;
        }

        _resolveCardType(cardId) {
            if (!cardId) return null;
            if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getCardDef !== 'function') {
                return null;
            }
            const def = CardLogic.getCardDef(cardId);
            return def && typeof def.type === 'string' ? def.type : null;
        }

        _resolvePlaceHandDescriptor(target) {
            const normalizedTarget = this._normalizeTarget(target, EVENT_TYPES.PLACE_HAND_ANIMATION);
            const playerKey = this._normalizePlayerKeyOptional(
                normalizedTarget && (normalizedTarget.player || normalizedTarget.owner)
            );
            if (!playerKey) return null;
            if (!Number.isInteger(normalizedTarget.r) || !Number.isInteger(normalizedTarget.col)) return null;
            return {
                r: normalizedTarget.r,
                col: normalizedTarget.col,
                playerKey
            };
        }

        _shouldPlayPlaceHandAnimation(target) {
            if (this._getCurrentMatchMode() !== 'network') return false;
            const descriptor = this._resolvePlaceHandDescriptor(target);
            if (!descriptor) return false;
            return descriptor.playerKey !== this._resolveLocalSeatKey();
        }

        _resolvePlayerValue(playerKey) {
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
            return playerKey === 'white' ? whiteVal : blackVal;
        }

        _playCardUseButtonCueForOpponent(target) {
            const ownerKey = this._resolveCardUseOwnerKey(target);
            if (!ownerKey) return;

            const localSeatKey = this._resolveLocalSeatKey();
            if (ownerKey === localSeatKey) return;
            if (this._resolveCardType(target && target.cardId) === 'TREASURE_BOX') return;

            try {
                if (typeof SoundEngine !== 'undefined' && SoundEngine && typeof SoundEngine.playEffectByKey === 'function') {
                    SoundEngine.init();
                    SoundEngine.playEffectByKey('card_use_button');
                }
            } catch (e) { /* ignore */ }
        }

        _isCardEffectCause(cause) {
            return !!cause && cause !== 'SYSTEM';
        }

        _shouldHighlightEffectTarget(eventType, target) {
            if (_isNoAnim()) return false;
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);

            const isGluttonousEatDestroy =
                eventType === EVENT_TYPES.DESTROY &&
                cause === 'GLUTTONOUS_WILL' &&
                reason.indexOf('gluttonous_eat') === 0;
            if (isGluttonousEatDestroy) return false;

            const isFreePlacementPlace =
                (eventType === EVENT_TYPES.PLACE || eventType === EVENT_TYPES.SPAWN) && (
                    cause === 'FREE_PLACEMENT' ||
                    reason.indexOf('free_placement_place') === 0
                );
            if (isFreePlacementPlace) return true;

            if (!this._isCardEffectCause(cause)) return false;
            if (eventType === EVENT_TYPES.MOVE) {
                const isGluttonousEatMove =
                    cause === 'GLUTTONOUS_WILL' &&
                    reason.indexOf('gluttonous_eat_move') === 0;
                const isDestroyEvadeMove =
                    cause === 'DESTROY_EVADE' ||
                    reason.indexOf('destroy_evade_move') === 0;
                return cause === 'STRONG_WIND_WILL' ||
                    cause === 'SUPER_BUOYANCY_WILL' ||
                    cause === 'SUPER_GRAVITY_WILL' ||
                    cause === 'POSITION_SWAP_WILL' ||
                    cause === 'TELEPORT_WILL' ||
                    isGluttonousEatMove ||
                    isDestroyEvadeMove ||
                    reason.indexOf('position_swap') === 0 ||
                    reason.indexOf('strong_wind_move') === 0 ||
                    reason.indexOf('super_buoyancy_move') === 0 ||
                    reason.indexOf('super_gravity_move') === 0 ||
                    reason.indexOf('teleport_move') === 0 ||
                    reason.indexOf('destroy_evade_move') === 0;
            }
            return eventType === EVENT_TYPES.FLIP ||
                eventType === EVENT_TYPES.DESTROY ||
                eventType === EVENT_TYPES.SPAWN ||
                eventType === EVENT_TYPES.PLACE;
        }

        async _runWithEffectTargetHighlight(cell, eventType, target, runner) {
            if (!cell || typeof runner !== 'function') return undefined;

            const shouldHighlight = this._shouldHighlightEffectTarget(eventType, target);
            if (!shouldHighlight) {
                return runner();
            }

            let highlighted = false;
            try {
                cell.classList.add(EFFECT_TARGET_HIGHLIGHT_CLASS);
                highlighted = true;
            } catch (e) { /* ignore */ }

            try {
                return await runner();
            } finally {
                if (highlighted) {
                    try { cell.classList.remove(EFFECT_TARGET_HIGHLIGHT_CLASS); } catch (e) { /* ignore */ }
                }
            }
        }

        _resolveSniperProjectileOwner(target) {
            const t = (target && typeof target === 'object') ? target : {};
            const meta = (t.meta && typeof t.meta === 'object') ? t.meta : {};
            const directOwner = (typeof t.projectileOwner === 'string') ? t.projectileOwner : null;
            const metaOwner = (typeof meta.projectileOwner === 'string') ? meta.projectileOwner : null;
            const owner = (directOwner || metaOwner || '').toLowerCase();
            if (owner === 'black' || owner === 'white') return owner;
            if (t.ownerBefore === 'black') return 'white';
            if (t.ownerBefore === 'white') return 'black';
            return 'black';
        }

        async animateSniperProjectile(target) {
            if (!target) return;
            if (_isNoAnim()) return;

            const source = this._resolveSniperSource(target);
            if (!source) return;

            const fromCell = this.getCellEl(source.row, source.col);
            const toCell = this.getCellEl(target.r, target.col);
            if (!fromCell || !toCell) return;

            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();
            const owner = this._resolveSniperProjectileOwner(target);
            const imgPath = owner === 'white'
                ? 'assets/images/stones/normal_stone-white.png'
                : 'assets/images/stones/normal_stone-black.png';

            const sourceDiscScale = 0.82;
            const projectileScale = 0.25;
            const projectileSize = Math.max(8, Math.round(Math.min(fromRect.width, fromRect.height) * sourceDiscScale * projectileScale));

            const startX = fromRect.left + (fromRect.width / 2) - (projectileSize / 2);
            const startY = fromRect.top + (fromRect.height / 2) - (projectileSize / 2);
            const deltaX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
            const deltaY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));

            const projectile = document.createElement('div');
            projectile.style.position = 'fixed';
            projectile.style.left = `${startX}px`;
            projectile.style.top = `${startY}px`;
            projectile.style.width = `${projectileSize}px`;
            projectile.style.height = `${projectileSize}px`;
            projectile.style.borderRadius = '50%';
            projectile.style.backgroundImage = `url('${imgPath}')`;
            projectile.style.backgroundSize = '100% 100%';
            projectile.style.backgroundRepeat = 'no-repeat';
            projectile.style.backgroundPosition = 'center';
            projectile.style.pointerEvents = 'none';
            projectile.style.zIndex = '1200';
            projectile.style.margin = '0';

            document.body.appendChild(projectile);

            const travelPx = Math.hypot(deltaX, deltaY);
            const durationMs = Math.max(120, Math.min(420, Math.round(90 + (travelPx * 0.35))));
            const anim = projectile.animate([
                { transform: 'translate(0, 0)', opacity: 1 },
                { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 1 }
            ], {
                duration: durationMs,
                easing: 'linear'
            });

            await new Promise((resolve) => {
                let timeoutId = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    try { if (anim && typeof anim.removeEventListener === 'function') anim.removeEventListener('finish', finish); } catch (e) { /* ignore */ }
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                        timeoutId = null;
                    }
                    resolve();
                };
                try {
                    if (anim && typeof anim.addEventListener === 'function') {
                        anim.addEventListener('finish', finish, { once: true });
                    }
                } catch (e) { /* ignore */ }
                try {
                    timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope);
                } catch (e) {
                    timeoutId = setTimeout(finish, durationMs + 120);
                }
                try {
                    if (anim && anim.finished && typeof anim.finished.then === 'function') {
                        anim.finished.then(finish).catch(finish);
                    }
                } catch (e) { /* ignore */ }
            });

            if (projectile.parentElement) projectile.parentElement.removeChild(projectile);
        }

        async animateRobotVacuumSuction(target) {
            if (!target) return;
            if (_isNoAnim()) return;

            const source = this._resolveRobotVacuumSource(target);
            if (!source) return;

            const fromCell = this.getCellEl(target.r, target.col);
            const toCell = this.getCellEl(source.row, source.col);
            if (!fromCell || !toCell) return;

            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();

            const ownerBefore = String(target.ownerBefore || '').toLowerCase();
            const imgPath = ownerBefore === 'white'
                ? 'assets/images/stones/normal_stone-white.png'
                : 'assets/images/stones/normal_stone-black.png';

            const sourceDiscScale = 0.82;
            const projectileScale = 1;
            const projectileSize = Math.max(18, Math.round(Math.min(fromRect.width, fromRect.height) * sourceDiscScale * projectileScale));

            const startX = fromRect.left + (fromRect.width / 2) - (projectileSize / 2);
            const startY = fromRect.top + (fromRect.height / 2) - (projectileSize / 2);
            const deltaX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
            const deltaY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));

            const projectile = document.createElement('div');
            projectile.style.position = 'fixed';
            projectile.style.left = `${startX}px`;
            projectile.style.top = `${startY}px`;
            projectile.style.width = `${projectileSize}px`;
            projectile.style.height = `${projectileSize}px`;
            projectile.style.borderRadius = '50%';
            projectile.style.backgroundImage = `url('${imgPath}')`;
            projectile.style.backgroundSize = '100% 100%';
            projectile.style.backgroundRepeat = 'no-repeat';
            projectile.style.backgroundPosition = 'center';
            projectile.style.pointerEvents = 'none';
            projectile.style.zIndex = '1200';
            projectile.style.margin = '0';

            document.body.appendChild(projectile);

            const travelPx = Math.hypot(deltaX, deltaY);
            const durationMs = Math.max(140, Math.min(360, Math.round(140 + (travelPx * 0.28))));
            const anim = projectile.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.68)`, opacity: 0.78 }
            ], {
                duration: durationMs,
                easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)'
            });

            await new Promise((resolve) => {
                let timeoutId = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    try { if (anim && typeof anim.removeEventListener === 'function') anim.removeEventListener('finish', finish); } catch (e) { /* ignore */ }
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                        timeoutId = null;
                    }
                    resolve();
                };
                try {
                    if (anim && typeof anim.addEventListener === 'function') {
                        anim.addEventListener('finish', finish, { once: true });
                    }
                } catch (e) { /* ignore */ }
                try {
                    timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope);
                } catch (e) {
                    timeoutId = setTimeout(finish, durationMs + 120);
                }
                try {
                    if (anim && anim.finished && typeof anim.finished.then === 'function') {
                        anim.finished.then(finish).catch(finish);
                    }
                } catch (e) { /* ignore */ }
            });

            if (projectile.parentElement) projectile.parentElement.removeChild(projectile);
        }

        async animateDestroyDragonBreath(target) {
            if (!target) return;
            if (_isNoAnim()) return;

            const source = this._resolveDestroyDragonSource(target);
            if (!source) return;

            const fromCell = this.getCellEl(source.row, source.col);
            const toCell = this.getCellEl(target.r, target.col);
            if (!fromCell || !toCell) return;

            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();

            const fromX = fromRect.left + (fromRect.width / 2);
            const fromY = fromRect.top + (fromRect.height / 2);
            const toX = toRect.left + (toRect.width / 2);
            const toY = toRect.top + (toRect.height / 2);

            const deltaX = toX - fromX;
            const deltaY = toY - fromY;
            const distance = Math.max(1, Math.hypot(deltaX, deltaY));
            const angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            const durationMs = Math.max(280, Math.min(520, Math.round(240 + (distance * 0.28))));

            const layer = document.createElement('div');
            layer.style.position = 'fixed';
            layer.style.left = '0';
            layer.style.top = '0';
            layer.style.width = '100vw';
            layer.style.height = '100vh';
            layer.style.pointerEvents = 'none';
            layer.style.zIndex = '1250';

            const beam = document.createElement('div');
            beam.style.position = 'fixed';
            beam.style.left = `${fromX}px`;
            beam.style.top = `${fromY - 4}px`;
            beam.style.width = `${distance}px`;
            beam.style.height = '8px';
            beam.style.transformOrigin = '0 50%';
            beam.style.transform = `rotate(${angleDeg}deg) scaleX(0.2)`;
            beam.style.borderRadius = '999px';
            beam.style.background = 'linear-gradient(90deg, rgba(255,235,150,0.95) 0%, rgba(255,150,40,0.95) 48%, rgba(255,70,20,0.85) 100%)';
            beam.style.boxShadow = '0 0 14px rgba(255,120,30,0.85), 0 0 24px rgba(255,70,20,0.6)';
            beam.style.opacity = '0';

            const muzzle = document.createElement('div');
            muzzle.style.position = 'fixed';
            muzzle.style.left = `${fromX - 8}px`;
            muzzle.style.top = `${fromY - 8}px`;
            muzzle.style.width = '16px';
            muzzle.style.height = '16px';
            muzzle.style.borderRadius = '50%';
            muzzle.style.background = 'radial-gradient(circle, rgba(255,245,190,0.95) 0%, rgba(255,154,40,0.9) 45%, rgba(255,80,20,0.15) 100%)';
            muzzle.style.boxShadow = '0 0 16px rgba(255,150,40,0.9)';
            muzzle.style.opacity = '0';

            const impact = document.createElement('div');
            impact.style.position = 'fixed';
            impact.style.left = `${toX - 16}px`;
            impact.style.top = `${toY - 16}px`;
            impact.style.width = '32px';
            impact.style.height = '32px';
            impact.style.borderRadius = '50%';
            impact.style.background = 'radial-gradient(circle, rgba(255,255,220,0.95) 0%, rgba(255,145,30,0.88) 40%, rgba(255,70,20,0.05) 100%)';
            impact.style.boxShadow = '0 0 22px rgba(255,130,25,0.85)';
            impact.style.opacity = '0';
            impact.style.transform = 'scale(0.35)';

            layer.appendChild(beam);
            layer.appendChild(muzzle);
            layer.appendChild(impact);
            document.body.appendChild(layer);

            await new Promise((resolve) => {
                let timeoutId = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                        timeoutId = null;
                    }
                    resolve();
                };

                try {
                    if (beam.animate) {
                        beam.animate([
                            { offset: 0, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.2)` },
                            { offset: 0.18, opacity: 1, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                            { offset: 0.72, opacity: 0.94, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                            { offset: 1, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.92)` }
                        ], {
                            duration: durationMs,
                            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)'
                        });
                    }
                    if (muzzle.animate) {
                        muzzle.animate([
                            { offset: 0, opacity: 0, transform: 'scale(0.35)' },
                            { offset: 0.24, opacity: 1, transform: 'scale(1.08)' },
                            { offset: 0.68, opacity: 0.86, transform: 'scale(0.98)' },
                            { offset: 1, opacity: 0, transform: 'scale(0.7)' }
                        ], {
                            duration: Math.max(220, durationMs - 30),
                            easing: 'ease-out'
                        });
                    }
                    if (impact.animate) {
                        impact.animate([
                            { offset: 0, opacity: 0, transform: 'scale(0.35)' },
                            { offset: 0.22, opacity: 1, transform: 'scale(1.15)' },
                            { offset: 0.7, opacity: 0.88, transform: 'scale(1.35)' },
                            { offset: 1, opacity: 0, transform: 'scale(1.75)' }
                        ], {
                            duration: Math.max(260, durationMs + 40),
                            easing: 'ease-out'
                        });
                    }
                } catch (e) { /* ignore */ }

                try {
                    timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope);
                } catch (e) {
                    timeoutId = setTimeout(finish, durationMs + 120);
                }
            });

            if (layer.parentElement) layer.parentElement.removeChild(layer);
        }

        async animateUdgLightningStrike(target) {
            if (!target) return;
            if (_isNoAnim()) return;

            const source = this._resolveSniperSource(target);
            if (!source) return;

            const fromCell = this.getCellEl(source.row, source.col);
            const toCell = this.getCellEl(target.r, target.col);
            if (!fromCell || !toCell) return;
            if (!document || !document.body) return;

            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();
            const startX = fromRect.left + (fromRect.width / 2);
            const startY = fromRect.top + (fromRect.height / 2);
            const endX = toRect.left + (toRect.width / 2);
            const endY = toRect.top + (toRect.height / 2);

            const viewportW = Math.max(
                1,
                Number(window && window.innerWidth) || 0,
                Number(document.documentElement && document.documentElement.clientWidth) || 0
            );
            const viewportH = Math.max(
                1,
                Number(window && window.innerHeight) || 0,
                Number(document.documentElement && document.documentElement.clientHeight) || 0
            );

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = `${viewportW}px`;
            overlay.style.height = `${viewportH}px`;
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '1250';
            overlay.style.overflow = 'hidden';

            const svgNs = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNs, 'svg');
            svg.setAttribute('width', String(viewportW));
            svg.setAttribute('height', String(viewportH));
            svg.setAttribute('viewBox', `0 0 ${viewportW} ${viewportH}`);
            svg.style.position = 'absolute';
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.overflow = 'visible';
            overlay.appendChild(svg);

            const distance = Math.max(1, Math.hypot(endX - startX, endY - startY));
            const segmentCount = Math.max(5, Math.min(11, Math.round(distance / 42)));
            const jitterPx = Math.max(8, Math.min(24, Math.round(distance / 13)));

            const buildPath = (sx, sy, ex, ey, segments, jitter) => {
                const safeSegments = Math.max(2, Number(segments) || 2);
                const points = [];
                const dx = ex - sx;
                const dy = ey - sy;
                const len = Math.max(1, Math.hypot(dx, dy));
                const nx = -dy / len;
                const ny = dx / len;

                for (let i = 0; i <= safeSegments; i++) {
                    const t = i / safeSegments;
                    let x = sx + (dx * t);
                    let y = sy + (dy * t);
                    if (i > 0 && i < safeSegments) {
                        const centerWeight = 1 - Math.abs((t * 2) - 1);
                        const offset = (Math.random() - 0.5) * jitter * (0.45 + centerWeight);
                        x += nx * offset;
                        y += ny * offset;
                    }
                    points.push({ x, y });
                }

                const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return { d, points };
            };

            const createPath = (d, stroke, strokeWidth) => {
                const path = document.createElementNS(svgNs, 'path');
                path.setAttribute('d', d);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', stroke);
                path.setAttribute('stroke-width', String(strokeWidth));
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                return path;
            };

            const main = buildPath(startX, startY, endX, endY, segmentCount, jitterPx);
            const glow = createPath(main.d, 'rgba(134, 227, 255, 0.95)', 4.6);
            glow.style.filter = 'drop-shadow(0 0 10px rgba(128, 220, 255, 0.95))';
            const core = createPath(main.d, 'rgba(255, 255, 255, 0.98)', 2.1);
            core.style.filter = 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.9))';
            svg.appendChild(glow);
            svg.appendChild(core);

            const branchBaseIndexes = [
                Math.max(1, Math.floor(main.points.length * 0.34)),
                Math.max(1, Math.floor(main.points.length * 0.62))
            ];
            const branchEls = [];
            for (const idx of branchBaseIndexes) {
                const anchor = main.points[idx];
                if (!anchor) continue;
                const branchEndX = anchor.x + ((Math.random() - 0.5) * 54) + ((endX - startX) * 0.12);
                const branchEndY = anchor.y + ((Math.random() - 0.5) * 54) - ((endY - startY) * 0.08);
                const branch = buildPath(
                    anchor.x,
                    anchor.y,
                    branchEndX,
                    branchEndY,
                    Math.max(3, segmentCount - 3),
                    Math.max(5, jitterPx * 0.68)
                );
                const branchGlow = createPath(branch.d, 'rgba(151, 234, 255, 0.76)', 2.4);
                branchGlow.style.filter = 'drop-shadow(0 0 7px rgba(140, 225, 255, 0.8))';
                const branchCore = createPath(branch.d, 'rgba(255, 255, 255, 0.92)', 1.2);
                svg.appendChild(branchGlow);
                svg.appendChild(branchCore);
                branchEls.push(branchGlow, branchCore);
            }

            const flash = document.createElement('div');
            flash.style.position = 'fixed';
            flash.style.left = `${endX}px`;
            flash.style.top = `${endY}px`;
            flash.style.width = '14px';
            flash.style.height = '14px';
            flash.style.borderRadius = '50%';
            flash.style.transform = 'translate(-50%, -50%) scale(0.15)';
            flash.style.background = 'radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(191,240,255,0.84) 42%, rgba(124,220,255,0) 100%)';
            flash.style.filter = 'drop-shadow(0 0 16px rgba(160, 236, 255, 0.95))';
            flash.style.pointerEvents = 'none';
            flash.style.zIndex = '1251';
            overlay.appendChild(flash);

            const ring = document.createElement('div');
            ring.style.position = 'fixed';
            ring.style.left = `${endX}px`;
            ring.style.top = `${endY}px`;
            ring.style.width = '10px';
            ring.style.height = '10px';
            ring.style.borderRadius = '50%';
            ring.style.transform = 'translate(-50%, -50%) scale(0.2)';
            ring.style.border = '2px solid rgba(173, 238, 255, 0.9)';
            ring.style.pointerEvents = 'none';
            ring.style.zIndex = '1251';
            overlay.appendChild(ring);

            document.body.appendChild(overlay);

            const durationMs = Math.max(170, Math.min(300, Math.round(170 + (distance * 0.12))));
            const animations = [];
            const queueAnimation = (el, keyframes, options) => {
                try {
                    if (!el || typeof el.animate !== 'function') return;
                    const anim = el.animate(keyframes, options);
                    animations.push(anim);
                } catch (e) {
                    /* ignore */
                }
            };

            queueAnimation(glow, [
                { opacity: 0 },
                { opacity: 1, offset: 0.12 },
                { opacity: 0.46, offset: 0.27 },
                { opacity: 1, offset: 0.44 },
                { opacity: 0.34, offset: 0.63 },
                { opacity: 0.94, offset: 0.78 },
                { opacity: 0, offset: 1 }
            ], {
                duration: durationMs,
                easing: 'linear',
                fill: 'forwards'
            });

            queueAnimation(core, [
                { opacity: 0 },
                { opacity: 1, offset: 0.1 },
                { opacity: 0.66, offset: 0.22 },
                { opacity: 1, offset: 0.39 },
                { opacity: 0.54, offset: 0.58 },
                { opacity: 0.92, offset: 0.76 },
                { opacity: 0, offset: 1 }
            ], {
                duration: durationMs - 10,
                easing: 'linear',
                fill: 'forwards'
            });

            for (const branchEl of branchEls) {
                queueAnimation(branchEl, [
                    { opacity: 0 },
                    { opacity: 0.9, offset: 0.16 },
                    { opacity: 0.26, offset: 0.41 },
                    { opacity: 0.75, offset: 0.66 },
                    { opacity: 0, offset: 1 }
                ], {
                    duration: Math.max(130, durationMs - 32),
                    easing: 'linear',
                    fill: 'forwards'
                });
            }

            queueAnimation(flash, [
                { opacity: 0.2, transform: 'translate(-50%, -50%) scale(0.1)' },
                { opacity: 1, transform: 'translate(-50%, -50%) scale(1.3)', offset: 0.24 },
                { opacity: 0, transform: 'translate(-50%, -50%) scale(2.6)', offset: 1 }
            ], {
                duration: Math.max(150, durationMs + 30),
                easing: 'cubic-bezier(0.16, 0.84, 0.32, 1)',
                fill: 'forwards'
            });

            queueAnimation(ring, [
                { opacity: 0.85, transform: 'translate(-50%, -50%) scale(0.2)' },
                { opacity: 0.5, transform: 'translate(-50%, -50%) scale(1.4)', offset: 0.48 },
                { opacity: 0, transform: 'translate(-50%, -50%) scale(2.1)', offset: 1 }
            ], {
                duration: Math.max(140, durationMs + 10),
                easing: 'ease-out',
                fill: 'forwards'
            });

            try {
                if (!animations.length) {
                    await new Promise((resolve) => {
                        try {
                            _Timer().setTimeout(resolve, durationMs + 40, this.playbackScope);
                        } catch (e) {
                            setTimeout(resolve, durationMs + 40);
                        }
                    });
                    return;
                }

                await new Promise((resolve) => {
                    let timeoutId = null;
                    let done = false;
                    const finish = () => {
                        if (done) return;
                        done = true;
                        if (timeoutId !== null) {
                            try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                            timeoutId = null;
                        }
                        resolve();
                    };

                    let settled = 0;
                    const expected = animations.length;
                    for (const anim of animations) {
                        try {
                            if (anim && anim.finished && typeof anim.finished.then === 'function') {
                                anim.finished.then(() => {
                                    settled += 1;
                                    if (settled >= expected) finish();
                                }).catch(() => {
                                    settled += 1;
                                    if (settled >= expected) finish();
                                });
                            } else {
                                settled += 1;
                            }
                        } catch (e) {
                            settled += 1;
                        }
                    }

                    if (settled >= expected) finish();
                    try {
                        timeoutId = _Timer().setTimeout(finish, durationMs + 140, this.playbackScope);
                    } catch (e) {
                        timeoutId = setTimeout(finish, durationMs + 140);
                    }
                });
            } finally {
                if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
            }
        }

        /**
         * Play a sequence of PlaybackEvents.
         * @param {Array} events - Ordered PlaybackEvents
         * @returns {Promise<void>}
         */
        async play(events) {
            const normalizedEvents = Array.isArray(events)
                ? events.map((ev) => this._normalizeEvent(ev))
                : [];
            // No events: just ensure flags are clean and return.
            if (!normalizedEvents.length) {
                this.setGlobalInteractionLock(false);
                return;
            }
            // Clear stale abort/watchdog state from previous runs.
            this.isAborted = false;
            this._watchdogFired = false;
            let abortedDuringPlay = false;

            // Only suppress DiffRenderer's fallback flip animation when this playback actually includes flip events.
            // Otherwise, if flip events were dropped (e.g., missing BoardOps CHANGE events), suppressing would remove
            // the last-resort visual cue and make flips appear instantaneous.
            const shouldSuppressNextDiffFlip = normalizedEvents.some(e => e && e.type === EVENT_TYPES.FLIP);
            const shouldSuppressBoardExpansionRevealSound = normalizedEvents.some((event) => (
                event &&
                event.type === EVENT_TYPES.MOVE &&
                Array.isArray(event.targets) &&
                event.targets.some((target) => String(target && target.cause ? target.cause : '').toUpperCase() === 'CELL_TELEPORT_WILL')
            ));

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
                this.setGlobalInteractionLock(true);

                // Watchdog to prevent permanent freezes
                const WATCHDOG_TIMEOUT_MS = (typeof window !== 'undefined' && Number.isFinite(window.PLAYBACK_WATCHDOG_MS)) ? window.PLAYBACK_WATCHDOG_MS : 10000;
                if (this.playbackScope !== null) {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS, this.playbackScope);
                } else {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS);
                }

                // Group by phase
                this._remainingEvents = normalizedEvents.slice();
                const phases = this.groupByPhase(normalizedEvents);
                const sortedPhases = Object.keys(phases).sort((a, b) => Number(a) - Number(b));

                for (const phase of sortedPhases) {
                    if (this.isAborted) {
                        abortedDuringPlay = true;
                        break;
                    }

                    // Remove processed phases from remainingEvents
                    this._remainingEvents = this._remainingEvents.filter(ev => Number(ev.phase || 0) > Number(phase));

                    const phaseEvents = phases[phase];
                    await this.executePhase(phaseEvents);

                    // Gap between readable phases (Section 3)
                    if (phase !== sortedPhases[sortedPhases.length - 1]) {
                        // Avoid a noticeable delay between hand placement and the stone appearing / flipping.
                        // Free-placement specials often materialize as "place_hand_animation -> spawn only",
                        // so treat the first spawn the same as an immediate follow-up flip.
                        const nextPhaseKey = sortedPhases[sortedPhases.indexOf(phase) + 1];
                        const nextEvents = phases[nextPhaseKey] || [];
                        const hasPlaceOrSpawn = phaseEvents.some(e => e && (e.type === EVENT_TYPES.PLACE || e.type === EVENT_TYPES.SPAWN || e.type === EVENT_TYPES.PLACE_HAND_ANIMATION));
                        const hasPlaceHandAnimation = phaseEvents.some(e => e && e.type === EVENT_TYPES.PLACE_HAND_ANIMATION);
                        const nextHasSpawn = nextEvents.some(e => e && e.type === EVENT_TYPES.SPAWN);
                        const nextHasFlip = nextEvents.some(e => e && e.type === EVENT_TYPES.FLIP);
                        const nextHasRegenBackFlip = hasRegenBackFlip(nextEvents);
                        const skipPlaceGap = hasPlaceOrSpawn && (
                            (nextHasFlip && !nextHasRegenBackFlip) ||
                            (hasPlaceHandAnimation && nextHasSpawn)
                        );
                        const hasCardUseAnimation = phaseEvents.some(e => e && e.type === EVENT_TYPES.CARD_USE_ANIMATION);
                        const nextHasTreasureGainCue = nextEvents.some((ev) => {
                            if (!ev || ev.type !== EVENT_TYPES.SOUND_EFFECT) return false;
                            if (String(ev.soundKey || '').trim() === 'treasure_gain') return true;
                            const targets = Array.isArray(ev.targets) ? ev.targets : [];
                            return targets.some((t) => String((t && t.soundKey) || '').trim() === 'treasure_gain');
                        });
                        const skipCardUseTreasureGap = hasCardUseAnimation && nextHasTreasureGainCue;
                        if (!skipPlaceGap && !skipCardUseTreasureGap) {
                            await this._sleep(PHASE_GAP_MS);
                        }
                    }
                }
            } catch (err) {
                abortedDuringPlay = true;
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

                 // One-shot board update context for DiffRenderer:
                 // After playback, AnimationEngine triggers `emitBoardUpdate()` to sync any non-animated UI (timers, hints).
                 // DiffRenderer has a fallback "owner changed => add .flip" animation which would otherwise replay flips,
                 // making stones appear to flip twice. This context is consumed/cleared by ui/diff-renderer.js.
                 if ((shouldSuppressNextDiffFlip || shouldSuppressBoardExpansionRevealSound) && !abortedDuringPlay && !this._watchdogFired && !this.isAborted) {
                      try {
                          if (PlaybackState && typeof PlaybackState.armBoardUpdateContext === 'function') {
                             const boardUpdateContext = {
                                 source: 'animation-engine',
                                 reason: 'post_playback_sync'
                             };
                             if (shouldSuppressNextDiffFlip) {
                                 boardUpdateContext.suppressFallbackFlip = true;
                             }
                             if (shouldSuppressBoardExpansionRevealSound) {
                                 boardUpdateContext.suppressBoardExpansionRevealSound = true;
                             }
                             PlaybackState.armBoardUpdateContext(boardUpdateContext);
                          } else if (PlaybackState && typeof PlaybackState.setSuppressNextDiffFlip === 'function') {
                             if (shouldSuppressNextDiffFlip) {
                                 PlaybackState.setSuppressNextDiffFlip(true);
                             }
                             if (shouldSuppressBoardExpansionRevealSound && typeof window !== 'undefined' && window) {
                                 window.__suppressNextBoardExpansionRevealSound = true;
                             }
                          } else {
                             if (shouldSuppressNextDiffFlip) {
                                 window.__suppressNextDiffFlip = true;
                             }
                             if (shouldSuppressBoardExpansionRevealSound) {
                                 window.__suppressNextBoardExpansionRevealSound = true;
                             }
                          }
                      } catch (e) { /* ignore */ }
                  }
                 // Avoid leaking abort state into the next playback run.
                 this.isAborted = false;
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

        _isSuperCrushMoveTarget(target) {
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            return this._isSuperCrushCause(cause) ||
                reason.indexOf('super_buoyancy_move') === 0 ||
                reason.indexOf('super_gravity_move') === 0;
        }

        _buildPhaseContext(events) {
            const superCrushDestinations = new Map();
            for (const ev of events || []) {
                if (!ev || ev.type !== EVENT_TYPES.MOVE || !Array.isArray(ev.targets)) continue;
                for (const target of ev.targets) {
                    if (!this._isSuperCrushMoveTarget(target)) continue;
                    const from = target && target.from ? target.from : null;
                    const to = target && target.to ? target.to : null;
                    if (!to || !Number.isInteger(to.r) || !Number.isInteger(to.col)) continue;
                    const fromCell = from && Number.isInteger(from.r) && Number.isInteger(from.col)
                        ? this.getCellEl(from.r, from.col)
                        : null;
                    const toCell = this.getCellEl(to.r, to.col);
                    superCrushDestinations.set(`${to.r},${to.col}`, {
                        sourceHadDisc: !!(fromCell && fromCell.querySelector('.disc')),
                        destinationHadDisc: !!(toCell && toCell.querySelector('.disc'))
                    });
                }
            }
            return { superCrushDestinations };
        }

        _getSuperCrushDestinationContext(row, col) {
            const ctx = this._phaseContext;
            if (!ctx || !(ctx.superCrushDestinations instanceof Map)) return null;
            return ctx.superCrushDestinations.get(`${row},${col}`) || null;
        }

        async _withPhaseContext(context, runner) {
            const prev = this._phaseContext;
            this._phaseContext = context || null;
            try {
                return await runner();
            } finally {
                this._phaseContext = prev;
            }
        }

        async _animateDestroyGhostAtCell(cell, ownerColor) {
            if (!cell) return;
            const ghost = document.createElement('div');
            ghost.className = 'disc';
            if (ownerColor === ((typeof BLACK !== 'undefined') ? BLACK : 1)) ghost.classList.add('black');
            else if (ownerColor === ((typeof WHITE !== 'undefined') ? WHITE : -1)) ghost.classList.add('white');
            ghost.style.pointerEvents = 'none';
            ghost.classList.add('destroy-fade');
            cell.appendChild(ghost);
            await this._sleep(FADE_OUT_MS);
            if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
        }

        _removeDiscFromCell(cell, disc) {
            if (!cell || !disc) return;
            try {
                if (disc.parentElement === cell) cell.removeChild(disc);
            } catch (e) { /* ignore */ }
            try {
                if (!cell.querySelector('.disc')) cell.classList.remove('has-disc');
            } catch (e) { /* ignore */ }
        }

        async executePhase(phaseEvents) {
            const events = Array.isArray(phaseEvents) ? phaseEvents.slice() : [];
            const hasTreasureGainCue = events.some((ev) => {
                if (!ev || ev.type !== EVENT_TYPES.SOUND_EFFECT) return false;
                if (String(ev.soundKey || '').trim() === 'treasure_gain') return true;
                const targets = Array.isArray(ev.targets) ? ev.targets : [];
                return targets.some((t) => String((t && t.soundKey) || '').trim() === 'treasure_gain');
            });

            const effectiveEvents = hasTreasureGainCue
                ? events
                    .map((ev) => {
                        if (!ev || ev.type !== EVENT_TYPES.SOUND_EFFECT) return ev;
                        const keys = [];
                        if (ev.soundKey) keys.push(String(ev.soundKey).trim());
                        const targets = Array.isArray(ev.targets) ? ev.targets : [];
                        for (const t of targets) {
                            if (t && t.soundKey) keys.push(String(t.soundKey).trim());
                        }
                        const filtered = keys.filter((k) => k && k !== 'sell_sacrifice_gain');
                        if (!filtered.length) return null;
                        const nextEv = Object.assign({}, ev);
                        delete nextEv.soundKey;
                        nextEv.targets = filtered.map((soundKey) => ({ soundKey }));
                        return nextEv;
                    })
                    .filter((ev) => !!ev)
                : events;

            // Batch flip events within the same phase so that multiple flips animate together.
            const phaseContext = this._buildPhaseContext(effectiveEvents);
            await this._withPhaseContext(phaseContext, async () => {
                const flips = effectiveEvents.filter(ev => ev && ev.type === EVENT_TYPES.FLIP);
                const nonFlips = effectiveEvents.filter(ev => !ev || ev.type !== EVENT_TYPES.FLIP);

                const promises = [];
                if (flips.length) promises.push(this.executeFlipBatch(flips));
                if (nonFlips.length) promises.push(...nonFlips.map(ev => this.executeEvent(ev)));
                await Promise.all(promises);
            });
        }

        async _sleep(ms) {
            if (_isNoAnim()) return Promise.resolve();
            return new Promise(resolve => {
                const id = _Timer().setTimeout(resolve, ms, this.playbackScope);
            });
        }

        async handleWatchdog() {
            console.warn('[AnimationEngine] WATCHDOG fired. Forcing playback abort and sync.');
            this._watchdogFired = true;
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
            if (PlaybackState && typeof PlaybackState.setPlaybackActive === 'function') {
                PlaybackState.setPlaybackActive(false);
            } else if (typeof window !== 'undefined') {
                window.VisualPlaybackActive = false;
            }
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
                case EVENT_TYPES.HAND_ADD:
                    if (typeof window !== 'undefined') {
                        const t = (ev.targets && ev.targets[0]) ? ev.targets[0] : ev;
                        if (t.reason === 'generated_throw_chain' && typeof window.playDirectHandAddAnimation === 'function') {
                            return window.playDirectHandAddAnimation({
                                player: t.player,
                                cardId: t.cardId,
                                count: t.count,
                                reason: t.reason,
                                sourceType: t.sourceType,
                                generatedName: t.generatedName
                            });
                        }
                        if (typeof window.playDrawCardHandAnimation === 'function') {
                            return window.playDrawCardHandAnimation({
                                player: t.player,
                                cardId: t.cardId,
                                count: t.count,
                                reason: t.reason,
                                sourceType: t.sourceType,
                                generatedName: t.generatedName
                            });
                        }
                    }
                    return Promise.resolve();
                case EVENT_TYPES.PLACE_HAND_ANIMATION:
                    {
                        const tPlace = (ev.targets && ev.targets[0]) ? ev.targets[0] : ev;
                        const descriptor = this._resolvePlaceHandDescriptor(tPlace);
                        if (!descriptor || !this._shouldPlayPlaceHandAnimation(tPlace)) {
                            return Promise.resolve();
                        }
                        const handAnimationFn = (typeof window !== 'undefined' && typeof window.playHandAnimation === 'function')
                            ? window.playHandAnimation
                            : ((typeof playHandAnimation === 'function') ? playHandAnimation : null);
                        if (typeof handAnimationFn !== 'function') return Promise.resolve();
                        return new Promise((resolve) => {
                            let finished = false;
                            const finish = () => {
                                if (finished) return;
                                finished = true;
                                resolve();
                            };
                            const timeoutId = _Timer().setTimeout(finish, 1800, this.playbackScope);
                            const done = () => {
                                if (timeoutId) {
                                    _Timer().clearTimeout(timeoutId);
                                }
                                finish();
                            };
                            try {
                                handAnimationFn(this._resolvePlayerValue(descriptor.playerKey), descriptor.r, descriptor.col, done);
                            } catch (e) {
                                done();
                            }
                        });
                    }
                case EVENT_TYPES.CARD_USE_ANIMATION:
                    {
                        const t2 = (ev.targets && ev.targets[0]) ? ev.targets[0] : ev;
                        this._playCardUseButtonCueForOpponent(t2);
                        const disappearPlaybackEvents = Array.isArray(t2.disappearPlaybackEvents)
                            ? t2.disappearPlaybackEvents.filter((one) => !!one)
                            : [];
                        if (typeof window !== 'undefined' && typeof window.playCardUseHandAnimation === 'function') {
                            return window.playCardUseHandAnimation({
                                player: t2.player,
                                owner: t2.owner,
                                cardId: t2.cardId,
                                cost: t2.cost,
                                name: t2.name,
                                disappearSoundKey: t2.disappearSoundKey || null,
                                onDisappear: disappearPlaybackEvents.length > 0
                                    ? () => Promise.all(disappearPlaybackEvents.map((one) => this.executeEvent(one)))
                                    : null,
                                sourceCardEl: t2.sourceCardEl || null,
                                sourceCardRect: t2.sourceCardRect || ev.sourceCardRect || null
                            });
                        }
                    }
                    return Promise.resolve();
                case EVENT_TYPES.OBSERVER_BUBBLE:
                    return this.handleObserverBubble(ev);
                case EVENT_TYPES.SOUND_EFFECT:
                    return this.handleSoundEffect(ev);
                case EVENT_TYPES.HAND_REMOVE:
                    if (typeof window !== 'undefined' && typeof window.playClearHandAnimation === 'function') {
                        const t3 = (ev.targets && ev.targets[0]) ? ev.targets[0] : ev;
                        return window.playClearHandAnimation({
                            player: t3.player,
                            count: t3.count,
                            reason: t3.reason,
                            cardId: t3.cardId,
                            cardIds: Array.isArray(t3.cardIds) ? t3.cardIds.slice() : undefined
                        });
                    }
                    return Promise.resolve();
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

        async handleSoundEffect(ev) {
            const keys = [];
            if (ev && ev.soundKey) keys.push(String(ev.soundKey));
            const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
            for (const t of targets) {
                if (t && t.soundKey) keys.push(String(t.soundKey));
            }
            if (!keys.length) return Promise.resolve();

            const seen = new Set();
            for (const key of keys) {
                const trimmed = String(key || '').trim();
                if (!trimmed || seen.has(trimmed)) continue;
                seen.add(trimmed);
                if (_consumeLocalPlaybackSoundSkip(trimmed)) continue;
                try {
                    if (typeof SoundEngine !== 'undefined' && SoundEngine && typeof SoundEngine.playEffectByKey === 'function') {
                        SoundEngine.init();
                        SoundEngine.playEffectByKey(trimmed);
                    }
                } catch (e) { /* ignore */ }
            }
            return Promise.resolve();
        }

        async handleObserverBubble(ev) {
            const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
            if (!targets.length) return Promise.resolve();

            const totalMsRaw = Number(OBSERVER_BUBBLE_MS);
            const fadeMsRaw = Number(OBSERVER_BUBBLE_FADE_MS);
            const totalMs = Number.isFinite(totalMsRaw) && totalMsRaw > 0 ? totalMsRaw : 5000;
            const fadeMs = Number.isFinite(fadeMsRaw) && fadeMsRaw > 0 ? fadeMsRaw : 700;
            const holdMs = Math.max(0, totalMs - fadeMs);

            for (const t of targets) {
                const row = Number.isInteger(t && t.r) ? t.r : null;
                const col = Number.isInteger(t && t.col) ? t.col : null;
                if (row === null || col === null) continue;

                const cell = this.getCellEl(row, col);
                if (!cell) continue;

                const gained = Math.max(0, Number(t && t.gained) || 0);
                const owner = String((t && t.owner) || '').toLowerCase();
                const explicitText = (typeof (t && t.text) === 'string') ? String(t.text).trim() : '';

                const existing = document.querySelectorAll(`.observer-speech-bubble[data-row="${row}"][data-col="${col}"]`);
                for (const oldNode of existing) {
                    try { if (oldNode && oldNode.parentElement) oldNode.parentElement.removeChild(oldNode); } catch (e) { /* ignore */ }
                }

                const rect = cell.getBoundingClientRect();
                const viewportW = (typeof window !== 'undefined' && Number.isFinite(window.innerWidth)) ? window.innerWidth : document.documentElement.clientWidth;
                const anchorX = rect.left + (rect.width / 2);
                const anchorY = rect.top - 8;
                const clampedX = Math.max(24, Math.min(Math.max(24, viewportW - 24), anchorX));

                const bubble = document.createElement('div');
                bubble.className = 'observer-speech-bubble';
                bubble.dataset.row = String(row);
                bubble.dataset.col = String(col);
                bubble.dataset.owner = owner;
                bubble.setAttribute('aria-hidden', 'true');
                bubble.style.position = 'fixed';
                bubble.style.left = `${clampedX}px`;
                bubble.style.top = `${anchorY}px`;
                bubble.style.transform = 'translate(-50%, -100%)';
                bubble.style.display = 'block';
                bubble.style.maxWidth = 'min(46vw, 320px)';
                bubble.style.width = 'max-content';
                bubble.style.padding = '8px 12px';
                bubble.style.borderRadius = '10px';
                bubble.style.border = '1px solid var(--border-status)';
                bubble.style.background = 'transparent';
                bubble.style.color = 'var(--color-text-bright)';
                bubble.style.fontSize = '13px';
                bubble.style.lineHeight = '1.35';
                bubble.style.textAlign = 'center';
                bubble.style.boxShadow = 'var(--board-shadow-outer)';
                bubble.style.opacity = '0';
                bubble.style.visibility = 'visible';
                bubble.style.pointerEvents = 'none';
                bubble.style.zIndex = '13100';
                bubble.style.transition = `opacity ${fadeMs}ms ease`;
                bubble.style.wordBreak = 'break-word';
                bubble.style.isolation = 'isolate';

                const bgLayer = document.createElement('div');
                bgLayer.style.position = 'absolute';
                bgLayer.style.left = '0';
                bgLayer.style.top = '0';
                bgLayer.style.right = '0';
                bgLayer.style.bottom = '0';
                bgLayer.style.borderRadius = 'inherit';
                bgLayer.style.background = 'var(--bg-glass)';
                bgLayer.style.opacity = '0.82';
                bgLayer.style.pointerEvents = 'none';
                bgLayer.style.zIndex = '0';
                bubble.appendChild(bgLayer);

                const label = document.createElement('span');
                label.style.position = 'relative';
                label.style.zIndex = '1';
                label.textContent = explicitText || `布石+${gained} 観測が捗る`;
                bubble.appendChild(label);

                const tail = document.createElement('div');
                tail.style.position = 'absolute';
                tail.style.left = '50%';
                tail.style.top = 'calc(100% - 1px)';
                tail.style.transform = 'translateX(-50%)';
                tail.style.width = '0';
                tail.style.height = '0';
                tail.style.borderStyle = 'solid';
                tail.style.borderWidth = '8px 7px 0 7px';
                tail.style.borderColor = 'var(--bg-glass) transparent transparent transparent';
                tail.style.opacity = '0.82';
                tail.style.zIndex = '0';
                bubble.appendChild(tail);

                document.body.appendChild(bubble);
                try {
                    requestAnimationFrame(() => {
                        bubble.style.opacity = '1';
                    });
                } catch (e) {
                    bubble.style.opacity = '1';
                }

                setTimeout(() => {
                    try { bubble.style.opacity = '0'; } catch (e) { /* ignore */ }
                }, holdMs);
                setTimeout(() => {
                    try { if (bubble.parentElement) bubble.parentElement.removeChild(bubble); } catch (e) { /* ignore */ }
                }, totalMs + 120);
            }

            return Promise.resolve();
        }

        async handlePlace(ev) {
            const eventType = (ev && ev.type) ? ev.type : EVENT_TYPES.PLACE;
            for (const t of ev.targets) {
                const cell = this.getCellEl(t.r, t.col);
                if (!cell) continue;

                await this._runWithEffectTargetHighlight(cell, eventType, t, async () => {
                    const after = t.after || {};
                    const disc = this.createDisc(after);

                    // Section 5.1: normal placement appears in its final state immediately.
                    // Fade-in is reserved for explicit spawn/crossfade paths only.
                    cell.innerHTML = '';
                    cell.appendChild(disc);
                });
            }
            // Do not block subsequent phases (e.g., immediate flips) after placement.
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
                        const ownerColor = this._resolveOwnerColorFromBefore(t && t.ownerBefore);
                        ghost.className = 'disc ' + this._resolveOwnerClassFromColor(ownerColor);
                        ghost.style.pointerEvents = 'none';
                        ghost.classList.add('destroy-fade');
                        cell.appendChild(ghost);
                        await this._sleep(FADE_OUT_MS);
                        if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
                    } catch (e) { /* ignore */ }
                    return;
                }

                const after = t.after || {};
                await this._runWithEffectTargetHighlight(cell, EVENT_TYPES.FLIP, t, async () => {
                    const noAnim = _isNoAnim();

                    // More natural flip: animate immediately and swap the visual state at mid-flip.
                    // This makes the color change feel simultaneous with the flip motion.
                    if (noAnim) {
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
                    try { if (AnimationShared && AnimationShared.triggerFlip) AnimationShared.triggerFlip(disc); } catch (e) { /* defensive */ }

                    // Swap visuals exactly mid-way so color change aligns with motion start
                    await this._sleep(FLIP_MS / 2);
                    this.syncDiscVisual(disc, after);

                    // Finish motion and clean up
                    await this._sleep(FLIP_MS / 2);
                    try { if (AnimationShared && AnimationShared.removeFlip) AnimationShared.removeFlip(disc); } catch (e) { }
                });
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
                const superCrushDelay = this._resolveSuperCrushCollisionDelayMs(t);
                if (superCrushDelay > 0) {
                    await this._sleep(superCrushDelay);
                }

                const cell = this.getCellEl(t.r, t.col);
                if (!cell) return;
                const destroyCause = this._getTargetCause(t);
                const destroyReason = this._getTargetReason(t);
                const isSuperCrushCollision = this._isSuperCrushCause(destroyCause) && (
                    destroyReason.indexOf('super_buoyancy_collision') === 0 ||
                    destroyReason.indexOf('super_gravity_collision') === 0
                );
                const superCrushDestinationContext = isSuperCrushCollision
                    ? this._getSuperCrushDestinationContext(t.r, t.col)
                    : null;
                const ownerColor = this._resolveOwnerColorFromBefore(t && t.ownerBefore);
                const disc = cell.querySelector('.disc');
                const shouldPreserveDestroyPlaybackWithoutDisc =
                    isSuperCrushCollision ||
                    this._shouldHighlightEffectTarget(EVENT_TYPES.DESTROY, t);
                if (!disc && !shouldPreserveDestroyPlaybackWithoutDisc) return;

                await this._runWithEffectTargetHighlight(cell, EVENT_TYPES.DESTROY, t, async () => {
                    const useGhostOnlyDestroy = !disc || (
                        isSuperCrushCollision &&
                        (superCrushDestinationContext && superCrushDestinationContext.sourceHadDisc === false)
                    );
                    if (useGhostOnlyDestroy) {
                        if (ownerColor === null && !isSuperCrushCollision) {
                            await this._sleep(FADE_OUT_MS);
                        } else {
                            await this._animateDestroyGhostAtCell(cell, ownerColor);
                        }
                        return;
                    }

                    if (destroyCause === 'SNIPER_WILL' && this._resolveSniperSource(t)) {
                        await this.animateSniperProjectile(t);
                    }
                    if (destroyCause === 'DESTROY_DRAGON' && destroyReason === 'destroy_dragon_breath' && this._resolveDestroyDragonSource(t)) {
                        await this.animateDestroyDragonBreath(t);
                    }
                    if (destroyCause === 'ULTIMATE_DESTROY_GOD' && destroyReason === 'udg_destroyed' && this._resolveSniperSource(t)) {
                        await this.animateUdgLightningStrike(t);
                    }
                    if (destroyCause === 'LIGHTNING_WILL' && destroyReason === 'lightning_destroyed' && this._resolveSniperSource(t)) {
                        await this.animateUdgLightningStrike(t);
                    }
                    if (destroyCause === 'WILL_HUNTER_KING' && destroyReason.indexOf('will_hunter_king_slash') === 0) {
                        await this.animateWillHunterKingSlash(t);
                    }
                    if (destroyCause === 'ROBOT_VACUUM' && destroyReason === 'robot_vacuum_suck' && this._resolveRobotVacuumSource(t)) {
                        await this.animateRobotVacuumSuction(t);
                        cell.innerHTML = '';
                        return;
                    }

                    const isGluttonousEatDestroy =
                        destroyCause === 'GLUTTONOUS_WILL' &&
                        destroyReason.indexOf('gluttonous_eat') === 0;
                    if (isGluttonousEatDestroy) {
                        return;
                    }

                    // Section 5.3: Fade out using animateFadeOutAt (waits for animationend + safety timeout)
                    if (typeof animateFadeOutAt === 'function') {
                        await animateFadeOutAt(t.r, t.col, { createGhost: true, color: ownerColor });

                        // If no destroy-fade is visible (e.g., disc removed too early), force a ghost fade.
                        try {
                            const hasFade = cell.querySelector('.disc.destroy-fade');
                            if (!hasFade) {
                                const ghost = document.createElement('div');
                                const ownerClass = this._resolveOwnerClassFromColor(ownerColor);
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
                        if (disc) {
                            disc.classList.add('destroy-fade');
                            await this._sleep(FADE_OUT_MS);
                        } else if (ownerColor !== null) {
                            await this._animateDestroyGhostAtCell(cell, ownerColor);
                        } else {
                            await this._sleep(FADE_OUT_MS);
                        }
                    }
                    this._removeDiscFromCell(cell, disc);
                });
            });
            await Promise.all(promises);
        }

        async animateWillHunterKingSlash(target) {
            if (!target || _isNoAnim()) return;

            const cell = this.getCellEl(target.r, target.col);
            if (!cell) return;

            const cellRect = cell.getBoundingClientRect();
            const source = this._resolveSniperSource(target);
            const slash = document.createElement('div');
            slash.className = 'will-hunter-king-slash';

            let angleDeg = -32;
            if (source) {
                const sourceCell = this.getCellEl(source.row, source.col);
                if (sourceCell) {
                    const sourceRect = sourceCell.getBoundingClientRect();
                    angleDeg = Math.atan2(
                        (cellRect.top + (cellRect.height / 2)) - (sourceRect.top + (sourceRect.height / 2)),
                        (cellRect.left + (cellRect.width / 2)) - (sourceRect.left + (sourceRect.width / 2))
                    ) * (180 / Math.PI);
                }
            }

            slash.style.position = 'fixed';
            slash.style.left = `${cellRect.left}px`;
            slash.style.top = `${cellRect.top}px`;
            slash.style.width = `${cellRect.width}px`;
            slash.style.height = `${cellRect.height}px`;
            slash.style.setProperty('--slash-angle-deg', `${angleDeg}deg`);
            slash.style.pointerEvents = 'none';
            slash.style.zIndex = '1300';
            document.body.appendChild(slash);

            const durationMs = 280;
            try {
                if (typeof slash.animate === 'function') {
                    const anim = slash.animate([
                        { opacity: 0, transform: 'scale(0.6)' },
                        { opacity: 1, transform: 'scale(1)' },
                        { opacity: 0, transform: 'scale(1.08)' }
                    ], {
                        duration: durationMs,
                        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
                    });
                    await Promise.race([
                        anim.finished.catch(() => undefined),
                        this._sleep(durationMs + 80)
                    ]);
                } else {
                    await this._sleep(durationMs);
                }
            } finally {
                try { if (slash.parentElement) slash.parentElement.removeChild(slash); } catch (e) { /* ignore */ }
            }
        }

        async handleSpawn(ev) {
            // Spawn is similar to place, but BREEDING spawn has its own fade-in.
            const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
            if (!targets.length) return Promise.resolve();

            const normalTargets = [];
            const breedingTargets = [];
            for (const t of targets) {
                if (this.isBreedingSpawnTarget(t)) breedingTargets.push(t);
                else normalTargets.push(t);
            }

            if (normalTargets.length) {
                await this.handlePlace(Object.assign({}, ev, { targets: normalTargets }));
            }

            if (!breedingTargets.length) return Promise.resolve();

            const fadePromises = breedingTargets.map(async (t) => {
                const cell = this.getCellEl(t.r, t.col);
                if (!cell) return;
                await this._runWithEffectTargetHighlight(cell, EVENT_TYPES.SPAWN, t, async () => {
                    const after = t.after || {};
                    const disc = this.createDisc(after);
                    cell.innerHTML = '';
                    cell.appendChild(disc);

                    const fadeMs = this.getSpawnFadeInMs(t);
                    if (_isNoAnim() || !Number.isFinite(fadeMs) || fadeMs <= 0) return;

                    // Targeted fade-in only for breeding spawn; no global opacity side-effects.
                    const prevTransition = disc.style.transition || '';
                    disc.style.opacity = '0';
                    disc.classList.add('stone-instant');
                    disc.offsetHeight; // force reflow
                    disc.classList.remove('stone-instant');
                    disc.style.transition = prevTransition ? `${prevTransition}, opacity ${fadeMs}ms ease` : `opacity ${fadeMs}ms ease`;

                    await new Promise((resolve) => {
                        let timeoutId = null;
                        let done = false;
                        const finish = () => {
                            if (done) return;
                            done = true;
                            try { disc.removeEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                            if (timeoutId !== null) {
                                try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                                timeoutId = null;
                            }
                            disc.style.opacity = '';
                            disc.style.transition = prevTransition;
                            resolve();
                        };
                        const onEnd = (e) => {
                            if (!e || e.propertyName === 'opacity') finish();
                        };
                        try { disc.addEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                        try { timeoutId = _Timer().setTimeout(finish, fadeMs + 120, this.playbackScope); } catch (e) { timeoutId = setTimeout(finish, fadeMs + 120); }
                        try { requestAnimationFrame(() => { disc.style.opacity = '1'; }); } catch (e) { disc.style.opacity = '1'; }
                    });
                });
            });

            await Promise.all(fadePromises);
        }

        isBreedingSpawnTarget(t) {
            if (!t) return false;
            const cause = String(t.cause || '').toUpperCase();
            const reason = String(t.reason || '').toLowerCase();
            return cause === 'BREEDING' && reason.indexOf('breeding_spawn') === 0;
        }

        getSpawnFadeInMs(t) {
            if (this.isBreedingSpawnTarget(t)) return BREEDING_SPAWN_FADE_MS;
            return 0;
        }

        async handleMove(ev) {
            const ensureDiscVisibleForMove = (discEl) => {
                if (!discEl) return;
                try {
                    discEl.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant', 'destroy-fade', 'shatter');
                } catch (e) { /* ignore */ }
                try { discEl.style.visibility = 'visible'; } catch (e) { /* ignore */ }
                try { discEl.style.opacity = ''; } catch (e) { /* ignore */ }
            };
            const buildMoveGhostAnimationSpec = (moveCause, moveReason, deltaX, deltaY) => {
                const normalizedCause = String(moveCause || '').toUpperCase();
                const normalizedReason = String(moveReason || '').toLowerCase();
                const defaultSpec = {
                    keyframes: [
                        { transform: 'translate(0, 0)' },
                        { transform: `translate(${deltaX}px, ${deltaY}px)` }
                    ],
                    easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)'
                };
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);
                const dominantTravel = Math.max(absX, absY);
                if (dominantTravel <= 0) return defaultSpec;

                const isStrongWindMove =
                    normalizedCause === 'STRONG_WIND_WILL' ||
                    normalizedReason.indexOf('strong_wind_move') === 0;
                const isSuperBuoyancyMove =
                    normalizedCause === 'SUPER_BUOYANCY_WILL' ||
                    normalizedReason.indexOf('super_buoyancy_move') === 0;
                const isSuperGravityMove =
                    normalizedCause === 'SUPER_GRAVITY_WILL' ||
                    normalizedReason.indexOf('super_gravity_move') === 0;

                if (isStrongWindMove) {
                    const gustOffset = Math.max(10, Math.round(dominantTravel * 0.14));
                    const gustX = absX >= absY
                        ? Math.round(deltaX * 0.58)
                        : Math.round(deltaX * 0.54) + (deltaX >= 0 ? gustOffset : -gustOffset);
                    const gustY = absX >= absY
                        ? Math.round(deltaY * 0.54) - gustOffset
                        : Math.round(deltaY * 0.58);
                    return {
                        keyframes: [
                            { transform: 'translate(0, 0) scale(1)' },
                            { transform: `translate(${gustX}px, ${gustY}px) scale(1.08)` },
                            { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
                        ],
                        easing: 'cubic-bezier(0.14, 0.92, 0.24, 1)'
                    };
                }

                if (isSuperBuoyancyMove) {
                    const lift = Math.max(18, Math.round(dominantTravel * 0.2));
                    return {
                        keyframes: [
                            { transform: 'translate(0, 0) scale(1)' },
                            { transform: `translate(${Math.round(deltaX * 0.45)}px, ${Math.round(deltaY * 0.45) - lift}px) scale(1.06)` },
                            { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
                        ],
                        easing: 'cubic-bezier(0.12, 0.88, 0.28, 1)'
                    };
                }

                if (isSuperGravityMove) {
                    const drop = Math.max(20, Math.round(dominantTravel * 0.22));
                    return {
                        keyframes: [
                            { transform: 'translate(0, 0) scale(1)' },
                            { transform: `translate(${Math.round(deltaX * 0.7)}px, ${Math.round(deltaY * 0.7) + drop}px) scale(1.05)` },
                            { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
                        ],
                        easing: 'cubic-bezier(0.36, 0.08, 0.74, 0.98)'
                    };
                }

                return defaultSpec;
            };

            const promises = ev.targets.map(async t => {
                const fromCell = this.getCellEl(t.from.r, t.from.col);
                const toCell = this.getCellEl(t.to.r, t.to.col);
                if (!fromCell || !toCell) return;

                const moveCause = String(t && t.cause ? t.cause : '').toUpperCase();
                const moveReason = String(t && t.reason ? t.reason : '').toLowerCase();

                let highlightedCells = [];
                try {
                    if (this._shouldHighlightEffectTarget(EVENT_TYPES.MOVE, t)) {
                        const isDestroyEvadeMove =
                            moveCause === 'DESTROY_EVADE' ||
                            moveReason.indexOf('destroy_evade_move') === 0;
                        const shouldHighlightBothCells =
                            moveCause === 'POSITION_SWAP_WILL' ||
                            moveReason.indexOf('position_swap') === 0;
                        const cellsToHighlight = shouldHighlightBothCells
                            ? [fromCell, toCell]
                            : (isDestroyEvadeMove ? [fromCell] : [toCell]);
                        for (const oneCell of cellsToHighlight) {
                            if (!oneCell || highlightedCells.indexOf(oneCell) >= 0) continue;
                            try {
                                oneCell.classList.add(EFFECT_TARGET_HIGHLIGHT_CLASS);
                                highlightedCells.push(oneCell);
                            } catch (e) { /* ignore */ }
                        }
                    }

                const isPositionSwapMove =
                    moveCause === 'POSITION_SWAP_WILL' || moveReason === 'position_swap';
                const isTeleportMove =
                    moveCause === 'TELEPORT_WILL' || moveReason === 'teleport_move';
                const isCloneMove = !!(t && t.clone === true);
                const isHyperactiveLikeMove = (
                    moveCause === 'HYPERACTIVE' ||
                    moveCause === 'ESCAPE_HYPERACTIVE' ||
                    moveCause === 'EXTREME_HYPERACTIVE_WILL' ||
                    moveCause === 'HYPERACTIVE_INHERIT_WILL' ||
                    moveCause === 'ULTIMATE_REVERSE_DRAGON' ||
                    moveCause === 'ULTIMATE_DESTROY_GOD' ||
                    moveCause === 'ROBOT_VACUUM' ||
                    moveCause === 'GLUTTONOUS_WILL' ||
                    moveCause === 'ULTIMATE_HYPERACTIVE' ||
                    moveCause === 'ULTIMATE_HYPERACTIVE_GOD' ||
                    moveReason.indexOf('ultimate_reverse_dragon_move') === 0 ||
                    moveReason.indexOf('ultimate_destroy_god_move') === 0 ||
                    moveReason.indexOf('hyperactive') >= 0 ||
                    moveReason.indexOf('gluttonous') >= 0 ||
                    moveReason.indexOf('robot_vacuum_move') === 0
                );
                let disc = fromCell.querySelector('.disc');
                let sourceCell = fromCell;
                let useGhostOnly = isCloneMove;
                // Fallback for race: board may already be in "after" state (disc only exists at destination).
                if (!disc) {
                    const toDisc = toCell.querySelector('.disc');
                    if (toDisc) {
                        disc = toDisc;
                        sourceCell = toCell;
                    }
                }

                // Snapshot playback fallback:
                // if both source/destination cells are already empty in the final board,
                // animate a temporary ghost from event metadata so movement still remains readable.
                if (!disc) {
                    const fallbackState = (t && t.after && (t.after.color === 1 || t.after.color === -1))
                        ? t.after
                        : {
                            color: (t.ownerAfter === 'black') ? 1 : ((t.ownerAfter === 'white') ? -1 : 0),
                            special: (t.after && t.after.special) || null,
                            timer: (t.after && t.after.timer) || null,
                            owner: (t.after && t.after.owner) || t.ownerAfter || null
                        };
                    if (fallbackState.color !== 1 && fallbackState.color !== -1) return;
                    disc = this.createDisc(fallbackState);
                    useGhostOnly = true;
                }
                // Move visuals must stay as "move only" and never look like destroy.
                ensureDiscVisibleForMove(disc);

                // Section 5.5: Straight-line interpolation via ghost
                const fromRect = fromCell.getBoundingClientRect();
                const toRect = toCell.getBoundingClientRect();
                const deltaX = toRect.left - fromRect.left;
                const deltaY = toRect.top - fromRect.top;
                const noAnim = _isNoAnim();

                // If no-animations mode, skip animation and perform immediate DOM move
                if (noAnim || isTeleportMove) {
                    try {
                        let targetDisc = null;
                        if (!useGhostOnly) {
                            toCell.innerHTML = '';
                            ensureDiscVisibleForMove(disc);
                            toCell.appendChild(disc);
                            targetDisc = disc;
                            toCell.classList.add('has-disc');
                            if (sourceCell === fromCell) {
                                fromCell.innerHTML = '';
                                fromCell.classList.remove('has-disc');
                            }
                        } else {
                            toCell.innerHTML = '';
                            targetDisc = (t && t.after && (t.after.color === 1 || t.after.color === -1))
                                ? this.createDisc(t.after)
                                : disc;
                            if (targetDisc) {
                                ensureDiscVisibleForMove(targetDisc);
                                toCell.appendChild(targetDisc);
                                toCell.classList.add('has-disc');
                            }
                        }

                        if (isTeleportMove && !noAnim && targetDisc && typeof targetDisc.animate === 'function') {
                            const durationMs = 140;
                            const anim = targetDisc.animate([
                                { opacity: 0.25, transform: 'scale(0.5)' },
                                { opacity: 1, transform: 'scale(1)' }
                            ], {
                                duration: durationMs,
                                easing: 'cubic-bezier(0.18, 0.9, 0.3, 1)'
                            });
                            await new Promise((resolve) => {
                                let timeoutId = null;
                                let done = false;
                                const finish = () => {
                                    if (done) return;
                                    done = true;
                                    try { if (anim && typeof anim.removeEventListener === 'function') anim.removeEventListener('finish', finish); } catch (e) { /* ignore */ }
                                    if (timeoutId !== null) {
                                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                                        timeoutId = null;
                                    }
                                    resolve();
                                };
                                try {
                                    if (anim && typeof anim.addEventListener === 'function') {
                                        anim.addEventListener('finish', finish, { once: true });
                                    }
                                } catch (e) { /* ignore */ }
                                try {
                                    timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope);
                                } catch (e) {
                                    timeoutId = setTimeout(finish, durationMs + 120);
                                }
                                try {
                                    if (anim && anim.finished && typeof anim.finished.then === 'function') {
                                        anim.finished.then(finish).catch(finish);
                                    }
                                } catch (e) { /* ignore */ }
                            });
                        }
                    } catch (e) {
                        // best-effort
                    }
                    return;
                }

                let hiddenTargetDisc = null;
                if (isCloneMove || isHyperactiveLikeMove) {
                    const liveTargetDisc = toCell.querySelector('.disc');
                    if (liveTargetDisc && liveTargetDisc !== disc) {
                        liveTargetDisc.style.visibility = 'hidden';
                        hiddenTargetDisc = liveTargetDisc;
                    }
                }

                const ghost = disc.cloneNode(true);
                ghost.classList.remove('destroy-fade', 'shatter');
                ghost.classList.add('stone-instant');
                document.body.appendChild(ghost);

                const discScale = 0.82;
                const discInsetRatio = (1 - discScale) / 2;
                ghost.style.position = 'fixed';
                ghost.style.top = `${fromRect.top + fromRect.height * discInsetRatio}px`;
                ghost.style.left = `${fromRect.left + fromRect.width * discInsetRatio}px`;
                ghost.style.width = `${fromRect.width * discScale}px`;
                ghost.style.height = `${fromRect.height * discScale}px`;
                ghost.style.margin = '0';
                ghost.style.zIndex = '1000';

                let discHidden = false;
                if (!useGhostOnly) {
                    disc.style.visibility = 'hidden';
                    discHidden = true;
                }

                try {
                    const durationScale = isPositionSwapMove ? 0.8 : 1;
                    const durationMs = Math.max(1, Math.round(MOVE_MS * durationScale));

                    let anim = null;
                    if (typeof ghost.animate === 'function') {
                        try {
                            const animationSpec = buildMoveGhostAnimationSpec(moveCause, moveReason, deltaX, deltaY);
                            anim = ghost.animate(animationSpec.keyframes, {
                                duration: durationMs,
                                easing: animationSpec.easing
                            });
                        } catch (e) {
                            anim = null;
                        }
                    }

                    if (!anim) {
                        if (!useGhostOnly) {
                            toCell.innerHTML = '';
                            ensureDiscVisibleForMove(disc);
                            discHidden = false;
                            toCell.appendChild(disc);
                            toCell.classList.add('has-disc');
                            if (sourceCell === fromCell) {
                                fromCell.innerHTML = '';
                                fromCell.classList.remove('has-disc');
                            }
                        } else if (isCloneMove) {
                            const existingTargetDisc = toCell.querySelector('.disc');
                            if (!existingTargetDisc && t && t.after && (t.after.color === 1 || t.after.color === -1)) {
                                const targetDisc = this.createDisc(t.after);
                                ensureDiscVisibleForMove(targetDisc);
                                toCell.appendChild(targetDisc);
                                toCell.classList.add('has-disc');
                            }
                        }
                        return;
                    }

                    // Some environments resolve `finished` too early or don't support it reliably.
                    // Wait for finish event with a timeout fallback so move never becomes an instant teleport.
                    await new Promise((resolve) => {
                        let timeoutId = null;
                        let done = false;
                        const finish = () => {
                            if (done) return;
                            done = true;
                            try { if (anim && typeof anim.removeEventListener === 'function') anim.removeEventListener('finish', finish); } catch (e) { /* ignore */ }
                            if (timeoutId !== null) {
                                try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                                timeoutId = null;
                            }
                            resolve();
                        };
                        try {
                            if (anim && typeof anim.addEventListener === 'function') {
                                anim.addEventListener('finish', finish, { once: true });
                            }
                        } catch (e) { /* ignore */ }
                        try {
                            timeoutId = _Timer().setTimeout(finish, durationMs + 220, this.playbackScope);
                        } catch (e) {
                            timeoutId = setTimeout(finish, durationMs + 220);
                        }
                        try {
                            if (anim && anim.finished && typeof anim.finished.then === 'function') {
                                anim.finished.then(finish).catch(finish);
                            }
                        } catch (e) { /* ignore */ }
                    });

                    if (!useGhostOnly) {
                        toCell.innerHTML = '';
                        ensureDiscVisibleForMove(disc);
                        discHidden = false;
                        toCell.appendChild(disc);
                        toCell.classList.add('has-disc');
                        if (sourceCell === fromCell) {
                            fromCell.innerHTML = '';
                            fromCell.classList.remove('has-disc');
                        }
                    } else if (isCloneMove) {
                        const existingTargetDisc = toCell.querySelector('.disc');
                        if (!existingTargetDisc && t && t.after && (t.after.color === 1 || t.after.color === -1)) {
                            const targetDisc = this.createDisc(t.after);
                            ensureDiscVisibleForMove(targetDisc);
                            toCell.appendChild(targetDisc);
                            toCell.classList.add('has-disc');
                        }
                    }
                } finally {
                    if (hiddenTargetDisc) {
                        try { ensureDiscVisibleForMove(hiddenTargetDisc); } catch (e) { /* ignore */ }
                    }
                    if (discHidden) {
                        try { ensureDiscVisibleForMove(disc); } catch (e) { /* ignore */ }
                    }
                    if (ghost && ghost.parentElement) {
                        ghost.parentElement.removeChild(ghost);
                    }
                }
                } finally {
                    for (const highlightedCell of highlightedCells) {
                        try { highlightedCell.classList.remove(EFFECT_TARGET_HIGHLIGHT_CLASS); } catch (e) { /* ignore */ }
                    }
                }
            });
            await Promise.all(promises);
        }

        async handleStatusChange(ev) {
            const promises = ev.targets.map(async t => {
                const cell = this.getCellEl(t.r, t.col);

                const after = t.after || {};
                const rawType = String(ev && ev.rawType ? ev.rawType : '').toUpperCase();
                const isStatusTick = rawType === 'STATUS_TICK';
                const statusRemoveReason = String(
                    (ev && ev.meta && ev.meta.reason) ||
                    (ev && ev.reason) ||
                    ''
                ).toLowerCase();
                const removedSpecialUpper = String(ev && ev.meta && ev.meta.special ? ev.meta.special : '').toUpperCase();
                const isFreezeDurationEnd =
                    ev &&
                    ev.type === EVENT_TYPES.STATUS_REMOVED &&
                    removedSpecialUpper === 'FREEZE' &&
                    statusRemoveReason === 'duration_end' &&
                    !after.special;

                if (isStatusTick) {
                    const disc = await this.waitForDisc(t.r, t.col, 4);
                    if (!disc) return;
                    this.syncDiscTimerOnly(disc, after);
                    return;
                }

                if (isFreezeDurationEnd) {
                    await this.fadeOutFreezeOverlay(cell, OVERLAY_CROSSFADE_MS);
                    return;
                }

                const disc = await this.waitForDisc(t.r, t.col, 4);
                if (!disc) return;

                const isRegenConsumed =
                    ev &&
                    ev.type === EVENT_TYPES.STATUS_REMOVED &&
                    ev.meta &&
                    ev.meta.special === 'REGEN' &&
                    ev.meta.reason === 'regen_consumed' &&
                    !after.special;

                const isLossWillReset =
                    ev &&
                    ev.type === EVENT_TYPES.STATUS_REMOVED &&
                    ev.meta &&
                    ev.meta.reason === 'loss_will_reset' &&
                    !after.special;

                if (isRegenConsumed) {
                    await this.crossfadeDiscToState(disc, after, REGEN_CONSUME_FADE_MS);
                    return;
                }

                if (isLossWillReset) {
                    await this.crossfadeDiscToState(disc, after, OVERLAY_CROSSFADE_MS);
                    return;
                }

                const specialTypeUpper = String(after && after.special ? after.special : '').toUpperCase();
                const visualSpecialType = (specialTypeUpper === 'INHERITED_HYPERACTIVE') ? null : after.special;
                const effectKey = window.getEffectKeyForSpecialType(visualSpecialType);

                // Section 1.5: True Cross-Fade via overlay
                if (Visuals.crossfadeStoneVisual) {
                    await Visuals.crossfadeStoneVisual(disc, {
                        effectKey: effectKey,
                        owner: after.color, // Usually owner is same as color for these
                        durationMs: OVERLAY_CROSSFADE_MS,
                        newColor: after.color,
                        fadeIn: !!visualSpecialType
                    });
                    // Ensure timer UI is updated immediately after status changes.
                    this.syncDiscVisual(disc, after);
                } else {
                    this.syncDiscVisual(disc, after);
                }
            });
            await Promise.all(promises);
        }

        async fadeOutFreezeOverlay(cell, durationMs) {
            if (!cell) return;
            const freezeMark = cell.querySelector('.freeze-mark');
            cell.classList.remove('frozen-cell');
            if (!freezeMark) return;
            if (_isNoAnim() || !Number.isFinite(durationMs) || durationMs <= 0) {
                try { if (freezeMark.parentElement) freezeMark.parentElement.removeChild(freezeMark); } catch (e) { /* ignore */ }
                return;
            }

            const ghost = freezeMark.cloneNode(true);
            ghost.style.position = 'absolute';
            ghost.style.inset = '0';
            ghost.style.pointerEvents = 'none';
            ghost.style.zIndex = '85';
            ghost.style.opacity = '1';

            try { if (freezeMark.parentElement) freezeMark.parentElement.removeChild(freezeMark); } catch (e) { /* ignore */ }
            cell.appendChild(ghost);
            ghost.style.transition = `opacity ${durationMs}ms ease`;

            await new Promise((resolve) => {
                let timeoutId = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                        timeoutId = null;
                    }
                    try { ghost.removeEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                    try { if (ghost.parentElement) ghost.parentElement.removeChild(ghost); } catch (e) { /* ignore */ }
                    resolve();
                };
                const onEnd = (e) => {
                    if (!e || e.propertyName === 'opacity') finish();
                };
                try { ghost.addEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                try { timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope); } catch (e) { timeoutId = setTimeout(finish, durationMs + 120); }
                try {
                    requestAnimationFrame(() => {
                        ghost.style.opacity = '0';
                    });
                } catch (e) {
                    ghost.style.opacity = '0';
                }
            });
        }

        async crossfadeDiscToState(disc, after, durationMs) {
            if (!disc) return;
            const cell = disc.parentElement;
            if (!cell || _isNoAnim() || !Number.isFinite(durationMs) || durationMs <= 0) {
                this.syncDiscVisual(disc, after);
                return;
            }

            const ghost = disc.cloneNode(true);
            ghost.style.position = 'absolute';
            ghost.style.top = '0';
            ghost.style.left = '0';
            ghost.style.width = '100%';
            ghost.style.height = '100%';
            ghost.style.margin = '0';
            ghost.style.pointerEvents = 'none';
            ghost.style.zIndex = '85';
            ghost.style.opacity = '1';
            ghost.classList.add('stone-instant');
            cell.appendChild(ghost);

            const prevDiscTransition = disc.style.transition || '';
            disc.style.opacity = '0';
            this.syncDiscVisual(disc, after);
            disc.classList.add('stone-instant');
            disc.offsetHeight; // force reflow
            disc.classList.remove('stone-instant');
            disc.style.transition = prevDiscTransition ? `${prevDiscTransition}, opacity ${durationMs}ms ease` : `opacity ${durationMs}ms ease`;
            ghost.style.transition = `opacity ${durationMs}ms ease`;

            await new Promise((resolve) => {
                let timeoutId = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e) { /* ignore */ }
                        timeoutId = null;
                    }
                    try { ghost.removeEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                    try { if (ghost.parentElement) ghost.parentElement.removeChild(ghost); } catch (e) { /* ignore */ }
                    disc.style.opacity = '';
                    disc.style.transition = prevDiscTransition;
                    resolve();
                };
                const onEnd = (e) => {
                    if (!e || e.propertyName === 'opacity') finish();
                };
                try { ghost.addEventListener('transitionend', onEnd); } catch (e) { /* ignore */ }
                try { timeoutId = _Timer().setTimeout(finish, durationMs + 120, this.playbackScope); } catch (e) { timeoutId = setTimeout(finish, durationMs + 120); }
                try {
                    requestAnimationFrame(() => {
                        disc.style.opacity = '1';
                        ghost.style.opacity = '0';
                    });
                } catch (e) {
                    disc.style.opacity = '1';
                    ghost.style.opacity = '0';
                }
            });
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
            if (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function') {
                window.setDiscStoneImage(disc, state.color);
            }

            const specialTypeUpper = String(state.special || '').toUpperCase();
            const visualSpecialType = (specialTypeUpper === 'INHERITED_HYPERACTIVE') ? null : state.special;

            if (visualSpecialType) {
                const effectKey = window.getEffectKeyForSpecialType(visualSpecialType);
                if (window.applyStoneVisualEffect && effectKey) {
                    const ownerVal = (state.owner !== undefined && state.owner !== null) ? state.owner : state.color;
                    window.applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
                }
            } else {
                if (typeof window !== 'undefined' && typeof window.clearStoneVisualEffectState === 'function') {
                    window.clearStoneVisualEffectState(disc);
                } else {
                    disc.classList.remove('special-stone');
                    disc.style.removeProperty('--special-stone-image');
                    disc.style.removeProperty('--disc-overlay-image');
                    disc.style.removeProperty('--disc-overlay-scale');
                }
            }

            this.syncDiscTimerOnly(disc, state);
        }

        syncDiscTimerOnly(disc, state) {
            if (!disc || !state) return;

            const allTimerSelector = '.stone-timer, .bomb-timer, .special-timer, .inherited-hyperactive-timer, .dragon-timer, .udg-timer, .breeding-timer, .work-timer, .guard-timer, .flip-evade-timer, .destroy-evade-timer';
            const existingTimers = Array.from(disc.querySelectorAll(allTimerSelector));
            existingTimers.forEach((el) => el.remove());

            const specialType = String(state.special || '').toUpperCase();
            let primaryTimerValue = Number(state.timer);
            let inheritedTimerValue = Number(state.inheritedTimer);
            const parseCounterOrNaN = (raw) => {
                if (raw === null || raw === undefined || raw === '') return NaN;
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return NaN;
                return Math.max(0, Math.trunc(parsed));
            };
            let flipEvadeRemaining = parseCounterOrNaN(state.flipEvadeRemaining);
            let inheritedFlipEvadeRemaining = parseCounterOrNaN(state.inheritedFlipEvadeRemaining);
            const destroyEvadeRemaining = parseCounterOrNaN(state.destroyEvadeRemaining);

            if (specialType === 'INHERITED_HYPERACTIVE' && Number.isFinite(primaryTimerValue) && primaryTimerValue > 0) {
                if (!(Number.isFinite(inheritedTimerValue) && inheritedTimerValue > 0)) {
                    inheritedTimerValue = primaryTimerValue;
                }
                primaryTimerValue = NaN;
            }

            if (specialType === 'INHERITED_HYPERACTIVE' && Number.isFinite(flipEvadeRemaining) && flipEvadeRemaining >= 0) {
                if (!(Number.isFinite(inheritedFlipEvadeRemaining) && inheritedFlipEvadeRemaining >= 0)) {
                    inheritedFlipEvadeRemaining = flipEvadeRemaining;
                }
                flipEvadeRemaining = NaN;
            }

            const appendTimer = (className, value, options) => {
                const opts = options || {};
                const allowZero = opts.allowZero === true;
                if (!(Number.isFinite(value) && (allowZero ? value >= 0 : value > 0))) return;
                const timerEl = document.createElement('div');
                timerEl.className = className;
                timerEl.textContent = String(Math.max(0, Math.trunc(value)));
                disc.appendChild(timerEl);
            };

            if (Number.isFinite(primaryTimerValue) && primaryTimerValue > 0) {
                let primaryClass = 'stone-timer special-timer';
                if (specialType === 'TIME_BOMB') primaryClass = 'stone-timer bomb-timer';
                else if (specialType === 'GUARD') primaryClass = 'guard-timer';
                else if (specialType === 'DRAGON' || specialType === 'DESTROY_DRAGON') primaryClass = 'stone-timer dragon-timer';
                else if (specialType === 'ULTIMATE_DESTROY_GOD') primaryClass = 'stone-timer udg-timer';
                else if (specialType === 'BREEDING') primaryClass = 'stone-timer breeding-timer';
                else if (specialType === 'WORK') primaryClass = 'stone-timer work-timer';
                appendTimer(primaryClass, primaryTimerValue);
            }

            if (Number.isFinite(inheritedTimerValue) && inheritedTimerValue > 0) {
                appendTimer('stone-timer special-timer inherited-hyperactive-timer', inheritedTimerValue);
            }

            const isPrimaryFlipEvadeSpecialType = (
                specialType === 'HYPERACTIVE' ||
                specialType === 'EXTREME_HYPERACTIVE' ||
                specialType === 'ESCAPE_HYPERACTIVE' ||
                specialType === 'ULTIMATE_HYPERACTIVE' ||
                specialType === 'WILL_HUNTER_KING'
            );
            const hasInheritedContext = (
                specialType === 'INHERITED_HYPERACTIVE' ||
                (state.inheritedTimer !== null && state.inheritedTimer !== undefined) ||
                (state.inheritedOwner !== null && state.inheritedOwner !== undefined && state.inheritedOwner !== '')
            );

            const hasPrimaryEvadeCounter = isPrimaryFlipEvadeSpecialType && Number.isFinite(flipEvadeRemaining) && flipEvadeRemaining >= 0;
            const hasInheritedEvadeCounter = hasInheritedContext && Number.isFinite(inheritedFlipEvadeRemaining) && inheritedFlipEvadeRemaining >= 0;
            const evadeCounterValue = hasPrimaryEvadeCounter
                ? (hasInheritedEvadeCounter ? (flipEvadeRemaining + inheritedFlipEvadeRemaining) : flipEvadeRemaining)
                : (hasInheritedEvadeCounter ? inheritedFlipEvadeRemaining : NaN);
            if (Number.isFinite(evadeCounterValue) && evadeCounterValue >= 0) {
                appendTimer('stone-timer flip-evade-timer', evadeCounterValue, { allowZero: true });
            }

            const hasDestroyEvadeCounter =
                specialType === 'WILL_HUNTER_KING' &&
                Number.isFinite(destroyEvadeRemaining) &&
                destroyEvadeRemaining >= 0;
            if (hasDestroyEvadeCounter) {
                appendTimer('stone-timer destroy-evade-timer', destroyEvadeRemaining, { allowZero: true });
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
            if (PlaybackState && typeof PlaybackState.setInteractionLock === 'function') {
                PlaybackState.setInteractionLock(locked);
            } else {
                window.isProcessing = locked;
                window.isCardAnimating = locked; // legacy flag
                window.VisualPlaybackActive = locked;
                window.__playbackActiveSince = locked ? Date.now() : null;
            }
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
