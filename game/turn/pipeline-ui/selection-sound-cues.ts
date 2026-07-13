type SelectionSoundCueDeps = {
    findPhase: (playbackEvents: any, predicate: any, fallbackPhase: any) => any;
    getMoveIntent: (target: any) => any;
    hasRawEvent: (rawEvents: any, type: any, predicate?: any) => boolean;
    isBoardShrinkDestroyTarget: (target: any) => boolean;
    isSuperCrushMoveTarget: (target: any) => boolean;
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
    rawDetailCount: (ev: any) => number;
};

function planSelectionSoundCues(ctx: any, deps: SelectionSoundCueDeps) {
    const trapSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TRAP',
        ctx.fallbackPhase
    );
    const timeBombSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TIME_BOMB',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'trap_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'trap_select', trapSelectPhase, 'trap_selected');
    }
    if (deps.hasRawEvent(ctx.raw, 'time_bomb_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'trap_select', timeBombSelectPhase, 'time_bomb_selected');
    }

    const guardSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'GUARD',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'guard_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'guard_select', guardSelectPhase, 'guard_selected');
    }

    const livingWillPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'LIVING_WILL',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'living_will_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'living_will_selected', livingWillPhase, 'living_will_selected');
    }

    const blockadeSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'BLOCKADE',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'blockade_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'blockade_select', blockadeSelectPhase, 'blockade_selected');
    }

    const freezeSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'FREEZE',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'freeze_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'freeze_select', freezeSelectPhase, 'freeze_selected');
    }

    const seedPlacePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'SEED',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'seed_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'seed_place', seedPlacePhase, 'seed_selected');
    }

    const poisonWillPlacePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'POISON_CELL',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'poison_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'poison_will_place', poisonWillPlacePhase, 'poison_selected');
    }

    const trapTriggeredEvent = ctx.raw.find((ev: any) => ev && ev.type === 'trap_triggered' && deps.rawDetailCount(ev) > 0);
    const trapTriggeredDetail = trapTriggeredEvent && Array.isArray(trapTriggeredEvent.details)
        ? trapTriggeredEvent.details[0]
        : null;
    const trapTriggeredPhase = (trapTriggeredDetail && Number.isInteger(trapTriggeredDetail.row) && Number.isInteger(trapTriggeredDetail.col))
        ? deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((target: any) => target && target.r === trapTriggeredDetail.row && target.col === trapTriggeredDetail.col),
            ctx.fallbackPhase
        )
        : ctx.fallbackPhase;
    if (trapTriggeredEvent) {
        deps.pushSoundCue(ctx, 'trap_triggered', trapTriggeredPhase, 'trap_triggered');
    }

    const strongWindPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (deps.getMoveIntent(target) === 'wind_move') return true;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return cause === 'STRONG_WIND_WILL' || reason.indexOf('strong_wind_move') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'strong_wind_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'strong_wind_move', strongWindPhase, 'strong_wind_selected');
    }

    const positionSwapPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (deps.getMoveIntent(target) === 'position_swap') return true;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return cause === 'POSITION_SWAP_WILL' || reason.indexOf('position_swap') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'position_swap_selected', (ev: any) => !!(ev && ev.applied && ev.completed))) {
        deps.pushSoundCue(ctx, 'position_swap_move', positionSwapPhase, 'position_swap_selected');
    }

    const superBuoyancyPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (!deps.isSuperCrushMoveTarget(target)) return false;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            return cause === 'BUOYANCY_WILL' || cause === 'SUPER_BUOYANCY_WILL';
        }),
        ctx.fallbackPhase
    );
    const hasBuoyancySelected = deps.hasRawEvent(ctx.raw, 'buoyancy_selected', (ev: any) => !!(ev && ev.applied));
    const hasSuperBuoyancySelected = deps.hasRawEvent(ctx.raw, 'super_buoyancy_selected', (ev: any) => !!(ev && ev.applied));
    if (hasBuoyancySelected || hasSuperBuoyancySelected) {
        deps.pushSoundCue(ctx, 'super_buoyancy_move', superBuoyancyPhase, hasBuoyancySelected ? 'buoyancy_selected' : 'super_buoyancy_selected');
    }

    const superGravityPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (!deps.isSuperCrushMoveTarget(target)) return false;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            return cause === 'GRAVITY_WILL' || cause === 'SUPER_GRAVITY_WILL';
        }),
        ctx.fallbackPhase
    );
    const hasGravitySelected = deps.hasRawEvent(ctx.raw, 'gravity_selected', (ev: any) => !!(ev && ev.applied));
    const hasSuperGravitySelected = deps.hasRawEvent(ctx.raw, 'super_gravity_selected', (ev: any) => !!(ev && ev.applied));
    if (hasGravitySelected || hasSuperGravitySelected) {
        deps.pushSoundCue(ctx, 'super_gravity_move', superGravityPhase, hasGravitySelected ? 'gravity_selected' : 'super_gravity_selected');
    }

    const superAttractionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (!deps.isSuperCrushMoveTarget(target)) return false;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            return cause === 'SUPER_ATTRACTION_WILL';
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'super_attraction_selected', (ev: any) => !!(ev && ev.applied && ev.completed !== false))) {
        deps.pushSoundCue(ctx, 'super_attraction_move', superAttractionPhase, 'super_attraction_selected');
    }

    const teleportPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            if (deps.getMoveIntent(target) === 'teleport_move') return true;
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return cause === 'TELEPORT_WILL' || reason.indexOf('teleport_move') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'teleport_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'teleport_select', teleportPhase, 'teleport_selected');
    }

    const trapMisfirePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return reason.indexOf('trap_disarmed') >= 0 || reason.indexOf('trap_expired') >= 0;
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'trap_disarmed', (ev: any) => deps.rawDetailCount(ev) > 0) ||
        deps.hasRawEvent(ctx.raw, 'trap_expired', (ev: any) => deps.rawDetailCount(ev) > 0)
    ) {
        deps.pushSoundCue(ctx, 'trap_misfire', trapMisfirePhase, 'trap_misfire');
    }

    const clonePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            return !!(target && target.clone === true) || cause === 'CLONE_WILL' || cause === 'PROLIFERATION_WILL';
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'clone_selected', (ev: any) => !!(ev && ev.applied)) ||
        ctx.pres.some((ev: any) => (
            ev &&
            ev.type === 'SPAWN' &&
            String(ev.cause || '').toUpperCase() === 'PROLIFERATION_WILL' &&
            String(ev.reason || '').toLowerCase().indexOf('proliferation_spawn') === 0
        ))
    ) {
        deps.pushSoundCue(ctx, 'clone_spawn', clonePhase, 'clone_selected');
    }

    const extendLifePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() !== 'TRAP',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'extend_life_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'extend_life', extendLifePhase, 'extend_life_selected');
    }

    const corrosionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'card_use_animation',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'corrosion_will_resolved', (ev: any) => Number(ev && ev.affectedCount) > 0)) {
        deps.pushSoundCue(ctx, 'corrosion_tick', corrosionPhase, 'corrosion_will_resolved');
    }

    const temptPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return cause === 'TEMPT_WILL' || reason.indexOf('tempt_applied') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'tempt_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'tempt_select', temptPhase, 'tempt_selected');
    }

    const capturePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'capture_to_hand_animation',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'capture_selected', (ev: any) => !!(ev && ev.applied))) {
        deps.pushSoundCue(ctx, 'tempt_select', capturePhase, 'capture_selected');
    }

    const meteorHolePhase = deps.findPhase(
        ctx.base,
        (ev: any) => (
            ev &&
            ev.type === 'status_applied' &&
            ev.meta &&
            String(ev.meta.special || '').toUpperCase() === 'METEOR_HOLE' &&
            ['METEOR_WILL', 'METEOR_GOD'].includes(String(ev.meta.cellRemovalCause || '').toUpperCase())
        ),
        ctx.fallbackPhase
    );
    if (meteorHolePhase !== ctx.fallbackPhase) {
        deps.pushSoundCue(ctx, 'meteor_hole', meteorHolePhase, 'meteor_hole');
    }

    const causalReplayRestorePhase = deps.findPhase(
        ctx.base,
        (ev: any) => (
            ev &&
            ev.type === 'status_removed' &&
            ev.meta &&
            String(ev.meta.special || '').toUpperCase() === 'METEOR_HOLE' &&
            String(ev.meta.cellRestorationCause || '').toUpperCase() === 'CAUSAL_REPLAY_WILL'
        ),
        ctx.fallbackPhase
    );
    if (causalReplayRestorePhase !== ctx.fallbackPhase) {
        deps.pushSoundCue(ctx, 'causal_replay_restore', causalReplayRestorePhase, 'causal_replay_restore');
    }

    const hasBoardShrinkDestroyPlayback = ctx.base.some((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isBoardShrinkDestroyTarget(target))
    ));
    const boardShrinkPhase = deps.findPhase(
        ctx.base,
        (ev: any) => (
            ev &&
            ev.type === 'status_applied' &&
            (
                (ev.meta && String(ev.meta.special || '').toUpperCase() === 'METEOR_HOLE') ||
                (Array.isArray(ev.targets) && ev.targets.some((target: any) => (
                    target &&
                    target.after &&
                    String(target.after.special || '').toUpperCase() === 'METEOR_HOLE'
                )))
            )
        ),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (
        !hasBoardShrinkDestroyPlayback &&
        deps.hasRawEvent(ctx.raw, 'board_shrink_selected', (ev: any) => !!(
            ev &&
            ev.applied &&
            ev.completed !== false &&
            Array.isArray(ev.changedTargets) &&
            ev.changedTargets.length > 0
        ))
    ) {
        deps.pushSoundCue(ctx, 'board_shrink_selected', boardShrinkPhase, 'board_shrink_selected');
    }
}

const PipelineUISelectionSoundCuesModule = {
    planSelectionSoundCues
};

export = PipelineUISelectionSoundCuesModule;
