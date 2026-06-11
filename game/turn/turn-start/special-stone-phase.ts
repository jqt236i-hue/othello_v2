type TurnStartHyperAggregated = {
    moved: any[];
    destroyed: any[];
    flipped: any[];
    flippedByOwner: Record<string, any[]>;
};

type TurnStartSpecialStoneProcessingState = {
    hyperAggregated: TurnStartHyperAggregated;
};

const TheorySpawnImmediateEffectsModule = require('../theory-spawn-immediate-effects');

type ProcessTurnStartSpecialStoneOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    prng: any;
    markerAnchor: any;
    isFrozenCell: (cardState: any, row: any, col: any) => boolean;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
    debugLog?: (...args: any[]) => void;
    processingState: TurnStartSpecialStoneProcessingState;
};

function pushTurnStartDetailsEvent(events: any[], type: string, details: any): void {
    if (!Array.isArray(events) || !Array.isArray(details) || details.length === 0) return;
    events.push({ type, details });
}

function pushTurnStartResultDetails(events: any[], result: any, mappings: Array<{ field: string; type: string }>): void {
    if (!result || !Array.isArray(mappings)) return;
    for (let index = 0; index < mappings.length; index += 1) {
        const mapping = mappings[index];
        if (!mapping) continue;
        pushTurnStartDetailsEvent(events, mapping.type, result[mapping.field]);
    }
}

function createTurnStartSpecialStoneProcessingState(): TurnStartSpecialStoneProcessingState {
    return {
        hyperAggregated: {
            moved: [],
            destroyed: [],
            flipped: [],
            flippedByOwner: {
                black: [],
                white: []
            }
        }
    };
}
function pushTimeStopTurnStartEvents(events: any[], playerKey: any, row: any, col: any, res: any): void {
    if (res && Array.isArray(res.triggered) && res.triggered.length) {
        for (let index = 0; index < res.triggered.length; index += 1) {
            const detail = res.triggered[index];
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
        for (let index = 0; index < res.fizzled.length; index += 1) {
            const detail = res.fizzled[index];
            events.push({
                type: 'time_stop_fizzled',
                player: playerKey,
                row: detail && Number.isInteger(detail.row) ? detail.row : row,
                col: detail && Number.isInteger(detail.col) ? detail.col : col,
                reason: detail && detail.reason ? detail.reason : 'anchor_lost'
            });
        }
    }
}

function pushDragonTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, row: any, col: any, res: any): void {
    pushTurnStartDetailsEvent(options.events, 'dragon_moved_start', res && res.moved);
    if (res && res.converted && res.converted.length) {
        options.awardBoardChargeGain(options.CardLogic, options.cardState, options.playerKey, res.converted.length, {
            anchorRow: row,
            anchorCol: col,
            moved: res.moved,
            sourceType: 'dragon_turn_start'
        });
        options.events.push({ type: 'dragon_converted_start', details: res.converted });
    }
    pushTurnStartDetailsEvent(options.events, 'dragon_destroyed_anchor_start', res && res.destroyed);
}

function pushBreedingTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, row: any, col: any, res: any): void {
    pushTurnStartDetailsEvent(options.events, 'breeding_spawned_start', res && res.spawned);
    if (res && res.flipped && res.flipped.length) {
        options.awardBoardChargeGain(options.CardLogic, options.cardState, options.playerKey, res.flipped.length, {
            anchorRow: row,
            anchorCol: col,
            sourceType: 'breeding_turn_start'
        });
        options.events.push({ type: 'breeding_flipped_start', details: res.flipped });
    }
    pushTurnStartDetailsEvent(options.events, 'breeding_destroyed_anchor_start', res && res.destroyed);
}

function ensureHyperAggregatedOwnerBucket(hyperAggregated: TurnStartHyperAggregated, ownerKey: any): any[] {
    const key = String(ownerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    hyperAggregated.flippedByOwner[key] = hyperAggregated.flippedByOwner[key] || [];
    return hyperAggregated.flippedByOwner[key];
}

function pushHyperactiveTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, ownerKey: any, row: any, col: any, res: any): void {
    const hyperAggregated = options.processingState.hyperAggregated;
    if (res && res.moved && res.moved.length) {
        pushTurnStartDetailsEvent(options.events, 'hyperactive_moved_start', res.moved);
        hyperAggregated.moved.push(...res.moved);
    }
    pushTurnStartDetailsEvent(options.events, 'extreme_hyperactive_repelled_start', res && res.repelled);
    if (res && res.destroyed && res.destroyed.length) {
        pushTurnStartDetailsEvent(options.events, 'hyperactive_destroyed_start', res.destroyed);
        hyperAggregated.destroyed.push(...res.destroyed);
    }
    if (res && res.flipped && res.flipped.length) {
        options.events.push({ type: 'hyperactive_flipped_start', details: res.flipped });
        hyperAggregated.flipped.push(...res.flipped);
        ensureHyperAggregatedOwnerBucket(hyperAggregated, ownerKey).push(...res.flipped);
        options.awardBoardChargeGain(options.CardLogic, options.cardState, ownerKey, res.flipped.length, {
            anchorRow: row,
            anchorCol: col,
            moved: res.moved,
            sourceType: 'hyperactive_turn_start'
        });
    }
}

function pushRobotVacuumTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, ownerKey: any, row: any, col: any, res: any): void {
    const hyperAggregated = options.processingState.hyperAggregated;
    if (res && res.moved && res.moved.length) {
        pushTurnStartDetailsEvent(options.events, 'robot_vacuum_moved_start', res.moved);
        hyperAggregated.moved.push(...res.moved);
    }
    if (res && res.destroyed && res.destroyed.length) {
        pushTurnStartDetailsEvent(options.events, 'robot_vacuum_destroyed_start', res.destroyed);
        hyperAggregated.destroyed.push(...res.destroyed);
    }
    pushTurnStartDetailsEvent(options.events, 'robot_vacuum_expired_start', res && res.expired);
    pushTurnStartDetailsEvent(options.events, 'robot_vacuum_sucked_start', res && res.sucked);
    if (res && res.flipped && res.flipped.length) {
        options.events.push({ type: 'robot_vacuum_flipped_start', details: res.flipped });
        hyperAggregated.flipped.push(...res.flipped);
        ensureHyperAggregatedOwnerBucket(hyperAggregated, ownerKey).push(...res.flipped);
        options.awardBoardChargeGain(options.CardLogic, options.cardState, ownerKey, res.flipped.length, {
            anchorRow: row,
            anchorCol: col,
            moved: res.moved,
            sourceType: 'robot_vacuum_turn_start'
        });
    }
}

function pushGluttonousTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, res: any): void {
    const hyperAggregated = options.processingState.hyperAggregated;
    if (res && res.moved && res.moved.length) {
        pushTurnStartDetailsEvent(options.events, 'hyperactive_moved_start', res.moved);
        hyperAggregated.moved.push(...res.moved);
    }
    if (res && res.destroyed && res.destroyed.length) {
        pushTurnStartDetailsEvent(options.events, 'hyperactive_destroyed_start', res.destroyed);
        hyperAggregated.destroyed.push(...res.destroyed);
    }
}

function pushUltimateHyperactiveTurnStartEvents(options: ProcessTurnStartSpecialStoneOptions, ownerKey: any, row: any, col: any, res: any): void {
    pushTurnStartDetailsEvent(options.events, 'ultimate_hyperactive_moved_start', res && res.moved);
    if (res && res.flipped && res.flipped.length) {
        options.events.push({ type: 'ultimate_hyperactive_flipped_start', details: res.flipped });
        options.awardBoardChargeGain(options.CardLogic, options.cardState, ownerKey, res.flipped.length, {
            anchorRow: row,
            anchorCol: col,
            moved: res.moved,
            sourceType: 'ultimate_hyperactive_turn_start'
        });
    }
    pushTurnStartDetailsEvent(options.events, 'ultimate_hyperactive_destroyed_start', res && res.destroyed);
}

function pushObserverWillRepaymentTurnStartEvent(events: any[], playerKey: any, repayment: any): void {
    if (!Array.isArray(events) || !repayment) return;
    if (repayment.shortage) {
        events.push({
            type: 'observer_will_shortage',
            player: playerKey,
            destroyed: Array.isArray(repayment.destroyed) ? repayment.destroyed.slice() : [],
            destroyedCount: Number(repayment.destroyedCount) || 0,
            remainingOwnerTurns: Number(repayment.remainingOwnerTurnsAfter) || 0,
            completed: repayment.completed === true
        });
        return;
    }
    events.push({
        type: 'observer_will_repaid',
        player: playerKey,
        repaid: Number(repayment.repaid) || 0,
        remainingOwnerTurns: Number(repayment.remainingOwnerTurnsAfter) || 0,
        completed: repayment.completed === true
    });
}

function processTurnStartSpecialStone(options: ProcessTurnStartSpecialStoneOptions): TurnStartSpecialStoneProcessingState {
    const opts = (options && typeof options === 'object') ? options : ({} as ProcessTurnStartSpecialStoneOptions);
    const processingState = opts.processingState || createTurnStartSpecialStoneProcessingState();
    const markerAnchor = opts.markerAnchor;
    const marker = markerAnchor && markerAnchor.marker;
    if (!marker) return processingState;

    const typeKey = (marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    const owner = marker && marker.owner;
    const row = marker && marker.row;
    const col = marker && marker.col;
    const p = opts.prng || undefined;

    if (typeKey !== 'FREEZE' && opts.isFrozenCell(opts.cardState, row, col)) return processingState;

    if (typeKey === 'ULTIMATE_DESTROY_GOD' && owner === opts.playerKey) {
        const res = opts.CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, { randomSource: p });
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'moved', type: 'udg_moved_start' },
            { field: 'destroyed', type: 'udg_destroyed_start' },
            { field: 'expired', type: 'udg_expired_start' }
        ]);
        return processingState;
    }

    if (typeKey === 'DESTROY_DRAGON' && owner === opts.playerKey) {
        const res = opts.CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'destroyed', type: 'destroy_dragon_destroyed_start' },
            { field: 'expired', type: 'destroy_dragon_expired_start' }
        ]);
        return processingState;
    }

    if (typeKey === 'SNIPER' && owner === opts.playerKey) {
        const res = opts.CardLogic.processSniperWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'destroyed', type: 'sniper_destroyed_start' },
            { field: 'expired', type: 'sniper_expired_start' }
        ]);
        return processingState;
    }

    if (typeKey === 'LIGHTNING' && owner === opts.playerKey) {
        const res = opts.CardLogic.processLightningWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'destroyed', type: 'lightning_destroyed_start' },
            { field: 'expired', type: 'lightning_expired_start' }
        ]);
        return processingState;
    }

    if (typeKey === 'METEOR_GOD' && owner === opts.playerKey) {
        const res = opts.CardLogic.processMeteorGodEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'destroyed', type: 'meteor_god_destroyed_start' },
            { field: 'expired', type: 'meteor_god_expired_start' }
        ]);
        return processingState;
    }

    if (typeKey === 'WILL_HUNTER_KING' && owner === opts.playerKey) {
        const res = opts.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushTurnStartResultDetails(opts.events, res, [
            { field: 'destroyed', type: 'will_hunter_king_destroyed_start' },
            { field: 'moved', type: 'will_hunter_king_moved_start' },
            { field: 'expired', type: 'will_hunter_king_expired_start' }
        ]);
        return processingState;
    }
if (typeKey === 'TIME_STOP' && owner === opts.playerKey && typeof opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor === 'function') {
        const res = opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col);
        pushTimeStopTurnStartEvents(opts.events, opts.playerKey, row, col, res);
        return processingState;
    }

    if (typeKey === 'DRAGON' && owner === opts.playerKey) {
        const res = opts.CardLogic.processDragonEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, { randomSource: p });
        pushDragonTurnStartEvents(opts, row, col, res);
        return processingState;
    }

    if (typeKey === 'BREEDING' && owner === opts.playerKey) {
        const res = opts.CardLogic.processBreedingEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushBreedingTurnStartEvents(opts, row, col, res);
        return processingState;
    }

    if (typeKey === 'OBSERVER_WILL' && owner === opts.playerKey && typeof opts.CardLogic.processObserverWillMarkerAtTurnStart === 'function') {
        const res = opts.CardLogic.processObserverWillMarkerAtTurnStart(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        if (res && Array.isArray(res.expired) && res.expired.length) {
            opts.events.push({ type: 'observer_will_marker_expired', details: res.expired });
        }
        if (res && res.repayment) {
            pushObserverWillRepaymentTurnStartEvent(opts.events, opts.playerKey, res.repayment);
        }
        return processingState;
    }

    if (typeKey === 'THEORY_INCARNATION' && owner === opts.playerKey && typeof opts.CardLogic.processTheoryIncarnationMarkerAtTurnStart === 'function') {
        const res = opts.CardLogic.processTheoryIncarnationMarkerAtTurnStart(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        if (res && res.spawned) {
            opts.events.push({ type: 'theory_incarnation_spawned', player: opts.playerKey, detail: res.spawned });
            if (TheorySpawnImmediateEffectsModule && typeof TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects === 'function') {
                TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects({
                    CardLogic: opts.CardLogic,
                    cardState: opts.cardState,
                    gameState: opts.gameState,
                    playerKey: opts.playerKey,
                    events: opts.events,
                    spawned: res.spawned,
                    prng: p,
                    awardBoardChargeGain: opts.awardBoardChargeGain
                });
            }
        }
        if (res && res.expired) {
            opts.events.push({ type: 'theory_incarnation_marker_expired', detail: res.expired });
        }
        return processingState;
    }

    if (typeKey === 'BOARD_EXECUTOR' && owner === opts.playerKey && typeof opts.CardLogic.processBoardExecutorMarkerAtTurnStart === 'function') {
        const res = opts.CardLogic.processBoardExecutorMarkerAtTurnStart(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        if (res && res.expired) {
            opts.events.push({ type: 'board_executor_marker_expired', detail: res.expired });
        }
        return processingState;
    }

    if (typeKey === 'HYPERACTIVE' || typeKey === 'ESCAPE_HYPERACTIVE' || typeKey === 'EXTREME_HYPERACTIVE') {
        if (typeof opts.debugLog === 'function') {
            opts.debugLog('[TurnPipeline] processing HYPERACTIVE anchor', { row, col, owner, type: typeKey, createdSeq: markerAnchor.createdSeq });
        }
        const res = opts.CardLogic.processHyperactiveMoveAtAnchor(opts.cardState, opts.gameState, owner, row, col, p, {
            currentTurnPlayerKey: opts.playerKey,
            expectedSpecialType: typeKey
        });
        if (typeof opts.debugLog === 'function') {
            opts.debugLog('[TurnPipeline] hyperactive result', { row, col, owner, type: typeKey, res });
        }
        pushHyperactiveTurnStartEvents(opts, owner, row, col, res);
        return processingState;
    }

    if (typeKey === 'ROBOT_VACUUM') {
        const res = opts.CardLogic.processRobotVacuumMoveAtAnchor(opts.cardState, opts.gameState, owner, row, col, p, {
            currentTurnPlayerKey: opts.playerKey
        });
        pushRobotVacuumTurnStartEvents(opts, owner, row, col, res);
        return processingState;
    }

    if (typeKey === 'GLUTTONOUS') {
        const res = opts.CardLogic.processGluttonousMoveAtAnchor(opts.cardState, opts.gameState, owner, row, col, p, {
            currentTurnPlayerKey: opts.playerKey,
            randomSource: p
        });
        pushGluttonousTurnStartEvents(opts, res);
        return processingState;
    }

    if (typeKey === 'ULTIMATE_HYPERACTIVE') {
        const res = opts.CardLogic.processUltimateHyperactiveMoveAtAnchor(opts.cardState, opts.gameState, owner, row, col, p, {
            currentTurnPlayerKey: opts.playerKey
        });
        pushUltimateHyperactiveTurnStartEvents(opts, owner, row, col, res);
    }

    return processingState;
}

const TurnStartSpecialStonePhaseModule = {
    createTurnStartSpecialStoneProcessingState,
    processTurnStartSpecialStone
};

export = TurnStartSpecialStonePhaseModule;
