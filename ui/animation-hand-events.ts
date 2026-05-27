export {};

type AnimationHandEventDeps = {
    timer: () => any;
    playbackScope: any;
    resolvePlaceHandDescriptor: (target: any) => any;
    shouldPlayPlaceHandAnimation: (target: any) => boolean;
    resolvePlayerValue: (playerKey: any) => any;
    consumeLocalCardUseAnimationSkip: (target: any) => boolean;
    armSkipNextCardUseButtonSound: () => any;
    armLocalCardUseAnimationSkip: (target: any) => any;
    executeEvent: (event: any) => Promise<any>;
    fallbackPlayHandAnimation: any;
};

function getWindowRef(): any {
    return (typeof window !== 'undefined') ? window : null;
}

function getPrimaryTarget(ev: any) {
    return (ev && Array.isArray(ev.targets) && ev.targets[0]) ? ev.targets[0] : ev;
}

function handleHandAddEvent(ev: any) {
    const root = getWindowRef();
    if (!root) return Promise.resolve();
    const target = getPrimaryTarget(ev);
    if (target.reason === 'generated_throw_chain' && typeof root.playDirectHandAddAnimation === 'function') {
        return root.playDirectHandAddAnimation({
            player: target.player,
            cardId: target.cardId,
            count: target.count,
            reason: target.reason,
            sourceType: target.sourceType,
            generatedName: target.generatedName
        });
    }
    if (typeof root.playDrawCardHandAnimation === 'function') {
        return root.playDrawCardHandAnimation({
            player: target.player,
            cardId: target.cardId,
            count: target.count,
            reason: target.reason,
            sourceType: target.sourceType,
            generatedName: target.generatedName,
            cpu: target.cpu === true,
            cpuLevel: target.cpuLevel
        });
    }
    return Promise.resolve();
}

function handleCaptureToHandEvent(ev: any) {
    const root = getWindowRef();
    if (!root || typeof root.playCaptureToHandAnimation !== 'function') return Promise.resolve();
    const target = getPrimaryTarget(ev);
    return root.playCaptureToHandAnimation({
        player: target.player,
        cardId: target.cardId,
        count: target.count,
        reason: target.reason,
        sourceType: target.sourceType,
        sourceCardId: target.sourceCardId,
        sourceName: target.sourceName,
        sourceSpecialType: target.sourceSpecialType,
        sourceRow: target.sourceRow,
        sourceCol: target.sourceCol,
        sourceOwner: target.sourceOwner,
        stoneId: target.stoneId,
        insertIndex: target.insertIndex,
        visualDescriptor: target.visualDescriptor || null
    });
}

function handlePlaceHandAnimationEvent(ev: any, deps: AnimationHandEventDeps) {
    const target = getPrimaryTarget(ev);
    const descriptor = deps.resolvePlaceHandDescriptor(target);
    if (!descriptor || !deps.shouldPlayPlaceHandAnimation(target)) {
        return Promise.resolve();
    }
    const root = getWindowRef();
    const handAnimationFn = (root && typeof root.playHandAnimation === 'function')
        ? root.playHandAnimation
        : deps.fallbackPlayHandAnimation;
    if (typeof handAnimationFn !== 'function') return Promise.resolve();
    return new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            resolve();
        };
        const timeoutId = deps.timer().setTimeout(finish, 1800, deps.playbackScope);
        const done = () => {
            if (timeoutId) {
                deps.timer().clearTimeout(timeoutId);
            }
            finish();
        };
        try {
            handAnimationFn(deps.resolvePlayerValue(descriptor.playerKey), descriptor.r, descriptor.col, done);
        } catch (e: any) {
            done();
        }
    });
}

function handleCardUseAnimationEvent(ev: any, deps: AnimationHandEventDeps) {
    const target = getPrimaryTarget(ev);
    const meta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
    const isLocalPendingPreview = meta.localPendingPreview === true;
    if (!isLocalPendingPreview && deps.consumeLocalCardUseAnimationSkip(target)) {
        deps.armSkipNextCardUseButtonSound();
        return Promise.resolve();
    }
    if (isLocalPendingPreview) {
        deps.armLocalCardUseAnimationSkip(target);
    }
    const disappearPlaybackEvents = Array.isArray(target.disappearPlaybackEvents)
        ? target.disappearPlaybackEvents.filter((one: any) => !!one)
        : [];
    const root = getWindowRef();
    if (!root || typeof root.playCardUseHandAnimation !== 'function') {
        return Promise.resolve();
    }
    return root.playCardUseHandAnimation({
        player: target.player,
        owner: target.owner,
        cardId: target.cardId,
        visualDescriptor: target.visualDescriptor || null,
        cost: target.cost,
        name: target.name,
        disappearSoundKey: target.disappearSoundKey || null,
        onDisappear: disappearPlaybackEvents.length > 0
            ? () => Promise.all(disappearPlaybackEvents.map((one: any) => deps.executeEvent(one)))
            : null,
        sourceCardEl: target.sourceCardEl || null,
        sourceCardRect: target.sourceCardRect || ev.sourceCardRect || null
    });
}

function handleHandRemoveEvent(ev: any) {
    const root = getWindowRef();
    if (!root || typeof root.playClearHandAnimation !== 'function') return Promise.resolve();
    const target = getPrimaryTarget(ev);
    return root.playClearHandAnimation({
        player: target.player,
        count: target.count,
        reason: target.reason,
        cardId: target.cardId,
        cardIds: Array.isArray(target.cardIds) ? target.cardIds.slice() : undefined
    });
}

function handleHandPlaybackEvent(ev: any, deps: AnimationHandEventDeps) {
    if (!ev || !ev.type) return null;
    switch (ev.type) {
        case 'hand_add':
            return handleHandAddEvent(ev);
        case 'capture_to_hand_animation':
            return handleCaptureToHandEvent(ev);
        case 'place_hand_animation':
            return handlePlaceHandAnimationEvent(ev, deps);
        case 'card_use_animation':
            return handleCardUseAnimationEvent(ev, deps);
        case 'hand_remove':
            return handleHandRemoveEvent(ev);
        default:
            return null;
    }
}

module.exports = {
    handleHandPlaybackEvent
};
