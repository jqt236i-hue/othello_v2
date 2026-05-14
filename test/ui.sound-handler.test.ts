import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';
import * as SoundHandlerModule from '../ui/handlers/sound.js';

function loadSoundEngine(overrides = {}) {
  const filePath = path.resolve(__dirname, '..', 'dist', 'sound-engine.js');
  const source = fs.readFileSync(filePath, 'utf8') + '\nmodule.exports = module.exports.default || exports.default || SoundEngine;';
  const moduleRef = { exports: {} };
  const context = Object.assign({
    module: moduleRef,
    exports: moduleRef.exports,
    require: jest.fn(),
    console,
    updateBgmButtons: jest.fn(),
    Audio: function Audio() {}
  }, overrides);
  if (!context.window) context.window = context;
  if (!context.window.updateBgmButtons) context.window.updateBgmButtons = context.updateBgmButtons;
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
    const dom = new JSDOM(`<!DOCTYPE html><body>
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

    expect(global.PlacementSoundSelectionModule.setSelectedPlacementSoundId).toHaveBeenCalledWith(
      'gacha__n__placement_sound__type-1-standard',
      expect.objectContaining({ root: dom.window })
    );
    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('stone_place', expect.objectContaining({ root: dom.window }));
    expect(seTypeSelect.value).toBe('gacha__n__placement_sound__type-1-standard');

    dom.window.close();
  });

  test('gacha inventory updates refresh the selectable placement sound list', () => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
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

    SoundHandlerModule.setupSoundControls(
      document.getElementById('muteBtn'),
      document.getElementById('seTypeSelect'),
      document.getElementById('seVolSlider')
    );

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
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <button id="muteBtn">🔊 ON</button>
      <select id="seTypeSelect"></select>
      <input id="seVolSlider" type="range" value="0.56">
    </body>`, { url: 'https://example.test/' });
    const document = dom.window.document;
    global.window = dom.window;
    global.document = document;

    const gachaProgressStorage = require('../ui/storage/gacha-progress.js');
    const catalogAccess = require('../ui/gacha/catalog-access.js');
    const placementSoundSelection = require('../ui/placement-sound-selection.js');
    const catalogModule = require('../shared/observation-gacha-catalog.generated.js');
    const catalogSharedModule = require('../shared/observation-gacha-catalog-shared.js');
    dom.window.GachaProgressStorage = gachaProgressStorage;
    dom.window.ObservationGachaCatalogAccessModule = catalogAccess;
    dom.window.ObservationGachaCatalogModule = catalogModule;
    dom.window.ObservationGachaCatalogSharedModule = catalogSharedModule;
    dom.window.PlacementSoundSelectionModule = placementSoundSelection;

    global.SoundEngine = loadSoundEngine({
      localStorage: dom.window.localStorage,
      PlacementSoundSelectionModule: placementSoundSelection,
      GachaProgressStorage: gachaProgressStorage,
      ObservationGachaCatalogAccessModule: catalogAccess,
      ObservationGachaCatalogModule: catalogModule,
      ObservationGachaCatalogSharedModule: catalogSharedModule
    });
    gachaProgressStorage.unlockPlacementSoundIds(dom.window, ['gacha__n__placement_sound__type-1-standard']);

    SoundHandlerModule.setupSoundControls(
      document.getElementById('muteBtn'),
      document.getElementById('seTypeSelect'),
      document.getElementById('seVolSlider')
    );

    expect(Array.from(document.getElementById('seTypeSelect').options).map((option) => option.value)).toContain(
      'gacha__n__placement_sound__type-1-standard'
    );

    dom.window.close();
  });
});
