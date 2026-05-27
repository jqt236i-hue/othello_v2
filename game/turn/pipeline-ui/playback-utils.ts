type GeneratedThrowChainOptions = {
    generatedThrowChainReason?: string;
};

function phaseNum(value: any) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function getPrimaryPlaybackTarget(ev: any) {
    if (ev && Array.isArray(ev.targets) && ev.targets.length > 0) {
        return ev.targets[0];
    }
    return ev || null;
}

function hasGeneratedThrowChainReason(reason: any, options?: GeneratedThrowChainOptions) {
    const expected = String((options && options.generatedThrowChainReason) || 'generated_throw_chain').trim().toLowerCase();
    return String(reason || '').trim().toLowerCase() === expected;
}

function isGeneratedThrowChainHandAddPlaybackEvent(ev: any, options?: GeneratedThrowChainOptions) {
    if (!ev || ev.type !== 'hand_add') return false;
    if (String(ev.rawType || '').toUpperCase() !== 'HAND_ADD') return false;
    if (hasGeneratedThrowChainReason(ev.reason, options)) return true;
    if (hasGeneratedThrowChainReason(ev.meta && ev.meta.reason, options)) return true;
    const candidates = Array.isArray(ev.targets) && ev.targets.length > 0
        ? ev.targets
        : [ev];
    return candidates.some((target: any) => !!target && hasGeneratedThrowChainReason(target.reason, options));
}

function countPlaybackCards(ev: any) {
    const target = getPrimaryPlaybackTarget(ev);
    const count = Number(target && target.count);
    return Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1;
}

function clonePlaybackTarget(target: any) {
    if (!target || typeof target !== 'object') return target;
    const clonedTarget = Object.assign({}, target);
    if (target.from && typeof target.from === 'object') clonedTarget.from = Object.assign({}, target.from);
    if (target.to && typeof target.to === 'object') clonedTarget.to = Object.assign({}, target.to);
    if (target.after && typeof target.after === 'object') clonedTarget.after = Object.assign({}, target.after);
    if (target.meta && typeof target.meta === 'object') clonedTarget.meta = Object.assign({}, target.meta);
    return clonedTarget;
}

function clonePlaybackEventWithPhase(ev: any, phase: any) {
    const clonedEvent = Object.assign({}, ev, { phase });
    if (clonedEvent.meta && typeof clonedEvent.meta === 'object') {
        clonedEvent.meta = Object.assign({}, clonedEvent.meta);
    }
    if (Array.isArray(ev && ev.targets)) {
        clonedEvent.targets = ev.targets.map((target: any) => clonePlaybackTarget(target));
    }
    return clonedEvent;
}

function extractGeneratedThrowChainPlayback(playbackEvents: any, options?: GeneratedThrowChainOptions) {
    const immediateEvents = [];
    const deferredEvents = [];
    for (const ev of Array.isArray(playbackEvents) ? playbackEvents : []) {
        if (isGeneratedThrowChainHandAddPlaybackEvent(ev, options)) {
            deferredEvents.push(ev);
        } else {
            immediateEvents.push(ev);
        }
    }
    return { immediateEvents, deferredEvents };
}

function maxPhase(playbackEvents: any) {
    const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
    return arr.reduce((maxP: any, ev: any) => {
        const p = phaseNum(ev && ev.phase);
        return p > maxP ? p : maxP;
    }, 0);
}

function appendGeneratedThrowChainPlayback(playbackEvents: any, deferredEvents: any) {
    const baseEvents = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
    const pendingEvents = Array.isArray(deferredEvents) ? deferredEvents : [];
    if (pendingEvents.length <= 0) return baseEvents;

    const startPhase = Math.max(1, maxPhase(baseEvents) + 1);
    for (let index = 0; index < pendingEvents.length; index += 1) {
        baseEvents.push(clonePlaybackEventWithPhase(pendingEvents[index], startPhase + index));
    }
    return baseEvents;
}

function findPhase(playbackEvents: any, predicate: any, fallbackPhase: any) {
    const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
    for (const ev of arr) {
        if (predicate(ev)) return phaseNum(ev && ev.phase);
    }
    return phaseNum(fallbackPhase);
}

function rawDetailCount(ev: any) {
    if (!ev || !Array.isArray(ev.details)) return 0;
    return ev.details.length;
}

function hasRawEvent(rawEvents: any, type: any, predicate?: any) {
    const events = Array.isArray(rawEvents) ? rawEvents : [];
    for (const ev of events) {
        if (!ev || ev.type !== type) continue;
        if (!predicate || predicate(ev)) return true;
    }
    return false;
}

const PipelineUIPlaybackUtilsModule = {
    phaseNum,
    getPrimaryPlaybackTarget,
    hasGeneratedThrowChainReason,
    isGeneratedThrowChainHandAddPlaybackEvent,
    countPlaybackCards,
    clonePlaybackTarget,
    clonePlaybackEventWithPhase,
    extractGeneratedThrowChainPlayback,
    appendGeneratedThrowChainPlayback,
    maxPhase,
    findPhase,
    rawDetailCount,
    hasRawEvent
};

export = PipelineUIPlaybackUtilsModule;
