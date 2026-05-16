declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    const MarkersAdapter = (() => { try { return _require('../logic/markers_adapter'); } catch (e) { return null; } })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    function isBombCategoryMarker(marker: any) {
        if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        return !!(
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.data &&
            marker.data.category === 'bomb'
        );
    }
    const CardUtilsModule = (() => { try { return _require('../logic/cards/utils'); } catch (e) { return null; } })();
    const SharedConstantsModule = (() => { try { return _require('../../shared-constants'); } catch (e) { return null; } })();
    const DestroyOutcomeContract = (() => { try { return _require('../../shared/destroy-outcome-contract'); } catch (e) { return null; } })();
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        LIVING_WILL_RESTORED: 'living_will_restored',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

    function createDestroyOutcome(kindOrResult: any, details: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
            return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
        }
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = (source && source.kind) || (
            source && source.livingWillRevived ? DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED
                : source && source.regenerated ? DESTROY_OUTCOME_KINDS.REGENERATED
                : source && source.proliferated ? DESTROY_OUTCOME_KINDS.PROLIFERATED
                : source && source.blockedByGhost ? DESTROY_OUTCOME_KINDS.GHOST_BLOCKED
                    : source && source.evaded ? DESTROY_OUTCOME_KINDS.EVADED_MOVE
                        : source && source.destroyed ? DESTROY_OUTCOME_KINDS.DESTROYED
                            : null
        );
        const outcome = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
            regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
            livingWillRevived: kind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED || source.livingWillRevived === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
        });
        if (kind) outcome.kind = kind;
        if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
        if (outcome.from && typeof outcome.source === 'undefined') outcome.source = outcome.from;
        return outcome;
    }

    function isDestroyOutcomeResolved(result: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
            return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
        }
        return !!(result && (result.destroyed || result.regenerated || result.livingWillRevived || result.evaded || result.blockedByGhost || result.proliferated));
    }

    function applyPostFlipRevives(CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) {
        const regenRes = (CardLogic && typeof CardLogic.applyRegenAfterFlips === 'function')
            ? CardLogic.applyRegenAfterFlips(cardState, gameState, flips, ownerKey)
            : { regened: [], captureFlips: [] };
        const livingWillInputs: any[] = [
            ...(Array.isArray(flips) ? flips : []),
            ...(regenRes && Array.isArray(regenRes.captureFlips) ? regenRes.captureFlips : [])
        ];
        const livingWillRes = (CardLogic && typeof CardLogic.applyLivingWillAfterFlips === 'function')
            ? CardLogic.applyLivingWillAfterFlips(cardState, gameState, livingWillInputs, ownerKey)
            : { restored: [] };
        return { regenRes, livingWillRes };
    }

    function normalizePendingTypeForActionPhase(pendingType: any) {
        return String(pendingType || '').trim().toUpperCase();
    }

    function matchesPendingTypeForActionPhase(pending: any, expectedType: any) {
        const normalizedPendingType = normalizePendingTypeForActionPhase(pending && pending.type);
        if (!normalizedPendingType) return false;
        const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
        return expectedTypes.some((type: any) => normalizePendingTypeForActionPhase(type) === normalizedPendingType);
    }

    function requirePendingActionValue(pending: any, expectedType: any, value: any, errorMessage: any) {
        if (!matchesPendingTypeForActionPhase(pending, expectedType)) return false;
        if (value == null) {
            throw new Error(errorMessage);
        }
        return true;
    }

    function readPendingForActionPhase(cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.readPendingEffect === 'function') {
            return PendingCoordinatorModule.readPendingEffect(cardState, playerKey);
        }
        return (cardState && cardState.pendingEffectByPlayer)
            ? (cardState.pendingEffectByPlayer[playerKey] || null)
            : null;
    }

    function getPendingEffectTypeForActionPhase(CardLogic: any, cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.getPendingEffectType === 'function') {
            return PendingCoordinatorModule.getPendingEffectType(cardState, playerKey);
        }
        if (typeof CardLogic.getPendingEffectType === 'function') {
            return CardLogic.getPendingEffectType(cardState, playerKey);
        }
        const pending = readPendingForActionPhase(cardState, playerKey);
        return pending ? pending.type : null;
    }

    function clearPendingForActionPhase(cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingEffect === 'function') {
            return PendingCoordinatorModule.clearPendingEffect(cardState, playerKey, {
                clearSelectionAction: true
            });
        }
        if (cardState && cardState.pendingEffectByPlayer) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingSelectionAction === 'function') {
            PendingCoordinatorModule.clearPendingSelectionAction(playerKey);
        }
        return { ok: true, playerKey };
    }

    const resolvedChargeMax = Number(SharedConstantsModule && SharedConstantsModule.CHARGE_MAX);
    const CHARGE_MAX = Number.isFinite(resolvedChargeMax)
        ? resolvedChargeMax
        : 99;
    const OwnerHelpersModule = (() => { try { return _require('../../utils/owner-helpers'); } catch (e) { return null; } })();

    const PhaseHelpersModule = (() => { try { return _require('./turn_pipeline_phase_helpers'); } catch (e) { return null; } })();
    const PendingCoordinatorModule = (() => { try { return _require('./pending-coordinator'); } catch (e) { return null; } })();

    const FALLBACK_OBSERVER_BUBBLE_SPEECH = Object.freeze({
        placeLines: Object.freeze(['観測最高！']),
        lostLine: '観測失敗'
    });
    const FALLBACK_WORK_BUBBLE_SPEECH = Object.freeze({
        placeLines: Object.freeze(['ここで稼ぐ！']),
        lostLine: 'あああああああああああああ'
    });

    function getLegacySpecialStoneBubbleSpeech(type: any) {
        const key = String(type || '').trim().toUpperCase();
        if (key === 'OBSERVER') {
            return {
                placeLines: (
                    PhaseHelpersModule &&
                    Array.isArray(PhaseHelpersModule.OBSERVER_PLACE_LINES) &&
                    PhaseHelpersModule.OBSERVER_PLACE_LINES.length > 0
                ) ? PhaseHelpersModule.OBSERVER_PLACE_LINES : FALLBACK_OBSERVER_BUBBLE_SPEECH.placeLines,
                lostLine: (
                    PhaseHelpersModule &&
                    typeof PhaseHelpersModule.OBSERVER_LOST_LINE === 'string'
                ) ? PhaseHelpersModule.OBSERVER_LOST_LINE : FALLBACK_OBSERVER_BUBBLE_SPEECH.lostLine
            };
        }
        if (key === 'WORK') {
            return {
                placeLines: (
                    PhaseHelpersModule &&
                    Array.isArray(PhaseHelpersModule.WORK_PLACE_LINES) &&
                    PhaseHelpersModule.WORK_PLACE_LINES.length > 0
                ) ? PhaseHelpersModule.WORK_PLACE_LINES : FALLBACK_WORK_BUBBLE_SPEECH.placeLines,
                lostLine: (
                    PhaseHelpersModule &&
                    typeof PhaseHelpersModule.WORK_LOST_LINE === 'string'
                ) ? PhaseHelpersModule.WORK_LOST_LINE : FALLBACK_WORK_BUBBLE_SPEECH.lostLine
            };
        }
        return null;
    }

    const getSpecialStoneBubbleSpeech = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.getSpecialStoneBubbleSpeech === 'function'
    ) ? PhaseHelpersModule.getSpecialStoneBubbleSpeech : getLegacySpecialStoneBubbleSpeech;
    const observerBubbleSpeech = getSpecialStoneBubbleSpeech('OBSERVER') || getLegacySpecialStoneBubbleSpeech('OBSERVER');
    const workBubbleSpeech = getSpecialStoneBubbleSpeech('WORK') || getLegacySpecialStoneBubbleSpeech('WORK');
    const OBSERVER_PLACE_LINES = (
        observerBubbleSpeech &&
        Array.isArray(observerBubbleSpeech.placeLines) &&
        observerBubbleSpeech.placeLines.length > 0
    ) ? observerBubbleSpeech.placeLines : FALLBACK_OBSERVER_BUBBLE_SPEECH.placeLines;
    const OBSERVER_LOST_LINE = (
        observerBubbleSpeech &&
        typeof observerBubbleSpeech.lostLine === 'string'
    ) ? observerBubbleSpeech.lostLine : FALLBACK_OBSERVER_BUBBLE_SPEECH.lostLine;
    const WORK_PLACE_LINES = (
        workBubbleSpeech &&
        Array.isArray(workBubbleSpeech.placeLines) &&
        workBubbleSpeech.placeLines.length > 0
    ) ? workBubbleSpeech.placeLines : FALLBACK_WORK_BUBBLE_SPEECH.placeLines;
    const WORK_LOST_LINE = (
        workBubbleSpeech &&
        typeof workBubbleSpeech.lostLine === 'string'
    ) ? workBubbleSpeech.lostLine : FALLBACK_WORK_BUBBLE_SPEECH.lostLine;
    const OBSERVER_CARD_ONE_LINERS = (
        PhaseHelpersModule &&
        PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS &&
        typeof PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS === 'object'
    ) ? PhaseHelpersModule.OBSERVER_CARD_ONE_LINERS : Object.freeze({});

    function resolveStrongWillDisplayTimer(markerData: any) {
        if (!markerData || String(markerData.type || '').toUpperCase() !== 'PERMA_PROTECTED') return undefined;
        const rawThreshold = Number(markerData.strongWillPromotionThreshold);
        const thresholdFallback = Number(SharedConstantsModule && SharedConstantsModule.STRONG_WILL_PROMOTION_OWNER_TURNS);
        const threshold = Number.isFinite(rawThreshold)
            ? Math.max(1, Math.trunc(rawThreshold))
            : (Number.isFinite(thresholdFallback) ? Math.max(1, Math.trunc(thresholdFallback)) : 10);
        const rawProgress = Number(markerData.strongWillPromotionOwnerTurnStarts);
        const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.trunc(rawProgress)) : 0;
        return Math.max(0, threshold - progress);
    }

    function resolveSpecialStatusTimer(markerData: any) {
        const remainingOwnerTurns = Number(markerData && markerData.remainingOwnerTurns);
        if (Number.isFinite(remainingOwnerTurns)) return Math.max(0, Math.trunc(remainingOwnerTurns));
        return resolveStrongWillDisplayTimer(markerData);
    }

    function cloneDeferredPendingSelectionValue(value: any): any {
        if (Array.isArray(value)) {
            return value.map((item: any) => cloneDeferredPendingSelectionValue(item));
        }
        if (!value || typeof value !== 'object') return value;
        const cloned: Record<string, any> = {};
        const keys = Object.keys(value);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            cloned[key] = cloneDeferredPendingSelectionValue(value[key]);
        }
        return cloned;
    }

    function hydrateDeferredPendingSelectionState(pending: any, action: any) {
        if (!pending || !action || !action.pendingSelectionState || typeof action.pendingSelectionState !== 'object') {
            return false;
        }
        const transportState = action.pendingSelectionState;
        if (String(transportState.type || '').trim().toUpperCase() !== String(pending.type || '').trim().toUpperCase()) {
            return false;
        }

        const keys = Object.keys(transportState);
        let hydrated = false;
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key === 'type' || key === 'stage') continue;
            pending[key] = cloneDeferredPendingSelectionValue(transportState[key]);
            hydrated = true;
        }
        if (typeof transportState.stage === 'string' && transportState.stage) {
            pending.stage = transportState.stage;
        }
        return hydrated;
    }

    const pickRandomLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.pickRandomLine === 'function'
    )
        ? PhaseHelpersModule.pickRandomLine
        : function pickRandomLineFallback(lines: any, prng: any) {
            if (!Array.isArray(lines) || lines.length === 0) return null;
            const source = (prng && typeof prng.random === 'function') ? prng : Math;
            let value = Number(source.random());
            if (!Number.isFinite(value)) value = 0;
            if (value < 0) value = 0;
            if (value >= 1) value = 0.999999;
            const index = Math.floor(value * lines.length);
            return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
        };

    function emitSpeechBubblePresentation(CardLogic: any, cardState: any, payload: any, buildEvent: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        if (typeof buildEvent !== 'function') return;
        const data = payload || {};
        const row = Number(data.row);
        const col = Number(data.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        const ev = buildEvent(data, row, col);
        if (!ev) return;
        CardLogic.emitPresentationEvent(cardState, ev);
    }

    function emitObserverBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        emitSpeechBubblePresentation(CardLogic, cardState, payload, function buildObserverBubbleEvent(data: any, row: any, col: any) {
            return {
                type: 'OBSERVER_BUBBLE',
                player: data.player || null,
                row,
                col,
                gained: Number(data.gained) || 0,
                text: data.text || null,
                meta: { owner: data.player || null, reason: data.reason || null }
            };
        });
    }

    const resolveWorkIncomeLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.resolveWorkIncomeLine === 'function'
    )
        ? PhaseHelpersModule.resolveWorkIncomeLine
        : function resolveWorkIncomeLineFallback(gained: any) {
            return `布石+${Number(gained) || 0} 労働の成果だ`;
        };

    function emitWorkBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        emitSpeechBubblePresentation(CardLogic, cardState, payload, function buildWorkBubbleEvent(data: any, row: any, col: any) {
            const gained = Number(data.gained) || 0;
            const incomeStep = Number.isFinite(Number(data.incomeStep))
                ? Math.max(1, Math.min(5, Math.trunc(Number(data.incomeStep))))
                : null;
            const text = (typeof data.text === 'string' && data.text.trim())
                ? data.text.trim()
                : resolveWorkIncomeLine(gained, incomeStep);

            return {
                type: 'WORK_BUBBLE',
                player: data.player || null,
                row,
                col,
                gained,
                incomeStep,
                text,
                reason: data.reason || null,
                meta: {
                    owner: data.player || null,
                    reason: data.reason || null,
                    incomeStep
                }
            };
        });
    }

    const getSpecialStoneBubbleSpeechLines = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.getSpecialStoneBubbleSpeechLines === 'function'
    )
        ? PhaseHelpersModule.getSpecialStoneBubbleSpeechLines
        : function getSpecialStoneBubbleSpeechLinesFallback(type: any, scenario: any) {
            const speech = getSpecialStoneBubbleSpeech(type);
            if (!speech) return null;
            const scenarioKey = String(scenario || '').trim().toLowerCase();
            if (scenarioKey === 'place' && Array.isArray(speech.placeLines) && speech.placeLines.length > 0) {
                return speech.placeLines;
            }
            if (scenarioKey === 'destroy' && typeof speech.lostLine === 'string' && speech.lostLine) {
                return [speech.lostLine];
            }
            if (Array.isArray(speech[scenarioKey]) && speech[scenarioKey].length > 0) {
                return speech[scenarioKey];
            }
            return null;
        };

    const pickSpecialStoneBubbleSpeechLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.pickSpecialStoneBubbleSpeechLine === 'function'
    )
        ? PhaseHelpersModule.pickSpecialStoneBubbleSpeechLine
        : function pickSpecialStoneBubbleSpeechLineFallback(type: any, scenario: any, prng: any) {
            return pickRandomLine(getSpecialStoneBubbleSpeechLines(type, scenario), prng);
        };

    const LEGACY_SPECIAL_STONE_BUBBLE_TYPES: Record<string, boolean | undefined> = Object.freeze({
        OBSERVER: true,
        WORK: true
    });
    const SPECIAL_STONE_PLACEMENT_EFFECT_SPECS = Object.freeze([
        Object.freeze({ flag: 'protected', special: 'PROTECTED' }),
        Object.freeze({ flag: 'permaProtected', special: 'PERMA_PROTECTED' }),
        Object.freeze({ flag: 'regenPlaced', special: 'REGEN' }),
        Object.freeze({ flag: 'dragonPlaced', special: 'DRAGON' }),
        Object.freeze({ flag: 'breedingPlaced', special: 'BREEDING' }),
        Object.freeze({ flag: 'proliferationPlaced', special: 'PROLIFERATION' }),
        Object.freeze({ flag: 'ultimateDestroyGodPlaced', special: 'ULTIMATE_DESTROY_GOD' }),
        Object.freeze({ flag: 'sniperPlaced', special: 'SNIPER' }),
        Object.freeze({ flag: 'ghostPlaced', special: 'GHOST' }),
        Object.freeze({ flag: 'afterimagePlaced', special: 'AFTERIMAGE_WILL' }),
        Object.freeze({ flag: 'timeStopPlaced', special: 'TIME_STOP' }),
        Object.freeze({ flag: 'willHunterKingPlaced', special: 'WILL_HUNTER_KING' }),
        Object.freeze({ flag: 'destroyDragonPlaced', special: 'DESTROY_DRAGON' }),
        Object.freeze({ flag: 'lightningPlaced', special: 'LIGHTNING' }),
        Object.freeze({ flag: 'extremeHyperactivePlaced', special: 'EXTREME_HYPERACTIVE' }),
        Object.freeze({ flag: 'escapeHyperactivePlaced', special: 'ESCAPE_HYPERACTIVE' }),
        Object.freeze({ flag: 'robotVacuumPlaced', special: 'ROBOT_VACUUM' }),
        Object.freeze({ flag: 'gluttonousPlaced', special: 'GLUTTONOUS' }),
        Object.freeze({ flag: 'instantHyperactivePlaced', special: 'HYPERACTIVE' }),
        Object.freeze({ flag: 'ultimateHyperactivePlaced', special: 'ULTIMATE_HYPERACTIVE' }),
        Object.freeze({ flag: 'hyperactivePlaced', special: 'HYPERACTIVE' })
    ]);

    function normalizeSpecialStoneBubbleType(type: any) {
        const key = String(type || '').trim().toUpperCase();
        return key || null;
    }

    function normalizeSpecialStoneBubbleScenarioKey(scenario: any) {
        const key = String(scenario || '').trim().toLowerCase();
        return key || null;
    }

    function isLegacySpecialStoneBubbleType(type: any) {
        const key = normalizeSpecialStoneBubbleType(type);
        return !!(key && LEGACY_SPECIAL_STONE_BUBBLE_TYPES[key]);
    }

    function hasDurationEndMarker(reason: any, cause: any) {
        const reasonLower = String(reason || '').toLowerCase();
        const causeLower = String(cause || '').toLowerCase();
        return reasonLower === 'duration_end' || reasonLower.indexOf('duration') >= 0 || reasonLower.indexOf('expire') >= 0 || causeLower.indexOf('expire') >= 0;
    }

    function resolveSpecialStoneBubblePlayer(payload: any) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        return normalizePlayerKey(
            data.player !== undefined ? data.player
                : data.owner !== undefined ? data.owner
                    : data.ownerBefore !== undefined ? data.ownerBefore
                        : data.ownerAfter !== undefined ? data.ownerAfter
                            : (data.meta && data.meta.owner !== undefined) ? data.meta.owner : null
        );
    }

    function buildSpecialStoneBubbleKey(special: any, scenario: any, row: any, col: any, player: any) {
        const typeKey = normalizeSpecialStoneBubbleType(special);
        const scenarioKey = normalizeSpecialStoneBubbleScenarioKey(scenario);
        const rowKey = Number(row);
        const colKey = Number(col);
        if (!typeKey || !scenarioKey || !Number.isInteger(rowKey) || !Number.isInteger(colKey)) return null;
        const ownerKey = normalizePlayerKey(player) || '';
        return `${rowKey},${colKey}:${ownerKey}:${typeKey}:${scenarioKey}`;
    }

    function createSpecialStoneBubbleTracker(cardState: any, sinceIndex: any) {
        const tracker = new Set();
        const pres = (cardState && Array.isArray(cardState.presentationEvents)) ? cardState.presentationEvents : [];
        const start = Number.isFinite(Number(sinceIndex)) ? Math.max(0, Math.trunc(Number(sinceIndex))) : 0;
        for (let index = start; index < pres.length; index += 1) {
            const ev = pres[index];
            if (!ev || ev.type !== 'SPECIAL_STONE_BUBBLE') continue;
            const key = buildSpecialStoneBubbleKey(
                ev.special || (ev.meta && ev.meta.special),
                ev.scenario || (ev.meta && ev.meta.scenario),
                ev.row,
                ev.col,
                ev.player || ev.owner || (ev.meta && ev.meta.owner)
            );
            if (key) tracker.add(key);
        }
        return tracker;
    }

    function emitSpecialStoneBubblePresentation(CardLogic: any, cardState: any, payload: any, options: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return false;
        const data = (payload && typeof payload === 'object') ? payload : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const special = normalizeSpecialStoneBubbleType(data.special);
        const scenario = normalizeSpecialStoneBubbleScenarioKey(data.scenario);
        const player = resolveSpecialStoneBubblePlayer(data);
        const row = Number(data.row);
        const col = Number(data.col);
        if (!special || !scenario || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        const allowLegacy = opts.allowLegacy === true || scenario === 'living_will_restored';
        if (isLegacySpecialStoneBubbleType(special) && !allowLegacy) return false;
        const explicitText = (typeof data.text === 'string' && data.text.trim()) ? data.text.trim() : null;
        const text = explicitText || pickSpecialStoneBubbleSpeechLine(special, scenario, opts.prng);
        if (!text) return false;
        const bubbleKey = buildSpecialStoneBubbleKey(special, scenario, row, col, player);
        const tracker = opts.tracker instanceof Set ? opts.tracker : null;
        if (tracker && bubbleKey && tracker.has(bubbleKey)) return false;

        const reason = (typeof data.reason === 'string' && data.reason.trim()) ? data.reason.trim() : scenario;
        const cause = (typeof data.cause === 'string' && data.cause.trim()) ? data.cause.trim() : null;
        const meta = Object.assign({}, (data.meta && typeof data.meta === 'object') ? data.meta : {});
        meta.special = special;
        meta.scenario = scenario;
        if (typeof meta.owner === 'undefined') meta.owner = player || null;
        if (typeof meta.reason === 'undefined') meta.reason = reason;
        if (cause && typeof meta.cause === 'undefined') meta.cause = cause;
        if (typeof meta.text === 'undefined') meta.text = text;

        emitSpeechBubblePresentation(CardLogic, cardState, {
            player,
            row,
            col,
            special,
            scenario,
            text,
            reason,
            cause,
            meta
        }, function buildSpecialStoneBubbleEvent(bubbleData: any, bubbleRow: any, bubbleCol: any) {
            return {
                type: 'SPECIAL_STONE_BUBBLE',
                special,
                scenario,
                player,
                row: bubbleRow,
                col: bubbleCol,
                text,
                reason,
                cause,
                meta
            };
        });

        if (tracker && bubbleKey) tracker.add(bubbleKey);
        return true;
    }

    function resolvePlacedSpecialStoneType(effects: any) {
        const data = (effects && typeof effects === 'object') ? effects : null;
        if (!data) return null;
        for (let index = 0; index < SPECIAL_STONE_PLACEMENT_EFFECT_SPECS.length; index += 1) {
            const spec = SPECIAL_STONE_PLACEMENT_EFFECT_SPECS[index];
            if (data[spec.flag] === true) {
                return spec.special;
            }
        }
        return null;
    }

    function emitSpecialStonePlacementBubbleFromEffects(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, effects: any, prng: any) {
        const special = resolvePlacedSpecialStoneType(effects);
        if (!special) return false;
        return emitSpecialStoneBubblePresentation(CardLogic, cardState, {
            player: playerKey,
            row,
            col,
            special,
            scenario: 'place',
            reason: 'placed'
        }, { prng });
    }

    function emitChargeBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = payload || {};
        const row = Number(data.row);
        const col = Number(data.col);
        const gained = Number(data.gained);
        if (!Number.isInteger(row) || !Number.isInteger(col) || !(gained > 0)) return;

        const explicitText = (typeof data.text === 'string' && data.text.trim()) ? data.text.trim() : null;
        const sourceType = (typeof data.sourceType === 'string' && data.sourceType.trim()) ? data.sourceType.trim() : null;
        CardLogic.emitPresentationEvent(cardState, {
            type: 'CHARGE_BUBBLE',
            player: data.player || null,
            row,
            col,
            gained,
            text: explicitText,
            meta: {
                owner: data.player || null,
                sourceType
            }
        });
    }

    function snapshotWorkMarkers(cardState: any) {
        const markers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        const out = [];
        for (const m of markers) {
            if (!m) continue;
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const markerType = String(m.data && m.data.type ? m.data.type : '').toUpperCase();
            if (markerType !== 'WORK') continue;
            if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const markerId = (m.id !== undefined && m.id !== null)
                ? String(m.id)
                : `${m.row},${m.col}:${m.owner || ''}:${m.createdSeq || 0}`;
            out.push({
                key: markerId,
                row: m.row,
                col: m.col,
                owner: (typeof m.owner === 'string' && m.owner) ? m.owner : null
            });
        }
        return out;
    }

    function getRemovedWorkMarkers(beforeSnapshot: any, afterSnapshot: any) {
        const before = Array.isArray(beforeSnapshot) ? beforeSnapshot : [];
        const after = Array.isArray(afterSnapshot) ? afterSnapshot : [];
        const afterSet = new Set(after.map((item: any) => item && item.key).filter((key: any) => !!key));
        return before.filter((item: any) => {
            if (!item || !item.key) return false;
            if (!Number.isInteger(item.row) || !Number.isInteger(item.col)) return false;
            return !afterSet.has(item.key);
        });
    }

    function isWorkDurationEndPresentationEvent(ev: any) {
        if (!ev || !ev.type) return false;
        if (ev.type === 'WORK_INCOME') {
            if (ev.removed !== true) return false;
        } else if (ev.type === 'WORK_REMOVED') {
            if (ev.removed === false) return false;
        } else {
            return false;
        }
        const reason = String((ev.reason || (ev.meta && ev.meta.reason) || '')).toLowerCase();
        const cause = String(ev.cause || '').toLowerCase();
        return hasDurationEndMarker(reason, cause);
    }

    function hasWorkRemovedPresentationEventAt(cardState: any, row: any, col: any, sinceIndex: any) {
        const pres = (cardState && Array.isArray(cardState.presentationEvents)) ? cardState.presentationEvents : [];
        const start = Number.isFinite(Number(sinceIndex)) ? Math.max(0, Math.trunc(Number(sinceIndex))) : 0;
        for (let i = start; i < pres.length; i++) {
            const ev = pres[i];
            if (!ev || ev.type !== 'WORK_REMOVED') continue;
            if (Number(ev.row) === Number(row) && Number(ev.col) === Number(col)) return true;
        }
        return false;
    }

    function emitWorkRemovedPresentationFromSnapshots(CardLogic: any, cardState: any, beforeSnapshot: any, options: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const opts = options || {};
        const afterSnapshot = snapshotWorkMarkers(cardState);
        const removed = getRemovedWorkMarkers(beforeSnapshot, afterSnapshot);
        if (!removed.length) return;

        const durationEndSet = (opts.durationEndSet instanceof Set) ? opts.durationEndSet : new Set();
        const presentationStartIndex = Number.isFinite(Number(opts.presentationStartIndex))
            ? Math.max(0, Math.trunc(Number(opts.presentationStartIndex)))
            : 0;

        for (const item of removed) {
            if (!item) continue;
            const markerKey = `${item.row},${item.col}:${item.owner || ''}`;
            if (durationEndSet.has(markerKey)) continue;
            if (hasWorkRemovedPresentationEventAt(cardState, item.row, item.col, presentationStartIndex)) continue;
            CardLogic.emitPresentationEvent(cardState, {
                type: 'WORK_REMOVED',
                player: item.owner || null,
                row: item.row,
                col: item.col,
                removed: true,
                reason: 'anchor_lost',
                meta: { reason: 'anchor_lost' }
            });
        }
    }

    function snapshotObserverMarkers(cardState: any) {
        const markers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        const out = [];
        for (const m of markers) {
            if (!m) continue;
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const markerType = String(m.data && m.data.type ? m.data.type : '').toUpperCase();
            if (markerType !== 'OBSERVER') continue;
            if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const markerId = (m.id !== undefined && m.id !== null)
                ? String(m.id)
                : `${m.row},${m.col}:${m.owner || ''}:${m.createdSeq || 0}`;
            out.push({
                key: markerId,
                row: m.row,
                col: m.col,
                owner: (typeof m.owner === 'string' && m.owner) ? m.owner : null
            });
        }
        return out;
    }

    function getRemovedObserverMarkers(beforeSnapshot: any, afterSnapshot: any) {
        const before = Array.isArray(beforeSnapshot) ? beforeSnapshot : [];
        const after = Array.isArray(afterSnapshot) ? afterSnapshot : [];
        const afterSet = new Set(after.map((item: any) => item && item.key).filter((key: any) => !!key));
        return before.filter((item: any) => {
            if (!item || !item.key) return false;
            if (!Number.isInteger(item.row) || !Number.isInteger(item.col)) return false;
            return !afterSet.has(item.key);
        });
    }

    function emitObserverLostBubbleFromSnapshots(CardLogic: any, cardState: any, beforeSnapshot: any, reason: any) {
        const afterSnapshot = snapshotObserverMarkers(cardState);
        const removed = getRemovedObserverMarkers(beforeSnapshot, afterSnapshot);
        const first = removed[0] || null;
        if (!first) return;
        emitObserverBubblePresentation(CardLogic, cardState, {
            player: first.owner || null,
            row: first.row,
            col: first.col,
            text: OBSERVER_LOST_LINE,
            reason: reason || 'removed'
        });
    }

    function isGenericSpecialStoneBubbleType(type: any) {
        const key = normalizeSpecialStoneBubbleType(type);
        return !!key && !isLegacySpecialStoneBubbleType(key);
    }

    function snapshotSpecialStoneSpeechMarkers(cardState: any) {
        const markers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
        const out = [];
        for (const m of markers) {
            if (!m) continue;
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const markerType = String(m.data && m.data.type ? m.data.type : '').trim().toUpperCase();
            if (!isGenericSpecialStoneBubbleType(markerType)) continue;
            if (
                !getSpecialStoneBubbleSpeechLines(markerType, 'destroy') &&
                !getSpecialStoneBubbleSpeechLines(markerType, 'duration_end') &&
                !getSpecialStoneBubbleSpeechLines(markerType, 'escape_exploded')
            ) {
                continue;
            }
            if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const markerId = (m.id !== undefined && m.id !== null)
                ? String(m.id)
                : `${m.row},${m.col}:${m.owner || ''}:${markerType}:${m.createdSeq || 0}`;
            out.push({
                key: markerId,
                row: m.row,
                col: m.col,
                owner: (typeof m.owner === 'string' && m.owner) ? m.owner : null,
                type: markerType
            });
        }
        return out;
    }

    function getRemovedSpecialStoneSpeechMarkers(beforeSnapshot: any, afterSnapshot: any) {
        const before = Array.isArray(beforeSnapshot) ? beforeSnapshot : [];
        const after = Array.isArray(afterSnapshot) ? afterSnapshot : [];
        const afterSet = new Set(after.map((item: any) => item && item.key).filter((key: any) => !!key));
        return before.filter((item: any) => {
            if (!item || !item.key || !item.type) return false;
            if (!Number.isInteger(item.row) || !Number.isInteger(item.col)) return false;
            return !afterSet.has(item.key);
        });
    }

    function isDurationEndSpecialStoneBubbleReason(reason: any, cause: any) {
        return hasDurationEndMarker(reason, cause);
    }

    function isEscapeExplosionSpecialStoneBubbleReason(reason: any, cause: any) {
        const reasonText = String(reason || '').toLowerCase();
        const causeText = String(cause || '').toLowerCase();
        return reasonText.indexOf('escape_no_candidates_explosion') >= 0 ||
            reasonText.indexOf('no_candidates_explosion') >= 0 ||
            causeText.indexOf('escape_no_candidates_explosion') >= 0 ||
            causeText.indexOf('no_candidates_explosion') >= 0;
    }

    function isProliferationTriggeredSpecialStoneBubbleEvent(ev: any, reason: any, cause: any) {
        const reasonText = String(reason || '').toLowerCase();
        const causeText = String(cause || '').toLowerCase();
        return !!(
            (ev && ev.meta && ev.meta.proliferated === true) ||
            reasonText === 'proliferation_triggered' ||
            causeText === 'proliferation_triggered'
        );
    }

    function findMatchingSpecialStoneStatusRemovedEvent(presentationEvents: any, item: any) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        if (!item || !item.type) return null;
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!ev || ev.type !== 'STATUS_REMOVED') continue;
            if (Number(ev.row) !== Number(item.row) || Number(ev.col) !== Number(item.col)) continue;
            const special = String((ev.special || (ev.meta && ev.meta.special) || '')).trim().toUpperCase();
            if (special !== item.type) continue;
            return ev;
        }
        return null;
    }

    function hasMatchingSpecialStoneStatusAppliedEvent(presentationEvents: any, itemOrSpecial: any, rowValue: any, colValue: any) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        const item = (itemOrSpecial && typeof itemOrSpecial === 'object')
            ? itemOrSpecial
            : { type: itemOrSpecial, row: rowValue, col: colValue };
        const specialType = String(item && item.type ? item.type : '').trim().toUpperCase();
        if (!specialType) return false;
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!ev || ev.type !== 'STATUS_APPLIED') continue;
            if (Number(ev.row) !== Number(item.row) || Number(ev.col) !== Number(item.col)) continue;
            const special = String((ev.special || (ev.meta && ev.meta.special) || '')).trim().toUpperCase();
            if (special !== specialType) continue;
            return true;
        }
        return false;
    }

    function hasMatchingSpecialStoneMovedFromPhaseEvent(phaseEvents: any, item: any) {
        const events = Array.isArray(phaseEvents) ? phaseEvents : [];
        if (!item || !item.type) return false;
        const specialType = String(item.type || '').trim().toUpperCase();
        if (!specialType) return false;
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!ev || typeof ev.type !== 'string' || ev.type.indexOf('_moved_') < 0) continue;
            const details = Array.isArray(ev.details) ? ev.details : [];
            for (let detailIndex = 0; detailIndex < details.length; detailIndex += 1) {
                const detail = details[detailIndex];
                const from = detail && detail.from;
                if (!from) continue;
                if (Number(from.row) !== Number(item.row) || Number(from.col) !== Number(item.col)) continue;
                const detailSpecial = String((detail && (detail.specialType || detail.type)) || '').trim().toUpperCase();
                if (detailSpecial && detailSpecial !== specialType) continue;
                return true;
            }
        }
        return false;
    }

    function hasEscapeExplosionPresentationEventAt(presentationEvents: any, item: any) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        if (!item) return false;
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!ev) continue;
            if (Number(ev.row) !== Number(item.row) || Number(ev.col) !== Number(item.col)) continue;
            if (isEscapeExplosionSpecialStoneBubbleReason(ev.reason || (ev.meta && ev.meta.reason), ev.cause || (ev.meta && ev.meta.cause))) {
                return true;
            }
        }
        return false;
    }

    function hasRegenTriggeredPresentationEventAt(presentationEvents: any, row: any, col: any) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!ev || ev.type !== 'CHANGE') continue;
            if (Number(ev.row) !== Number(row) || Number(ev.col) !== Number(col)) continue;
            if (String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase() !== 'regen_triggered') continue;
            return true;
        }
        return false;
    }

    function isLivingWillRestorePresentationEvent(ev: any) {
        if (!ev || (ev.type !== 'SPAWN' && ev.type !== 'CHANGE')) return false;
        const meta = (ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
        const cause = String((ev.cause || (meta && meta.cause) || '')).trim().toUpperCase();
        const reason = String((ev.reason || (meta && meta.reason) || '')).trim().toLowerCase();
        return !!((meta && meta.livingWillRevived === true) || (cause === 'LIVING_WILL' && reason === 'living_will_restored'));
    }

    function findMatchingLivingWillRestorePresentationEvent(presentationEvents: any, itemOrSpecial: any, rowValue: any, colValue: any) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        const item = (itemOrSpecial && typeof itemOrSpecial === 'object')
            ? itemOrSpecial
            : { type: itemOrSpecial, row: rowValue, col: colValue };
        const sourceRow = Number(item && item.row);
        const sourceCol = Number(item && item.col);
        if (!Number.isInteger(sourceRow) || !Number.isInteger(sourceCol)) return null;
        for (let index = 0; index < events.length; index += 1) {
            const ev = events[index];
            if (!isLivingWillRestorePresentationEvent(ev)) continue;
            const meta = (ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
            const destMatches = Number(ev.row) === sourceRow && Number(ev.col) === sourceCol;
            const sourceMatches =
                Number(meta.revivedFromRow) === sourceRow &&
                Number(meta.revivedFromCol) === sourceCol;
            if (!destMatches && !sourceMatches) continue;
            return ev;
        }
        return null;
    }

    function emitBoardChargeBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        const data = (payload && typeof payload === 'object') ? payload : null;
        if (!data) return;
        const gained = Number(data.gained);
        if (!(gained > 0)) return;
        emitChargeBubblePresentation(CardLogic, cardState, {
            player: data.player || null,
            row: data.row,
            col: data.col,
            gained,
            sourceType: data.sourceType || null,
            text: data.text || null
        });
    }

    function buildBoardChargeDeltaMeta(row: any, col: any, sourceType: any) {
        const anchorRow = Number(row);
        const anchorCol = Number(col);
        if (!Number.isInteger(anchorRow) || !Number.isInteger(anchorCol)) {
            throw new Error('TurnPipelinePhases board charge popup requires integer anchorRow/anchorCol');
        }
        const meta: Record<string, any> = {
            popupKind: 'board',
            anchorRow,
            anchorCol
        };
        if (typeof sourceType === 'string' && sourceType.trim()) {
            meta.sourceType = sourceType.trim();
        }
        return meta;
    }

    function resolveBoardChargeAnchor(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const moved = Array.isArray(opts.moved) ? opts.moved : [];
        for (let index = moved.length - 1; index >= 0; index--) {
            const entry = moved[index];
            const to = entry && entry.to;
            const row = Number(to && to.row);
            const col = Number(to && to.col);
            if (Number.isInteger(row) && Number.isInteger(col)) {
                return { row, col };
            }
        }

        const targetRow = Number(opts.targetRow);
        const targetCol = Number(opts.targetCol);
        if (Number.isInteger(targetRow) && Number.isInteger(targetCol)) {
            return { row: targetRow, col: targetCol };
        }

        const anchorRow = Number(opts.anchorRow);
        const anchorCol = Number(opts.anchorCol);
        if (Number.isInteger(anchorRow) && Number.isInteger(anchorCol)) {
            return { row: anchorRow, col: anchorCol };
        }

        throw new Error('TurnPipelinePhases board charge popup requires a resolved anchor');
    }

    function resolveBoardChargeGainContext(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const anchor = resolveBoardChargeAnchor(opts);
        return {
            anchor,
            reason: opts.reason || 'turn_start_effect',
            sourceType: opts.sourceType || null,
            text: opts.text || null,
            moved: opts.moved
        };
    }

    function applyResolvedBoardChargeGain(cardState: any, playerKey: any, amount: any, context: any) {
        const ctx = (context && typeof context === 'object') ? context : {};
        const anchor = (ctx.anchor && Number.isInteger(Number(ctx.anchor.row)) && Number.isInteger(Number(ctx.anchor.col)))
            ? { row: Number(ctx.anchor.row), col: Number(ctx.anchor.col) }
            : resolveBoardChargeAnchor(ctx);
        const gained = addChargeWithTotal(cardState, playerKey, amount, {
            reason: ctx.reason || 'turn_start_effect',
            popupKind: 'board',
            sourceType: ctx.sourceType || null,
            moved: ctx.moved,
            targetRow: anchor.row,
            targetCol: anchor.col
        });
        return {
            anchor,
            gained,
            sourceType: ctx.sourceType || null,
            text: ctx.text || null
        };
    }

    function clonePendingRoundBonusPayload(value: any) {
        if (!value || typeof value !== 'object') return null;
        const roundNumber = Number.isFinite(Number(value.roundNumber))
            ? Math.max(1, Math.trunc(Number(value.roundNumber)))
            : 1;
        const amount = Number.isFinite(Number(value.amount))
            ? Math.max(0, Math.trunc(Number(value.amount)))
            : 0;
        if (!(amount > 0)) return null;
        return { roundNumber, amount };
    }

    function ensureGameRoundState(Core: any, gameState: any) {
        if (!gameState || typeof gameState !== 'object') return gameState;
        if (Core && typeof Core.ensureRoundState === 'function') {
            return Core.ensureRoundState(gameState);
        }
        const roundNumber = Number.isFinite(Number(gameState.roundNumber))
            ? Math.max(1, Math.trunc(Number(gameState.roundNumber)))
            : 1;
        const progress = (gameState.roundCompletionByPlayer && typeof gameState.roundCompletionByPlayer === 'object')
            ? gameState.roundCompletionByPlayer
            : {};
        gameState.roundNumber = roundNumber;
        gameState.roundCompletionByPlayer = {
            black: !!progress.black,
            white: !!progress.white
        };
        gameState.pendingRoundBonus = clonePendingRoundBonusPayload(gameState.pendingRoundBonus);
        return gameState;
    }

    function resolveRoundBonusAmountForGame(Core: any, roundNumber: any) {
        if (Core && typeof Core.resolveRoundBonusAmount === 'function') {
            return Core.resolveRoundBonusAmount(roundNumber);
        }
        const normalizedRound = Number.isFinite(Number(roundNumber))
            ? Math.max(1, Math.trunc(Number(roundNumber)))
            : 1;
        if (normalizedRound % 10 !== 0) return 0;
        return Math.max(0, Math.floor(normalizedRound / 2));
    }

    function advanceGameRoundAfterCompletedTurn(Core: any, gameState: any, playerKey: any, options: any) {
        if (Core && typeof Core.advanceRoundAfterCompletedTurn === 'function') {
            return Core.advanceRoundAfterCompletedTurn(gameState, playerKey, options);
        }
        const state = ensureGameRoundState(Core, gameState);
        const key = normalizePlayerKey(playerKey);
        const opts = (options && typeof options === 'object') ? options : {};
        if (!state || !key) {
            return {
                advanced: false,
                roundNumber: state ? state.roundNumber : 1,
                pendingRoundBonus: clonePendingRoundBonusPayload(state && state.pendingRoundBonus)
            };
        }
        state.roundCompletionByPlayer[key] = true;
        if (!state.roundCompletionByPlayer.black || !state.roundCompletionByPlayer.white) {
            return {
                advanced: false,
                roundNumber: state.roundNumber,
                pendingRoundBonus: clonePendingRoundBonusPayload(state.pendingRoundBonus)
            };
        }
        state.roundNumber = Math.max(1, Math.trunc(Number(state.roundNumber || 1))) + 1;
        state.roundCompletionByPlayer = { black: false, white: false };
        if (opts.scheduleBonus !== false) {
            const amount = resolveRoundBonusAmountForGame(Core, state.roundNumber);
            state.pendingRoundBonus = amount > 0
                ? { roundNumber: state.roundNumber, amount }
                : null;
        }
        return {
            advanced: true,
            roundNumber: state.roundNumber,
            pendingRoundBonus: clonePendingRoundBonusPayload(state.pendingRoundBonus)
        };
    }

    function consumePendingRoundBonusFromGame(Core: any, gameState: any) {
        if (Core && typeof Core.consumePendingRoundBonus === 'function') {
            return Core.consumePendingRoundBonus(gameState);
        }
        const state = ensureGameRoundState(Core, gameState);
        if (!state) return null;
        const pending = clonePendingRoundBonusPayload(state.pendingRoundBonus);
        state.pendingRoundBonus = null;
        return pending;
    }

    function emitRoundBonusBannerPresentation(CardLogic: any, cardState: any, payload: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = (payload && typeof payload === 'object') ? payload : null;
        const roundNumber = Number.isFinite(Number(data && data.roundNumber))
            ? Math.max(1, Math.trunc(Number(data.roundNumber)))
            : 0;
        const amount = Number.isFinite(Number(data && data.amount))
            ? Math.max(0, Math.trunc(Number(data.amount)))
            : 0;
        if (!(roundNumber > 0) || !(amount > 0)) return;
        CardLogic.emitPresentationEvent(cardState, {
            type: 'ROUND_BONUS_BANNER',
            roundNumber,
            amount,
            durationMs: 3000,
            text: `BONUS ROUND +${amount}`
        });
    }

    function applyPendingRoundBonusAtTurnStart(CardLogic: any, Core: any, cardState: any, gameState: any, events: any) {
        ensureGameRoundState(Core, gameState);
        const pending = consumePendingRoundBonusFromGame(Core, gameState);
        if (!pending) return null;
        const amount = Number.isFinite(Number(pending.amount))
            ? Math.max(0, Math.trunc(Number(pending.amount)))
            : 0;
        const roundNumber = Number.isFinite(Number(pending.roundNumber))
            ? Math.max(1, Math.trunc(Number(pending.roundNumber)))
            : 1;
        if (!(amount > 0)) return null;

        const blackGained = addChargeWithTotal(cardState, 'black', amount, { reason: 'round_bonus' });
        const whiteGained = addChargeWithTotal(cardState, 'white', amount, { reason: 'round_bonus' });
        if (!(blackGained > 0) && !(whiteGained > 0)) {
            return {
                roundNumber,
                amount,
                gainedByPlayer: { black: 0, white: 0 }
            };
        }

        emitRoundBonusBannerPresentation(CardLogic, cardState, {
            roundNumber,
            amount
        });
        if (Array.isArray(events)) {
            events.push({
                type: 'round_bonus_gain',
                roundNumber,
                amount,
                gainedByPlayer: { black: blackGained, white: whiteGained }
            });
        }
        return {
            roundNumber,
            amount,
            gainedByPlayer: { black: blackGained, white: whiteGained }
        };
    }

    function applyPlacementBoardBonusGain(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, amount: any, flipCount: any) {
        const gained = addChargeWithTotal(cardState, playerKey, amount, {
            reason: 'board_bonus_gain',
            popupKind: 'board',
            sourceType: 'number_cell_gain',
            anchorRow: row,
            anchorCol: col
        });
        if (gained > 0 && !(flipCount > 0)) {
            emitBoardChargeBubblePresentation(CardLogic, cardState, {
                player: playerKey,
                row,
                col,
                gained,
                sourceType: 'number_cell_gain'
            });
        }
        return gained;
    }

    function buildPlacementChargeBubblePayload(playerKey: any, row: any, col: any, flipCount: any, boardBonusGained: any, effects: any) {
        const flipGain = Number(effects && effects.chargeGained) || 0;
        const mergedBoardBonus = flipCount > 0 ? (Number(boardBonusGained) || 0) : 0;
        const totalGain = flipGain + mergedBoardBonus;
        if (!(flipCount > 0) || !(totalGain > 0)) return null;
        return {
            player: playerKey,
            row,
            col,
            gained: totalGain,
            sourceType: mergedBoardBonus > 0 ? 'placement_action_gain' : 'placement_flip_gain'
        };
    }

    function addChargeWithTotal(cardState: any, playerKey: any, amount: any, options: any) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };
        const before = cardState.charge[playerKey] || 0;
        const chargeMax = Number.isFinite(Number(CHARGE_MAX)) && Number(CHARGE_MAX) > 0
            ? Number(CHARGE_MAX)
            : 99;
        const opts = (options && typeof options === 'object') ? options : null;
        const boardAnchor = (opts && opts.popupKind === 'board')
            ? resolveBoardChargeAnchor(opts)
            : null;
        const reason = (opts && typeof opts.reason === 'string' && opts.reason.trim())
            ? opts.reason.trim()
            : 'turn_start_effect';
        const deltaMeta = (opts && opts.popupKind === 'board')
            ? buildBoardChargeDeltaMeta(boardAnchor!.row, boardAnchor!.col, opts.sourceType)
            : null;
        const deltaRes = (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function')
            ? CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, reason, deltaMeta)
            : null;
        let added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
        if (!deltaRes || (Number(amount) > 0 && added <= 0 && before < chargeMax && (cardState.charge[playerKey] || 0) <= before)) {
            const after = Math.min(chargeMax, before + amount);
            cardState.charge[playerKey] = after;
            added = after - before;
        }
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function awardBoardChargeGain(CardLogic: any, cardState: any, playerKey: any, amount: any, options: any) {
        const context = resolveBoardChargeGainContext(options);
        const gainResult = applyResolvedBoardChargeGain(cardState, playerKey, amount, context);
        if (gainResult.gained > 0) {
            emitBoardChargeBubblePresentation(CardLogic, cardState, {
                player: playerKey,
                row: gainResult.anchor.row,
                col: gainResult.anchor.col,
                gained: gainResult.gained,
                sourceType: gainResult.sourceType,
                text: gainResult.text
            });
        }
        return gainResult.gained;
    }

    function transferChargeBetweenPlayers(cardState: any, fromPlayerKey: any, toPlayerKey: any, amount: any, reasonKey: any) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };

        const fromCharge = Math.max(0, Number(cardState.charge[fromPlayerKey] || 0));
        const toCharge = Math.max(0, Number(cardState.charge[toPlayerKey] || 0));
        const toRoom = Math.max(0, CHARGE_MAX - toCharge);
        const requested = Math.max(0, Number(amount) || 0);
        const movable = Math.min(requested, fromCharge, toRoom);
        if (movable <= 0) return 0;

        const gained = addChargeWithTotal(cardState, toPlayerKey, movable, null);
        if (gained <= 0) return 0;

        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            CardUtilsModule.addChargeWithDelta(cardState, fromPlayerKey, -gained, `${reasonKey || 'transfer'}_loss`);
        } else {
            cardState.charge[fromPlayerKey] = Math.max(0, fromCharge - gained);
        }
        return gained;
    }

    function consumeTimeStopCompletedTurn(CardLogic: any, cardState: any, playerKey: any) {
        if (!CardLogic || typeof CardLogic.consumeTimeStopConsecutiveTurn !== 'function') {
            return { consumed: false, remaining: 0, continueTurn: false };
        }
        return CardLogic.consumeTimeStopConsecutiveTurn(cardState, playerKey) || { consumed: false, remaining: 0, continueTurn: false };
    }

    function handOffCompletedTurn(Core: any, CardLogic: any, cardState: any, gameState: any, playerKey: any, turnNumberAfterCompletion: any) {
        if (!Core || !gameState) return { continued: false, remaining: 0 };
        const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        const turnNumber = Number.isFinite(Number(turnNumberAfterCompletion))
            ? Number(turnNumberAfterCompletion)
            : (Number(gameState.turnNumber || 0) + 1);
        advanceGameRoundAfterCompletedTurn(Core, gameState, playerKey, null);
        const timeStopRes = consumeTimeStopCompletedTurn(CardLogic, cardState, playerKey);
        if (timeStopRes.continueTurn === true) {
            gameState.currentPlayer = playerValue;
            gameState.consecutivePasses = 0;
            gameState.turnNumber = turnNumber;
            if (cardState) {
                cardState.lastTurnStartedFor = null;
            }
            return { continued: true, remaining: Number(timeStopRes.remaining) || 0 };
        }
        gameState.currentPlayer = -playerValue;
        gameState.consecutivePasses = 0;
        gameState.turnNumber = turnNumber;
        return { continued: false, remaining: 0 };
    }

    function handOffTurnAfterSelection(Core: any, CardLogic: any, cardState: any, gameState: any, playerKey: any) {
        if (!Core || !gameState) return;
        const turnNumberBeforeAction = Number(gameState.turnNumber || 0);
        handOffCompletedTurn(Core, CardLogic, cardState, gameState, playerKey, turnNumberBeforeAction + 1);
    }

    function pushTrapEvents(events: any, trapRes: any) {
        if (!events || !trapRes) return;
        if (Array.isArray(trapRes.triggered) && trapRes.triggered.length > 0) {
            events.push({ type: 'trap_triggered', details: trapRes.triggered.slice() });
        }
        if (Array.isArray(trapRes.expired) && trapRes.expired.length > 0) {
            events.push({ type: 'trap_expired', details: trapRes.expired.slice() });
        }
        if (Array.isArray(trapRes.disarmed) && trapRes.disarmed.length > 0) {
            events.push({ type: 'trap_disarmed', details: trapRes.disarmed.slice() });
        }
    }

    function normalizePlayerKey(player: any) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(player);
            if (normalized) return normalized;
        }
        if (player === 'black' || player === 1 || player === '1') return 'black';
        if (player === 'white' || player === -1 || player === '-1') return 'white';
        return null;
    }

    function createSpecialStoneBubbleEmitter(CardLogic: any, cardState: any, prng: any, fallbackPlayer: any, tracker: any) {
        const emitted = tracker instanceof Set ? tracker : new Set();
        return function emitSpecialStoneBubble(data: any) {
            const payload = (data && typeof data === 'object') ? data : null;
            if (!payload) return false;
            const special = String(payload.special || '').trim().toUpperCase();
            const scenario = String(payload.scenario || '').trim().toLowerCase();
            const row = Number(payload.row);
            const col = Number(payload.col);
            if (!special || !scenario || !Number.isInteger(row) || !Number.isInteger(col)) return false;
            const player = normalizePlayerKey(payload.player || fallbackPlayer);
            const text = (typeof payload.text === 'string' && payload.text.trim())
                ? payload.text.trim()
                : pickSpecialStoneBubbleSpeechLine(special, scenario, prng);
            if (!text) return false;
            const key = buildSpecialStoneBubbleKey(special, scenario, row, col, player);
            if (emitted.has(key)) return false;
            return emitSpecialStoneBubblePresentation(CardLogic, cardState, {
                player,
                row,
                col,
                special,
                scenario,
                text,
                reason: payload.reason || scenario,
                cause: payload.cause || null
            }, {
                prng,
                tracker: emitted
            });
        };
    }

    function emitSpecialStoneBubblesFromPhase(CardLogic: any, cardState: any, options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const presentationEvents = Array.isArray(opts.presentationEvents) ? opts.presentationEvents : [];
        const phaseEvents = Array.isArray(opts.events) ? opts.events : [];
        const beforeSnapshot = Array.isArray(opts.beforeSnapshot) ? opts.beforeSnapshot : [];
        const tracker = createSpecialStoneBubbleTracker(cardState, opts.presentationStartIndex);
        const emitBubble = createSpecialStoneBubbleEmitter(CardLogic, cardState, opts.prng, opts.fallbackPlayer || null, tracker);
        const deferredPhaseEvents = [];
        const pendingWillHunterSpecialDestroyCells = new Set();

        for (const ev of phaseEvents) {
            if (!ev || !ev.type) continue;
            if (ev.type === 'placement_effects') {
                const special = resolvePlacedSpecialStoneType(ev.effects);
                if (!special) continue;
                emitBubble({
                    special,
                    scenario: 'place',
                    player: ev.player || opts.fallbackPlayer || null,
                    row: ev.row,
                    col: ev.col,
                    reason: 'placed'
                });
            } else if (ev.type === 'time_stop_triggered') {
                deferredPhaseEvents.push(ev);
            } else if (ev.type === 'hyperactive_inherit_selected' && ev.applied && ev.target) {
                emitBubble({
                    special: 'INHERITED_HYPERACTIVE',
                    scenario: 'inherit_selected',
                    player: ev.player || opts.fallbackPlayer || null,
                    row: ev.target.row,
                    col: ev.target.col,
                    reason: ev.type
                });
                emitBubble({
                    special: 'INHERITED_HYPERACTIVE',
                    scenario: 'inherit_applied',
                    player: ev.player || opts.fallbackPlayer || null,
                    row: ev.target.row,
                    col: ev.target.col,
                    reason: 'inherit_applied'
                });
            } else if ((ev.type === 'will_hunter_king_destroyed_start' || ev.type === 'will_hunter_king_destroyed_immediate') && Array.isArray(ev.details)) {
                for (const detail of ev.details) {
                    const row = Number(detail && detail.row);
                    const col = Number(detail && detail.col);
                    if (detail && detail.destroyedSpecial === true && Number.isInteger(row) && Number.isInteger(col)) {
                        pendingWillHunterSpecialDestroyCells.add(`${row},${col}`);
                    }
                }
            } else if ((ev.type === 'will_hunter_king_moved_start' || ev.type === 'will_hunter_king_moved_immediate') && Array.isArray(ev.details)) {
                for (const detail of ev.details) {
                    const to = detail && detail.to;
                    const row = Number(to && to.row);
                    const col = Number(to && to.col);
                    const key = (Number.isInteger(row) && Number.isInteger(col)) ? `${row},${col}` : null;
                    if (!key || !pendingWillHunterSpecialDestroyCells.has(key)) continue;
                    emitBubble({
                        special: 'WILL_HUNTER_KING',
                        scenario: 'special_destroy_triggered',
                        player: ev.player || opts.fallbackPlayer || null,
                        row,
                        col,
                        reason: ev.type,
                        cause: 'WILL_HUNTER_KING'
                    });
                    pendingWillHunterSpecialDestroyCells.delete(key);
                }
            }
        }

        for (const ev of presentationEvents) {
            if (!ev || !ev.type) continue;
            const row = Number(ev.row);
            const col = Number(ev.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            const special = String((ev.special || (ev.meta && ev.meta.special) || '')).trim().toUpperCase();
            const reason = ev.reason || (ev.meta && ev.meta.reason) || null;
            const cause = ev.cause || (ev.meta && ev.meta.cause) || null;
            const player = normalizePlayerKey(ev.player || ev.owner || (ev.meta && ev.meta.owner) || opts.fallbackPlayer);

            if ((ev.type === 'CHANGE' || ev.type === 'SPAWN') && isLivingWillRestorePresentationEvent(ev)) {
                if (getSpecialStoneBubbleSpeechLines(special, 'living_will_restored')) {
                    emitBubble({
                        special,
                        scenario: 'living_will_restored',
                        player,
                        row,
                        col,
                        reason: reason || 'living_will_restored',
                        cause,
                        meta: Object.assign({}, (ev.meta && typeof ev.meta === 'object') ? ev.meta : {})
                    });
                }
                continue;
            }

            if (ev.type === 'STATUS_APPLIED') {
                if (!isGenericSpecialStoneBubbleType(special)) continue;
                if (special === 'ABSOLUTE_PROTECTED' && String(reason || '').toLowerCase() === 'strong_will_promoted') {
                    emitBubble({
                        special,
                        scenario: 'absolute_protected_promoted',
                        player,
                        row,
                        col,
                        reason: reason || 'strong_will_promoted',
                        cause
                    });
                    continue;
                }
                if (special === 'INHERITED_HYPERACTIVE') {
                    emitBubble({
                        special,
                        scenario: 'inherit_applied',
                        player,
                        row,
                        col,
                        reason: reason || 'inherit_applied',
                        cause
                    });
                    continue;
                }
                continue;
            }

            if (ev.type === 'STATUS_REMOVED') {
                if (!isGenericSpecialStoneBubbleType(special)) continue;
                const durationEnd = isDurationEndSpecialStoneBubbleReason(reason, cause);
                const escapeExploded = isEscapeExplosionSpecialStoneBubbleReason(reason, cause);
                if (special === 'REGEN' && hasRegenTriggeredPresentationEventAt(presentationEvents, row, col)) {
                    continue;
                }
                if (findMatchingLivingWillRestorePresentationEvent(presentationEvents, special, row, col)) {
                    continue;
                }
                if (!durationEnd && !escapeExploded && hasMatchingSpecialStoneStatusAppliedEvent(presentationEvents, special, row, col)) {
                    continue;
                }
                const scenario = escapeExploded && getSpecialStoneBubbleSpeechLines(special, 'escape_exploded')
                    ? 'escape_exploded'
                    : (durationEnd ? 'duration_end' : 'destroy');
                emitBubble({
                    special,
                    scenario,
                    player,
                    row,
                    col,
                    reason: reason || scenario,
                    cause
                });
                continue;
            }

            if ((ev.type === 'CHANGE' || ev.type === 'DESTROY') && ev.meta && ev.meta.blockedByGhost === true && special === 'GHOST') {
                emitBubble({
                    special,
                    scenario: 'ghost_protected',
                    player,
                    row,
                    col,
                    reason: reason || 'ghost_protected',
                    cause
                });
                continue;
            }

            if (ev.type === 'DESTROY' && isGenericSpecialStoneBubbleType(special)) {
                if (findMatchingLivingWillRestorePresentationEvent(presentationEvents, special, row, col)) {
                    continue;
                }
                const scenario = isProliferationTriggeredSpecialStoneBubbleEvent(ev, reason, cause) && getSpecialStoneBubbleSpeechLines(special, 'proliferation_triggered')
                    ? 'proliferation_triggered'
                    : (isEscapeExplosionSpecialStoneBubbleReason(reason, cause) && getSpecialStoneBubbleSpeechLines(special, 'escape_exploded'))
                    ? 'escape_exploded'
                    : 'destroy';
                emitBubble({
                    special,
                    scenario,
                    player,
                    row,
                    col,
                    reason: reason || scenario,
                    cause
                });
                continue;
            }

            if (ev.type === 'CHANGE' && String(reason || '').toLowerCase() === 'regen_triggered') {
                emitBubble({
                    special: special || 'REGEN',
                    scenario: 'regen_triggered',
                    player,
                    row,
                    col,
                    reason: reason || 'regen_triggered',
                    cause
                });
            }
        }

        for (const ev of deferredPhaseEvents) {
            emitBubble({
                special: 'TIME_STOP',
                scenario: 'time_stop_triggered',
                player: ev.player || opts.fallbackPlayer || null,
                row: ev.row,
                col: ev.col,
                reason: ev.type
            });
        }

        const afterSnapshot = snapshotSpecialStoneSpeechMarkers(cardState);
        const removed = getRemovedSpecialStoneSpeechMarkers(beforeSnapshot, afterSnapshot);
        for (const item of removed) {
            if (!item || !item.type) continue;
            if (findMatchingSpecialStoneStatusRemovedEvent(presentationEvents, item)) continue;
            if (hasMatchingSpecialStoneMovedFromPhaseEvent(phaseEvents, item)) continue;
            if (item.type === 'REGEN' && hasRegenTriggeredPresentationEventAt(presentationEvents, item.row, item.col)) continue;
            if (findMatchingLivingWillRestorePresentationEvent(presentationEvents, item, undefined, undefined)) continue;
            if (hasMatchingSpecialStoneStatusAppliedEvent(presentationEvents, item, undefined, undefined)) continue;
            const scenario = hasEscapeExplosionPresentationEventAt(presentationEvents, item) && getSpecialStoneBubbleSpeechLines(item.type, 'escape_exploded')
                ? 'escape_exploded'
                : 'destroy';
            emitBubble({
                special: item.type,
                scenario,
                player: item.owner || opts.fallbackPlayer || null,
                row: item.row,
                col: item.col,
                reason: opts.removalReason || scenario
            });
        }
    }

    function isFrozenCell(cardState: any, row: any, col: any) {
        if (CardUtilsModule && typeof CardUtilsModule.isFrozenCell === 'function') {
            return !!CardUtilsModule.isFrozenCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            Number(m.row) === Number(row) &&
            Number(m.col) === Number(col) &&
            m.data &&
            m.data.type === 'FREEZE'
        ));
    }

    function emitHandRemovePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const data = payload || {};
        const playerKey = normalizePlayerKey(data.player);
        const count = Math.max(0, Math.trunc(Number(data.count) || 0));
        if (!playerKey || count <= 0) return;

        const ev: Record<string, any> = {
            type: 'HAND_REMOVE',
            player: playerKey,
            count,
            reason: data.reason || null
        };
        if (data.cardId) ev.cardId = data.cardId;
        if (Array.isArray(data.cardIds) && data.cardIds.length > 0) {
            ev.cardIds = data.cardIds.slice();
        }

        CardLogic.emitPresentationEvent(cardState, ev);
    }

    function emitTrapHandRemoveEvents(CardLogic: any, cardState: any, trapRes: any) {
        const triggered = (trapRes && Array.isArray(trapRes.triggered)) ? trapRes.triggered : [];
        if (!triggered.length) return;

        for (const detail of triggered) {
            const removedCount = Number(detail && (detail.destroyedHandCount ?? detail.stolenHandCount)) || 0;
            const victim = detail && detail.victim ? detail.victim : null;
            emitHandRemovePresentation(CardLogic, cardState, {
                player: victim,
                count: removedCount,
                reason: 'trap_will_triggered',
                cardIds: Array.isArray(detail && detail.destroyedCardIds) ? detail.destroyedCardIds.slice() : []
            });
        }
    }

    function applyTurnStartPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, events: any, prng: any) {
        const p = prng || undefined;

        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.syncPendingSelectionActionCache === 'function') {
            PendingCoordinatorModule.syncPendingSelectionActionCache(cardState);
        }

        if (cardState.lastTurnStartedFor !== playerKey) {
            // Set the active turn player for SALVATION_WILL destruction tracking and reset the
            // opponent's beneficiary ledger so this turn can accumulate every destroyed stone.
            const opponentKeyForSalvation = playerKey === 'black' ? 'white' : 'black';
            cardState._activeTurnPlayer = playerKey;
            if (!cardState.prevOpponentTurnDestroyedStonesByPlayer) {
                const legacySalvationLedger = (cardState.prevOpponentTurnDestroyedNormalByPlayer && typeof cardState.prevOpponentTurnDestroyedNormalByPlayer === 'object')
                    ? cardState.prevOpponentTurnDestroyedNormalByPlayer
                    : null;
                cardState.prevOpponentTurnDestroyedStonesByPlayer = legacySalvationLedger
                    ? {
                        black: Array.isArray(legacySalvationLedger.black) ? legacySalvationLedger.black.map((entry: any) => ({ ...entry })) : [],
                        white: Array.isArray(legacySalvationLedger.white) ? legacySalvationLedger.white.map((entry: any) => ({ ...entry })) : []
                    }
                    : { black: [], white: [] };
            }
            cardState.prevOpponentTurnDestroyedStonesByPlayer[opponentKeyForSalvation] = [];

            // Clear FATE_WILL controller for the opponent if the current player was that controller.
            // This means the single controlled opponent turn has already completed.
            if (cardState.fateWillControllerByTurnOwner) {
                if (cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] === playerKey) {
                    cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] = null;
                }
            }

            ensureGameRoundState(Core, gameState);
            applyPendingRoundBonusAtTurnStart(CardLogic, Core, cardState, gameState, events);
            const eventStartIndex = Array.isArray(events)
                ? events.length
                : 0;
            const presentationStartIndex = Array.isArray(cardState.presentationEvents)
                ? cardState.presentationEvents.length
                : 0;
            if (typeof CardLogic.consumeStoneSalvationGodRevives === 'function') {
                const rescueRes = CardLogic.consumeStoneSalvationGodRevives(cardState, gameState, playerKey, { randomSource: p });
                if (rescueRes && Number(rescueRes.requestedCount) > 0) {
                    events.push({
                        type: 'stone_salvation_god_revived_start',
                        player: playerKey,
                        requestedCount: Number(rescueRes.requestedCount) || 0,
                        revivedCount: Number(rescueRes.revivedCount) || 0,
                        revived: Array.isArray(rescueRes.revived) ? rescueRes.revived.slice() : [],
                        failed: Array.isArray(rescueRes.failed) ? rescueRes.failed.slice() : []
                    });
                }
            }
            const workMarkersBeforeStart = snapshotWorkMarkers(cardState);
            const specialStoneSpeechBeforeStart = snapshotSpecialStoneSpeechMarkers(cardState);
            // Snapshot timers before any turn-start processing (for visual timer updates).
            const timerSnapshot = new Map();
            try {
                const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of sourceMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    if (isBombCategoryMarker(m)) {
                        if (typeof m.data.remainingTurns === 'number') {
                            timerSnapshot.set(key, { timer: m.data.remainingTurns, special: 'TIME_BOMB', owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        const timerValue = resolveSpecialStatusTimer(m.data);
                        if (timerValue !== undefined) {
                            timerSnapshot.set(key, { timer: timerValue, special: m.data.type || null, owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    }
                }
            } catch (e) { /* ignore snapshot failures */ }

            const turnStartSummary = CardLogic.onTurnStart(cardState, playerKey, gameState, p, {
                // Rescue revives already ran at the top of this phase so their playback
                // stays before continuous destruction effects.
                skipStoneSalvationGodRevives: true
            }) || null;
            events.push({ type: 'turn_start', player: playerKey });
            if (turnStartSummary && turnStartSummary.ribo && Array.isArray(turnStartSummary.ribo.entries)) {
                for (const entry of turnStartSummary.ribo.entries) {
                    if (!entry) continue;
                    if (entry.shortage) {
                        events.push({
                            type: 'ribo_will_shortage',
                            player: playerKey,
                            destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
                            destroyedCount: Number(entry.destroyedCount) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    } else {
                        events.push({
                            type: 'ribo_will_repaid',
                            player: playerKey,
                            repaid: Number(entry.repaid) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    }
                }
            }

            // Start-of-turn effects: process all markers (bombs & special stones) in creation order
            const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                ? MarkersAdapter.getMarkers(cardState)
                : (cardState.markers || []);
            const markers = sourceMarkers
                .map((m: any) => ({
                    isBomb: isBombCategoryMarker(m),
                    marker: m,
                    createdSeq: (m.createdSeq || 0)
                }))
                .sort((a: any, b: any) => (a.createdSeq || 0) - (b.createdSeq || 0));

            const observerMarkersBeforeStart = snapshotObserverMarkers(cardState);
            const hyperAggregated: { moved: any[]; destroyed: any[]; flipped: any[]; flippedByOwner: Record<string, any[]> } = { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
            const observerStartSummary: { triggered: any[]; lost: any[]; durationEnd: any[] } = { triggered: [], lost: [], durationEnd: [] };

            for (const m of markers) {
                if (m.isBomb) {
                    if (isFrozenCell(cardState, m.marker && m.marker.row, m.marker && m.marker.col)) continue;
                    const res = CardLogic.tickBombAt(cardState, gameState, m.marker, playerKey);
                    if (res && res.exploded && res.exploded.length) {
                        events.push({ type: 'bombs_exploded', details: res });
                    }
                } else {
                    const t = (m.marker.data && m.marker.data.type ? m.marker.data.type : '').toUpperCase();
                    const owner = m.marker.owner;
                    const row = m.marker.row;
                    const col = m.marker.col;
                    if (t !== 'FREEZE' && isFrozenCell(cardState, row, col)) continue;
                    if (t === 'ULTIMATE_DESTROY_GOD' && owner === playerKey) {
                        const res = CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { randomSource: p });
                        if (res && res.moved && res.moved.length) events.push({ type: 'udg_moved_start', details: res.moved });
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'udg_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'udg_expired_start', details: res.expired });
                    } else if (t === 'DESTROY_DRAGON' && owner === playerKey) {
                        const res = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'destroy_dragon_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'destroy_dragon_expired_start', details: res.expired });
                    } else if (t === 'SNIPER' && owner === playerKey) {
                        const res = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'sniper_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'sniper_expired_start', details: res.expired });
                    } else if (t === 'LIGHTNING' && owner === playerKey) {
                        const res = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'lightning_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'lightning_expired_start', details: res.expired });
                    } else if (t === 'WILL_HUNTER_KING' && owner === playerKey) {
                        const res = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'will_hunter_king_destroyed_start', details: res.destroyed });
                        if (res && res.moved && res.moved.length) events.push({ type: 'will_hunter_king_moved_start', details: res.moved });
                        if (res && res.expired && res.expired.length) events.push({ type: 'will_hunter_king_expired_start', details: res.expired });
                    } else if (t === 'OBSERVER' && owner === playerKey) {
                        const res = CardLogic.processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.triggered && Number(res.gained) > 0) {
                            const gained = Number(res.gained) || 0;
                            events.push({
                                type: 'observer_triggered_start',
                                details: [{ row, col, owner: playerKey, gained }]
                            });
                            observerStartSummary.triggered.push({ row, col, owner: playerKey, gained });
                        }
                        if (res && res.expired && res.expired.length) {
                            events.push({ type: 'observer_expired_start', details: res.expired });
                            const lost = res.expired.filter((item: any) => item && item.reason === 'anchor_lost');
                            if (lost.length) observerStartSummary.lost.push(...lost);
                            const durationEnd = res.expired.filter((item: any) => item && item.reason === 'duration_end');
                            if (durationEnd.length) observerStartSummary.durationEnd.push(...durationEnd);
                        }
                    } else if (t === 'TIME_STOP' && owner === playerKey && typeof CardLogic.processTimeStopEffectsAtTurnStartAnchor === 'function') {
                        const res = CardLogic.processTimeStopEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && Array.isArray(res.triggered) && res.triggered.length) {
                            for (const detail of res.triggered) {
                                events.push({
                                    type: 'time_stop_triggered',
                                    player: playerKey,
                                    row: detail && Number.isInteger(detail.row) ? detail.row : row,
                                    col: detail && Number.isInteger(detail.col) ? detail.col : col,
                                    remainingBonusTurns: Number(detail && detail.totalReservedTurns) || 0
                                });
                            }
                        }
                        if (res && Array.isArray(res.fizzled) && res.fizzled.length) {
                            for (const detail of res.fizzled) {
                                events.push({
                                    type: 'time_stop_fizzled',
                                    player: playerKey,
                                    row: detail && Number.isInteger(detail.row) ? detail.row : row,
                                    col: detail && Number.isInteger(detail.col) ? detail.col : col,
                                    reason: detail && detail.reason ? detail.reason : 'anchor_lost'
                                });
                            }
                        }
                    } else if (t === 'DRAGON' && owner === playerKey) {
                        const res = CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { randomSource: p });
                        if (res && res.moved && res.moved.length) events.push({ type: 'dragon_moved_start', details: res.moved });
                        if (res && res.converted && res.converted.length) {
                            awardBoardChargeGain(CardLogic, cardState, playerKey, res.converted.length, {
                                anchorRow: row,
                                anchorCol: col,
                                moved: res.moved,
                                sourceType: 'dragon_turn_start'
                            });
                            events.push({ type: 'dragon_converted_start', details: res.converted });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'dragon_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'BREEDING' && owner === playerKey) {
                        const res = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.spawned && res.spawned.length) events.push({ type: 'breeding_spawned_start', details: res.spawned });
                        if (res && res.flipped && res.flipped.length) {
                            awardBoardChargeGain(CardLogic, cardState, playerKey, res.flipped.length, {
                                anchorRow: row,
                                anchorCol: col,
                                sourceType: 'breeding_turn_start'
                            });
                            events.push({ type: 'breeding_flipped_start', details: res.flipped });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'breeding_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'HYPERACTIVE' || t === 'ESCAPE_HYPERACTIVE' || t === 'INHERITED_HYPERACTIVE' || t === 'EXTREME_HYPERACTIVE') {
                        // Hyperactive-family moves can trigger for both owners; process per-anchor by owner
                        const ownerKey = owner;
                        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.log('[TurnPipeline] processing HYPERACTIVE anchor', { row, col, owner: ownerKey, type: t, createdSeq: m.createdSeq });
                        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey,
                            expectedSpecialType: t
                        });
                        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.log('[TurnPipeline] hyperactive result', { row, col, owner: ownerKey, type: t, res });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'hyperactive_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.repelled && res.repelled.length) {
                            events.push({ type: 'extreme_hyperactive_repelled_start', details: res.repelled });
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'hyperactive_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'hyperactive_flipped_start', details: res.flipped });
                            hyperAggregated.flipped.push(...res.flipped);
                            hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                            hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                            awardBoardChargeGain(CardLogic, cardState, ownerKey, res.flipped.length, {
                                anchorRow: row,
                                anchorCol: col,
                                moved: res.moved,
                                sourceType: 'hyperactive_turn_start'
                            });
                        }
                    } else if (t === 'ROBOT_VACUUM') {
                        const ownerKey = owner;
                        const res = CardLogic.processRobotVacuumMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'robot_vacuum_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'robot_vacuum_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                        if (res && res.expired && res.expired.length) {
                            events.push({ type: 'robot_vacuum_expired_start', details: res.expired });
                        }
                        if (res && res.sucked && res.sucked.length) {
                            events.push({ type: 'robot_vacuum_sucked_start', details: res.sucked });
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'robot_vacuum_flipped_start', details: res.flipped });
                            hyperAggregated.flipped.push(...res.flipped);
                            hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                            hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                            awardBoardChargeGain(CardLogic, cardState, ownerKey, res.flipped.length, {
                                anchorRow: row,
                                anchorCol: col,
                                moved: res.moved,
                                sourceType: 'robot_vacuum_turn_start'
                            });
                        }
                    } else if (t === 'GLUTTONOUS') {
                        const ownerKey = owner;
                        const res = CardLogic.processGluttonousMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey,
                            randomSource: p
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'hyperactive_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'hyperactive_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                    } else if (t === 'ULTIMATE_HYPERACTIVE') {
                        const ownerKey = owner;
                        const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, ownerKey, row, col, p, {
                            currentTurnPlayerKey: playerKey
                        });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'ultimate_hyperactive_moved_start', details: res.moved });
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'ultimate_hyperactive_flipped_start', details: res.flipped });
                            awardBoardChargeGain(CardLogic, cardState, ownerKey, res.flipped.length, {
                                anchorRow: row,
                                anchorCol: col,
                                moved: res.moved,
                                sourceType: 'ultimate_hyperactive_turn_start'
                            });
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'ultimate_hyperactive_destroyed_start', details: res.destroyed });
                        }
                    }
                }
            }

            // After processing all markers, apply REGEN interaction based on aggregated hyperactive flips
            const hyperByOwner = hyperAggregated.flippedByOwner || {};
            const regenTriggered = [];
            const regenCaptureFlips = [];
            const livingWillTriggered = [];
            const regenCaptureByOwner: Record<string, any[]> = { black: [], white: [] };
            for (const ownerKey of ['black', 'white']) {
                const flips = hyperByOwner[ownerKey] || [];
                if (!flips.length) continue;
                const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, flips, ownerKey);
                const regenRes = reviveRes.regenRes;
                const livingWillRes = reviveRes.livingWillRes;
                if (regenRes && regenRes.regened && regenRes.regened.length) regenTriggered.push(...regenRes.regened);
                if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                    regenCaptureFlips.push(...regenRes.captureFlips);
                    regenCaptureByOwner[ownerKey] = regenCaptureByOwner[ownerKey] || [];
                    regenCaptureByOwner[ownerKey].push(...regenRes.captureFlips);
                }
                if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                    livingWillTriggered.push(...livingWillRes.restored);
                }
            }
            if (regenCaptureFlips.length && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                CardLogic.clearHyperactiveAtPositions(cardState, regenCaptureFlips);
            }
            if (regenTriggered.length) {
                events.push({ type: 'regen_triggered_start', details: regenTriggered });
            }
            if (livingWillTriggered.length) {
                events.push({ type: 'living_will_triggered_start', details: livingWillTriggered });
            }
            if (regenCaptureFlips.length) {
                // Capture flips grant charge to the regen owner (clamped to CHARGE_MAX).
                for (const ownerKey of ['black', 'white']) {
                    const arr = regenCaptureByOwner[ownerKey] || [];
                    if (!arr.length) continue;
                    const firstCapture = arr[0] || {};
                    awardBoardChargeGain(CardLogic, cardState, ownerKey, arr.length, {
                        anchorRow: firstCapture.row,
                        anchorCol: firstCapture.col,
                        sourceType: 'regen_capture_turn_start'
                    });
                }
                events.push({ type: 'regen_capture_flipped_start', details: regenCaptureFlips });
            }

            if (typeof CardLogic.processTrapEffects === 'function') {
                const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: true });
                pushTrapEvents(events, trapRes);
                emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
            }

            const durationEndSet = new Set((observerStartSummary.durationEnd || []).map((item: any) => `${item.row},${item.col}:${item.owner || ''}`));
            const removedAtStart = getRemovedObserverMarkers(observerMarkersBeforeStart, snapshotObserverMarkers(cardState))
                .filter((item: any) => !durationEndSet.has(`${item.row},${item.col}:${item.owner || ''}`));
            if (removedAtStart.length) {
                observerStartSummary.lost.push(...removedAtStart.map((item: any) => ({
                    row: item.row,
                    col: item.col,
                    owner: item.owner || null,
                    reason: 'removed'
                })));
            }

            // Observer bubble priority (start turn): anchor lost > trigger success.
            const primaryLost = observerStartSummary.lost[0] || null;
            const primaryTriggered = observerStartSummary.triggered[0] || null;
            if (primaryLost) {
                emitObserverBubblePresentation(CardLogic, cardState, {
                    player: primaryLost.owner || playerKey,
                    row: primaryLost.row,
                    col: primaryLost.col,
                    text: OBSERVER_LOST_LINE,
                    reason: 'anchor_lost'
                });
            } else if (primaryTriggered) {
                const gained = Number(primaryTriggered.gained) || 0;
                if (typeof CardLogic.emitPresentationEvent === 'function') {
                    CardLogic.emitPresentationEvent(cardState, {
                        type: 'OBSERVER_TRIGGERED',
                        player: playerKey,
                        row: primaryTriggered.row,
                        col: primaryTriggered.col,
                        gained,
                        text: `布石+${gained} 観測が捗る`,
                        meta: { owner: playerKey, reason: 'triggered' }
                    });
                }
            }

            const newPresentationEvents = Array.isArray(cardState.presentationEvents)
                ? cardState.presentationEvents.slice(presentationStartIndex)
                : [];
            const workDurationEndSet = new Set(
                newPresentationEvents
                    .filter((ev: any) => isWorkDurationEndPresentationEvent(ev))
                    .map((ev: any) => {
                        const row = Number(ev && ev.row);
                        const col = Number(ev && ev.col);
                        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
                        const owner = normalizePlayerKey((ev && ev.player) || (ev && ev.owner) || (ev && ev.meta && ev.meta.owner));
                        return `${row},${col}:${owner || ''}`;
                    })
                    .filter((key: any) => !!key)
            );

            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeStart, {
                durationEndSet: workDurationEndSet,
                presentationStartIndex
            });

            emitSpecialStoneBubblesFromPhase(CardLogic, cardState, {
                events: Array.isArray(events) ? events.slice(eventStartIndex) : [],
                presentationEvents: newPresentationEvents,
                beforeSnapshot: specialStoneSpeechBeforeStart,
                presentationStartIndex,
                prng: p,
                fallbackPlayer: playerKey,
                removalReason: 'removed_at_turn_start'
            });

            // Emit timer update events when remaining turns changed.
            try {
                const afterMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of afterMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    const before = timerSnapshot.get(key);
                    if (isBombCategoryMarker(m)) {
                        if (typeof m.data.remainingTurns !== 'number') continue;
                        if (!before || before.timer !== m.data.remainingTurns) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: 'TIME_BOMB', timer: m.data.remainingTurns, owner: m.owner }
                                });
                            }
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        const timerValue = resolveSpecialStatusTimer(m.data);
                        if (timerValue === undefined) continue;
                        if (!before || before.timer !== timerValue) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: m.data.type || null, timer: timerValue, owner: m.owner }
                                });
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }

            delete cardState._frozenCellsActiveAtTurnStart;

        }
    }

    function applyCardUsagePhase(CardLogic: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any) {
        const p = prng || undefined;
        const observerMarkersBeforeUsage = snapshotObserverMarkers(cardState);
        const workMarkersBeforeUsage = snapshotWorkMarkers(cardState);
        const specialStoneSpeechBeforeUsage = snapshotSpecialStoneSpeechMarkers(cardState);
        const eventStartIndex = Array.isArray(events)
            ? events.length
            : 0;
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.useCardId) {
                const mergedDebugOptions = (action && action.debugOptions && typeof action.debugOptions === 'object')
                    ? { ...action.debugOptions }
                    : {};
                if (p && typeof p.random === 'function') {
                    mergedDebugOptions.prng = p;
                }
                const ok = CardLogic.applyCardUsage(
                    cardState,
                    gameState,
                    playerKey,
                    action.useCardId,
                    action.useCardOwnerKey,
                    mergedDebugOptions
                );
                if (!ok) {
                    throw new Error('applyCardUsage failed');
                }
                events.push({ type: 'card_used', player: playerKey, cardId: action.useCardId });

                // Immediate-effect card: TREASURE_BOX
                // On use, gain random charge [1..3] and clear pending (no placement dependency).
                const pendingType = getPendingEffectTypeForActionPhase(CardLogic, cardState, playerKey);
                if (pendingType === 'TREASURE_BOX') {
                    if (!(p && typeof p.random === 'function')) {
                        throw new Error('TurnPipelinePhases.applyCardUsagePhase TREASURE_BOX requires an injected deterministic PRNG.');
                    }
                    const rnd = p.random();
                    const gained = 1 + Math.floor(Math.max(0, Math.min(0.999999, rnd)) * 3);
                    addChargeWithTotal(cardState, playerKey, gained, null);
                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({ type: 'treasure_box_gain', player: playerKey, gained });
                }

                if (pendingType === 'CORNER_TRIBUTE') {
                    const opponentKey = playerKey === 'black' ? 'white' : 'black';
                    const opponentCornerCount = (typeof CardLogic.countOccupiedCornersForPlayer === 'function')
                        ? CardLogic.countOccupiedCornersForPlayer(cardState, gameState, opponentKey)
                        : 0;
                    const stolen = transferChargeBetweenPlayers(cardState, opponentKey, playerKey, 20, 'corner_tribute');
                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({
                        type: 'corner_tribute_resolved',
                        player: playerKey,
                        opponent: opponentKey,
                        stolen,
                        opponentCornerCount
                    });
                }

                if (pendingType === 'RIBO_WILL') {
                    const res = (typeof CardLogic.armRiboWillEffect === 'function')
                        ? CardLogic.armRiboWillEffect(cardState, playerKey)
                        : null;
                    if (!res || res.applied !== true) {
                        throw new Error('RIBO_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({
                        type: 'ribo_will_resolved',
                        player: playerKey,
                        gained: Number(res.gained) || 0,
                        repaymentAmount: Number(res.repaymentAmount) || 0,
                        remainingOwnerTurns: Number(res.remainingOwnerTurns) || 0
                    });
                }

                if (pendingType === 'EQUALITY_WILL') {
                    const res = (typeof CardLogic.resolveEqualityWillUsage === 'function')
                        ? CardLogic.resolveEqualityWillUsage(cardState, gameState, playerKey, p)
                        : null;
                    if (!res || res.applied !== true) {
                        throw new Error('EQUALITY_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    if (res && Array.isArray(res.flipped) && res.flipped.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                        const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, res.flipped, playerKey);
                        const regenRes = reviveRes.regenRes;
                        const livingWillRes = reviveRes.livingWillRes;
                        if (regenRes && regenRes.regened && regenRes.regened.length) {
                            events.push({ type: 'regen_triggered', details: regenRes.regened });
                        }
                        if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                            if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                                CardLogic.clearHyperactiveAtPositions(cardState, regenRes.captureFlips);
                            }
                            const firstCapture = regenRes.captureFlips[0] || {};
                            awardBoardChargeGain(CardLogic, cardState, playerKey, regenRes.captureFlips.length, {
                                targetRow: firstCapture.row,
                                targetCol: firstCapture.col,
                                sourceType: 'regen_capture_immediate'
                            });
                            events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                        }
                        if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                            events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
                        }
                    }
                    if (res && Array.isArray(res.flipped) && res.flipped.length) {
                        const firstFlip = res.flipped[0] || {};
                        awardBoardChargeGain(CardLogic, cardState, playerKey, res.flipped.length, {
                            targetRow: firstFlip.row,
                            targetCol: firstFlip.col,
                            sourceType: 'equality_will_immediate'
                        });
                    }
                    events.push({
                        type: 'equality_will_resolved',
                        player: playerKey,
                        requestedCount: Number(res.requestedCount) || 0,
                        spawnedCount: Number(res.spawnedCount) || 0,
                        spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
                        flippedCount: Number(res.flippedCount) || 0,
                        flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
                    });
                }

                if (pendingType === 'REINFORCEMENT_WILL') {
                    const res = (typeof CardLogic.resolveReinforcementWillUsage === 'function')
                        ? CardLogic.resolveReinforcementWillUsage(cardState, gameState, playerKey, p)
                        : null;
                    if (!res || res.applied !== true) {
                        throw new Error('REINFORCEMENT_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    if (res && Array.isArray(res.flipped) && res.flipped.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                        const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, res.flipped, playerKey);
                        const regenRes = reviveRes.regenRes;
                        const livingWillRes = reviveRes.livingWillRes;
                        if (regenRes && regenRes.regened && regenRes.regened.length) {
                            events.push({ type: 'regen_triggered', details: regenRes.regened });
                        }
                        if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                            if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                                CardLogic.clearHyperactiveAtPositions(cardState, regenRes.captureFlips);
                            }
                            const firstCapture = regenRes.captureFlips[0] || {};
                            awardBoardChargeGain(CardLogic, cardState, playerKey, regenRes.captureFlips.length, {
                                targetRow: firstCapture.row,
                                targetCol: firstCapture.col,
                                sourceType: 'regen_capture_immediate'
                            });
                            events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                        }
                        if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                            events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
                        }
                    }
                    if (res && Array.isArray(res.flipped) && res.flipped.length) {
                        const firstFlip = res.flipped[0] || {};
                        awardBoardChargeGain(CardLogic, cardState, playerKey, res.flipped.length, {
                            targetRow: firstFlip.row,
                            targetCol: firstFlip.col,
                            sourceType: 'reinforcement_will_immediate'
                        });
                    }
                    events.push({
                        type: 'reinforcement_will_resolved',
                        player: playerKey,
                        requestedCount: Number(res.requestedCount) || 0,
                        spawnedCount: Number(res.spawnedCount) || 0,
                        spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
                        flippedCount: Number(res.flippedCount) || 0,
                        flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
                    });
                }

                if (pendingType === 'TIME_STOP_GOD') {
                    const res = (typeof CardLogic.resolveTimeStopGodUsage === 'function')
                        ? CardLogic.resolveTimeStopGodUsage(cardState, gameState, playerKey, p)
                        : { applied: false, destroyed: [], destroyedCount: 0, requestedCount: 3 };
                    events.push({
                        type: 'time_stop_god_cost_resolved',
                        player: playerKey,
                        destroyed: Array.isArray(res && res.destroyed) ? res.destroyed.slice() : [],
                        destroyedCount: Number(res && res.destroyedCount) || 0,
                        requestedCount: Number(res && res.requestedCount) || 0
                    });
                }

                // Immediate-effect card: REBUILD_WILL
                // On use, destroy all remaining hand cards and draw 3 cards immediately.
                if (pendingType === 'REBUILD_WILL') {
                    const clearResult = (typeof CardLogic.clearHandToDiscard === 'function')
                        ? CardLogic.clearHandToDiscard(cardState, playerKey)
                        : { destroyedCards: [] };
                    const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
                        ? clearResult.destroyedCards
                        : [];
                    const destroyedCount = destroyedCards.length;

                    if (typeof CardLogic.emitPresentationEvent === 'function') {
                        CardLogic.emitPresentationEvent(cardState, {
                            type: 'HAND_CLEAR',
                            player: playerKey,
                            count: destroyedCount,
                            reason: 'rebuild_will'
                        });
                    }

                    let drawnCount = 0;
                    if (typeof CardLogic.commitDraw === 'function') {
                        for (let i = 0; i < 3; i++) {
                            const drawnCardId = CardLogic.commitDraw(cardState, playerKey, p);
                            if (!drawnCardId) break;
                            drawnCount++;
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'DRAW_CARD',
                                    player: playerKey,
                                    cardId: drawnCardId,
                                    count: 1
                                });
                            }
                        }
                    }

                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({ type: 'rebuild_will_resolved', player: playerKey, destroyedCount, drawnCount });
                }

                if (pendingType === 'REVEAL_HAND_WILL') {
                    const res = (typeof CardLogic.applyRevealHandWill === 'function')
                        ? CardLogic.applyRevealHandWill(cardState, playerKey)
                        : { applied: false, reason: 'missing_logic', revealedCount: 0 };
                    if (!res || res.applied !== true) {
                        throw new Error(`REVEAL_HAND_WILL resolve failed: ${res && res.reason ? res.reason : 'unknown'}`);
                    }
                    events.push({
                        type: 'reveal_hand_will_resolved',
                        player: playerKey,
                        opponent: res.opponentKey || (playerKey === 'black' ? 'white' : 'black'),
                        revealedCount: Number(res.revealedCount) || 0
                    });
                }

                if (pendingType === 'EXECUTION_WILL') {
                    const res = (typeof CardLogic.applyExecutionWill === 'function')
                        ? CardLogic.applyExecutionWill(cardState, playerKey, p)
                        : { applied: false, reason: 'missing_logic', destroyedCount: 0, destroyedCardIds: [] };
                    if (!res || res.applied !== true) {
                        throw new Error(`EXECUTION_WILL resolve failed: ${res && res.reason ? res.reason : 'unknown'}`);
                    }
                    const opponentKey = res.opponentKey || (playerKey === 'black' ? 'white' : 'black');
                    const destroyedCardIds = Array.isArray(res.destroyedCardIds) ? res.destroyedCardIds.slice() : [];
                    const destroyedCount = Number(res.destroyedCount) || destroyedCardIds.length;
                    emitHandRemovePresentation(CardLogic, cardState, {
                        player: opponentKey,
                        count: destroyedCount,
                        reason: 'execution_will',
                        cardId: destroyedCount === 1 ? destroyedCardIds[0] : null,
                        cardIds: destroyedCardIds
                    });
                    events.push({
                        type: 'execution_will_resolved',
                        player: playerKey,
                        opponent: opponentKey,
                        requestedCount: Number(res.requestedCount) || destroyedCount,
                        destroyedCount,
                        destroyedCardIds
                    });
                }

                // Immediate-effect card: SUPPLY_WILL
                // On use, draw 2 cards immediately (subject to deck shortage and hand limit).
                if (pendingType === 'SUPPLY_WILL') {
                    let drawnCount = 0;
                    if (typeof CardLogic.commitDraw === 'function') {
                        for (let i = 0; i < 2; i++) {
                            const drawnCardId = CardLogic.commitDraw(cardState, playerKey, p);
                            if (!drawnCardId) break;
                            drawnCount++;
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'DRAW_CARD',
                                    player: playerKey,
                                    cardId: drawnCardId,
                                    count: 1
                                });
                            }
                        }
                    }

                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({ type: 'supply_will_resolved', player: playerKey, drawnCount });
                }

                // Immediate side effect card: GLUTTONOUS_WILL
                // On use, destroy all remaining hand cards immediately (pending stays for next placement).
                if (pendingType === 'GLUTTONOUS_WILL') {
                    const clearResult = (typeof CardLogic.clearHandToDiscard === 'function')
                        ? CardLogic.clearHandToDiscard(cardState, playerKey)
                        : { destroyedCards: [] };
                    const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
                        ? clearResult.destroyedCards
                        : [];
                    const destroyedCount = destroyedCards.length;

                    if (typeof CardLogic.emitPresentationEvent === 'function') {
                        CardLogic.emitPresentationEvent(cardState, {
                            type: 'HAND_CLEAR',
                            player: playerKey,
                            count: destroyedCount,
                            reason: 'gluttonous_will'
                        });
                    }

                    events.push({ type: 'gluttonous_will_hand_destroyed', player: playerKey, destroyedCount });
                }

                if (pendingType === 'LOSS_WILL') {
                    const res = (typeof CardLogic.applyLossWill === 'function')
                        ? CardLogic.applyLossWill(cardState, gameState, playerKey)
                        : { applied: false, removedCount: 0 };
                    if (!res || res.applied !== true) {
                        throw new Error('LOSS_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({ type: 'loss_will_resolved', player: playerKey, removedCount: Number(res.removedCount) || 0 });
                }

                if (pendingType === 'SALVATION_WILL') {
                    const res = (typeof CardLogic.applySalvationWill === 'function')
                        ? CardLogic.applySalvationWill(cardState, gameState, playerKey, p)
                        : { applied: false, spawned: [], requestedCount: 0, spawnedCount: 0 };
                    if (!res || res.applied !== true) {
                        throw new Error('SALVATION_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    if (res && Array.isArray(res.flipped) && res.flipped.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                        const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, res.flipped, playerKey);
                        const regenRes = reviveRes.regenRes;
                        const livingWillRes = reviveRes.livingWillRes;
                        if (regenRes && regenRes.regened && regenRes.regened.length) {
                            events.push({ type: 'regen_triggered', details: regenRes.regened });
                        }
                        if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                            if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                                CardLogic.clearHyperactiveAtPositions(cardState, regenRes.captureFlips);
                            }
                            const firstCapture = regenRes.captureFlips[0] || {};
                            awardBoardChargeGain(CardLogic, cardState, playerKey, regenRes.captureFlips.length, {
                                targetRow: firstCapture.row,
                                targetCol: firstCapture.col,
                                sourceType: 'regen_capture_immediate'
                            });
                            events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                        }
                        if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                            events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
                        }
                    }
                    if (res && Array.isArray(res.flipped) && res.flipped.length) {
                        const firstFlip = res.flipped[0] || {};
                        awardBoardChargeGain(CardLogic, cardState, playerKey, res.flipped.length, {
                            targetRow: firstFlip.row,
                            targetCol: firstFlip.col,
                            sourceType: 'salvation_will_immediate'
                        });
                    }
                    events.push({
                        type: 'salvation_will_resolved',
                        player: playerKey,
                        spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
                        requestedCount: Number(res.requestedCount) || 0,
                        spawnedCount: Number(res.spawnedCount) || 0,
                        flippedCount: Number(res.flippedCount) || 0,
                        flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
                    });
                }

                if (pendingType === 'FATE_WILL') {
                    const res = (typeof CardLogic.applyFateWill === 'function')
                        ? CardLogic.applyFateWill(cardState, playerKey)
                        : { applied: false, reason: 'not_implemented' };
                    if (!res || res.applied !== true) {
                        throw new Error('FATE_WILL resolve failed');
                    }
                    clearPendingForActionPhase(cardState, playerKey);
                    events.push({
                        type: 'fate_will_resolved',
                        player: playerKey,
                        opponentKey: res.turnOwnerKey,
                        stacked: !!res.stacked,
                        controllerKey: res.controllerKey
                    });
                }

            }
        } finally {
            emitObserverLostBubbleFromSnapshots(CardLogic, cardState, observerMarkersBeforeUsage, 'removed_during_card_usage');
            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeUsage, {
                presentationStartIndex
            });
            emitSpecialStoneBubblesFromPhase(CardLogic, cardState, {
                events: Array.isArray(events) ? events.slice(eventStartIndex) : [],
                presentationEvents: Array.isArray(cardState.presentationEvents)
                    ? cardState.presentationEvents.slice(presentationStartIndex)
                    : [],
                beforeSnapshot: specialStoneSpeechBeforeUsage,
                presentationStartIndex,
                prng: p,
                fallbackPlayer: playerKey,
                removalReason: 'removed_during_card_usage'
            });
        }
    }

    function resolveSafeCardContext(CardLogic: any, cardState: any) {
        let ctx = null;
        try {
            const ctxHelper = (() => { try { return _require('../logic/context'); } catch (e) { return null; } })();
            if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
                ctx = ctxHelper.getSafeCardContext(cardState);
            }
        } catch (e) { /* ignore and fallback */ }
        if (!ctx) {
            try { ctx = CardLogic.getCardContext(cardState); } catch (e) { ctx = { protectedStones: [], permaProtectedStones: [], bombs: [] }; }
        }
        return ctx;
    }

    function hasContinuationMovesForPendingType(Core: any, CardLogic: any, cardState: any, gameState: any, playerKey: any, pendingType: any) {
        const ctx = resolveSafeCardContext(CardLogic, cardState);
        const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        if (pendingType === 'LAST_RESORT' && typeof Core.getFreePlacementMoves === 'function') {
            const moves = Core.getFreePlacementMoves(gameState, playerValue, ctx);
            return Array.isArray(moves) && moves.length > 0;
        }
        const moves = Core.getLegalMoves(gameState, playerValue, ctx);
        return Array.isArray(moves) && moves.length > 0;
    }

    function clearMultiPlaceStateForPlayer(cardState: any, playerKey: any) {
        if (!cardState) return;
        if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = { black: 0, white: 0 };
        if (!cardState.infinitePlaceActiveByPlayer) cardState.infinitePlaceActiveByPlayer = { black: false, white: false };
        if (!cardState.multiPlaceSourceTypeByPlayer) cardState.multiPlaceSourceTypeByPlayer = { black: null, white: null };
        cardState.extraPlaceRemainingByPlayer[playerKey] = 0;
        cardState.infinitePlaceActiveByPlayer[playerKey] = false;
        cardState.multiPlaceSourceTypeByPlayer[playerKey] = null;
    }

    function getActionCellOwner(gameState: any, row: any, col: any) {
        if (!gameState) return null;

        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        if (Array.isArray(boardRow) && Number.isInteger(col) && col >= 0 && col < boardRow.length) {
            return boardRow[col];
        }

        const expansion = gameState.boardExpansion;
        const cells = Array.isArray(expansion && expansion.cells)
            ? expansion.cells
            : ((expansion && expansion.active) ? [expansion] : []);

        for (const cell of cells) {
            if (!cell) continue;
            const cellRow = Number(cell.row);
            let cellCol = Number.isInteger(cell.col) ? cell.col : null;
            if (!Number.isInteger(cellCol)) {
                if (cell.side === 'left') cellCol = -1;
                else if (cell.side === 'right') cellCol = 8;
            }
            if (cellRow !== row || cellCol !== col) continue;
            const owner = Number(cell.owner);
            return Number.isFinite(owner) ? owner : null;
        }

        return null;
    }

    function applyTrapEffectsAfterSelection(CardLogic: any, cardState: any, gameState: any, playerKey: any, events: any) {
        if (!CardLogic || typeof CardLogic.processTrapEffects !== 'function') return;
        const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: false });
        pushTrapEvents(events, trapRes);
        emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
    }

    function applyActionPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any, BoardOps: any) {
        const p = prng || undefined;

        const observerMarkersBeforeAction = snapshotObserverMarkers(cardState);
        const workMarkersBeforeAction = snapshotWorkMarkers(cardState);
        const specialStoneSpeechBeforeAction = snapshotSpecialStoneSpeechMarkers(cardState);
        const eventStartIndex = Array.isArray(events)
            ? events.length
            : 0;
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.type === 'pass') {
                const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
                const ctx = resolveSafeCardContext(CardLogic, cardState);
                const legalMoves = Core.getLegalMoves(gameState, playerValue, ctx);
                if (legalMoves.length > 0) {
                    throw new Error('Illegal pass: legal moves available');
                }
                // Pass policy: abandon any unresolved card effect for this turn.
                clearPendingForActionPhase(cardState, playerKey);
                const newState = Core.applyPass(gameState);
                Object.assign(gameState, newState);
                const timeStopPassRes = consumeTimeStopCompletedTurn(CardLogic, cardState, playerKey);
                if (timeStopPassRes.continueTurn === true) {
                    gameState.currentPlayer = playerValue;
                    gameState.consecutivePasses = 0;
                    if (cardState) {
                        cardState.lastTurnStartedFor = null;
                    }
                }
                events.push({ type: 'pass', player: playerKey });
            } else if (action.type === 'use_card') {
            events.push({ type: 'card_used_only', player: playerKey, cardId: action.useCardId || null });
            return;
        } else if (action.type === 'cancel_card') {
            const res = (typeof CardLogic.cancelPendingSelection === 'function')
                ? CardLogic.cancelPendingSelection(cardState, playerKey, action.cancelOptions)
                : { canceled: false, reason: 'not_supported' };
            events.push({ type: 'card_cancelled', player: playerKey, canceled: !!res.canceled, reason: res.reason || null, cardId: res.cardId || null });
            return;
        } else if (action.type === 'destroy_hand_card') {
            const res = (typeof CardLogic.destroyHandCard === 'function')
                ? CardLogic.destroyHandCard(cardState, playerKey, action.destroyCardId, action.destroyOptions)
                : { applied: false, reason: 'not_supported' };
            if (!res || !res.applied) {
                throw new Error(`destroy_hand_card failed${res && res.reason ? `: ${res.reason}` : ''}`);
            }
            emitHandRemovePresentation(CardLogic, cardState, {
                player: playerKey,
                count: 1,
                reason: 'destroy_hand_card',
                cardId: res.destroyedCardId || action.destroyCardId || null
            });
            events.push({ type: 'hand_card_destroyed', player: playerKey, cardId: res.destroyedCardId || action.destroyCardId || null });
            return;
        } else if (action.type === 'place') {
            // 3.5) Optional pre-placement selection effects (for cards that require a target)
            const pending = readPendingForActionPhase(cardState, playerKey);
            hydrateDeferredPendingSelectionState(pending, action);
            if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget) {
                const destroyResult = typeof CardLogic.applyDestroyEffectDetailed === 'function'
                    ? CardLogic.applyDestroyEffectDetailed(
                        cardState,
                        gameState,
                        playerKey,
                        action.destroyTarget.row,
                        action.destroyTarget.col
                    )
                    : { destroyed: !!CardLogic.applyDestroyEffect(
                        cardState,
                        gameState,
                        playerKey,
                        action.destroyTarget.row,
                        action.destroyTarget.col
                    ) };
                const normalizedDestroyResult = createDestroyOutcome(destroyResult, null);
                const applied = isDestroyOutcomeResolved(normalizedDestroyResult);
                events.push({
                    type: 'destroy_selected',
                    player: playerKey,
                    target: action.destroyTarget,
                    applied,
                    kind: normalizedDestroyResult && normalizedDestroyResult.kind ? normalizedDestroyResult.kind : null,
                    destroyed: !!(normalizedDestroyResult && normalizedDestroyResult.destroyed),
                    regenerated: !!(normalizedDestroyResult && normalizedDestroyResult.regenerated),
                    evaded: !!(normalizedDestroyResult && normalizedDestroyResult.evaded),
                    blockedByGhost: !!(normalizedDestroyResult && normalizedDestroyResult.blockedByGhost),
                    proliferated: !!(normalizedDestroyResult && normalizedDestroyResult.proliferated),
                    reason: normalizedDestroyResult && normalizedDestroyResult.reason ? normalizedDestroyResult.reason : null,
                    from: normalizedDestroyResult && normalizedDestroyResult.from ? normalizedDestroyResult.from : null,
                    to: normalizedDestroyResult && normalizedDestroyResult.to ? normalizedDestroyResult.to : null
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget == null) {
                throw new Error('DESTROY_ONE_STONE requires destroyTarget before placement');
            }
            if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget) {
                const res = CardLogic.applyStrongWindWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.strongWindTarget.row,
                    action.strongWindTarget.col,
                    p
                );
                events.push({ type: 'strong_wind_selected', player: playerKey, target: action.strongWindTarget, applied: !!(res && res.applied), from: res && res.from ? res.from : null, to: res && res.to ? res.to : null });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget == null) {
                throw new Error('STRONG_WIND_WILL requires strongWindTarget before placement');
            }
            if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget) {
                const res = CardLogic.applySuperBuoyancyWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.superBuoyancyTarget.row,
                    action.superBuoyancyTarget.col
                );
                events.push({
                    type: 'super_buoyancy_selected',
                    player: playerKey,
                    target: action.superBuoyancyTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                return;
            } else if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget == null) {
                throw new Error('SUPER_BUOYANCY_WILL requires superBuoyancyTarget before placement');
            }
            if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget) {
                const res = CardLogic.applySuperGravityWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.superGravityTarget.row,
                    action.superGravityTarget.col
                );
                events.push({
                    type: 'super_gravity_selected',
                    player: playerKey,
                    target: action.superGravityTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                return;
            } else if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget == null) {
                throw new Error('SUPER_GRAVITY_WILL requires superGravityTarget before placement');
            }
            if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget) {
                const res = pending.type === 'CELL_TELEPORT_WILL'
                    ? CardLogic.applyCellTeleportWill(
                        cardState,
                        gameState,
                        playerKey,
                        action.teleportTarget.row,
                        action.teleportTarget.col,
                        p
                    )
                    : CardLogic.applyTeleportWill(
                        cardState,
                        gameState,
                        playerKey,
                        action.teleportTarget.row,
                        action.teleportTarget.col,
                        p
                    );
                events.push({
                    type: 'teleport_selected',
                    player: playerKey,
                    cardType: pending.type,
                    target: action.teleportTarget,
                    applied: !!(res && res.applied),
                    from: res && res.from ? res.from : null,
                    to: res && res.to ? res.to : null,
                    createdDestination: !!(res && res.createdDestination)
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget == null) {
                throw new Error(`${pending.type} requires teleportTarget before placement`);
            }
            if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId) {
                const res = CardLogic.applyHeavenBlessingChoice(
                    cardState,
                    playerKey,
                    action.heavenBlessingCardId
                );
                events.push({
                    type: 'heaven_blessing_selected',
                    player: playerKey,
                    selectedCardId: action.heavenBlessingCardId,
                    applied: !!(res && res.applied)
                });
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId == null) {
                throw new Error('HEAVEN_BLESSING requires heavenBlessingCardId before placement');
            }
            if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex != null) {
                const res = CardLogic.applyCondemnWill(
                    cardState,
                    playerKey,
                    action.condemnTargetIndex
                );
                events.push({
                    type: 'condemn_selected',
                    player: playerKey,
                    condemnTargetIndex: action.condemnTargetIndex,
                    applied: !!(res && res.applied),
                    destroyedCardId: (res && res.destroyedCardId) ? res.destroyedCardId : null
                });
                if (res && res.applied) {
                    const opponentKey = playerKey === 'black' ? 'white' : 'black';
                    emitHandRemovePresentation(CardLogic, cardState, {
                        player: opponentKey,
                        count: 1,
                        reason: 'condemn_will',
                        cardId: (res && res.destroyedCardId) ? res.destroyedCardId : null,
                        cardIds: (res && res.destroyedCardId) ? [res.destroyedCardId] : []
                    });
                }
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex == null) {
                throw new Error('CONDEMN_WILL requires condemnTargetIndex before placement');
            }
            if (requirePendingActionValue(pending, 'TEMPT_WILL', action.temptTarget, 'TEMPT_WILL requires temptTarget before placement')) {
                const res = CardLogic.applyTemptWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.temptTarget.row,
                    action.temptTarget.col
                );
                events.push({ type: 'tempt_selected', player: playerKey, target: action.temptTarget, applied: !!(res && res.applied) });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            }
            if (requirePendingActionValue(pending, 'CAPTURE_WILL', action.captureTarget, 'CAPTURE_WILL requires captureTarget before placement')) {
                const res = CardLogic.applyCaptureWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.captureTarget.row,
                    action.captureTarget.col
                );
                events.push({
                    type: 'capture_selected',
                    player: playerKey,
                    target: action.captureTarget,
                    applied: !!(res && res.applied),
                    capturedCardId: (res && res.capturedCardId) ? res.capturedCardId : null,
                    capturedCardType: (res && res.capturedCardType) ? res.capturedCardType : null,
                    capturedCardName: (res && res.capturedCardName) ? res.capturedCardName : null,
                    sourceSpecialType: (res && res.sourceSpecialType) ? res.sourceSpecialType : null,
                    insertIndex: (res && Number.isInteger(res.insertIndex)) ? res.insertIndex : null
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                return;
            }
            if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget) {
                const swapped = CardLogic.applySwapEffect(
                    cardState,
                    gameState,
                    playerKey,
                    action.swapTarget.row,
                    action.swapTarget.col
                );
                events.push({ type: 'swap_selected', player: playerKey, row: action.swapTarget.row, col: action.swapTarget.col, swapped });
                if (!swapped) {
                    throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
                }
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget == null) {
                const hasLegacyBoardClickTarget = Number.isInteger(action.row) && Number.isInteger(action.col);
                if (!hasLegacyBoardClickTarget) {
                    throw new Error('SWAP_WITH_ENEMY requires swapTarget before placement');
                }
            }
            if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget) {
                const res = CardLogic.applyPositionSwapWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.positionSwapTarget.row,
                    action.positionSwapTarget.col
                );
                events.push({
                    type: res && res.completed ? 'position_swap_selected' : 'position_swap_first_selected',
                    player: playerKey,
                    target: action.positionSwapTarget,
                    from: res && res.from ? res.from : (res && res.firstTarget ? res.firstTarget : null),
                    to: res && res.to ? res.to : null,
                    applied: !!(res && res.applied),
                    completed: !!(res && res.completed)
                });
                applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget == null) {
                throw new Error('POSITION_SWAP_WILL requires positionSwapTarget before placement');
            }
            if (requirePendingActionValue(pending, 'TRAP_WILL', action.trapTarget, 'TRAP_WILL requires trapTarget before placement')) {
                const res = CardLogic.applyTrapWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.trapTarget.row,
                    action.trapTarget.col
                );
                events.push({ type: 'trap_selected', player: playerKey, applied: !!(res && res.applied) });
                if (res && res.applied) {
                    handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                }
                return;
            }
            if (requirePendingActionValue(pending, ['GUARD_WILL', 'GUARDIAN_GOD'], action.guardTarget, 'GUARD-like card requires guardTarget before placement')) {
                const res = CardLogic.applyGuardWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.guardTarget.row,
                    action.guardTarget.col
                );
                events.push({ type: 'guard_selected', player: playerKey, target: action.guardTarget, applied: !!(res && res.applied) });
                return;
            }
            if (requirePendingActionValue(pending, 'LIVING_WILL', action.livingWillTarget, 'LIVING_WILL requires livingWillTarget before placement')) {
                const res = CardLogic.applyLivingWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.livingWillTarget.row,
                    action.livingWillTarget.col
                );
                events.push({ type: 'living_will_selected', player: playerKey, target: action.livingWillTarget, applied: !!(res && res.applied) });
                return;
            }
            if (pending && pending.type === 'HYPERACTIVE_INHERIT_WILL' && action.hyperactiveInheritTarget) {
                const res = CardLogic.applyHyperactiveInheritWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.hyperactiveInheritTarget.row,
                    action.hyperactiveInheritTarget.col
                );
                events.push({ type: 'hyperactive_inherit_selected', player: playerKey, target: action.hyperactiveInheritTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'HYPERACTIVE_INHERIT_WILL' && action.hyperactiveInheritTarget == null) {
                throw new Error('HYPERACTIVE_INHERIT_WILL requires hyperactiveInheritTarget before placement');
            }
            if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget) {
                const applyExtendLife = pending.type === 'EXTEND_LIFE_GOD'
                    ? CardLogic.applyExtendLifeGod
                    : CardLogic.applyExtendLifeWill;
                const res = applyExtendLife(
                    cardState,
                    gameState,
                    playerKey,
                    action.extendTarget.row,
                    action.extendTarget.col
                );
                events.push({
                    type: 'extend_life_selected',
                    player: playerKey,
                    target: action.extendTarget,
                    applied: !!(res && res.applied),
                    cardType: pending.type,
                    multiplier: res && Number.isFinite(res.multiplier) ? Number(res.multiplier) : (pending.type === 'EXTEND_LIFE_GOD' ? 4 : 2),
                    details: res ? { previous: res.previousRemainingOwnerTurns, current: res.newRemainingOwnerTurns } : null
                });
                return;
            } else if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget == null) {
                throw new Error(`${pending.type} requires extendTarget before placement`);
            }
            if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget) {
                const res = CardLogic.applyCorrosionWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.corrosionTarget.row,
                    action.corrosionTarget.col
                );
                events.push({
                    type: 'corrosion_will_resolved',
                    player: playerKey,
                    target: action.corrosionTarget,
                    applied: !!(res && res.applied),
                    affectedCount: Number(res && res.affectedCount) || 0,
                    details: Array.isArray(res && res.details) ? res.details : []
                });
                return;
            } else if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget == null) {
                throw new Error('CORROSION_WILL requires corrosionTarget before placement');
            }
            if (pending && pending.type === 'TIME_BOMB' && action.bombTarget) {
                const res = CardLogic.applyTimeBombWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.bombTarget.row,
                    action.bombTarget.col
                );
                events.push({ type: 'time_bomb_selected', player: playerKey, target: action.bombTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'TIME_BOMB' && action.bombTarget == null) {
                throw new Error('TIME_BOMB requires bombTarget before placement');
            }
            if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget) {
                const res = CardLogic.applyCloneWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.cloneTarget.row,
                    action.cloneTarget.col,
                    prng
                );
                events.push({
                    type: 'clone_selected',
                    player: playerKey,
                    target: action.cloneTarget,
                    applied: !!(res && res.applied),
                    details: (res && Array.isArray(res.spawned)) ? res.spawned : [],
                    spawned: (res && Array.isArray(res.spawned)) ? res.spawned : []
                });
                return;
            } else if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget == null) {
                throw new Error('CLONE_WILL requires cloneTarget before placement');
            }
            if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget) {
                const isGodExpansion = pending.type === 'BOARD_EXPANSION_GOD';
                const applyFn = (isGodExpansion && typeof CardLogic.applyBoardExpansionGod === 'function')
                    ? CardLogic.applyBoardExpansionGod
                    : CardLogic.applyBoardExpansionWill;
                const res = applyFn(
                    cardState,
                    gameState,
                    playerKey,
                    action.expansionTarget.row,
                    action.expansionTarget.col
                );
                if (isGodExpansion && res && res.applied && res.completed === false) {
                    events.push({
                        type: 'board_expansion_first_selected',
                        player: playerKey,
                        cardType: pending.type,
                        target: action.expansionTarget,
                        selectedCount: Number(res.selectedCount) || 1,
                        maxSelections: Number(res.maxSelections) || 2,
                        remainingSelections: Number(res.remainingSelections) || 1,
                        selectedTargets: Array.isArray(res.selectedTargets) ? res.selectedTargets : null,
                        applied: true,
                        completed: false
                    });
                } else {
                    events.push({
                        type: 'board_expansion_selected',
                        player: playerKey,
                        cardType: pending.type,
                        target: action.expansionTarget,
                        side: res && res.side ? res.side : null,
                        row: res && Number.isInteger(res.row) ? res.row : null,
                        added: (res && Array.isArray(res.added)) ? res.added : null,
                        selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
                        sources: (res && Array.isArray(res.sources)) ? res.sources : null,
                        applied: !!(res && res.applied),
                        completed: !(res && res.completed === false)
                    });
                }
                return;
            } else if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget == null) {
                throw new Error(`${pending.type} requires expansionTarget before placement`);
            }
            if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget) {
                const isGodShrink = pending.type === 'BOARD_SHRINK_GOD';
                const applyFn = (isGodShrink && typeof CardLogic.applyBoardShrinkGod === 'function')
                    ? CardLogic.applyBoardShrinkGod
                    : CardLogic.applyBoardShrinkWill;
                const res = applyFn(
                    cardState,
                    gameState,
                    playerKey,
                    action.shrinkTarget.row,
                    action.shrinkTarget.col
                );
                events.push({
                    type: 'board_shrink_selected',
                    player: playerKey,
                    cardType: pending.type,
                    target: action.shrinkTarget,
                    firstTarget: res && res.firstTarget ? res.firstTarget : null,
                    selectedCount: Number.isFinite(Number(res && res.selectedCount)) ? Number(res.selectedCount) : null,
                    maxSelections: Number.isFinite(Number(res && res.maxSelections)) ? Number(res.maxSelections) : null,
                    remainingSelections: Number.isFinite(Number(res && res.remainingSelections)) ? Number(res.remainingSelections) : null,
                    selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
                    lineTargets: (res && Array.isArray(res.lineTargets)) ? res.lineTargets : null,
                    changedTargets: (res && Array.isArray(res.changedTargets)) ? res.changedTargets : null,
                    skippedTargets: (res && Array.isArray(res.skippedTargets)) ? res.skippedTargets : null,
                    applied: !!(res && res.applied),
                    completed: !(res && res.completed === false)
                });
                return;
            } else if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget == null) {
                throw new Error(`${pending.type} requires shrinkTarget before placement`);
            }
            if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget) {
                const res = CardLogic.applyBlockadeWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.blockadeTarget.row,
                    action.blockadeTarget.col
                );
                events.push({ type: 'blockade_selected', player: playerKey, target: action.blockadeTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget == null) {
                throw new Error('BLOCKADE_WILL requires blockadeTarget before placement');
            }
            if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget) {
                const res = CardLogic.applyMeteorWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.meteorTarget.row,
                    action.meteorTarget.col,
                    p
                );
                events.push({
                    type: 'meteor_selected',
                    player: playerKey,
                    target: action.meteorTarget,
                    applied: !!(res && res.applied),
                    destroyed: !!(res && res.destroyed)
                });
                return;
            } else if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget == null) {
                throw new Error('METEOR_WILL requires meteorTarget before placement');
            }
            if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget) {
                const res = CardLogic.applyFreezeWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.freezeTarget.row,
                    action.freezeTarget.col
                );
                events.push({ type: 'freeze_selected', player: playerKey, target: action.freezeTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget == null) {
                throw new Error('FREEZE_WILL requires freezeTarget before placement');
            }
            if (pending && pending.type === 'SEED_WILL' && action.seedTarget) {
                const res = CardLogic.applySeedWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.seedTarget.row,
                    action.seedTarget.col
                );
                events.push({ type: 'seed_selected', player: playerKey, target: action.seedTarget, applied: !!(res && res.applied) });
                return;
            } else if (pending && pending.type === 'SEED_WILL' && action.seedTarget == null) {
                throw new Error('SEED_WILL requires seedTarget before placement');
            }

            // Determine flips using a safe context helper when possible
            const ctx = resolveSafeCardContext(CardLogic, cardState);
            const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;

            const blockedCells = (ctx && Array.isArray(ctx.blockedCells)) ? ctx.blockedCells : [];
            const blockedSet = blockedCells.length ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`)) : null;
            if (blockedSet && blockedSet.has(`${action.row},${action.col}`)) {
                throw new Error('Illegal move: blocked cell');
            }

            // SWAP_WITH_ENEMY selection via board click (legacy browser path).
            // Treat as selection-only action (same as action.swapTarget).
            const pendingType = getPendingEffectTypeForActionPhase(CardLogic, cardState, playerKey);
            if (pendingType === 'SWAP_WITH_ENEMY') {
                const targetCell = getActionCellOwner(gameState, action.row, action.col);
                if (targetCell === -playerValue) {
                    const swapped = CardLogic.applySwapEffect(cardState, gameState, playerKey, action.row, action.col);
                    events.push({ type: 'swap_selected', player: playerKey, row: action.row, col: action.col, swapped });
                    if (!swapped) {
                        throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
                    }
                    applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events);
                    handOffTurnAfterSelection(Core, CardLogic, cardState, gameState, playerKey);
                    return;
                } else {
                    throw new Error('SWAP_WITH_ENEMY requires selecting an enemy stone before placement');
                }
            }

            let flips = [];
            let tabooReverseApplied = false;
            let tabooReverseResult = null;

            if (pendingType === 'TABOO_REVERSE_WILL' && typeof CardLogic.pickTabooReverseFlips === 'function') {
                const normalFlips = Core.getFlipsWithContext(gameState, action.row, action.col, playerValue, ctx);
                tabooReverseResult = CardLogic.pickTabooReverseFlips(cardState, gameState, playerKey, action.row, action.col, p);
                if (tabooReverseResult && tabooReverseResult.applied && Array.isArray(tabooReverseResult.flips) && tabooReverseResult.flips.length > 0) {
                    flips = tabooReverseResult.flips.map((one: any) => [one.row, one.col]);
                    tabooReverseApplied = true;
                } else {
                    flips = normalFlips;
                }
            } else {
                flips = Core.getFlipsWithContext(gameState, action.row, action.col, playerValue, ctx);
            }
            let flipCount = flips.length;

            // For legality, require flips > 0 unless the pending card explicitly allows free placement.
            // TABOO_REVERSE_WILL first tries taboo flips, and falls back to normal sandwich flips when taboo is unavailable.
            const freePlacement = !!(
                CardLogic &&
                typeof CardLogic.isFreePlacementPendingType === 'function' &&
                CardLogic.isFreePlacementPendingType(pendingType)
            );
            if (flipCount === 0 && !freePlacement) {
                throw new Error('Illegal move: no flips and not free placement');
            }

            // Save pre-extra to determine if this placement consumes an existing extra place
            const preExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;

            const turnNumberBeforePlace = Number(gameState.turnNumber || 0);

            let flipEvadeResult = null;

            if (BoardOps && typeof BoardOps.spawnAt === 'function') {
                const spawnCause = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'FREE_PLACEMENT' : 'SYSTEM';
                const spawnReason = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'free_placement_place' : 'standard_place';
                const spawnMeta: Record<string, any> = {};
                if (pendingType === 'GOLD_STONE') {
                    spawnMeta.special = 'GOLD';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'RAINBOW_STONE') {
                    spawnMeta.special = 'RAINBOW';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'SILVER_STONE') {
                    spawnMeta.special = 'SILVER';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'CROSS_BOMB') {
                    // Show bomb-like special visual briefly before immediate cross explosion.
                    spawnMeta.special = 'CROSS_BOMB';
                    spawnMeta.owner = playerKey;
                } else if (pendingType === 'X_BOMB') {
                    // Reuse bomb-like visual before immediate diagonal cross explosion.
                    spawnMeta.special = 'X_BOMB';
                    spawnMeta.owner = playerKey;
                }
                BoardOps.spawnAt(cardState, gameState, action.row, action.col, playerKey, spawnCause, spawnReason, spawnMeta);
                if (flipCount > 0 && typeof CardLogic.resolveHyperactiveFlipEvasion === 'function') {
                    flipEvadeResult = CardLogic.resolveHyperactiveFlipEvasion(cardState, gameState, flips, playerKey, p);
                    if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
                        flips = flipEvadeResult.remainingFlips.slice();
                        flipCount = flips.length;
                    }
                }
                const flipCause = tabooReverseApplied ? 'TABOO_REVERSE_WILL' : 'SYSTEM';
                const flipReason = tabooReverseApplied ? 'taboo_reverse_flip' : 'standard_flip';
                const appliedPrimaryFlips = [];
                for (const [fr, fc] of flips) {
                    const changeMeta = tabooReverseApplied ? { allowGhostFlip: true } : undefined;
                    const changeRes = BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, flipCause, flipReason, changeMeta);
                    if (changeRes && changeRes.changed) {
                        if (tabooReverseApplied && CardLogic && typeof CardLogic.transferCellMarkerOwnership === 'function') {
                            CardLogic.transferCellMarkerOwnership(cardState, fr, fc, playerKey);
                        }
                        appliedPrimaryFlips.push([fr, fc]);
                    }
                }
                flips = appliedPrimaryFlips;
                flipCount = flips.length;
            } else {
                const newState = Core.applyMove(gameState, { row: action.row, col: action.col, flips });
                Object.assign(gameState, newState);
            }

            if (flipEvadeResult) {
                const movedList = Array.isArray(flipEvadeResult.moved) ? flipEvadeResult.moved : [];
                const destroyedList = Array.isArray(flipEvadeResult.destroyed) ? flipEvadeResult.destroyed : [];

                const ultimateMoved = movedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
                const hyperMoved = movedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
                if (hyperMoved.length) {
                    events.push({ type: 'hyperactive_moved_immediate', details: hyperMoved });
                }
                if (ultimateMoved.length) {
                    events.push({ type: 'ultimate_hyperactive_moved_immediate', details: ultimateMoved });
                }

                const ultimateDestroyed = destroyedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() === 'ULTIMATE_HYPERACTIVE');
                const hyperDestroyed = destroyedList.filter((detail: any) => String(detail && detail.specialType ? detail.specialType : '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE');
                if (hyperDestroyed.length) {
                    events.push({ type: 'hyperactive_destroyed_immediate', details: hyperDestroyed });
                }
                if (ultimateDestroyed.length) {
                    events.push({ type: 'ultimate_hyperactive_destroyed_immediate', details: ultimateDestroyed });
                }
            }

            events.push({ type: 'place', player: playerKey, row: action.row, col: action.col, flips: flips.slice() });
            if (tabooReverseApplied) {
                events.push({
                    type: 'taboo_reverse_flipped',
                    details: (tabooReverseResult && Array.isArray(tabooReverseResult.flips)) ? tabooReverseResult.flips.slice() : [],
                    direction: (tabooReverseResult && Array.isArray(tabooReverseResult.direction)) ? tabooReverseResult.direction.slice() : null
                });
            }

            const bonusKey = `${action.row},${action.col}`;
            const bonusMap = (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null;
            const pendingPlacementType = getPendingEffectTypeForActionPhase(CardLogic, cardState, playerKey);
            const numberCellMultiplierConfig = (
                pendingPlacementType &&
                CardLogic &&
                CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS &&
                CardLogic.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS[pendingPlacementType]
            ) || null;
            let boardBonusGained = 0;
            if (!cardState.boardBonusConsumedByCell || typeof cardState.boardBonusConsumedByCell !== 'object') {
                cardState.boardBonusConsumedByCell = {};
            }
            const consumedMap = cardState.boardBonusConsumedByCell;
            const bonusValue = bonusMap ? Number(bonusMap[bonusKey] || 0) : 0;
            if (bonusValue > 0 && consumedMap[bonusKey] !== true) {
                consumedMap[bonusKey] = true;
                const appliedBonus = numberCellMultiplierConfig
                    ? bonusValue * Number(numberCellMultiplierConfig.multiplier || 1)
                    : bonusValue;
                const gained = applyPlacementBoardBonusGain(
                    CardLogic,
                    cardState,
                    playerKey,
                    action.row,
                    action.col,
                    appliedBonus,
                    flipCount
                );
                boardBonusGained = gained;
                events.push({
                    type: 'board_bonus_gain',
                    player: playerKey,
                    row: action.row,
                    col: action.col,
                    bonus: bonusValue,
                    gained,
                    multiplier: numberCellMultiplierConfig ? Number(numberCellMultiplierConfig.multiplier || 1) : 1,
                    boostedBy: numberCellMultiplierConfig ? pendingPlacementType : null
                });
            }

            if (!tabooReverseApplied && flips.length > 0 && typeof CardLogic.clearBombAt === 'function') {
                for (const [r, c] of flips) {
                    CardLogic.clearBombAt(cardState, r, c);
                }
            }
            if (!tabooReverseApplied && flips.length > 0 && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                const flippedPositions = flips.map(([r, c]: [any, any]) => ({ row: r, col: c }));
                CardLogic.clearHyperactiveAtPositions(cardState, flippedPositions);
            }

            // REGEN handling immediately after primary flips
            if (!tabooReverseApplied && flipCount > 0 && typeof CardLogic.applyRegenAfterFlips === 'function') {
                const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, flips, playerKey);
                const regenRes = reviveRes.regenRes;
                const livingWillRes = reviveRes.livingWillRes;
                if (regenRes.regened && regenRes.regened.length) {
                    events.push({ type: 'regen_triggered', details: regenRes.regened });
                }
                if (regenRes.captureFlips && regenRes.captureFlips.length) {
                    flips.push(...regenRes.captureFlips.map((p2: any) => [p2.row, p2.col]));
                    flipCount = flips.length;
                    events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                }
                if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                    events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
                }
            }

            // Chain-will family: apply extra flips after normal flips, before placement effects
            if (typeof CardLogic.applyChainWillAfterMove === 'function') {
                const chainRes = CardLogic.applyChainWillAfterMove(cardState, gameState, playerKey, flips, p);
                if (chainRes && chainRes.flips && chainRes.flips.length) {
                    flips.push(...chainRes.flips.map((pos: any) => [pos.row, pos.col]));
                    flipCount = flips.length;
                    events.push({ type: 'chain_flipped', details: chainRes.flips });
                }

                // REGEN after chain flips
                if (chainRes && chainRes.flips && chainRes.flips.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                    const reviveRes2 = applyPostFlipRevives(CardLogic, cardState, gameState, chainRes.flips, playerKey);
                    const regenRes2 = reviveRes2.regenRes;
                    const livingWillRes2 = reviveRes2.livingWillRes;
                    if (regenRes2.regened && regenRes2.regened.length) {
                        events.push({ type: 'regen_triggered', details: regenRes2.regened });
                    }
                    if (regenRes2.captureFlips && regenRes2.captureFlips.length) {
                        flips.push(...regenRes2.captureFlips.map((p3: any) => [p3.row, p3.col]));
                        flipCount = flips.length;
                        events.push({ type: 'regen_capture_flipped', details: regenRes2.captureFlips });
                    }
                    if (livingWillRes2 && livingWillRes2.restored && livingWillRes2.restored.length) {
                        events.push({ type: 'living_will_triggered', details: livingWillRes2.restored });
                    }
                }
            }

            // 4) Apply placement effects (charge, special stones, etc.)
            const effects = CardLogic.applyPlacementEffects(cardState, gameState, playerKey, action.row, action.col, flipCount);
            if (numberCellMultiplierConfig && effects && numberCellMultiplierConfig.gainField && boardBonusGained > 0) {
                effects[numberCellMultiplierConfig.effectFlag] = true;
                effects[numberCellMultiplierConfig.gainField] = boardBonusGained;
            }
            events.push({ type: 'placement_effects', player: playerKey, row: action.row, col: action.col, effects });
            const placementChargeBubble = buildPlacementChargeBubblePayload(
                playerKey,
                action.row,
                action.col,
                flipCount,
                boardBonusGained,
                effects
            );
            if (placementChargeBubble) {
                emitBoardChargeBubblePresentation(CardLogic, cardState, placementChargeBubble);
            }
            emitSpecialStonePlacementBubbleFromEffects(
                CardLogic,
                cardState,
                playerKey,
                action.row,
                action.col,
                effects,
                p
            );

            // GOLD/SILVER: the placed stone disappears on the opponent's next turn start.

            // Immediate activation on placement turn (spec): dragon/breeding fire immediately after normal flips.
            if (effects && effects.dragonPlaced && typeof CardLogic.processDragonEffectsAtAnchor === 'function') {
                const dragonNow = CardLogic.processDragonEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col);
                if (dragonNow.converted && dragonNow.converted.length) {
                    awardBoardChargeGain(CardLogic, cardState, playerKey, dragonNow.converted.length, {
                        anchorRow: action.row,
                        anchorCol: action.col,
                        moved: dragonNow.moved,
                        sourceType: 'dragon_immediate'
                    });
                    events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
                }
            }
            if (effects && effects.breedingPlaced && typeof CardLogic.processBreedingEffectsAtAnchor === 'function') {
                const breedingNow = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, p);
                if (breedingNow.spawned && breedingNow.spawned.length) {
                    events.push({ type: 'breeding_spawned_immediate', details: breedingNow.spawned });
                }
                if (breedingNow.flipped && breedingNow.flipped.length) {
                    awardBoardChargeGain(CardLogic, cardState, playerKey, breedingNow.flipped.length, {
                        anchorRow: action.row,
                        anchorCol: action.col,
                        sourceType: 'breeding_immediate'
                    });
                    events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
                }
            }
            if (effects && effects.ultimateDestroyGodPlaced && typeof CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
                const udgNow = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, { decrementRemainingOwnerTurns: false });
                if (udgNow.destroyed && udgNow.destroyed.length) {
                    events.push({ type: 'udg_destroyed_immediate', details: udgNow.destroyed });
                }
            }
            if (effects && effects.destroyDragonPlaced && typeof CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
                const destroyDragonNow = CardLogic.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (destroyDragonNow && destroyDragonNow.destroyed && destroyDragonNow.destroyed.length) {
                    events.push({ type: 'destroy_dragon_destroyed_immediate', details: destroyDragonNow.destroyed });
                }
                if (destroyDragonNow && destroyDragonNow.expired && destroyDragonNow.expired.length) {
                    events.push({ type: 'destroy_dragon_expired_immediate', details: destroyDragonNow.expired });
                }
            }
            if (effects && effects.sniperPlaced && typeof CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
                const sniperNow = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (sniperNow && sniperNow.destroyed && sniperNow.destroyed.length) {
                    events.push({ type: 'sniper_destroyed_immediate', details: sniperNow.destroyed });
                }
                if (sniperNow && sniperNow.expired && sniperNow.expired.length) {
                    events.push({ type: 'sniper_expired_immediate', details: sniperNow.expired });
                }
            }
            if (effects && effects.lightningPlaced && typeof CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
                const lightningNow = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (lightningNow && lightningNow.destroyed && lightningNow.destroyed.length) {
                    events.push({ type: 'lightning_destroyed_immediate', details: lightningNow.destroyed });
                }
                if (lightningNow && lightningNow.expired && lightningNow.expired.length) {
                    events.push({ type: 'lightning_expired_immediate', details: lightningNow.expired });
                }
            }
            if (effects && effects.willHunterKingPlaced && typeof CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
                const willHunterKingNow = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, action.row, action.col, {
                    decrementRemainingOwnerTurns: false,
                    random: p
                });
                if (willHunterKingNow && willHunterKingNow.destroyed && willHunterKingNow.destroyed.length) {
                    events.push({ type: 'will_hunter_king_destroyed_immediate', details: willHunterKingNow.destroyed });
                }
                if (willHunterKingNow && willHunterKingNow.moved && willHunterKingNow.moved.length) {
                    events.push({ type: 'will_hunter_king_moved_immediate', details: willHunterKingNow.moved });
                }
                if (willHunterKingNow && willHunterKingNow.expired && willHunterKingNow.expired.length) {
                    events.push({ type: 'will_hunter_king_expired_immediate', details: willHunterKingNow.expired });
                }
            }
            if (effects && effects.observerPlaced) {
                const line = pickRandomLine(OBSERVER_PLACE_LINES, p);
                if (line) {
                    emitObserverBubblePresentation(CardLogic, cardState, {
                        player: playerKey,
                        row: action.row,
                        col: action.col,
                        text: line,
                        reason: 'placed'
                    });
                }
            }
            if (effects && effects.workPlaced) {
                const line = pickRandomLine(WORK_PLACE_LINES, p);
                if (line) {
                    emitWorkBubblePresentation(CardLogic, cardState, {
                        player: playerKey,
                        row: action.row,
                        col: action.col,
                        text: line,
                        reason: 'placed'
                    });
                }
            }
            // NOTE: Per spec change (2026-01-26), hyperactive stones do NOT move on the placement turn.
            // Previous behavior ran an immediate hyperactive activation here; it has been removed so that
            // hyperactive moves only occur at turn-start processing (consistent and deterministic).
            if (effects && effects.hyperactivePlaced && !effects.instantHyperactivePlaced) {
                if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.log('[TurnPipeline] hyperactivePlaced detected on placement — immediate activation suppressed by spec');
            }
            if (effects && effects.instantHyperactivePlaced && typeof CardLogic.processInstantHyperactiveMoveAtAnchor === 'function') {
                const instantHyper = CardLogic.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, action.row, action.col, p);
                if (instantHyper && instantHyper.moved && instantHyper.moved.length) {
                    events.push({ type: 'hyperactive_moved_immediate', details: instantHyper.moved });
                }
                if (instantHyper && instantHyper.flipped && instantHyper.flipped.length) {
                    events.push({ type: 'hyperactive_flipped_immediate', details: instantHyper.flipped });
                    awardBoardChargeGain(CardLogic, cardState, playerKey, instantHyper.flipped.length, {
                        anchorRow: action.row,
                        anchorCol: action.col,
                        moved: instantHyper.moved,
                        sourceType: 'instant_hyperactive_immediate'
                    });
                }
                if (instantHyper && instantHyper.destroyed && instantHyper.destroyed.length) {
                    events.push({ type: 'hyperactive_destroyed_immediate', details: instantHyper.destroyed });
                }
                if (instantHyper && instantHyper.flipped && instantHyper.flipped.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                    const reviveRes3 = applyPostFlipRevives(CardLogic, cardState, gameState, instantHyper.flipped, playerKey);
                    const regenRes3 = reviveRes3.regenRes;
                    const livingWillRes3 = reviveRes3.livingWillRes;
                    if (regenRes3 && regenRes3.regened && regenRes3.regened.length) {
                        events.push({ type: 'regen_triggered', details: regenRes3.regened });
                    }
                    if (regenRes3 && regenRes3.captureFlips && regenRes3.captureFlips.length) {
                        if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                            CardLogic.clearHyperactiveAtPositions(cardState, regenRes3.captureFlips);
                        }
                        const firstCapture = regenRes3.captureFlips[0] || {};
                        awardBoardChargeGain(CardLogic, cardState, playerKey, regenRes3.captureFlips.length, {
                            targetRow: firstCapture.row,
                            targetCol: firstCapture.col,
                            sourceType: 'regen_capture_immediate'
                        });
                        events.push({ type: 'regen_capture_flipped', details: regenRes3.captureFlips });
                    }
                    if (livingWillRes3 && livingWillRes3.restored && livingWillRes3.restored.length) {
                        events.push({ type: 'living_will_triggered', details: livingWillRes3.restored });
                    }
                }
            }
            // ULTIMATE_HYPERACTIVE_GOD also starts from turn-start processing only.
            if (effects && effects.ultimateHyperactivePlaced) {
                if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.log('[TurnPipeline] ultimateHyperactivePlaced detected on placement — immediate activation suppressed by spec');
            }

            if (typeof CardLogic.processTrapEffects === 'function') {
                const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: false });
                pushTrapEvents(events, trapRes);
                emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
            }

            const continuationSourceType = (cardState.multiPlaceSourceTypeByPlayer && typeof cardState.multiPlaceSourceTypeByPlayer[playerKey] === 'string')
                ? cardState.multiPlaceSourceTypeByPlayer[playerKey]
                : null;
            const infinitePlaceActive = !!(cardState.infinitePlaceActiveByPlayer && cardState.infinitePlaceActiveByPlayer[playerKey]);

            // If preExtra > 0 then this placement consumes one extra place.
            if (preExtra > 0) {
                cardState.extraPlaceRemainingByPlayer[playerKey] = Math.max(0, (cardState.extraPlaceRemainingByPlayer[playerKey] || 0) - 1);
                events.push({
                    type: 'extra_place_consumed',
                    player: playerKey,
                    sourceType: continuationSourceType || (pendingType === 'LAST_RESORT' ? 'LAST_RESORT' : null),
                    remaining: cardState.extraPlaceRemainingByPlayer[playerKey] || 0
                });
            }

            let postExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;
            const pendingAfterPlacement = readPendingForActionPhase(cardState, playerKey);
            const hasLastResortContinuation = !!(
                pendingAfterPlacement &&
                pendingAfterPlacement.type === 'LAST_RESORT' &&
                Number(pendingAfterPlacement.placementsRemaining || 0) > 0
            );

            let keepTurnForContinuation = false;
            if (infinitePlaceActive) {
                keepTurnForContinuation = hasContinuationMovesForPendingType(Core, CardLogic, cardState, gameState, playerKey, continuationSourceType);
                if (!keepTurnForContinuation) {
                    clearMultiPlaceStateForPlayer(cardState, playerKey);
                }
            } else if (postExtra > 0) {
                const continuationPendingType = hasLastResortContinuation ? 'LAST_RESORT' : continuationSourceType;
                keepTurnForContinuation = hasContinuationMovesForPendingType(Core, CardLogic, cardState, gameState, playerKey, continuationPendingType);
                if (!keepTurnForContinuation) {
                    if (hasLastResortContinuation) {
                        clearPendingForActionPhase(cardState, playerKey);
                    }
                    clearMultiPlaceStateForPlayer(cardState, playerKey);
                    postExtra = 0;
                }
            } else {
                clearMultiPlaceStateForPlayer(cardState, playerKey);
            }

            if (keepTurnForContinuation) {
                gameState.currentPlayer = playerValue;
                gameState.consecutivePasses = 0;
                gameState.turnNumber = turnNumberBeforePlace;
            } else {
                handOffCompletedTurn(Core, CardLogic, cardState, gameState, playerKey, turnNumberBeforePlace + 1);
            }
        } else {
            throw new Error('Unknown action.type');
        }
        } finally {
            emitObserverLostBubbleFromSnapshots(CardLogic, cardState, observerMarkersBeforeAction, 'removed_during_action');
            emitWorkRemovedPresentationFromSnapshots(CardLogic, cardState, workMarkersBeforeAction, {
                presentationStartIndex
            });
            emitSpecialStoneBubblesFromPhase(CardLogic, cardState, {
                events: Array.isArray(events) ? events.slice(eventStartIndex) : [],
                presentationEvents: Array.isArray(cardState.presentationEvents)
                    ? cardState.presentationEvents.slice(presentationStartIndex)
                    : [],
                beforeSnapshot: specialStoneSpeechBeforeAction,
                presentationStartIndex,
                prng: p,
                fallbackPlayer: playerKey,
                removalReason: 'removed_during_action'
            });
        }
    }

export = { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase };
