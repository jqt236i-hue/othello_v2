// Card demo video: play button on hand card faces and the centered popup player.
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

const BUTTON_CLASS = 'card-demo-video-btn';
const OVERLAY_ID = 'card-demo-video-overlay';
const VIDEO_DIR = 'assets/videos/cards';

function _resolveModule(requirePath: string, globalKey: string): any {
    try {
        const mod = _require(requirePath);
        if (mod) return mod;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') return (globalThis as any)[globalKey] || null;
    }
    catch (e) { /* ignore */ }
    return null;
}

let _videoIdSet: Set<string> | null = null;
function _getVideoIdSet(): Set<string> {
    if (_videoIdSet) return _videoIdSet;
    const catalog = _resolveModule('./card-demo-videos.generated', 'CardDemoVideoCatalog');
    const ids = catalog && Array.isArray(catalog.CARD_DEMO_VIDEO_IDS) ? catalog.CARD_DEMO_VIDEO_IDS : [];
    _videoIdSet = new Set(ids.map((id: any) => String(id)));
    return _videoIdSet;
}

function hasCardDemoVideo(cardId: any): boolean {
    return !!cardId && _getVideoIdSet().has(String(cardId));
}

function getCardDemoVideoPath(cardId: any): string {
    return `${VIDEO_DIR}/${encodeURIComponent(String(cardId))}.mp4`;
}

function _stopEvent(event: any) {
    if (!event) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
}

function _resolveCardName(cardId: any, fallback?: any): string {
    if (fallback) return String(fallback);
    try {
        const defs = (typeof globalThis !== 'undefined' && Array.isArray((globalThis as any).CARD_DEFS)) ? (globalThis as any).CARD_DEFS : [];
        const def = defs.find((c: any) => c && c.id === cardId);
        if (def && def.name) return String(def.name);
    }
    catch (e) { /* ignore */ }
    return 'カード';
}

let _keydownHandler: ((event: any) => void) | null = null;

function closeCardDemoVideo() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        const video = overlay.querySelector('video');
        if (video) {
            try { video.pause(); } catch (e) { /* ignore */ }
            video.removeAttribute('src');
            try { video.load(); } catch (e) { /* ignore */ }
        }
        overlay.remove();
    }
    if (_keydownHandler) {
        document.removeEventListener('keydown', _keydownHandler, true);
        _keydownHandler = null;
    }
}

function openCardDemoVideo(cardId: any, options?: any): HTMLElement | null {
    if (typeof document === 'undefined' || !hasCardDemoVideo(cardId)) return null;
    closeCardDemoVideo();
    const name = _resolveCardName(cardId, options && options.cardName);

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'card-demo-video-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `${name} の動画`);
    overlay.dataset.cardId = String(cardId);

    const panel = document.createElement('div');
    panel.className = 'card-demo-video-panel';

    const header = document.createElement('div');
    header.className = 'card-demo-video-header';
    const title = document.createElement('span');
    title.className = 'card-demo-video-title';
    title.textContent = name;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'card-demo-video-close';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (event: any) => { _stopEvent(event); closeCardDemoVideo(); });
    header.appendChild(title);
    header.appendChild(closeBtn);

    const video = document.createElement('video');
    video.className = 'card-demo-video-player';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.src = getCardDemoVideoPath(cardId);

    panel.appendChild(header);
    panel.appendChild(video);
    overlay.appendChild(panel);
    panel.addEventListener('click', (event: any) => { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); });
    overlay.addEventListener('click', (event: any) => { _stopEvent(event); closeCardDemoVideo(); });

    _keydownHandler = (event: any) => {
        if (event && event.key === 'Escape') {
            _stopEvent(event);
            closeCardDemoVideo();
        }
    };
    document.addEventListener('keydown', _keydownHandler, true);
    document.body.appendChild(overlay);
    try {
        const played: any = video.play();
        if (played && typeof played.catch === 'function') played.catch(() => { /* autoplay may be blocked; controls stay available */ });
    }
    catch (e) { /* ignore */ }
    return overlay;
}

// Adds (or removes) the play button on a card face element.
function syncCardDemoVideoButton(cardEl: any, cardId: any, options?: any) {
    if (!cardEl || typeof cardEl.querySelector !== 'function') return null;
    const existing = cardEl.querySelector(`:scope > .${BUTTON_CLASS}`);
    if (!hasCardDemoVideo(cardId)) {
        if (existing) existing.remove();
        return null;
    }
    if (existing && existing.dataset.cardId === String(cardId)) return existing;
    if (existing) existing.remove();
    const name = _resolveCardName(cardId, options && options.cardName);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.dataset.cardId = String(cardId);
    button.setAttribute('aria-label', `${name} の動画を再生`);
    button.title = '動画で効果を見る';
    const icon = document.createElement('span');
    icon.className = 'card-demo-video-icon';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    const swallow = (event: any) => { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); };
    button.addEventListener('pointerdown', swallow);
    button.addEventListener('mousedown', swallow);
    button.addEventListener('touchstart', swallow, { passive: true } as any);
    button.addEventListener('dblclick', _stopEvent);
    button.addEventListener('click', (event: any) => {
        _stopEvent(event);
        openCardDemoVideo(cardId, { cardName: name });
    });
    cardEl.appendChild(button);
    return button;
}

const CardDemoVideo = {
    hasCardDemoVideo,
    getCardDemoVideoPath,
    syncCardDemoVideoButton,
    openCardDemoVideo,
    closeCardDemoVideo
};

try {
    if (typeof globalThis !== 'undefined') (globalThis as any).CardDemoVideo = CardDemoVideo;
}
catch (e) { /* ignore */ }

export = CardDemoVideo;
