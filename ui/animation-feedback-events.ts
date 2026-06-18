export {};

type AnimationFeedbackEventDeps = {
    consumeSkipNextCardUseButtonSound?: () => boolean;
    consumeLocalPlaybackSoundSkip?: (soundKey: any) => boolean;
    soundEngine?: any;
    isNoAnim?: () => boolean;
    sleep?: (ms: any) => Promise<void>;
    typewriterSleep?: (ms: any) => Promise<void>;
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

function getSpecialCardCinematicTarget(ev: any) {
    const target = getPrimaryTarget(ev);
    return target && typeof target === 'object' ? target : {};
}

function resolveSpecialCardCinematicText(target: any) {
    const quote = (typeof (target && target.quote) === 'string') ? target.quote.trim() : '';
    const displayName = (typeof (target && target.displayName) === 'string') ? target.displayName.trim() : '';
    const quoteLines = Array.isArray(target && target.quoteLines)
        ? target.quoteLines.map((line: any) => String(line || '').trim()).filter(Boolean)
        : [];
    return {
        quote,
        quoteLines,
        displayName
    };
}

function escapeCssUrlPath(value: any): string {
    return String(value || '').replace(/"/g, '\\"');
}

function waitForCinematic(ms: number, deps: AnimationFeedbackEventDeps) {
    if (deps.sleep && typeof deps.sleep === 'function') {
        return deps.sleep(ms);
    }
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizePlayerKey(value: any): string {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'white' || key === '-1') return 'white';
    if (key === 'black' || key === '1') return 'black';
    return '';
}

function resolveLocalViewerKey(): string {
    const root = getWindowRef();
    if (root && root.NetworkMatchClient) {
        try {
            const client = root.NetworkMatchClient;
            const active = typeof client.isActive === 'function' ? client.isActive() === true : true;
            if (active && typeof client.getSeatKey === 'function') {
                const seatKey = normalizePlayerKey(client.getSeatKey());
                if (seatKey) return seatKey;
            }
        } catch (e: any) { /* ignore */ }
    }
    if (root) {
        const globals = [
            root.LOCAL_PLAYER_KEY,
            root.__LOCAL_PLAYER_KEY,
            root.BOARD_VIEWER_KEY
        ];
        for (const value of globals) {
            const key = normalizePlayerKey(value);
            if (key) return key;
        }
    }
    return 'black';
}

function waitForTypewriter(ms: number, deps: AnimationFeedbackEventDeps) {
    if (deps.typewriterSleep && typeof deps.typewriterSleep === 'function') {
        return deps.typewriterSleep(ms);
    }
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function resolveTypewriterDelayForChar(char: string): number {
    if (char === '。') return 90;
    if (char === '、') return 250;
    return 20;
}

function splitSpecialCardQuoteIntoLines(quote: string): string[] {
    const chars = Array.from(String(quote || '').trim());
    if (chars.length === 0) return [];
    const maxCharsPerLine = 12;
    const lines = [];
    for (let i = 0; i < chars.length; i += maxCharsPerLine) {
        lines.push(chars.slice(i, i + maxCharsPerLine).join(''));
    }
    return lines;
}

function resolveSpecialCardQuoteLines(quote: string, explicitLines: string[] = []): string[] {
    const normalizedLines = Array.isArray(explicitLines)
        ? explicitLines.map((line) => String(line || '').trim()).filter(Boolean)
        : [];
    if (normalizedLines.length > 0) return normalizedLines;
    return splitSpecialCardQuoteIntoLines(quote);
}

async function revealSpecialCardQuoteTypewriter(quoteEl: any, quote: string, deps: AnimationFeedbackEventDeps, explicitLines: string[] = []) {
    if (!quoteEl || !quote) return;
    quoteEl.dataset.fullText = quote;
    quoteEl.textContent = '';
    const documentRef = quoteEl.ownerDocument || getDocumentRef();
    const lines = resolveSpecialCardQuoteLines(quote, explicitLines);
    const lineEls = lines.map((line) => {
        const lineEl = documentRef.createElement('span');
        lineEl.className = 'special-card-cinematic-quote-line';
        lineEl.dataset.fullText = line;
        lineEl.textContent = '';
        quoteEl.appendChild(lineEl);
        return lineEl;
    });
    await waitForTypewriter(120, deps);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineEl = lineEls[lineIndex];
        const chars = Array.from(lines[lineIndex]);
        let nextText = '';
        for (const char of chars) {
            if (!quoteEl.isConnected) return;
            nextText += char;
            lineEl.textContent = nextText;
            await waitForTypewriter(resolveTypewriterDelayForChar(char), deps);
        }
    }
}

function buildManifestPresentationOverride(target: any) {
    const manifestBackgroundImage = String((target && target.manifestBackgroundImage) || '').trim();
    const manifestBackgroundKey = String((target && target.manifestBackgroundKey) || '').trim();
    const manifestBgmKey = String((target && target.manifestBgmKey) || '').trim();
    const manifestBgmTrack = (target && target.manifestBgmTrack && typeof target.manifestBgmTrack === 'object')
        ? Object.assign({}, target.manifestBgmTrack)
        : null;
    if (!manifestBackgroundImage && (!manifestBgmKey || !manifestBgmTrack)) return null;
    return {
        source: 'special_card_use',
        cardId: String((target && target.cardId) || '').trim(),
        cardType: String((target && target.cardType) || '').trim(),
        cinematicKey: String((target && target.cinematicKey) || '').trim(),
        manifestBackgroundKey,
        manifestBackgroundImage,
        manifestBgmKey,
        manifestBgmTrack,
        resolvedByMarker: false
    };
}

function resolveManifestSummary(target: any) {
    const cardType = String((target && (target.cardType || target.type)) || '').trim().toUpperCase();
    const cinematicKey = String((target && target.cinematicKey) || '').trim().toLowerCase();
    const key = cardType || cinematicKey;
    if (key === 'BOARD_EXECUTOR' || key === 'board_executor') {
        return {
            cardType: 'BOARD_EXECUTOR',
            lines: [
                '両者: カード使用封印',
                '手札が多いほど布石を失う'
            ]
        };
    }
    if (key === 'THEORY_INCARNATION' || key === 'theory_incarnation') {
        return {
            cardType: 'THEORY_INCARNATION',
            lines: [
                '空きマスを理論数字マス化',
                'ランダムで特殊石が出現'
            ]
        };
    }
    if (key === 'OBSERVER_WILL' || key === 'observer_will') {
        const owner = normalizePlayerKey((target && (target.owner || target.player)) || '');
        const viewer = resolveLocalViewerKey();
        if (owner && viewer && owner === viewer) return null;
        return {
            cardType: 'OBSERVER_WILL',
            lines: [
                '手札1枚を0コストで奪われる',
                '観測済みカードはコスト増加'
            ]
        };
    }
    return null;
}

function showManifestSummaryPopup(target: any, deps: AnimationFeedbackEventDeps = {}) {
    const summary = resolveManifestSummary(target);
    if (!summary) return;
    const documentRef = getDocumentRef();
    if (!documentRef || !documentRef.body) return;

    const existing = Array.from(documentRef.querySelectorAll('.manifest-summary-popup')) as any[];
    for (const node of existing) {
        try { if (node && node.parentElement) node.parentElement.removeChild(node); } catch (e: any) { /* ignore */ }
    }

    const popup = documentRef.createElement('div');
    popup.className = 'manifest-summary-popup';
    popup.dataset.cardType = summary.cardType;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');

    const shell = documentRef.createElement('div');
    shell.className = 'manifest-summary-popup-shell';

    const linesEl = documentRef.createElement('div');
    linesEl.className = 'manifest-summary-popup-lines';
    for (const line of summary.lines) {
        const lineEl = documentRef.createElement('div');
        lineEl.className = 'manifest-summary-popup-line';
        lineEl.textContent = line;
        linesEl.appendChild(lineEl);
    }
    shell.appendChild(linesEl);
    popup.appendChild(shell);

    let dismissed = false;
    let fadeTimer: any = null;
    let removeTimer: any = null;
    const clearTimers = () => {
        try { if (fadeTimer !== null) clearTimeout(fadeTimer); } catch (e: any) { /* ignore */ }
        try { if (removeTimer !== null) clearTimeout(removeTimer); } catch (e: any) { /* ignore */ }
        fadeTimer = null;
        removeTimer = null;
    };
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        clearTimers();
        try {
            popup.classList.remove('is-visible');
            popup.classList.add('is-leaving');
        } catch (e: any) { /* ignore */ }
        removeTimer = setTimeout(() => {
            try { if (popup.parentElement) popup.parentElement.removeChild(popup); } catch (e: any) { /* ignore */ }
        }, 500);
    };

    popup.addEventListener('click', dismiss);
    popup.addEventListener('pointerdown', dismiss);

    documentRef.body.appendChild(popup);
    try {
        void popup.offsetWidth;
        popup.classList.add('is-visible');
    } catch (e: any) {
        popup.classList.add('is-visible');
    }

    if (deps.isNoAnim && deps.isNoAnim()) {
        fadeTimer = setTimeout(() => {
            try { if (popup.parentElement) popup.parentElement.removeChild(popup); } catch (e: any) { /* ignore */ }
        }, 3000);
        return;
    }
    fadeTimer = setTimeout(dismiss, 3000);
}

function resolveAutoPassNoticePlayerKey(value: any): string {
    const normalized = normalizePlayerKey(value);
    return normalized === 'white' ? 'white' : 'black';
}

function resolveAutoPassNotice(input: any) {
    const source = (input && typeof input === 'object') ? input : {};
    const playerKey = resolveAutoPassNoticePlayerKey(source.playerKey || source.player || source.owner);
    const playerLabel = playerKey === 'white' ? '白' : '黒';
    const reasonText = String(source.reasonText || source.message || '').trim()
        || '合法手と使用可能カードがありません。';
    return {
        playerKey,
        playerLabel,
        reasonText
    };
}

function showAutoPassNotice(input: any, deps: AnimationFeedbackEventDeps = {}) {
    const notice = resolveAutoPassNotice(input);
    const documentRef = getDocumentRef();
    if (!documentRef || !documentRef.body) return;

    const existing = Array.from(documentRef.querySelectorAll('.auto-pass-notice-popup')) as any[];
    for (const node of existing) {
        try { if (node && node.parentElement) node.parentElement.removeChild(node); } catch (e: any) { /* ignore */ }
    }

    const popup = documentRef.createElement('div');
    popup.className = 'auto-pass-notice-popup';
    popup.dataset.playerKey = notice.playerKey;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');
    popup.setAttribute('aria-atomic', 'true');

    const shell = documentRef.createElement('div');
    shell.className = 'auto-pass-notice-popup-shell';

    const titleEl = documentRef.createElement('div');
    titleEl.className = 'auto-pass-notice-popup-title';
    titleEl.textContent = `${notice.playerLabel} : 自動パス`;

    const reasonEl = documentRef.createElement('div');
    reasonEl.className = 'auto-pass-notice-popup-reason';
    reasonEl.textContent = notice.reasonText;

    shell.appendChild(titleEl);
    shell.appendChild(reasonEl);
    popup.appendChild(shell);

    let dismissed = false;
    let fadeTimer: any = null;
    let removeTimer: any = null;
    const clearTimers = () => {
        try { if (fadeTimer !== null) clearTimeout(fadeTimer); } catch (e: any) { /* ignore */ }
        try { if (removeTimer !== null) clearTimeout(removeTimer); } catch (e: any) { /* ignore */ }
        fadeTimer = null;
        removeTimer = null;
    };
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        clearTimers();
        try {
            popup.classList.remove('is-visible');
            popup.classList.add('is-leaving');
        } catch (e: any) { /* ignore */ }
        removeTimer = setTimeout(() => {
            try { if (popup.parentElement) popup.parentElement.removeChild(popup); } catch (e: any) { /* ignore */ }
        }, 500);
    };

    popup.addEventListener('click', dismiss);
    popup.addEventListener('pointerdown', dismiss);

    documentRef.body.appendChild(popup);
    try {
        void popup.offsetWidth;
        popup.classList.add('is-visible');
    } catch (e: any) {
        popup.classList.add('is-visible');
    }

    if (deps.isNoAnim && deps.isNoAnim()) return;
    fadeTimer = setTimeout(dismiss, 3000);
}

function applyManifestPresentationForCinematic(target: any, deps: AnimationFeedbackEventDeps) {
    const documentRef = getDocumentRef();
    const root = getWindowRef();
    const presentation = buildManifestPresentationOverride(target);
    if (!presentation) return;

    if (root) {
        try {
            root.__manifestPresentationOverride = presentation;
        } catch (e: any) { /* ignore */ }
    }

    if (documentRef && documentRef.body && presentation.manifestBackgroundImage) {
        try {
            documentRef.body.classList.add('manifest-world-background-active');
            documentRef.body.setAttribute('data-manifest-world-background-key', presentation.manifestBackgroundKey || presentation.cinematicKey || presentation.cardId || 'manifest_world');
            documentRef.body.setAttribute('data-manifest-world-background-source', 'special_card_use');
            documentRef.body.style.setProperty('--manifest-world-background', `url("${presentation.manifestBackgroundImage}")`);
        } catch (e: any) { /* ignore */ }
    }

    const soundEngine = deps.soundEngine || (root && root.SoundEngine);
    if (
        soundEngine &&
        typeof soundEngine.syncManifestBgmOverride === 'function' &&
        presentation.manifestBgmKey &&
        presentation.manifestBgmTrack
    ) {
        try {
            soundEngine.syncManifestBgmOverride(presentation.manifestBgmKey, presentation.manifestBgmTrack);
        } catch (e: any) { /* ignore */ }
    }
}

async function handleSpecialCardCinematicEvent(ev: any, deps: AnimationFeedbackEventDeps = {}) {
    const target = getSpecialCardCinematicTarget(ev);
    const durationMs = toPositiveInt(
        (target && target.durationMs) || (ev && ev.durationMs),
        3000
    );
    applyManifestPresentationForCinematic(target, deps);
    if (deps.isNoAnim && deps.isNoAnim()) {
        return Promise.resolve();
    }
    const documentRef = getDocumentRef();
    if (!documentRef || !documentRef.body) {
        await waitForCinematic(durationMs, deps);
        return;
    }

    const { quote, quoteLines, displayName } = resolveSpecialCardCinematicText(target);
    const cinematicKey = String((target && target.cinematicKey) || (ev && ev.cinematicKey) || '').trim();
    const owner = String((target && target.owner) || (target && target.player) || '').trim().toLowerCase();
    const overlay = documentRef.createElement('div');
    overlay.className = 'special-card-cinematic-overlay';
    overlay.dataset.cinematicKey = cinematicKey;
    overlay.dataset.owner = owner;
    overlay.setAttribute('aria-hidden', 'true');

    const characterImage = String((target && target.characterImage) || '').trim();
    if (characterImage) {
        const characterEl = documentRef.createElement('div');
        characterEl.className = 'special-card-cinematic-character';
        characterEl.setAttribute('aria-hidden', 'true');
        characterEl.style.setProperty('--special-card-character-image', `url("${escapeCssUrlPath(characterImage)}")`);
        overlay.appendChild(characterEl);
    }

    const frame = documentRef.createElement('div');
    frame.className = 'special-card-cinematic-frame';
    const titleEl = documentRef.createElement('div');
    titleEl.className = 'special-card-cinematic-title';
    titleEl.textContent = displayName;
    const quoteEl = documentRef.createElement('div');
    quoteEl.className = 'special-card-cinematic-quote';
    void revealSpecialCardQuoteTypewriter(quoteEl, quote, deps, quoteLines);
    frame.appendChild(titleEl);
    frame.appendChild(quoteEl);
    overlay.appendChild(frame);

    documentRef.body.appendChild(overlay);
    try {
        void overlay.offsetWidth;
        overlay.classList.add('special-card-cinematic-visible');
    } catch (e: any) {
        overlay.classList.add('special-card-cinematic-visible');
    }
    await waitForCinematic(durationMs, deps);
    try {
        overlay.classList.remove('special-card-cinematic-visible');
        overlay.classList.add('special-card-cinematic-leaving');
    } catch (e: any) { /* ignore */ }
    await waitForCinematic(260, deps);
    try {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    } catch (e: any) { /* ignore */ }
    showManifestSummaryPopup(target, deps);
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
    handleSpecialCardCinematicEvent,
    showManifestSummaryPopup,
    showAutoPassNotice,
    handleSoundEffectEvent
};
