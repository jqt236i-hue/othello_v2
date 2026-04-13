(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const exports = factory();
        root.GachaUiModule = exports;
        root.setupGachaControls = exports.setupGachaControls;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function resolveDocument(rootRef) {
        if (rootRef && rootRef.document) return rootRef.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function resolveGachaTransactionModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-transaction.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaTransactionModule) return globalThis.GachaTransactionModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaOverlayViewModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-overlay-view.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaOverlayViewModule) return globalThis.GachaOverlayViewModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaOverlayControllerModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-overlay-controller.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaOverlayControllerModule) return globalThis.GachaOverlayControllerModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaRevealPlayerModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha-reveal-player.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaRevealPlayerModule) return globalThis.GachaRevealPlayerModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaEventsModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-events.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaEventsModule) return globalThis.GachaEventsModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveUIBootstrapModule() {
        if (typeof require === 'function') {
            try {
                return require('../bootstrap.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap) return globalThis.UIBootstrap;
        } catch (e) { /* ignore */ }
        return null;
    }

    function getCatalogItems(options) {
        const transactionModule = resolveGachaTransactionModule();
        if (!transactionModule || typeof transactionModule.getCatalogItems !== 'function') return [];
        return transactionModule.getCatalogItems(options);
    }

    function commitPullTransaction(rootRef, pullCount, options) {
        const transactionModule = resolveGachaTransactionModule();
        if (!transactionModule || typeof transactionModule.commitPullTransaction !== 'function') {
            return {
                ok: false,
                code: 'init-unavailable',
                messageData: {}
            };
        }
        return transactionModule.commitPullTransaction(rootRef, pullCount, options);
    }

    async function refreshLoadedAssetManifest(rootRef, uiBootstrap) {
        if (!uiBootstrap || typeof uiBootstrap.refreshLoadedAssetManifest !== 'function') {
            return null;
        }
        try {
            return await uiBootstrap.refreshLoadedAssetManifest({ root: rootRef });
        } catch (e) {
            return null;
        }
    }

    function canRefreshLoadedAssetManifest(rootRef, uiBootstrap) {
        if (!uiBootstrap || typeof uiBootstrap.refreshLoadedAssetManifest !== 'function') {
            return false;
        }
        const fetchFn = rootRef && typeof rootRef.fetch === 'function'
            ? rootRef.fetch
            : null;
        if (typeof fetchFn !== 'function') {
            return false;
        }
        try {
            const locationRef = (rootRef && rootRef.location) || (typeof location !== 'undefined' ? location : null);
            if (locationRef && (locationRef.protocol === 'file:' || locationRef.origin === 'null')) {
                return false;
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    function performPullWithLatestManifest(controller, rootRef, uiBootstrap, pullCount) {
        if (!canRefreshLoadedAssetManifest(rootRef, uiBootstrap)) {
            return controller.performPull(pullCount);
        }
        return (async function () {
            await refreshLoadedAssetManifest(rootRef, uiBootstrap);
            return controller.performPull(pullCount);
        }());
    }

    function setupGachaControls(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
        const docRef = opts.document || resolveDocument(rootRef);
        if (!docRef) return null;

        const transactionModule = opts.transactionModule || resolveGachaTransactionModule();
        const viewModule = opts.overlayViewModule || resolveGachaOverlayViewModule();
        const controllerModule = opts.overlayControllerModule || resolveGachaOverlayControllerModule();
        const revealPlayerModule = opts.revealPlayerModule || resolveGachaRevealPlayerModule();
        const eventsModule = opts.eventsModule || resolveGachaEventsModule();
        const uiBootstrap = opts.uiBootstrap || resolveUIBootstrapModule();
        const assetManifestUpdatedEventName = (
            uiBootstrap && typeof uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT === 'string' && uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT
        ) || 'asset-manifest:updated';
        if (!transactionModule || !viewModule || !controllerModule) return null;

        const view = viewModule.createGachaOverlayView(Object.assign({}, opts, {
            root: rootRef,
            document: docRef
        }));
        if (!view || !view.refs) return null;

        const createRevealPlayer = typeof opts.createRevealPlayer === 'function'
            ? opts.createRevealPlayer
            : (revealPlayerModule && typeof revealPlayerModule.createGachaRevealPlayer === 'function'
                ? revealPlayerModule.createGachaRevealPlayer
                : null);
        const revealPlayer = typeof createRevealPlayer === 'function'
            ? createRevealPlayer({
                root: rootRef,
                document: docRef,
                overlay: view.refs.overlay,
                modal: view.refs.modal,
                timings: opts.revealTimings
            })
            : null;

        const controller = controllerModule.createGachaOverlayController({
            root: rootRef,
            view,
            revealPlayer,
            transactionModule,
            randomFn: opts.randomFn,
            dispatchInventoryUpdated: eventsModule && typeof eventsModule.dispatchGachaInventoryUpdated === 'function'
                ? eventsModule.dispatchGachaInventoryUpdated
                : null
        });
        if (!controller) return null;

        view.refs.openBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (controller.isOpen()) {
                controller.closeOverlay();
                return;
            }
            controller.openOverlay();
            if (canRefreshLoadedAssetManifest(rootRef, uiBootstrap)) {
                void refreshLoadedAssetManifest(rootRef, uiBootstrap);
            }
        });

        view.refs.closeBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            controller.closeOverlay();
        });

        view.refs.detailToggleBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            controller.toggleDetails();
        });

        view.refs.singlePullBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            void performPullWithLatestManifest(controller, rootRef, uiBootstrap, 1);
        });

        view.refs.tenPullBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            void performPullWithLatestManifest(controller, rootRef, uiBootstrap, 10);
        });

        view.refs.overlay.addEventListener('click', function (event) {
            controller.handleOverlayBackgroundClick(event);
        });

        docRef.addEventListener('keydown', function (event) {
            if (!event || event.key !== 'Escape') return;
            if (controller.handleEscape() && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
        });

        controller.initialize();

        if (rootRef && typeof rootRef.addEventListener === 'function') {
            rootRef.addEventListener(assetManifestUpdatedEventName, function () {
                controller.refresh();
            });
        }

        return {
            openOverlay: controller.openOverlay,
            closeOverlay: function () {
                controller.closeOverlay({ force: true });
            },
            refresh: controller.refresh,
            performPull: function (pullCount) {
                return performPullWithLatestManifest(controller, rootRef, uiBootstrap, pullCount);
            },
            getCatalogItems: controller.getCatalogItems,
            isOpen: controller.isOpen,
            isAnimating: controller.isAnimating
        };
    }

    return {
        commitPullTransaction,
        getCatalogItems,
        setupGachaControls
    };
}));
