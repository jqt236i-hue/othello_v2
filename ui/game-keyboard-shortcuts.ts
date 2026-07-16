interface BoardInputKeyboardPort {
    handleKeyboard: (event: KeyboardEvent) => boolean;
    refreshLegalCells?: () => void;
    clearKeyboardCursor?: () => void;
    getState?: () => { keyboardCursorKey?: string | null };
}

interface GameKeyboardShortcutDeps {
    getDocumentRef?: () => Document | null;
    getWindowRef?: () => (Window & Record<string, any>) | null;
    getCardStateValue?: () => any;
    boardInputController?: BoardInputKeyboardPort | null;
    getBoardInputController?: () => BoardInputKeyboardPort | null;
    useSelectedCard?: () => void;
    destroySelectedHandCard?: () => void;
    isNetworkSpectator?: () => boolean;
    emitStatus?: (message: string, isError?: boolean) => void;
}

interface ShortcutState {
    legalCursorKey: string | null;
}

const BLOCKING_UI_SELECTORS = [
    '.debug-card-search-control.is-open',
    '#networkChatPanel.is-open',
    '#quickBgmTrackPicker.is-open',
    '#cpu-level-menu:not([hidden])',
    '#rules-help-panel.is-open',
    '#handSkinPanel.is-open',
    '#networkOverlay.is-open',
    '#leaderboardOverlay.is-open',
    '#profileOverlay.is-open',
    '#gachaOverlay.is-open',
    '#deckBuilderOverlay.is-open'
];

function getDocumentFromDeps(deps: GameKeyboardShortcutDeps): Document | null {
    if (deps.getDocumentRef) return deps.getDocumentRef();
    return typeof document !== 'undefined' ? document : null;
}

function getWindowFromDeps(deps: GameKeyboardShortcutDeps): (Window & Record<string, any>) | null {
    if (deps.getWindowRef) return deps.getWindowRef();
    return typeof window !== 'undefined' ? window as Window & Record<string, any> : null;
}

function isElementNode(target: EventTarget | null): target is Element {
    if (!target || typeof target !== 'object') return false;
    const doc = (target as Node).ownerDocument || (typeof document !== 'undefined' ? document : null);
    const win = doc && doc.defaultView;
    const ElementCtor = win && win.Element;
    return !!(ElementCtor && target instanceof ElementCtor);
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
    const el = isElementNode(target) ? target : null;
    if (!el) return false;
    if (el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
    const role = String(el.getAttribute('role') || '').toLowerCase();
    return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

function isButtonShortcutTarget(target: EventTarget | null): boolean {
    const el = isElementNode(target) ? target : null;
    if (!el) return false;
    return !!el.closest('button, [role="button"]');
}

function isElementVisible(el: Element): boolean {
    const htmlEl = el as HTMLElement;
    if (htmlEl.hidden) return false;
    if (htmlEl.getAttribute('aria-hidden') === 'true') return false;
    const win = htmlEl.ownerDocument && htmlEl.ownerDocument.defaultView;
    if (!win || typeof win.getComputedStyle !== 'function') return true;
    const style = win.getComputedStyle(htmlEl);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function isBlockingUiOpen(doc: Document): boolean {
    return BLOCKING_UI_SELECTORS.some((selector) => {
        const el = doc.querySelector(selector);
        return !!(el && isElementVisible(el));
    });
}

function resolveDirection(code: string): 'up' | 'down' | 'left' | 'right' | null {
    if (code === 'KeyW') return 'up';
    if (code === 'KeyS') return 'down';
    if (code === 'KeyA') return 'left';
    if (code === 'KeyD') return 'right';
    return null;
}

function resolveBoardInputController(deps: GameKeyboardShortcutDeps): BoardInputKeyboardPort | null {
    if (deps.boardInputController) return deps.boardInputController;
    return deps.getBoardInputController?.() || null;
}

function getSelectedCardElement(doc: Document): HTMLElement | null {
    return doc.querySelector('.hand-container .card-item.clickable.selected[data-card-id]') as HTMLElement | null;
}

function collectClickableCards(doc: Document): HTMLElement[] {
    return Array.from(doc.querySelectorAll('.hand-container .card-item.clickable[data-card-id]')) as HTMLElement[];
}

function moveCardSelection(doc: Document, delta: -1 | 1): boolean {
    const cards = collectClickableCards(doc);
    if (cards.length <= 0) return false;
    const selected = getSelectedCardElement(doc);
    const currentIndex = selected ? cards.indexOf(selected) : -1;
    const nextIndex = currentIndex < 0
        ? (delta > 0 ? 0 : cards.length - 1)
        : (currentIndex + delta + cards.length) % cards.length;
    const next = cards[nextIndex];
    if (!next || typeof next.click !== 'function') return false;
    next.click();
    return true;
}

function hasSelectedCard(deps: GameKeyboardShortcutDeps, doc: Document): boolean {
    if (getSelectedCardElement(doc)) return true;
    const state = deps.getCardStateValue ? deps.getCardStateValue() : null;
    return !!(state && state.selectedCardId);
}

function invokeSelectedCardAction(deps: GameKeyboardShortcutDeps, doc: Document, action: 'use' | 'destroy'): boolean {
    if (!hasSelectedCard(deps, doc)) return false;
    const root = getWindowFromDeps(deps);
    const fn = action === 'use'
        ? (deps.useSelectedCard || (root && root.useSelectedCard))
        : (deps.destroySelectedHandCard || (root && root.destroySelectedHandCard));
    if (typeof fn !== 'function') return false;
    fn();
    return true;
}

function shouldIgnoreEvent(event: KeyboardEvent, doc: Document): boolean {
    if (!event || event.defaultPrevented) return true;
    if (event.isComposing) return true;
    if (event.ctrlKey || event.altKey || event.metaKey) return true;
    if (isEditableShortcutTarget(event.target)) return true;
    if (isButtonShortcutTarget(event.target) && (isSpaceKey(event) || event.key === 'Enter')) return true;
    return isBlockingUiOpen(doc);
}

function isSpaceKey(event: KeyboardEvent): boolean {
    return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
}

function isNetworkSpectatorActive(deps: GameKeyboardShortcutDeps): boolean {
    try {
        if (typeof deps.isNetworkSpectator === 'function') return deps.isNetworkSpectator() === true;
    } catch (e) { /* ignore */ }
    const root = getWindowFromDeps(deps);
    const roots = [root, (typeof globalThis !== 'undefined' ? globalThis as any : null)];
    for (const candidateRoot of roots) {
        try {
            const client = candidateRoot && candidateRoot.NetworkMatchClient;
            if (client && typeof client.isSpectator === 'function' && client.isSpectator() === true) return true;
        } catch (e) { /* ignore */ }
    }
    return false;
}

function emitSpectatorReadOnlyStatus(deps: GameKeyboardShortcutDeps): void {
    try {
        if (typeof deps.emitStatus === 'function') {
            deps.emitStatus('観測中は操作できません', true);
            return;
        }
    } catch (e) { /* ignore */ }
    const root = getWindowFromDeps(deps);
    const roots = [root, (typeof globalThis !== 'undefined' ? globalThis as any : null)];
    for (const candidateRoot of roots) {
        try {
            const writer = candidateRoot && candidateRoot.writeNetworkStatus;
            if (typeof writer !== 'function') continue;
            writer('観測中は操作できません', true);
            return;
        } catch (e) { /* ignore */ }
    }
}

function isGameShortcutKey(event: KeyboardEvent, direction: string | null): boolean {
    return !!direction || (isSpaceKey(event) && !event.shiftKey) || event.key === 'Enter';
}

function createGameKeyboardShortcutController(deps: GameKeyboardShortcutDeps = {}) {
    let bound = false;

    const handleKeydown = (event: KeyboardEvent) => {
        const doc = getDocumentFromDeps(deps);
        if (!doc || shouldIgnoreEvent(event, doc)) return;

        const direction = resolveDirection(event.code || '');
        if (isGameShortcutKey(event, direction) && isNetworkSpectatorActive(deps)) {
            emitSpectatorReadOnlyStatus(deps);
            event.preventDefault();
            return;
        }
        if (direction) {
            if (event.shiftKey) {
                if (direction !== 'left' && direction !== 'right') return;
                if (moveCardSelection(doc, direction === 'left' ? -1 : 1)) event.preventDefault();
                return;
            }
            resolveBoardInputController(deps)?.handleKeyboard(event);
            return;
        }

        if (isSpaceKey(event) && !event.shiftKey) {
            resolveBoardInputController(deps)?.handleKeyboard(event);
            return;
        }

        if (event.key === 'Enter') {
            if (event.repeat) return;
            const handled = event.shiftKey
                ? invokeSelectedCardAction(deps, doc, 'destroy')
                : invokeSelectedCardAction(deps, doc, 'use');
            if (handled) event.preventDefault();
        }
    };

    return {
        init(): void {
            const doc = getDocumentFromDeps(deps);
            if (!doc || bound) return;
            doc.addEventListener('keydown', handleKeydown);
            bound = true;
        },
        destroy(): void {
            const doc = getDocumentFromDeps(deps);
            if (!doc || !bound) return;
            doc.removeEventListener('keydown', handleKeydown);
            resolveBoardInputController(deps)?.clearKeyboardCursor?.();
            bound = false;
        },
        refresh(): void {
            resolveBoardInputController(deps)?.refreshLegalCells?.();
        },
        getState(): ShortcutState {
            const inputState = resolveBoardInputController(deps)?.getState?.();
            return { legalCursorKey: inputState?.keyboardCursorKey || null };
        }
    };
}

function setupGameKeyboardShortcuts(deps: GameKeyboardShortcutDeps = {}) {
    const root = getWindowFromDeps(deps);
    if (root && root.__gameKeyboardShortcutController) {
        return root.__gameKeyboardShortcutController;
    }
    const controller = createGameKeyboardShortcutController(deps);
    controller.init();
    if (root) {
        root.__gameKeyboardShortcutController = controller;
        root.GameKeyboardShortcutsModule = { createGameKeyboardShortcutController, setupGameKeyboardShortcuts, isBlockingUiOpen };
    }
    return controller;
}

if (typeof window !== 'undefined') {
    try {
        (window as any).GameKeyboardShortcutsModule = {
            createGameKeyboardShortcutController,
            setupGameKeyboardShortcuts,
            isBlockingUiOpen
        };
    } catch (e) { /* ignore */ }
}

export = {
    createGameKeyboardShortcutController,
    setupGameKeyboardShortcuts,
    isBlockingUiOpen
};
