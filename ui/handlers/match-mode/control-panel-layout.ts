function createControlPanelLayoutController(context: any) {
    const { root, uiRefs } = context;

    function clearControlPanelConstraints() {
        if (!uiRefs.controlPanel) return;
        uiRefs.controlPanel.style.height = '';
        uiRefs.controlPanel.style.maxHeight = '';
        uiRefs.controlPanel.style.overflowY = '';
        uiRefs.controlPanel.style.overscrollBehavior = '';
    }

    function measureBaseControlPanelHeight() {
        if (!uiRefs.controlPanel) return 0;
        const panel = uiRefs.controlPanel;
        const prevHeight = panel.style.height;
        const prevMaxHeight = panel.style.maxHeight;
        const prevOverflowY = panel.style.overflowY;
        const prevOverscroll = panel.style.overscrollBehavior;
        const prevNetworkDisplay = uiRefs.networkPanel ? uiRefs.networkPanel.style.display : '';

        clearControlPanelConstraints();
        if (uiRefs.networkPanel) uiRefs.networkPanel.style.display = 'none';

        const measured = Math.ceil(panel.getBoundingClientRect().height || panel.scrollHeight || 0);
        if (measured > 0) uiRefs.baseControlPanelHeight = measured;

        if (uiRefs.networkPanel) uiRefs.networkPanel.style.display = prevNetworkDisplay;
        panel.style.height = prevHeight;
        panel.style.maxHeight = prevMaxHeight;
        panel.style.overflowY = prevOverflowY;
        panel.style.overscrollBehavior = prevOverscroll;
        return measured;
    }

    function getLockedControlPanelHeight() {
        const base = uiRefs.baseControlPanelHeight > 0 ? uiRefs.baseControlPanelHeight : measureBaseControlPanelHeight();
        if (base <= 0) return 0;
        const vh = (typeof root.innerHeight === 'number' && root.innerHeight > 0) ? root.innerHeight : 0;
        if (vh <= 0) return base;
        const maxByViewport = Math.max(220, Math.floor(vh * 0.42));
        return Math.max(180, Math.min(base, maxByViewport));
    }

    function syncControlPanelLayout() {
        if (!uiRefs.controlPanel) return;

        clearControlPanelConstraints();
        const fresh = measureBaseControlPanelHeight();
        if (fresh > 0) uiRefs.baseControlPanelHeight = fresh;
    }

    function scheduleControlPanelLayoutSync() {
        if (uiRefs.layoutSyncRaf && typeof root.cancelAnimationFrame === 'function') {
            root.cancelAnimationFrame(uiRefs.layoutSyncRaf);
            uiRefs.layoutSyncRaf = 0;
        }
        if (typeof root.requestAnimationFrame === 'function') {
            uiRefs.layoutSyncRaf = root.requestAnimationFrame(() => {
                uiRefs.layoutSyncRaf = 0;
                syncControlPanelLayout();
            });
            return;
        }
        syncControlPanelLayout();
    }

    function bindControlPanelLayoutObservers() {
        if (uiRefs.layoutBound) return;
        uiRefs.layoutBound = true;

        if (typeof root.addEventListener === 'function') {
            root.addEventListener('resize', () => {
                scheduleControlPanelLayoutSync();
            });
            root.addEventListener('orientationchange', () => {
                scheduleControlPanelLayoutSync();
            });
        }

        if (uiRefs.networkAdvancedSettings && typeof uiRefs.networkAdvancedSettings.addEventListener === 'function') {
            uiRefs.networkAdvancedSettings.addEventListener('toggle', () => {
                scheduleControlPanelLayoutSync();
            });
        }

        if (typeof ResizeObserver === 'function' && uiRefs.controlPanel) {
            uiRefs.layoutObserver = new ResizeObserver(() => {
                scheduleControlPanelLayoutSync();
            });
            uiRefs.layoutObserver.observe(uiRefs.controlPanel);
        }
    }


    return {
        measureBaseControlPanelHeight,
        scheduleControlPanelLayoutSync,
        bindControlPanelLayoutObservers
    };
}

const MatchModeControlPanelLayout = {
    createControlPanelLayoutController
};

export = MatchModeControlPanelLayout;
