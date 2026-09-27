type BoardEventMapperContext = {
    ev: any;
    phaseState: any;
    pEvent: any;
    playbackBase: any;
    presentationEvents: any[];
    presIndex: number;
    playbackEvents: any[];
    trailingPlaybackEvents: any[];
    consumedPresentationIndexes: Set<number>;
    followsProliferationDestroy: any;
};

type BoardEventMapperDeps = {
    clonePlaybackEventWithPhase: (ev: any, phase: any) => any;
    phaseNum: (value: any) => any;
    planSpawnPlayback: (phaseState: any, ev: any, playbackBase: any, followsProliferationDestroy: any) => any;
    planDestroyPlayback: (phaseState: any, ev: any, destroyMeta: any, playbackBase: any) => any;
    planChangePlaybackPhase: (phaseState: any, ev: any, options?: { presentationEvents: any[]; presIndex: number }) => any;
    findExtremeForcedSwapMovePairPresentationIndex: (presentationEvents: any[], firstIndex: number) => number;
    planMovePlaybackPhase: (phaseState: any, ev: any) => any;
    createExtremeForcedSwapPlaybackEvent: (playbackBase: any, phase: any, firstEv: any, secondEv: any) => any;
    clearChainFlipPhaseState: (phaseState: any) => void;
};

function mapPlaybackEvents(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    if (Array.isArray(ctx.ev.events)) {
        for (const playbackEvent of ctx.ev.events) {
            if (!playbackEvent || typeof playbackEvent !== 'object' || !playbackEvent.type) continue;
            ctx.playbackEvents.push(deps.clonePlaybackEventWithPhase(
                playbackEvent,
                deps.phaseNum(playbackEvent.phase)
            ));
        }
    }
    ctx.pEvent.type = null;
}

function mapSpawn(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    const spawnPlan = deps.planSpawnPlayback(
        ctx.phaseState,
        ctx.ev,
        ctx.playbackBase,
        ctx.followsProliferationDestroy
    );
    if (spawnPlan.leadingPlaybackEvents.length) {
        ctx.playbackEvents.push(...spawnPlan.leadingPlaybackEvents);
    }
    ctx.pEvent.type = spawnPlan.type;
    ctx.pEvent.phase = spawnPlan.phase;
    ctx.pEvent.targets = spawnPlan.targets;
    if (Number.isFinite(Number(spawnPlan.durationMs))) {
        ctx.pEvent.durationMs = Number(spawnPlan.durationMs);
    }
    if (Number.isFinite(Number(spawnPlan.materializeMs))) {
        ctx.pEvent.materializeMs = Number(spawnPlan.materializeMs);
    }
}

function mapDestroy(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    const destroyMeta = (ctx.ev && ctx.ev.meta && typeof ctx.ev.meta === 'object') ? ctx.ev.meta : null;
    const destroyPlan = deps.planDestroyPlayback(
        ctx.phaseState,
        ctx.ev,
        destroyMeta,
        ctx.playbackBase
    );
    ctx.pEvent.type = 'destroy';
    ctx.pEvent.phase = destroyPlan.phase;
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        stoneId: ctx.ev.stoneId,
        ownerBefore: ctx.ev.ownerBefore,
        cause: ctx.ev.cause || null,
        reason: ctx.ev.reason || null,
        meta: destroyMeta,
        sourceRow: destroyMeta && Number.isInteger(destroyMeta.sourceRow) ? destroyMeta.sourceRow : null,
        sourceCol: destroyMeta && Number.isInteger(destroyMeta.sourceCol) ? destroyMeta.sourceCol : null,
        projectileOwner: destroyMeta && typeof destroyMeta.projectileOwner === 'string' ? destroyMeta.projectileOwner : null,
        projectileStone: destroyMeta && typeof destroyMeta.projectileStone === 'string' ? destroyMeta.projectileStone : null
    }];
    if (destroyPlan.trailingPlaybackEvents.length) {
        ctx.trailingPlaybackEvents.push(...destroyPlan.trailingPlaybackEvents);
    }
}

function mapChange(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    const changeMeta = (ctx.ev && ctx.ev.meta && typeof ctx.ev.meta === 'object') ? ctx.ev.meta : null;
    ctx.pEvent.type = 'flip';
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        ownerBefore: ctx.ev.ownerBefore,
        ownerAfter: ctx.ev.ownerAfter,
        cause: ctx.ev.cause || null,
        reason: ctx.ev.reason || null,
        meta: changeMeta
    }];
    ctx.pEvent.phase = deps.planChangePlaybackPhase(ctx.phaseState, ctx.ev, {
        presentationEvents: ctx.presentationEvents,
        presIndex: ctx.presIndex
    });
}

function mapMove(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    const forcedSwapPairIndex = deps.findExtremeForcedSwapMovePairPresentationIndex(ctx.presentationEvents, ctx.presIndex);
    if (forcedSwapPairIndex >= 0) {
        const forcedSwapPhase = deps.planMovePlaybackPhase(ctx.phaseState, ctx.ev);
        Object.assign(
            ctx.pEvent,
            deps.createExtremeForcedSwapPlaybackEvent(
                ctx.playbackBase,
                forcedSwapPhase,
                ctx.ev,
                ctx.presentationEvents[forcedSwapPairIndex]
            )
        );
        ctx.consumedPresentationIndexes.add(forcedSwapPairIndex);
        return;
    }
    ctx.pEvent.type = 'move';
    ctx.pEvent.targets = [{
        from: { r: ctx.ev.prevRow, col: ctx.ev.prevCol },
        to: { r: ctx.ev.row, col: ctx.ev.col },
        stoneId: ctx.ev.stoneId,
        ownerBefore: ctx.ev.ownerBefore,
        ownerAfter: ctx.ev.ownerAfter,
        cause: ctx.ev.cause || null,
        reason: ctx.ev.reason || null,
        meta: (ctx.ev && ctx.ev.meta && typeof ctx.ev.meta === 'object') ? ctx.ev.meta : null
    }];
    ctx.pEvent.phase = deps.planMovePlaybackPhase(ctx.phaseState, ctx.ev);
}

function mapBoardVisualEffect(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps, type: string) {
    ctx.pEvent.type = type;
    if (Number.isFinite(Number(ctx.ev.phase))) {
        ctx.pEvent.phase = deps.phaseNum(ctx.ev.phase);
    }
    const fields = [
        'row',
        'col',
        'effectKey',
        'owner',
        'newColor',
        'durationMs',
        'autoFadeOut',
        'fadeWholeStone'
    ];
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(ctx.ev, field)) {
            ctx.pEvent[field] = ctx.ev[field];
        }
    }
}

function clearUnknownPresentationEvent(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    ctx.pEvent.type = null;
    deps.clearChainFlipPhaseState(ctx.phaseState);
    ctx.phaseState.prevDestroyCause = null;
}

function mapBoardPresentationEvent(ctx: BoardEventMapperContext, deps: BoardEventMapperDeps) {
    switch (ctx.ev && ctx.ev.type) {
        case 'PLAYBACK_EVENTS':
            mapPlaybackEvents(ctx, deps);
            return { handled: true, skip: false };
        case 'SPAWN':
            mapSpawn(ctx, deps);
            return { handled: true, skip: false };
        case 'DESTROY':
            mapDestroy(ctx, deps);
            return { handled: true, skip: false };
        case 'CHANGE':
            mapChange(ctx, deps);
            return { handled: true, skip: false };
        case 'MOVE':
            mapMove(ctx, deps);
            return { handled: true, skip: false };
        case 'CROSSFADE_STONE':
            mapBoardVisualEffect(ctx, deps, 'crossfade_stone');
            return { handled: true, skip: false };
        case 'PROTECTION_EXPIRE':
            mapBoardVisualEffect(ctx, deps, 'protection_expire');
            return { handled: true, skip: false };
        default:
            clearUnknownPresentationEvent(ctx, deps);
            return { handled: false, skip: true };
    }
}

module.exports = {
    mapBoardPresentationEvent
};
