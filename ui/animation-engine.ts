import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const SoundEngine: any;
declare const OwnerHelpers: any;
declare const TimerRegistry: any;
declare const BLACK: number;
declare const WHITE: number;
declare const addLog: ((msg: any) => void) | undefined;
declare const playHandAnimation: any;

const Constants = _require('./animation-constants');
const Visuals = _require('./stone-visuals');
const PlaybackStateManager = _require('./playback-state-manager');
const PresentationEffectProfiles = _require('../shared/presentation-effect-profiles');

const {
        EVENT_TYPES,
        FLIP_MS,
        PHASE_GAP_MS,
        POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS,
        FADE_IN_MS,
        BREEDING_SPAWN_FADE_MS,
        REGEN_CONSUME_FADE_MS,
        FADE_OUT_MS,
        OVERLAY_CROSSFADE_MS,
        MOVE_MS,
        OBSERVER_BUBBLE_MS,
        OBSERVER_BUBBLE_FADE_MS,
        THEORY_SPAWN_ROULETTE_MS,
        THEORY_SPAWN_MATERIALIZE_MS
    } = Constants;
    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const EFFECT_TARGET_HIGHLIGHT_CLASS = 'effect-target-highlight';
    const EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS = 'effect-target-highlight-positive';
    const EFFECT_TARGET_SPAWN_HIGHLIGHT_CLASS = 'effect-target-highlight-spawn';
    const HIGHLIGHT_TONE_NEGATIVE = 'negative';
    const HIGHLIGHT_TONE_POSITIVE = 'positive';
    const LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY = '__skipNextPlaybackSoundUntilByKey';
    const LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY = '__skipNextCardUseAnimationUntilByKey';
    const LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY = '__skipNextCardUseButtonSoundCount';
    const LOCAL_CARD_USE_PLAYBACK_SKIP_MS = 30000;
    const MANIFEST_ENDING_TRANSITION_MS = 2000;
    const MANIFEST_ENDING_DIM_OPACITY = 0.6;
    const POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS = PresentationEffectProfiles.POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS;
    const matchesCauseAndReasonPrefix = PresentationEffectProfiles.matchesCauseAndReasonPrefix;
    const matchesSpawnProfileTarget = PresentationEffectProfiles.matchesSpawnProfileTarget;
    const DESTROY_SOURCE_ANIMATION_PROFILES = Object.freeze([
        Object.freeze({
            causes: Object.freeze(['SNIPER_WILL']),
            reasonPrefix: 'sniper_shot',
            sourceResolver: '_resolveSniperSource',
            animationMethod: 'animateSniperProjectile'
        }),
        Object.freeze({
            causes: Object.freeze(['DESTROY_DRAGON', 'DESTROY_DRAGON_WILL']),
            reasonPrefix: 'destroy_dragon_breath',
            sourceResolver: '_resolveDestroyDragonSource',
            animationMethod: 'animateDestroyDragonBreath'
        }),
        Object.freeze({
            causes: Object.freeze(['ULTIMATE_DESTROY_GOD']),
            reasonPrefix: 'udg_destroyed',
            sourceResolver: '_resolveSniperSource',
            animationMethod: 'animateUdgLightningStrike'
        }),
        Object.freeze({
            causes: Object.freeze(['LIGHTNING_WILL']),
            reasonPrefix: 'lightning_destroyed',
            sourceResolver: '_resolveSniperSource',
            animationMethod: 'animateUdgLightningStrike'
        }),
        Object.freeze({
            causes: Object.freeze(['METEOR_GOD']),
            reasonPrefix: 'meteor_god_cell_destroy',
            sourceResolver: '_resolveSniperSource',
            animationMethod: 'animateMeteorGodBlackBeam'
        }),
        Object.freeze({
            causes: Object.freeze(['WILL_HUNTER_KING']),
            reasonPrefix: 'will_hunter_king_slash',
            sourceResolver: null,
            animationMethod: 'animateWillHunterKingSlash'
        }),
        Object.freeze({
            causes: Object.freeze(['ROBOT_VACUUM']),
            reasonPrefix: 'robot_vacuum_suck',
            sourceResolver: '_resolveRobotVacuumSource',
            animationMethod: 'animateRobotVacuumSuction',
            afterDestroy: 'clearCell'
        })
    ]);

    function hasRegenBackFlip(events: any) {
        return (events || []).some((e: any) =>
            e &&
            e.type === EVENT_TYPES.FLIP &&
            Array.isArray(e.targets) &&
            e.targets.some((t: any) => t && t.cause === REGEN_CAUSE && t.reason === REGEN_TRIGGER_REASON)
        );
    }

    function tryRequireRuntimeModule(id: string): { ok: boolean; value: any } {
        if (typeof require !== 'function') return { ok: false, value: null };
        try {
            return { ok: true, value: require(id) };
        } catch (e: any) {
            return { ok: false, value: null };
        }
    }

    function requireRuntimeModuleOrNull(id: string): any {
        const loaded = tryRequireRuntimeModule(id);
        return loaded.ok ? loaded.value : null;
    }

    function readWindowGlobal(name: string): any {
        return (typeof window !== 'undefined') ? (window as any)[name] : null;
    }

    function requireRuntimeModuleOrWindowGlobal(id: string, globalName: string): any {
        const loaded = tryRequireRuntimeModule(id);
        return loaded.ok ? loaded.value : readWindowGlobal(globalName);
    }

    function readOwnerHelpersGlobal(): any {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers) return OwnerHelpers;
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) return (globalThis as any).OwnerHelpers;
        } catch (e: any) { /* ignore */ }
        return null;
    }

var AnimationResolver = requireRuntimeModuleOrWindowGlobal('./animation-resolver', 'AnimationResolver');
var AnimationFeedbackEvents = requireRuntimeModuleOrWindowGlobal('./animation-feedback-events', 'AnimationFeedbackEvents');
var AnimationDestroyEvents = requireRuntimeModuleOrWindowGlobal('./animation-destroy-events', 'AnimationDestroyEvents');
var AnimationHandEvents = requireRuntimeModuleOrWindowGlobal('./animation-hand-events', 'AnimationHandEvents');
var AnimationFlipEvents = requireRuntimeModuleOrWindowGlobal('./animation-flip-events', 'AnimationFlipEvents');
var AnimationMoveEvents = requireRuntimeModuleOrWindowGlobal('./animation-move-events', 'AnimationMoveEvents');
var AnimationPlacementEvents = requireRuntimeModuleOrWindowGlobal('./animation-placement-events', 'AnimationPlacementEvents');
var AnimationStatusEvents = requireRuntimeModuleOrWindowGlobal('./animation-status-events', 'AnimationStatusEvents');
var AnimationDestroySourceEvents = requireRuntimeModuleOrWindowGlobal('./animation-destroy-source-events', 'AnimationDestroySourceEvents');
var AnimationTheoryEvents = requireRuntimeModuleOrWindowGlobal('./animation-theory-events', 'AnimationTheoryEvents');
var AnimationShared = (AnimationResolver && typeof AnimationResolver.getAnimationShared === 'function')
        ? AnimationResolver.getAnimationShared()
        : ((typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null));
    var _isNoAnim = (AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () { return false; };
    var OwnerHelpersModule = (AnimationResolver && typeof AnimationResolver.resolveModuleOrGlobal === 'function')
        ? AnimationResolver.resolveModuleOrGlobal('../utils/owner-helpers', 'OwnerHelpers')
        : (function () {
            if (typeof require === 'function') {
                return requireRuntimeModuleOrNull('../utils/owner-helpers');
            }
            return readOwnerHelpersGlobal();
        }());
    var BoardUpdateDispatch = (AnimationResolver && typeof AnimationResolver.resolveModuleOrGlobal === 'function')
        ? AnimationResolver.resolveModuleOrGlobal('./board-update-dispatch', 'BoardUpdateDispatch')
        : ((typeof require === 'function') ? requireRuntimeModuleOrNull('./board-update-dispatch') : readWindowGlobal('BoardUpdateDispatch'));
    var _Timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer : function () {
        if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
        return {
            setTimeout: (fn: any, ms: any) => setTimeout(fn, ms),
            clearTimeout: (id: any) => clearTimeout(id),
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

    function _getUiRootRef(): any {
        if (typeof window !== 'undefined' && window) return window;
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function _consumeLocalPlaybackSoundSkip(soundKey: any) {
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
        } catch (e: any) {
            registry[normalizedKey] = 0;
        }
        return expiresAt >= Date.now();
    }

    function _buildCardUseAnimationSkipKey(target: any) {
        const source = (target && typeof target === 'object') ? target : {};
        const owner = String(source.owner || source.player || '').trim();
        const cardId = String(source.cardId || '').trim();
        if (!owner || !cardId) return '';
        return `${owner}::${cardId}`;
    }

    function _armLocalCardUseAnimationSkip(target: any) {
        const key = _buildCardUseAnimationSkipKey(target);
        if (!key) return false;
        const rootRef = _getUiRootRef();
        if (!rootRef) return false;
        const registry = (rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY] && typeof rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY] === 'object')
            ? rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY]
            : {};
        registry[key] = Date.now() + LOCAL_CARD_USE_PLAYBACK_SKIP_MS;
        rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY] = registry;
        return true;
    }

    function _consumeLocalCardUseAnimationSkip(target: any) {
        const key = _buildCardUseAnimationSkipKey(target);
        if (!key) return false;
        const rootRef = _getUiRootRef();
        if (!rootRef) return false;
        const registry = rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY];
        if (!registry || typeof registry !== 'object') return false;
        const expiresAt = Number(registry[key]);
        if (!Number.isFinite(expiresAt)) return false;
        try {
            delete registry[key];
            if (Object.keys(registry).length === 0) {
                delete rootRef[LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY];
            }
        } catch (e: any) {
            registry[key] = 0;
        }
        return expiresAt >= Date.now();
    }

    function _armSkipNextCardUseButtonSound() {
        const rootRef = _getUiRootRef();
        if (!rootRef) return false;
        const current = Number.isFinite(Number(rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY]))
            ? Math.max(0, Math.trunc(Number(rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY])))
            : 0;
        rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY] = current + 1;
        return true;
    }

    function _consumeSkipNextCardUseButtonSound() {
        const rootRef = _getUiRootRef();
        if (!rootRef) return false;
        const current = Number.isFinite(Number(rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY]))
            ? Math.max(0, Math.trunc(Number(rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY])))
            : 0;
        if (current <= 0) return false;
        if (current === 1) {
            delete rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY];
        } else {
            rootRef[LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY] = current - 1;
        }
        return true;
    }

    function _requestBoardUpdate() {
        if (BoardUpdateDispatch && typeof BoardUpdateDispatch.requestBoardUpdate === 'function') {
            return BoardUpdateDispatch.requestBoardUpdate();
        }
        try {
            if (typeof emitBoardUpdate === 'function') {
                emitBoardUpdate();
                return true;
            }
        } catch (e: any) { /* ignore */ }
        return false;
    }

    class PlaybackEngine {
        isPlaying: any;
        boardEl: any;
        isAborted: any;
        _watchdogFired: any;
        playbackScope: any;
        _remainingEvents: any;
        _watchdogId: any;
        _phaseContext: any;
        _playbackRunSequence: any;
        _activePlaybackRunId: any;
        constructor() {
            this.isPlaying = false;
            this.boardEl = document.getElementById('board');
            this.isAborted = false;
            this._watchdogFired = false;
            this.playbackScope = null;
            this._remainingEvents = [];
            this._watchdogId = null;
            this._phaseContext = null;
            this._playbackRunSequence = 0;
            this._activePlaybackRunId = null;
        }

        _registerPlaybackAbortHandle(runId: any, runState: any) {
            if (!PlaybackState || typeof PlaybackState.registerPlaybackAbortHandle !== 'function') return null;
            const handle = {
                runId,
                abort: () => {
                    if (runState.externallyAborted === true) return false;
                    runState.externallyAborted = true;
                    this.isAborted = true;
                    this.isPlaying = false;
                    this._activePlaybackRunId = null;
                    const scope = runState.scope;
                    if (scope !== null) {
                        try { _Timer().clearScope(scope); } catch (e: any) { /* ignore */ }
                    }
                    const watchdogId = runState.watchdogId;
                    if (watchdogId) {
                        try { _Timer().clearTimeout(watchdogId); } catch (e: any) { /* ignore */ }
                    }
                    if (this.playbackScope === scope) {
                        this.playbackScope = null;
                    }
                    if (this._watchdogId === watchdogId) {
                        this._watchdogId = null;
                    }
                    runState.watchdogId = null;
                    return true;
                }
            };
            PlaybackState.registerPlaybackAbortHandle(handle);
            return handle;
        }

        _clearPlaybackAbortHandle(handle: any) {
            if (PlaybackState && typeof PlaybackState.clearPlaybackAbortHandle === 'function') {
                PlaybackState.clearPlaybackAbortHandle(handle);
            }
        }

        _isPlaybackStateActive() {
            if (PlaybackState && typeof PlaybackState.getPlaybackActive === 'function') {
                return PlaybackState.getPlaybackActive() === true;
            }
            return this.isPlaying === true;
        }

        _resolvePlaybackWatchdogMs() {
            const configured = (typeof window !== 'undefined')
                ? Number(window.PLAYBACK_WATCHDOG_MS)
                : NaN;
            return Number.isFinite(configured) && configured >= 0
                ? configured
                : 10000;
        }

        _resolvePlaybackOverlapWaitMs() {
            const explicit = (typeof window !== 'undefined')
                ? Number(window.PLAYBACK_OVERLAP_WAIT_MS)
                : NaN;
            if (Number.isFinite(explicit) && explicit >= 0) {
                return explicit;
            }
            return Math.max(3000, this._resolvePlaybackWatchdogMs() + 250);
        }

        async _waitForActivePlaybackToSettle(timeoutMs: any) {
            const safeTimeoutMs = Number.isFinite(Number(timeoutMs))
                ? Math.max(0, Number(timeoutMs))
                : 0;
            const startedAt = Date.now();
            while (this._isPlaybackStateActive() && (this.isPlaying === true || this._activePlaybackRunId !== null)) {
                if (safeTimeoutMs > 0 && Date.now() - startedAt >= safeTimeoutMs) {
                    return false;
                }
                await new Promise(resolve => _Timer().setTimeout(resolve, 25));
            }
            return true;
        }

        _toBoardIndex(value: any) {
            if (value === null || typeof value === 'undefined') return null;
            if (typeof value === 'boolean') return null;
            if (typeof value === 'string' && value.trim() === '') return null;
            const n = Number(value);
            if (!Number.isFinite(n)) return null;
            return Math.trunc(n);
        }

        _normalizeCellRef(ref: any) {
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

        _normalizeTarget(target: any, eventType: any) {
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

        _normalizeEvent(ev: any) {
            if (!ev || typeof ev !== 'object') return ev;
            const out = Object.assign({}, ev);
            if (String(ev.type || '').toUpperCase() === 'CHARGE_BUBBLE') {
                out.type = EVENT_TYPES.OBSERVER_BUBBLE;
                out.rawType = ev.rawType || 'CHARGE_BUBBLE';
                out.targets = [{
                    r: Object.prototype.hasOwnProperty.call(ev, 'r') ? ev.r : ev.row,
                    col: ev.col,
                    owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                    gained: Number(ev.gained) || 0,
                    text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : null,
                    bubbleKind: 'charge',
                    sourceType: (ev.meta && ev.meta.sourceType) ? ev.meta.sourceType : null
                }];
                return out;
            }
            if (Array.isArray(ev.targets)) {
                out.targets = ev.targets.map((t: any) => this._normalizeTarget(t, ev.type));
            }
            return out;
        }

        _resolveSniperSource(target: any) {
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

        _resolveRobotVacuumSource(target: any) {
            return this._resolveSniperSource(target);
        }

        _resolveDestroyDragonSource(target: any) {
            return this._resolveSniperSource(target);
        }

        _getTargetCause(target: any) {
            return String(target && target.cause ? target.cause : '').toUpperCase();
        }

        _getTargetReason(target: any) {
            return String(target && target.reason ? target.reason : '').toLowerCase();
        }

        _resolveDestroySourceAnimationProfile(target: any) {
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            for (const profile of DESTROY_SOURCE_ANIMATION_PROFILES as any) {
                if (!matchesCauseAndReasonPrefix(cause, reason, profile)) continue;
                const resolverName = profile.sourceResolver;
                if (resolverName) {
                    const resolver = (this as any)[resolverName];
                    if (typeof resolver !== 'function' || !resolver.call(this, target)) continue;
                }
                return profile;
            }
            return null;
        }

        async _playDestroySourceAnimation(target: any, profile: any) {
            if (!profile || !profile.animationMethod) return;
            const animationMethod = (this as any)[profile.animationMethod];
            if (typeof animationMethod !== 'function') return;
            await animationMethod.call(this, target);
        }

        _isSuperCrushCause(cause: any) {
            return cause === 'BUOYANCY_WILL' || cause === 'SUPER_BUOYANCY_WILL' || cause === 'GRAVITY_WILL' || cause === 'SUPER_GRAVITY_WILL' || cause === 'SUPER_ATTRACTION_WILL';
        }

        _resolveMoveDurationScale(target: any) {
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            if (
                cause === 'SUPER_ATTRACTION_WILL' ||
                reason.indexOf('super_attraction_move') === 0 ||
                reason.indexOf('super_attraction_collision') === 0
            ) {
                return 0.5;
            }
            if (target && target.isPositionSwapMove) return 0.8;
            return 1;
        }

        _resolveSuperCrushCollisionDelayMs(target: any) {
            const cause = this._getTargetCause(target);
            if (!this._isSuperCrushCause(cause)) return 0;

            const meta = (target && typeof target.meta === 'object') ? target.meta : null;
            const progressRaw = Number(meta && meta.collisionProgress);
            if (!Number.isFinite(progressRaw)) return 0;

            const moveDurationMs = Math.max(1, Math.round((Number(MOVE_MS) || 400) * this._resolveMoveDurationScale(target)));
            // Keep destroy slightly before move arrival so destination replacement never erases timing.
            const normalizedProgress = Math.max(0, Math.min(0.88, progressRaw));
            const delayMs = Math.round(moveDurationMs * normalizedProgress);
            return delayMs > 0 ? delayMs : 0;
        }

        _resolveOwnerColorFromBefore(ownerBefore: any) {
            if (ownerBefore !== 'black' && ownerBefore !== 'white') return null;
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
            return ownerBefore === 'black' ? blackVal : whiteVal;
        }

        _resolveOwnerClassFromColor(ownerColor: any) {
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            return ownerColor === blackVal ? 'black' : 'white';
        }

        _resolveVisualColorFromState(state: any, fallbackDisc: any, fallbackOwner: any) {
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
            const rawColor = Number(state && state.color);
            if (rawColor === blackVal || rawColor === whiteVal) return rawColor;

            const ownerCandidate = (state && Object.prototype.hasOwnProperty.call(state, 'owner'))
                ? state.owner
                : fallbackOwner;
            const normalizedOwnerKey = this._normalizePlayerKeyOptional(ownerCandidate);
            if (normalizedOwnerKey === 'black') return blackVal;
            if (normalizedOwnerKey === 'white') return whiteVal;

            if (fallbackDisc && fallbackDisc.classList) {
                if (fallbackDisc.classList.contains('black')) return blackVal;
                if (fallbackDisc.classList.contains('white')) return whiteVal;
            }

            return null;
        }

        _normalizePlayerKeyOptional(value: any) {
            if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
                const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(value);
                if (normalized === 'black' || normalized === 'white') return normalized;
            }
            if (value === 'black' || value === 1 || value === '1') return 'black';
            if (value === 'white' || value === -1 || value === '-1') return 'white';
            return null;
        }

        _normalizePlayerKey(value: any) {
            return this._normalizePlayerKeyOptional(value) || 'black';
        }

        _getCurrentMatchMode() {
            try {
                if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
                    return String(OwnerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : null) || 'cpu').toLowerCase();
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function') {
                    return String(window.getCurrentMatchMode() || 'cpu').toLowerCase();
                }
                if (typeof window !== 'undefined' && window) {
                    const matchMode = window.MATCH_MODE || window.__MATCH_MODE;
                    if (matchMode) return String(matchMode).toLowerCase();
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                    return String((globalThis as any).getCurrentMatchMode() || 'cpu').toLowerCase();
                }
                if (typeof globalThis !== 'undefined') {
                    const matchMode = (globalThis as any).MATCH_MODE || (globalThis as any).__MATCH_MODE;
                    if (matchMode) return String(matchMode).toLowerCase();
                }
            } catch (e: any) { /* ignore */ }

            return 'cpu';
        }

        _resolveLocalSeatKey() {
            try {
                if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.resolveLocalPlayerKey === 'function') {
                    return this._normalizePlayerKey(OwnerHelpers.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null));
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                    return this._normalizePlayerKey(window.NetworkMatchClient.getSeatKey());
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && window) {
                    const candidates = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
                    for (const one of candidates) {
                        if (one === 'white' || one === -1 || one === '-1') return 'white';
                        if (one === 'black' || one === 1 || one === '1') return 'black';
                    }
                }
            } catch (e: any) { /* ignore */ }

            return 'black';
        }

        _resolveCardUseOwnerKey(target: any) {
            const t = (target && typeof target === 'object') ? target : {};
            if (Object.prototype.hasOwnProperty.call(t, 'owner') && t.owner !== null && typeof t.owner !== 'undefined' && t.owner !== '') {
                return this._normalizePlayerKey(t.owner);
            }
            if (Object.prototype.hasOwnProperty.call(t, 'player') && t.player !== null && typeof t.player !== 'undefined' && t.player !== '') {
                return this._normalizePlayerKey(t.player);
            }
            return null;
        }

        _resolveCardType(cardId: any) {
            if (!cardId) return null;
            if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getCardDef !== 'function') {
                return null;
            }
            const def = CardLogic.getCardDef(cardId);
            return def && typeof def.type === 'string' ? def.type : null;
        }

        _resolvePlaceHandDescriptor(target: any) {
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

        _shouldPlayPlaceHandAnimation(target: any) {
            const descriptor = this._resolvePlaceHandDescriptor(target);
            return !!descriptor;
        }

        _resolvePlayerValue(playerKey: any) {
            const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
            const whiteVal = (typeof WHITE !== 'undefined') ? WHITE : -1;
            return playerKey === 'white' ? whiteVal : blackVal;
        }

        _isCardEffectCause(cause: any) {
            return !!cause && cause !== 'SYSTEM';
        }

        _resolveEffectTargetHighlightTone(eventType: any, target: any) {
            if (_isNoAnim()) return null;
            const cause = this._getTargetCause(target);

            if (target && target.meta && (
                target.meta.blockedByGhost === true ||
                target.meta.proliferated === true ||
                target.meta.regenerated === true
            )) {
                return eventType === EVENT_TYPES.DESTROY
                    ? HIGHLIGHT_TONE_NEGATIVE
                    : HIGHLIGHT_TONE_POSITIVE;
            }
            if (!this._isCardEffectCause(cause)) return null;
            if (eventType === EVENT_TYPES.DESTROY) return HIGHLIGHT_TONE_NEGATIVE;
            if (eventType === EVENT_TYPES.MOVE) {
                const reason = this._getTargetReason(target);
                if (cause === 'DESTROY_EVADE' || reason.indexOf('destroy_evade_move') === 0) {
                    return HIGHLIGHT_TONE_NEGATIVE;
                }
            }
            return eventType === EVENT_TYPES.FLIP ||
                eventType === EVENT_TYPES.SPAWN ||
                eventType === EVENT_TYPES.PLACE ||
                eventType === EVENT_TYPES.MOVE
                ? HIGHLIGHT_TONE_POSITIVE
                : null;
        }

        _shouldPreserveDiscOnDestroy(target: any) {
            return !!(
                target &&
                target.meta && (
                    target.meta.blockedByGhost ||
                    target.meta.proliferated === true ||
                    target.meta.regenerated === true
                )
            );
        }

        _resolveDestroyTargetHighlightMinimumMs(target: any) {
            if (!target || !target.meta) return 0;
            const isProtectedDestroy =
                target.meta.proliferated === true ||
                target.meta.blockedByGhost === true ||
                target.meta.regenerated === true;
            if (!isProtectedDestroy) return 0;
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            const isOverlapReturnDestroy =
                (cause === 'GLUTTONOUS_WILL' && reason.indexOf('gluttonous_eat') === 0) ||
                (cause === 'WILL_HUNTER_KING' && reason.indexOf('will_hunter_king_slash') === 0);
            if (!isOverlapReturnDestroy) return 0;
            return Math.max(120, Math.floor(MOVE_MS / 2));
        }

        _resolveSpawnTargetHighlightMinimumMs(target: any) {
            if (!target) return 0;
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            const shouldKeepVisible = POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS.some((profile: any) => (
                matchesSpawnProfileTarget(target, cause, reason, profile)
            ));
            if (!shouldKeepVisible) return 0;
            return POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS;
        }

        _resolveStatusChangeHighlightMinimumMs(highlightTone: any) {
            if (!highlightTone) return 0;
            return highlightTone === HIGHLIGHT_TONE_POSITIVE
                ? POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS
                : PHASE_GAP_MS;
        }

        _isHyperactiveLikeMoveEvent(ev: any) {
            if (!ev || ev.type !== EVENT_TYPES.MOVE || !Array.isArray(ev.targets)) return false;
            return ev.targets.some((target: any) => {
                const cause = this._getTargetCause(target);
                const reason = this._getTargetReason(target);
                const moveIntent = String(target && target.meta && target.meta.moveIntent ? target.meta.moveIntent : '').toLowerCase();
                return (
                    moveIntent === 'hyperactive_move' ||
                    moveIntent === 'anchor_move' ||
                    cause === 'HYPERACTIVE' ||
                    cause === 'AFTERIMAGE_WILL' ||
                    cause === 'ESCAPE_HYPERACTIVE' ||
                    cause === 'EXTREME_HYPERACTIVE_WILL' ||
                    cause === 'ULTIMATE_REVERSE_DRAGON' ||
                    cause === 'ULTIMATE_DESTROY_GOD' ||
                    cause === 'ROBOT_VACUUM' ||
                    cause === 'GLUTTONOUS_WILL' ||
                    cause === 'ULTIMATE_HYPERACTIVE' ||
                    cause === 'ULTIMATE_HYPERACTIVE_GOD' ||
                    reason.indexOf('hyperactive') >= 0 ||
                    reason.indexOf('afterimage_will_flip_evade_move') === 0 ||
                    reason.indexOf('gluttonous') >= 0 ||
                    reason.indexOf('robot_vacuum_move') === 0 ||
                    reason.indexOf('ultimate_reverse_dragon_move') === 0 ||
                    reason.indexOf('ultimate_destroy_god_move') === 0
                );
            });
        }

        _shouldSkipPhaseGapBetween(phaseEvents: any[], nextEvents: any[]) {
            const current = Array.isArray(phaseEvents) ? phaseEvents : [];
            const next = Array.isArray(nextEvents) ? nextEvents : [];
            const hasPlaceOrSpawn = current.some((e: any) => e && (e.type === EVENT_TYPES.PLACE || e.type === EVENT_TYPES.SPAWN || e.type === EVENT_TYPES.PLACE_HAND_ANIMATION));
            const hasPlaceHandAnimation = current.some((e: any) => e && e.type === EVENT_TYPES.PLACE_HAND_ANIMATION);
            const nextHasSpawn = next.some((e: any) => e && e.type === EVENT_TYPES.SPAWN);
            const nextHasFlip = next.some((e: any) => e && e.type === EVENT_TYPES.FLIP);
            const nextHasRegenBackFlip = hasRegenBackFlip(next);
            const nextHasHyperactiveLikeMove = next.some((e: any) => this._isHyperactiveLikeMoveEvent(e));
            const skipPlaceGap = hasPlaceOrSpawn && (
                (nextHasFlip && !nextHasRegenBackFlip) ||
                (hasPlaceHandAnimation && nextHasSpawn) ||
                nextHasHyperactiveLikeMove
            );
            if (skipPlaceGap) return true;

            const hasCardUseAnimation = current.some((e: any) => e && e.type === EVENT_TYPES.CARD_USE_ANIMATION);
            const nextHasTreasureGainCue = next.some((ev: any) => {
                if (!ev || ev.type !== EVENT_TYPES.SOUND_EFFECT) return false;
                if (String(ev.soundKey || '').trim() === 'treasure_gain') return true;
                const targets = Array.isArray(ev.targets) ? ev.targets : [];
                return targets.some((t: any) => String((t && t.soundKey) || '').trim() === 'treasure_gain');
            });
            return hasCardUseAnimation && nextHasTreasureGainCue;
        }

        async _runWithEffectTargetHighlight(cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) {
            if (!cell || typeof runner !== 'function') return undefined;

            const highlightTone = this._resolveEffectTargetHighlightTone(eventType, target);
            const extraClasses = highlightTone === HIGHLIGHT_TONE_NEGATIVE && eventType === EVENT_TYPES.SPAWN
                ? [EFFECT_TARGET_SPAWN_HIGHLIGHT_CLASS]
                : [];
            return this._runWithTransientCellHighlight(cell, highlightTone, runner, minimumVisibleMs, extraClasses);
        }

        _resolveStatusChangeHighlightTone(ev: any, target: any) {
            if (!ev || (ev.type !== EVENT_TYPES.STATUS_APPLIED && ev.type !== EVENT_TYPES.STATUS_REMOVED)) return null;
            const meta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
            const explicitTone = String(meta.highlightTone || '').toLowerCase();
            if (explicitTone === 'none') return null;

            const reason = String(
                meta.reason ||
                (ev && ev.reason) ||
                (target && target.reason) ||
                ''
            ).toLowerCase();
            const specialUpper = String(
                meta.special ||
                (target && target.after && target.after.special) ||
                ''
            ).toUpperCase();
            if (specialUpper === 'BLOCKADE' || specialUpper === 'FREEZE') return null;
            if (specialUpper === 'TRAP_REVEAL' || reason === 'trap_expired_reveal') return HIGHLIGHT_TONE_NEGATIVE;
            if (explicitTone === HIGHLIGHT_TONE_POSITIVE || explicitTone === HIGHLIGHT_TONE_NEGATIVE) {
                return HIGHLIGHT_TONE_POSITIVE;
            }
            const rawType = String(ev && ev.rawType ? ev.rawType : '').toUpperCase();
            if (rawType === 'STATUS_TICK') return null;
            if (!specialUpper) return null;
            return HIGHLIGHT_TONE_POSITIVE;
        }

        async _runWithTransientCellHighlight(cell: any, highlightTone: any, runner: any, minimumVisibleMs: any, extraClasses: any) {
            if (!cell || typeof runner !== 'function') return undefined;
            const baseHighlightClass = highlightTone === HIGHLIGHT_TONE_POSITIVE
                ? EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS
                : (highlightTone === HIGHLIGHT_TONE_NEGATIVE ? EFFECT_TARGET_HIGHLIGHT_CLASS : null);
            if (!baseHighlightClass) {
                return runner();
            }

            let highlighted = false;
            const transientClasses = Array.isArray(extraClasses)
                ? extraClasses.filter((className) => typeof className === 'string' && className)
                : [];
            const minVisible = Number.isFinite(Number(minimumVisibleMs))
                ? Math.max(0, Math.trunc(Number(minimumVisibleMs)))
                : 0;
            const startedAt = Date.now();
            try {
                cell.classList.add(baseHighlightClass);
                for (const className of transientClasses) {
                    cell.classList.add(className);
                }
                highlighted = true;
            } catch (e: any) { /* ignore */ }

            try {
                return await runner();
            } finally {
                if (highlighted && minVisible > 0) {
                    const elapsed = Date.now() - startedAt;
                    const remaining = minVisible - elapsed;
                    if (remaining > 0) {
                        await this._sleep(remaining);
                    }
                }
                if (highlighted) {
                    for (const className of transientClasses) {
                        try { cell.classList.remove(className); } catch (e: any) { /* ignore */ }
                    }
                    try { cell.classList.remove(baseHighlightClass); } catch (e: any) { /* ignore */ }
                }
            }
        }

        async _waitForAnimationFinish(anim: any, durationMs: any, timeoutPaddingMs: any) {
            if (!anim) return;
            const timeoutMs = Math.max(0, Math.round(Number(durationMs) || 0)) +
                Math.max(0, Math.round(Number(timeoutPaddingMs) || 0));

            await new Promise<void>((resolve) => {
                let timeoutId: any = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    try {
                        if (anim && typeof anim.removeEventListener === 'function') {
                            anim.removeEventListener('finish', finish);
                        }
                    } catch (e: any) { /* ignore */ }
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                        timeoutId = null;
                    }
                    resolve();
                };
                try {
                    if (anim && typeof anim.addEventListener === 'function') {
                        anim.addEventListener('finish', finish, { once: true });
                    }
                } catch (e: any) { /* ignore */ }
                try {
                    timeoutId = _Timer().setTimeout(finish, timeoutMs, this.playbackScope);
                } catch (e: any) {
                    timeoutId = setTimeout(finish, timeoutMs);
                }
                try {
                    if (anim && anim.finished && typeof anim.finished.then === 'function') {
                        anim.finished.then(finish).catch(finish);
                    }
                } catch (e: any) { /* ignore */ }
            });
        }

        async _waitForOpacityTransition(element: any, durationMs: any, timeoutPaddingMs: any, startTransition: any, cleanup: any) {
            if (!element) {
                if (typeof cleanup === 'function') {
                    try { cleanup(); } catch (e: any) { /* ignore */ }
                }
                return;
            }

            const timeoutMs = Math.max(0, Math.round(Number(durationMs) || 0)) +
                Math.max(0, Math.round(Number(timeoutPaddingMs) || 0));

            await new Promise<void>((resolve) => {
                let timeoutId: any = null;
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    if (timeoutId !== null) {
                        try { _Timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                        timeoutId = null;
                    }
                    try { element.removeEventListener('transitionend', onEnd); } catch (e: any) { /* ignore */ }
                    if (typeof cleanup === 'function') {
                        try { cleanup(); } catch (e: any) { /* ignore */ }
                    }
                    resolve();
                };
                const onEnd = (e: any) => {
                    if (!e || e.propertyName === 'opacity') finish();
                };
                try { element.addEventListener('transitionend', onEnd); } catch (e: any) { /* ignore */ }
                try {
                    timeoutId = _Timer().setTimeout(finish, timeoutMs, this.playbackScope);
                } catch (e: any) {
                    timeoutId = setTimeout(finish, timeoutMs);
                }
                if (typeof startTransition === 'function') {
                    try {
                        startTransition();
                    } catch (e: any) {
                        finish();
                    }
                }
            });
        }

        _getDestroySourceAnimationDeps() {
            if (!(AnimationDestroySourceEvents && typeof AnimationDestroySourceEvents.animateSniperProjectile === 'function')) {
                throw new Error('AnimationEngine destroy source events module unavailable');
            }
            return {
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                resolveSniperSource: (target: any) => this._resolveSniperSource(target),
                resolveRobotVacuumSource: (target: any) => this._resolveRobotVacuumSource(target),
                resolveDestroyDragonSource: (target: any) => this._resolveDestroyDragonSource(target),
                waitForAnimationFinish: (anim: any, durationMs: any, timeoutPaddingMs: any) => this._waitForAnimationFinish(anim, durationMs, timeoutPaddingMs),
                sleep: (ms: any) => this._sleep(ms),
                timer: _Timer,
                playbackScope: this.playbackScope
            };
        }

        _resolveSniperProjectileOwner(target: any) {
            if (!(AnimationDestroySourceEvents && typeof AnimationDestroySourceEvents.resolveSniperProjectileOwner === 'function')) {
                throw new Error('AnimationEngine destroy source events module unavailable');
            }
            return AnimationDestroySourceEvents.resolveSniperProjectileOwner(target);
        }

        async animateSniperProjectile(target: any) {
            return AnimationDestroySourceEvents.animateSniperProjectile(target, this._getDestroySourceAnimationDeps());
        }

        async animateRobotVacuumSuction(target: any) {
            return AnimationDestroySourceEvents.animateRobotVacuumSuction(target, this._getDestroySourceAnimationDeps());
        }

        async animateDestroyDragonBreath(target: any) {
            return AnimationDestroySourceEvents.animateDestroyDragonBreath(target, this._getDestroySourceAnimationDeps());
        }

        async animateUdgLightningStrike(target: any) {
            return AnimationDestroySourceEvents.animateUdgLightningStrike(target, this._getDestroySourceAnimationDeps());
        }

        async animateMeteorGodBlackBeam(target: any) {
            return AnimationDestroySourceEvents.animateMeteorGodBlackBeam(target, this._getDestroySourceAnimationDeps());
        }

        /**
         * Play a sequence of PlaybackEvents.
         * @param {Array} events - Ordered PlaybackEvents
         * @returns {Promise<void>}
         */
        async play(events: any) {
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
                event.targets.some((target: any) => String(target && target.cause ? target.cause : '').toUpperCase() === 'CELL_TELEPORT_WILL')
            ));

            const hasActivePlaybackRun = this.isPlaying === true || this._activePlaybackRunId !== null;
            if (this._isPlaybackStateActive() && hasActivePlaybackRun) {
                const overlapWaitMs = this._resolvePlaybackOverlapWaitMs();
                const settled = await this._waitForActivePlaybackToSettle(overlapWaitMs);
                if (!settled && this._isPlaybackStateActive() && (this.isPlaying === true || this._activePlaybackRunId !== null)) {
                    console.warn('[AnimationEngine] Already playing. Aborting previous...');
                    this.isAborted = true;
                    // Wait a short settle period
                    await new Promise(r => _Timer().setTimeout(r, 100));
                    this.isAborted = false;
                }
            }

            const runId = this._playbackRunSequence + 1;
            this._playbackRunSequence = runId;
            this._activePlaybackRunId = runId;
            const runState = {
                scope: null,
                watchdogId: null,
                externallyAborted: false
            };
            let abortHandle: any = null;
            // Setup playback scope and flags
            this.isPlaying = true;
            this.playbackScope = (typeof TimerRegistry !== 'undefined' && TimerRegistry.newScope) ? TimerRegistry.newScope() : null;
            runState.scope = this.playbackScope;
                // expose scope for animations to register timers under
                if (typeof window !== 'undefined') window._currentPlaybackScope = this.playbackScope;
            abortHandle = this._registerPlaybackAbortHandle(runId, runState);

            // VisualPlaybackActive is the single source of truth during playback
            try {
                if (PlaybackState && typeof PlaybackState.beginPlayback === 'function') {
                    PlaybackState.beginPlayback({ boardElement: this.boardEl });
                    this.isPlaying = PlaybackState.getPlaybackActive() === true;
                } else {
                    this.setGlobalInteractionLock(true);
                }

                // Watchdog to prevent permanent freezes
                const WATCHDOG_TIMEOUT_MS = this._resolvePlaybackWatchdogMs();
                if (this.playbackScope !== null) {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS, this.playbackScope);
                } else {
                    this._watchdogId = _Timer().setTimeout(() => this.handleWatchdog(), WATCHDOG_TIMEOUT_MS);
                }
                runState.watchdogId = this._watchdogId;

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
                    this._remainingEvents = this._remainingEvents.filter((ev: any) => Number(ev.phase || 0) > Number(phase));

                    const phaseEvents = phases[phase];
                    await this.executePhase(phaseEvents);

                    // Gap between readable phases (Section 3)
                    if (phase !== sortedPhases[sortedPhases.length - 1]) {
                        // Avoid a noticeable delay between hand placement and the stone appearing / flipping.
                        // Free-placement specials often materialize as "place_hand_animation -> spawn only",
                        // so treat the first spawn the same as an immediate follow-up flip.
                        const nextPhaseKey = sortedPhases[sortedPhases.indexOf(phase) + 1];
                        const nextEvents = phases[nextPhaseKey] || [];
                        if (!this._shouldSkipPhaseGapBetween(phaseEvents, nextEvents)) {
                            await this._sleep(PHASE_GAP_MS);
                        }
                    }
                }
            } catch (err: any) {
                abortedDuringPlay = true;
                console.error('[AnimationEngine] Playback error:', err);
            } finally {
                this._clearPlaybackAbortHandle(abortHandle);
                // cleanup watchdog & scope
                if (runState.scope !== null) {
                    _Timer().clearScope(runState.scope);
                }
                // remove exposed scope
                if (typeof window !== 'undefined' && window._currentPlaybackScope === runState.scope) delete window._currentPlaybackScope;
                if (runState.watchdogId) {
                    _Timer().clearTimeout(runState.watchdogId);
                }
                const isCurrentRun = this._activePlaybackRunId === runId;
                if (this.playbackScope === runState.scope) {
                    this.playbackScope = null;
                }
                if (this._watchdogId === runState.watchdogId) {
                    this._watchdogId = null;
                }
                if (isCurrentRun) {
                    this._activePlaybackRunId = null;
                    this.isPlaying = false;
                }
                const shouldArmBoardUpdateContext = isCurrentRun
                    && !runState.externallyAborted
                    && (shouldSuppressNextDiffFlip || shouldSuppressBoardExpansionRevealSound)
                    && !abortedDuringPlay
                    && !this._watchdogFired
                    && !this.isAborted;
                const boardUpdateContext = shouldArmBoardUpdateContext
                    ? {
                        source: 'animation-engine',
                        reason: 'post_playback_sync',
                        suppressFallbackFlip: shouldSuppressNextDiffFlip === true,
                        suppressBoardExpansionRevealSound: shouldSuppressBoardExpansionRevealSound === true
                    }
                    : null;
                // Avoid leaking abort state into the next playback run.
                if (isCurrentRun) {
                    this.isAborted = false;
                }
                // After playback completes, request a final board diff render to ensure DOM matches state.
                // This avoids stale visuals when diff rendering was suppressed during playback.
                if (isCurrentRun && !runState.externallyAborted) {
                    if (PlaybackState && typeof PlaybackState.finalizePlayback === 'function') {
                        PlaybackState.finalizePlayback({
                            boardElement: this.boardEl,
                            boardUpdateContext,
                            clearBoardUpdateContext: true,
                            emitBoardUpdate: _requestBoardUpdate
                        });
                    } else {
                        this.setGlobalInteractionLock(false);
                        if (boardUpdateContext && PlaybackState && typeof PlaybackState.armBoardUpdateContext === 'function') {
                            PlaybackState.armBoardUpdateContext(boardUpdateContext);
                        }
                        _requestBoardUpdate();
                    }
                }
              }
        }
        groupByPhase(events: any) {
            return events.reduce((acc: any, ev: any) => {
                const p = ev.phase || 0;
                if (!acc[p]) acc[p] = [];
                acc[p].push(ev);
                return acc;
            }, {});
        }

        _isSuperCrushMoveTarget(target: any) {
            const cause = this._getTargetCause(target);
            const reason = this._getTargetReason(target);
            return this._isSuperCrushCause(cause) ||
                reason.indexOf('super_buoyancy_move') === 0 ||
                reason.indexOf('super_gravity_move') === 0 ||
                reason.indexOf('super_attraction_move') === 0;
        }

        _buildPhaseContext(events: any) {
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

        _getSuperCrushDestinationContext(row: any, col: any) {
            const ctx = this._phaseContext;
            if (!ctx || !(ctx.superCrushDestinations instanceof Map)) return null;
            return ctx.superCrushDestinations.get(`${row},${col}`) || null;
        }

        async _withPhaseContext(context: any, runner: any) {
            const prev = this._phaseContext;
            this._phaseContext = context || null;
            try {
                return await runner();
            } finally {
                this._phaseContext = prev;
            }
        }

        async _animateDestroyGhostAtCell(cell: any, ownerColor: any) {
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

        _removeDiscFromCell(cell: any, disc: any) {
            if (!cell || !disc) return;
            try {
                if (disc.parentElement === cell) cell.removeChild(disc);
            } catch (e: any) { /* ignore */ }
            try {
                if (!cell.querySelector('.disc')) cell.classList.remove('has-disc');
            } catch (e: any) { /* ignore */ }
        }

        _isBoardShrinkHoleStatusChange(ev: any, target: any) {
            const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
            const targetMeta = target && target.meta && typeof target.meta === 'object' ? target.meta : null;
            const visualVariant = String(
                (targetMeta && targetMeta.visualVariant) ||
                (meta && meta.visualVariant) ||
                (target && target.after && target.after.visualVariant) ||
                ''
            ).toUpperCase();
            return visualVariant === 'BOARD_FRAME';
        }

        _ensureBoardShrinkHoleMark(cell: any) {
            if (!cell || typeof document === 'undefined') return null;
            try {
                cell.classList.add('blocked-cell', 'board-shrink-hole-cell');
                cell.classList.remove('meteor-hole-cell');
                let mark = cell.querySelector('.board-shrink-hole-mark');
                if (!mark) {
                    mark = document.createElement('div');
                    mark.className = 'board-shrink-hole-mark';
                    cell.appendChild(mark);
                }
                return mark;
            } catch (e: any) {
                return null;
            }
        }

        async _playBoardShrinkHolePushIn(cell: any) {
            const mark = this._ensureBoardShrinkHoleMark(cell);
            if (!mark) return;
            if (_isNoAnim()) return;
            try {
                cell.classList.add('board-shrink-hole-push-active');
                mark.classList.add('board-shrink-hole-push-in');
                await this._sleep(Math.max(180, Math.min(360, Math.round(FADE_OUT_MS * 0.55))));
            } finally {
                try { mark.classList.remove('board-shrink-hole-push-in'); } catch (e: any) { /* ignore */ }
                try { cell.classList.remove('board-shrink-hole-push-active'); } catch (e: any) { /* ignore */ }
            }
        }

        async executePhase(phaseEvents: any) {
            const events = Array.isArray(phaseEvents) ? phaseEvents.slice() : [];
            const hasTreasureGainCue = events.some((ev) => {
                if (!ev || ev.type !== EVENT_TYPES.SOUND_EFFECT) return false;
                if (String(ev.soundKey || '').trim() === 'treasure_gain') return true;
                const targets = Array.isArray(ev.targets) ? ev.targets : [];
                return targets.some((t: any) => String((t && t.soundKey) || '').trim() === 'treasure_gain');
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
                        const filtered = keys.filter((k) => k && k !== 'charge_gain_common');
                        if (!filtered.length) return null;
                        const nextEv = Object.assign({}, ev);
                        delete nextEv.soundKey;
                        nextEv.targets = filtered.map((soundKey) => ({ soundKey }));
                        return nextEv;
                    })
                    .filter((ev) => !!ev)
                : events;

            const manifestEndingEvents = effectiveEvents.filter(ev => ev && ev.type === EVENT_TYPES.MANIFEST_ENDING);
            if (manifestEndingEvents.length) {
                const remainingEvents = effectiveEvents.filter(ev => !ev || ev.type !== EVENT_TYPES.MANIFEST_ENDING);
                for (const ev of manifestEndingEvents) {
                    await this.executeEvent(ev);
                }
                if (remainingEvents.length) {
                    await this.executePhase(remainingEvents);
                }
                return;
            }

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

        async _sleep(ms: any) {
            if (_isNoAnim()) return Promise.resolve();
            return new Promise<void>(resolve=> {
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
            } catch (e: any) { /* best-effort */ }
            this.isAborted = true;
            // Apply final state by requesting a full board sync
            try {
                _requestBoardUpdate();
            } catch (e: any) { console.error('[AnimationEngine] watchdog emitBoardUpdate failed', e); }
            // Ensure flags cleared
            if (PlaybackState && typeof PlaybackState.abortPlayback === 'function') {
                PlaybackState.abortPlayback({ boardElement: this.boardEl });
            } else if (typeof window !== 'undefined') {
                this.setGlobalInteractionLock(false);
            }
        }

        // Abort externally and apply final state (used by Single Visual Writer fallback)
        abortAndSync() {
            console.info('[AnimationEngine] abortAndSync called — stopping playback and syncing state');
            // Telemetry increment for aborts
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.abortCount = (window.__telemetry__.abortCount || 0) + 1; }
            try {
                if (this.playbackScope !== null) _Timer().clearScope(this.playbackScope);
            } catch (e: any) { /* Intentionally empty: timer cleanup in abort path */ }
            this.isAborted = true;
            if (PlaybackState && typeof PlaybackState.abortPlayback === 'function') {
                PlaybackState.abortPlayback({ boardElement: this.boardEl });
            } else {
                this.setGlobalInteractionLock(false);
            }
            try { _requestBoardUpdate(); } catch (e: any) { /* Intentionally empty: board update in abort path */ }
        }

        async executeEvent(ev: any) {
            const handPlaybackResult = this._handleHandPlaybackEvent(ev);
            if (handPlaybackResult !== null) {
                return handPlaybackResult;
            }
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
                case EVENT_TYPES.OBSERVER_BUBBLE:
                    return this.handleObserverBubble(ev);
                case EVENT_TYPES.ROUND_BONUS_BANNER:
                    return this.handleRoundBonusBanner(ev);
                case EVENT_TYPES.SPECIAL_CARD_CINEMATIC:
                    return this.handleSpecialCardCinematic(ev);
                case EVENT_TYPES.MANIFEST_ENDING:
                    return this.handleManifestEnding(ev);
                case EVENT_TYPES.THEORY_INCARNATION_SPAWN_ROULETTE:
                    return this.handleTheoryIncarnationSpawnRoulette(ev);
                case EVENT_TYPES.SOUND_EFFECT:
                    return this.handleSoundEffect(ev);
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

        _handleHandPlaybackEvent(ev: any) {
            if (!(AnimationHandEvents && typeof AnimationHandEvents.handleHandPlaybackEvent === 'function')) {
                throw new Error('AnimationEngine hand events module unavailable');
            }
            return AnimationHandEvents.handleHandPlaybackEvent(ev, {
                timer: _Timer,
                playbackScope: this.playbackScope,
                resolvePlaceHandDescriptor: (target: any) => this._resolvePlaceHandDescriptor(target),
                shouldPlayPlaceHandAnimation: (target: any) => this._shouldPlayPlaceHandAnimation(target),
                resolvePlayerValue: (playerKey: any) => this._resolvePlayerValue(playerKey),
                consumeLocalCardUseAnimationSkip: _consumeLocalCardUseAnimationSkip,
                armSkipNextCardUseButtonSound: _armSkipNextCardUseButtonSound,
                armLocalCardUseAnimationSkip: _armLocalCardUseAnimationSkip,
                executeEvent: (event: any) => this.executeEvent(event),
                fallbackPlayHandAnimation: (typeof playHandAnimation === 'function') ? playHandAnimation : null
            });
        }

        _handleStatusPlaybackEvent(ev: any) {
            if (!(AnimationStatusEvents && typeof AnimationStatusEvents.handleStatusChangeEvent === 'function')) {
                throw new Error('AnimationEngine status events module unavailable');
            }
            return AnimationStatusEvents.handleStatusChangeEvent(ev, {
                eventTypes: EVENT_TYPES,
                visuals: Visuals,
                overlayCrossfadeMs: OVERLAY_CROSSFADE_MS,
                regenConsumeFadeMs: REGEN_CONSUME_FADE_MS,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                resolveStatusChangeHighlightTone: (event: any, target: any) => this._resolveStatusChangeHighlightTone(event, target),
                runWithTransientCellHighlight: (cell: any, highlightTone: any, runner: any, minimumVisibleMs: any, extraClasses: any[]) => this._runWithTransientCellHighlight(cell, highlightTone, runner, minimumVisibleMs, extraClasses),
                resolveStatusChangeHighlightMinimumMs: (highlightTone: any) => this._resolveStatusChangeHighlightMinimumMs(highlightTone),
                waitForDisc: (row: any, col: any, retries: any) => this.waitForDisc(row, col, retries),
                syncDiscTimerOnly: (disc: any, after: any) => this.syncDiscTimerOnly(disc, after),
                fadeOutFreezeOverlay: (cell: any, durationMs: any) => this.fadeOutFreezeOverlay(cell, durationMs),
                crossfadeDiscToState: (disc: any, after: any, durationMs: any) => this.crossfadeDiscToState(disc, after, durationMs),
                isBoardShrinkHoleStatusChange: (event: any, target: any) => this._isBoardShrinkHoleStatusChange(event, target),
                playBoardShrinkHolePushIn: (cell: any) => this._playBoardShrinkHolePushIn(cell),
                removeDiscFromCell: (cell: any, disc: any) => this._removeDiscFromCell(cell, disc),
                resolveVisualColorFromState: (visualAfter: any, disc: any, visualOwner: any) => this._resolveVisualColorFromState(visualAfter, disc, visualOwner),
                syncDiscVisual: (disc: any, visualAfter: any) => this.syncDiscVisual(disc, visualAfter)
            });
        }

        _handleFlipPlaybackEvent(ev: any) {
            if (!(AnimationFlipEvents && typeof AnimationFlipEvents.handleFlipEvent === 'function')) {
                throw new Error('AnimationEngine flip events module unavailable');
            }
            return AnimationFlipEvents.handleFlipEvent(ev, {
                eventTypes: EVENT_TYPES,
                flipMs: FLIP_MS,
                fadeOutMs: FADE_OUT_MS,
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                resolveOwnerColorFromBefore: (ownerBefore: any) => this._resolveOwnerColorFromBefore(ownerBefore),
                resolveOwnerClassFromColor: (ownerColor: any) => this._resolveOwnerClassFromColor(ownerColor),
                syncDiscVisual: (disc: any, after: any) => this.syncDiscVisual(disc, after),
                runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => this._runWithEffectTargetHighlight(cell, eventType, target, runner, minimumVisibleMs),
                sleep: (ms: any) => this._sleep(ms),
                animationShared: AnimationShared
            });
        }

        _handlePlacePlaybackEvent(ev: any) {
            if (!(AnimationPlacementEvents && typeof AnimationPlacementEvents.handlePlaceEvent === 'function')) {
                throw new Error('AnimationEngine placement events module unavailable');
            }
            return AnimationPlacementEvents.handlePlaceEvent(ev, {
                eventTypes: EVENT_TYPES,
                breedingSpawnFadeMs: BREEDING_SPAWN_FADE_MS,
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                createDisc: (state: any) => this.createDisc(state),
                runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => this._runWithEffectTargetHighlight(cell, eventType, target, runner, minimumVisibleMs),
                resolveSpawnTargetHighlightMinimumMs: (target: any) => this._resolveSpawnTargetHighlightMinimumMs(target),
                waitForOpacityTransition: (disc: any, durationMs: any, bufferMs: any, starter: any, cleanup: any) => this._waitForOpacityTransition(disc, durationMs, bufferMs, starter, cleanup)
            });
        }

        _handleSpawnPlaybackEvent(ev: any) {
            if (!(AnimationPlacementEvents && typeof AnimationPlacementEvents.handleSpawnEvent === 'function')) {
                throw new Error('AnimationEngine placement events module unavailable');
            }
            return AnimationPlacementEvents.handleSpawnEvent(ev, {
                eventTypes: EVENT_TYPES,
                breedingSpawnFadeMs: BREEDING_SPAWN_FADE_MS,
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                createDisc: (state: any) => this.createDisc(state),
                runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => this._runWithEffectTargetHighlight(cell, eventType, target, runner, minimumVisibleMs),
                resolveSpawnTargetHighlightMinimumMs: (target: any) => this._resolveSpawnTargetHighlightMinimumMs(target),
                waitForOpacityTransition: (disc: any, durationMs: any, bufferMs: any, starter: any, cleanup: any) => this._waitForOpacityTransition(disc, durationMs, bufferMs, starter, cleanup)
            });
        }

        _handleDestroyPlaybackEvent(ev: any) {
            if (!(AnimationDestroyEvents && typeof AnimationDestroyEvents.handleDestroyEvent === 'function')) {
                throw new Error('AnimationEngine destroy events module unavailable');
            }
            return AnimationDestroyEvents.handleDestroyEvent(ev, {
                eventTypes: EVENT_TYPES,
                fadeOutMs: FADE_OUT_MS,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                sleep: (ms: any) => this._sleep(ms),
                getTargetCause: (target: any) => this._getTargetCause(target),
                getTargetReason: (target: any) => this._getTargetReason(target),
                isSuperCrushCause: (cause: any) => this._isSuperCrushCause(cause),
                getSuperCrushDestinationContext: (row: any, col: any) => this._getSuperCrushDestinationContext(row, col),
                resolveSuperCrushTargetDelayMs: (target: any) => this._resolveSuperCrushCollisionDelayMs(target),
                resolveOwnerColorFromBefore: (ownerBefore: any) => this._resolveOwnerColorFromBefore(ownerBefore),
                shouldPreserveDiscOnDestroy: (target: any) => this._shouldPreserveDiscOnDestroy(target),
                resolveDestroyTargetHighlightMinimumMs: (target: any) => this._resolveDestroyTargetHighlightMinimumMs(target),
                resolveEffectTargetHighlightTone: (eventType: any, target: any) => this._resolveEffectTargetHighlightTone(eventType, target),
                runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => this._runWithEffectTargetHighlight(cell, eventType, target, runner, minimumVisibleMs),
                resolveDestroySourceAnimationProfile: (target: any) => this._resolveDestroySourceAnimationProfile(target),
                playDestroySourceAnimation: (target: any, profile: any) => this._playDestroySourceAnimation(target, profile),
                animateDestroyGhostAtCell: (cell: any, ownerColor: any) => this._animateDestroyGhostAtCell(cell, ownerColor),
                createDisc: (state: any) => this.createDisc(state),
                removeDiscFromCell: (cell: any, disc: any) => this._removeDiscFromCell(cell, disc),
                resolveOwnerClassFromColor: (ownerColor: any) => this._resolveOwnerClassFromColor(ownerColor)
            });
        }

        // --- Visual Primitive Handlers ---

        async handleRoundBonusBanner(ev: any) {
            if (!(AnimationFeedbackEvents && typeof AnimationFeedbackEvents.handleRoundBonusBannerEvent === 'function')) {
                throw new Error('AnimationEngine feedback events module unavailable');
            }
            return AnimationFeedbackEvents.handleRoundBonusBannerEvent(ev);
        }

        async handleSpecialCardCinematic(ev: any) {
            if (!(AnimationFeedbackEvents && typeof AnimationFeedbackEvents.handleSpecialCardCinematicEvent === 'function')) {
                throw new Error('AnimationEngine feedback events module unavailable');
            }
            return AnimationFeedbackEvents.handleSpecialCardCinematicEvent(ev, {
                isNoAnim: _isNoAnim,
                sleep: (ms: any) => this._sleep(ms)
            });
        }

        async handleTheoryIncarnationSpawnRoulette(ev: any) {
            if (!(AnimationTheoryEvents && typeof AnimationTheoryEvents.handleTheoryIncarnationSpawnRouletteEvent === 'function')) {
                throw new Error('AnimationEngine theory events module unavailable');
            }
            return AnimationTheoryEvents.handleTheoryIncarnationSpawnRouletteEvent(ev, {
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                createDisc: (state: any) => this.createDisc(state),
                waitForOpacityTransition: (disc: any, durationMs: any, bufferMs: any, starter: any, cleanup: any) => this._waitForOpacityTransition(disc, durationMs, bufferMs, starter, cleanup),
                timer: _Timer,
                playbackScope: this.playbackScope,
                defaultDurationMs: THEORY_SPAWN_ROULETTE_MS,
                defaultMaterializeMs: THEORY_SPAWN_MATERIALIZE_MS
            });
        }

        _resolveManifestEndingDurationMs(ev: any) {
            const raw = Number(ev && (ev.durationMs ?? ev.transitionMs));
            return Number.isFinite(raw) && raw >= 0 ? raw : MANIFEST_ENDING_TRANSITION_MS;
        }

        _resolveManifestEndingOpacity(ev: any) {
            const raw = Number(ev && ev.dimOpacity);
            if (!Number.isFinite(raw)) return MANIFEST_ENDING_DIM_OPACITY;
            return Math.max(0, Math.min(1, raw));
        }

        _clearManifestEndingOverlay() {
            if (typeof document === 'undefined' || !document) return;
            try {
                const overlays = Array.from(document.querySelectorAll('.manifest-ending-overlay'));
                overlays.forEach((overlay: any) => {
                    try {
                        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    } catch (e: any) { /* ignore */ }
                });
            } catch (e: any) { /* ignore */ }
        }

        _clearManifestWorldBackground() {
            if (typeof document === 'undefined' || !document || !document.body) return;
            try {
                document.body.classList.remove('manifest-world-background-active', 'manifest-world-background-ending');
                document.body.removeAttribute('data-manifest-world-background-key');
                document.body.removeAttribute('data-manifest-world-background-source');
                document.body.style.removeProperty('--manifest-world-background');
            } catch (e: any) { /* ignore */ }
        }

        _createManifestEndingOverlay(durationMs: any, dimOpacity: any) {
            if (typeof document === 'undefined' || !document || !document.body) return null;
            this._clearManifestEndingOverlay();
            const overlay = document.createElement('div');
            overlay.className = 'manifest-ending-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.setProperty('--manifest-ending-duration', `${durationMs}ms`);
            overlay.style.setProperty('--manifest-ending-opacity', String(dimOpacity));
            document.body.appendChild(overlay);
            return overlay;
        }

        _getManifestEndingSoundEngine() {
            try {
                if (typeof SoundEngine !== 'undefined' && SoundEngine) return SoundEngine;
            } catch (e: any) { /* ignore */ }
            try {
                if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
            } catch (e: any) { /* ignore */ }
            return null;
        }

        _syncManifestEndingTarget(target: any) {
            if (!target) return;
            const row = Number.isInteger(target.r) ? target.r : target.row;
            const col = Number.isInteger(target.col) ? target.col : target.c;
            const cell = this.getCellEl(row, col);
            if (!cell) return;
            const disc = cell.querySelector('.disc');
            if (!disc) return;
            const after = (target.after && typeof target.after === 'object') ? Object.assign({}, target.after) : {};
            delete after.manifestAura;
            if (after.color !== 1 && after.color !== -1) {
                after.color = disc.classList.contains('white') ? -1 : 1;
            }
            after.special = null;
            after.timer = null;
            this.syncDiscVisual(disc, after);
        }

        async handleManifestEnding(ev: any) {
            const durationMs = this._resolveManifestEndingDurationMs(ev);
            const transitionMs = _isNoAnim() ? 0 : durationMs;
            const dimOpacity = this._resolveManifestEndingOpacity(ev);
            const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
            for (const target of targets) {
                this._syncManifestEndingTarget(target);
            }
            this._clearManifestWorldBackground();

            const soundEngine = this._getManifestEndingSoundEngine();
            if (soundEngine && typeof soundEngine.syncManifestBgmOverride === 'function') {
                try {
                    soundEngine.syncManifestBgmOverride(null, null, { transitionMs });
                } catch (e: any) { /* ignore */ }
            }

            if (_isNoAnim()) return;

            const overlay = this._createManifestEndingOverlay(durationMs, dimOpacity);
            try {
                await this._sleep(durationMs);
            } finally {
                try {
                    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                } catch (e: any) { /* ignore */ }
            }
        }

        async handleSoundEffect(ev: any) {
            if (!(AnimationFeedbackEvents && typeof AnimationFeedbackEvents.handleSoundEffectEvent === 'function')) {
                throw new Error('AnimationEngine feedback events module unavailable');
            }
            return AnimationFeedbackEvents.handleSoundEffectEvent(ev, {
                consumeSkipNextCardUseButtonSound: _consumeSkipNextCardUseButtonSound,
                consumeLocalPlaybackSoundSkip: _consumeLocalPlaybackSoundSkip,
                soundEngine: (typeof SoundEngine !== 'undefined') ? SoundEngine : null
            });
        }

        async handleObserverBubble(ev: any) {
            if (!(AnimationFeedbackEvents && typeof AnimationFeedbackEvents.handleObserverBubbleEvent === 'function')) {
                throw new Error('AnimationEngine feedback events module unavailable');
            }
            return AnimationFeedbackEvents.handleObserverBubbleEvent(ev, {
                isNoAnim: _isNoAnim,
                observerBubbleMs: OBSERVER_BUBBLE_MS,
                observerBubbleFadeMs: OBSERVER_BUBBLE_FADE_MS,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col)
            });
        }

        async handlePlace(ev: any) {
            return this._handlePlacePlaybackEvent(ev);
        }

        async handleFlip(ev: any) {
            return this._handleFlipPlaybackEvent(ev);
        }

        // Batch handler so that multiple flips in the same phase animate simultaneously
        async executeFlipBatch(flipEvents: any) {
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

        async handleDestroy(ev: any) {
            return this._handleDestroyPlaybackEvent(ev);
        }

        async animateWillHunterKingSlash(target: any) {
            return AnimationDestroySourceEvents.animateWillHunterKingSlash(target, this._getDestroySourceAnimationDeps());
        }

        async handleSpawn(ev: any) {
            return this._handleSpawnPlaybackEvent(ev);
        }

        isBreedingSpawnTarget(t: any) {
            if (!(AnimationPlacementEvents && typeof AnimationPlacementEvents.isBreedingSpawnTarget === 'function')) {
                throw new Error('AnimationEngine placement events module unavailable');
            }
            return AnimationPlacementEvents.isBreedingSpawnTarget(t);
        }

        getSpawnFadeInMs(t: any) {
            if (!(AnimationPlacementEvents && typeof AnimationPlacementEvents.getSpawnFadeInMs === 'function')) {
                throw new Error('AnimationEngine placement events module unavailable');
            }
            return AnimationPlacementEvents.getSpawnFadeInMs(t, {
                breedingSpawnFadeMs: BREEDING_SPAWN_FADE_MS
            });
        }

        _handleMovePlaybackEvent(ev: any) {
            if (!(AnimationMoveEvents && typeof AnimationMoveEvents.handleMoveEvent === 'function')) {
                throw new Error('AnimationEngine move events module unavailable');
            }
            return AnimationMoveEvents.handleMoveEvent(ev, {
                eventTypes: EVENT_TYPES,
                moveMs: MOVE_MS,
                effectTargetHighlightClass: EFFECT_TARGET_HIGHLIGHT_CLASS,
                effectTargetPositiveHighlightClass: EFFECT_TARGET_POSITIVE_HIGHLIGHT_CLASS,
                highlightToneNegative: HIGHLIGHT_TONE_NEGATIVE,
                highlightTonePositive: HIGHLIGHT_TONE_POSITIVE,
                isNoAnim: _isNoAnim,
                getCellEl: (row: any, col: any) => this.getCellEl(row, col),
                createDisc: (state: any) => this.createDisc(state),
                getTargetCause: (target: any) => this._getTargetCause(target),
                getTargetReason: (target: any) => this._getTargetReason(target),
                resolveEffectTargetHighlightTone: (eventType: any, target: any) => this._resolveEffectTargetHighlightTone(eventType, target),
                resolveMoveDurationScale: (target: any) => this._resolveMoveDurationScale(target),
                waitForAnimationFinish: (animation: any, durationMs: any, timeoutBufferMs: any) => this._waitForAnimationFinish(animation, durationMs, timeoutBufferMs),
                syncDiscVisual: (disc: any, after: any) => this.syncDiscVisual(disc, after),
                removeDiscFromCell: (cell: any, disc: any) => this._removeDiscFromCell(cell, disc)
            });
        }

        async handleMove(ev: any) {
            return this._handleMovePlaybackEvent(ev);
        }

        async handleStatusChange(ev: any) {
            return this._handleStatusPlaybackEvent(ev);
        }

        async fadeOutFreezeOverlay(cell: any, durationMs: any) {
            if (!cell) return;
            const freezeMark = cell.querySelector('.freeze-mark');
            cell.classList.remove('frozen-cell');
            if (!freezeMark) return;
            if (_isNoAnim() || !Number.isFinite(durationMs) || durationMs <= 0) {
                try { if (freezeMark.parentElement) freezeMark.parentElement.removeChild(freezeMark); } catch (e: any) { /* ignore */ }
                return;
            }

            const ghost = freezeMark.cloneNode(true);
            ghost.style.position = 'absolute';
            ghost.style.inset = '0';
            ghost.style.pointerEvents = 'none';
            ghost.style.zIndex = '85';
            ghost.style.opacity = '1';

            try { if (freezeMark.parentElement) freezeMark.parentElement.removeChild(freezeMark); } catch (e: any) { /* ignore */ }
            cell.appendChild(ghost);
            ghost.style.transition = `opacity ${durationMs}ms ease`;

            await this._waitForOpacityTransition(
                ghost,
                durationMs,
                120,
                () => {
                    try {
                        requestAnimationFrame(() => {
                            ghost.style.opacity = '0';
                        });
                    } catch (e: any) {
                        ghost.style.opacity = '0';
                    }
                },
                () => {
                    try { if (ghost.parentElement) ghost.parentElement.removeChild(ghost); } catch (e: any) { /* ignore */ }
                }
            );
        }

        async crossfadeDiscToState(disc: any, after: any, durationMs: any) {
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

            await this._waitForOpacityTransition(
                ghost,
                durationMs,
                120,
                () => {
                    try {
                        requestAnimationFrame(() => {
                            disc.style.opacity = '1';
                            ghost.style.opacity = '0';
                        });
                    } catch (e: any) {
                        disc.style.opacity = '1';
                        ghost.style.opacity = '0';
                    }
                },
                () => {
                    try { if (ghost.parentElement) ghost.parentElement.removeChild(ghost); } catch (e: any) { /* ignore */ }
                    disc.style.opacity = '';
                    disc.style.transition = prevDiscTransition;
                }
            );
        }

        // --- Helpers ---

        getCellEl(r: any, c: any) {
            if (!this.boardEl || typeof this.boardEl.querySelector !== 'function') return null;
            return this.boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        }

        async waitForDisc(r: any, c: any, attempts: any) {
            let remaining = Number.isFinite(attempts) ? attempts : 1;
            while (remaining > 0) {
                const cell = this.getCellEl(r, c);
                const disc = cell ? cell.querySelector('.disc') : null;
                if (disc) return disc;
                remaining -= 1;
                await new Promise<void>(resolve=> {
                    try {
                        requestAnimationFrame(() => setTimeout(resolve, 0));
                    } catch (e: any) {
                        setTimeout(resolve, 0);
                    }
                });
            }
            return null;
        }

        createDisc(state: any) {
            const disc = document.createElement('div');
            disc.className = 'disc';
            this.syncDiscVisual(disc, state);
            return disc;
        }

        syncDiscVisual(disc: any, state: any) {
            if (!state) return;
            disc.classList.remove('black', 'white');
            if (state.color === 1) disc.classList.add('black');
            else if (state.color === -1) disc.classList.add('white');
            disc.classList.toggle('living-will-aura', !!state.livingWillAura);
            disc.classList.remove('manifest-stone-aura', 'manifest-stone-aura-black', 'manifest-stone-aura-white');
            if (state.manifestAura) {
                const manifestOwner = state.manifestAura && state.manifestAura.owner !== undefined
                    ? state.manifestAura.owner
                    : state.owner;
                const manifestOwnerClass = (manifestOwner === 'white' || manifestOwner === -1 || manifestOwner === '-1') ? 'white' : 'black';
                disc.classList.add('manifest-stone-aura', `manifest-stone-aura-${manifestOwnerClass}`);
            }

            const setDiscStoneImage = (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function')
                ? window.setDiscStoneImage
                : null;
            const clearStoneVisualEffectState = (typeof window !== 'undefined' && typeof window.clearStoneVisualEffectState === 'function')
                ? window.clearStoneVisualEffectState
                : null;
            const applyStoneVisualEffect = (typeof window !== 'undefined' && typeof window.applyStoneVisualEffect === 'function')
                ? window.applyStoneVisualEffect
                : null;
            const getEffectKeyForSpecialType = (typeof window !== 'undefined' && typeof window.getEffectKeyForSpecialType === 'function')
                ? window.getEffectKeyForSpecialType
                : null;

            const visualSpecialType = state.special;

            if (visualSpecialType) {
                const effectKey = getEffectKeyForSpecialType ? getEffectKeyForSpecialType(visualSpecialType) : null;
                if (clearStoneVisualEffectState) {
                    clearStoneVisualEffectState(disc, { skipRenderReset: true });
                } else {
                    disc.classList.remove('special-stone');
                    disc.style.removeProperty('--special-stone-image');
                    disc.style.removeProperty('--disc-overlay-image');
                    disc.style.removeProperty('--disc-overlay-scale');
                }
                if (applyStoneVisualEffect && effectKey) {
                    const ownerVal = (state.owner !== undefined && state.owner !== null) ? state.owner : state.color;
                    applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
                } else if (setDiscStoneImage) {
                    setDiscStoneImage(disc, state.color);
                }
            } else {
                if (clearStoneVisualEffectState) {
                    clearStoneVisualEffectState(disc);
                } else {
                    disc.classList.remove('special-stone');
                    disc.style.removeProperty('--special-stone-image');
                    disc.style.removeProperty('--disc-overlay-image');
                    disc.style.removeProperty('--disc-overlay-scale');
                    if (setDiscStoneImage) {
                        setDiscStoneImage(disc, state.color);
                    }
                }
            }

            this.syncDiscTimerOnly(disc, state);
        }

        syncDiscTimerOnly(disc: any, state: any) {
            if (!disc || !state) return;

            const allTimerSelector = '.stone-timer, .bomb-timer, .special-timer, .countdown-timer, .dragon-timer, .udg-timer, .breeding-timer, .work-timer, .guard-timer, .flip-evade-timer, .destroy-evade-timer';
            const existingTimers = Array.from(disc.querySelectorAll(allTimerSelector));
            existingTimers.forEach((el: any) => el.remove());

            const specialType = String(state.special || '').toUpperCase();
            let primaryTimerValue = Number(state.timer);
            const parseCounterOrNaN = (raw: any) => {
                if (raw === null || raw === undefined || raw === '') return NaN;
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return NaN;
                return Math.max(0, Math.trunc(parsed));
            };
            let flipEvadeRemaining = parseCounterOrNaN(state.flipEvadeRemaining);
            const destroyEvadeRemaining = parseCounterOrNaN(state.destroyEvadeRemaining);

            const appendTimer = (className: any, value: any, options: any) => {
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
                if (specialType === 'TIME_BOMB') primaryClass = 'bomb-timer countdown-timer';
                else if (specialType === 'GUARD') primaryClass = 'guard-timer';
                else if (specialType === 'DRAGON' || specialType === 'DESTROY_DRAGON') primaryClass = 'stone-timer dragon-timer';
                else if (specialType === 'ULTIMATE_DESTROY_GOD') primaryClass = 'stone-timer udg-timer';
                else if (specialType === 'BREEDING') primaryClass = 'stone-timer breeding-timer';
                else if (specialType === 'WORK') primaryClass = 'stone-timer work-timer';
                else if (specialType === 'TIME_STOP' || specialType === 'PERMA_PROTECTED') primaryClass = 'countdown-timer';
                appendTimer(primaryClass, primaryTimerValue, undefined);
            }

            const isPrimaryFlipEvadeSpecialType = (
                specialType === 'HYPERACTIVE' ||
                specialType === 'AFTERIMAGE_WILL' ||
                specialType === 'EXTREME_HYPERACTIVE' ||
                specialType === 'ESCAPE_HYPERACTIVE' ||
                specialType === 'ULTIMATE_HYPERACTIVE' ||
                specialType === 'WILL_HUNTER_KING'
            );

            const hasPrimaryEvadeCounter = isPrimaryFlipEvadeSpecialType && Number.isFinite(flipEvadeRemaining) && flipEvadeRemaining >= 0;
            if (hasPrimaryEvadeCounter) {
                appendTimer('stone-timer flip-evade-timer', flipEvadeRemaining, { allowZero: true });
            }

            const hasDestroyEvadeCounter =
                (
                    specialType === 'ULTIMATE_HYPERACTIVE' ||
                    specialType === 'EXTREME_HYPERACTIVE' ||
                    specialType === 'WILL_HUNTER_KING' ||
                    specialType === 'AFTERIMAGE_WILL'
                ) &&
                Number.isFinite(destroyEvadeRemaining) &&
                destroyEvadeRemaining >= 0;
            if (hasDestroyEvadeCounter) {
                appendTimer('stone-timer destroy-evade-timer', destroyEvadeRemaining, { allowZero: true });
            }
        }

        applyFinalStates(ev: any) {
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

        setGlobalInteractionLock(locked: any) {
            if (PlaybackState && typeof PlaybackState.beginPlayback === 'function' && locked === true) {
                PlaybackState.beginPlayback({ boardElement: this.boardEl });
            } else if (PlaybackState && typeof PlaybackState.finalizePlayback === 'function' && locked !== true) {
                PlaybackState.finalizePlayback({
                    boardElement: this.boardEl,
                    clearBoardUpdateContext: false
                });
            } else if (PlaybackState && typeof PlaybackState.setInteractionLock === 'function') {
                PlaybackState.setInteractionLock(locked);
                if (typeof PlaybackState.setBoardLockActive === 'function') {
                    PlaybackState.setBoardLockActive(locked, { boardElement: this.boardEl });
                }
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

        log(msg: any) {
            if (window.addLog) window.addLog(msg);
            else console.log('[LOG]', msg);
        }
    }

    const AnimationEngine = new PlaybackEngine();
export = AnimationEngine;
