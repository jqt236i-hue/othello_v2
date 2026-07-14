'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;
const LazyControlStatus = require('./lazy-control-status');

function resolveDocument(rootRef: any): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveGachaTransactionModule(): any {
  try {
    return _require('../gacha/gacha-transaction');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaTransactionModule) return (globalThis as any).GachaTransactionModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaOverlayViewModule(): any {
  try {
    return _require('../gacha/gacha-overlay-view');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaOverlayViewModule) return (globalThis as any).GachaOverlayViewModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaOverlayControllerModule(): any {
  try {
    return _require('../gacha/gacha-overlay-controller');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaOverlayControllerModule) return (globalThis as any).GachaOverlayControllerModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaRevealPlayerModule(): any {
  try {
    return _require('../gacha-reveal-player');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaRevealPlayerModule) return (globalThis as any).GachaRevealPlayerModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaEventsModule(): any {
  try {
    return _require('../gacha/gacha-events');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaEventsModule) return (globalThis as any).GachaEventsModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveUIBootstrapModule(): any {
  try {
    return _require('../bootstrap');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).UIBootstrap) return (globalThis as any).UIBootstrap;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveLazyRuntimeGroupLoader(options: any, rootRef: any): any {
  if (options && typeof options.loadLazyRuntimeGroup === 'function') {
    return options.loadLazyRuntimeGroup;
  }
  try {
    if (rootRef && typeof rootRef.loadLazyRuntimeGroup === 'function') {
      return rootRef.loadLazyRuntimeGroup.bind(rootRef);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).loadLazyRuntimeGroup === 'function') {
      return (globalThis as any).loadLazyRuntimeGroup;
    }
  } catch (e) { /* ignore */ }
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as any).LazyRuntimeLoaderModule &&
      typeof (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup === 'function'
    ) {
      return (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup;
    }
  } catch (e) { /* ignore */ }
  try {
    const moduleRef = _require('../bootstrap/lazy-runtime-loader');
    if (moduleRef && typeof moduleRef.loadLazyRuntimeGroup === 'function') {
      return moduleRef.loadLazyRuntimeGroup;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function createLazyGachaControls(options: any, rootRef: any, docRef: Document, loadLazyRuntimeGroup: any): any {
  const openBtn = options.openBtn || docRef.getElementById('gachaOpenBtn');
  if (!openBtn || typeof openBtn.addEventListener !== 'function') return null;

  let delegate: any = null;
  let loading: Promise<any> | null = null;
  const loadStatus = LazyControlStatus.createLazyControlStatus(openBtn, '観測ガチャ');

  const ensureDelegate = (): Promise<any> => {
    if (delegate) return Promise.resolve(delegate);
    if (!loading) {
      loadStatus.begin();
      loading = Promise.resolve(loadLazyRuntimeGroup('gacha')).then(() => {
        delegate = setupGachaControls(Object.assign({}, options, {
          root: rootRef,
          document: docRef,
          lazyRuntimeGroupLoaded: true
        }));
        if (!delegate) {
          throw new Error('gacha modules are unavailable after lazy runtime load');
        }
        loadStatus.succeed();
        return delegate;
      }).catch((error) => {
        loadStatus.fail();
        throw error;
      }).finally(() => {
        if (!delegate) loading = null;
      });
    }
    return loading;
  };

  const onOpenClick = function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    void ensureDelegate().then((api) => {
      try {
        openBtn.removeEventListener('click', onOpenClick);
      } catch (e) { /* ignore */ }
      if (api && typeof api.openOverlay === 'function') api.openOverlay();
    }).catch((error) => {
      try {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[gacha] lazy runtime load failed', error && error.message ? error.message : error);
        }
      } catch (e) { /* ignore */ }
    });
  };

  openBtn.addEventListener('click', onOpenClick);

  return {
    openOverlay: function () {
      return ensureDelegate().then((api) => api && typeof api.openOverlay === 'function' ? api.openOverlay() : undefined);
    },
    closeOverlay: function () {
      if (delegate && typeof delegate.closeOverlay === 'function') return delegate.closeOverlay();
      return undefined;
    },
    refresh: function () {
      if (delegate && typeof delegate.refresh === 'function') return delegate.refresh();
      return undefined;
    },
    performPull: function (pullCount: number) {
      return ensureDelegate().then((api) => api && typeof api.performPull === 'function' ? api.performPull(pullCount) : null);
    },
    getCatalogItems: function () {
      return delegate && typeof delegate.getCatalogItems === 'function' ? delegate.getCatalogItems() : [];
    },
    isOpen: function () {
      return delegate && typeof delegate.isOpen === 'function' ? delegate.isOpen() : false;
    },
    isAnimating: function () {
      if (delegate && typeof delegate.isAnimating === 'function') return delegate.isAnimating();
      return !!loading;
    }
  };
}

function getCatalogItems(options?: any): any[] {
  const transactionModule = resolveGachaTransactionModule();
  if (!transactionModule || typeof transactionModule.getCatalogItems !== 'function') return [];
  return transactionModule.getCatalogItems(options);
}

function commitPullTransaction(rootRef: any, pullCount: number, options?: any): any {
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

async function refreshLoadedAssetManifest(rootRef: any, uiBootstrap: any): Promise<any> {
  if (!uiBootstrap || typeof uiBootstrap.refreshLoadedAssetManifest !== 'function') {
    return null;
  }
  try {
    return await uiBootstrap.refreshLoadedAssetManifest({ root: rootRef });
  } catch (e) {
    return null;
  }
}

function canRefreshLoadedAssetManifest(rootRef: any, uiBootstrap: any): boolean {
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

function performPullWithLatestManifest(controller: any, rootRef: any, uiBootstrap: any, pullCount: number): Promise<any> {
  if (!canRefreshLoadedAssetManifest(rootRef, uiBootstrap)) {
    return controller.performPull(pullCount);
  }
  void refreshLoadedAssetManifest(rootRef, uiBootstrap);
  return controller.performPull(pullCount);
}

function setupGachaControls(options?: any): any {
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
  if (!transactionModule || !viewModule || !controllerModule) {
    const loadLazyRuntimeGroup = opts.lazyRuntimeGroupLoaded === true
      ? null
      : resolveLazyRuntimeGroupLoader(opts, rootRef);
    return typeof loadLazyRuntimeGroup === 'function'
      ? createLazyGachaControls(opts, rootRef, docRef, loadLazyRuntimeGroup)
      : null;
  }

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

  view.refs.openBtn.addEventListener('click', function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    if (controller.isOpen()) {
      controller.closeOverlay();
      return;
    }
    controller.openOverlay();
    if (canRefreshLoadedAssetManifest(rootRef, uiBootstrap)) {
      void refreshLoadedAssetManifest(rootRef, uiBootstrap);
    }
  });

  view.refs.closeBtn.addEventListener('click', function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    controller.closeOverlay();
  });

  if (view.refs.detailToggleBtn) {
    view.refs.detailToggleBtn.addEventListener('click', function (event: Event) {
      if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
      controller.toggleDetails();
    });
  }

  view.refs.singlePullBtn.addEventListener('click', function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    void performPullWithLatestManifest(controller, rootRef, uiBootstrap, 1);
  });

  view.refs.tenPullBtn.addEventListener('click', function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    void performPullWithLatestManifest(controller, rootRef, uiBootstrap, 10);
  });

  view.refs.overlay.addEventListener('click', function (event: Event) {
    controller.handleOverlayBackgroundClick(event);
  });

  docRef.addEventListener('keydown', function (event: KeyboardEvent) {
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
    performPull: function (pullCount: number) {
      return performPullWithLatestManifest(controller, rootRef, uiBootstrap, pullCount);
    },
    getCatalogItems: controller.getCatalogItems,
    isOpen: controller.isOpen,
    isAnimating: controller.isAnimating
  };
}

const GachaHandler = {
  commitPullTransaction,
  getCatalogItems,
  setupGachaControls
};

export = GachaHandler;
