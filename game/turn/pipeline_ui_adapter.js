/**
 * @file pipeline_ui_adapter.js
 * @description Bridge TurnPipeline event log -> browser UI via Canonical Playback Events.
 * aligns with 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelineUIAdapter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    const OwnerHelpersModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../utils/owner-helpers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.OwnerHelpers || null;
    })();
    const SharedBoardUtils = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/shared-board-utils');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.SharedBoardUtils || null;
    })();
    const PlaybackEventHelpers = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/playback-event-helpers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.PlaybackEventHelpers || null;
    })();
    const DestroyOutcomeContract = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/destroy-outcome-contract');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.DestroyOutcomeContract || null;
    })();
    const SpecialStoneRegistry = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/special-stone-registry');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.SpecialStoneRegistry || null;
    })();
    const StoneStatusSnapshot = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/stone-status-snapshot');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.StoneStatusSnapshot || null;
    })();

    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const REGEN_CONSUMED_REASON = 'regen_consumed';
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });
    const BATCH_DESTROY_CAUSES = new Set(['TIME_BOMB', 'ULTIMATE_DESTROY_GOD', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE']);
    const BOMB_DESTROY_CAUSES = new Set(['TIME_BOMB', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE']);
    const SUPER_CRUSH_CAUSES = new Set(['SUPER_BUOYANCY_WILL', 'SUPER_GRAVITY_WILL']);
    const SPECIAL_DURATION_EXPIRE_CAUSES = new Set([
        'SNIPER_WILL',
        'LIGHTNING_WILL',
        'DESTROY_DRAGON',
        'DRAGON',
        'BREEDING',
        'ROBOT_VACUUM',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'TIME_STOP',
        'TRAP_WILL'
    ]);
    const SPECIAL_DURATION_REVERT_SPECIALS = new Set([
        'BREEDING',
        'DESTROY_DRAGON',
        'DRAGON',
        'GHOST',
        'INHERITED_HYPERACTIVE',
        'LIGHTNING',
        'OBSERVER',
        'ROBOT_VACUUM',
        'SNIPER',
        'TIME_STOP',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE',
        'WILL_HUNTER_KING',
        'WORK'
    ]);
    const SOUND_EVENT_TYPE = 'sound_effect';
    const CARD_EFFECT_FLIP_SOUND_KEY = 'card_effect_flip';
    const ULTIMATE_ANCHOR_MOVE_SOUND_KEY = 'ultimate_anchor_move';
    const CARD_EFFECT_FLIP_RAW_EVENT_TYPES = new Set([
        'dragon_converted_start',
        'dragon_converted_immediate',
        'chain_flipped',
        'taboo_reverse_flipped',
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
    const WORK_LOST_BUBBLE_TEXT = 'あああああああああああああ';
    const WORK_INCOME_BUBBLE_TEXT_BY_STEP = Object.freeze({
        1: '布石＋1 初儲けや！',
        2: '布石＋2 もっと掘るでー！',
        3: '布石＋4 順調やな！',
        4: '布石＋8 ぼろ儲けや！',
        5: '布石＋16 これで家族が養える...！'
    });
    const MULTI_PLACE_LABEL_BY_TYPE = Object.freeze({
        DOUBLE_PLACE: '二連投石',
        TRIPLE_PLACE: '三連投石',
        QUAD_PLACE: '四連投石',
        INFINITE_PLACE: '無限投石',
        LAST_RESORT: '最後の切り札'
    });
    const deferredGeneratedThrowChainPlaybackByPlayer = {
        black: [],
        white: []
    };

    function _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey) {
        if (ownerKey !== 'black' && ownerKey !== 'white') return;
        deferredGeneratedThrowChainPlaybackByPlayer[ownerKey] = [];
    }

    function clearDeferredGeneratedThrowChainPlayback(playerKey) {
        const ownerKey = _normalizePlayerKey(playerKey);
        if (ownerKey) {
            _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey);
            return;
        }
        _clearDeferredGeneratedThrowChainPlaybackForPlayer('black');
        _clearDeferredGeneratedThrowChainPlaybackForPlayer('white');
    }

    function _getMultiPlaceLabel(type, fallbackLabel) {
        const fallback = String(fallbackLabel || '').trim();
        if (fallback) return fallback;
        const key = String(type || '').toUpperCase();
        return MULTI_PLACE_LABEL_BY_TYPE[key] || '追加配置';
    }

    function _formatMultiPlaceActivationLog(effects) {
        const label = _getMultiPlaceLabel(effects && effects.multiPlaceActivatedType, effects && effects.multiPlaceActivatedName);
        if (effects && effects.multiPlaceInfinite) {
            return `${label}: 合法手が尽きるまで連続配置`;
        }
        const remaining = Number.isFinite(Number(effects && effects.multiPlaceRemaining))
            ? Math.max(0, Math.trunc(Number(effects.multiPlaceRemaining)))
            : 1;
        return `${label}: あと${remaining}回置ける`;
    }

    function _formatMultiPlaceConsumedLog(ev) {
        const label = _getMultiPlaceLabel(ev && ev.sourceType, null);
        const remaining = Number.isFinite(Number(ev && ev.remaining))
            ? Math.max(0, Math.trunc(Number(ev.remaining)))
            : null;
        if (remaining !== null && remaining > 0) {
            return `${label}: 追加手を消費（あと${remaining}回）`;
        }
        return `${label}: 追加手を消費`;
    }

    function _inferWorkIncomeStepByGain(gained) {
        const g = Number(gained) || 0;
        if (g >= 16) return 5;
        if (g >= 8) return 4;
        if (g >= 4) return 3;
        if (g >= 2) return 2;
        if (g >= 1) return 1;
        return null;
    }

    function _resolveWorkIncomeBubbleText(ev) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;

        const rawStep = Number.isFinite(Number(ev && ev.incomeStep))
            ? Number(ev.incomeStep)
            : (Number.isFinite(Number(ev && ev.meta && ev.meta.incomeStep))
                ? Number(ev.meta.incomeStep)
                : _inferWorkIncomeStepByGain(ev && ev.gained));
        const step = Number.isFinite(rawStep) ? Math.max(1, Math.min(5, Math.trunc(rawStep))) : null;
        if (step && WORK_INCOME_BUBBLE_TEXT_BY_STEP[step]) return WORK_INCOME_BUBBLE_TEXT_BY_STEP[step];

        return WORK_INCOME_BUBBLE_TEXT_BY_STEP[1];
    }

    function _resolveWorkRemovedBubbleText(ev) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;
        return WORK_LOST_BUBBLE_TEXT;
    }

    function isRegenTriggeredChange(ev) {
        return !!(ev && ev.cause === REGEN_CAUSE && ev.reason === REGEN_TRIGGER_REASON);
    }

    function isRegenConsumedStatus(ev) {
        return !!(ev && ev.meta && ev.meta.special === REGEN_CAUSE && ev.meta.reason === REGEN_CONSUMED_REASON);
    }

    function isChainFlipPresentationEvent(ev) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        const cause = String(ev.cause || '').toUpperCase();
        return reason === 'chain_flip' || cause === 'CHAIN_WILL';
    }

    function isCardEffectFlipPresentationEvent(ev) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        return isChainFlipPresentationEvent(ev) ||
            reason.indexOf('dragon_convert') === 0 ||
            reason.indexOf('taboo_reverse_flip') === 0 ||
            reason.indexOf('regen_triggered') === 0 ||
            reason.indexOf('regen_capture_flip') === 0 ||
            reason.indexOf('equality_will_flip') === 0 ||
            reason.indexOf('reinforcement_will_flip') === 0 ||
            reason.indexOf('salvation_flip') === 0 ||
            reason.indexOf('breeding_flip') === 0 ||
            reason.indexOf('hyperactive_flip') === 0 ||
            reason.indexOf('escape_hyperactive_flip') === 0 ||
            reason.indexOf('inherited_hyperactive_flip') === 0 ||
            reason.indexOf('extreme_hyperactive_flip') === 0 ||
            reason.indexOf('ultimate_hyperactive_flip') === 0 ||
            reason.indexOf('robot_vacuum_flip') === 0 ||
            reason.indexOf('swap_with_enemy') === 0 ||
            reason.indexOf('tempt_applied') === 0;
    }

    function _countCardEffectFlipFallbackEvents(rawEvents) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        return events.reduce((sum, ev) => {
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

    function getChainFlipLink(ev) {
        if (!ev || !ev.meta || !Number.isFinite(ev.meta.chainLink)) return 1;
        const link = Number(ev.meta.chainLink);
        return link >= 1 ? link : 1;
    }

    function isInheritedHyperactiveType(type) {
        return String(type || '').toUpperCase() === 'INHERITED_HYPERACTIVE';
    }

    function getVisualSpecialFromMeta(meta) {
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? null : special;
    }

    function resolveDisplayTimerValue(special, timerValue, regenRemainingValue) {
        if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveDisplayTimerValue === 'function') {
            return StoneStatusSnapshot.resolveDisplayTimerValue({
                type: special,
                timer: timerValue,
                regenRemaining: regenRemainingValue
            });
        }
        if (isInheritedHyperactiveType(special)) return null;
        const timer = toCounterOrNull(timerValue);
        if (timer !== null) return timer;
        if (String(special || '').toUpperCase() === 'REGEN') {
            return toCounterOrNull(regenRemainingValue);
        }
        return null;
    }

    function getPrimaryTimerFromMeta(meta) {
        const special = (meta && meta.special) || null;
        return resolveDisplayTimerValue(special, meta && meta.timer, meta && meta.regenRemaining);
    }

    function getInheritedTimerFromMeta(meta) {
        const inheritedTimer = (meta && meta.inheritedTimer) || null;
        if (inheritedTimer !== null && inheritedTimer !== undefined) return inheritedTimer;
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? ((meta && meta.timer) || null) : null;
    }

    function getInheritedOwnerFromMeta(meta) {
        const inheritedOwner = (meta && meta.inheritedOwner) || null;
        if (inheritedOwner !== null && inheritedOwner !== undefined) return inheritedOwner;
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? ((meta && meta.owner) || null) : null;
    }

    function toCounterOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function getFlipEvadeRemainingFromMeta(meta) {
        return toCounterOrNull(meta && meta.flipEvadeRemaining);
    }

    function getInheritedFlipEvadeRemainingFromMeta(meta) {
        const inherited = toCounterOrNull(meta && meta.inheritedFlipEvadeRemaining);
        if (inherited !== null) return inherited;
        const special = (meta && meta.special) || null;
        if (isInheritedHyperactiveType(special)) {
            return getFlipEvadeRemainingFromMeta(meta);
        }
        return null;
    }

    function getDestroyEvadeRemainingFromMeta(meta) {
        return toCounterOrNull(meta && meta.destroyEvadeRemaining);
    }

    function isMainBoardCell(r, c) {
        return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    function getExpansionColorAt(gameState, r, c) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return 0;

        const cells = (Array.isArray(expansion.cells) && expansion.cells.length > 0)
            ? expansion.cells
            : (expansion.active === true ? [expansion] : []);

        for (const cell of cells) {
            if (!cell || typeof cell !== 'object') continue;
            const row = Number.isInteger(cell.row) ? cell.row : null;
            let col = Number.isInteger(cell.col) ? cell.col : null;
            if (col === null && cell.side === 'left') col = -1;
            if (col === null && cell.side === 'right') col = 8;
            if (row !== r || col !== c) continue;
            return (cell.owner === 1 || cell.owner === -1) ? cell.owner : 0;
        }

        return 0;
    }

    function getCellColorAt(gameState, r, c) {
        if (!gameState || !Array.isArray(gameState.board)) return 0;
        if (isMainBoardCell(r, c)) {
            const boardRow = gameState.board[r];
            if (!Array.isArray(boardRow)) return 0;
            const value = boardRow[c];
            return (value === 1 || value === -1) ? value : 0;
        }
        return getExpansionColorAt(gameState, r, c);
    }

    /**
     * Helper to get visual state of a cell from game/card state.
     */
    function getVisualStateAt(r, c, cardState, gameState) {
        if (!gameState || !gameState.board) return {
            color: 0,
            special: null,
            timer: null,
            owner: null,
            inheritedTimer: null,
            inheritedOwner: null,
            flipEvadeRemaining: null,
            inheritedFlipEvadeRemaining: null,
            destroyEvadeRemaining: null
        };
        const color = getCellColorAt(gameState, r, c);
        let special = null;
        let timer = null;
        let owner = null;
        let inheritedTimer = null;
        let inheritedOwner = null;
        let flipEvadeRemaining = null;
        let inheritedFlipEvadeRemaining = null;
        let destroyEvadeRemaining = null;

        if (cardState && cardState.markers) {
            const markersAtCell = cardState.markers.filter((m) => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.row === r &&
                m.col === c
            ));
            const bombMarker = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.data && m.data.category === 'bomb' && m.row === r && m.col === c);

            if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers === 'function') {
                const visualState = StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
                    bombMarker,
                    mode: 'visual'
                });
                special = visualState.special;
                timer = visualState.timer;
                owner = visualState.owner;
                inheritedTimer = visualState.inheritedTimer;
                inheritedOwner = visualState.inheritedOwner;
                flipEvadeRemaining = visualState.flipEvadeRemaining;
                inheritedFlipEvadeRemaining = visualState.inheritedFlipEvadeRemaining;
                destroyEvadeRemaining = visualState.destroyEvadeRemaining;
            } else {
                const inherited = markersAtCell.find((m) => (
                    m &&
                    m.data &&
                    String(m.data.type || '').toUpperCase() === 'INHERITED_HYPERACTIVE'
                ));
                if (inherited) {
                    inheritedTimer = (inherited.data && Number.isFinite(Number(inherited.data.remainingOwnerTurns)))
                        ? Number(inherited.data.remainingOwnerTurns)
                        : null;
                    inheritedOwner = (inherited.owner !== undefined && inherited.owner !== null) ? inherited.owner : null;
                    inheritedFlipEvadeRemaining = toCounterOrNull(inherited.data && inherited.data.flipEvadeRemaining);
                }

                const visualSpecial = markersAtCell.find((m) => {
                    const typeUpper = String(m && m.data && m.data.type ? m.data.type : '').toUpperCase();
                    if (!typeUpper) return false;
                    if (typeUpper === 'GUARD') return false;
                    if (typeUpper === 'INHERITED_HYPERACTIVE') return false;
                    return true;
                });

                if (visualSpecial) {
                    special = (visualSpecial.data && visualSpecial.data.type) || null;
                    timer = resolveDisplayTimerValue(
                        special,
                        visualSpecial.data && visualSpecial.data.remainingOwnerTurns,
                        visualSpecial.data && visualSpecial.data.regenRemaining
                    );
                    owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
                    flipEvadeRemaining = toCounterOrNull(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
                    destroyEvadeRemaining = toCounterOrNull(visualSpecial.data && visualSpecial.data.destroyEvadeRemaining);
                    if (flipEvadeRemaining === null) {
                        const specialType = String(special || '').toUpperCase();
                        if (specialType === 'ULTIMATE_HYPERACTIVE' || specialType === 'EXTREME_HYPERACTIVE') {
                            flipEvadeRemaining = 3;
                        }
                    }
                } else if (bombMarker) {
                    special = 'TIME_BOMB';
                    timer = (bombMarker.data && bombMarker.data.remainingTurns) || null;
                    owner = (bombMarker.owner !== undefined && bombMarker.owner !== null) ? bombMarker.owner : null;
                }
            }
        }

        return {
            color,
            special,
            timer,
            owner,
            inheritedTimer,
            inheritedOwner,
            flipEvadeRemaining,
            inheritedFlipEvadeRemaining,
            destroyEvadeRemaining
        };
    }

    function _createPlaybackPhaseState() {
        return {
            currentPhase: 1,
            prevWasChainFlip: false,
            prevChainFlipLink: null,
            prevDestroyCause: null,
            durationEndRevertPhase: null,
            superCrushPhase: null,
            superCrushActionId: null,
            gluttonousEatPhase: null,
            gluttonousEatActionId: null,
            willHunterKingSlashPhase: null,
            prevWasProliferationDestroy: false
        };
    }

    function _createPlaybackEventBase(ev, finalCardState) {
        return {
            meta: ev && ev.meta ? ev.meta : null,
            rawType: ev && ev.type ? ev.type : null,
            actionId: ev && ev.actionId ? ev.actionId : null,
            turnIndex: (ev && typeof ev.turnIndex === 'number')
                ? ev.turnIndex
                : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
            plyIndex: (ev && typeof ev.plyIndex === 'number') ? ev.plyIndex : null
        };
    }

    function _createPlaybackEvent(playbackBase, type, phase, targets) {
        return Object.assign({
            type,
            phase,
            targets: Array.isArray(targets) ? targets : []
        }, playbackBase || null);
    }

    function _clearChainFlipPhaseState(phaseState) {
        phaseState.prevWasChainFlip = false;
        phaseState.prevChainFlipLink = null;
    }

    function _preparePassivePlaybackPhaseState(phaseState, options) {
        _clearChainFlipPhaseState(phaseState);
        phaseState.prevDestroyCause = null;
        if (!options || options.clearWillHunter !== false) {
            phaseState.willHunterKingSlashPhase = null;
        }
        if (!options || options.preserveDurationEndRevert !== true) {
            phaseState.durationEndRevertPhase = null;
        }
    }

    function _planDurationEndRevertPlaybackPhase(phaseState, hasPriorPlaybackEvent) {
        if (Number.isInteger(phaseState.durationEndRevertPhase)) {
            return phaseState.durationEndRevertPhase;
        }
        if (hasPriorPlaybackEvent) {
            phaseState.currentPhase++;
        }
        phaseState.durationEndRevertPhase = phaseState.currentPhase;
        return phaseState.durationEndRevertPhase;
    }

    function _clearGroupedDestroyPhaseState(phaseState) {
        phaseState.willHunterKingSlashPhase = null;
        phaseState.gluttonousEatPhase = null;
        phaseState.gluttonousEatActionId = null;
        phaseState.superCrushPhase = null;
        phaseState.superCrushActionId = null;
    }

    function _assignActionScopedPhase(phaseState, phaseField, actionIdField, actionId) {
        const hasActionMismatch =
            phaseState[phaseField] !== null &&
            phaseState[actionIdField] !== null &&
            actionId !== null &&
            phaseState[actionIdField] !== actionId;
        if (phaseState[phaseField] === null || hasActionMismatch) {
            phaseState.currentPhase++;
            phaseState[phaseField] = phaseState.currentPhase;
        }
        phaseState[actionIdField] = actionId;
        return phaseState[phaseField];
    }

    function _getDestroyOutcomeKind(meta) {
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

    function _isDestroyRemovalOutcome(target) {
        const kind = _getDestroyOutcomeKind(target && target.meta);
        return kind === null || kind === DESTROY_OUTCOME_KINDS.DESTROYED;
    }

    function _isProliferationSpawnPresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'PROLIFERATION_WILL' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('proliferation_spawn') === 0;
    }

    const CARD_EFFECT_SPAWN_PROFILES = Object.freeze([
        Object.freeze({
            cause: 'EQUALITY_WILL',
            reasonPrefix: 'equality_will_spawn',
            rawResolvedType: 'equality_will_resolved',
            soundSourceType: 'equality_will_spawn',
            phaseStartIndex: 2
        }),
        Object.freeze({
            cause: 'REINFORCEMENT_WILL',
            reasonPrefix: 'reinforcement_will_spawn',
            rawResolvedType: 'reinforcement_will_resolved',
            soundSourceType: 'reinforcement_will_spawn',
            phaseStartIndex: 1
        }),
        Object.freeze({
            cause: 'SALVATION_WILL',
            reasonPrefix: 'salvation_spawn',
            rawResolvedType: 'salvation_will_resolved',
            soundSourceType: 'salvation_spawn',
            phaseStartIndex: 1
        })
    ]);

    function _matchesSpawnCauseAndReason(subject, cause, reasonPrefix) {
        return String(subject && subject.cause ? subject.cause : '').toUpperCase() === String(cause || '').toUpperCase() &&
            String(subject && subject.reason ? subject.reason : '').toLowerCase().indexOf(String(reasonPrefix || '').toLowerCase()) === 0;
    }

    function _isCardEffectSpawnEventLike(ev, profile) {
        return !!profile && _matchesSpawnCauseAndReason(ev, profile.cause, profile.reasonPrefix);
    }

    function _isCardEffectSpawnPlaybackEvent(ev, profile) {
        return !!(
            ev &&
            ev.type === 'spawn' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target) => _isCardEffectSpawnEventLike(target, profile))
        );
    }

    function _getCardEffectSpawnProfile(ev) {
        for (const profile of CARD_EFFECT_SPAWN_PROFILES) {
            if (_isCardEffectSpawnEventLike(ev, profile)) return profile;
        }
        return null;
    }

    function _isCloneLikeSpawnPresentationEvent(ev, spawnMeta) {
        const spawnCause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
        return (
            (spawnCause === 'CLONE_WILL' || spawnCause === 'SPLIT_WILL' || spawnCause === 'PROLIFERATION_WILL') &&
            spawnMeta &&
            Number.isInteger(spawnMeta.fromRow) &&
            Number.isInteger(spawnMeta.fromCol)
        );
    }

    function _isGluttonousEatDestroyPresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'GLUTTONOUS_WILL' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('gluttonous_eat') === 0;
    }

    function _isSuperCrushDestroyPresentationEvent(ev) {
        const cause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
        const reason = String(ev && ev.reason ? ev.reason : '').toLowerCase();
        return SUPER_CRUSH_CAUSES.has(cause) &&
            (reason.indexOf('super_buoyancy_collision') === 0 || reason.indexOf('super_gravity_collision') === 0);
    }

    function _isWillHunterKingSlashDestroyPresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'WILL_HUNTER_KING' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('will_hunter_king_slash') === 0;
    }

    function _isGluttonousEatMovePresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'GLUTTONOUS_WILL' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('gluttonous_eat_move') === 0;
    }

    function _isSuperCrushMovePresentationEvent(ev) {
        const cause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
        const reason = String(ev && ev.reason ? ev.reason : '').toLowerCase();
        return SUPER_CRUSH_CAUSES.has(cause) &&
            (reason.indexOf('super_buoyancy_move') === 0 || reason.indexOf('super_gravity_move') === 0);
    }

    function _isWillHunterKingSlashMovePresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'WILL_HUNTER_KING' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('will_hunter_king_slash_move') === 0;
    }

    function _isExtremeForcedSwapMovePresentationEvent(ev) {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'EXTREME_HYPERACTIVE_WILL' &&
            String(ev && ev.reason ? ev.reason : '').toLowerCase() === 'extreme_hyperactive_forced_swap';
    }

    function _isExtremeForcedSwapMovePairPresentation(firstEv, secondEv) {
        if (!_isExtremeForcedSwapMovePresentationEvent(firstEv) || !_isExtremeForcedSwapMovePresentationEvent(secondEv)) {
            return false;
        }
        if (
            !Number.isInteger(firstEv.prevRow) ||
            !Number.isInteger(firstEv.prevCol) ||
            !Number.isInteger(firstEv.row) ||
            !Number.isInteger(firstEv.col) ||
            !Number.isInteger(secondEv.prevRow) ||
            !Number.isInteger(secondEv.prevCol) ||
            !Number.isInteger(secondEv.row) ||
            !Number.isInteger(secondEv.col)
        ) {
            return false;
        }
        if (
            firstEv.row !== secondEv.prevRow ||
            firstEv.col !== secondEv.prevCol ||
            firstEv.prevRow !== secondEv.row ||
            firstEv.prevCol !== secondEv.col
        ) {
            return false;
        }
        if (
            firstEv.actionId &&
            secondEv.actionId &&
            firstEv.actionId !== secondEv.actionId
        ) {
            return false;
        }
        return true;
    }

    function _canSkipEventBetweenExtremeForcedSwapMoves(firstEv, candidateEv) {
        const candidateType = String(candidateEv && candidateEv.type ? candidateEv.type : '').toUpperCase();
        if (
            candidateType !== 'STATUS_APPLIED' &&
            candidateType !== 'STATUS_TICK' &&
            candidateType !== 'STATUS_REMOVED'
        ) {
            return false;
        }
        if (
            firstEv &&
            firstEv.actionId &&
            candidateEv &&
            candidateEv.actionId &&
            firstEv.actionId !== candidateEv.actionId
        ) {
            return false;
        }
        return true;
    }

    function _findExtremeForcedSwapMovePairPresentationIndex(presentationEvents, firstIndex) {
        const firstEv = Array.isArray(presentationEvents) ? presentationEvents[firstIndex] : null;
        if (!_isExtremeForcedSwapMovePresentationEvent(firstEv)) return -1;
        for (let index = firstIndex + 1; index < presentationEvents.length; index += 1) {
            const candidateEv = presentationEvents[index];
            if (_isExtremeForcedSwapMovePairPresentation(firstEv, candidateEv)) {
                return index;
            }
            // Only skip passive status events so we do not reorder unrelated move writers.
            if (!_canSkipEventBetweenExtremeForcedSwapMoves(firstEv, candidateEv)) {
                break;
            }
        }
        return -1;
    }

    function _createOverlapReturnAfterState(meta, overlapOwner, overlapSpecial, includeMetaVisual) {
        return {
            color: overlapOwner === 'black' ? 1 : (overlapOwner === 'white' ? -1 : 0),
            special: overlapSpecial,
            timer: includeMetaVisual ? getPrimaryTimerFromMeta(meta) : null,
            owner: overlapOwner || null,
            inheritedTimer: includeMetaVisual ? getInheritedTimerFromMeta(meta) : null,
            inheritedOwner: includeMetaVisual ? getInheritedOwnerFromMeta(meta) : null,
            flipEvadeRemaining: includeMetaVisual ? getFlipEvadeRemainingFromMeta(meta) : null,
            inheritedFlipEvadeRemaining: includeMetaVisual ? getInheritedFlipEvadeRemainingFromMeta(meta) : null,
            destroyEvadeRemaining: includeMetaVisual ? getDestroyEvadeRemainingFromMeta(meta) : null
        };
    }

    function _createOverlapReturnPlaybackEvent(playbackBase, options) {
        const from = options && options.from ? options.from : null;
        const to = options && options.to ? options.to : null;
        const meta = options && options.meta ? options.meta : null;
        const overlapOwner = (options && typeof options.owner === 'string' && options.owner)
            ? options.owner
            : null;
        const overlapSpecial = options && options.special ? options.special : null;
        return _createPlaybackEvent(playbackBase, 'move', options && options.phase, [{
            from: { r: from && from.r, col: from && from.col },
            to: { r: to && to.r, col: to && to.col },
            ownerBefore: overlapOwner,
            ownerAfter: overlapOwner,
            cause: options && Object.prototype.hasOwnProperty.call(options, 'cause') ? options.cause : null,
            reason: options && Object.prototype.hasOwnProperty.call(options, 'reason') ? options.reason : null,
            overlapReturn: true,
            meta,
            sourceRow: from && from.r,
            sourceCol: from && from.col,
            after: _createOverlapReturnAfterState(meta, overlapOwner, overlapSpecial, !!(options && options.includeMetaVisual))
        }]);
    }

    function _createExtremeForcedSwapPlaybackEvent(playbackBase, phase, leadEv, followEv) {
        const playbackMeta = (playbackBase && playbackBase.meta && typeof playbackBase.meta === 'object')
            ? Object.assign({}, playbackBase.meta)
            : {};
        playbackMeta.sequence = 'extreme_hyperactive_forced_swap';
        return _createPlaybackEvent(
            Object.assign({}, playbackBase || {}, { meta: playbackMeta }),
            'move',
            phase,
            [{
                from: { r: leadEv.prevRow, col: leadEv.prevCol },
                to: { r: leadEv.row, col: leadEv.col },
                stoneId: leadEv.stoneId,
                ownerBefore: leadEv.ownerBefore,
                ownerAfter: leadEv.ownerAfter,
                cause: leadEv.cause || null,
                reason: leadEv.reason || null,
                meta: (leadEv && leadEv.meta && typeof leadEv.meta === 'object') ? leadEv.meta : null,
                extremeForcedSwapRole: 'lead'
            }, {
                from: { r: followEv.prevRow, col: followEv.prevCol },
                to: { r: followEv.row, col: followEv.col },
                stoneId: followEv.stoneId,
                ownerBefore: followEv.ownerBefore,
                ownerAfter: followEv.ownerAfter,
                cause: followEv.cause || null,
                reason: followEv.reason || null,
                meta: (followEv && followEv.meta && typeof followEv.meta === 'object') ? followEv.meta : null,
                extremeForcedSwapRole: 'follow'
            }]
        );
    }

    function _getSpawnOverlapReturnSpec(ev, spawnMeta) {
        if (!_isProliferationSpawnPresentationEvent(ev) || !spawnMeta) return null;
        const proliferationTriggeredBy = String(spawnMeta.proliferationTriggeredBy ? spawnMeta.proliferationTriggeredBy : '').toUpperCase();
        const proliferationTriggerReason = String(spawnMeta.proliferationTriggerReason ? spawnMeta.proliferationTriggerReason : '').toLowerCase();
        const isGluttonousTriggered =
            proliferationTriggeredBy === 'GLUTTONOUS_WILL' &&
            proliferationTriggerReason.indexOf('gluttonous_eat') === 0;
        const isWillHunterTriggered =
            proliferationTriggeredBy === 'WILL_HUNTER_KING' &&
            proliferationTriggerReason.indexOf('will_hunter_king_slash') === 0;
        if (
            !Number.isInteger(spawnMeta.sourceRow) ||
            !Number.isInteger(spawnMeta.sourceCol) ||
            !Number.isInteger(spawnMeta.proliferationOriginRow) ||
            !Number.isInteger(spawnMeta.proliferationOriginCol) ||
            (!isGluttonousTriggered && !isWillHunterTriggered)
        ) {
            return null;
        }
        const overlapOwner = (typeof spawnMeta.projectileOwner === 'string' && spawnMeta.projectileOwner)
            ? spawnMeta.projectileOwner
            : ((typeof spawnMeta.owner === 'string' && spawnMeta.owner) ? spawnMeta.owner : ev && ev.ownerAfter);
        return {
            owner: overlapOwner,
            special: isGluttonousTriggered ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
            cause: proliferationTriggeredBy,
            reason: isGluttonousTriggered ? 'gluttonous_eat_overlap_return' : 'will_hunter_king_slash_overlap_return',
            from: { r: spawnMeta.sourceRow, col: spawnMeta.sourceCol },
            to: { r: spawnMeta.proliferationOriginRow, col: spawnMeta.proliferationOriginCol },
            meta: spawnMeta,
            includeMetaVisual: true
        };
    }

    function _getGhostBlockedOverlapReturnSpec(ev, destroyMeta, destroyOutcomeKind, isGluttonousEatDestroy, isWillHunterKingSlashDestroy) {
        if (
            destroyOutcomeKind !== DESTROY_OUTCOME_KINDS.GHOST_BLOCKED ||
            !destroyMeta ||
            !Number.isInteger(destroyMeta.sourceRow) ||
            !Number.isInteger(destroyMeta.sourceCol) ||
            (!isGluttonousEatDestroy && !isWillHunterKingSlashDestroy)
        ) {
            return null;
        }
        return {
            owner: (typeof destroyMeta.projectileOwner === 'string' && destroyMeta.projectileOwner)
                ? destroyMeta.projectileOwner
                : null,
            special: isGluttonousEatDestroy ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
            cause: ev && ev.cause ? ev.cause : null,
            reason: isGluttonousEatDestroy ? 'gluttonous_eat_overlap_return' : 'will_hunter_king_slash_overlap_return',
            from: { r: destroyMeta.sourceRow, col: destroyMeta.sourceCol },
            to: { r: ev && ev.row, col: ev && ev.col },
            meta: destroyMeta,
            includeMetaVisual: false
        };
    }

    function _planSpawnPlayback(phaseState, ev, playbackBase, followsProliferationDestroy) {
        _clearChainFlipPhaseState(phaseState);
        phaseState.prevDestroyCause = null;
        phaseState.durationEndRevertPhase = null;
        phaseState.willHunterKingSlashPhase = null;

        const spawnMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
        const overlapSpec = _getSpawnOverlapReturnSpec(ev, spawnMeta);
        const spawnProfile = _getCardEffectSpawnProfile(ev);
        const sequentialSpawnIndex = spawnMeta && Number.isFinite(Number(spawnMeta.spawnIndex))
            ? Math.trunc(Number(spawnMeta.spawnIndex))
            : null;
        const followsPreservedProliferationDestroy =
            followsProliferationDestroy &&
            _isProliferationSpawnPresentationEvent(ev);
        let phase = phaseState.currentPhase;
        const leadingPlaybackEvents = [];

        if (followsPreservedProliferationDestroy && !overlapSpec) {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }
        if (overlapSpec) {
            if (!followsPreservedProliferationDestroy) {
                phaseState.currentPhase++;
            }
            leadingPlaybackEvents.push(_createOverlapReturnPlaybackEvent(playbackBase, Object.assign({}, overlapSpec, {
                phase: phaseState.currentPhase
            })));
        }
        if (spawnProfile && sequentialSpawnIndex !== null && sequentialSpawnIndex >= spawnProfile.phaseStartIndex) {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }

        let type = 'spawn';
        let targets;
        if (_isCloneLikeSpawnPresentationEvent(ev, spawnMeta)) {
            if (overlapSpec) {
                phaseState.currentPhase++;
                phase = phaseState.currentPhase;
            }
            type = 'move';
            targets = [{
                from: { r: spawnMeta.fromRow, col: spawnMeta.fromCol },
                to: { r: ev.row, col: ev.col },
                stoneId: ev.stoneId,
                ownerBefore: ev.ownerAfter,
                ownerAfter: ev.ownerAfter,
                cause: ev.cause || null,
                reason: ev.reason || null,
                clone: true
            }];
        } else {
            targets = [{
                r: ev.row,
                col: ev.col,
                stoneId: ev.stoneId,
                ownerAfter: ev.ownerAfter,
                cause: ev.cause || null,
                reason: ev.reason || null
            }];
        }

        return {
            phase,
            type,
            targets,
            leadingPlaybackEvents
        };
    }

    function _planDestroyPlayback(phaseState, ev, destroyMeta, playbackBase) {
        _clearChainFlipPhaseState(phaseState);
        phaseState.durationEndRevertPhase = null;
        const destroyCauseUpper = String(ev && ev.cause ? ev.cause : '').toUpperCase();
        const isGluttonousEatDestroy = _isGluttonousEatDestroyPresentationEvent(ev);
        const isSuperCrushDestroy = _isSuperCrushDestroyPresentationEvent(ev);
        const isWillHunterKingSlashDestroy = _isWillHunterKingSlashDestroyPresentationEvent(ev);
        let phase;

        if (isGluttonousEatDestroy) {
            phaseState.willHunterKingSlashPhase = null;
            phaseState.superCrushPhase = null;
            phaseState.superCrushActionId = null;
            phase = _assignActionScopedPhase(
                phaseState,
                'gluttonousEatPhase',
                'gluttonousEatActionId',
                ev && ev.actionId ? ev.actionId : null
            );
        } else if (isSuperCrushDestroy) {
            phaseState.willHunterKingSlashPhase = null;
            phaseState.gluttonousEatPhase = null;
            phaseState.gluttonousEatActionId = null;
            phaseState.superCrushPhase = _assignActionScopedPhase(
                phaseState,
                'superCrushPhase',
                'superCrushActionId',
                ev && ev.actionId ? ev.actionId : null
            );
            phase = phaseState.superCrushPhase;
        } else if (isWillHunterKingSlashDestroy) {
            phaseState.gluttonousEatPhase = null;
            phaseState.gluttonousEatActionId = null;
            phaseState.superCrushPhase = null;
            phaseState.superCrushActionId = null;
            phaseState.currentPhase++;
            phaseState.willHunterKingSlashPhase = phaseState.currentPhase;
            phase = phaseState.willHunterKingSlashPhase;
        } else if (BATCH_DESTROY_CAUSES.has(destroyCauseUpper)) {
            _clearGroupedDestroyPhaseState(phaseState);
            if (phaseState.prevDestroyCause !== destroyCauseUpper) {
                phaseState.currentPhase++;
            }
            phase = phaseState.currentPhase;
        } else {
            _clearGroupedDestroyPhaseState(phaseState);
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }

        phaseState.prevDestroyCause = destroyCauseUpper;
        const destroyOutcomeKind = _getDestroyOutcomeKind(destroyMeta);
        phaseState.prevWasProliferationDestroy = destroyOutcomeKind === DESTROY_OUTCOME_KINDS.PROLIFERATED;

        const overlapSpec = _getGhostBlockedOverlapReturnSpec(
            ev,
            destroyMeta,
            destroyOutcomeKind,
            isGluttonousEatDestroy,
            isWillHunterKingSlashDestroy
        );
        const trailingPlaybackEvents = overlapSpec
            ? [_createOverlapReturnPlaybackEvent(playbackBase, Object.assign({}, overlapSpec, { phase }))]
            : [];

        return { phase, trailingPlaybackEvents };
    }

    function _planChangePlaybackPhase(phaseState, ev) {
        phaseState.durationEndRevertPhase = null;
        phaseState.prevDestroyCause = null;
        phaseState.willHunterKingSlashPhase = null;
        const isChainFlip = isChainFlipPresentationEvent(ev);
        const chainFlipLink = isChainFlip ? getChainFlipLink(ev) : null;
        let phase = phaseState.currentPhase;
        if (isChainFlip && (!phaseState.prevWasChainFlip || phaseState.prevChainFlipLink !== chainFlipLink)) {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }
        if (isRegenTriggeredChange(ev)) {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }
        phaseState.prevWasChainFlip = isChainFlip;
        phaseState.prevChainFlipLink = isChainFlip ? chainFlipLink : null;
        return phase;
    }

    function _planMovePlaybackPhase(phaseState, ev) {
        _clearChainFlipPhaseState(phaseState);
        phaseState.durationEndRevertPhase = null;
        phaseState.prevDestroyCause = null;
        const moveActionId = ev && ev.actionId ? ev.actionId : null;
        const isSuperCrushActionMatched =
            phaseState.superCrushActionId === null ||
            moveActionId === null ||
            phaseState.superCrushActionId === moveActionId;
        const isGluttonousActionMatched =
            phaseState.gluttonousEatActionId === null ||
            moveActionId === null ||
            phaseState.gluttonousEatActionId === moveActionId;
        let phase;
        if (_isGluttonousEatMovePresentationEvent(ev) && phaseState.gluttonousEatPhase !== null && isGluttonousActionMatched) {
            phase = phaseState.gluttonousEatPhase;
        } else if (_isSuperCrushMovePresentationEvent(ev) && phaseState.superCrushPhase !== null && isSuperCrushActionMatched) {
            phase = phaseState.superCrushPhase;
        } else if (_isWillHunterKingSlashMovePresentationEvent(ev) && phaseState.willHunterKingSlashPhase !== null) {
            phase = phaseState.willHunterKingSlashPhase;
        } else {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }
        phaseState.gluttonousEatPhase = null;
        phaseState.gluttonousEatActionId = null;
        phaseState.superCrushPhase = null;
        phaseState.superCrushActionId = null;
        phaseState.willHunterKingSlashPhase = null;
        return phase;
    }

    /**
     * Converts presentation events (BoardOps output) into PlaybackEvents.
     * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
     */
    function mapToPlaybackEvents(presEvents, finalCardState, finalGameState) {
        const playbackEvents = [];
        const phaseState = _createPlaybackPhaseState();

        const presentationEvents = Array.isArray(presEvents) ? presEvents : [];
        const consumedPresentationIndexes = new Set();
        for (let presIndex = 0; presIndex < presentationEvents.length; presIndex += 1) {
            if (consumedPresentationIndexes.has(presIndex)) continue;
            const ev = presentationEvents[presIndex];
            const followsProliferationDestroy = phaseState.prevWasProliferationDestroy;
            phaseState.prevWasProliferationDestroy = false;
            const trailingPlaybackEvents = [];
            const playbackBase = _createPlaybackEventBase(ev, finalCardState);
            const pEvent = _createPlaybackEvent(playbackBase, null, phaseState.currentPhase, []);

            switch (ev.type) {
                case 'SPAWN': {
                    const spawnPlan = _planSpawnPlayback(
                        phaseState,
                        ev,
                        playbackBase,
                        followsProliferationDestroy
                    );
                    if (spawnPlan.leadingPlaybackEvents.length) {
                        playbackEvents.push(...spawnPlan.leadingPlaybackEvents);
                    }
                    pEvent.type = spawnPlan.type;
                    pEvent.phase = spawnPlan.phase;
                    pEvent.targets = spawnPlan.targets;
                    break;
                }
                case 'DESTROY': {
                    const destroyMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
                    const destroyPlan = _planDestroyPlayback(
                        phaseState,
                        ev,
                        destroyMeta,
                        playbackBase
                    );
                    pEvent.type = 'destroy';
                    pEvent.phase = destroyPlan.phase;
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        stoneId: ev.stoneId,
                        ownerBefore: ev.ownerBefore,
                        cause: ev.cause || null,
                        reason: ev.reason || null,
                        meta: destroyMeta,
                        sourceRow: destroyMeta && Number.isInteger(destroyMeta.sourceRow) ? destroyMeta.sourceRow : null,
                        sourceCol: destroyMeta && Number.isInteger(destroyMeta.sourceCol) ? destroyMeta.sourceCol : null,
                        projectileOwner: destroyMeta && typeof destroyMeta.projectileOwner === 'string' ? destroyMeta.projectileOwner : null,
                        projectileStone: destroyMeta && typeof destroyMeta.projectileStone === 'string' ? destroyMeta.projectileStone : null
                    }];
                    if (destroyPlan.trailingPlaybackEvents.length) {
                        trailingPlaybackEvents.push(...destroyPlan.trailingPlaybackEvents);
                    }
                    break;
                }
                case 'CHANGE':
                    // Map CHANGE -> flip to match UI AnimationEngine expectations (Spec B)
                    pEvent.type = 'flip';
                    const changeMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        ownerBefore: ev.ownerBefore,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null,
                        meta: changeMeta
                    }];
                    pEvent.phase = _planChangePlaybackPhase(phaseState, ev);
                    break;
                case 'MOVE': {
                    const forcedSwapPairIndex = _findExtremeForcedSwapMovePairPresentationIndex(presentationEvents, presIndex);
                    if (forcedSwapPairIndex >= 0) {
                        const forcedSwapPhase = _planMovePlaybackPhase(phaseState, ev);
                        Object.assign(
                            pEvent,
                            _createExtremeForcedSwapPlaybackEvent(
                                playbackBase,
                                forcedSwapPhase,
                                ev,
                                presentationEvents[forcedSwapPairIndex]
                            )
                        );
                        consumedPresentationIndexes.add(forcedSwapPairIndex);
                        break;
                    }
                    pEvent.type = 'move';
                    pEvent.targets = [{
                        from: { r: ev.prevRow, col: ev.prevCol },
                        to: { r: ev.row, col: ev.col },
                        stoneId: ev.stoneId,
                        ownerBefore: ev.ownerBefore,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null
                    }];
                    pEvent.phase = _planMovePlaybackPhase(phaseState, ev);
                    break;
                }
                case 'STATUS_APPLIED':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_TICK':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_REMOVED':
                    _preparePassivePlaybackPhaseState(phaseState, {
                        preserveDurationEndRevert: _isSpecialDurationExpiredStatusRemovedEvent(ev)
                    });
                    pEvent.type = 'status_removed';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    if (isRegenConsumedStatus(ev)) {
                        phaseState.currentPhase++;
                        pEvent.phase = phaseState.currentPhase;
                    } else if (_isSpecialDurationExpiredStatusRemovedEvent(ev)) {
                        pEvent.phase = _planDurationEndRevertPlaybackPhase(phaseState, playbackEvents.length > 0);
                    }
                    break;
                case 'HAND_CLEAR':
                case 'HAND_REMOVE':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'hand_remove';
                    pEvent.targets = [{
                        player: ev.player || null,
                        count: Number.isFinite(ev.count) ? ev.count : 0,
                        reason: ev.reason || null,
                        cardId: ev.cardId || null,
                        cardIds: Array.isArray(ev.cardIds) ? ev.cardIds.slice() : null
                    }];
                    phaseState.currentPhase++;
                    pEvent.phase = phaseState.currentPhase;
                    break;
                case 'DRAW_CARD':
                case 'HAND_ADD':
                    _preparePassivePlaybackPhaseState(phaseState);
                    const handAddReason = ev.reason || (ev.meta && ev.meta.reason) || null;
                    const isCaptureWillHandAdd = String(handAddReason || '').trim().toLowerCase() === 'capture_will';
                    const handAddVisualDescriptor = (PlaybackEventHelpers && typeof PlaybackEventHelpers.createCardVisualDescriptor === 'function')
                        ? PlaybackEventHelpers.createCardVisualDescriptor(ev.cardId || null, ev.meta || null)
                        : null;
                    pEvent.type = isCaptureWillHandAdd ? 'capture_to_hand_animation' : 'hand_add';
                    pEvent.targets = [{
                        player: ev.player || null,
                        cardId: ev.cardId || null,
                        count: Number.isFinite(ev.count) ? ev.count : 1,
                        reason: handAddReason,
                        sourceType: ev.meta && ev.meta.sourceType ? ev.meta.sourceType : null,
                        sourceCardId: ev.meta && ev.meta.sourceCardId ? ev.meta.sourceCardId : null,
                        sourceName: ev.meta && ev.meta.sourceName ? ev.meta.sourceName : null,
                        sourceSpecialType: ev.meta && ev.meta.sourceSpecialType ? ev.meta.sourceSpecialType : null,
                        sourceRow: ev.meta && Number.isInteger(ev.meta.sourceRow) ? ev.meta.sourceRow : null,
                        sourceCol: ev.meta && Number.isInteger(ev.meta.sourceCol) ? ev.meta.sourceCol : null,
                        sourceOwner: ev.meta && ev.meta.sourceOwner ? ev.meta.sourceOwner : null,
                        stoneId: ev.meta && Number.isInteger(ev.meta.stoneId) ? ev.meta.stoneId : null,
                        insertIndex: ev.meta && Number.isInteger(ev.meta.insertIndex) ? ev.meta.insertIndex : null,
                        generatedName: ev.meta && ev.meta.generatedName ? ev.meta.generatedName : null,
                        visualDescriptor: handAddVisualDescriptor
                    }];
                    // Draw animation should run as its own readable step.
                    phaseState.currentPhase++;
                    pEvent.phase = phaseState.currentPhase;
                    break;
                case 'CARD_USED':
                    _preparePassivePlaybackPhaseState(phaseState);
                    const visualDescriptor = (PlaybackEventHelpers && typeof PlaybackEventHelpers.createCardVisualDescriptor === 'function')
                        ? PlaybackEventHelpers.createCardVisualDescriptor(ev.cardId || null, ev.meta || null)
                        : null;
                    pEvent.type = 'card_use_animation';
                    pEvent.targets = [{
                        player: ev.player || null,
                        owner: (ev.meta && ev.meta.owner) ? ev.meta.owner : (ev.player || null),
                        cardId: ev.cardId || null,
                        cardType: (ev.meta && ev.meta.cardType) ? ev.meta.cardType : null,
                        cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
                        name: (ev.meta && ev.meta.name) ? ev.meta.name : null,
                        visualDescriptor
                    }];
                    // Card-use transport is also a readable step.
                    phaseState.currentPhase++;
                    pEvent.phase = phaseState.currentPhase;
                    break;
                case 'WORK_INCOME':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'log';
                    pEvent.targets = [];
                    if (Number.isInteger(ev.row) && Number.isInteger(ev.col)) {
                        playbackEvents.push(Object.assign(
                            _createPlaybackEvent(playbackBase, 'observer_bubble', phaseState.currentPhase, [{
                                r: ev.row,
                                col: ev.col,
                                owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                                gained: Number(ev.gained) || 0,
                                text: _resolveWorkIncomeBubbleText(ev),
                                incomeStep: Number.isFinite(Number(ev.incomeStep))
                                    ? Number(ev.incomeStep)
                                    : (Number.isFinite(Number(ev.meta && ev.meta.incomeStep)) ? Number(ev.meta.incomeStep) : null)
                            }]),
                            {
                                rawType: 'WORK_BUBBLE'
                            }
                        ));
                    }
                    break;
                case 'WORK_REMOVED':
                    _preparePassivePlaybackPhaseState(phaseState, {
                        preserveDurationEndRevert: _isWorkDurationExpiredPresentationEvent(ev)
                    });
                    pEvent.type = 'log';
                    pEvent.targets = [];
                    if (_isWorkDurationExpiredPresentationEvent(ev)) {
                        pEvent.phase = _planDurationEndRevertPlaybackPhase(phaseState, playbackEvents.length > 0);
                    }
                    if (!_isWorkDurationExpiredPresentationEvent(ev) && Number.isInteger(ev.row) && Number.isInteger(ev.col)) {
                        playbackEvents.push(Object.assign(
                            _createPlaybackEvent(playbackBase, 'observer_bubble', phaseState.currentPhase, [{
                                r: ev.row,
                                col: ev.col,
                                owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                                gained: 0,
                                text: _resolveWorkRemovedBubbleText(ev)
                            }]),
                            {
                                rawType: 'WORK_BUBBLE'
                            }
                        ));
                    }
                    break;
                case 'WORK_BUBBLE':
                    _preparePassivePlaybackPhaseState(phaseState, { clearWillHunter: false });
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim())
                            ? ev.text.trim()
                            : _resolveWorkIncomeBubbleText(ev)
                    }];
                    break;
                case 'OBSERVER_TRIGGERED':
                    _preparePassivePlaybackPhaseState(phaseState, { clearWillHunter: false });
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : ((ev.meta && typeof ev.meta.text === 'string' && ev.meta.text.trim()) ? ev.meta.text.trim() : null)
                    }];
                    break;
                case 'SPECIAL_STONE_BUBBLE': {
                    const bubbleScenario = (typeof ev.scenario === 'string' && ev.scenario.trim())
                        ? ev.scenario.trim()
                        : ((ev.meta && typeof ev.meta.scenario === 'string' && ev.meta.scenario.trim()) ? ev.meta.scenario.trim() : null);
                    const bubbleReason = (typeof ev.reason === 'string' && ev.reason.trim())
                        ? ev.reason.trim()
                        : ((ev.meta && typeof ev.meta.reason === 'string' && ev.meta.reason.trim()) ? ev.meta.reason.trim() : bubbleScenario);
                    const bubbleCause = (typeof ev.cause === 'string' && ev.cause.trim())
                        ? ev.cause.trim()
                        : ((ev.meta && typeof ev.meta.cause === 'string' && ev.meta.cause.trim()) ? ev.meta.cause.trim() : null);
                    _preparePassivePlaybackPhaseState(phaseState, {
                        clearWillHunter: false,
                        preserveDurationEndRevert: _hasDurationEndMarker(bubbleScenario || bubbleReason, bubbleCause)
                    });
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : ((ev.meta && typeof ev.meta.text === 'string' && ev.meta.text.trim()) ? ev.meta.text.trim() : null),
                        special: (typeof ev.special === 'string' && ev.special.trim())
                            ? ev.special.trim()
                            : ((ev.meta && typeof ev.meta.special === 'string' && ev.meta.special.trim()) ? ev.meta.special.trim() : null),
                        scenario: bubbleScenario,
                        reason: bubbleReason
                    }];
                    break;
                }
                case 'OBSERVER_BUBBLE':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : ((ev.meta && typeof ev.meta.text === 'string' && ev.meta.text.trim()) ? ev.meta.text.trim() : null)
                    }];
                    break;
                case 'ROUND_BONUS_BANNER':
                    _preparePassivePlaybackPhaseState(phaseState);
                    pEvent.type = 'round_bonus_banner';
                    pEvent.targets = [{
                        amount: Number(ev.amount) || 0,
                        roundNumber: Number(ev.roundNumber) || 0,
                        durationMs: Number(ev.durationMs) || 2200,
                        text: (typeof ev.text === 'string' && ev.text.trim())
                            ? ev.text.trim()
                            : null
                    }];
                    break;
                case 'CHARGE_BUBBLE':
                    _preparePassivePlaybackPhaseState(phaseState);
                    // Keep charge gain bubbles in the same readable phase as the flip/move
                    // that produced them so the board popup appears without an extra delay.
                    pEvent.phase = phaseState.currentPhase;
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : null,
                        bubbleKind: 'charge',
                        sourceType: (ev.meta && ev.meta.sourceType) ? ev.meta.sourceType : null
                    }];
                    break;
                default:
                    // Unknown presentation event:
                    // keep playback resilient by ignoring silently in player-facing logs.
                    pEvent.type = null;
                    _clearChainFlipPhaseState(phaseState);
                    phaseState.prevDestroyCause = null;
                    continue;
            }

            if (ev.type !== 'DESTROY' && ev.type !== 'MOVE') {
                phaseState.superCrushPhase = null;
                phaseState.superCrushActionId = null;
            }

            // NOTE: Do not populate 'after' using a final snapshot. Adapter is a thin transform.
            // Instead, include minimal per-target 'after' info derived from the presentation event itself
            // so that visual writers can render based on event payload without requiring snapshots.
            if (pEvent.type !== 'log' && pEvent.type !== 'card_use_animation' && pEvent.type !== 'observer_bubble') {
                const eventMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
                for (const t of pEvent.targets) {
                    const targetMeta = (t && t.meta && typeof t.meta === 'object') ? t.meta : eventMeta;
                    // Add a best-effort 'after' using event-sourced owner fields (no final snapshot)
                    if (t.ownerAfter !== undefined) {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: getVisualSpecialFromMeta(targetMeta),
                            timer: getPrimaryTimerFromMeta(targetMeta),
                            owner: (targetMeta && targetMeta.owner) || null,
                            inheritedTimer: getInheritedTimerFromMeta(targetMeta),
                            inheritedOwner: getInheritedOwnerFromMeta(targetMeta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(targetMeta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(targetMeta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(targetMeta)
                        };
                    } else if (pEvent.type === 'spawn') {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: getVisualSpecialFromMeta(targetMeta),
                            timer: getPrimaryTimerFromMeta(targetMeta),
                            owner: (targetMeta && targetMeta.owner) || null,
                            inheritedTimer: getInheritedTimerFromMeta(targetMeta),
                            inheritedOwner: getInheritedOwnerFromMeta(targetMeta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(targetMeta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(targetMeta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(targetMeta)
                        };
                    } else if (pEvent.type === 'move') {
                        const afterColor = (t.ownerAfter === 'black') ? 1 : ((t.ownerAfter === 'white') ? -1 : 0);
                        t.after = {
                            color: afterColor,
                            special: getVisualSpecialFromMeta(targetMeta),
                            timer: getPrimaryTimerFromMeta(targetMeta),
                            owner: (targetMeta && targetMeta.owner) || t.ownerAfter || null,
                            inheritedTimer: getInheritedTimerFromMeta(targetMeta),
                            inheritedOwner: getInheritedOwnerFromMeta(targetMeta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(targetMeta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(targetMeta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(targetMeta)
                        };
                    } else if (pEvent.type === 'destroy') {
                        t.after = {
                            color: 0,
                            special: null,
                            timer: null,
                            owner: null,
                            inheritedTimer: null,
                            inheritedOwner: null,
                            flipEvadeRemaining: null,
                            inheritedFlipEvadeRemaining: null,
                            destroyEvadeRemaining: null
                        };
                    } else if (pEvent.type === 'status_applied' || pEvent.type === 'status_removed') {
                        const visual = getVisualStateAt(t.r, t.col, finalCardState, finalGameState);
                        const specialFromEventRaw = (ev.meta && ev.meta.special) || null;
                        const specialFromEvent = getVisualSpecialFromMeta(ev.meta);
                        const ownerFromEvent = (ev.meta && ev.meta.owner) || null;
                        const inheritedTimerFromEvent = getInheritedTimerFromMeta(ev.meta);
                        const inheritedOwnerFromEvent = getInheritedOwnerFromMeta(ev.meta);
                        const flipEvadeRemainingFromEvent = getFlipEvadeRemainingFromMeta(ev.meta);
                        const inheritedFlipEvadeRemainingFromEvent = getInheritedFlipEvadeRemainingFromMeta(ev.meta);
                        const destroyEvadeRemainingFromEvent = getDestroyEvadeRemainingFromMeta(ev.meta);
                        const isStatusRemoved = pEvent.type === 'status_removed';
                        let color = visual.color || 0;
                        if (color === 0 && (specialFromEventRaw === 'TRAP' || specialFromEventRaw === 'TRAP_REVEAL')) {
                            if (ownerFromEvent === 'black' || ownerFromEvent === 1 || ownerFromEvent === '1') color = 1;
                            if (ownerFromEvent === 'white' || ownerFromEvent === -1 || ownerFromEvent === '-1') color = -1;
                        }
                        const specialForVisual = isStatusRemoved ? (visual.special || null) : (specialFromEvent || visual.special || null);
                        const timerForVisual = isStatusRemoved
                            ? (visual.timer || null)
                            : ((ev.meta && ev.meta.timer) || visual.timer || null);
                        const ownerForVisual = isStatusRemoved
                            ? (visual.owner || null)
                            : (ownerFromEvent || visual.owner || null);
                        const inheritedTimerForVisual = isStatusRemoved
                            ? (visual.inheritedTimer || null)
                            : (inheritedTimerFromEvent || visual.inheritedTimer || null);
                        const inheritedOwnerForVisual = isStatusRemoved
                            ? (visual.inheritedOwner || null)
                            : (inheritedOwnerFromEvent || visual.inheritedOwner || null);
                        const flipEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.flipEvadeRemaining ?? null)
                            : ((flipEvadeRemainingFromEvent ?? visual.flipEvadeRemaining) ?? null);
                        const inheritedFlipEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.inheritedFlipEvadeRemaining ?? null)
                            : ((inheritedFlipEvadeRemainingFromEvent ?? visual.inheritedFlipEvadeRemaining) ?? null);
                        const destroyEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.destroyEvadeRemaining ?? null)
                            : ((destroyEvadeRemainingFromEvent ?? visual.destroyEvadeRemaining) ?? null);
                        t.after = {
                            color,
                            special: specialForVisual,
                            timer: timerForVisual,
                            owner: ownerForVisual,
                            inheritedTimer: inheritedTimerForVisual,
                            inheritedOwner: inheritedOwnerForVisual,
                            flipEvadeRemaining: flipEvadeRemainingForVisual,
                            inheritedFlipEvadeRemaining: inheritedFlipEvadeRemainingForVisual,
                            destroyEvadeRemaining: destroyEvadeRemainingForVisual
                        };
                    } else {
                        t.after = {
                            color: 0,
                            special: null,
                            timer: null,
                            owner: null,
                            inheritedTimer: null,
                            inheritedOwner: null,
                            flipEvadeRemaining: null,
                            inheritedFlipEvadeRemaining: null,
                            destroyEvadeRemaining: null
                        };
                    }
                }
            }

            if (pEvent.type) playbackEvents.push(pEvent);
            if (trailingPlaybackEvents.length) playbackEvents.push(...trailingPlaybackEvents);
        }

        const generatedThrowChainSplit = _extractGeneratedThrowChainPlayback(playbackEvents);
        return _appendGeneratedThrowChainPlayback(generatedThrowChainSplit.immediateEvents, generatedThrowChainSplit.deferredEvents);
    }

    function _phaseNum(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function _getPrimaryPlaybackTarget(ev) {
        if (ev && Array.isArray(ev.targets) && ev.targets.length > 0) {
            return ev.targets[0];
        }
        return ev || null;
    }

    function _hasGeneratedThrowChainReason(reason) {
        return String(reason || '').trim().toLowerCase() === GENERATED_THROW_CHAIN_REASON;
    }

    function _isGeneratedThrowChainHandAddPlaybackEvent(ev) {
        if (!ev || ev.type !== 'hand_add') return false;
        if (String(ev.rawType || '').toUpperCase() !== 'HAND_ADD') return false;
        if (_hasGeneratedThrowChainReason(ev.reason)) return true;
        if (_hasGeneratedThrowChainReason(ev.meta && ev.meta.reason)) return true;
        const candidates = Array.isArray(ev.targets) && ev.targets.length > 0
            ? ev.targets
            : [ev];
        return candidates.some((target) => !!target && _hasGeneratedThrowChainReason(target.reason));
    }

    function _countPlaybackCards(ev) {
        const target = _getPrimaryPlaybackTarget(ev);
        const count = Number(target && target.count);
        return Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1;
    }

    function _clonePlaybackTarget(target) {
        if (!target || typeof target !== 'object') return target;
        const clonedTarget = Object.assign({}, target);
        if (target.from && typeof target.from === 'object') clonedTarget.from = Object.assign({}, target.from);
        if (target.to && typeof target.to === 'object') clonedTarget.to = Object.assign({}, target.to);
        if (target.after && typeof target.after === 'object') clonedTarget.after = Object.assign({}, target.after);
        if (target.meta && typeof target.meta === 'object') clonedTarget.meta = Object.assign({}, target.meta);
        return clonedTarget;
    }

    function _clonePlaybackEventWithPhase(ev, phase) {
        const clonedEvent = Object.assign({}, ev, { phase });
        if (clonedEvent.meta && typeof clonedEvent.meta === 'object') {
            clonedEvent.meta = Object.assign({}, clonedEvent.meta);
        }
        if (Array.isArray(ev && ev.targets)) {
            clonedEvent.targets = ev.targets.map((target) => _clonePlaybackTarget(target));
        }
        return clonedEvent;
    }

    function _setDeferredGeneratedThrowChainPlayback(playerKey, events) {
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';
        deferredGeneratedThrowChainPlaybackByPlayer[ownerKey] = Array.isArray(events)
            ? events.map((ev) => _clonePlaybackEventWithPhase(ev, _phaseNum(ev && ev.phase)))
            : [];
    }

    function _takeDeferredGeneratedThrowChainPlayback(playerKey) {
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';
        const queued = Array.isArray(deferredGeneratedThrowChainPlaybackByPlayer[ownerKey])
            ? deferredGeneratedThrowChainPlaybackByPlayer[ownerKey].slice()
            : [];
        _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey);
        return queued;
    }

    function _extractGeneratedThrowChainPlayback(playbackEvents) {
        const immediateEvents = [];
        const deferredEvents = [];
        for (const ev of Array.isArray(playbackEvents) ? playbackEvents : []) {
            if (_isGeneratedThrowChainHandAddPlaybackEvent(ev)) {
                deferredEvents.push(ev);
            } else {
                immediateEvents.push(ev);
            }
        }
        return { immediateEvents, deferredEvents };
    }

    function _appendGeneratedThrowChainPlayback(playbackEvents, deferredEvents) {
        const baseEvents = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
        const pendingEvents = Array.isArray(deferredEvents) ? deferredEvents : [];
        if (pendingEvents.length <= 0) return baseEvents;

        const startPhase = Math.max(1, _maxPhase(baseEvents) + 1);
        for (let index = 0; index < pendingEvents.length; index += 1) {
            baseEvents.push(_clonePlaybackEventWithPhase(pendingEvents[index], startPhase + index));
        }
        return baseEvents;
    }

    function _processGeneratedThrowChainPlayback(playbackEvents, action, playerKey) {
        const split = _extractGeneratedThrowChainPlayback(playbackEvents);
        const actionType = String(action && action.type ? action.type : '').toLowerCase();
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';

        if (actionType === 'use_card') {
            if (split.deferredEvents.length > 0) {
                _setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents);
                return {
                    playbackEvents: split.immediateEvents,
                    deferredGeneratedThrowChainHandAdd: {
                        playerKey: ownerKey,
                        count: split.deferredEvents.reduce((sum, ev) => sum + _countPlaybackCards(ev), 0),
                        reason: GENERATED_THROW_CHAIN_REASON
                    }
                };
            }
            return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
        }

        if (actionType === 'place') {
            const queuedDeferredEvents = _takeDeferredGeneratedThrowChainPlayback(ownerKey);
            const allDeferredEvents = queuedDeferredEvents.concat(split.deferredEvents);
            return {
                playbackEvents: _appendGeneratedThrowChainPlayback(split.immediateEvents, allDeferredEvents),
                deferredGeneratedThrowChainHandAdd: null
            };
        }

        if (split.deferredEvents.length > 0) {
            _setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents);
        }

        return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
    }

    function _maxPhase(playbackEvents) {
        const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
        return arr.reduce((maxP, ev) => {
            const p = _phaseNum(ev && ev.phase);
            return p > maxP ? p : maxP;
        }, 0);
    }

    function _findPhase(playbackEvents, predicate, fallbackPhase) {
        const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of arr) {
            if (predicate(ev)) return _phaseNum(ev && ev.phase);
        }
        return _phaseNum(fallbackPhase);
    }

    function _rawDetailCount(ev) {
        if (!ev || !Array.isArray(ev.details)) return 0;
        return ev.details.length;
    }

    function _hasRawEvent(rawEvents, type, predicate) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        for (const ev of events) {
            if (!ev || ev.type !== type) continue;
            if (!predicate || predicate(ev)) return true;
        }
        return false;
    }

    function normalizePlaybackEvents(playbackEvents) {
        return Array.isArray(playbackEvents) ? playbackEvents : [];
    }

    function _isDestroyWithCause(target, causes) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        return causes.has(cause);
    }

    function _isHyperactiveMoveTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
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
            cause === 'WILL_HUNTER_KING' ||
            isFlipEvadeMove ||
            isDestroyEvadeMove ||
            reason.indexOf('hyperactive') >= 0 ||
            reason.indexOf('gluttonous') >= 0
        );
    }

    function _isUltimateAnchorMoveTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            cause === 'ULTIMATE_REVERSE_DRAGON' ||
            cause === 'ULTIMATE_DESTROY_GOD' ||
            reason.indexOf('ultimate_reverse_dragon_move') === 0 ||
            reason.indexOf('ultimate_destroy_god_move') === 0
        );
    }

    function _isSuperCrushMoveTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            SUPER_CRUSH_CAUSES.has(cause) ||
            reason.indexOf('super_buoyancy_move') === 0 ||
            reason.indexOf('super_gravity_move') === 0
        );
    }

    function _isSpecialDurationExpiredDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        const special = String(target && target.meta && target.meta.special ? target.meta.special : '').toUpperCase();
        const isDurationEnd = _hasDurationEndMarker(reason);
        if (!isDurationEnd) return false;
        if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
        if (BOMB_DESTROY_CAUSES.has(cause)) return false;
        return SPECIAL_DURATION_EXPIRE_CAUSES.has(cause) || !!special;
    }

    function _isSpecialDurationExpiredDestroyEvent(ev) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isSpecialDurationExpiredDestroyTarget(t)));
    }

    function _hasDurationEndMarker(reason, cause) {
        const reasonLower = String(reason || '').toLowerCase();
        const causeLower = String(cause || '').toLowerCase();
        return (
            reasonLower === 'duration_end' ||
            reasonLower.indexOf('duration') >= 0 ||
            reasonLower.indexOf('expire') >= 0 ||
            causeLower.indexOf('expire') >= 0
        );
    }

    function _isSpecialDurationExpiredStatusRemovedEvent(ev) {
        if (!ev || String(ev.type || '').toLowerCase() !== 'status_removed') return false;
        const special = String(ev.meta && ev.meta.special ? ev.meta.special : '').toUpperCase();
        if (!SPECIAL_DURATION_REVERT_SPECIALS.has(special)) return false;
        const reason = String((ev.meta && ev.meta.reason) || ev.reason || '').toLowerCase();
        if (!_hasDurationEndMarker(reason)) return false;
        if (special === 'TRAP' || special === 'TRAP_REVEAL') return false;
        return true;
    }

    function _isSpecialDurationExpiredPlaybackEvent(ev) {
        return _isSpecialDurationExpiredDestroyEvent(ev) || _isSpecialDurationExpiredStatusRemovedEvent(ev);
    }

    function _isSniperShotDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'SNIPER_WILL' && reason.indexOf('sniper_shot') >= 0;
    }

    function _isLightningDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'LIGHTNING_WILL' && reason.indexOf('lightning_destroyed') >= 0;
    }

    function _isRobotVacuumSuckDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'ROBOT_VACUUM' && reason.indexOf('robot_vacuum_suck') >= 0;
    }

    function _isGoldSilverSelfDestroyTarget(target) {
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return reason === 'gold_stone_sacrifice' || reason === 'rainbow_stone_sacrifice' || reason === 'silver_stone_sacrifice' || reason === 'crystal_stone_sacrifice';
    }

    function _isGoldSilverSelfDestroyEvent(ev) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isGoldSilverSelfDestroyTarget(t)));
    }

    function _isWorkDurationExpiredPresentationEvent(ev) {
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

    function _isWorkFlipOrDestroyRemovedPresentationEvent(ev) {
        if (!ev || ev.type !== 'WORK_REMOVED') return false;
        if (ev.removed === false) return false;
        if (_isWorkDurationExpiredPresentationEvent(ev)) return false;
        return true;
    }

    function _createSoundCuePlanningContext(playbackEvents, rawEvents, presentationEvents) {
        const base = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
        return {
            base,
            raw: Array.isArray(rawEvents) ? rawEvents : [],
            pres: Array.isArray(presentationEvents) ? presentationEvents : [],
            fallbackPhase: _maxPhase(base) + 1,
            added: [],
            seenSingleKeys: new Set()
        };
    }

    function _pushSoundCue(ctx, soundKey, phase, sourceType, options = {}) {
        const key = String(soundKey || '').trim();
        const allowRepeat = !!(options && options.allowRepeat === true);
        if (!key) return;
        if (!allowRepeat) {
            if (ctx.seenSingleKeys.has(key)) return;
            ctx.seenSingleKeys.add(key);
        }
        ctx.added.push({
            type: SOUND_EVENT_TYPE,
            phase: _phaseNum(phase),
            targets: [{ soundKey: key }],
            meta: sourceType ? { sourceType } : null
        });
    }

    function _tagCardUseAnimationPlaybackTarget(ctx, patch) {
        const anchorIndex = ctx.base.findIndex((ev) => ev && ev.type === 'card_use_animation');
        if (anchorIndex < 0) return false;
        const anchor = ctx.base[anchorIndex];
        const targets = Array.isArray(anchor.targets) ? anchor.targets.slice() : [];
        const firstTarget = targets[0] ? Object.assign({}, targets[0]) : {};
        targets[0] = Object.assign(firstTarget, patch || {});
        anchor.targets = targets;
        return true;
    }

    function _appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, playbackEvents) {
        const deferredEvents = Array.isArray(playbackEvents)
            ? playbackEvents
                .filter((ev) => !!ev)
                .map((ev) => _clonePlaybackEventWithPhase(ev, _phaseNum(ev && ev.phase)))
            : [];
        if (!deferredEvents.length) return false;
        const anchorIndex = ctx.base.findIndex((ev) => ev && ev.type === 'card_use_animation');
        if (anchorIndex < 0) return false;
        const anchor = ctx.base[anchorIndex];
        const targets = Array.isArray(anchor.targets) ? anchor.targets.slice() : [];
        const firstTarget = targets[0] ? Object.assign({}, targets[0]) : {};
        const existingEvents = Array.isArray(firstTarget[propertyName])
            ? firstTarget[propertyName]
                .filter((ev) => !!ev)
                .map((ev) => _clonePlaybackEventWithPhase(ev, _phaseNum(ev && ev.phase)))
            : [];
        firstTarget[propertyName] = existingEvents.concat(deferredEvents);
        targets[0] = firstTarget;
        anchor.targets = targets;
        return true;
    }

    function _movePlaybackEventsIntoCardUseAnimationTarget(ctx, predicate, propertyName) {
        const deferredEvents = ctx.base
            .filter((ev) => !!ev && predicate(ev));
        if (!deferredEvents.length) return false;
        if (!_appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, deferredEvents)) return false;
        for (let i = ctx.base.length - 1; i >= 0; i--) {
            if (ctx.base[i] && predicate(ctx.base[i])) ctx.base.splice(i, 1);
        }
        return true;
    }

    function _moveFirstPlaybackEventIntoCardUseAnimationTarget(ctx, sourceEvents, predicate, propertyName) {
        if (!Array.isArray(sourceEvents)) return false;
        const matchIndex = sourceEvents.findIndex((ev) => !!ev && predicate(ev));
        if (matchIndex < 0) return false;
        const matchedEvent = sourceEvents[matchIndex];
        if (!_appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, [matchedEvent])) return false;
        sourceEvents.splice(matchIndex, 1);
        return true;
    }

    function _collectUniquePhases(playbackEvents, predicate) {
        return Array.from(new Set(
            (Array.isArray(playbackEvents) ? playbackEvents : [])
                .filter((ev) => predicate(ev))
                .map((ev) => _phaseNum(ev && ev.phase))
                .filter((phase) => phase > 0)
        )).sort((a, b) => a - b);
    }

    function _pushCueForPhases(ctx, phases, soundKey, sourceType) {
        for (const phase of phases) {
            _pushSoundCue(ctx, soundKey, phase, sourceType, { allowRepeat: true });
        }
    }

    function _pushRepeatedCueForMatchingTargets(ctx, events, targetPredicate, soundKey, sourceType) {
        for (const ev of Array.isArray(events) ? events : []) {
            const phase = _phaseNum(ev && ev.phase);
            const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
            const hitCount = targets.filter((target) => targetPredicate(target)).length;
            for (let i = 0; i < hitCount; i++) {
                _pushSoundCue(ctx, soundKey, phase, sourceType, { allowRepeat: true });
            }
        }
    }

    function _pushRepeatedCueForCardEffectSpawnProfiles(ctx, events, soundKey) {
        for (const profile of CARD_EFFECT_SPAWN_PROFILES) {
            _pushRepeatedCueForMatchingTargets(
                ctx,
                events,
                (target) => _isCardEffectSpawnEventLike(target, profile),
                soundKey,
                profile.soundSourceType
            );
        }
    }

    function _deferFirstCardEffectSpawnIntoDisappearPlayback(ctx, profile, soundKey) {
        if (!_hasRawEvent(ctx.raw, profile.rawResolvedType, (ev) => Number(ev && ev.spawnedCount) > 0)) {
            return;
        }
        const movedSpawn = _moveFirstPlaybackEventIntoCardUseAnimationTarget(
            ctx,
            ctx.base,
            (ev) => _isCardEffectSpawnPlaybackEvent(ev, profile),
            'disappearPlaybackEvents'
        );
        if (!movedSpawn) return;
        _moveFirstPlaybackEventIntoCardUseAnimationTarget(
            ctx,
            ctx.added,
            (ev) => ev &&
                ev.type === SOUND_EVENT_TYPE &&
                ev.meta &&
                ev.meta.sourceType === profile.soundSourceType &&
                Array.isArray(ev.targets) &&
                ev.targets.some((target) => String(target && target.soundKey ? target.soundKey : '').trim() === String(soundKey || '').trim()),
            'disappearPlaybackEvents'
        );
    }

    function _planCoreSoundCues(ctx) {
        const bombDestroyPhases = _collectUniquePhases(
            ctx.base,
            (ev) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isDestroyWithCause(t, BOMB_DESTROY_CAUSES))
        );
        if (bombDestroyPhases.length > 0) {
            _pushCueForPhases(ctx, bombDestroyPhases, 'bomb_explode', 'bomb_destroy');
        } else if (_hasRawEvent(ctx.raw, 'bombs_exploded', (ev) => !!(ev && ev.details))) {
            _pushSoundCue(ctx, 'bomb_explode', ctx.fallbackPhase, 'bombs_exploded');
        }

        const breedingPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'spawn' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'BREEDING' || reason.indexOf('breeding_spawn') === 0;
            }),
            ctx.fallbackPhase
        );
        if (
            _hasRawEvent(ctx.raw, 'breeding_spawned_start', (ev) => _rawDetailCount(ev) > 0) ||
            _hasRawEvent(ctx.raw, 'breeding_spawned_immediate', (ev) => _rawDetailCount(ev) > 0)
        ) {
            _pushSoundCue(ctx, 'breeding_spawn', breedingPhase, 'breeding_spawned');
        }
        _pushRepeatedCueForCardEffectSpawnProfiles(
            ctx,
            ctx.base.filter((ev) => ev && ev.type === 'spawn'),
            'breeding_spawn'
        );

        const hasAppliedTemptSelection = _hasRawEvent(ctx.raw, 'tempt_selected', (ev) => !!(ev && ev.applied));
        const hasTemptSelectionEvent = _hasRawEvent(ctx.raw, 'tempt_selected');
        const hasAppliedSwapSelection = _hasRawEvent(ctx.raw, 'swap_selected', (ev) => !!(ev && ev.swapped));
        const hasSwapSelectionEvent = _hasRawEvent(ctx.raw, 'swap_selected');
        const shouldIncludeCardEffectFlipTarget = (target) => {
            if (!isCardEffectFlipPresentationEvent(target)) return false;
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            if (reason.indexOf('tempt_applied') === 0) {
                return hasAppliedTemptSelection || !hasTemptSelectionEvent;
            }
            if (reason.indexOf('swap_with_enemy') === 0) {
                return hasAppliedSwapSelection || !hasSwapSelectionEvent;
            }
            return true;
        };
        const cardEffectFlipPhases = _collectUniquePhases(
            ctx.base,
            (ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => shouldIncludeCardEffectFlipTarget(t))
        );
        if (cardEffectFlipPhases.length > 0) {
            _pushCueForPhases(ctx, cardEffectFlipPhases, CARD_EFFECT_FLIP_SOUND_KEY, 'card_effect_flip');
        } else {
            const cardEffectFlipFallbackCount = _countCardEffectFlipFallbackEvents(ctx.raw);
            for (let i = 0; i < cardEffectFlipFallbackCount; i++) {
                _pushSoundCue(ctx, CARD_EFFECT_FLIP_SOUND_KEY, ctx.fallbackPhase + i, 'card_effect_flip', { allowRepeat: true });
            }
        }

        const ultimateAnchorMoveEvents = ctx.base.filter((ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => _isUltimateAnchorMoveTarget(t)));
        if (ultimateAnchorMoveEvents.length > 0) {
            _pushRepeatedCueForMatchingTargets(
                ctx,
                ultimateAnchorMoveEvents,
                (target) => _isUltimateAnchorMoveTarget(target),
                ULTIMATE_ANCHOR_MOVE_SOUND_KEY,
                'ultimate_anchor_moved'
            );
        } else {
            const fallbackMoveCount = ctx.raw.reduce((sum, ev) => {
                if (!ev || !ev.type) return sum;
                if (
                    ev.type !== 'dragon_moved_start' &&
                    ev.type !== 'dragon_moved_immediate' &&
                    ev.type !== 'udg_moved_start' &&
                    ev.type !== 'udg_moved_immediate'
                ) {
                    return sum;
                }
                return sum + _rawDetailCount(ev);
            }, 0);
            for (let i = 0; i < fallbackMoveCount; i++) {
                _pushSoundCue(ctx, ULTIMATE_ANCHOR_MOVE_SOUND_KEY, ctx.fallbackPhase + i, 'ultimate_anchor_moved', { allowRepeat: true });
            }
        }

        const hyperactiveMoveEvents = ctx.base.filter((ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => _isHyperactiveMoveTarget(t)));
        if (hyperactiveMoveEvents.length > 0) {
            _pushRepeatedCueForMatchingTargets(
                ctx,
                hyperactiveMoveEvents,
                (target) => _isHyperactiveMoveTarget(target),
                'hyperactive_move',
                'hyperactive_moved'
            );
        } else {
            const fallbackMoveCount = ctx.raw.reduce((sum, ev) => {
                if (!ev || !ev.type) return sum;
                if (
                    ev.type !== 'hyperactive_moved_start' &&
                    ev.type !== 'hyperactive_moved_immediate' &&
                    ev.type !== 'ultimate_hyperactive_moved_start' &&
                    ev.type !== 'ultimate_hyperactive_moved_immediate'
                ) {
                    return sum;
                }
                return sum + _rawDetailCount(ev);
            }, 0);
            for (let i = 0; i < fallbackMoveCount; i++) {
                _pushSoundCue(ctx, 'hyperactive_move', ctx.fallbackPhase + i, 'hyperactive_moved', { allowRepeat: true });
            }
        }

        const specialRevertedPhase = _findPhase(ctx.base, _isSpecialDurationExpiredPlaybackEvent, ctx.fallbackPhase);
        if (ctx.base.some(_isSpecialDurationExpiredPlaybackEvent)) {
            _pushSoundCue(ctx, 'special_reverted', specialRevertedPhase, 'special_reverted');
        }
    }

    function _planSelectionSoundCues(ctx) {
        const trapSelectPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TRAP',
            ctx.fallbackPhase
        );
        const timeBombSelectPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TIME_BOMB',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'trap_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'trap_select', trapSelectPhase, 'trap_selected');
        }
        if (_hasRawEvent(ctx.raw, 'time_bomb_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'trap_select', timeBombSelectPhase, 'time_bomb_selected');
        }

        const guardSelectPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'GUARD',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'guard_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'guard_select', guardSelectPhase, 'guard_selected');
        }

        const hyperactiveInheritSelectPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'INHERITED_HYPERACTIVE',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'hyperactive_inherit_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'guard_select', hyperactiveInheritSelectPhase, 'hyperactive_inherit_selected');
        }

        const freezeSelectPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'FREEZE',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'freeze_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'freeze_select', freezeSelectPhase, 'freeze_selected');
        }

        const trapTriggeredEvent = ctx.raw.find((ev) => ev && ev.type === 'trap_triggered' && _rawDetailCount(ev) > 0);
        const trapTriggeredDetail = trapTriggeredEvent && Array.isArray(trapTriggeredEvent.details)
            ? trapTriggeredEvent.details[0]
            : null;
        const trapTriggeredPhase = (trapTriggeredDetail && Number.isInteger(trapTriggeredDetail.row) && Number.isInteger(trapTriggeredDetail.col))
            ? _findPhase(
                ctx.base,
                (ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => t && t.r === trapTriggeredDetail.row && t.col === trapTriggeredDetail.col),
                ctx.fallbackPhase
            )
            : ctx.fallbackPhase;
        if (trapTriggeredEvent) {
            _pushSoundCue(ctx, 'trap_triggered', trapTriggeredPhase, 'trap_triggered');
        }

        const strongWindPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'STRONG_WIND_WILL' || reason.indexOf('strong_wind_move') === 0;
            }),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'strong_wind_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'strong_wind_move', strongWindPhase, 'strong_wind_selected');
        }

        const superBuoyancyPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                if (!_isSuperCrushMoveTarget(t)) return false;
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return cause === 'SUPER_BUOYANCY_WILL';
            }),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'super_buoyancy_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'super_buoyancy_move', superBuoyancyPhase, 'super_buoyancy_selected');
        }

        const superGravityPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                if (!_isSuperCrushMoveTarget(t)) return false;
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return cause === 'SUPER_GRAVITY_WILL';
            }),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'super_gravity_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'super_gravity_move', superGravityPhase, 'super_gravity_selected');
        }

        const teleportPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'TELEPORT_WILL' || reason.indexOf('teleport_move') === 0;
            }),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'teleport_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'teleport_select', teleportPhase, 'teleport_selected');
        }

        const trapMisfirePhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return reason.indexOf('trap_disarmed') >= 0 || reason.indexOf('trap_expired') >= 0;
            }),
            ctx.fallbackPhase
        );
        if (
            _hasRawEvent(ctx.raw, 'trap_disarmed', (ev) => _rawDetailCount(ev) > 0) ||
            _hasRawEvent(ctx.raw, 'trap_expired', (ev) => _rawDetailCount(ev) > 0)
        ) {
            _pushSoundCue(ctx, 'trap_misfire', trapMisfirePhase, 'trap_misfire');
        }

        const clonePhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return !!(t && t.clone === true) || cause === 'CLONE_WILL' || cause === 'SPLIT_WILL' || cause === 'PROLIFERATION_WILL';
            }),
            ctx.fallbackPhase
        );
        if (
            _hasRawEvent(ctx.raw, 'clone_selected', (ev) => !!(ev && ev.applied)) ||
            _hasRawEvent(ctx.raw, 'split_selected', (ev) => !!(ev && ev.applied)) ||
            ctx.pres.some((ev) => (
                ev &&
                ev.type === 'SPAWN' &&
                String(ev.cause || '').toUpperCase() === 'PROLIFERATION_WILL' &&
                String(ev.reason || '').toLowerCase().indexOf('proliferation_spawn') === 0
            ))
        ) {
            _pushSoundCue(ctx, 'clone_spawn', clonePhase, 'clone_selected');
        }

        const extendLifePhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() !== 'TRAP',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'extend_life_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'extend_life', extendLifePhase, 'extend_life_selected');
        }

        const corrosionPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'corrosion_will_resolved', (ev) => Number(ev && ev.affectedCount) > 0)) {
            _pushSoundCue(ctx, 'corrosion_tick', corrosionPhase, 'corrosion_will_resolved');
        }

        const temptPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'TEMPT_WILL' || reason.indexOf('tempt_applied') === 0;
            }),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'tempt_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'tempt_select', temptPhase, 'tempt_selected');
        }

        const capturePhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'capture_to_hand_animation',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'capture_selected', (ev) => !!(ev && ev.applied))) {
            _pushSoundCue(ctx, 'tempt_select', capturePhase, 'capture_selected');
        }
    }

    function _planCardAndEconomySoundCues(ctx) {
        const cardUseAnimationPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'card_use_animation',
            0
        );
        const postCardUsePhase = cardUseAnimationPhase > 0 ? (cardUseAnimationPhase + 1) : ctx.fallbackPhase;
        const hasCardUse = ctx.pres.some((ev) => !!ev && ev.type === 'CARD_USED');
        if (hasCardUse && cardUseAnimationPhase > 0) {
            _pushSoundCue(ctx, 'card_use_button', cardUseAnimationPhase, 'card_used');
        }
        const hasTreasureGain = _hasRawEvent(ctx.raw, 'treasure_box_gain', (ev) => Number(ev && ev.gained) > 0);
        if (hasTreasureGain) {
            _pushSoundCue(ctx, 'treasure_gain', postCardUsePhase, 'treasure_box_gain');
        }

        const roundBonusBannerPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'round_bonus_banner',
            ctx.fallbackPhase
        );
        const hasRoundBonusBanner = ctx.pres.some((ev) => (
            ev &&
            ev.type === 'ROUND_BONUS_BANNER' &&
            Number(ev.amount) > 0
        ));
        if (hasRoundBonusBanner) {
            _pushSoundCue(ctx, 'round_bonus', roundBonusBannerPhase, 'round_bonus');
        }

        if (_hasRawEvent(ctx.raw, 'loss_will_resolved', (ev) => Number(ev && ev.removedCount) > 0)) {
            _tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'loss_will_reset' });
            _movePlaybackEventsIntoCardUseAnimationTarget(
                ctx,
                (ev) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.reason === 'loss_will_reset',
                'disappearPlaybackEvents'
            );
        }
        for (const profile of CARD_EFFECT_SPAWN_PROFILES) {
            _deferFirstCardEffectSpawnIntoDisappearPlayback(ctx, profile, 'breeding_spawn');
        }

        const strongWillPromotedPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && ev.meta.reason === 'strong_will_promoted',
            ctx.fallbackPhase
        );
        const hasStrongWillPromotion = ctx.pres.some((ev) => (
            ev &&
            ev.type === 'STATUS_APPLIED' &&
            String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase() === 'strong_will_promoted'
        ));
        if (hasStrongWillPromotion) {
            _pushSoundCue(ctx, 'strong_will_promoted', strongWillPromotedPhase, 'strong_will_promoted');
        }

        const condemnPhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'condemn_selected', (ev) => !!(ev && ev.applied && ev.destroyedCardId))) {
            _pushSoundCue(ctx, 'stone_destroy', condemnPhase, 'condemn_selected');
        }

        const sellPhase = _findPhase(
            ctx.base,
            (ev) => ev && (ev.type === 'hand_remove' || ev.type === 'card_use_animation'),
            ctx.fallbackPhase
        );
        if (_hasRawEvent(ctx.raw, 'sell_selected', (ev) => !!(ev && ev.applied && Number(ev.gained) > 0))) {
            _pushSoundCue(ctx, 'charge_gain_common', sellPhase, 'sell_selected');
        }

        const workIncomePhase = _findPhase(
            ctx.base,
            (ev) => ev && ev.rawType === 'WORK_INCOME',
            _findPhase(
                ctx.base,
                (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'WORK',
                ctx.fallbackPhase
            )
        );
        const hasWorkIncome16 = ctx.pres.some((ev) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) === 16);
        const hasWorkIncome = ctx.pres.some((ev) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) > 0);
        if (hasWorkIncome16) {
            _pushSoundCue(ctx, 'work_income_16', workIncomePhase, 'work_income');
        } else if (hasWorkIncome && !hasTreasureGain) {
            _pushSoundCue(ctx, 'charge_gain_common', workIncomePhase, 'work_income');
        }

        const workRemovedEvents = ctx.pres.filter((ev) => _isWorkFlipOrDestroyRemovedPresentationEvent(ev));
        if (workRemovedEvents.length > 0) {
            const workRemovedPlaybackEvents = ctx.base.filter((ev) => ev && ev.rawType === 'WORK_REMOVED');
            const workRemovedFallbackPhase = _findPhase(
                ctx.base,
                (ev) => ev && ev.rawType === 'WORK_REMOVED',
                ctx.fallbackPhase
            );
            for (let i = 0; i < workRemovedEvents.length; i++) {
                const playbackEv = workRemovedPlaybackEvents[i];
                const phase = playbackEv ? _phaseNum(playbackEv.phase) : workRemovedFallbackPhase;
                _pushSoundCue(ctx, 'work_removed', phase, 'work_removed', { allowRepeat: true });
            }
        }
    }

    function _isGenericDestroyPlaybackEvent(ev) {
        if (!ev || ev.type !== 'destroy' || !Array.isArray(ev.targets)) return false;
        if (_isSpecialDurationExpiredPlaybackEvent(ev)) return false;
        return ev.targets.some((t) => {
            if (!_isDestroyRemovalOutcome(t)) return false;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            if (BOMB_DESTROY_CAUSES.has(cause)) return false;
            if (_isSniperShotDestroyTarget(t)) return false;
            if (_isLightningDestroyTarget(t)) return false;
            if (_isRobotVacuumSuckDestroyTarget(t)) return false;
            if (_isGoldSilverSelfDestroyTarget(t)) return false;
            if (_isSpecialDurationExpiredDestroyTarget(t)) return false;
            if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
            return true;
        });
    }

    function _planDestroySoundCues(ctx) {
        const sniperDestroyEvents = ctx.base.filter((ev) => (
            ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((t) => _isSniperShotDestroyTarget(t))
        ));
        if (sniperDestroyEvents.length > 0) {
            _pushRepeatedCueForMatchingTargets(
                ctx,
                sniperDestroyEvents,
                (target) => _isSniperShotDestroyTarget(target) && _isDestroyRemovalOutcome(target),
                'stone_destroy',
                'sniper_shot'
            );
        }

        const lightningDestroyEvents = ctx.base.filter((ev) => (
            ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((t) => _isLightningDestroyTarget(t))
        ));
        if (lightningDestroyEvents.length > 0) {
            _pushRepeatedCueForMatchingTargets(
                ctx,
                lightningDestroyEvents,
                (target) => _isLightningDestroyTarget(target) && _isDestroyRemovalOutcome(target),
                'stone_destroy',
                'lightning_destroyed'
            );
        }

        const robotVacuumSuckPhases = _collectUniquePhases(
            ctx.base,
            (ev) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isRobotVacuumSuckDestroyTarget(t))
        );
        _pushCueForPhases(ctx, robotVacuumSuckPhases, 'robot_vacuum_suck', 'robot_vacuum_suck');

        const goldSilverSelfDestroyPhases = _collectUniquePhases(ctx.base, (ev) => _isGoldSilverSelfDestroyEvent(ev));
        _pushCueForPhases(ctx, goldSilverSelfDestroyPhases, 'charge_gain_common', 'gold_silver_self_destroy');

        if (ctx.base.some(_isGenericDestroyPlaybackEvent)) {
            const genericDestroyPhase = _findPhase(ctx.base, _isGenericDestroyPlaybackEvent, ctx.fallbackPhase);
            _pushSoundCue(ctx, 'stone_destroy', genericDestroyPhase, 'destroy');
        }
    }

    function appendSoundEffectPlaybackEvents(playbackEvents, rawEvents, presentationEvents) {
        const ctx = _createSoundCuePlanningContext(playbackEvents, rawEvents, presentationEvents);
        if (!ctx.raw.length && !ctx.base.length) return ctx.base;
        _planCoreSoundCues(ctx);
        _planSelectionSoundCues(ctx);
        _planCardAndEconomySoundCues(ctx);
        _planDestroySoundCues(ctx);
        ctx.added.sort((a, b) => _phaseNum(a.phase) - _phaseNum(b.phase));
        return ctx.base.concat(ctx.added);
    }

    function _playerLabel(playerKey) {
        return playerKey === 'black' ? '黒' : '白';
    }

    function _toPosText(pos) {
        if (!pos || !Number.isInteger(pos.row) || !Number.isInteger(pos.col)) return '';
        if (SharedBoardUtils && typeof SharedBoardUtils.formatPosTextJa === 'function') {
            return SharedBoardUtils.formatPosTextJa(pos);
        }
        if (pos.col === -1) return `左外${pos.row + 1}`;
        if (pos.col === 8) return `右外${pos.row + 1}`;
        const file = String.fromCharCode('A'.charCodeAt(0) + pos.col);
        return `${file}${pos.row + 1}`;
    }

    function _specialLabelJa(rawSpecial) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
            const displayName = SpecialStoneRegistry.getSpecialStoneDisplayName(rawSpecial, null);
            if (displayName) return displayName;
        }
        const s = String(rawSpecial || '').toUpperCase();
        if (s === 'BREEDING') return '繁殖石';
        if (s === 'TIME_BOMB') return '時限爆弾';
        if (s === 'TIME_STOP') return '時間停石';
        if (s === 'DRAGON') return '究極反転龍';
        if (s === 'DESTROY_DRAGON') return '破壊龍';
        if (s === 'ULTIMATE_DESTROY_GOD') return '究極破壊神';
        if (s === 'SNIPER') return '狙撃石';
        if (s === 'LIGHTNING') return '落雷石';
        if (s === 'OBSERVER') return '盤理の観測者石';
        if (s === 'HYPERACTIVE') return '多動石';
        if (s === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
        if (s === 'ESCAPE_HYPERACTIVE') return '逃亡石';
        if (s === 'GLUTTONOUS') return '悪食石';
        if (s === 'ULTIMATE_HYPERACTIVE') return '究極多動神';
        if (s === 'REGEN') return '復活石';
        if (s === 'WORK') return '労働石';
        if (s === 'CROSS_BOMB') return '十字爆弾';
        if (s === 'X_BOMB') return 'クロス爆弾';
        if (s === 'PROTECTED') return '反転保護';
        if (s === 'PERMA_PROTECTED') return '永続反転保護';
        if (s === 'ABSOLUTE_PROTECTED') return '絶対保護';
        if (s === 'GUARD') return '守る石';
        if (s === 'TRAP' || s === 'TRAP_REVEAL') return '罠石';
        if (s === 'BLOCKADE') return '封鎖マス';
        return rawSpecial || '';
    }

    function _detailCount(ev) {
        return (ev && Array.isArray(ev.details)) ? ev.details.length : 0;
    }

    function _detailGainedSum(ev) {
        if (!ev || !Array.isArray(ev.details)) return 0;
        return ev.details.reduce((sum, one) => sum + (Number(one && one.gained) || 0), 0);
    }

    function _hyperactiveLabel(ev, fallback) {
        const details = (ev && Array.isArray(ev.details)) ? ev.details : null;
        const first = details && details[0] ? details[0] : null;
        const markerType = String(first && (first.specialType || first.type) ? (first.specialType || first.type) : '').toUpperCase();
        if (markerType === 'INHERITED_HYPERACTIVE') return '継承多動石';
        if (markerType === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
        if (markerType === 'ESCAPE_HYPERACTIVE') return '逃亡石';
        if (markerType === 'GLUTTONOUS') return '悪食石';
        return fallback;
    }

    function _pushCountLog(logs, ev, label, suffix) {
        logs.push(`${label}${_detailCount(ev)}${suffix}`);
    }

    function _countMatchingDetails(ev, predicate) {
        const details = (ev && Array.isArray(ev.details)) ? ev.details : [];
        return details.reduce((sum, detail) => sum + (predicate(detail) ? 1 : 0), 0);
    }

    function _isDurationEndRevertDetail(detail) {
        const reason = String(detail && detail.reason ? detail.reason : '').toLowerCase();
        return !!(detail && detail.reverted === true) || reason === 'duration_end' || reason === 'anchor_expired';
    }

    function _pushSplitDestroyedVsRevertedLog(push, ev, label, destroyedWord = '消滅') {
        const revertedCount = _countMatchingDetails(ev, _isDurationEndRevertDetail);
        const totalCount = _detailCount(ev);
        const destroyedCount = Math.max(0, totalCount - revertedCount);
        if (destroyedCount > 0) push(`${label}${destroyedCount}個が${destroyedWord}`);
        if (revertedCount > 0) push(`${label}${revertedCount}個が通常石に戻る`);
    }

    function _observerExpiredLogText(ev) {
        const durationCount = _countMatchingDetails(ev, (detail) => String(detail && detail.reason ? detail.reason : '').toLowerCase() === 'duration_end');
        const lostCount = _countMatchingDetails(ev, (detail) => String(detail && detail.reason ? detail.reason : '').toLowerCase() === 'anchor_lost');
        const totalCount = _detailCount(ev);
        if (durationCount > 0 && lostCount === 0) return `盤理の観測者: 親石${durationCount}個が通常石に戻る`;
        if (lostCount > 0 && durationCount === 0 && lostCount === totalCount) return `盤理の観測者: 親石${lostCount}個が失われて効果終了`;
        return `盤理の観測者: 親石${totalCount}個の効果が終了`;
    }

    function _formatCrystalStonePlacementLog(effects) {
        const gain = Number.isFinite(Number(effects && effects.crystalStoneGain))
            ? Math.max(0, Number(effects.crystalStoneGain))
            : 0;
        return gain > 0
            ? `水晶石: 数字マス布石 +${gain}（4倍）`
            : '水晶石: 数字マスなしで増加なし';
    }

    function _normalizePlayerKey(v) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(v);
            if (normalized) return normalized;
        }
        if (v === 'black' || v === 1 || v === '1') return 'black';
        if (v === 'white' || v === -1 || v === '-1') return 'white';
        return null;
    }

    function _resolveEventActorKey(ev, fallbackPlayerKey) {
        const byPlayer = _normalizePlayerKey(ev && ev.player);
        if (byPlayer) return byPlayer;
        const details = ev && Array.isArray(ev.details) ? ev.details : null;
        if (details && details.length > 0) {
            const byDetailOwner = _normalizePlayerKey(details[0] && details[0].owner);
            if (byDetailOwner) return byDetailOwner;
            const byDetailOwnerKey = _normalizePlayerKey(details[0] && details[0].ownerKey);
            if (byDetailOwnerKey) return byDetailOwnerKey;
        }
        return _normalizePlayerKey(fallbackPlayerKey) || 'black';
    }

    function _withActorPrefix(line, actorKey) {
        const text = String(line || '').trim();
        if (!text) return '';
        if (/^(黒|白):/.test(text)) return text;
        return `${_playerLabel(actorKey)}: ${text}`;
    }

    function mapEffectLogsFromPipeline(rawEvents, presEvents, playerKey) {
        const logs = [];
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        const seenStatusTick = new Set();

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            switch (ev.type) {
                case 'bombs_exploded':
                    push(`時限爆弾が${(ev.details && Array.isArray(ev.details.exploded)) ? ev.details.exploded.length : 0}箇所で爆発`);
                    break;
                case 'chain_flipped':
                    push(`連鎖: ${_detailCount(ev)}枚を追加反転`);
                    break;
                case 'taboo_reverse_flipped':
                    push(`禁忌の反転: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'dragon_converted_start':
                case 'dragon_converted_immediate':
                    push(`究極反転龍: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'dragon_moved_start':
                case 'dragon_moved_immediate':
                    push(`究極反転龍: ${_detailCount(ev)}回移動`);
                    break;
                case 'dragon_destroyed_anchor_start':
                case 'dragon_destroyed_anchor_immediate':
                    push(`究極反転龍: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'breeding_spawned_start':
                case 'breeding_spawned_immediate':
                    push(`繁殖石: ${_detailCount(ev)}個を生成`);
                    break;
                case 'breeding_flipped_start':
                case 'breeding_flipped_immediate':
                    push(`繁殖石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'breeding_destroyed_anchor_start':
                    push(`繁殖石: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'hyperactive_moved_start':
                case 'hyperactive_moved_immediate':
                    push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}回移動`);
                    break;
                case 'hyperactive_destroyed_start':
                case 'hyperactive_destroyed_immediate':
                    _pushSplitDestroyedVsRevertedLog(push, ev, `${_hyperactiveLabel(ev, '多動石')}: `);
                    break;
                case 'hyperactive_flipped_start':
                case 'hyperactive_flipped_immediate':
                    push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'extreme_hyperactive_repelled_start':
                case 'extreme_hyperactive_repelled_immediate':
                    push(`極悪多動魔: 隣接石を${_detailCount(ev)}個退避`);
                    break;
                case 'robot_vacuum_moved_start':
                case 'robot_vacuum_moved_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}回移動`);
                    break;
                case 'robot_vacuum_sucked_start':
                case 'robot_vacuum_sucked_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}個を吸い込み`);
                    break;
                case 'robot_vacuum_destroyed_start':
                case 'robot_vacuum_destroyed_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}個が消滅`);
                    break;
                case 'robot_vacuum_expired_start':
                    push(`ロボット掃除機石: ${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'robot_vacuum_flipped_start':
                case 'robot_vacuum_flipped_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'ultimate_hyperactive_moved_start':
                case 'ultimate_hyperactive_moved_immediate':
                    push(`究極多動神: ${_detailCount(ev)}回移動`);
                    break;
                case 'ultimate_hyperactive_destroyed_start':
                case 'ultimate_hyperactive_destroyed_immediate':
                    _pushSplitDestroyedVsRevertedLog(push, ev, '究極多動神: ');
                    break;
                case 'ultimate_hyperactive_flipped_start':
                case 'ultimate_hyperactive_flipped_immediate':
                    push(`究極多動神: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'regen_triggered_start':
                case 'regen_triggered':
                    push(`復活石: ${_detailCount(ev)}個が再生`);
                    break;
                case 'regen_capture_flipped_start':
                case 'regen_capture_flipped':
                    push(`復活石: 再生後に${_detailCount(ev)}枚を反転`);
                    break;
                case 'udg_destroyed_start':
                case 'udg_destroyed_immediate':
                    push(`究極破壊神: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'udg_moved_start':
                case 'udg_moved_immediate':
                    push(`究極破壊神: ${_detailCount(ev)}回移動`);
                    break;
                case 'udg_expired_start':
                case 'udg_expired_immediate':
                    push(`究極破壊神: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'destroy_dragon_destroyed_start':
                case 'destroy_dragon_destroyed_immediate':
                    push(`破壊龍: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'destroy_dragon_expired_start':
                case 'destroy_dragon_expired_immediate':
                    push(`破壊龍: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'sniper_destroyed_start':
                case 'sniper_destroyed_immediate':
                    push(`狙撃石: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'sniper_expired_start':
                case 'sniper_expired_immediate':
                    push(`狙撃石: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'lightning_destroyed_start':
                case 'lightning_destroyed_immediate':
                    push(`落雷石: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'lightning_expired_start':
                case 'lightning_expired_immediate':
                    push(`落雷石: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'will_hunter_king_destroyed_start':
                case 'will_hunter_king_destroyed_immediate':
                    push(`意志狩りの王: ${_detailCount(ev)}個を斬撃破壊`);
                    break;
                case 'will_hunter_king_moved_start':
                case 'will_hunter_king_moved_immediate':
                    push(`意志狩りの王: ${_detailCount(ev)}回移動`);
                    break;
                case 'will_hunter_king_expired_start':
                case 'will_hunter_king_expired_immediate':
                    push(`意志狩りの王: 親石${_detailCount(ev)}個が通常石に戻る`);
                    break;
                case 'observer_triggered_start':
                case 'observer_triggered_immediate':
                    push(`盤理の観測者: 布石+${_detailGainedSum(ev)}`);
                    break;
                case 'observer_expired_start':
                case 'observer_expired_immediate':
                    push(_observerExpiredLogText(ev));
                    break;
                case 'destroy_selected':
                    if (ev.destroyed) push(`破壊神で${_toPosText(ev.target)}を破壊`);
                    else if (ev.regenerated) push(`破壊神: ${_toPosText(ev.target)} は復活した`);
                    else if (ev.proliferated) push(`破壊神: ${_toPosText(ev.target)} は石を残したまま増殖`);
                    else if (ev.blockedByGhost) push(`破壊神: ${_toPosText(ev.target)} は幽体化で無効化`);
                    else if (ev.evaded) push(`破壊神: ${_toPosText(ev.target)} は回避した`);
                    break;
                case 'strong_wind_selected':
                    if (ev.applied) push(`強風で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動`);
                    break;
                case 'super_buoyancy_selected':
                    if (ev.applied) push(`超浮力で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動（破壊${Array.isArray(ev.destroyed) ? ev.destroyed.length : 0}）`);
                    break;
                case 'super_gravity_selected':
                    if (ev.applied) push(`超重力で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動（破壊${Array.isArray(ev.destroyed) ? ev.destroyed.length : 0}）`);
                    break;
                case 'teleport_selected':
                    if (ev.applied) {
                        if (ev.cardType === 'CELL_TELEPORT_WILL') {
                            push(`マステレポートで${_toPosText(ev.from)}→${_toPosText(ev.to)}へ移動し、元マスを穴化`);
                        } else {
                            push(`テレポートで${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動`);
                        }
                    }
                    break;
                case 'sell_selected':
                    if (ev.applied) push(`売却で+${ev.gained || 0}`);
                    break;
                case 'rebuild_will_resolved':
                    push(`再構築の意志: 手札${Number(ev.destroyedCount) || 0}枚を破壊し、${Number(ev.drawnCount) || 0}枚ドロー`);
                    break;
                case 'supply_will_resolved':
                    push(`補給の意志: ${Number(ev.drawnCount) || 0}枚ドロー`);
                    break;
                case 'corner_tribute_resolved':
                    push(`角の代償: 相手の布石を${Number(ev.stolen) || 0}奪取`);
                    break;
                case 'ribo_will_resolved':
                    push(`リボ払いの意志: 布石+${Number(ev.gained) || 0}、以後${Number(ev.remainingOwnerTurns) || 0}ターンは開始時に${Number(ev.repaymentAmount) || 0}返済`);
                    break;
                case 'ribo_will_repaid':
                    push(`リボ払いの意志: 布石-${Number(ev.repaid) || 0}返済（残り${Number(ev.remainingOwnerTurns) || 0}ターン）`);
                    break;
                case 'ribo_will_shortage':
                    push(`リボ払いの意志: 布石不足で自石${Number(ev.destroyedCount) || 0}個を破壊（残り${Number(ev.remainingOwnerTurns) || 0}ターン）`);
                    break;
                case 'gluttonous_will_hand_destroyed':
                    push(`悪食の意志: 手札${Number(ev.destroyedCount) || 0}枚を破壊`);
                    break;
                case 'loss_will_resolved':
                    push(`意志の喪失: 特殊石${Number(ev.removedCount) || 0}個を通常石に戻す`);
                    break;
                case 'corrosion_will_resolved':
                    push(`腐食の意志: 特殊石${Number(ev.affectedCount) || 0}個の持続ターンを半減`);
                    break;
                case 'equality_will_resolved': {
                    const flippedCount = Number(ev.flippedCount) || 0;
                    let line = `平等の意志: 通常石${Number(ev.spawnedCount) || 0}個を生成`;
                    if (flippedCount > 0) line += `、${flippedCount}枚を反転`;
                    push(line);
                    break;
                }
                case 'reinforcement_will_resolved':
                    push(`増援の意志: 通常石${Number(ev.spawnedCount) || 0}個を配置${(Number(ev.flippedCount) || 0) > 0 ? `、${Number(ev.flippedCount) || 0}枚を反転` : ''}`);
                    break;
                case 'salvation_will_resolved':
                    push(`救済の意志: 通常石${Number(ev.spawnedCount) || 0}個を復活${(Number(ev.flippedCount) || 0) > 0 ? `、${Number(ev.flippedCount) || 0}枚を反転` : ''}`);
                    break;
                case 'heaven_blessing_selected':
                    if (ev.applied) push('天の恵みでカード獲得');
                    break;
                case 'condemn_selected':
                    if (ev.applied) push('断罪で相手カードを破壊');
                    break;
                case 'tempt_selected':
                    if (ev.applied) push('誘惑で特殊石を奪取');
                    break;
                case 'swap_selected':
                    if (ev.swapped) push(`交換で${_toPosText({ row: ev.row, col: ev.col })}を変換`);
                    break;
                case 'position_swap_first_selected':
                    if (ev.applied) push(`入替の意志: 1つ目に${_toPosText(ev.from || ev.target)}を選択`);
                    break;
                case 'position_swap_selected':
                    if (ev.applied && ev.completed) push(`入替の意志: ${_toPosText(ev.from)} と ${_toPosText(ev.to)} を入替`);
                    break;
                case 'trap_selected':
                    if (ev.applied) push('罠石がどこかに潜んでいる...');
                    break;
                case 'guard_selected':
                    if (ev.applied) push('守る意志で完全保護を付与');
                    break;
                case 'extend_life_selected':
                    if (ev.applied) push(ev && ev.cardType === 'EXTEND_LIFE_GOD' ? '延命神で持続を4倍化' : '延命の意志で持続を延長');
                    break;
                case 'time_bomb_selected':
                    if (ev.applied) push(`時限爆弾を${_toPosText(ev.target)}に設置`);
                    break;
                case 'time_stop_god_cost_resolved':
                    if (Number(ev.destroyedCount) > 0) push(`時間停石: 自石${Number(ev.destroyedCount) || 0}個を破壊`);
                    break;
                case 'time_stop_triggered':
                    push('時間停石: 時間停止が発動し、2連続で行動');
                    break;
                case 'time_stop_fizzled':
                    push('時間停石: 親石消失で不発');
                    break;
                case 'clone_selected':
                    if (ev.applied) push(`複製の意志: ${_toPosText(ev.target)}から${_detailCount(ev)}個を生成`);
                    break;
                case 'split_selected':
                    if (ev.applied) push(`分裂の意志: ${_toPosText(ev.target)}から${_detailCount(ev)}個を生成（持続ターン半減）`);
                    break;
                case 'board_expansion_first_selected':
                    if (ev.applied) push(`盤面拡張神: 1つ目に${_toPosText(ev.target)}を選択`);
                    break;
                case 'board_expansion_selected':
                    if (ev.applied) {
                        if (ev.cardType === 'BOARD_EXPANSION_GOD') {
                            const addedCount = Array.isArray(ev.added) ? ev.added.length : 0;
                            push(`盤面拡張神: 2角から${addedCount || 6}マス拡張`);
                        } else {
                            const sideLabel = ev.side === 'left' ? '左' : (ev.side === 'right' ? '右' : '左右');
                            push(`盤面拡張: ${sideLabel}側へ1マス拡張`);
                        }
                    }
                    break;
                case 'blockade_selected':
                    if (ev.applied) push(`封鎖の意志: ${_toPosText(ev.target)}を3ターン封鎖`);
                    break;
                case 'meteor_selected':
                    if (ev.applied) push(`隕石: ${_toPosText(ev.target)}をマスごと破壊`);
                    break;
                case 'freeze_selected':
                    if (ev.applied) push(`凍結の意志: ${_toPosText(ev.target)}を5ターン凍結`);
                    break;
                case 'treasure_box_gain':
                    push(`宝箱: 布石+${Number(ev.gained) || 0}`);
                    break;
                case 'board_bonus_gain':
                    push(`数字マス${_toPosText(ev)}: 布石+${Number(ev.gained) || Number(ev.bonus) || 0}${Number(ev.multiplier) > 1 ? `（${Number(ev.multiplier)}倍）` : ''}`);
                    break;
                case 'trap_triggered': {
                    const details = Array.isArray(ev.details) ? ev.details : [];
                    if (details.length > 0) {
                        const destroyedHand = details.reduce((sum, d) => sum + (Number(d && (d.destroyedHandCount ?? d.stolenHandCount)) || 0), 0);
                        push(`罠石が発動: 布石最大20奪取 / 手札全破壊（${destroyedHand}枚）`);
                    }
                    break;
                }
                case 'trap_expired':
                    if (_detailCount(ev) > 0) push('罠石は不発で消滅');
                    break;
                case 'trap_disarmed':
                    if (_detailCount(ev) > 0) push('罠石は不発で解除');
                    break;
                case 'placement_effects':
                    if (ev.effects) {
                        const e = ev.effects;
                        if (e.doublePlaceActivated) push(_formatMultiPlaceActivationLog(e));
                        if (e.freePlacementUsed && !e.sniperPlaced) push('自由の意志:自由な空きマスに配置');
                        if (e.sniperPlaced) push('狙撃の意志: 狙撃石を設置');
                        if (e.lightningPlaced) push('落雷の意志: 落雷石を設置');
                        if (e.observerPlaced) push('盤理の観測者を設置');
                        if (e.willHunterKingPlaced) push('意志狩りの王を設置');
                        if (e.silverStoneUsed) push('銀石: 獲得布石3倍');
                        if (e.goldStoneUsed) push('金石: 獲得布石4倍');
                        if (e.rainbowStoneUsed) push('虹石: 獲得布石6倍');
                        if (e.crystalStoneUsed) push(_formatCrystalStonePlacementLog(e));
                        if (e.protected) push('反転保護を付与');
                        if (e.permaProtected) push('永続反転保護を付与');
                        if (e.bombPlaced) push('時限爆弾を設置');
                        if (e.timeStopPlaced) push('時間停石を設置');
                        if (e.dragonPlaced) push('究極反転龍を設置');
                        if (e.ultimateDestroyGodPlaced) push('究極破壊神を設置');
                        if (e.ultimateHyperactivePlaced) push('究極多動神を設置');
                        if (e.instantHyperactivePlaced) push('瞬間多動石を設置');
                        if (e.escapeHyperactivePlaced) push('逃亡石を設置');
                        if (e.extremeHyperactivePlaced) push('極悪多動魔を設置');
                        if (e.robotVacuumPlaced) push('ロボット掃除機石を設置');
                        if (e.gluttonousPlaced) push('悪食石を設置');
                        if (e.hyperactivePlaced && !e.instantHyperactivePlaced && !e.escapeHyperactivePlaced && !e.extremeHyperactivePlaced && !e.robotVacuumPlaced && !e.gluttonousPlaced) push('多動石を設置');
                        if (e.crossBombExploded) push(`十字爆弾: ${e.crossBombDestroyed || 0}個を爆破`);
                        if (e.xBombExploded) push(`クロス爆弾: ${e.xBombDestroyed || 0}個を爆破`);
                        if (e.plunderAmount > 0) push(`吸収の意志: 布石を${e.plunderAmount}吸収`);
                    }
                    break;
                case 'extra_place_consumed':
                    push(_formatMultiPlaceConsumedLog(ev));
                    break;
                default:
                    break;
            }
        }

        const pres = Array.isArray(presEvents) ? presEvents : [];
        for (const ev of pres) {
            if (!ev) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            if (ev.type === 'WORK_INCOME') {
                const gained = Number.isFinite(ev.gained) ? ev.gained : ((ev.meta && Number.isFinite(ev.meta.gained)) ? ev.meta.gained : 0);
                push(`労働石: 布石 +${gained}`);
                continue;
            }
            if (ev.type === 'WORK_REMOVED') {
                if (_isWorkDurationExpiredPresentationEvent(ev)) push('労働石: 通常石に戻る');
                else push('労働石: 効果終了');
                continue;
            }
            if (!ev || ev.type !== 'STATUS_TICK' || !ev.meta) continue;
            const special = String(ev.meta.special || '');
            const timer = ev.meta.timer;
            const key = `${special}:${ev.row},${ev.col}:${timer}`;
            if (seenStatusTick.has(key)) continue;
            seenStatusTick.add(key);
            if (special === 'TIME_BOMB' && Number.isFinite(timer)) {
                push(`時限爆弾: ${_toPosText(ev)} のカウント ${timer}`);
            } else if (special && Number.isFinite(timer)) {
                push(`${_specialLabelJa(special)}: ${_toPosText(ev)} の残り ${timer}`);
            }
        }

        // De-duplicate only consecutive identical entries.
        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    function mapNormalLogsFromPipeline(rawEvents, playerKey) {
        const logs = [];
        const actor = _playerLabel(playerKey);
        const events = Array.isArray(rawEvents) ? rawEvents : [];

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            if (ev.type === 'place') {
                const flipCount = Array.isArray(ev.flips) ? ev.flips.length : 0;
                if (flipCount > 0) logs.push(`${actor}が${flipCount}枚反転！`);
            }
        }

        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    /**
     * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
     */
    function runTurnWithAdapter(cardState, gameState, playerKey, action, turnPipeline) {
        if (!turnPipeline) throw new Error('TurnPipeline not available');
        const suppressUiLogs = !!(action && action.__suppressUiLogs === true);

        // Build options for applyTurnSafe: include current state version and previous action ids if ActionManager is available
        const options = { skipTurnStart: true };
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            try {
                if (typeof ActionManager.ActionManager.getRecentActionIds === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getRecentActionIds(200);
                } else if (typeof ActionManager.ActionManager.getActions === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getActions().map(a => a.actionId).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
        }
        if (cardState && typeof cardState.turnIndex === 'number') {
            options.currentStateVersion = cardState.turnIndex;
        }

        // Attempt to pass the current game PRNG (when available in browser env) to ensure deterministic rule logic
        const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : (typeof globalThis !== 'undefined' && typeof globalThis.getGamePrng === 'function') ? globalThis.getGamePrng() : undefined;
        const result = (typeof turnPipeline.applyTurnSafe === 'function')
            ? turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action, runtimePrng, options)
            : turnPipeline.applyTurn(cardState, gameState, playerKey, action, runtimePrng, options);

        if (result.ok === false) {
            return { ok: false, rejectedReason: result.rejectedReason || 'UNKNOWN', events: result.events };
        }

        // Prefer pipeline-produced presentationEvents when available
        const pres = result.presentationEvents || result.cardState && result.cardState.presentationEvents || [];
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
                if (typeof emitEffectLog === 'function') {
                    for (const msg of effectLogMessages) emitEffectLog(msg);
                } else if (typeof emitLogAdded === 'function') {
                    for (const msg of effectLogMessages) emitLogAdded(msg, 'effect');
                }
                if (typeof emitNormalLog === 'function') {
                    for (const msg of normalLogMessages) emitNormalLog(msg);
                } else if (typeof emitLogAdded === 'function') {
                    for (const msg of normalLogMessages) emitLogAdded(msg, 'normal');
                }
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

    return {
        mapToPlaybackEvents,
        normalizePlaybackEvents,
        appendSoundEffectPlaybackEvents,
        mapEffectLogsFromPipeline,
        mapNormalLogsFromPipeline,
        clearDeferredGeneratedThrowChainPlayback,
        runTurnWithAdapter
    };
}));
