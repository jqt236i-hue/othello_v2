type TurnPresentationHelperDeps = {
    CardUtilsModule: any;
    OwnerHelpersModule: any;
    MarkersAdapter: any;
    MARKER_KINDS: any;
    getSpecialStoneBubbleSpeechLines: (type: any, scenario: any) => any;
    pickSpecialStoneBubbleSpeechLine: (type: any, scenario: any, prng: any) => any;
    resolveWorkIncomeLine?: (gained: any, incomeStep: any) => any;
};

const LEGACY_SPECIAL_STONE_BUBBLE_TYPES: Record<string, boolean | undefined> = Object.freeze({
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
    Object.freeze({ flag: 'stoneSalvationGodPlaced', special: 'STONE_SALVATION_GOD' }),
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

function normalizePlayerKey(player: any, deps: TurnPresentationHelperDeps) {
    if (deps && deps.OwnerHelpersModule && typeof deps.OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        const normalized = deps.OwnerHelpersModule.normalizePlayerKeyOptional(player);
        if (normalized) return normalized;
    }
    if (player === 'black' || player === 1 || player === '1') return 'black';
    if (player === 'white' || player === -1 || player === '-1') return 'white';
    return null;
}

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

function resolveWorkIncomeLineFallback(gained: any) {
    return `布石+${Number(gained) || 0} 労働の成果だ`;
}

function emitWorkBubblePresentation(CardLogic: any, cardState: any, payload: any, deps: TurnPresentationHelperDeps) {
    const resolveWorkIncomeLine = (deps && typeof deps.resolveWorkIncomeLine === 'function')
        ? deps.resolveWorkIncomeLine
        : resolveWorkIncomeLineFallback;
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

function resolveSpecialStoneBubblePlayer(payload: any, deps: TurnPresentationHelperDeps) {
    const data = (payload && typeof payload === 'object') ? payload : {};
    return normalizePlayerKey(
        data.player !== undefined ? data.player
            : data.owner !== undefined ? data.owner
                : data.ownerBefore !== undefined ? data.ownerBefore
                    : data.ownerAfter !== undefined ? data.ownerAfter
                        : (data.meta && data.meta.owner !== undefined) ? data.meta.owner : null,
        deps
    );
}

function buildSpecialStoneBubbleKey(special: any, scenario: any, row: any, col: any, player: any) {
    const typeKey = normalizeSpecialStoneBubbleType(special);
    const scenarioKey = normalizeSpecialStoneBubbleScenarioKey(scenario);
    const rowKey = Number(row);
    const colKey = Number(col);
    if (!typeKey || !scenarioKey || !Number.isInteger(rowKey) || !Number.isInteger(colKey)) return null;
    const ownerKey = String(player || '').trim();
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

function emitSpecialStoneBubblePresentation(CardLogic: any, cardState: any, payload: any, options: any, deps: TurnPresentationHelperDeps) {
    if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return false;
    const data = (payload && typeof payload === 'object') ? payload : {};
    const opts = (options && typeof options === 'object') ? options : {};
    const special = normalizeSpecialStoneBubbleType(data.special);
    const scenario = normalizeSpecialStoneBubbleScenarioKey(data.scenario);
    const player = resolveSpecialStoneBubblePlayer(data, deps);
    const row = Number(data.row);
    const col = Number(data.col);
    if (!special || !scenario || !Number.isInteger(row) || !Number.isInteger(col)) return false;
    const allowLegacy = opts.allowLegacy === true || scenario === 'living_will_restored';
    if (isLegacySpecialStoneBubbleType(special) && !allowLegacy) return false;
    const explicitText = (typeof data.text === 'string' && data.text.trim()) ? data.text.trim() : null;
    const text = explicitText || deps.pickSpecialStoneBubbleSpeechLine(special, scenario, opts.prng);
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

function emitSpecialStonePlacementBubbleFromEffects(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, effects: any, prng: any, deps: TurnPresentationHelperDeps) {
    const special = resolvePlacedSpecialStoneType(effects);
    if (!special) return false;
    return emitSpecialStoneBubblePresentation(CardLogic, cardState, {
        player: playerKey,
        row,
        col,
        special,
        scenario: 'place',
        reason: 'placed'
    }, { prng }, deps);
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

function snapshotWorkMarkers(cardState: any, deps: TurnPresentationHelperDeps) {
    const markers = (deps && deps.MarkersAdapter && typeof deps.MarkersAdapter.getMarkers === 'function')
        ? deps.MarkersAdapter.getMarkers(cardState)
        : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
    const out = [];
    for (const m of markers) {
        if (!m) continue;
        if (m.kind !== (deps && deps.MARKER_KINDS ? deps.MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
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
    for (let i = start; i < pres.length; i += 1) {
        const ev = pres[i];
        if (!ev || ev.type !== 'WORK_REMOVED') continue;
        if (Number(ev.row) === Number(row) && Number(ev.col) === Number(col)) return true;
    }
    return false;
}

function emitWorkRemovedPresentationFromSnapshots(CardLogic: any, cardState: any, beforeSnapshot: any, options: any, deps: TurnPresentationHelperDeps) {
    if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
    const opts = options || {};
    const afterSnapshot = snapshotWorkMarkers(cardState, deps);
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

function isGenericSpecialStoneBubbleType(type: any) {
    const key = normalizeSpecialStoneBubbleType(type);
    return !!key && !isLegacySpecialStoneBubbleType(key);
}

function snapshotSpecialStoneSpeechMarkers(cardState: any, deps: TurnPresentationHelperDeps) {
    const markers = (deps && deps.MarkersAdapter && typeof deps.MarkersAdapter.getMarkers === 'function')
        ? deps.MarkersAdapter.getMarkers(cardState)
        : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
    const out = [];
    for (const m of markers) {
        if (!m) continue;
        if (m.kind !== (deps && deps.MARKER_KINDS ? deps.MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
        const markerType = String(m.data && m.data.type ? m.data.type : '').trim().toUpperCase();
        if (!isGenericSpecialStoneBubbleType(markerType)) continue;
        if (
            !deps.getSpecialStoneBubbleSpeechLines(markerType, 'destroy') &&
            !deps.getSpecialStoneBubbleSpeechLines(markerType, 'duration_end') &&
            !deps.getSpecialStoneBubbleSpeechLines(markerType, 'escape_exploded')
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

function createSpecialStoneBubbleEmitter(CardLogic: any, cardState: any, prng: any, fallbackPlayer: any, tracker: any, deps: TurnPresentationHelperDeps) {
    const emitted = tracker instanceof Set ? tracker : new Set();
    return function emitSpecialStoneBubble(data: any) {
        const payload = (data && typeof data === 'object') ? data : null;
        if (!payload) return false;
        const special = String(payload.special || '').trim().toUpperCase();
        const scenario = String(payload.scenario || '').trim().toLowerCase();
        const row = Number(payload.row);
        const col = Number(payload.col);
        if (!special || !scenario || !Number.isInteger(row) || !Number.isInteger(col)) return false;
        const player = normalizePlayerKey(payload.player || fallbackPlayer, deps);
        const text = (typeof payload.text === 'string' && payload.text.trim())
            ? payload.text.trim()
            : deps.pickSpecialStoneBubbleSpeechLine(special, scenario, prng);
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
        }, deps);
    };
}

function emitSpecialStoneBubblesFromPhase(CardLogic: any, cardState: any, options: any, deps: TurnPresentationHelperDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const presentationEvents = Array.isArray(opts.presentationEvents) ? opts.presentationEvents : [];
    const phaseEvents = Array.isArray(opts.events) ? opts.events : [];
    const beforeSnapshot = Array.isArray(opts.beforeSnapshot) ? opts.beforeSnapshot : [];
    const tracker = createSpecialStoneBubbleTracker(cardState, opts.presentationStartIndex);
    const emitBubble = createSpecialStoneBubbleEmitter(CardLogic, cardState, opts.prng, opts.fallbackPlayer || null, tracker, deps);
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
        const player = normalizePlayerKey(ev.player || ev.owner || (ev.meta && ev.meta.owner) || opts.fallbackPlayer, deps);

        if ((ev.type === 'CHANGE' || ev.type === 'SPAWN') && isLivingWillRestorePresentationEvent(ev)) {
            if (deps.getSpecialStoneBubbleSpeechLines(special, 'living_will_restored')) {
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
            const scenario = escapeExploded && deps.getSpecialStoneBubbleSpeechLines(special, 'escape_exploded')
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
            const scenario = isProliferationTriggeredSpecialStoneBubbleEvent(ev, reason, cause) && deps.getSpecialStoneBubbleSpeechLines(special, 'proliferation_triggered')
                ? 'proliferation_triggered'
                : (isEscapeExplosionSpecialStoneBubbleReason(reason, cause) && deps.getSpecialStoneBubbleSpeechLines(special, 'escape_exploded'))
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

    const afterSnapshot = snapshotSpecialStoneSpeechMarkers(cardState, deps);
    const removed = getRemovedSpecialStoneSpeechMarkers(beforeSnapshot, afterSnapshot);
    for (const item of removed) {
        if (!item || !item.type) continue;
        if (findMatchingSpecialStoneStatusRemovedEvent(presentationEvents, item)) continue;
        if (hasMatchingSpecialStoneMovedFromPhaseEvent(phaseEvents, item)) continue;
        if (item.type === 'REGEN' && hasRegenTriggeredPresentationEventAt(presentationEvents, item.row, item.col)) continue;
        if (findMatchingLivingWillRestorePresentationEvent(presentationEvents, item, undefined, undefined)) continue;
        if (hasMatchingSpecialStoneStatusAppliedEvent(presentationEvents, item, undefined, undefined)) continue;
        const scenario = hasEscapeExplosionPresentationEventAt(presentationEvents, item) && deps.getSpecialStoneBubbleSpeechLines(item.type, 'escape_exploded')
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

function isFrozenCell(cardState: any, row: any, col: any, deps: TurnPresentationHelperDeps) {
    if (deps && deps.CardUtilsModule && typeof deps.CardUtilsModule.isFrozenCell === 'function') {
        return !!deps.CardUtilsModule.isFrozenCell(cardState, row, col);
    }
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === (deps && deps.MARKER_KINDS ? deps.MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
        Number(m.row) === Number(row) &&
        Number(m.col) === Number(col) &&
        m.data &&
        m.data.type === 'FREEZE'
    ));
}

function emitHandRemovePresentation(CardLogic: any, cardState: any, payload: any, deps: TurnPresentationHelperDeps) {
    if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
    const data = payload || {};
    const playerKey = normalizePlayerKey(data.player, deps);
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

function emitHandAddPresentation(CardLogic: any, cardState: any, payload: any, deps: TurnPresentationHelperDeps) {
    if (!CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
    const data = payload || {};
    const playerKey = normalizePlayerKey(data.player, deps);
    const count = Math.max(1, Math.trunc(Number(data.count) || 1));
    if (!playerKey) return;

    const ev: Record<string, any> = {
        type: 'HAND_ADD',
        player: playerKey,
        count,
        reason: data.reason || null
    };
    if (data.cardId) ev.cardId = data.cardId;
    if (data.meta && typeof data.meta === 'object') {
        ev.meta = { ...data.meta };
        if (data.reason && !ev.meta.reason) ev.meta.reason = data.reason;
    }

    CardLogic.emitPresentationEvent(cardState, ev);
}

function emitTrapHandRemoveEvents(CardLogic: any, cardState: any, trapRes: any, deps: TurnPresentationHelperDeps) {
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
        }, deps);
    }
}

const TurnPresentationHelpersModule = {
    emitObserverBubblePresentation,
    emitWorkBubblePresentation,
    emitSpecialStonePlacementBubbleFromEffects,
    emitBoardChargeBubblePresentation,
    emitWorkRemovedPresentationFromSnapshots,
    snapshotWorkMarkers,
    isWorkDurationEndPresentationEvent,
    snapshotSpecialStoneSpeechMarkers,
    emitSpecialStoneBubblesFromPhase,
    isFrozenCell,
    emitHandRemovePresentation,
    emitHandAddPresentation,
    emitTrapHandRemoveEvents,
    normalizePlayerKey
};

export = TurnPresentationHelpersModule;
