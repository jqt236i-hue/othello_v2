type CardInteractionDetailTabDeps = {
    getDocumentRef: () => Document | null;
    getWindowRef: () => (Window & typeof globalThis) | null;
    getTabRefs: () => Record<string, any> | null;
    setTabRefs: (refs: Record<string, any> | null) => void;
    getTabState: () => { open: boolean; mode: any; key: any; cardId: any };
    setTabState: (state: { open: boolean; mode: any; key: any; cardId: any }) => void;
    setExpandedState: (open: boolean, cardId: any) => void;
    getAutoDismissBound: () => boolean;
    setAutoDismissBound: (bound: boolean) => void;
    updateCardDetailPanel?: () => void;
    textTermHighlighterModule?: any;
};

export function createCardInteractionDetailTab(deps: CardInteractionDetailTabDeps) {
    function ensureCardDetailTabPanel() {
        const documentRef = typeof deps.getDocumentRef === 'function' ? deps.getDocumentRef() : null;
        if (!documentRef) return null;

        const existingRefs = typeof deps.getTabRefs === 'function' ? deps.getTabRefs() : null;
        if (existingRefs && existingRefs.root && existingRefs.root.isConnected) {
            return existingRefs;
        }

        let root = documentRef.getElementById('card-detail-tab-panel');
        if (!root) {
            root = documentRef.createElement('div');
            root.id = 'card-detail-tab-panel';
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'false');
            root.setAttribute('aria-hidden', 'true');
            root.innerHTML = [
                '<div id="card-detail-tab-header">',
                '  <div id="card-detail-tab-title">詳細</div>',
                '  <button id="card-detail-tab-close-btn" type="button" aria-label="閉じる">×</button>',
                '</div>',
                '<div id="card-detail-tab-body"></div>'
            ].join('');
            documentRef.body.appendChild(root);
        }

        const refs = {
            root,
            title: root.querySelector('#card-detail-tab-title'),
            body: root.querySelector('#card-detail-tab-body'),
            closeBtn: root.querySelector('#card-detail-tab-close-btn')
        };
        deps.setTabRefs(refs);

        if (refs.closeBtn && refs.closeBtn.dataset.bound !== '1') {
            refs.closeBtn.addEventListener('click', () => {
                closeCardDetailTabPanel();
                if (typeof deps.updateCardDetailPanel === 'function') {
                    deps.updateCardDetailPanel();
                }
            });
            refs.closeBtn.dataset.bound = '1';
        }

        return refs;
    }

    function closeCardDetailTabPanel() {
        const refs = ensureCardDetailTabPanel();
        if (!refs || !refs.root) return;
        refs.root.classList.remove('is-open');
        refs.root.setAttribute('aria-hidden', 'true');
        deps.setTabState({ open: false, mode: null, key: null, cardId: null });
        deps.setExpandedState(false, null);
    }

    function openCardDetailTabPanel(payload: any) {
        const refs = ensureCardDetailTabPanel();
        if (!refs || !refs.root || !refs.title || !refs.body) return false;

        const title = payload && payload.title ? String(payload.title) : '詳細';
        const body = payload && payload.body ? String(payload.body) : '説明は準備中です。';
        const mode = payload && payload.mode ? String(payload.mode) : 'detail';
        const key = payload && payload.key ? String(payload.key) : null;
        const cardId = payload && payload.cardId ? String(payload.cardId) : null;

        refs.title.textContent = title;
        const highlighter = deps.textTermHighlighterModule;
        if (highlighter && typeof highlighter.renderTextWithGameTermHighlights === 'function') {
            highlighter.renderTextWithGameTermHighlights(refs.body, body, {
                documentRef: refs.body.ownerDocument,
                preserveLineBreaks: true
            });
        } else {
            refs.body.textContent = body;
        }
        refs.root.classList.add('is-open');
        refs.root.setAttribute('aria-hidden', 'false');

        deps.setTabState({ open: true, mode, key, cardId });
        if (mode === 'detail') {
            deps.setExpandedState(true, cardId);
        }
        return true;
    }

    function toggleCardDetailTabPanel(payload: any) {
        const mode = payload && payload.mode ? String(payload.mode) : 'detail';
        const key = payload && payload.key ? String(payload.key) : null;
        const cardId = payload && payload.cardId ? String(payload.cardId) : null;
        const tabState = typeof deps.getTabState === 'function'
            ? deps.getTabState()
            : { open: false, mode: null, key: null, cardId: null };

        const isSame = !!tabState &&
            tabState.open &&
            tabState.mode === mode &&
            tabState.key === key &&
            tabState.cardId === cardId;

        if (isSame) {
            closeCardDetailTabPanel();
            return false;
        }

        return openCardDetailTabPanel(payload);
    }

    function isCardDetailTagTabOpen() {
        const tabState = typeof deps.getTabState === 'function'
            ? deps.getTabState()
            : null;
        return !!(tabState && tabState.open && tabState.mode === 'tag');
    }

    function closeCardDetailTagTabIfOpen() {
        if (!isCardDetailTagTabOpen()) return false;
        closeCardDetailTabPanel();
        return true;
    }

    function bindCardDetailTagAutoDismiss() {
        if (typeof deps.getAutoDismissBound === 'function' && deps.getAutoDismissBound()) return;
        const documentRef = typeof deps.getDocumentRef === 'function' ? deps.getDocumentRef() : null;
        if (!documentRef) return;

        const windowRef = typeof deps.getWindowRef === 'function' ? deps.getWindowRef() : null;
        const outsidePointerEvent = (windowRef && typeof (windowRef as any).PointerEvent === 'function')
            ? 'pointerdown'
            : 'mousedown';

        documentRef.addEventListener(outsidePointerEvent, (event: any) => {
            if (!isCardDetailTagTabOpen()) return;

            const rawTarget = event ? event.target : null;
            const targetEl = rawTarget && rawTarget.nodeType === 1
                ? rawTarget
                : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);

            if (targetEl && typeof targetEl.closest === 'function') {
                if (targetEl.closest('#card-detail-tab-panel')) return;
                if (targetEl.closest('#card-detail-effect-tags')) return;
            }

            closeCardDetailTagTabIfOpen();
        }, true);

        deps.setAutoDismissBound(true);
    }

    return {
        ensureCardDetailTabPanel,
        closeCardDetailTabPanel,
        openCardDetailTabPanel,
        toggleCardDetailTabPanel,
        isCardDetailTagTabOpen,
        closeCardDetailTagTabIfOpen,
        bindCardDetailTagAutoDismiss
    };
}

module.exports = {
    createCardInteractionDetailTab
};
