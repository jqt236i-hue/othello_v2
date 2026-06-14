interface LegalCell {
    row: number;
    col: number;
    key: string;
    el: HTMLElement;
}

interface GameKeyboardShortcutDeps {
    getDocumentRef?: () => Document | null;
    getWindowRef?: () => (Window & Record<string, any>) | null;
    getCardStateValue?: () => any;
    handleCellClick?: (row: number, col: number) => void;
    useSelectedCard?: () => void;
    destroySelectedHandCard?: () => void;
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
    '#gachaOverlay.is-open',
    '#deckBuilderOverlay.is-open'
];

const LEGAL_CURSOR_CLASS = 'keyboard-legal-cursor';

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

function normalizeLegalCell(el: Element): LegalCell | null {
    const row = Number((el as HTMLElement).dataset.row);
    const col = Number((el as HTMLElement).dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col, key: `${row},${col}`, el: el as HTMLElement };
}

function collectLegalCells(doc: Document): LegalCell[] {
    return Array.from(doc.querySelectorAll('.cell.legal, .cell.legal-free'))
        .map(normalizeLegalCell)
        .filter((cell): cell is LegalCell => !!cell)
        .sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

function clearLegalCursor(doc: Document, state: ShortcutState): void {
    doc.querySelectorAll(`.${LEGAL_CURSOR_CLASS}`).forEach((el) => el.classList.remove(LEGAL_CURSOR_CLASS));
    state.legalCursorKey = null;
}

function applyLegalCursor(doc: Document, state: ShortcutState, cell: LegalCell | null): void {
    doc.querySelectorAll(`.${LEGAL_CURSOR_CLASS}`).forEach((el) => el.classList.remove(LEGAL_CURSOR_CLASS));
    if (!cell) {
        state.legalCursorKey = null;
        return;
    }
    cell.el.classList.add(LEGAL_CURSOR_CLASS);
    state.legalCursorKey = cell.key;
}

function getCurrentLegalCell(cells: LegalCell[], state: ShortcutState): LegalCell | null {
    if (!state.legalCursorKey) return null;
    return cells.find((cell) => cell.key === state.legalCursorKey) || null;
}

function chooseDirectionalLegalCell(cells: LegalCell[], current: LegalCell, direction: 'up' | 'down' | 'left' | 'right'): LegalCell | null {
    const candidates = cells.filter((cell) => {
        if (direction === 'up') return cell.row < current.row;
        if (direction === 'down') return cell.row > current.row;
        if (direction === 'left') return cell.col < current.col;
        return cell.col > current.col;
    });
    if (candidates.length <= 0) return null;
    const score = (cell: LegalCell): [number, number, number, number] => {
        if (direction === 'up' || direction === 'down') {
            return [Math.abs(cell.row - current.row), Math.abs(cell.col - current.col), cell.row, cell.col];
        }
        return [Math.abs(cell.col - current.col), Math.abs(cell.row - current.row), cell.row, cell.col];
    };
    return candidates.sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        return (sa[0] - sb[0]) || (sa[1] - sb[1]) || (sa[2] - sb[2]) || (sa[3] - sb[3]);
    })[0] || null;
}

function resolveDirection(code: string): 'up' | 'down' | 'left' | 'right' | null {
    if (code === 'KeyW') return 'up';
    if (code === 'KeyS') return 'down';
    if (code === 'KeyA') return 'left';
    if (code === 'KeyD') return 'right';
    return null;
}

function moveLegalCursor(doc: Document, state: ShortcutState, direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const cells = collectLegalCells(doc);
    if (cells.length <= 0) {
        clearLegalCursor(doc, state);
        return false;
    }
    const current = getCurrentLegalCell(cells, state);
    const next = current ? chooseDirectionalLegalCell(cells, current, direction) || current : cells[0];
    applyLegalCursor(doc, state, next);
    return true;
}

function placeLegalCursor(deps: GameKeyboardShortcutDeps, doc: Document, state: ShortcutState): boolean {
    const cells = collectLegalCells(doc);
    const current = getCurrentLegalCell(cells, state);
    if (!current) return false;
    const root = getWindowFromDeps(deps);
    const fn = deps.handleCellClick || (root && typeof root.handleCellClick === 'function' ? root.handleCellClick : null);
    if (typeof fn !== 'function') return false;
    fn(current.row, current.col);
    return true;
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

function createGameKeyboardShortcutController(deps: GameKeyboardShortcutDeps = {}) {
    const state: ShortcutState = { legalCursorKey: null };
    let bound = false;

    const handleKeydown = (event: KeyboardEvent) => {
        const doc = getDocumentFromDeps(deps);
        if (!doc || shouldIgnoreEvent(event, doc)) return;

        const direction = resolveDirection(event.code || '');
        if (direction) {
            if (event.shiftKey) {
                if (direction !== 'left' && direction !== 'right') return;
                if (moveCardSelection(doc, direction === 'left' ? -1 : 1)) event.preventDefault();
                return;
            }
            if (moveLegalCursor(doc, state, direction)) event.preventDefault();
            return;
        }

        if (isSpaceKey(event) && !event.shiftKey) {
            if (event.repeat) return;
            if (placeLegalCursor(deps, doc, state)) event.preventDefault();
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
            clearLegalCursor(doc, state);
            bound = false;
        },
        refresh(): void {
            const doc = getDocumentFromDeps(deps);
            if (!doc) return;
            const cells = collectLegalCells(doc);
            if (cells.length <= 0) {
                clearLegalCursor(doc, state);
                return;
            }
            if (!getCurrentLegalCell(cells, state)) {
                applyLegalCursor(doc, state, null);
            }
        },
        getState(): ShortcutState {
            return { ...state };
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
        root.GameKeyboardShortcutsModule = { createGameKeyboardShortcutController, setupGameKeyboardShortcuts };
    }
    return controller;
}

if (typeof window !== 'undefined') {
    try {
        (window as any).GameKeyboardShortcutsModule = {
            createGameKeyboardShortcutController,
            setupGameKeyboardShortcuts
        };
    } catch (e) { /* ignore */ }
}

export = {
    createGameKeyboardShortcutController,
    setupGameKeyboardShortcuts
};
