import { JSDOM } from 'jsdom';

describe('gacha handler', () => {
  let dom;
  let storageModule;

  function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function setDom() {
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="gachaOpenBtn" aria-expanded="false"></button>
      <div id="gachaOverlay" aria-hidden="true">
        <div id="gachaModal">
          <button id="gachaCloseBtn" type="button"></button>
          <span id="gachaBalanceValue">0</span>
          <div id="gachaDetailsPanel" hidden></div>
          <button id="gachaSinglePullBtn" type="button"></button>
          <button id="gachaTenPullBtn" type="button"></button>
          <div id="gachaStatusText"></div>
          <div id="gachaResults"></div>
        </div>
      </div>
    </body></html>`, { url: 'https://example.test/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;
  }

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.CustomEvent;
    delete global.GachaTransactionModule;
    delete global.GachaOverlayViewModule;
    delete global.GachaOverlayControllerModule;
    jest.dontMock('../ui/gacha/gacha-transaction');
    jest.dontMock('../ui/gacha/gacha-overlay-view');
    jest.dontMock('../ui/gacha/gacha-overlay-controller');
  });

  test('opens modal with details visible and performs a deterministic new pull', () => {
    jest.resetModules();
    setDom();
    storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.awardObservationStones(window, 250);
    const mod = require('../ui/handlers/gacha.js');
    const fakeRevealPlayer = {
      play: jest.fn().mockResolvedValue({ finishedWith: 'animated' })
    };
    const randomValues = [0.99, 0.5];

    const api = mod.setupGachaControls({
      root: window,
      randomFn: () => randomValues.shift() || 0.25,
      createRevealPlayer: () => fakeRevealPlayer
    });

    expect(document.querySelectorAll('link[data-card-reversi-feature-style="gacha"]')).toHaveLength(0);
    document.getElementById('gachaOpenBtn').click();
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="gacha"]')).toHaveLength(1);
    expect(document.getElementById('gachaOverlay').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('gachaBalanceValue').textContent).toBe('250');

    expect(document.getElementById('gachaDetailsPanel').hidden).toBe(false);
    expect(document.getElementById('gachaDetailsPanel').textContent).toContain('EXR');
    expect(document.getElementById('gachaDetailsPanel').textContent).not.toContain('未登録 rarity');

    return api.performPull(1).then(() => {
      expect(fakeRevealPlayer.play).toHaveBeenCalledWith(expect.objectContaining({
        pulls: expect.arrayContaining([
          expect.objectContaining({
            item: expect.objectContaining({ label: '人の手' })
          })
        ]),
        newlyUnlockedIds: ['gacha__n__人の手']
      }));

      expect(storageModule.getObservationStones(window)).toBe(150);
      expect(document.getElementById('gachaResults').textContent).toContain('人の手');
      expect(document.getElementById('gachaResults').textContent).toContain('NEW');
      expect(document.getElementById('gachaStatusText').textContent).toContain('新規 1件');
    });
  });

  test('marks duplicate pulls as already owned', () => {
    jest.resetModules();
    setDom();
    storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.awardObservationStones(window, 200);
    storageModule.applyPullResults(window, [{ item: { id: 'gacha__n__人の手', kind: 'hand_skin' } }]);
    const mod = require('../ui/handlers/gacha.js');
    const fakeRevealPlayer = {
      play: jest.fn().mockResolvedValue({ finishedWith: 'animated' })
    };
    const randomValues = [0.99, 0.5];

    const api = mod.setupGachaControls({
      root: window,
      randomFn: () => randomValues.shift() || 0.25,
      createRevealPlayer: () => fakeRevealPlayer
    });

    return api.performPull(1).then(() => {
      expect(storageModule.getObservationStones(window)).toBe(100);
      expect(document.getElementById('gachaResults').textContent).toContain('所持済み');
      expect(document.getElementById('gachaStatusText').textContent).toContain('所持済み 1件');
    });
  });

  test('starts a pull without waiting for the loaded asset manifest refresh', async () => {
    jest.resetModules();
    setDom();
    storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.awardObservationStones(window, 250);
    const mod = require('../ui/handlers/gacha.js');
    const deferred = createDeferred();
    const refreshLoadedAssetManifest = jest.fn(() => deferred.promise);
    const fakeRevealPlayer = {
      play: jest.fn().mockResolvedValue({ finishedWith: 'animated' })
    };
    window.fetch = jest.fn();

    const api = mod.setupGachaControls({
      root: window,
      randomFn: () => 0.99,
      createRevealPlayer: () => fakeRevealPlayer,
      uiBootstrap: {
        refreshLoadedAssetManifest,
        ASSET_MANIFEST_UPDATED_EVENT: 'asset-manifest:updated'
      }
    });

    const pending = api.performPull(1);
    expect(refreshLoadedAssetManifest).toHaveBeenCalledWith({ root: window });
    expect(fakeRevealPlayer.play).toHaveBeenCalled();

    deferred.resolve({ status: 'ok' });
    await pending;
  });

  test('locks close and pull buttons while reveal is playing', async () => {
    jest.resetModules();
    setDom();
    storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.awardObservationStones(window, 1200);
    const mod = require('../ui/handlers/gacha.js');
    const deferred = createDeferred();
    const fakeRevealPlayer = {
      play: jest.fn(() => deferred.promise)
    };

    const api = mod.setupGachaControls({
      root: window,
      randomFn: () => 0.99,
      createRevealPlayer: () => fakeRevealPlayer
    });

    const pending = api.performPull(1);

    expect(api.isAnimating()).toBe(true);
    expect(document.getElementById('gachaOverlay').classList.contains('is-revealing')).toBe(true);
    expect(document.getElementById('gachaCloseBtn').disabled).toBe(true);
    expect(document.getElementById('gachaSinglePullBtn').disabled).toBe(true);
    expect(document.getElementById('gachaTenPullBtn').disabled).toBe(true);

    deferred.resolve({ finishedWith: 'animated' });
    await pending;

    expect(api.isAnimating()).toBe(false);
    expect(document.getElementById('gachaOverlay').classList.contains('is-revealing')).toBe(false);
    expect(document.getElementById('gachaCloseBtn').disabled).toBe(false);
    expect(document.getElementById('gachaSinglePullBtn').disabled).toBe(false);
  });

  test('lazy loads optional gacha modules on first open click', async () => {
    jest.resetModules();
    setDom();
    jest.doMock('../ui/gacha/gacha-transaction', () => {
      throw new Error('optional gacha registry not loaded');
    });
    jest.doMock('../ui/gacha/gacha-overlay-view', () => {
      throw new Error('optional gacha registry not loaded');
    });
    jest.doMock('../ui/gacha/gacha-overlay-controller', () => {
      throw new Error('optional gacha registry not loaded');
    });

    const controller = {
      initialize: jest.fn(),
      isOpen: jest.fn(() => false),
      openOverlay: jest.fn(),
      closeOverlay: jest.fn(),
      toggleDetails: jest.fn(),
      refresh: jest.fn(),
      getCatalogItems: jest.fn(() => []),
      isAnimating: jest.fn(() => false),
      performPull: jest.fn(),
      handleOverlayBackgroundClick: jest.fn(),
      handleEscape: jest.fn(() => false)
    };
    const createGachaOverlayController = jest.fn(() => controller);
    const createGachaOverlayView = jest.fn(() => ({
      refs: {
        openBtn: document.getElementById('gachaOpenBtn'),
        overlay: document.getElementById('gachaOverlay'),
        modal: document.getElementById('gachaModal'),
        closeBtn: document.getElementById('gachaCloseBtn'),
        detailToggleBtn: null,
        singlePullBtn: document.getElementById('gachaSinglePullBtn'),
        tenPullBtn: document.getElementById('gachaTenPullBtn')
      }
    }));
    const loadLazyRuntimeGroup = jest.fn(async (group) => {
      expect(group).toBe('gacha');
      global.GachaTransactionModule = {
        getCatalogItems: () => [],
        commitPullTransaction: jest.fn()
      };
      global.GachaOverlayViewModule = { createGachaOverlayView };
      global.GachaOverlayControllerModule = { createGachaOverlayController };
      return true;
    });

    const mod = require('../ui/handlers/gacha.js');
    const api = mod.setupGachaControls({
      root: window,
      loadLazyRuntimeGroup
    });

    expect(api).not.toBeNull();
    expect(createGachaOverlayController).not.toHaveBeenCalled();

    document.getElementById('gachaOpenBtn').click();
    expect(document.getElementById('gachaOpenBtn').getAttribute('aria-busy')).toBe('true');
    await new Promise((resolve) => setImmediate(resolve));

    expect(loadLazyRuntimeGroup).toHaveBeenCalledTimes(1);
    expect(createGachaOverlayController).toHaveBeenCalledTimes(1);
    expect(controller.initialize).toHaveBeenCalledTimes(1);
    expect(controller.openOverlay).toHaveBeenCalledTimes(1);
    expect(document.getElementById('gachaOpenBtn').getAttribute('aria-busy')).toBeNull();
    expect(document.getElementById('gachaOpenBtn').getAttribute('data-lazy-load-state')).toBe('loaded');
  });

  test('marks a failed lazy gacha load as retryable and succeeds on the next click', async () => {
    jest.resetModules();
    setDom();
    jest.doMock('../ui/gacha/gacha-transaction', () => {
      throw new Error('optional gacha registry not loaded');
    });
    jest.doMock('../ui/gacha/gacha-overlay-view', () => {
      throw new Error('optional gacha registry not loaded');
    });
    jest.doMock('../ui/gacha/gacha-overlay-controller', () => {
      throw new Error('optional gacha registry not loaded');
    });
    let attempt = 0;
    const controller = {
      initialize: jest.fn(),
      isOpen: jest.fn(() => false),
      openOverlay: jest.fn(),
      closeOverlay: jest.fn(),
      toggleDetails: jest.fn(),
      refresh: jest.fn(),
      getCatalogItems: jest.fn(() => []),
      isAnimating: jest.fn(() => false),
      performPull: jest.fn(),
      handleOverlayBackgroundClick: jest.fn(),
      handleEscape: jest.fn(() => false)
    };
    const loadLazyRuntimeGroup = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network failed');
      global.GachaTransactionModule = { getCatalogItems: () => [], commitPullTransaction: jest.fn() };
      global.GachaOverlayViewModule = { createGachaOverlayView: jest.fn(() => ({
        refs: {
          openBtn: document.getElementById('gachaOpenBtn'),
          overlay: document.getElementById('gachaOverlay'),
          modal: document.getElementById('gachaModal'),
          closeBtn: document.getElementById('gachaCloseBtn'),
          detailToggleBtn: null,
          singlePullBtn: document.getElementById('gachaSinglePullBtn'),
          tenPullBtn: document.getElementById('gachaTenPullBtn')
        }
      })) };
      global.GachaOverlayControllerModule = {
        createGachaOverlayController: jest.fn(() => controller)
      };
      return true;
    });
    const mod = require('../ui/handlers/gacha.js');
    mod.setupGachaControls({ root: window, loadLazyRuntimeGroup });
    const button = document.getElementById('gachaOpenBtn');

    button.click();
    await new Promise((resolve) => setImmediate(resolve));
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.getAttribute('data-lazy-load-state')).toBe('error');
    expect(button.getAttribute('aria-label')).toContain('再試行');

    button.click();
    await new Promise((resolve) => setImmediate(resolve));
    expect(loadLazyRuntimeGroup).toHaveBeenCalledTimes(2);
    expect(button.getAttribute('data-lazy-load-state')).toBe('loaded');
  });
});
