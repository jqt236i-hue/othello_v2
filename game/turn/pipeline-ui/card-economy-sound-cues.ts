declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function readRuntimeModuleGlobal(globalKey: string): any {
    try {
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
    } catch (e) { /* ignore */ }
    return null;
}

const SpecialCardRegistry = (() => {
    try {
        return _require('../../../shared/special-card-registry');
    } catch (e) {
        return readRuntimeModuleGlobal('SpecialCardRegistry');
    }
})();

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

function readCardId(value: any): string {
    if (!value || typeof value !== 'object') return '';
    return String(
        value.cardId ||
        value.id ||
        (value.meta && value.meta.cardId) ||
        ''
    ).trim();
}

function findCardUseCardId(ctx: any): string {
    const presEvent = ctx.pres.find((ev: any) => ev && ev.type === 'CARD_USED' && readCardId(ev));
    if (presEvent) return readCardId(presEvent);

    const rawEvent = ctx.raw.find((ev: any) => ev && ev.type === 'card_used' && readCardId(ev));
    if (rawEvent) return readCardId(rawEvent);

    const animationEvent = ctx.base.find((ev: any) => ev && ev.type === 'card_use_animation');
    const targets = animationEvent && Array.isArray(animationEvent.targets) ? animationEvent.targets : [];
    return targets.length > 0 ? readCardId(targets[0]) : '';
}

function isSpecialCardUseCardId(cardId: any): boolean {
    if (
        SpecialCardRegistry &&
        typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function'
    ) {
        return SpecialCardRegistry.isInviolableSpecialCardId(cardId);
    }
    return false;
}

function getSpecialCardPresentation(cardId: any): any {
    if (
        SpecialCardRegistry &&
        typeof SpecialCardRegistry.getSpecialCardPresentation === 'function'
    ) {
        return SpecialCardRegistry.getSpecialCardPresentation(cardId);
    }
    return null;
}

function findCardUseTarget(ctx: any): any {
    const animationEvent = ctx.base.find((ev: any) => ev && ev.type === 'card_use_animation');
    const targets = animationEvent && Array.isArray(animationEvent.targets) ? animationEvent.targets : [];
    return targets.length > 0 && targets[0] && typeof targets[0] === 'object' ? targets[0] : {};
}

function isSacrificeNullifiedCardUse(ctx: any): boolean {
    const cardUseTarget = findCardUseTarget(ctx);
    if (cardUseTarget.nullifiedBySacrificeWill === true) return true;
    if (String(cardUseTarget.cardUseVanishEffect || '').trim().toLowerCase() === 'sacrifice_seal_burn') return true;
    return ctx.pres.some((ev: any) => {
        if (!ev || ev.type !== 'SPECIAL_STONE_BUBBLE') return false;
        const special = String(ev.special || (ev.meta && ev.meta.special) || '').trim().toUpperCase();
        const scenario = String(
            ev.scenario ||
            ev.reason ||
            (ev.meta && (ev.meta.scenario || ev.meta.reason)) ||
            ''
        ).trim().toLowerCase();
        return special === 'SACRIFICE' && scenario === 'card_nullified';
    });
}

function isSacrificeNullifiedDestroyPlaybackEvent(ev: any): boolean {
    if (!ev || ev.type !== 'destroy') return false;
    const targets = Array.isArray(ev.targets) ? ev.targets : [];
    return targets.some((target: any) => {
        const cause = String(target && target.cause ? target.cause : '').trim().toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').trim().toLowerCase();
        return cause === 'SACRIFICE_WILL' && reason === 'card_nullified';
    });
}

function pushSpecialCardCinematicCue(ctx: any, deps: CardEconomySoundCueDeps, cardId: any, phase: any) {
    const meta = getSpecialCardPresentation(cardId);
    if (!meta) return;
    const cardUseTarget = findCardUseTarget(ctx);
    const owner = cardUseTarget.owner || cardUseTarget.player || (ctx.pres.find((ev: any) => ev && ev.type === 'CARD_USED') || {}).player || null;
    ctx.added.push({
        type: 'special_card_cinematic',
        phase: deps.phaseNum(phase),
        targets: [{
            cardId: meta.cardId || cardId,
            cardType: meta.markerType || cardUseTarget.cardType || null,
            owner,
            displayName: meta.displayName || cardUseTarget.name || '',
            quote: meta.quote || '',
            quoteLines: Array.isArray(meta.quoteLines) ? meta.quoteLines.slice() : [],
            cinematicKey: meta.cinematicKey || '',
            characterImage: meta.characterImage || '',
            manifestBackgroundKey: meta.manifestBackgroundKey || '',
            manifestBackgroundImage: meta.manifestBackgroundImage || '',
            manifestBgmKey: meta.manifestBgmKey || '',
            manifestBgmTrack: meta.manifestBgmTrack || null,
            durationMs: 3000
        }],
        meta: {
            sourceType: 'special_card_use',
            cardId: meta.cardId || cardId,
            cinematicKey: meta.cinematicKey || ''
        }
    });
}

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
        const cardId = findCardUseCardId(ctx);
        const isSpecialCardUse = isSpecialCardUseCardId(cardId);
        const soundKey = isSpecialCardUse
            ? 'special_card_use'
            : 'card_use_button';
        deps.pushSoundCue(ctx, soundKey, cardUseAnimationPhase, 'card_used');
        if (isSpecialCardUse) {
            pushSpecialCardCinematicCue(ctx, deps, cardId, cardUseAnimationPhase);
        }
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

    if (isSacrificeNullifiedCardUse(ctx)) {
        deps.tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'stone_destroy' });
        deps.movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            (ev: any) => isSacrificeNullifiedDestroyPlaybackEvent(ev),
            'disappearPlaybackEvents'
        );
    }

    if (deps.hasRawEvent(ctx.raw, 'loss_will_resolved', (ev: any) => Number(ev && ev.removedCount) > 0)) {
        deps.tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'loss_will_reset' });
        deps.movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            (ev: any) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.reason === 'loss_will_reset',
            'disappearPlaybackEvents'
        );
    }
    if (deps.hasRawEvent(ctx.raw, 'mass_freeze_will_resolved', (ev: any) => Number(ev && ev.frozenCount) > 0)) {
        deps.tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'freeze_select' });
        deps.movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            (ev: any) => ev && ev.type === 'status_applied' && ev.meta && ev.meta.reason === 'mass_freeze_will',
            'disappearPlaybackEvents'
        );
    }
    for (const profile of deps.cardEffectSpawnProfiles) {
        deps.deferFirstCardEffectSpawnIntoDisappearPlayback(ctx, profile, 'breeding_spawn');
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

    const observerWillCapturePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'hand_remove' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.reason ? target.reason : '').toLowerCase() === 'observer_will'),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (deps.hasRawEvent(ctx.raw, 'observer_will_selected', (ev: any) => !!(ev && ev.applied && ev.stolenCardId))) {
        deps.pushSoundCue(ctx, 'observer_will_capture', observerWillCapturePhase, 'observer_will_selected');
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

    const ultimateWorkGodIncomePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.rawType === 'ULTIMATE_WORK_GOD_INCOME',
        ctx.fallbackPhase
    );
    const hasUltimateWorkGodIncome = ctx.pres.some((ev: any) => (
        ev &&
        ev.type === 'ULTIMATE_WORK_GOD_INCOME' &&
        Number(ev.gained) > 0
    ));
    if (hasUltimateWorkGodIncome && !hasTreasureGain) {
        deps.pushSoundCue(ctx, 'charge_gain_common', ultimateWorkGodIncomePhase, 'ultimate_work_god_income');
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
