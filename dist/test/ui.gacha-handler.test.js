"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
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
        dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <button id="gachaOpenBtn" aria-expanded="false"></button>
      <div id="gachaOverlay" aria-hidden="true">
        <div id="gachaModal">
          <button id="gachaCloseBtn" type="button"></button>
          <span id="gachaBalanceValue">0</span>
          <button id="gachaDetailToggleBtn" type="button" aria-expanded="false"></button>
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
        }
        catch (e) { }
        delete global.window;
        delete global.document;
        delete global.Event;
        delete global.CustomEvent;
    });
    test('opens modal, shows details, and performs a deterministic new pull', () => {
        jest.resetModules();
        setDom();
        storageModule = require('../ui/storage/gacha-progress.js');
        storageModule.awardObservationStones(window, 250);
        import * as mod from '../ui/handlers/gacha.js';
        const fakeRevealPlayer = {
            play: jest.fn().mockResolvedValue({ finishedWith: 'animated' })
        };
        const randomValues = [0.99, 0.25];
        const api = mod.setupGachaControls({
            root: window,
            randomFn: () => randomValues.shift() || 0.25,
            createRevealPlayer: () => fakeRevealPlayer
        });
        document.getElementById('gachaOpenBtn').click();
        expect(document.getElementById('gachaOverlay').classList.contains('is-open')).toBe(true);
        expect(document.getElementById('gachaBalanceValue').textContent).toBe('250');
        document.getElementById('gachaDetailToggleBtn').click();
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
        import * as mod from '../ui/handlers/gacha.js';
        const fakeRevealPlayer = {
            play: jest.fn().mockResolvedValue({ finishedWith: 'animated' })
        };
        const randomValues = [0.99, 0.25];
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
    test('refreshes the loaded asset manifest before performing a pull when bootstrap helper exists', async () => {
        jest.resetModules();
        setDom();
        storageModule = require('../ui/storage/gacha-progress.js');
        storageModule.awardObservationStones(window, 250);
        import * as mod from '../ui/handlers/gacha.js';
        const refreshLoadedAssetManifest = jest.fn().mockResolvedValue({ status: 'ok' });
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
        await api.performPull(1);
        expect(refreshLoadedAssetManifest).toHaveBeenCalledWith({ root: window });
    });
    test('locks close, detail, and pull buttons while reveal is playing', async () => {
        jest.resetModules();
        setDom();
        storageModule = require('../ui/storage/gacha-progress.js');
        storageModule.awardObservationStones(window, 1200);
        import * as mod from '../ui/handlers/gacha.js';
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
        expect(document.getElementById('gachaDetailToggleBtn').disabled).toBe(true);
        expect(document.getElementById('gachaSinglePullBtn').disabled).toBe(true);
        expect(document.getElementById('gachaTenPullBtn').disabled).toBe(true);
        deferred.resolve({ finishedWith: 'animated' });
        await pending;
        expect(api.isAnimating()).toBe(false);
        expect(document.getElementById('gachaOverlay').classList.contains('is-revealing')).toBe(false);
        expect(document.getElementById('gachaCloseBtn').disabled).toBe(false);
        expect(document.getElementById('gachaDetailToggleBtn').disabled).toBe(false);
        expect(document.getElementById('gachaSinglePullBtn').disabled).toBe(false);
    });
});
//# sourceMappingURL=ui.gacha-handler.test.js.map