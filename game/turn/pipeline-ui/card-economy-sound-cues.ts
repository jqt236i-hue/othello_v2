type CardEconomySoundCueDeps = {
    cardEffectSpawnProfiles: any[];
    deferFirstCardEffectSpawnIntoDisappearPlayback: (ctx: any, profile: any, soundKey: any) => void;
    findPhase: (playbackEvents: any, predicate: any, fallbackPhase: any) => any;
    hasRawEvent: (rawEvents: any, type: any, predicate?: any) => boolean;
    isWorkFlipOrDestroyRemovedPresentationEvent: (ev: any) => boolean;
    movePlaybackEventsIntoCardUseAnimationTarget: (ctx: any, predicate: any, propertyName: any) => boolean;
    phaseNum: (value: any) => number;
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
    tagCardUseAnimationPlaybackTarget: (ctx: any, patch: any) => boolean;
};

function planCardAndEconomySoundCues(ctx: any, deps: CardEconomySoundCueDeps) {
    const cardUseAnimationPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'card_use_animation',
        0
    );
    const postCardUsePhase = cardUseAnimationPhase > 0 ? (cardUseAnimationPhase + 1) : ctx.fallbackPhase;
    const hasCardUse = (
        ctx.pres.some((ev: any) => !!ev && ev.type === 'CARD_USED') ||
        deps.hasRawEvent(ctx.raw, 'card_used')
    );
    const hasTreasureGain = deps.hasRawEvent(ctx.raw, 'treasure_box_gain', (ev: any) => Number(ev && ev.gained) > 0);
    if (hasCardUse && cardUseAnimationPhase > 0) {
        deps.pushSoundCue(ctx, 'card_use_button', cardUseAnimationPhase, 'card_used');
    }
    if (hasTreasureGain) {
        deps.pushSoundCue(ctx, 'treasure_gain', postCardUsePhase, 'treasure_box_gain');
    }

    const roundBonusBannerPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'round_bonus_banner',
        ctx.fallbackPhase
    );
    const hasRoundBonusBanner = ctx.pres.some((ev: any) => (
        ev &&
        ev.type === 'ROUND_BONUS_BANNER' &&
        Number(ev.amount) > 0
    ));
    if (hasRoundBonusBanner) {
        deps.pushSoundCue(ctx, 'round_bonus', roundBonusBannerPhase, 'round_bonus');
    }

    if (deps.hasRawEvent(ctx.raw, 'loss_will_resolved', (ev: any) => Number(ev && ev.removedCount) > 0)) {
        deps.tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'loss_will_reset' });
        deps.movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            (ev: any) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.reason === 'loss_will_reset',
            'disappearPlaybackEvents'
        );
    }
    for (const profile of deps.cardEffectSpawnProfiles) {
        deps.deferFirstCardEffectSpawnIntoDisappearPlayback(ctx, profile, 'breeding_spawn');
    }

    const strongWillPromotedPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && ev.meta.reason === 'strong_will_promoted',
        ctx.fallbackPhase
    );
    const hasStrongWillPromotion = ctx.pres.some((ev: any) => (
        ev &&
        ev.type === 'STATUS_APPLIED' &&
        String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase() === 'strong_will_promoted'
    ));
    if (hasStrongWillPromotion) {
        deps.pushSoundCue(ctx, 'strong_will_promoted', strongWillPromotedPhase, 'strong_will_promoted');
    }

    const condemnPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'hand_remove' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.reason ? target.reason : '').toLowerCase() === 'condemn_will'),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (deps.hasRawEvent(ctx.raw, 'condemn_selected', (ev: any) => !!(ev && ev.applied && ev.destroyedCardId))) {
        deps.pushSoundCue(ctx, 'stone_destroy', condemnPhase, 'condemn_selected');
    }

    const executionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'hand_remove' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.reason ? target.reason : '').toLowerCase() === 'execution_will'),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (deps.hasRawEvent(ctx.raw, 'execution_will_resolved', (ev: any) => Number(ev && ev.destroyedCount) > 0)) {
        deps.pushSoundCue(ctx, 'stone_destroy', executionPhase, 'execution_will_resolved');
    }

    const workIncomePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.rawType === 'WORK_INCOME',
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'WORK',
            ctx.fallbackPhase
        )
    );
    const hasWorkIncome16 = ctx.pres.some((ev: any) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) === 16);
    const hasWorkIncome = ctx.pres.some((ev: any) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) > 0);
    if (hasWorkIncome16) {
        deps.pushSoundCue(ctx, 'work_income_16', workIncomePhase, 'work_income');
    } else if (hasWorkIncome && !hasTreasureGain) {
        deps.pushSoundCue(ctx, 'charge_gain_common', workIncomePhase, 'work_income');
    }

    const workRemovedEvents = ctx.pres.filter((ev: any) => deps.isWorkFlipOrDestroyRemovedPresentationEvent(ev));
    if (workRemovedEvents.length > 0) {
        const workRemovedPlaybackEvents = ctx.base.filter((ev: any) => ev && ev.rawType === 'WORK_REMOVED');
        const workRemovedFallbackPhase = deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.rawType === 'WORK_REMOVED',
            ctx.fallbackPhase
        );
        for (let i = 0; i < workRemovedEvents.length; i++) {
            const playbackEv = workRemovedPlaybackEvents[i];
            const phase = playbackEv ? deps.phaseNum(playbackEv.phase) : workRemovedFallbackPhase;
            deps.pushSoundCue(ctx, 'work_removed', phase, 'work_removed', { allowRepeat: true });
        }
    }
}

const PipelineUICardEconomySoundCuesModule = {
    planCardAndEconomySoundCues
};

export = PipelineUICardEconomySoundCuesModule;
