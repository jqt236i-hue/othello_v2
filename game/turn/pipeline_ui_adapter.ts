declare const __non_webpack_require__: NodeRequire | undefined;
declare const ActionManager: any;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    function readRuntimeGlobal(globalKey: string): any {
        if (!globalKey) return null;
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
                return (globalThis as any)[globalKey];
            }
            if (typeof self !== 'undefined' && (self as any)[globalKey]) {
                return (self as any)[globalKey];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function unwrapModule(mod: any): any {
        if (mod && typeof mod === 'object' && Object.prototype.hasOwnProperty.call(mod, 'default')) {
            return mod.default || mod;
        }
        return mod;
    }

    const PIPELINE_UI_ADAPTER_MODULE_GLOBALS: Record<string, string> = Object.freeze({
        '../logic/markers_adapter': 'MarkersAdapter',
        '../../utils/owner-helpers': 'OwnerHelpers',
        '../../shared/shared-board-utils': 'SharedBoardUtils',
        '../../shared/playback-planner': 'PlaybackPlanner',
        '../../shared/playback-event-helpers': 'PlaybackEventHelpers',
        './turn_pipeline_phase_helpers': 'TurnPipelinePhaseHelpers',
        './pipeline-ui/board-event-playback': 'PipelineUIBoardEventPlayback',
        './pipeline-ui/board-event-mapper': 'PipelineUIBoardEventMapper',
        './pipeline-ui/passive-event-playback': 'PipelineUIPassiveEventPlayback',
        './pipeline-ui/playback-after-state': 'PipelineUIPlaybackAfterState',
        './pipeline-ui/log-mappers': 'PipelineUILogMappers',
        './pipeline-ui/playback-utils': 'PipelineUIPlaybackUtils',
        './pipeline-ui/generated-throw-chain-playback': 'PipelineUIGeneratedThrowChainPlayback',
        './pipeline-ui/sound-cue-assembler': 'PipelineUISoundCueAssembler',
        './pipeline-ui/presentation-event-index': 'PipelineUIPresentationEventIndex',
        '../../shared/destroy-outcome-contract': 'DestroyOutcomeContract',
        '../../shared/special-stone-registry': 'SpecialStoneRegistry',
        '../../shared/manifest-stone-registry': 'ManifestStoneRegistry',
        '../../shared/stone-status-snapshot': 'StoneStatusSnapshot',
        '../controller-events': 'ControllerEvents',
        '../schema/prng': 'SeededPRNG',
        '../../shared/presentation-effect-profiles': 'PresentationEffectProfiles'
    });

    function requireOptionalModule(id: string): any {
        try {
            return _require(id);
        } catch (e) {
            return readRuntimeGlobal(PIPELINE_UI_ADAPTER_MODULE_GLOBALS[id]);
        }
    }

    function safeRequire(id: string): any {
        return unwrapModule(requireOptionalModule(id));
    }

    const MarkersAdapter = requireOptionalModule('../logic/markers_adapter');
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    const OwnerHelpersModule = requireOptionalModule('../../utils/owner-helpers');
    const SharedBoardUtils = requireOptionalModule('../../shared/shared-board-utils');
    const PlaybackPlanner = requireOptionalModule('../../shared/playback-planner');
    const PlaybackEventHelpers = requireOptionalModule('../../shared/playback-event-helpers');
    const TurnPipelinePhaseHelpers = requireOptionalModule('./turn_pipeline_phase_helpers');
    const PipelineUIBoardEventPlaybackModule = requireOptionalModule('./pipeline-ui/board-event-playback');
    const PipelineUIBoardEventMapperModule = requireOptionalModule('./pipeline-ui/board-event-mapper');
    const PipelineUIPassiveEventPlaybackModule = requireOptionalModule('./pipeline-ui/passive-event-playback');
    const PipelineUIPlaybackAfterStateModule = requireOptionalModule('./pipeline-ui/playback-after-state');
    const PipelineUILogMappersModule = requireOptionalModule('./pipeline-ui/log-mappers');
    const PipelineUIPlaybackUtilsModule = requireOptionalModule('./pipeline-ui/playback-utils');
    const PipelineUIGeneratedThrowChainPlaybackModule = requireOptionalModule('./pipeline-ui/generated-throw-chain-playback');
    const PipelineUISoundCueAssemblerModule = requireOptionalModule('./pipeline-ui/sound-cue-assembler');
    const PipelineUIPresentationEventIndexModule = requireOptionalModule('./pipeline-ui/presentation-event-index');
    const DestroyOutcomeContract = requireOptionalModule('../../shared/destroy-outcome-contract');
    const SpecialStoneRegistry = requireOptionalModule('../../shared/special-stone-registry');
    const ManifestStoneRegistry = requireOptionalModule('../../shared/manifest-stone-registry');
    const StoneStatusSnapshot = requireOptionalModule('../../shared/stone-status-snapshot');
    const ControllerEvents = requireOptionalModule('../controller-events');
    const SeededPRNG = requireOptionalModule('../schema/prng');
    const PresentationEffectProfiles = safeRequire('../../shared/presentation-effect-profiles') || unwrapModule(readRuntimeGlobal('PresentationEffectProfiles'));
    const FALLBACK_MANIFEST_STONE_TYPES_FOR_PIPELINE_UI = Object.freeze([
        'THEORY_INCARNATION',
        'BOARD_EXECUTOR',
        'OBSERVER_WILL'
    ]);

    function isManifestStoneTypeForPipelineUI(rawType: any): boolean {
        if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
            return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
        }
        const typeKey = String(rawType || '').trim().toUpperCase();
        return FALLBACK_MANIFEST_STONE_TYPES_FOR_PIPELINE_UI.includes(typeKey);
    }

    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const REGEN_CONSUMED_REASON = 'regen_consumed';
    const LIVING_WILL_CAUSE = 'LIVING_WILL';
    const LIVING_WILL_RESTORE_REASON = 'living_will_restored';
    const LIVING_WILL_CONSUMED_REASON = 'living_will_consumed';
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        LIVING_WILL_RESTORED: 'living_will_restored',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });
    const BATCH_DESTROY_CAUSES = new Set(['TIME_BOMB', 'ULTIMATE_DESTROY_GOD', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE', 'BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD']);
    const BOMB_DESTROY_CAUSES = new Set(['TIME_BOMB', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE']);
    const SUPER_CRUSH_CAUSES = new Set(['BUOYANCY_WILL', 'SUPER_BUOYANCY_WILL', 'GRAVITY_WILL', 'SUPER_GRAVITY_WILL', 'SUPER_ATTRACTION_WILL']);
    const SPECIAL_DURATION_EXPIRE_CAUSES = new Set([
        'SNIPER_WILL',
        'LIGHTNING_WILL',
        'FIRE_WILL',
        'WATER_WILL',
        'GRASS_WILL',
        'METEOR_GOD',
        'DESTROY_DRAGON',
        'DESTROY_DRAGON_WILL',
        'DRAGON',
        'BREEDING',
        'ROBOT_VACUUM',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'TIME_STOP',
        'TIME_STOP_DEITY',
        'TRAP_WILL'
    ]);
    const SPECIAL_DURATION_REVERT_SPECIALS = new Set([
        'BREEDING',
        'DESTROY_DRAGON',
        'DESTROY_DRAGON_WILL',
        'DRAGON',
        'GHOST',
        'HYPERACTIVE',
        'LIGHTNING',
        'FIRE',
        'WATER',
        'METEOR_GOD',
        'PROLIFERATION',
        'ROBOT_VACUUM',
        'SNIPER',
        'STONE_SALVATION_GOD',
        'TIME_STOP',
        'TIME_STOP_DEITY',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE',
        'WILL_HUNTER_KING',
        'WORK'
    ]);
    const SOUND_EVENT_TYPE = 'sound_effect';
    const CARD_EFFECT_FLIP_SOUND_KEY = 'card_effect_flip';
    const ULTIMATE_ANCHOR_MOVE_SOUND_KEY = 'ultimate_anchor_move';
    const STONE_SALVATION_GOD_CAUSE = PresentationEffectProfiles.STONE_SALVATION_GOD_CAUSE;
    const STONE_SALVATION_GOD_REVIVE_REASON = PresentationEffectProfiles.STONE_SALVATION_GOD_REVIVE_REASON;
    const SPECIAL_DESTROY_TARGET_PROFILES = PresentationEffectProfiles.SPECIAL_DESTROY_TARGET_PROFILES;
    let pipelineUIAdapterRuntime: any = null;

    function setPipelineUIAdapterRuntime(runtime: any) {
        pipelineUIAdapterRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
        return pipelineUIAdapterRuntime;
    }

    function isPipelineRandomSource(candidate: any): boolean {
        return !!(candidate && typeof candidate.random === 'function');
    }

    function resolvePipelineSeededPRNGModule(): any {
        return SeededPRNG || readRuntimeGlobal('SeededPRNG');
    }

    function restorePipelinePrngFromState(prngState: any): any {
        if (!prngState || typeof prngState !== 'object') return undefined;
        const seededPrng = resolvePipelineSeededPRNGModule();
        if (!seededPrng || typeof seededPrng !== 'object') return undefined;
        try {
            if (typeof seededPrng.fromState === 'function') {
                const restored = seededPrng.fromState(prngState);
                return isPipelineRandomSource(restored) ? restored : undefined;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof seededPrng.createPRNG === 'function') {
                const seed = Object.prototype.hasOwnProperty.call(prngState, 'seed')
                    ? prngState.seed
                    : prngState._seed;
                const restored = seededPrng.createPRNG(seed);
                if (restored && typeof restored.restoreState === 'function') {
                    restored.restoreState({
                        seed,
                        calls: Number(prngState.calls || prngState._calls || 0)
                    });
                }
                return isPipelineRandomSource(restored) ? restored : undefined;
            }
        } catch (e) { /* ignore */ }
        return undefined;
    }

    function resolvePipelineRuntimePrng(cardState?: any) {
        if (pipelineUIAdapterRuntime && typeof pipelineUIAdapterRuntime.getGamePrng === 'function') {
            try {
                const candidate = pipelineUIAdapterRuntime.getGamePrng();
                if (isPipelineRandomSource(candidate)) return candidate;
            } catch (e) { /* ignore */ }
        }
        if (isPipelineRandomSource(cardState && cardState._boardOpsRandomSource)) {
            return cardState._boardOpsRandomSource;
        }
        if (isPipelineRandomSource(cardState && cardState._defaultRandomSource)) {
            return cardState._defaultRandomSource;
        }
        const restored = restorePipelinePrngFromState(cardState && cardState.prngState);
        if (isPipelineRandomSource(restored)) return restored;
        return undefined;
    }

    function emitPipelineEffectLog(message: any): void {
        if (!message) return;
        try {
            if (pipelineUIAdapterRuntime && typeof pipelineUIAdapterRuntime.emitEffectLog === 'function') {
                pipelineUIAdapterRuntime.emitEffectLog(message);
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (ControllerEvents && typeof ControllerEvents.emitEffectLog === 'function') {
                ControllerEvents.emitEffectLog(message);
                return;
            }
            if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
                ControllerEvents.emitLogAdded(message, 'effect');
            }
        } catch (e) { /* ignore */ }
    }

    function emitPipelineNormalLog(message: any): void {
        if (!message) return;
        try {
            if (pipelineUIAdapterRuntime && typeof pipelineUIAdapterRuntime.emitNormalLog === 'function') {
                pipelineUIAdapterRuntime.emitNormalLog(message);
                return;
            }
            if (pipelineUIAdapterRuntime && typeof pipelineUIAdapterRuntime.emitLogAdded === 'function') {
                pipelineUIAdapterRuntime.emitLogAdded(message, 'normal');
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (ControllerEvents && typeof ControllerEvents.emitNormalLog === 'function') {
                ControllerEvents.emitNormalLog(message);
                return;
            }
            if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
                ControllerEvents.emitLogAdded(message, 'normal');
            }
        } catch (e) { /* ignore */ }
    }

    const CARD_EFFECT_FLIP_RAW_EVENT_TYPES = new Set([
        'dragon_converted_start',
        'dragon_converted_immediate',
        'chain_flipped',
        'taboo_reverse_flipped',
        'reverse_will_flipped',
        'regen_triggered_start',
        'regen_triggered',
        'regen_capture_flipped_start',
        'regen_capture_flipped',
        'breeding_flipped_start',
        'breeding_flipped_immediate',
        'hyperactive_flipped_start',
        'hyperactive_flipped_immediate',
        'robot_vacuum_flipped_start',
        'robot_vacuum_flipped_immediate',
        'ultimate_hyperactive_flipped_start',
        'ultimate_hyperactive_flipped_immediate'
    ]);
    const GENERATED_THROW_CHAIN_REASON = 'generated_throw_chain';
    const WORK_INCOME_BUBBLE_TEXT_BY_STEP = (
        TurnPipelinePhaseHelpers
        && TurnPipelinePhaseHelpers.WORK_INCOME_LINES_BY_STEP
        && typeof TurnPipelinePhaseHelpers.WORK_INCOME_LINES_BY_STEP === 'object'
    ) ? TurnPipelinePhaseHelpers.WORK_INCOME_LINES_BY_STEP : Object.freeze({});
    const MULTI_PLACE_LABEL_BY_TYPE: Record<string, string> = Object.freeze({
        DOUBLE_PLACE: '二連投石',
        TRIPLE_PLACE: '三連投石',
        QUAD_PLACE: '四連投石',
        INFINITE_PLACE: '無限投石',
        LAST_RESORT: '最後の切り札'
    });
    const deferredGeneratedThrowChainPlaybackByPlayer: Record<string, any[]> = {
        black: [],
        white: []
    };

    function getPipelineUIGeneratedThrowChainPlaybackDeps() {
        return {
            generatedThrowChainReason: GENERATED_THROW_CHAIN_REASON,
            normalizePlayerKey: _normalizePlayerKey
        };
    }

    function clearDeferredGeneratedThrowChainPlayback(playerKey: any) {
        if (!(PipelineUIGeneratedThrowChainPlaybackModule && typeof PipelineUIGeneratedThrowChainPlaybackModule.clearDeferredGeneratedThrowChainPlayback === 'function')) {
            throw new Error('PipelineUIAdapter generated throw-chain module unavailable');
        }
        return PipelineUIGeneratedThrowChainPlaybackModule.clearDeferredGeneratedThrowChainPlayback(
            playerKey,
            deferredGeneratedThrowChainPlaybackByPlayer,
            getPipelineUIGeneratedThrowChainPlaybackDeps()
        );
    }

    function _getMultiPlaceLabel(type: any, fallbackLabel: any) {
        const fallback = String(fallbackLabel || '').trim();
        if (fallback) return fallback;
        const key = String(type || '').toUpperCase();
        return MULTI_PLACE_LABEL_BY_TYPE[key] || '追加配置';
    }

    function _formatMultiPlaceActivationLog(effects: any) {
        const label = _getMultiPlaceLabel(effects && effects.multiPlaceActivatedType, effects && effects.multiPlaceActivatedName);
        if (effects && effects.multiPlaceInfinite) {
            return `${label}: 合法手が尽きるまで連続配置`;
        }
        const remaining = Number.isFinite(Number(effects && effects.multiPlaceRemaining))
            ? Math.max(0, Math.trunc(Number(effects.multiPlaceRemaining)))
            : 1;
        return `${label}: あと${remaining}回置ける`;
    }

    function _formatMultiPlaceConsumedLog(ev: any) {
        const label = _getMultiPlaceLabel(ev && ev.sourceType, null);
        const remaining = Number.isFinite(Number(ev && ev.remaining))
            ? Math.max(0, Math.trunc(Number(ev.remaining)))
            : null;
        if (remaining !== null && remaining > 0) {
            return `${label}: 追加手を消費（あと${remaining}回）`;
        }
        return `${label}: 追加手を消費`;
    }

    function _inferWorkIncomeStepByGain(gained: any) {
        const g = Number(gained) || 0;
        if (g >= 16) return 5;
        if (g >= 8) return 4;
        if (g >= 4) return 3;
        if (g >= 2) return 2;
        if (g >= 1) return 1;
        return null;
    }

    function _resolveWorkIncomeBubbleText(ev: any) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;

        const rawStep = Number.isFinite(Number(ev && ev.incomeStep))
            ? Number(ev.incomeStep)
            : (Number.isFinite(Number(ev && ev.meta && ev.meta.incomeStep))
                ? Number(ev.meta.incomeStep)
                : _inferWorkIncomeStepByGain(ev && ev.gained));
        if (TurnPipelinePhaseHelpers && typeof TurnPipelinePhaseHelpers.resolveWorkIncomeLine === 'function') {
            return TurnPipelinePhaseHelpers.resolveWorkIncomeLine(ev && ev.gained, rawStep);
        }
        const step: number | null = Number.isFinite(rawStep) ? Math.max(1, Math.min(5, Math.trunc(rawStep!))) : null;
        if (step && WORK_INCOME_BUBBLE_TEXT_BY_STEP[step]) return WORK_INCOME_BUBBLE_TEXT_BY_STEP[step];

        return null;
    }

    function _resolveWorkRemovedBubbleText(ev: any) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;
        if (TurnPipelinePhaseHelpers && typeof TurnPipelinePhaseHelpers.getSpecialStoneBubbleSpeechLines === 'function') {
            const lines = TurnPipelinePhaseHelpers.getSpecialStoneBubbleSpeechLines('WORK', 'destroy');
            return Array.isArray(lines) && lines.length > 0 ? lines[0] : null;
        }
        return null;
    }

    function isRegenTriggeredChange(ev: any) {
        return !!(ev && ev.cause === REGEN_CAUSE && ev.reason === REGEN_TRIGGER_REASON);
    }

    function isRegenConsumedStatus(ev: any) {
        return !!(ev && ev.meta && ev.meta.special === REGEN_CAUSE && ev.meta.reason === REGEN_CONSUMED_REASON);
    }

    function isLivingWillConsumedStatus(ev: any) {
        const meta = ev && ev.meta;
        return !!(
            ev &&
            meta &&
            String(meta.special || '').toUpperCase() === LIVING_WILL_CAUSE &&
            String(meta.reason || ev.reason || '').toLowerCase() === LIVING_WILL_CONSUMED_REASON
        );
    }

    function isLivingWillRestorePresentationEvent(ev: any) {
        const meta = ev && ev.meta;
        return !!(
            ev &&
            (ev.type === 'SPAWN' || ev.type === 'CHANGE') &&
            (
                meta && meta.livingWillRevived === true ||
                (
                    String(ev.cause || (meta && meta.cause) || '').toUpperCase() === LIVING_WILL_CAUSE &&
                    String(ev.reason || (meta && meta.reason) || '').toLowerCase() === LIVING_WILL_RESTORE_REASON
                )
            )
        );
    }

    function isLivingWillRestoreChange(ev: any) {
        return !!(ev && ev.type === 'CHANGE' && isLivingWillRestorePresentationEvent(ev));
    }

    function hasLivingWillTriggeredDestroyPresentationEventAt(eventIndex: any, row: any, col: any) {
        return !!eventIndex.findFirst({
            type: 'DESTROY',
            row,
            col,
            predicate: (ev: any) => !!(ev.meta && ev.meta.livingWillTriggered === true)
        });
    }

    function hasLivingWillRestoreChangePresentationEventAt(eventIndex: any, row: any, col: any) {
        return !!eventIndex.findFirst({
            type: 'CHANGE',
            row,
            col,
            predicate: isLivingWillRestoreChange
        });
    }

    function hasLivingWillRestorePresentationEventForSource(eventIndex: any, row: any, col: any, special: any) {
        const specialUpper = String(special || '').trim().toUpperCase();
        return !!eventIndex.findFirst({
            row,
            col,
            includeSourceCell: true,
            predicate: (ev: any) => {
                if (!isLivingWillRestorePresentationEvent(ev)) return false;
                const meta = (ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
                const restoredSpecial = String(ev.special || meta.special || '').trim().toUpperCase();
                return !(specialUpper && restoredSpecial && restoredSpecial !== specialUpper);
            }
        });
    }

    function isObserverLostBubblePresentationEvent(ev: any) {
        const reason = String((ev && ev.reason) || (ev && ev.meta && ev.meta.reason) || '').toLowerCase();
        return reason.indexOf('anchor_lost') >= 0 ||
            reason.indexOf('removed') >= 0 ||
            reason.indexOf('captured') >= 0 ||
            reason.indexOf('lost') >= 0;
    }

    function isChainFlipPresentationEvent(ev: any) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        const cause = String(ev.cause || '').toUpperCase();
        return reason === 'chain_flip' || cause === 'CHAIN_WILL';
    }

    function isCardEffectFlipPresentationEvent(ev: any) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        return isChainFlipPresentationEvent(ev) ||
            reason.indexOf('dragon_convert') === 0 ||
            reason.indexOf('taboo_reverse_flip') === 0 ||
            reason.indexOf('reverse_will_flip') === 0 ||
            reason.indexOf('regen_triggered') === 0 ||
            reason.indexOf('regen_capture_flip') === 0 ||
            reason.indexOf('reinforcement_will_flip') === 0 ||
            reason.indexOf('support_troops_will_flip') === 0 ||
            reason.indexOf('salvation_flip') === 0 ||
            reason.indexOf('breeding_flip') === 0 ||
            reason.indexOf('clone_spawn_flip') === 0 ||
            reason.indexOf('seed_sprout_flip') === 0 ||
            reason.indexOf('proliferation_spawn_flip') === 0 ||
            reason.indexOf('stone_salvation_god_revive_flip') === 0 ||
            reason.indexOf('hyperactive_flip') === 0 ||
            reason.indexOf('escape_hyperactive_flip') === 0 ||
            reason.indexOf('extreme_hyperactive_flip') === 0 ||
            reason.indexOf('ultimate_hyperactive_flip') === 0 ||
            reason.indexOf('robot_vacuum_flip') === 0 ||
            reason.indexOf('swap_with_enemy') === 0 ||
            reason.indexOf('tempt_applied') === 0;
    }

    function _countCardEffectFlipFallbackEvents(rawEvents: any) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        return events.reduce((sum: any, ev: any) => {
            if (!ev || !ev.type) return sum;
            if (CARD_EFFECT_FLIP_RAW_EVENT_TYPES.has(ev.type)) {
                return sum + (_rawDetailCount(ev) > 0 ? 1 : 0);
            }
            if (ev.type === 'swap_selected') {
                return sum + (ev.swapped === true ? 1 : 0);
            }
            if (ev.type === 'tempt_selected') {
                return sum + (ev.applied === true ? 1 : 0);
            }
            return sum;
        }, 0);
    }

    function getChainFlipLink(ev: any) {
        if (!ev || !ev.meta || !Number.isFinite(ev.meta.chainLink)) return 1;
        const link = Number(ev.meta.chainLink);
        return link >= 1 ? link : 1;
    }

    function isOverlayOnlySpecialStoneType(type: any) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isOverlayOnlySpecialStoneType === 'function') {
            return SpecialStoneRegistry.isOverlayOnlySpecialStoneType(type);
        }
        const typeUpper = String(type || '').toUpperCase();
        return typeUpper === 'GUARD' || typeUpper === 'LIVING_WILL';
    }

    function getVisualSpecialFromMeta(meta: any) {
        const special = (meta && meta.special) || null;
        return isOverlayOnlySpecialStoneType(special) ? null : special;
    }

    function shouldPreferFinalVisualStateForStatusApplied(eventSpecialRaw: any, visualSpecial: any, livingWillAura: any) {
        if (!isOverlayOnlySpecialStoneType(eventSpecialRaw)) return false;
        if (String(eventSpecialRaw || '').toUpperCase() === 'LIVING_WILL') {
            return livingWillAura === true && !!visualSpecial;
        }
        return !!visualSpecial;
    }

    function resolveDisplayTimerValue(special: any, timerValue: any, regenRemainingValue: any) {
        if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveDisplayTimerValue === 'function') {
            return StoneStatusSnapshot.resolveDisplayTimerValue({
                type: special,
                timer: timerValue,
                regenRemaining: regenRemainingValue
            });
        }
        const timer = toCounterOrNull(timerValue);
        if (timer !== null) return timer;
        if (String(special || '').toUpperCase() === 'REGEN') {
            return toCounterOrNull(regenRemainingValue);
        }
        return null;
    }

    function getPrimaryTimerFromMeta(meta: any) {
        const special = (meta && meta.special) || null;
        return resolveDisplayTimerValue(special, meta && meta.timer, meta && meta.regenRemaining);
    }

    function toCounterOrNull(value: any) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function getFlipEvadeRemainingFromMeta(meta: any) {
        return toCounterOrNull(meta && meta.flipEvadeRemaining);
    }

    function getDestroyEvadeRemainingFromMeta(meta: any) {
        return toCounterOrNull(meta && meta.destroyEvadeRemaining);
    }

    function getStatusPlaybackTargetTraits(ev: any) {
        const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : {};
        const explicitSubjectKind = String(meta.subjectKind || ev && ev.subjectKind || '').trim().toLowerCase();
        const explicitStoneMutation = String(meta.stoneMutation || ev && ev.stoneMutation || '').trim().toLowerCase();
        const special = String(meta.special || ev && ev.special || '').trim().toUpperCase();
        const subjectKind = explicitSubjectKind || (
            SpecialStoneRegistry && typeof SpecialStoneRegistry.getMarkerSubjectKind === 'function'
                ? String(SpecialStoneRegistry.getMarkerSubjectKind(special) || '').trim().toLowerCase()
                : ''
        ) || 'stone_body';
        let stoneMutation = explicitStoneMutation;
        if (!stoneMutation) {
            if (subjectKind === 'cell_marker') {
                stoneMutation = 'preserve';
            } else if (subjectKind === 'topology') {
                stoneMutation = 'remove';
            } else {
                const isHazardStoneStatus = SpecialStoneRegistry
                    && typeof SpecialStoneRegistry.isHazardStoneStatusType === 'function'
                    && SpecialStoneRegistry.isHazardStoneStatusType(special) === true;
                stoneMutation = isHazardStoneStatus && String(ev && ev.type || '').toUpperCase() === 'STATUS_TICK'
                    ? 'timer-only'
                    : (isHazardStoneStatus ? 'preserve' : 'replace');
            }
        }
        return { subjectKind, stoneMutation };
    }

    function getCellColorAt(gameState: any, cardState: any, r: any, c: any) {
        if (!gameState || !Array.isArray(gameState.board)) return 0;
        if (
            !SharedBoardUtils
            || typeof SharedBoardUtils.createBoardContext !== 'function'
            || typeof SharedBoardUtils.getCellValue !== 'function'
        ) {
            throw new Error('SharedBoardUtils BoardContext APIs are required by PipelineUIAdapter');
        }
        const boardContext = SharedBoardUtils.createBoardContext(gameState, cardState ?? null);
        const value = SharedBoardUtils.getCellValue(boardContext, r, c);
        return (value === 1 || value === -1) ? value : 0;
    }

    /**
     * Helper to get visual state of a cell from game/card state.
     */
    function getVisualStateAt(r: any, c: any, cardState: any, gameState: any) {
        if (!gameState || !gameState.board) return {
            color: 0,
            special: null,
            timer: null,
            owner: null,
            flipEvadeRemaining: null,
            destroyEvadeRemaining: null,
            livingWillAura: false
        };
        const color = getCellColorAt(gameState, cardState, r, c);
        const markerKinds = MarkersAdapter && MarkersAdapter.MARKER_KINDS
            ? MarkersAdapter.MARKER_KINDS
            : { SPECIAL_STONE: 'specialStone', MANIFEST_STONE: 'manifestStone', BOMB: 'bomb' };
        const specialMarkerKind = markerKinds.SPECIAL_STONE || 'specialStone';
        const manifestMarkerKind = markerKinds.MANIFEST_STONE || 'manifestStone';
        let special = null;
        let timer = null;
        let owner = null;
        let flipEvadeRemaining = null;
        let destroyEvadeRemaining = null;
        let livingWillAura = false;
        let manifestAura = null;

        const isActiveManifestMarker = (marker: any) => {
            if (!marker || typeof marker !== 'object') return false;
            const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
            const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
            if (!isManifestStoneTypeForPipelineUI(typeKey)) return false;
            const kind = String((marker && marker.kind) || '').trim();
            const isManifestKind = kind === manifestMarkerKind || kind === 'manifestStone';
            const isLegacyManifestType = (kind === specialMarkerKind || !kind) && isManifestStoneTypeForPipelineUI(typeKey);
            if (!isManifestKind && !isLegacyManifestType) return false;
            const remainingRaw = data.remainingOwnerTurns ?? data.remainingTurns ?? marker.remainingOwnerTurns ?? marker.remainingTurns;
            if (remainingRaw == null) return true;
            const remaining = Number(remainingRaw);
            return !Number.isFinite(remaining) || remaining > 0;
        };

        if (cardState && cardState.markers) {
            const markersAtCell = cardState.markers.filter((m: any) => (
                m &&
                (m.kind === specialMarkerKind || m.kind === manifestMarkerKind) &&
                m.row === r &&
                m.col === c
            ));
            const bombMarker = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, r, c)
                : cardState.markers.find((m: any) => m.kind === specialMarkerKind && m.data && m.data.category === 'bomb' && m.row === r && m.col === c);

            const manifestMarker = markersAtCell.find(isActiveManifestMarker);
            if (manifestMarker) {
                manifestAura = {
                    owner: (manifestMarker.owner !== undefined && manifestMarker.owner !== null) ? manifestMarker.owner : null
                };
            }

            if (!StoneStatusSnapshot || typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers !== 'function') {
                throw new Error('StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers is required by PipelineUIAdapter');
            }
            const visualState = StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
                bombMarker,
                mode: 'visual'
            });
            special = visualState.special;
            timer = visualState.timer;
            owner = visualState.owner;
            flipEvadeRemaining = visualState.flipEvadeRemaining;
            destroyEvadeRemaining = visualState.destroyEvadeRemaining;
            livingWillAura = visualState.livingWillAura === true;
            if (!livingWillAura) {
                livingWillAura = markersAtCell.some((m: any) => (
                    m &&
                    m.data &&
                    String(m.data.type || '').toUpperCase() === 'LIVING_WILL'
                ));
            }
        }

        return {
            color,
            special,
            timer,
            owner,
            flipEvadeRemaining,
            destroyEvadeRemaining,
            livingWillAura,
            ...(manifestAura ? { manifestAura } : {})
        };
    }

    function _createPlaybackPhaseState() {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.createPlaybackPhaseState === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.createPlaybackPhaseState();
    }

    function _createPlaybackEventBase(ev: any, finalCardState: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.createPlaybackEventBase === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.createPlaybackEventBase(ev, finalCardState);
    }

    function _createPlaybackEvent(playbackBase: any, type: any, phase: any, targets: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.createPlaybackEvent === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.createPlaybackEvent(playbackBase, type, phase, targets);
    }

    function _clearChainFlipPhaseState(phaseState: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.clearChainFlipPhaseState === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.clearChainFlipPhaseState(phaseState);
    }

    function _preparePassivePlaybackPhaseState(phaseState: any, options?: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.preparePassivePlaybackPhaseState === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.preparePassivePlaybackPhaseState(phaseState, options);
    }

    function _planDurationEndRevertPlaybackPhase(phaseState: any, hasPriorPlaybackEvent: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.planDurationEndRevertPlaybackPhase === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.planDurationEndRevertPlaybackPhase(phaseState, hasPriorPlaybackEvent);
    }

    function _getDestroyOutcomeKind(meta: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
            return DestroyOutcomeContract.getDestroyOutcomeKind(meta);
        }
        if (!meta || typeof meta !== 'object') return null;
        if (meta.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
        if (meta.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
        if (meta.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
        if (meta.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
        if (meta.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
        return null;
    }

    function _isDestroyRemovalOutcome(target: any) {
        const kind = _getDestroyOutcomeKind(target && target.meta);
        return kind === null || kind === DESTROY_OUTCOME_KINDS.DESTROYED;
    }

    function _isProliferationSpawnPresentationEvent(ev: any) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'PROLIFERATION_WILL' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('proliferation_spawn') === 0;
    }

    const CARD_EFFECT_SPAWN_PLAYBACK_UI_META = Object.freeze({
        reinforcement_will_spawn: Object.freeze({
            rawResolvedType: 'reinforcement_will_resolved',
            soundSourceType: 'reinforcement_will_spawn',
            phaseStartIndex: 1
        }),
        support_troops_will_spawn: Object.freeze({
            rawResolvedType: 'support_troops_will_resolved',
            soundSourceType: 'support_troops_will_spawn',
            phaseStartIndex: 1
        }),
        salvation_spawn: Object.freeze({
            rawResolvedType: 'salvation_will_resolved',
            soundSourceType: 'salvation_spawn',
            phaseStartIndex: 1
        }),
        [STONE_SALVATION_GOD_REVIVE_REASON]: Object.freeze({
            soundSourceType: STONE_SALVATION_GOD_REVIVE_REASON,
            phaseStartIndex: 0,
            alwaysAdvancePhase: true
        })
    });
    const CARD_EFFECT_SPAWN_PROFILES = Object.freeze(
        (PresentationEffectProfiles.CARD_EFFECT_SPAWN_PLAYBACK_PROFILES || []).map((profile: any) => Object.freeze({
            ...profile,
            ...(CARD_EFFECT_SPAWN_PLAYBACK_UI_META as any)[String(profile && profile.reasonPrefix ? profile.reasonPrefix : '')]
        }))
    );
    const DEFERRED_SPAWN_PLAYBACK_PROFILES = Object.freeze([
        Object.freeze({
            cause: STONE_SALVATION_GOD_CAUSE,
            reasonPrefix: STONE_SALVATION_GOD_REVIVE_REASON
        })
    ]);

    function _matchesSpawnCauseAndReason(subject: any, cause: any, reasonPrefix: any) {
        return PresentationEffectProfiles.matchesCauseReasonProfile(subject, { cause, reasonPrefix });
    }

    function _isCardEffectSpawnEventLike(ev: any, profile: any) {
        return PresentationEffectProfiles.isSpawnEventLike(ev, profile);
    }

    function _isSeedSproutEventLike(ev: any) {
        return (
            _matchesSpawnCauseAndReason(ev, 'SEED_WILL', 'seed_sprout') ||
            _matchesSpawnCauseAndReason(ev, 'GRASS_WILL', 'seed_sprout')
        );
    }

    function _isLivingWillRestoreEventLike(ev: any) {
        return _matchesSpawnCauseAndReason(ev, 'LIVING_WILL', 'living_will_restored');
    }

    function _isCardEffectSpawnPlaybackEvent(ev: any, profile: any) {
        return !!(
            ev &&
            ev.type === 'spawn' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => _isCardEffectSpawnEventLike(target, profile))
        );
    }

    function _getCardEffectSpawnProfile(ev: any) {
        for (const profile of CARD_EFFECT_SPAWN_PROFILES) {
            if (_isCardEffectSpawnEventLike(ev, profile)) return profile;
        }
        return null;
    }

    function getPipelineUIBoardEventPlaybackDeps() {
        return {
            batchDestroyCauses: BATCH_DESTROY_CAUSES,
            superCrushCauses: SUPER_CRUSH_CAUSES,
            stoneSalvationGodCause: STONE_SALVATION_GOD_CAUSE,
            cardEffectSpawnProfiles: CARD_EFFECT_SPAWN_PROFILES,
            deferredSpawnPlaybackProfiles: DEFERRED_SPAWN_PLAYBACK_PROFILES,
            destroyOutcomeKinds: DESTROY_OUTCOME_KINDS,
            isCardEffectSpawnEventLike: _isCardEffectSpawnEventLike,
            matchesSpawnCauseAndReason: _matchesSpawnCauseAndReason,
            getDestroyOutcomeKind: _getDestroyOutcomeKind,
            getMoveIntent: _getMoveIntent,
            getPrimaryTimerFromMeta,
            getFlipEvadeRemainingFromMeta,
            getDestroyEvadeRemainingFromMeta,
            isChainFlipPresentationEvent,
            getChainFlipLink,
            isRegenTriggeredChange,
            isLivingWillRestorePresentationEvent,
            isLivingWillRestoreChange
        };
    }

    function getPipelineUIPlaybackAfterStateDeps() {
        return {
            getVisualSpecialFromMeta,
            shouldPreferFinalVisualStateForStatusApplied,
            getPrimaryTimerFromMeta,
            getFlipEvadeRemainingFromMeta,
            getDestroyEvadeRemainingFromMeta,
            getVisualStateAt,
            isManifestStoneType: isManifestStoneTypeForPipelineUI,
            isBoardMarkerType: (rawType: any) => (
                SpecialStoneRegistry &&
                typeof SpecialStoneRegistry.isBoardMarkerType === 'function' &&
                SpecialStoneRegistry.isBoardMarkerType(rawType) === true
            )
        };
    }

    function createCardVisualDescriptorForPlayback(cardId: any, meta: any) {
        return (PlaybackEventHelpers && typeof PlaybackEventHelpers.createCardVisualDescriptor === 'function')
            ? PlaybackEventHelpers.createCardVisualDescriptor(cardId || null, meta || null)
            : null;
    }

    function getPipelineUIPassiveEventPlaybackDeps(presentationEventIndex: any) {
        return {
            normalizePlayerKey: _normalizePlayerKey,
            preparePassivePlaybackPhaseState: _preparePassivePlaybackPhaseState,
            isBoardShrinkHoleStatusAppliedPresentationEvent: _isBoardShrinkHoleStatusAppliedPresentationEvent,
            isLivingWillConsumedStatus,
            hasLivingWillTriggeredDestroyPresentationEventAt: (_events: any, row: any, col: any) => (
                hasLivingWillTriggeredDestroyPresentationEventAt(presentationEventIndex, row, col)
            ),
            hasLivingWillRestoreChangePresentationEventAt: (_events: any, row: any, col: any) => (
                hasLivingWillRestoreChangePresentationEventAt(presentationEventIndex, row, col)
            ),
            planDestroyPlayback: _planDestroyPlayback,
            livingWillCause: LIVING_WILL_CAUSE,
            livingWillConsumedReason: LIVING_WILL_CONSUMED_REASON,
            isSpecialDurationExpiredStatusRemovedEvent: _isSpecialDurationExpiredStatusRemovedEvent,
            isRegenConsumedStatus,
            planDurationEndRevertPlaybackPhase: _planDurationEndRevertPlaybackPhase,
            createCardVisualDescriptor: createCardVisualDescriptorForPlayback,
            resolveWorkIncomeBubbleText: _resolveWorkIncomeBubbleText,
            resolveWorkRemovedBubbleText: _resolveWorkRemovedBubbleText,
            isWorkDurationExpiredPresentationEvent: _isWorkDurationExpiredPresentationEvent,
            hasLivingWillRestorePresentationEventForSource: (_events: any, row: any, col: any, special: any) => (
                hasLivingWillRestorePresentationEventForSource(presentationEventIndex, row, col, special)
            ),
            createPlaybackEvent: _createPlaybackEvent,
            hasDurationEndMarker: _hasDurationEndMarker,
            isObserverLostBubblePresentationEvent,
            isManifestStoneType: isManifestStoneTypeForPipelineUI,
            getStatusPlaybackTargetTraits
        };
    }

    function _isBoardShrinkHoleStatusAppliedPresentationEvent(ev: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.isBoardShrinkHoleStatusAppliedPresentationEvent === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.isBoardShrinkHoleStatusAppliedPresentationEvent(ev);
    }

    function _isDeferredSpawnPresentationEvent(ev: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.isDeferredSpawnPresentationEvent === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.isDeferredSpawnPresentationEvent(ev, getPipelineUIBoardEventPlaybackDeps());
    }

    function _findExtremeForcedSwapMovePairPresentationIndex(presentationEvents: any, firstIndex: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.findExtremeForcedSwapMovePairPresentationIndex === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.findExtremeForcedSwapMovePairPresentationIndex(presentationEvents, firstIndex);
    }

    function _createExtremeForcedSwapPlaybackEvent(playbackBase: any, phase: any, leadEv: any, followEv: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.createExtremeForcedSwapPlaybackEvent === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.createExtremeForcedSwapPlaybackEvent(playbackBase, phase, leadEv, followEv);
    }

    function _planSpawnPlayback(phaseState: any, ev: any, playbackBase: any, followsProliferationDestroy: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.planSpawnPlayback === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.planSpawnPlayback(
            phaseState,
            ev,
            playbackBase,
            followsProliferationDestroy,
            getPipelineUIBoardEventPlaybackDeps()
        );
    }

    function _planDestroyPlayback(phaseState: any, ev: any, destroyMeta: any, playbackBase: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.planDestroyPlayback === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.planDestroyPlayback(
            phaseState,
            ev,
            destroyMeta,
            playbackBase,
            getPipelineUIBoardEventPlaybackDeps()
        );
    }

    function _planChangePlaybackPhase(phaseState: any, ev: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.planChangePlaybackPhase === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.planChangePlaybackPhase(phaseState, ev, getPipelineUIBoardEventPlaybackDeps());
    }

    function _planMovePlaybackPhase(phaseState: any, ev: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.planMovePlaybackPhase === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.planMovePlaybackPhase(phaseState, ev, getPipelineUIBoardEventPlaybackDeps());
    }

    function _orderDeferredSpawnsForPlayback(presEvents: any) {
        if (!(PipelineUIBoardEventPlaybackModule && typeof PipelineUIBoardEventPlaybackModule.orderDeferredSpawnsForPlayback === 'function')) {
            throw new Error('PipelineUIAdapter board event playback module unavailable');
        }
        return PipelineUIBoardEventPlaybackModule.orderDeferredSpawnsForPlayback(presEvents, getPipelineUIBoardEventPlaybackDeps());
    }

    function _populatePlaybackEventAfterState(pEvent: any, ev: any, finalCardState: any, finalGameState: any) {
        if (!(PipelineUIPlaybackAfterStateModule && typeof PipelineUIPlaybackAfterStateModule.populatePlaybackEventAfterState === 'function')) {
            throw new Error('PipelineUIAdapter playback after-state module unavailable');
        }
        return PipelineUIPlaybackAfterStateModule.populatePlaybackEventAfterState(
            pEvent,
            ev,
            finalCardState,
            finalGameState,
            getPipelineUIPlaybackAfterStateDeps()
        );
    }

    function _mapPassivePresentationEvent(ctx: any, presentationEventIndex: any) {
        if (!(PipelineUIPassiveEventPlaybackModule && typeof PipelineUIPassiveEventPlaybackModule.mapPassivePresentationEvent === 'function')) {
            throw new Error('PipelineUIAdapter passive event playback module unavailable');
        }
        return PipelineUIPassiveEventPlaybackModule.mapPassivePresentationEvent(
            ctx,
            getPipelineUIPassiveEventPlaybackDeps(presentationEventIndex)
        );
    }

    function getPipelineUIBoardEventMapperDeps() {
        return {
            clonePlaybackEventWithPhase: _clonePlaybackEventWithPhase,
            phaseNum: _phaseNum,
            planSpawnPlayback: _planSpawnPlayback,
            planDestroyPlayback: _planDestroyPlayback,
            planChangePlaybackPhase: _planChangePlaybackPhase,
            findExtremeForcedSwapMovePairPresentationIndex: _findExtremeForcedSwapMovePairPresentationIndex,
            planMovePlaybackPhase: _planMovePlaybackPhase,
            createExtremeForcedSwapPlaybackEvent: _createExtremeForcedSwapPlaybackEvent,
            clearChainFlipPhaseState: _clearChainFlipPhaseState
        };
    }

    function _mapBoardPresentationEvent(ctx: any) {
        if (!(PipelineUIBoardEventMapperModule && typeof PipelineUIBoardEventMapperModule.mapBoardPresentationEvent === 'function')) {
            throw new Error('PipelineUIAdapter board event mapper module unavailable');
        }
        return PipelineUIBoardEventMapperModule.mapBoardPresentationEvent(
            ctx,
            getPipelineUIBoardEventMapperDeps()
        );
    }

    /**
     * Converts presentation events (BoardOps output) into PlaybackEvents.
     * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
     */
    function mapToPlaybackEvents(presEvents: any, finalCardState: any, finalGameState: any, options?: any) {
        if (!(PlaybackPlanner && typeof PlaybackPlanner.planPlaybackEvents === 'function')) {
            throw new Error('PipelineUIAdapter playback planner module unavailable');
        }
        if (!(PipelineUIPresentationEventIndexModule && typeof PipelineUIPresentationEventIndexModule.createPresentationEventIndex === 'function')) {
            throw new Error('PipelineUIAdapter presentation event index module unavailable');
        }
        const orderedPresentationEvents = _orderDeferredSpawnsForPlayback(Array.isArray(presEvents) ? presEvents : []);
        const opts = options && typeof options === 'object' ? options : {};
        const presentationEventIndex = PipelineUIPresentationEventIndexModule.createPresentationEventIndex(
            orderedPresentationEvents,
            { perfCounters: opts.perfCounters }
        );
        return PlaybackPlanner.planPlaybackEvents(orderedPresentationEvents, finalCardState, finalGameState, {
            createPlaybackPhaseState: _createPlaybackPhaseState,
            createPlaybackEventBase: _createPlaybackEventBase,
            createPlaybackEvent: _createPlaybackEvent,
            mapPassivePresentationEvent: (ctx: any) => _mapPassivePresentationEvent(ctx, presentationEventIndex),
            mapBoardPresentationEvent: _mapBoardPresentationEvent,
            isDeferredSpawnPresentationEvent: _isDeferredSpawnPresentationEvent,
            // NOTE: Do not populate 'after' using a final snapshot. Adapter remains a thin transform.
            // The after-state module derives minimal per-target visual state from the event payload
            // and final visual markers only when status events need that lookup.
            populatePlaybackEventAfterState: _populatePlaybackEventAfterState,
            postProcessPlaybackEvents: (playbackEvents: any[]) => {
                const generatedThrowChainSplit = _extractGeneratedThrowChainPlayback(playbackEvents);
                return _appendGeneratedThrowChainPlayback(generatedThrowChainSplit.immediateEvents, generatedThrowChainSplit.deferredEvents);
            }
        });
    }

    function getPipelineUIPlaybackUtilsOptions() {
        return { generatedThrowChainReason: GENERATED_THROW_CHAIN_REASON };
    }

    function _phaseNum(v: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.phaseNum === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.phaseNum(v);
    }

    function _getPrimaryPlaybackTarget(ev: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.getPrimaryPlaybackTarget === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.getPrimaryPlaybackTarget(ev);
    }

    function _clonePlaybackTarget(target: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.clonePlaybackTarget === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.clonePlaybackTarget(target);
    }

    function _clonePlaybackEventWithPhase(ev: any, phase: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.clonePlaybackEventWithPhase === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.clonePlaybackEventWithPhase(ev, phase);
    }

    function _extractGeneratedThrowChainPlayback(playbackEvents: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.extractGeneratedThrowChainPlayback === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.extractGeneratedThrowChainPlayback(playbackEvents, getPipelineUIPlaybackUtilsOptions());
    }

    function _appendGeneratedThrowChainPlayback(playbackEvents: any, deferredEvents: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.appendGeneratedThrowChainPlayback === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.appendGeneratedThrowChainPlayback(playbackEvents, deferredEvents);
    }

    function _processGeneratedThrowChainPlayback(playbackEvents: any, action: any, playerKey: any) {
        if (!(PipelineUIGeneratedThrowChainPlaybackModule && typeof PipelineUIGeneratedThrowChainPlaybackModule.processGeneratedThrowChainPlayback === 'function')) {
            throw new Error('PipelineUIAdapter generated throw-chain module unavailable');
        }
        return PipelineUIGeneratedThrowChainPlaybackModule.processGeneratedThrowChainPlayback(
            playbackEvents,
            action,
            playerKey,
            deferredGeneratedThrowChainPlaybackByPlayer,
            getPipelineUIGeneratedThrowChainPlaybackDeps()
        );
    }

    function _maxPhase(playbackEvents: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.maxPhase === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.maxPhase(playbackEvents);
    }

    function _findPhase(playbackEvents: any, predicate: any, fallbackPhase: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.findPhase === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.findPhase(playbackEvents, predicate, fallbackPhase);
    }

    function _rawDetailCount(ev: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.rawDetailCount === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.rawDetailCount(ev);
    }

    function _hasRawEvent(rawEvents: any, type: any, predicate?: any) {
        if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.hasRawEvent === 'function')) {
            throw new Error('PipelineUIAdapter playback utils module unavailable');
        }
        return PipelineUIPlaybackUtilsModule.hasRawEvent(rawEvents, type, predicate);
    }

    function normalizePlaybackEvents(playbackEvents: any, _unused?: any) {
        return Array.isArray(playbackEvents) ? playbackEvents : [];
    }

    function _isDestroyWithCause(target: any, causes: any) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        return causes.has(cause);
    }

    function _getMoveIntent(target: any) {
        return String(target && target.meta && target.meta.moveIntent ? target.meta.moveIntent : '').toLowerCase();
    }

    function _isHyperactiveMoveTarget(target: any) {
        const moveIntent = _getMoveIntent(target);
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        if (
            cause === 'WILL_HUNTER_KING' ||
            reason.indexOf('will_hunter_king_slash_move') === 0
        ) return false;
        if (moveIntent === 'hyperactive_move' || moveIntent === 'evade_move') return true;
        const isFlipEvadeMove = reason.indexOf('flip_evade_move') >= 0;
        const isDestroyEvadeMove =
            cause === 'DESTROY_EVADE' ||
            reason.indexOf('destroy_evade_move') === 0;
        return (
            cause === 'HYPERACTIVE' ||
            cause === 'AFTERIMAGE_WILL' ||
            cause === 'ESCAPE_HYPERACTIVE' ||
            cause === 'EXTREME_HYPERACTIVE_WILL' ||
            cause === 'GLUTTONOUS_WILL' ||
            cause === 'ULTIMATE_HYPERACTIVE' ||
            cause === 'ULTIMATE_HYPERACTIVE_GOD' ||
            cause === 'ROBOT_VACUUM' ||
            cause === 'ZOMBIE' ||
            isFlipEvadeMove ||
            isDestroyEvadeMove ||
            reason.indexOf('hyperactive') >= 0 ||
            reason.indexOf('gluttonous') >= 0
        );
    }

    function _isUltimateAnchorMoveTarget(target: any) {
        const moveIntent = _getMoveIntent(target);
        if (moveIntent === 'anchor_move') return true;
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            cause === 'ULTIMATE_REVERSE_DRAGON' ||
            cause === 'ULTIMATE_DESTROY_GOD' ||
            cause === 'WILL_HUNTER_KING' ||
            reason.indexOf('ultimate_reverse_dragon_move') === 0 ||
            reason.indexOf('ultimate_destroy_god_move') === 0 ||
            reason.indexOf('will_hunter_king_slash_move') === 0
        );
    }

    function _isSuperCrushMoveTarget(target: any) {
        const moveIntent = _getMoveIntent(target);
        if (moveIntent === 'crush_move') return true;
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            SUPER_CRUSH_CAUSES.has(cause) ||
            reason.indexOf('super_buoyancy_move') === 0 ||
            reason.indexOf('super_gravity_move') === 0 ||
            reason.indexOf('super_attraction_move') === 0
        );
    }

    function _isSpecialDurationExpiredDestroyTarget(target: any) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        const special = String(target && target.meta && target.meta.special ? target.meta.special : '').toUpperCase();
        const isDurationEnd = _hasDurationEndMarker(reason);
        if (!isDurationEnd) return false;
        if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
        if (BOMB_DESTROY_CAUSES.has(cause)) return false;
        return SPECIAL_DURATION_EXPIRE_CAUSES.has(cause) || !!special;
    }

    function _isSpecialDurationExpiredDestroyEvent(ev: any) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t: any) => _isSpecialDurationExpiredDestroyTarget(t)));
    }

    function _hasDurationEndMarker(reason: any, cause?: any) {
        const reasonLower = String(reason || '').toLowerCase();
        const causeLower = String(cause || '').toLowerCase();
        return (
            reasonLower === 'duration_end' ||
            reasonLower === 'no_candidates_revert' ||
            reasonLower.indexOf('duration') >= 0 ||
            reasonLower.indexOf('expire') >= 0 ||
            causeLower.indexOf('expire') >= 0
        );
    }

    function _isSpecialDurationExpiredStatusRemovedEvent(ev: any) {
        if (!ev || String(ev.type || '').toLowerCase() !== 'status_removed') return false;
        const special = String(ev.meta && ev.meta.special ? ev.meta.special : '').toUpperCase();
        if (!SPECIAL_DURATION_REVERT_SPECIALS.has(special)) return false;
        const reason = String((ev.meta && ev.meta.reason) || ev.reason || '').toLowerCase();
        if (!_hasDurationEndMarker(reason)) return false;
        if (special === 'TRAP' || special === 'TRAP_REVEAL') return false;
        return true;
    }

    function _isSpecialDurationExpiredPlaybackEvent(ev: any) {
        return _isSpecialDurationExpiredDestroyEvent(ev) || _isSpecialDurationExpiredStatusRemovedEvent(ev);
    }

    function _matchesCauseReasonProfile(subject: any, profile: any) {
        return PresentationEffectProfiles.matchesCauseReasonProfile(subject, profile);
    }

    function _isSniperShotDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).sniperShot);
    }

    function _isLightningDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).lightningDestroyed);
    }

    function _isUltimateDestroyGodDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).udgDestroyed);
    }

    function _isDestroyDragonBreathDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).destroyDragonBreath);
    }

    function _isRobotVacuumSuckDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).robotVacuumSuck);
    }

    function _isGluttonousEatDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).gluttonousEat);
    }

    function _isWillHunterKingSlashDestroyTarget(target: any) {
        return _matchesCauseReasonProfile(target, (SPECIAL_DESTROY_TARGET_PROFILES as any).willHunterKingSlash);
    }

    function _isBoardShrinkDestroyTarget(target: any) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'BOARD_SHRINK_WILL' ||
            cause === 'BOARD_SHRINK_GOD' ||
            reason.indexOf('board_shrink') >= 0;
    }

    function _isGoldSilverSelfDestroyTarget(target: any) {
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return reason === 'gold_stone_sacrifice' || reason === 'rainbow_stone_sacrifice' || reason === 'silver_stone_sacrifice';
    }

    function _isGoldSilverSelfDestroyEvent(ev: any) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t: any) => _isGoldSilverSelfDestroyTarget(t)));
    }

    function _isWorkDurationExpiredPresentationEvent(ev: any) {
        if (!ev || !ev.type) return false;
        if (ev.type === 'WORK_INCOME') {
            if (ev.removed !== true) return false;
            const reasonIncome = String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase();
            const causeIncome = String(ev.cause || '').toLowerCase();
            if (!reasonIncome && !causeIncome) return true;
            return _hasDurationEndMarker(reasonIncome, causeIncome);
        }
        if (ev.type !== 'WORK_REMOVED') return false;
        const cause = String(ev.cause || '').toLowerCase();
        const reason = String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase();
        return _hasDurationEndMarker(reason, cause);
    }

    function _isWorkFlipOrDestroyRemovedPresentationEvent(ev: any) {
        if (!ev || ev.type !== 'WORK_REMOVED') return false;
        if (ev.removed === false) return false;
        if (_isWorkDurationExpiredPresentationEvent(ev)) return false;
        return true;
    }

    function _isChaosSummonCardUsePlaybackEvent(ev: any) {
        if (!ev || ev.type !== 'card_use_animation' || !Array.isArray(ev.targets)) return false;
        return ev.targets.some((target: any) => {
            const cardId = String(target && target.cardId ? target.cardId : '').trim().toLowerCase();
            const cardType = String(target && target.cardType ? target.cardType : '').trim().toUpperCase();
            const name = String(target && target.name ? target.name : '').trim();
            return cardType === 'CHAOS_SUMMON' || cardId === 'chaos_summon_01' || name === '混沌召喚';
        });
    }

    function _isChaosSummonRoulettePlaybackEvent(ev: any) {
        if (!ev || ev.type !== 'theory_incarnation_spawn_roulette' || !Array.isArray(ev.targets)) return false;
        return ev.targets.some((target: any) => {
            const cause = String(target && (target.cause || target.spawnCause) ? (target.cause || target.spawnCause) : '').trim().toUpperCase();
            const reason = String(target && (target.reason || target.spawnReason) ? (target.reason || target.spawnReason) : '').trim().toLowerCase();
            const sourceCardType = String(target && target.sourceCardType ? target.sourceCardType : '').trim().toUpperCase();
            return cause === 'CHAOS_SUMMON' || reason === 'chaos_summon_spawn' || sourceCardType === 'CHAOS_SUMMON';
        });
    }

    function _readPlaybackTargetRow(target: any) {
        const row = Number(target && (target.row ?? target.r));
        return Number.isInteger(row) ? row : null;
    }

    function _readPlaybackTargetCol(target: any) {
        const col = Number(target && target.col);
        return Number.isInteger(col) ? col : null;
    }

    function _targetMatchesPlaybackCell(target: any, cell: any) {
        if (!cell) return false;
        return _readPlaybackTargetRow(target) === cell.row && _readPlaybackTargetCol(target) === cell.col;
    }

    function _collectChaosSummonRouletteCells(playbackEvents: any) {
        const cells: any[] = [];
        if (!Array.isArray(playbackEvents)) return cells;
        for (const ev of playbackEvents) {
            if (!_isChaosSummonRoulettePlaybackEvent(ev)) continue;
            const phase = _phaseNum(ev && ev.phase);
            if (!Number.isFinite(phase)) continue;
            for (const target of (Array.isArray(ev.targets) ? ev.targets : [])) {
                const row = _readPlaybackTargetRow(target);
                const col = _readPlaybackTargetCol(target);
                if (row === null || col === null) continue;
                cells.push({ row, col, phase });
            }
        }
        return cells;
    }

    function _alignChaosSummonCardUseBeforeRoulette(playbackEvents: any) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return [];
        const rouletteCells = _collectChaosSummonRouletteCells(playbackEvents);
        const roulettePhases = rouletteCells.map((cell: any) => cell.phase);
        if (roulettePhases.length <= 0) return playbackEvents;
        const firstRoulettePhase = Math.min(...roulettePhases);
        if (!Number.isFinite(firstRoulettePhase) || firstRoulettePhase <= 1) return playbackEvents;
        const cardUsePhase = firstRoulettePhase - 1;
        let changed = false;
        const aligned = playbackEvents.map((ev: any) => {
            if (ev && ev.type === 'status_applied') {
                const phase = _phaseNum(ev && ev.phase);
                const matchingCell = rouletteCells.find((cell: any) => (
                    Number.isFinite(phase) &&
                    phase === cell.phase &&
                    Array.isArray(ev.targets) &&
                    ev.targets.some((target: any) => _targetMatchesPlaybackCell(target, cell))
                ));
                if (matchingCell) {
                    changed = true;
                    return _clonePlaybackEventWithPhase(ev, matchingCell.phase + 1);
                }
                return ev;
            }
            if (!_isChaosSummonCardUsePlaybackEvent(ev)) return ev;
            const phase = _phaseNum(ev && ev.phase);
            if (Number.isFinite(phase) && phase < firstRoulettePhase) return ev;
            changed = true;
            return _clonePlaybackEventWithPhase(ev, cardUsePhase);
        });
        return changed ? aligned : playbackEvents;
    }

    function getPipelineUISoundCueAssemblerDeps() {
        return {
            bombDestroyCauses: BOMB_DESTROY_CAUSES,
            cardEffectFlipSoundKey: CARD_EFFECT_FLIP_SOUND_KEY,
            ultimateAnchorMoveSoundKey: ULTIMATE_ANCHOR_MOVE_SOUND_KEY,
            cardEffectSpawnProfiles: CARD_EFFECT_SPAWN_PROFILES,
            soundEventType: SOUND_EVENT_TYPE,
            maxPhase: _maxPhase,
            phaseNum: _phaseNum,
            clonePlaybackEventWithPhase: _clonePlaybackEventWithPhase,
            findPhase: _findPhase,
            rawDetailCount: _rawDetailCount,
            hasRawEvent: _hasRawEvent,
            countCardEffectFlipFallbackEvents: _countCardEffectFlipFallbackEvents,
            isCardEffectSpawnEventLike: _isCardEffectSpawnEventLike,
            isCardEffectSpawnPlaybackEvent: _isCardEffectSpawnPlaybackEvent,
            isCardEffectFlipPresentationEvent,
            isDestroyWithCause: _isDestroyWithCause,
            isHyperactiveMoveTarget: _isHyperactiveMoveTarget,
            isLivingWillRestoreEventLike: _isLivingWillRestoreEventLike,
            isSeedSproutEventLike: _isSeedSproutEventLike,
            isSpecialDurationExpiredPlaybackEvent: _isSpecialDurationExpiredPlaybackEvent,
            isUltimateAnchorMoveTarget: _isUltimateAnchorMoveTarget,
            getMoveIntent: _getMoveIntent,
            isBoardShrinkDestroyTarget: _isBoardShrinkDestroyTarget,
            isSuperCrushMoveTarget: _isSuperCrushMoveTarget,
            isWorkFlipOrDestroyRemovedPresentationEvent: _isWorkFlipOrDestroyRemovedPresentationEvent,
            isDestroyDragonBreathDestroyTarget: _isDestroyDragonBreathDestroyTarget,
            isDestroyRemovalOutcome: _isDestroyRemovalOutcome,
            isGluttonousEatDestroyTarget: _isGluttonousEatDestroyTarget,
            isGoldSilverSelfDestroyEvent: _isGoldSilverSelfDestroyEvent,
            isGoldSilverSelfDestroyTarget: _isGoldSilverSelfDestroyTarget,
            isLightningDestroyTarget: _isLightningDestroyTarget,
            isRobotVacuumSuckDestroyTarget: _isRobotVacuumSuckDestroyTarget,
            isSniperShotDestroyTarget: _isSniperShotDestroyTarget,
            isSpecialDurationExpiredDestroyTarget: _isSpecialDurationExpiredDestroyTarget,
            isUltimateDestroyGodDestroyTarget: _isUltimateDestroyGodDestroyTarget,
            isWillHunterKingSlashDestroyTarget: _isWillHunterKingSlashDestroyTarget
        };
    }

    function appendSoundEffectPlaybackEvents(playbackEvents: any, rawEvents: any, presentationEvents: any) {
        if (!(PipelineUISoundCueAssemblerModule && typeof PipelineUISoundCueAssemblerModule.appendSoundEffectPlaybackEvents === 'function')) {
            throw new Error('PipelineUIAdapter sound cue assembler module unavailable');
        }
        const phaseAlignedPlaybackEvents = _alignChaosSummonCardUseBeforeRoulette(playbackEvents);
        return PipelineUISoundCueAssemblerModule.appendSoundEffectPlaybackEvents(
            phaseAlignedPlaybackEvents,
            rawEvents,
            presentationEvents,
            getPipelineUISoundCueAssemblerDeps()
        );
    }

    function _normalizePlayerKey(v: any) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(v);
            if (normalized) return normalized;
        }
        if (v === 'black' || v === 1 || v === '1') return 'black';
        if (v === 'white' || v === -1 || v === '-1') return 'white';
        return null;
    }

    function getPipelineUILogMapperDeps() {
        return {
            SharedBoardUtils,
            SpecialStoneRegistry,
            OwnerHelpersModule,
            formatMultiPlaceActivationLog: _formatMultiPlaceActivationLog,
            formatMultiPlaceConsumedLog: _formatMultiPlaceConsumedLog,
            isWorkDurationExpiredPresentationEvent: _isWorkDurationExpiredPresentationEvent
        };
    }

    function mapEffectLogsFromPipeline(rawEvents: any, presEvents: any, playerKey: any) {
        if (!(PipelineUILogMappersModule && typeof PipelineUILogMappersModule.mapEffectLogsFromPipeline === 'function')) {
            throw new Error('PipelineUIAdapter log mapper module unavailable');
        }
        return PipelineUILogMappersModule.mapEffectLogsFromPipeline(
            rawEvents,
            presEvents,
            playerKey,
            getPipelineUILogMapperDeps()
        );
    }

    function mapNormalLogsFromPipeline(rawEvents: any, playerKey: any) {
        if (!(PipelineUILogMappersModule && typeof PipelineUILogMappersModule.mapNormalLogsFromPipeline === 'function')) {
            throw new Error('PipelineUIAdapter log mapper module unavailable');
        }
        return PipelineUILogMappersModule.mapNormalLogsFromPipeline(rawEvents, playerKey);
    }

    /**


     * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
     */
    function runTurnWithAdapter(cardState: any, gameState: any, playerKey: any, action: any, turnPipeline: any) {
        if (!turnPipeline) throw new Error('TurnPipeline not available');
        const suppressUiLogs = !!(action && action.__suppressUiLogs === true);

        // Build options for applyTurnSafe: include current state version and previous action ids if ActionManager is available
        const options: Record<string, any> = { skipTurnStart: !(action && action.__skipTurnStart === false) };
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            try {
                if (typeof ActionManager.ActionManager.getRecentActionIds === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getRecentActionIds(200);
                } else if (typeof ActionManager.ActionManager.getActions === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getActions().map((a: any) => a.actionId).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
        }
        if (cardState && typeof cardState.turnIndex === 'number') {
            options.currentStateVersion = cardState.turnIndex;
        }

        // Attempt to pass the current game PRNG when injected by the UI runtime.
        const runtimePrng = resolvePipelineRuntimePrng(cardState);
        const result = (typeof turnPipeline.applyTurnSafe === 'function')
            ? turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action, runtimePrng, options)
            : turnPipeline.applyTurn(cardState, gameState, playerKey, action, runtimePrng, options);

        if (result.ok === false) {
            return { ok: false, rejectedReason: result.rejectedReason || 'UNKNOWN', events: result.events };
        }

        // Keep fallback order aligned with worker runtime so parity tests and network playback stay consistent.
        const pres = (
            Array.isArray(result.presentationEvents) && result.presentationEvents.length > 0
                ? result.presentationEvents
                : (
                    Array.isArray(result.cardState && result.cardState.presentationEvents) && result.cardState.presentationEvents.length > 0
                        ? result.cardState.presentationEvents
                        : (
                            Array.isArray(result.cardState && result.cardState._presentationEventsPersist)
                                ? result.cardState._presentationEventsPersist
                                : []
                        )
                )
        );
        const assembledPlayback = (PlaybackEventHelpers && typeof PlaybackEventHelpers.assemblePlaybackEvents === 'function')
            ? PlaybackEventHelpers.assemblePlaybackEvents({
                rawEvents: result.events,
                presentationEvents: pres,
                snapshot: {
                    cardState: result.cardState,
                    gameState: result.gameState
                },
                fallbackPlayerKey: playerKey,
                adapter: {
                    mapToPlaybackEvents,
                    normalizePlaybackEvents,
                    appendSoundEffectPlaybackEvents
                },
                normalizePlayerKey: _normalizePlayerKey
            })
            : {
                playbackEvents: appendSoundEffectPlaybackEvents(
                    normalizePlaybackEvents(
                        ((PlaybackEventHelpers && typeof PlaybackEventHelpers.mapRawPlaceEventsToPlayback === 'function')
                            ? PlaybackEventHelpers.mapRawPlaceEventsToPlayback(result.events, {
                                fallbackPlayerKey: playerKey,
                                fallbackTurnIndex: result.cardState && typeof result.cardState.turnIndex === 'number' ? result.cardState.turnIndex : 0,
                                normalizePlayerKey: _normalizePlayerKey
                            })
                            : []).concat(mapToPlaybackEvents(pres, result.cardState, result.gameState)),
                        result.events
                    ),
                    result.events,
                    pres
                ),
                diagnostics: null
            };
        let playbackWithSound = assembledPlayback.playbackEvents;
        const deferredGeneratedThrowChainPlayback = _processGeneratedThrowChainPlayback(playbackWithSound, action, playerKey);
        playbackWithSound = deferredGeneratedThrowChainPlayback.playbackEvents;

        const effectLogMessages = mapEffectLogsFromPipeline(result.events, pres, playerKey);
        const normalLogMessages = mapNormalLogsFromPipeline(result.events, playerKey);
        if (!suppressUiLogs) {
            try {
                for (const msg of effectLogMessages) emitPipelineEffectLog(msg);
                for (const msg of normalLogMessages) emitPipelineNormalLog(msg);
            } catch (e) { /* ignore */ }
        }

        return {
            ok: true,
            nextCardState: result.cardState,
            nextGameState: result.gameState,
            playbackEvents: playbackWithSound,
            playbackDiagnostics: assembledPlayback.diagnostics,
            deferredGeneratedThrowChainHandAdd: deferredGeneratedThrowChainPlayback.deferredGeneratedThrowChainHandAdd,
            rawEvents: result.events,
            presentationEvents: pres,
            effectLogMessages
        };
    }

export = { mapToPlaybackEvents, normalizePlaybackEvents, appendSoundEffectPlaybackEvents, mapEffectLogsFromPipeline, mapNormalLogsFromPipeline, clearDeferredGeneratedThrowChainPlayback, runTurnWithAdapter, setPipelineUIAdapterRuntime };
