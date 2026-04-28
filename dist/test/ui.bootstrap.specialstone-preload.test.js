"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('ui/bootstrap special stone preload', () => {
    let consoleErrorSpy;
    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        try {
            consoleErrorSpy.mockRestore();
        }
        catch (e) { }
        jest.resetModules();
        try {
            delete global.window;
        }
        catch (e) { }
        try {
            delete global.document;
        }
        catch (e) { }
        try {
            delete global.Image;
        }
        catch (e) { }
        try {
            delete global.preloadStoneVisualEffectKeys;
        }
        catch (e) { }
        try {
            delete global.getSupportedEffectKeys;
        }
        catch (e) { }
    });
    function installDom() {
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.Image = dom.window.Image;
        return dom;
    }
    test('preloadSpecialStoneVisuals forwards supported effect keys to the stone visual preloader', () => {
        installDom();
        const preloadCalls = [];
        global.getSupportedEffectKeys = jest.fn(() => ['ultimateDragon', 'ultimateDestroyGod', 'normal', 'ultimateDragon']);
        global.preloadStoneVisualEffectKeys = jest.fn((keys) => {
            preloadCalls.push(keys);
            return { started: ['assets/images/stones/ultimate_reverse_dragon-black.png'], skipped: [] };
        });
        import * as uiBootstrap from '../ui/bootstrap.js';
        const result = uiBootstrap.preloadSpecialStoneVisuals();
        expect(global.getSupportedEffectKeys).toHaveBeenCalledTimes(1);
        expect(global.preloadStoneVisualEffectKeys).toHaveBeenCalledTimes(1);
        expect(preloadCalls[0]).toEqual(['ultimateDragon', 'ultimateDestroyGod']);
        expect(result).toMatchObject({
            attempted: true,
            effectKeys: ['ultimateDragon', 'ultimateDestroyGod'],
            started: ['assets/images/stones/ultimate_reverse_dragon-black.png']
        });
    });
    test('installGameDI triggers special stone preloading during boot', () => {
        installDom();
        document.documentElement.classList.add('stone-base-images-ready');
        global.getSupportedEffectKeys = jest.fn(() => ['ultimateDragon', 'ultimateDestroyGod']);
        global.preloadStoneVisualEffectKeys = jest.fn(() => ({ started: [], skipped: [] }));
        import * as uiBootstrap from '../ui/bootstrap.js';
        uiBootstrap.installGameDI();
        expect(global.preloadStoneVisualEffectKeys).toHaveBeenCalledTimes(1);
        expect(global.preloadStoneVisualEffectKeys).toHaveBeenCalledWith(['ultimateDragon', 'ultimateDestroyGod']);
    });
});
//# sourceMappingURL=ui.bootstrap.specialstone-preload.test.js.map