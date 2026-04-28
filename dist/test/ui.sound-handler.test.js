"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vm = __importStar(require("vm"));
const jsdom_1 = require("jsdom");
const SoundHandlerModule = __importStar(require("../ui/handlers/sound.js"));
function loadSoundEngine(overrides = {}) {
    const filePath = path.resolve(__dirname, '..', 'sound-engine.js');
    const source = fs.readFileSync(filePath, 'utf8') + '\nmodule.exports = SoundEngine;';
    const context = Object.assign({
        module: { exports: {} },
        exports: {},
        console,
        updateBgmButtons: jest.fn(),
        Audio: function Audio() { }
    }, overrides);
    vm.runInNewContext(source, context, { filename: filePath });
    return context.module.exports;
}
describe('sound handler', () => {
    afterEach(() => {
        delete global.SoundEngine;
        delete global.PlacementSoundSelectionModule;
        delete global.document;
        delete global.window;
    });
    test('sound select reflects owned placement sounds and keeps the selected value after preview', () => {
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><body>
      <button id="muteBtn">🔊 ON</button>
      <select id="seTypeSelect"></select>
      <input id="seVolSlider" type="range" value="0.56">
    </body>`);
        const document = dom.window.document;
        global.window = dom.window;
        let selectedSoundId = 'default';
        global.PlacementSoundSelectionModule = {
            listSelectablePlacementSounds: jest.fn(() => ([
                { id: 'default', label: '既定配置音' },
                { id: 'gacha__n__placement_sound__type-1-standard', label: 'type-1-standard' }
            ])),
            getSelectedPlacementSoundId: jest.fn(() => selectedSoundId),
            setSelectedPlacementSoundId: jest.fn((nextId) => {
                selectedSoundId = nextId;
                return nextId;
            })
        };
        global.SoundEngine = {
            volume: 0.56,
            init: jest.fn(),
            toggleMute: jest.fn(() => false),
            setVolume: jest.fn(),
            playEffectByKey: jest.fn(() => true),
            listSelectablePlacementSounds: jest.fn(),
            getSelectedPlacementSoundId: jest.fn(),
            setSelectedPlacementSoundId: jest.fn()
        };
        const muteBtn = document.getElementById('muteBtn');
        const seTypeSelect = document.getElementById('seTypeSelect');
        const seVolSlider = document.getElementById('seVolSlider');
        SoundHandlerModule.setupSoundControls(muteBtn, seTypeSelect, seVolSlider);
        expect(Array.from(seTypeSelect.options).map((option) => ({
            value: option.value,
            text: option.textContent
        }))).toEqual([
            { value: 'default', text: '既定配置音' },
            { value: 'gacha__n__placement_sound__type-1-standard', text: 'type-1-standard' }
        ]);
        expect(seTypeSelect.value).toBe('default');
        seTypeSelect.value = 'gacha__n__placement_sound__type-1-standard';
        seTypeSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        expect(global.PlacementSoundSelectionModule.setSelectedPlacementSoundId).toHaveBeenCalledWith('gacha__n__placement_sound__type-1-standard', expect.objectContaining({ root: dom.window }));
        expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
        expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('stone_place', expect.objectContaining({ root: dom.window }));
        expect(seTypeSelect.value).toBe('gacha__n__placement_sound__type-1-standard');
        dom.window.close();
    });
    test('gacha inventory updates refresh the selectable placement sound list', () => {
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><body>
      <button id="muteBtn">🔊 ON</button>
      <select id="seTypeSelect"></select>
      <input id="seVolSlider" type="range" value="0.56">
    </body>`);
        const document = dom.window.document;
        global.window = dom.window;
        let soundDefinitions = [{ id: 'default', label: '既定配置音' }];
        global.PlacementSoundSelectionModule = {
            listSelectablePlacementSounds: jest.fn(() => soundDefinitions),
            getSelectedPlacementSoundId: jest.fn(() => 'default'),
            setSelectedPlacementSoundId: jest.fn((nextId) => nextId)
        };
        global.SoundEngine = {
            volume: 0.56,
            init: jest.fn(),
            toggleMute: jest.fn(() => false),
            setVolume: jest.fn(),
            playEffectByKey: jest.fn(() => true),
            listSelectablePlacementSounds: jest.fn(),
            getSelectedPlacementSoundId: jest.fn(),
            setSelectedPlacementSoundId: jest.fn()
        };
        SoundHandlerModule.setupSoundControls(document.getElementById('muteBtn'), document.getElementById('seTypeSelect'), document.getElementById('seVolSlider'));
        soundDefinitions = [
            { id: 'default', label: '既定配置音' },
            { id: 'gacha__n__placement_sound__type-1-standard', label: 'type-1-standard' }
        ];
        dom.window.dispatchEvent(new dom.window.CustomEvent('gacha:inventory-updated'));
        expect(Array.from(document.getElementById('seTypeSelect').options).map((option) => option.value)).toEqual([
            'default',
            'gacha__n__placement_sound__type-1-standard'
        ]);
        dom.window.close();
    });
    test('real sound engine reads unlocked placement sounds from the browser global storage export', () => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM(`<!DOCTYPE html><body>
      <button id="muteBtn">🔊 ON</button>
      <select id="seTypeSelect"></select>
      <input id="seVolSlider" type="range" value="0.56">
    </body>`, { url: 'https://example.test/' });
        const document = dom.window.document;
        global.window = dom.window;
        global.document = document;
        import * as gachaProgressStorage from '../ui/storage/gacha-progress.js';
        import * as catalogAccess from '../ui/gacha/catalog-access.js';
        import * as placementSoundSelection from '../ui/placement-sound-selection.js';
        dom.window.GachaProgressStorage = gachaProgressStorage;
        dom.window.ObservationGachaCatalogAccessModule = catalogAccess;
        dom.window.PlacementSoundSelectionModule = placementSoundSelection;
        global.SoundEngine = loadSoundEngine({
            localStorage: dom.window.localStorage,
            PlacementSoundSelectionModule: placementSoundSelection
        });
        gachaProgressStorage.unlockPlacementSoundIds(dom.window, ['gacha__n__placement_sound__type-1-standard']);
        SoundHandlerModule.setupSoundControls(document.getElementById('muteBtn'), document.getElementById('seTypeSelect'), document.getElementById('seVolSlider'));
        expect(Array.from(document.getElementById('seTypeSelect').options).map((option) => option.value)).toContain('gacha__n__placement_sound__type-1-standard');
        dom.window.close();
    });
});
//# sourceMappingURL=ui.sound-handler.test.js.map