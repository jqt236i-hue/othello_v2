export {};

type AnimationFeedbackEventDeps = {
    consumeSkipNextCardUseButtonSound?: () => boolean;
    consumeLocalPlaybackSoundSkip?: (soundKey: any) => boolean;
    soundEngine?: any;
    isNoAnim?: () => boolean;
    observerBubbleMs?: any;
    observerBubbleFadeMs?: any;
    getCellEl?: (row: any, col: any) => any;
};

function getWindowRef(): any {
    return (typeof window !== 'undefined') ? window : null;
}

function getDocumentRef(): any {
    return (typeof document !== 'undefined') ? document : null;
}

function getPrimaryTarget(ev: any) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    return targets[0] || ev || null;
}

function toPositiveInt(value: any, fallback: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.trunc(n);
    return v > 0 ? v : fallback;
}

function getSoundKeys(ev: any) {
    const keys = [];
    if (ev && ev.soundKey) keys.push(String(ev.soundKey));
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    for (const target of targets) {
        if (target && target.soundKey) keys.push(String(target.soundKey));
    }
    return keys;
}

function handleRoundBonusBannerEvent(ev: any) {
    const root = getWindowRef();
    const target = getPrimaryTarget(ev);
    const amount = Number.isFinite(Number(target && target.amount))
        ? Math.max(0, Math.trunc(Number(target.amount)))
        : 0;
    if (!(amount > 0)) return Promise.resolve();
    const roundNumber = Number.isFinite(Number(target && target.roundNumber))
        ? Math.max(1, Math.trunc(Number(target.roundNumber)))
        : 1;
    const durationMs = Number.isFinite(Number(target && target.durationMs))
        ? Math.max(0, Math.trunc(Number(target.durationMs)))
        : 2200;
    const text = (typeof (target && target.text) === 'string' && target.text.trim())
        ? target.text.trim()
        : `BONUS ROUND +${amount}`;
    try {
        if (root && typeof root.showRoundBonusDisplay === 'function') {
            root.showRoundBonusDisplay({
                amount,
                roundNumber,
                durationMs,
                text
            });
        }
    } catch (e: any) { /* ignore */ }
    return Promise.resolve();
}

function handleSoundEffectEvent(ev: any, deps: AnimationFeedbackEventDeps = {}) {
    const meta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
    const isLocalPendingPreview = meta.localPendingPreview === true;
    const keys = getSoundKeys(ev);
    if (!keys.length) return Promise.resolve();

    const seen = new Set();
    for (const key of keys) {
        const trimmed = String(key || '').trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        if (
            trimmed === 'card_use_button' &&
            !isLocalPendingPreview &&
            deps.consumeSkipNextCardUseButtonSound &&
            deps.consumeSkipNextCardUseButtonSound()
        ) {
            continue;
        }
        if (
            !isLocalPendingPreview &&
            deps.consumeLocalPlaybackSoundSkip &&
            deps.consumeLocalPlaybackSoundSkip(trimmed)
        ) {
            continue;
        }
        try {
            const soundEngine = deps.soundEngine;
            if (soundEngine && typeof soundEngine.playEffectByKey === 'function') {
                soundEngine.init();
                soundEngine.playEffectByKey(trimmed);
            }
        } catch (e: any) { /* ignore */ }
    }
    return Promise.resolve();
}

function getObserverBubbleCell(deps: AnimationFeedbackEventDeps, row: any, col: any) {
    if (!deps.getCellEl) return null;
    return deps.getCellEl(row, col);
}

function handleObserverBubbleEvent(ev: any, deps: AnimationFeedbackEventDeps = {}) {
    const documentRef = getDocumentRef();
    if (!documentRef || !documentRef.body) return Promise.resolve();
    const root = getWindowRef();
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    if (!targets.length) return Promise.resolve();

    for (const target of targets) {
        const row = Number.isInteger(target && target.r) ? target.r : null;
        const col = Number.isInteger(target && target.col) ? target.col : null;
        if (row === null || col === null) continue;

        const cell = getObserverBubbleCell(deps, row, col);
        if (!cell) continue;

        const bubbleKind = String((target && target.bubbleKind) || '').trim().toLowerCase() === 'charge'
            ? 'charge'
            : 'observer';
        const isChargeBubble = bubbleKind === 'charge';
        const totalMsRaw = isChargeBubble ? 2000 : Number(deps.observerBubbleMs);
        const fadeMsRaw = isChargeBubble ? 250 : Number(deps.observerBubbleFadeMs);
        const totalMs = Number.isFinite(totalMsRaw) && totalMsRaw > 0 ? totalMsRaw : (isChargeBubble ? 2000 : 5000);
        const fadeMs = Number.isFinite(fadeMsRaw) && fadeMsRaw > 0 ? fadeMsRaw : (isChargeBubble ? 250 : 700);
        const holdMs = Math.max(0, totalMs - fadeMs);
        const gained = Math.max(0, Number(target && target.gained) || 0);
        const phaseValue = Number.isFinite(Number(ev && ev.phase)) ? Math.trunc(Number(ev.phase)) : null;
        const owner = String((target && target.owner) || '').toLowerCase();
        const explicitText = (typeof (target && target.text) === 'string') ? String(target.text).trim() : '';
        const bubbleClassName = isChargeBubble ? 'board-charge-bubble' : 'observer-speech-bubble';
        const finalTransform = isChargeBubble ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
        const initialTransform = isChargeBubble ? 'translate(-50%, -18px)' : finalTransform;

        const existing = Array.from(documentRef.querySelectorAll(`.${bubbleClassName}[data-row="${row}"][data-col="${col}"]`)) as HTMLElement[];
        if (isChargeBubble && !explicitText) {
            const samePhaseBubble = existing.find((node: HTMLElement) => {
                if (!node) return false;
                if (!Object.prototype.hasOwnProperty.call(node.dataset || {}, 'phase')) return false;
                return String(node.dataset.phase) === String(phaseValue);
            });
            if (samePhaseBubble) {
                const mergedGain = (Number(samePhaseBubble.dataset.gained) || 0) + gained;
                samePhaseBubble.dataset.gained = String(mergedGain);
                const labelEl = samePhaseBubble.querySelector('[data-charge-label="true"]');
                if (labelEl) {
                    labelEl.textContent = `+${mergedGain}`;
                }
                continue;
            }
        }
        for (const oldNode of existing) {
            try { if (oldNode && oldNode.parentElement) oldNode.parentElement.removeChild(oldNode); } catch (e: any) { /* ignore */ }
        }

        const rect = cell.getBoundingClientRect();
        const viewportW = (root && Number.isFinite(root.innerWidth)) ? root.innerWidth : documentRef.documentElement.clientWidth;
        const anchorX = rect.left + (rect.width / 2);
        const anchorY = isChargeBubble ? (rect.bottom - 2) : (rect.top - 8);
        const clampedX = Math.max(24, Math.min(Math.max(24, viewportW - 24), anchorX));

        const bubble = documentRef.createElement('div');
        bubble.className = bubbleClassName;
        bubble.dataset.row = String(row);
        bubble.dataset.col = String(col);
        bubble.dataset.owner = owner;
        bubble.dataset.bubbleKind = bubbleKind;
        if (isChargeBubble) {
            bubble.dataset.gained = String(gained);
            if (phaseValue !== null) bubble.dataset.phase = String(phaseValue);
        }
        bubble.setAttribute('aria-hidden', 'true');
        bubble.style.position = 'fixed';
        bubble.style.left = `${clampedX}px`;
        bubble.style.top = `${anchorY}px`;
        bubble.style.transform = initialTransform;
        bubble.style.display = 'block';
        bubble.style.maxWidth = isChargeBubble ? 'min(30vw, 140px)' : 'min(46vw, 320px)';
        bubble.style.width = 'max-content';
        bubble.style.padding = isChargeBubble ? '2px 8px' : '8px 12px';
        bubble.style.borderRadius = isChargeBubble ? '999px' : '10px';
        bubble.style.border = isChargeBubble
            ? '1px solid rgba(255, 215, 120, 0.72)'
            : '1px solid var(--border-status)';
        bubble.style.background = 'transparent';
        bubble.style.color = 'var(--color-text-bright)';
        bubble.style.fontSize = isChargeBubble ? '12px' : '13px';
        bubble.style.fontWeight = isChargeBubble ? '800' : '400';
        bubble.style.lineHeight = isChargeBubble ? '1.05' : '1.35';
        bubble.style.textAlign = 'center';
        bubble.style.boxShadow = 'var(--board-shadow-outer)';
        bubble.style.opacity = '0';
        bubble.style.visibility = 'visible';
        bubble.style.pointerEvents = 'none';
        bubble.style.zIndex = '13100';
        bubble.style.transition = isChargeBubble
            ? `opacity ${fadeMs}ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)`
            : `opacity ${fadeMs}ms ease`;
        bubble.style.wordBreak = 'break-word';
        bubble.style.isolation = 'isolate';

        const bgLayer = documentRef.createElement('div');
        bgLayer.style.position = 'absolute';
        bgLayer.style.left = '0';
        bgLayer.style.top = '0';
        bgLayer.style.right = '0';
        bgLayer.style.bottom = '0';
        bgLayer.style.borderRadius = 'inherit';
        bgLayer.style.background = isChargeBubble ? 'rgba(17, 22, 31, 0.92)' : 'var(--bg-glass)';
        bgLayer.style.opacity = isChargeBubble ? '1' : '0.82';
        bgLayer.style.pointerEvents = 'none';
        bgLayer.style.zIndex = '0';
        bubble.appendChild(bgLayer);

        const label = documentRef.createElement('span');
        label.style.position = 'relative';
        label.style.zIndex = '1';
        if (isChargeBubble) {
            label.style.display = 'block';
            label.style.lineHeight = '1.05';
            (label.dataset as any).chargeLabel = 'true';
        }
        label.textContent = explicitText || (isChargeBubble ? `+${gained}` : `布石+${gained} 観測が捗る`);
        bubble.appendChild(label);

        if (!isChargeBubble) {
            const tail = documentRef.createElement('div');
            tail.style.position = 'absolute';
            tail.style.left = '50%';
            tail.style.top = 'calc(100% - 1px)';
            tail.style.transform = 'translateX(-50%)';
            tail.style.width = '0';
            tail.style.height = '0';
            tail.style.borderStyle = 'solid';
            tail.style.borderWidth = '8px 7px 0 7px';
            tail.style.borderColor = 'var(--bg-glass) transparent transparent transparent';
            tail.style.opacity = '0.82';
            tail.style.zIndex = '0';
            bubble.appendChild(tail);
        }

        documentRef.body.appendChild(bubble);
        if (deps.isNoAnim && deps.isNoAnim()) {
            try {
                bubble.style.opacity = '1';
                bubble.style.transform = finalTransform;
                if (bubble.parentElement) bubble.parentElement.removeChild(bubble);
            } catch (e: any) { /* ignore */ }
            continue;
        }
        if (isChargeBubble) {
            void bubble.offsetWidth;
        }
        try {
            requestAnimationFrame(() => {
                bubble.style.opacity = '1';
                bubble.style.transform = finalTransform;
            });
        } catch (e: any) {
            bubble.style.opacity = '1';
            bubble.style.transform = finalTransform;
        }

        setTimeout(() => {
            try { bubble.style.opacity = '0'; } catch (e: any) { /* ignore */ }
        }, holdMs);
        setTimeout(() => {
            try { if (bubble.parentElement) bubble.parentElement.removeChild(bubble); } catch (e: any) { /* ignore */ }
        }, totalMs + 120);
    }

    return Promise.resolve();
}

module.exports = {
    handleObserverBubbleEvent,
    handleRoundBonusBannerEvent,
    handleSoundEffectEvent
};
