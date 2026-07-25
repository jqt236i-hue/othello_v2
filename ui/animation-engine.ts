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
const PlaybackStateManager = _require('./playback-state-manager');
const PlaybackSettlement = _require('./playback-settlement');
const BoardPlaybackInterruption = _require('./board-visual/playback-interruption');

const {
        EVENT_TYPES,
        PHASE_GAP_MS
    } = Constants;
    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const LOCAL_PLAYBACK_SOUND_SKIP_UNTIL_BY_KEY = '__skipNextPlaybackSoundUntilByKey';
    const LOCAL_CARD_USE_ANIMATION_SKIP_UNTIL_BY_KEY = '__skipNextCardUseAnimationUntilByKey';
    const LOCAL_CARD_USE_BUTTON_SOUND_SKIP_COUNT_KEY = '__skipNextCardUseButtonSoundCount';
    const LOCAL_CARD_USE_PLAYBACK_SKIP_MS = 30000;
    const MANIFEST_ENDING_TRANSITION_MS = 2000;
    const MANIFEST_ENDING_DIM_OPACITY = 0.6;

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
var AnimationHandEvents = requireRuntimeModuleOrWindowGlobal('./animation-hand-events', 'AnimationHandEvents');
var PresentationPhasePlanner = requireRuntimeModuleOrWindowGlobal('./presentation/phase-planner', 'PresentationPhasePlanner');
var PresentationDispatcher = requireRuntimeModuleOrWindowGlobal('./presentation/dispatcher', 'PresentationDispatcher');
var PresentationVisualSeed = requireRuntimeModuleOrWindowGlobal('./presentation/visual-seed', 'PresentationVisualSeed');
var BoardPlaybackTypes = requireRuntimeModuleOrWindowGlobal('./board-visual/playback-types', 'BoardPlaybackTypes');
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
        _playbackAbortController: AbortController | null;
        _playbackRunSequence: any;
        _activePlaybackRunId: any;
        _strictNetworkPlayback: any;
        _strictNetworkPlaybackError: any;
        _strictNetworkPlaybackReject: any;
        _activeBoardWriterToken: any;
        _ownsActiveBoardWriterToken: boolean;
        _unresolvedLocalBoardWriterError: any;
        _pendingLocalBoardWriterClaims: number;
        _unresolvedLocalPlaybackManagerClaim: any;
        constructor() {
            this.isPlaying = false;
            this.boardEl = document.getElementById('board');
            this.isAborted = false;
            this._watchdogFired = false;
            this.playbackScope = null;
            this._remainingEvents = [];
            this._watchdogId = null;
            this._playbackAbortController = null;
            this._playbackRunSequence = 0;
            this._activePlaybackRunId = null;
            this._strictNetworkPlayback = false;
            this._strictNetworkPlaybackError = null;
            this._strictNetworkPlaybackReject = null;
            this._activeBoardWriterToken = null;
            this._ownsActiveBoardWriterToken = false;
            this._unresolvedLocalBoardWriterError = null;
            this._pendingLocalBoardWriterClaims = 0;
            this._unresolvedLocalPlaybackManagerClaim = null;
        }

        _createPlaybackError(code: string, event: any, cause?: any) {
            if (BoardPlaybackTypes && typeof BoardPlaybackTypes.PresentationPlaybackError === 'function') {
                return new BoardPlaybackTypes.PresentationPlaybackError(code, event, {
                    strictNetworkPlayback: this._strictNetworkPlayback === true,
                    cause
                });
            }
            const error: any = new Error(`${code}:${String(event && event.type || 'unknown')}`);
            error.name = 'PresentationPlaybackError';
            error.code = code;
            error.strictNetworkPlayback = this._strictNetworkPlayback === true;
            if (cause) error.cause = cause;
            return error;
        }

        _createDeferredPlaybackSettlement(runId: number, mode: any, finalize: () => boolean | void, event: any) {
            try {
                if (!PlaybackSettlement || typeof PlaybackSettlement.createPlaybackSettlementResult !== 'function') {
                    throw new Error('Playback settlement contract is unavailable');
                }
                return PlaybackSettlement.createPlaybackSettlementResult({ runId, mode, finalize });
            } catch (cause: any) {
                if (cause && cause.name === 'PresentationPlaybackError') throw cause;
                throw this._createPlaybackError('playback_settlement_contract_unavailable', event, cause);
            }
        }

        _throwIfLocalBoardWriterRecoveryIsUnresolved(event: any) {
            if (
                this._unresolvedLocalBoardWriterError
                && this._ownsActiveBoardWriterToken
                && this._activeBoardWriterToken
                && this._activeBoardWriterToken.mode === 'local'
            ) {
                throw this._createPlaybackError(
                    'board_writer_recovery_unresolved',
                    event,
                    this._unresolvedLocalBoardWriterError
                );
            }
        }

        _hasOwnedLocalBoardWriter() {
            return !!(
                this._ownsActiveBoardWriterToken
                && this._activeBoardWriterToken
                && this._activeBoardWriterToken.mode === 'local'
            );
        }

        _hasPendingLocalBoardWriterClaim() {
            return this._pendingLocalBoardWriterClaims > 0;
        }

        _holdUnresolvedLocalWriterPlaybackState(error: any, event: any) {
            if (!PlaybackState) {
                this.setGlobalInteractionLock(true);
                return true;
            }
            if (typeof PlaybackState.setInteractionLock === 'function') {
                PlaybackState.setInteractionLock(true);
            } else if (typeof PlaybackState.setBusyState === 'function') {
                PlaybackState.setBusyState({ processing: true, cardAnimating: true, playbackActive: true });
            } else if (typeof PlaybackState.beginPlayback === 'function') {
                PlaybackState.beginPlayback({ boardElement: this.boardEl });
            } else {
                this.setGlobalInteractionLock(true);
            }
            if (
                !this._unresolvedLocalPlaybackManagerClaim
                && typeof PlaybackState.claimVisualPlayback === 'function'
            ) {
                this._unresolvedLocalPlaybackManagerClaim = PlaybackState.claimVisualPlayback({
                    source: 'animation-engine',
                    scope: 'generic',
                    reason: 'board_writer_recovery_unresolved',
                    eventType: String(event && event.type || 'unknown'),
                    restoreBusyBaseline: false
                });
            }
            if (
                this._unresolvedLocalPlaybackManagerClaim
                && typeof PlaybackState.recordVisualPlaybackSettlementError === 'function'
            ) {
                PlaybackState.recordVisualPlaybackSettlementError(
                    this._unresolvedLocalPlaybackManagerClaim,
                    error,
                    { stage: 'local-board-writer-recovery' }
                );
            }
            return true;
        }

        _clearOwnedLocalBoardWriter(token: any) {
            if (this._activeBoardWriterToken === token) {
                this._activeBoardWriterToken = null;
            }
            this._ownsActiveBoardWriterToken = false;
            this._unresolvedLocalBoardWriterError = null;
            if (
                this._unresolvedLocalPlaybackManagerClaim
                && PlaybackState
                && typeof PlaybackState.releaseVisualPlaybackClaim === 'function'
            ) {
                PlaybackState.releaseVisualPlaybackClaim(this._unresolvedLocalPlaybackManagerClaim);
            }
            this._unresolvedLocalPlaybackManagerClaim = null;
        }

        async _settleOwnedLocalBoardWriter(token: any, event: any) {
            const renderer = requireRuntimeModuleOrWindowGlobal('./board-renderer', 'BoardRenderer');
            let settlementError: any = null;
            try {
                if (!renderer || (
                    typeof renderer.settleBoardVisualWriter !== 'function'
                    && typeof renderer.releaseBoardVisualWriter !== 'function'
                )) {
                    throw new Error('Board writer release API unavailable');
                }
                if (typeof renderer.settleBoardVisualWriter === 'function') {
                    await renderer.settleBoardVisualWriter(token);
                } else {
                    renderer.releaseBoardVisualWriter(token);
                }
                this._clearOwnedLocalBoardWriter(token);
                return { released: true, recovered: false, error: null };
            } catch (error: any) {
                settlementError = error && error.name === 'PresentationPlaybackError'
                    ? error
                    : this._createPlaybackError('board_writer_settlement_failed', event, error);
            }

            try {
                if (!renderer || typeof renderer.enterBoardVisualRecovery !== 'function') {
                    throw new Error('Board writer recovery API unavailable');
                }
                if (typeof renderer.settleBoardVisualWriter !== 'function') {
                    throw new Error('Board writer recovery settlement API unavailable');
                }
                renderer.enterBoardVisualRecovery(token, settlementError);
                await renderer.settleBoardVisualWriter(token);
                this._clearOwnedLocalBoardWriter(token);
                return { released: true, recovered: true, error: settlementError };
            } catch (recoveryError: any) {
                // Keep the token and ownership intact. The controller remains
                // claimed/recovering, so neither a later run nor a direct phase
                // can silently become a second visual writer.
                this._unresolvedLocalBoardWriterError = settlementError;
                return {
                    released: false,
                    recovered: false,
                    error: settlementError,
                    recoveryError
                };
            }
        }

        async _playBoardPhaseThroughBackend(events: any, phaseScope?: any) {
            let phaseEvents = Array.isArray(events) ? events : [];
            if (!phaseEvents.length) return;
            this._throwIfLocalBoardWriterRecoveryIsUnresolved(phaseEvents[0]);
            if (
                this._strictNetworkPlayback !== true
                && PresentationVisualSeed
                && typeof PresentationVisualSeed.withNextPresentationBatchId === 'function'
            ) {
                phaseEvents = Array.from(PresentationVisualSeed.withNextPresentationBatchId(phaseEvents));
            }
            let token = this._activeBoardWriterToken;
            let releaseAfterPhase = false;
            const renderer = requireRuntimeModuleOrWindowGlobal('./board-renderer', 'BoardRenderer');
            if (!renderer || typeof renderer.playBoardVisualPhase !== 'function') {
                throw this._createPlaybackError('board_renderer_unavailable', phaseEvents[0]);
            }
            if (!token && this._strictNetworkPlayback === true) {
                throw this._createPlaybackError('board_writer_token_unavailable', phaseEvents[0]);
            }
            if (!token) {
                const claimPlaybackRunId = this._activePlaybackRunId;
                this._pendingLocalBoardWriterClaims += 1;
                try {
                    if (typeof renderer.getBoardVisualControllerReady === 'function') {
                        await renderer.getBoardVisualControllerReady();
                    }
                    // Concurrent launches in one planner step can all observe a
                    // null token before the readiness await. Re-read it after
                    // readiness so only the first continuation claims writer.
                    token = this._activeBoardWriterToken;
                    if (!token) {
                        if (typeof renderer.claimBoardVisualWriter !== 'function') {
                            throw new Error('Board writer claim API unavailable');
                        }
                        const frameToken = claimPlaybackRunId !== null
                            ? `local:animation-engine:${claimPlaybackRunId}`
                            : `local:animation-engine-direct:${this._playbackRunSequence + 1}`;
                        token = renderer.claimBoardVisualWriter(frameToken, 'local');
                        this._activeBoardWriterToken = token;
                        this._ownsActiveBoardWriterToken = true;
                        releaseAfterPhase = claimPlaybackRunId === null;
                    }
                } catch (error: any) {
                    throw this._createPlaybackError('board_writer_claim_failed', phaseEvents[0], error);
                } finally {
                    this._pendingLocalBoardWriterClaims = Math.max(0, this._pendingLocalBoardWriterClaims - 1);
                }
            }
            if (token) {
                let playbackError: any = null;
                try {
                    await renderer.playBoardVisualPhase(token, phaseEvents, phaseScope);
                } catch (error: any) {
                    playbackError = error && error.name === 'PresentationPlaybackError'
                        ? error
                        : this._createPlaybackError('board_renderer_failed', phaseEvents[0], error);
                }
                if (releaseAfterPhase) {
                    const settlement = await this._settleOwnedLocalBoardWriter(token, phaseEvents[0]);
                    playbackError = playbackError || settlement.error;
                }
                if (playbackError) throw playbackError;
            }
        }

        _preflightBoardPhaseThroughBackend(events: any, phaseScope?: any) {
            const phaseEvents = Array.isArray(events) ? events : [];
            if (!phaseEvents.length) return;
            const renderer = requireRuntimeModuleOrWindowGlobal('./board-renderer', 'BoardRenderer');
            if (!renderer) {
                throw this._createPlaybackError('board_renderer_unavailable', phaseEvents[0]);
            }
            const fail = (error: any) => {
                if (error && error.name === 'PresentationPlaybackError') throw error;
                throw this._createPlaybackError('board_renderer_failed', phaseEvents[0], error);
            };
            try {
                // Older injected DOM test adapters are capability-complete and
                // intentionally have no preflight port. The real controller
                // requires the port for Pixi and rejects a missing Pixi seam.
                if (typeof renderer.validateBoardVisualPhase !== 'function') return;
                const ready = typeof renderer.getBoardVisualControllerReady === 'function'
                    ? renderer.getBoardVisualControllerReady()
                    : undefined;
                return Promise.resolve(ready).then(() => renderer.validateBoardVisualPhase(
                    phaseEvents,
                    phaseScope,
                    this._strictNetworkPlayback === true
                )).catch(fail);
            } catch (error: any) {
                return fail(error);
            }
        }

        _registerPlaybackAbortHandle(runId: any, runState: any) {
            if (!PlaybackState || typeof PlaybackState.registerPlaybackAbortHandle !== 'function') return null;
            const handle = {
                runId,
                abort: () => {
                    if (runState.externallyAborted === true) return false;
                    runState.externallyAborted = true;
                    runState.visualPlaybackClaimsPreservedOnAbort = runState.preserveVisualPlaybackClaimsOnAbort === true;
                    this.isAborted = true;
                    this.isPlaying = false;
                    this._activePlaybackRunId = null;
                    try { runState.abortController?.abort(); } catch (e: any) { /* ignore */ }
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
                    if (this._playbackAbortController === runState.abortController) {
                        this._playbackAbortController = null;
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
                : Number(Constants.NETWORK_PLAYBACK_WATCHDOG_MS) || 30000;
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

        _resolvePlaybackEventCap() {
            const configured = (typeof window !== 'undefined')
                ? Number(window.PLAYBACK_EVENT_CAP)
                : NaN;
            return Number.isFinite(configured) && configured >= 0
                ? Math.trunc(configured)
                : 50;
        }

        async _waitForActivePlaybackToSettle(timeoutMs: any) {
            const safeTimeoutMs = Number.isFinite(Number(timeoutMs))
                ? Math.max(0, Number(timeoutMs))
                : 0;
            const startedAt = Date.now();
            while (
                (this._isPlaybackStateActive() && (this.isPlaying === true || this._activePlaybackRunId !== null))
                || this._hasOwnedLocalBoardWriter()
                || this._hasPendingLocalBoardWriterClaim()
            ) {
                if (this._unresolvedLocalBoardWriterError && this._hasOwnedLocalBoardWriter()) {
                    return false;
                }
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

        _getTargetCause(target: any) {
            return String(target && target.cause ? target.cause : '').toUpperCase();
        }

        _getTargetReason(target: any) {
            return String(target && target.reason ? target.reason : '').toLowerCase();
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

        /**
         * Play a sequence of PlaybackEvents.
         * @param {Array} events - Ordered PlaybackEvents
         * @returns {Promise<void>}
         */
        async play(events: any, options?: any) {
            const playOptions = (options && typeof options === 'object') ? options : {};
            let normalizedEvents = Array.isArray(events)
                ? events.map((ev) => this._normalizeEvent(ev))
                : [];
            this._throwIfLocalBoardWriterRecoveryIsUnresolved(normalizedEvents[0]);
            // Empty payload has no playback ownership. The caller that owns any
            // outer claim is solely responsible for releasing it.
            if (!normalizedEvents.length) {
                return;
            }
            const strictNetworkPlaybackThisRun = playOptions.strictNetworkPlayback === true
                || normalizedEvents.some((event) => event && event.strictNetworkPlayback === true);
            if (
                !strictNetworkPlaybackThisRun
                && PresentationVisualSeed
                && typeof PresentationVisualSeed.withNextPresentationBatchId === 'function'
            ) {
                normalizedEvents = Array.from(PresentationVisualSeed.withNextPresentationBatchId(normalizedEvents));
            }
            const deferFinalSettlement = playOptions.deferFinalSettlement === true;
            let abortedDuringPlay = false;
            let playbackError: any = null;
            let deferredSettlementResult: any = null;
            let strictWatchdogPromise: Promise<never> | null = null;
            const runBoardWriterToken = playOptions.boardWriterToken || null;
            const awaitPlaybackStep = (promise: any) => {
                if (strictNetworkPlaybackThisRun && strictWatchdogPromise) {
                    return Promise.race([Promise.resolve(promise), strictWatchdogPromise]);
                }
                return promise;
            };

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
            if (
                (this._isPlaybackStateActive() && hasActivePlaybackRun)
                || this._hasOwnedLocalBoardWriter()
                || this._hasPendingLocalBoardWriterClaim()
            ) {
                const overlapWaitMs = this._resolvePlaybackOverlapWaitMs();
                const settled = await this._waitForActivePlaybackToSettle(overlapWaitMs);
                if (!settled) {
                    this._throwIfLocalBoardWriterRecoveryIsUnresolved(normalizedEvents[0]);
                    if (this._hasOwnedLocalBoardWriter() || this._hasPendingLocalBoardWriterClaim()) {
                        throw this._createPlaybackError(
                            'board_writer_active_run_unsettled',
                            normalizedEvents[0],
                            new Error('Previous local board writer did not settle before overlap timeout')
                        );
                    }
                }
                if (!settled && this._isPlaybackStateActive() && (this.isPlaying === true || this._activePlaybackRunId !== null)) {
                    console.warn('[AnimationEngine] Already playing. Aborting previous...');
                    this.isAborted = true;
                    try { this._playbackAbortController?.abort(); } catch (e: any) { /* ignore */ }
                    // Wait a short settle period
                    await new Promise(r => _Timer().setTimeout(r, 100));
                    this.isAborted = false;
                }
            }

            const playbackEventCap = this._resolvePlaybackEventCap();
            if (normalizedEvents.length > playbackEventCap) {
                console.warn('[AnimationEngine] playback event cap exceeded. Continuing ordered playback.', {
                    original: normalizedEvents.length,
                    cap: playbackEventCap,
                    strictNetworkPlayback: strictNetworkPlaybackThisRun === true
                });
                if (typeof window !== 'undefined') {
                    window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
                    window.__telemetry__.playbackEventCapExceeded = (window.__telemetry__.playbackEventCapExceeded || 0) + 1;
                }
            }

            // Clear stale abort/watchdog state from previous runs.
            this.isAborted = false;
            this._watchdogFired = false;
            this._strictNetworkPlayback = strictNetworkPlaybackThisRun;
            this._strictNetworkPlaybackError = null;
            this._strictNetworkPlaybackReject = null;
            if (strictNetworkPlaybackThisRun) {
                strictWatchdogPromise = new Promise((resolve, reject) => {
                    this._strictNetworkPlaybackReject = reject;
                });
            }

            const runId = this._playbackRunSequence + 1;
            this._playbackRunSequence = runId;
            this._activePlaybackRunId = runId;
            this._activeBoardWriterToken = runBoardWriterToken;
            this._ownsActiveBoardWriterToken = false;
            const runState = {
                scope: null,
                watchdogId: null,
                externallyAborted: false,
                watchdogAborted: false,
                visualPlaybackClaimsPreservedOnAbort: false,
                preserveVisualPlaybackClaimsOnAbort: strictNetworkPlaybackThisRun || deferFinalSettlement,
                abortController: (typeof AbortController === 'function') ? new AbortController() : null
            };
            let abortHandle: any = null;
            // Setup playback scope and flags
            this.isPlaying = true;
            this.playbackScope = (typeof TimerRegistry !== 'undefined' && TimerRegistry.newScope) ? TimerRegistry.newScope() : null;
            runState.scope = this.playbackScope;
            this._playbackAbortController = runState.abortController;
                // expose scope for animations to register timers under
                if (typeof window !== 'undefined') window._currentPlaybackScope = this.playbackScope;
            abortHandle = this._registerPlaybackAbortHandle(runId, runState);

            // VisualPlaybackActive is the single source of truth during playback
            try {
                if (PlaybackState && typeof PlaybackState.beginPlayback === 'function') {
                    PlaybackState.beginPlayback({ boardElement: this.boardEl, runId });
                    this.isPlaying = PlaybackState.getPlaybackActive() === true;
                } else {
                    this.setGlobalInteractionLock(true);
                }

                // Watchdog to prevent permanent freezes
                const WATCHDOG_TIMEOUT_MS = this._resolvePlaybackWatchdogMs();
                const armWatchdog = () => {
                    // __playbackActiveSince is also consumed by the debug runtime's
                    // stale-playback guard. Treat it as a progress heartbeat so a
                    // healthy multi-phase frame is not aborted merely because its
                    // total ordered presentation exceeds that guard's timeout.
                    if (
                        PlaybackState
                        && typeof PlaybackState.setPlaybackStartedAt === 'function'
                        && PlaybackState.getPlaybackActive?.() === true
                    ) {
                        PlaybackState.setPlaybackStartedAt(Date.now());
                    }
                    const previousWatchdogId = runState.watchdogId;
                    if (previousWatchdogId) {
                        try { _Timer().clearTimeout(previousWatchdogId); } catch (e: any) { /* ignore */ }
                    }
                    const handleWatchdogForRun = () => {
                        const preserveVisualPlaybackClaims = strictNetworkPlaybackThisRun || deferFinalSettlement;
                        runState.watchdogAborted = true;
                        runState.visualPlaybackClaimsPreservedOnAbort = preserveVisualPlaybackClaims;
                        return this.handleWatchdog({ preserveVisualPlaybackClaims });
                    };
                    if (this.playbackScope !== null) {
                        this._watchdogId = _Timer().setTimeout(handleWatchdogForRun, WATCHDOG_TIMEOUT_MS, this.playbackScope);
                    } else {
                        this._watchdogId = _Timer().setTimeout(handleWatchdogForRun, WATCHDOG_TIMEOUT_MS);
                    }
                    runState.watchdogId = this._watchdogId;
                };
                armWatchdog();

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
                    await awaitPlaybackStep(this.executePhase(phaseEvents));
                    // A completed phase proves that playback is still making
                    // forward progress. Long ordered journals may legitimately
                    // exceed the per-phase freeze budget, so restart the guard
                    // without changing any player-visible event duration.
                    armWatchdog();

                    // Gap between readable phases (Section 3)
                    if (phase !== sortedPhases[sortedPhases.length - 1]) {
                        // Avoid a noticeable delay between hand placement and the stone appearing / flipping.
                        // Free-placement specials often materialize as "place_hand_animation -> spawn only",
                        // so treat the first spawn the same as an immediate follow-up flip.
                        const nextPhaseKey = sortedPhases[sortedPhases.indexOf(phase) + 1];
                        const nextEvents = phases[nextPhaseKey] || [];
                        if (!this._shouldSkipPhaseGapBetween(phaseEvents, nextEvents)) {
                            await awaitPlaybackStep(this._sleep(PHASE_GAP_MS));
                        }
                    }
                }
            } catch (err: any) {
                abortedDuringPlay = true;
                playbackError = err;
                if (
                    err?.name !== 'NetworkPlaybackWatchdogError'
                    && err?.message !== 'network_playback_watchdog'
                    && BoardPlaybackInterruption.isPixiPlaybackControlledInterruption(err) !== true
                ) {
                    console.error('[AnimationEngine] Playback error:', err);
                }
            } finally {
                this._clearPlaybackAbortHandle(abortHandle);
                // cleanup watchdog & scope
                try { runState.abortController?.abort(); } catch (e: any) { /* ignore */ }
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
                if (this._playbackAbortController === runState.abortController) {
                    this._playbackAbortController = null;
                }
                const activeWriterBelongsToRun = this._ownsActiveBoardWriterToken
                    && this._activeBoardWriterToken
                    && this._activeBoardWriterToken.mode === 'local'
                    && this._activeBoardWriterToken.frameToken === `local:animation-engine:${runId}`;
                let localWriterSettlementResolved = true;
                if (activeWriterBelongsToRun) {
                    const ownedToken = this._activeBoardWriterToken;
                    const settlement = await this._settleOwnedLocalBoardWriter(
                        ownedToken,
                        normalizedEvents[normalizedEvents.length - 1]
                    );
                    localWriterSettlementResolved = settlement.released === true;
                    if (settlement.error) {
                        abortedDuringPlay = true;
                        playbackError = playbackError || settlement.error;
                    }
                }
                if (!localWriterSettlementResolved && activeWriterBelongsToRun) {
                    // External abort may already have cleared manager/input state.
                    // Keep engine and manager state aligned with the controller's
                    // retained local writer until recovery can be completed.
                    this._activePlaybackRunId = runId;
                    this.isPlaying = true;
                    this._holdUnresolvedLocalWriterPlaybackState(
                        playbackError || this._unresolvedLocalBoardWriterError,
                        normalizedEvents[normalizedEvents.length - 1]
                    );
                }
                if (isCurrentRun && localWriterSettlementResolved) {
                    this._activePlaybackRunId = null;
                    this.isPlaying = false;
                }
                const shouldArmBoardUpdateContext = isCurrentRun
                    && localWriterSettlementResolved
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
                const strictNetworkPlaybackFailed = strictNetworkPlaybackThisRun
                    && (!!playbackError || !!this._strictNetworkPlaybackError);
                // Avoid leaking abort state into the next playback run.
                if (isCurrentRun && localWriterSettlementResolved) {
                    this.isAborted = false;
                }
                // After playback completes, request a final board diff render to ensure DOM matches state.
                // This avoids stale visuals when diff rendering was suppressed during playback.
                if (
                    isCurrentRun
                    && localWriterSettlementResolved
                    && !runState.externallyAborted
                    && !runState.watchdogAborted
                ) {
                    if (strictNetworkPlaybackFailed) {
                        if (PlaybackState && typeof PlaybackState.abortPlayback === 'function') {
                            PlaybackState.abortPlayback({
                                boardElement: this.boardEl,
                                strictNetworkPlayback: true,
                                preserveVisualPlaybackClaims: true,
                                preserveSelectionSettlementLock: true
                            });
                        } else {
                            this.setGlobalInteractionLock(false);
                        }
                    } else if (deferFinalSettlement && !playbackError && !abortedDuringPlay) {
                        if (boardUpdateContext && PlaybackState && typeof PlaybackState.armBoardUpdateContext === 'function') {
                            PlaybackState.armBoardUpdateContext(boardUpdateContext);
                        }
                        deferredSettlementResult = this._createDeferredPlaybackSettlement(runId, 'finalize', () => {
                            if (PlaybackState && typeof PlaybackState.finalizePlayback === 'function') {
                                return PlaybackState.finalizePlayback({
                                    boardElement: this.boardEl,
                                    expectedRunId: runId,
                                    clearBoardUpdateContext: true
                                }) !== false;
                            } else {
                                if (this._playbackRunSequence !== runId) return false;
                                this.setGlobalInteractionLock(false);
                                return true;
                            }
                        }, normalizedEvents[normalizedEvents.length - 1]);
                    } else if (PlaybackState && typeof PlaybackState.finalizePlayback === 'function') {
                        PlaybackState.finalizePlayback({
                            boardElement: this.boardEl,
                            expectedRunId: runId,
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
                if (
                    !strictNetworkPlaybackThisRun
                    && deferFinalSettlement
                    && (runState.externallyAborted || runState.watchdogAborted)
                    && runState.visualPlaybackClaimsPreservedOnAbort
                    && localWriterSettlementResolved
                    && !playbackError
                ) {
                    // The watchdog already aborted the engine-owned playback state.
                    // Keep the outer presentation claim alive until its board writer
                    // settles, then acknowledge that no second manager finalization is
                    // required. This preserves the drain's settlement ownership without
                    // clearing a newer playback run through a late finalizePlayback().
                    deferredSettlementResult = this._createDeferredPlaybackSettlement(
                        runId,
                        'already-aborted-ack',
                        () => { /* manager state was already aborted */ },
                        normalizedEvents[normalizedEvents.length - 1]
                    );
                }
                if (isCurrentRun && localWriterSettlementResolved) {
                    this._strictNetworkPlaybackReject = null;
                    this._strictNetworkPlayback = false;
                    if (this._activeBoardWriterToken === runBoardWriterToken) {
                        this._activeBoardWriterToken = null;
                    }
                }
            }
            if (this._strictNetworkPlaybackError) {
                const error = this._strictNetworkPlaybackError;
                this._strictNetworkPlaybackError = null;
                throw error;
            }
            if (playbackError) {
                throw playbackError;
            }
            if (deferFinalSettlement) {
                if (!deferredSettlementResult) {
                    throw this._createPlaybackError(
                        'playback_settlement_result_unavailable',
                        normalizedEvents[normalizedEvents.length - 1]
                    );
                }
                return deferredSettlementResult;
            }
        }
        groupByPhase(events: any) {
            if (PresentationPhasePlanner && typeof PresentationPhasePlanner.groupPresentationEventsByPhase === 'function') {
                return PresentationPhasePlanner.groupPresentationEventsByPhase(events || []);
            }
            throw new Error('Presentation phase planner is unavailable');
        }

        async executePhase(phaseEvents: any) {
            if (!PresentationDispatcher || typeof PresentationDispatcher.dispatchPresentationPhase !== 'function') {
                throw new Error('Presentation dispatcher is unavailable');
            }
            let events = Array.isArray(phaseEvents) ? phaseEvents.slice() : [];
            this._throwIfLocalBoardWriterRecoveryIsUnresolved(events[0]);
            if (
                this._strictNetworkPlayback !== true
                && PresentationVisualSeed
                && typeof PresentationVisualSeed.withNextPresentationBatchId === 'function'
            ) {
                events = Array.from(PresentationVisualSeed.withNextPresentationBatchId(events));
            }
            const dispatcherDeps = {
                strictNetworkPlayback: this._strictNetworkPlayback === true,
                preflightBoardPhase: (stepEvents: any, phaseScope: any) => this._preflightBoardPhaseThroughBackend(stepEvents, phaseScope),
                playBoardPhase: (boardEvents: any, phaseScope: any) => this._playBoardPhaseThroughBackend(boardEvents, phaseScope),
                playGlobalEvent: (event: any) => this.executeEvent(event, { globalOnly: true }),
                playManifestEndingGlobal: (event: any) => this.handleManifestEndingGlobal(event),
                warnUnhandledLocalEvent: (event: any) => console.warn('[AnimationEngine] Unhandled event type:', event && event.type)
            };
            if (typeof PresentationDispatcher.preflightPresentationPhase !== 'function') {
                throw new Error('Presentation dispatcher capability preflight is unavailable');
            }
            // Complete the active-backend capability check before the direct
            // local path claims its writer. Dispatch repeats this per actual
            // planner step immediately before launch.
            const capabilityPreflight = PresentationDispatcher.preflightPresentationPhase(events, dispatcherDeps);
            if (capabilityPreflight && typeof capabilityPreflight.then === 'function') {
                await capabilityPreflight;
            }
            let directWriterToken: any = null;
            const needsBoardWriter = events.some((event: any) => !(
                BoardPlaybackTypes
                && typeof BoardPlaybackTypes.isKnownGlobalPresentationEvent === 'function'
                && BoardPlaybackTypes.isKnownGlobalPresentationEvent(event)
            ));
            if (
                needsBoardWriter
                && this._activePlaybackRunId === null
                && !this._activeBoardWriterToken
                && this._strictNetworkPlayback !== true
            ) {
                const renderer = requireRuntimeModuleOrWindowGlobal('./board-renderer', 'BoardRenderer');
                try {
                    if (!renderer || typeof renderer.claimBoardVisualWriter !== 'function') {
                        throw new Error('Board writer claim API unavailable');
                    }
                    if (typeof renderer.getBoardVisualControllerReady === 'function') {
                        await renderer.getBoardVisualControllerReady();
                    }
                    directWriterToken = renderer.claimBoardVisualWriter(
                        `local:animation-engine-direct:${this._playbackRunSequence + 1}`,
                        'local'
                    );
                    this._activeBoardWriterToken = directWriterToken;
                    this._ownsActiveBoardWriterToken = true;
                } catch (error: any) {
                    throw this._createPlaybackError('board_writer_claim_failed', events[0], error);
                }
            }
            let phaseError: any = null;
            try {
                await PresentationDispatcher.dispatchPresentationPhase(
                    events,
                    dispatcherDeps
                );
            } catch (error: any) {
                phaseError = error;
            }
            if (directWriterToken) {
                const settlement = await this._settleOwnedLocalBoardWriter(directWriterToken, events[0]);
                phaseError = phaseError || settlement.error;
            }
            if (phaseError) throw phaseError;
        }

        async _sleep(ms: any) {
            if (_isNoAnim()) return Promise.resolve();
            const signal = this._playbackAbortController?.signal || null;
            if (signal?.aborted) return Promise.resolve();
            return new Promise<void>(resolve=> {
                let settled = false;
                let id: any = null;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    if (id !== null) {
                        try { _Timer().clearTimeout(id); } catch (e: any) { /* cleanup */ }
                        id = null;
                    }
                    try { signal?.removeEventListener('abort', finish); } catch (e: any) { /* cleanup */ }
                    resolve();
                };
                try { signal?.addEventListener('abort', finish, { once: true }); } catch (e: any) { /* ignore */ }
                if (signal?.aborted) {
                    finish();
                    return;
                }
                const scheduledId = _Timer().setTimeout(finish, ms, this.playbackScope);
                id = scheduledId;
                if (settled) {
                    try { _Timer().clearTimeout(scheduledId); } catch (e: any) { /* cleanup */ }
                    id = null;
                }
            });
        }

        async handleWatchdog(options?: any) {
            const watchdogOptions = (options && typeof options === 'object') ? options : {};
            console.warn('[AnimationEngine] WATCHDOG fired. Forcing playback abort and sync.');
            this._watchdogFired = true;
            // Telemetry increment
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.watchdogFired = (window.__telemetry__.watchdogFired || 0) + 1; }
            // Clear timers in this scope and mark aborted
            try { this._playbackAbortController?.abort(); } catch (e: any) { /* best-effort */ }
            try {
                if (this.playbackScope !== null) _Timer().clearScope(this.playbackScope);
            } catch (e: any) { /* best-effort */ }
            this.isAborted = true;
            if (this._strictNetworkPlayback === true) {
                const error: any = new Error('network_playback_watchdog');
                error.name = 'NetworkPlaybackWatchdogError';
                this._strictNetworkPlaybackError = error;
                if (PlaybackState && typeof PlaybackState.abortPlayback === 'function') {
                    PlaybackState.abortPlayback({
                        boardElement: this.boardEl,
                        strictNetworkPlayback: true,
                        preserveVisualPlaybackClaims: true,
                        preserveSelectionSettlementLock: true
                    });
                } else if (typeof window !== 'undefined') {
                    this.setGlobalInteractionLock(false);
                }
                if (typeof this._strictNetworkPlaybackReject === 'function') {
                    this._strictNetworkPlaybackReject(error);
                }
                return;
            }
            // Apply final state by requesting a full board sync
            try {
                _requestBoardUpdate();
            } catch (e: any) { console.error('[AnimationEngine] watchdog emitBoardUpdate failed', e); }
            // Ensure flags cleared
            if (PlaybackState && typeof PlaybackState.abortPlayback === 'function') {
                PlaybackState.abortPlayback({
                    boardElement: this.boardEl,
                    preserveVisualPlaybackClaims: watchdogOptions.preserveVisualPlaybackClaims === true
                });
            } else if (typeof window !== 'undefined') {
                this.setGlobalInteractionLock(false);
            }
        }

        // Abort externally and apply final state (used by Single Visual Writer fallback)
        abortAndSync() {
            console.info('[AnimationEngine] abortAndSync called — stopping playback and syncing state');
            // Telemetry increment for aborts
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.abortCount = (window.__telemetry__.abortCount || 0) + 1; }
            try { this._playbackAbortController?.abort(); } catch (e: any) { /* Intentionally empty: abort signal cleanup */ }
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

        async executeEvent(ev: any, options?: any) {
            const globalOnly = !!(options && options.globalOnly === true);
            const handPlaybackResult = this._handleHandPlaybackEvent(ev);
            if (handPlaybackResult !== null) {
                return handPlaybackResult;
            }
            switch (ev.type) {
                case EVENT_TYPES.PLACE:
                case EVENT_TYPES.FLIP:
                case EVENT_TYPES.DESTROY:
                case EVENT_TYPES.SPAWN:
                case EVENT_TYPES.MOVE:
                case EVENT_TYPES.STATUS_APPLIED:
                case EVENT_TYPES.STATUS_REMOVED:
                case EVENT_TYPES.THEORY_INCARNATION_SPAWN_ROULETTE:
                    if (globalOnly) throw this._createPlaybackError('board_event_routed_to_global_dispatcher', ev);
                    return this._playBoardPhaseThroughBackend([ev]);
                case EVENT_TYPES.OBSERVER_BUBBLE:
                    return this.handleObserverBubble(ev);
                case EVENT_TYPES.ROUND_BONUS_BANNER:
                    return this.handleRoundBonusBanner(ev);
                case EVENT_TYPES.SPECIAL_CARD_CINEMATIC:
                    return this.handleSpecialCardCinematic(ev);
                case EVENT_TYPES.MANIFEST_ENDING:
                    if (globalOnly) return this.handleManifestEndingGlobal(ev);
                    await this._playBoardPhaseThroughBackend([ev]);
                    return this.handleManifestEndingGlobal(ev);
                case EVENT_TYPES.SOUND_EFFECT:
                    return this.handleSoundEffect(ev);
                case EVENT_TYPES.LOG:
                    this.log(ev.message);
                    return Promise.resolve();
                default:
                    if (this._strictNetworkPlayback === true) {
                        throw this._createPlaybackError('presentation_event_unimplemented', ev);
                    }
                    console.warn('[AnimationEngine] Unhandled event type:', ev.type);
                    return this._playBoardPhaseThroughBackend([{
                        type: '__dom_compatibility_final_state',
                        sourceEvent: ev,
                        targets: ev && ev.targets || []
                    }]);
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
                playBoardEffect: (event: any) => this._playBoardPhaseThroughBackend([event]),
                fallbackPlayHandAnimation: (typeof playHandAnimation === 'function') ? playHandAnimation : null
            });
        }

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
            const abortSignal = this._playbackAbortController?.signal || null;
            return AnimationFeedbackEvents.handleSpecialCardCinematicEvent(ev, {
                isNoAnim: _isNoAnim,
                sleep: (ms: any) => this._sleep(ms),
                typewriterSleep: (ms: any) => this._sleep(ms),
                abortSignal,
                isAborted: () => this.isAborted === true || abortSignal?.aborted === true
            });
        }

        async handleTheoryIncarnationSpawnRoulette(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, {
                type: EVENT_TYPES.THEORY_INCARNATION_SPAWN_ROULETTE
            })]);
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

        async handleManifestEndingBoard(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, {
                type: EVENT_TYPES.MANIFEST_ENDING
            })]);
        }

        async handleManifestEndingGlobal(ev: any) {
            const durationMs = this._resolveManifestEndingDurationMs(ev);
            const transitionMs = _isNoAnim() ? 0 : durationMs;
            const dimOpacity = this._resolveManifestEndingOpacity(ev);
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
                throw new Error('AnimationEngine observer event module unavailable');
            }
            const renderer = requireRuntimeModuleOrWindowGlobal('./board-renderer', 'BoardRenderer');
            if (!renderer || typeof renderer.getBoardCellClientRect !== 'function') {
                throw this._createPlaybackError('board_geometry_unavailable', ev);
            }
            if (typeof renderer.getBoardVisualControllerReady === 'function') {
                await renderer.getBoardVisualControllerReady();
            }
            return AnimationFeedbackEvents.handleObserverBubbleEvent(ev, {
                isNoAnim: _isNoAnim,
                observerBubbleMs: Constants.OBSERVER_BUBBLE_MS,
                observerBubbleFadeMs: Constants.OBSERVER_BUBBLE_FADE_MS,
                getCellClientRect: (row: any, col: any) => renderer.getBoardCellClientRect(row, col)
            });
        }

        async handlePlace(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type: EVENT_TYPES.PLACE })]);
        }

        async handleFlip(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type: EVENT_TYPES.FLIP })]);
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
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type: EVENT_TYPES.DESTROY })]);
        }

        async handleSpawn(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type: EVENT_TYPES.SPAWN })]);
        }

        async handleMove(ev: any) {
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type: EVENT_TYPES.MOVE })]);
        }

        async handleStatusChange(ev: any) {
            const rawType = String(ev && ev.type || '').trim().toLowerCase();
            const type = rawType === EVENT_TYPES.STATUS_REMOVED
                ? EVENT_TYPES.STATUS_REMOVED
                : EVENT_TYPES.STATUS_APPLIED;
            return this._playBoardPhaseThroughBackend([Object.assign({}, ev, { type })]);
        }

        async handleManifestEnding(ev: any) {
            const boardPromise = this.handleManifestEndingBoard(ev);
            const globalPromise = this.handleManifestEndingGlobal(ev);
            await Promise.all([boardPromise, globalPromise]);
        }

        async applyFinalStates(ev: any) {
            return this._playBoardPhaseThroughBackend([{
                type: '__dom_compatibility_final_state',
                sourceEvent: ev,
                targets: Array.isArray(ev && ev.targets) ? ev.targets : []
            }]);
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
