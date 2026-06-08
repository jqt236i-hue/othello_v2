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

  test('quick volume slider updates master volume instead of only sound effects volume', () => {
    const dom = new JSDOM(`<!DOCTYPE html><body>
      <button id="muteBtn">🔊 ON</button>
      <select id="seTypeSelect"></select>
      <input id="seVolSlider" type="range" value="0.56">
    </body>`);
    const document = dom.window.document;
    global.window = dom.window;
    global.SoundEngine = {
      volume: 0.56,
      masterVolume: 1,
      init: jest.fn(),
      toggleMute: jest.fn(() => false),
      setVolume: jest.fn(),
      setMasterVolume: jest.fn(),
      playEffectByKey: jest.fn(() => true),
      listSelectablePlacementSounds: jest.fn(() => []),
      getSelectedPlacementSoundId: jest.fn(() => 'default'),
      setSelectedPlacementSoundId: jest.fn(() => 'default')
    };

    SoundHandlerModule.setupSoundControls(
      document.getElementById('muteBtn'),
      document.getElementById('seTypeSelect'),
      document.getElementById('seVolSlider')
    );

    const slider = document.getElementById('seVolSlider') as HTMLInputElement;
    slider.value = '0.25';
    slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    expect(global.SoundEngine.setMasterVolume).toHaveBeenCalledWith('0.25');
    expect(global.SoundEngine.setVolume).not.toHaveBeenCalled();
    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);

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

  test('real sound engine plays victory result BGM once and leaves normal BGM stopped after it ends', () => {
    const createdAudio = [];
    function FakeAudio(src) {
      this.src = src || '';
      this.preload = '';
      this.loop = false;
      this.volume = 0;
      this.currentTime = 0;
      this.paused = true;
      this.play = jest.fn(() => {
        this.paused = false;
        return Promise.resolve();
      });
      this.pause = jest.fn(() => {
        this.paused = true;
      });
      this.load = jest.fn();
      createdAudio.push(this);
    }

    const engine = loadSoundEngine({ Audio: FakeAudio });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;
    engine.bgmVolume = 0.25;

    expect(engine.playResultBgm('win')).toBe(true);

    const resultAudio = createdAudio[0];
    expect(engine.allowBgmPlay).toBe(false);
    expect(engine.bgm.pause).toHaveBeenCalledTimes(1);
    expect(resultAudio.src).toBe('assets/audio/other/勝利リザルト-bpm165.mp3');
    expect(resultAudio.loop).toBe(false);
    expect(resultAudio.volume).toBeCloseTo(0.25);
    expect(resultAudio.play).toHaveBeenCalledTimes(1);

    resultAudio.onended();

    expect(engine.allowBgmPlay).toBe(false);
    expect(engine.bgm.pause).toHaveBeenCalledTimes(1);
  });

  test('real sound engine loops defeat result BGM and resumes normal BGM when stopped for dismissal', () => {
    const createdAudio = [];
    function FakeAudio(src) {
      this.src = src || '';
      this.preload = '';
      this.loop = false;
      this.volume = 0;
      this.currentTime = 9;
      this.paused = true;
      this.play = jest.fn(() => {
        this.paused = false;
        return Promise.resolve();
      });
      this.pause = jest.fn(() => {
        this.paused = true;
      });
      this.load = jest.fn();
      createdAudio.push(this);
    }

    const engine = loadSoundEngine({ Audio: FakeAudio });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;
    engine.playBgm = jest.fn(function () {
      this.allowBgmPlay = true;
      this.bgm.paused = false;
    });

    expect(engine.playResultBgm('lose')).toBe(true);

    const resultAudio = createdAudio[0];
    expect(resultAudio.src).toBe('assets/audio/other/敗北リザルト-bpm115.mp3');
    expect(resultAudio.loop).toBe(true);

    expect(engine.stopResultBgm({ resumeBgm: true })).toBe(true);

    expect(resultAudio.pause).toHaveBeenCalledTimes(1);
    expect(resultAudio.currentTime).toBe(0);
    expect(engine.playBgm).toHaveBeenCalledTimes(1);
    expect(engine.allowBgmPlay).toBe(true);
  });

  test('real sound engine uses buffered 90-beat loop for defeat result BGM when available', async () => {
    const createdSources = [];
    const createdGains = [];
    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
        this.currentTime = 0;
        this.decodeAudioData = jest.fn(() => Promise.resolve({ duration: 46.956553 }));
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      createBufferSource() {
        const source = {
          buffer: null,
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          disconnect: jest.fn(),
          onended: null
        };
        createdSources.push(source);
        return source;
      }

      createGain() {
        const gain = {
          gain: {
            value: 0,
            setValueAtTime: jest.fn(function (value) {
              this.value = value;
            })
          },
          connect: jest.fn(),
          disconnect: jest.fn()
        };
        createdGains.push(gain);
        return gain;
      }
    }

    const fetchMock = jest.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    }));
    function AudioShouldNotBeUsed() {
      throw new Error('HTML Audio fallback should not be used for buffered defeat loop');
    }

    const engine = loadSoundEngine({
      AudioContext: FakeAudioContext,
      fetch: fetchMock,
      Audio: AudioShouldNotBeUsed
    });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;
    engine.bgmVolume = 0.25;
    engine.playBgm = jest.fn(function () {
      this.allowBgmPlay = true;
      this.bgm.paused = false;
    });

    expect(engine.playResultBgm('lose')).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledWith('assets/audio/other/敗北リザルト-bpm115.mp3');
    expect(createdSources).toHaveLength(1);
    expect(createdSources[0].loop).toBe(true);
    expect(createdSources[0].loopStart).toBe(0);
    expect(createdSources[0].loopEnd).toBeCloseTo(90 * 60 / 115, 6);
    expect(createdSources[0].start).toHaveBeenCalledWith(0, 0);
    expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.25, 0);

    expect(engine.stopResultBgm({ resumeBgm: true })).toBe(true);

    expect(createdSources[0].stop).toHaveBeenCalledTimes(1);
    expect(createdSources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(createdGains[0].disconnect).toHaveBeenCalledTimes(1);
    expect(engine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('real sound engine falls back to HTML Audio when result AudioContext creation fails', () => {
    const createdAudio = [];
    class ThrowingAudioContext {
      constructor() {
        throw new Error('audio context blocked');
      }
    }
    function FakeAudio(src) {
      this.src = src || '';
      this.preload = '';
      this.loop = false;
      this.volume = 0;
      this.currentTime = 0;
      this.paused = true;
      this.play = jest.fn(() => {
        this.paused = false;
        return Promise.resolve();
      });
      this.pause = jest.fn(() => {
        this.paused = true;
      });
      this.load = jest.fn();
      createdAudio.push(this);
    }

    const engine = loadSoundEngine({
      AudioContext: ThrowingAudioContext,
      fetch: jest.fn(),
      Audio: FakeAudio
    });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;

    expect(engine.playResultBgm('lose')).toBe(true);

    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0].src).toBe('assets/audio/other/敗北リザルト-bpm115.mp3');
    expect(createdAudio[0].play).toHaveBeenCalledTimes(1);
  });

  test('real sound engine resumes normal BGM when buffered result load and fallback audio both fail', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
        this.currentTime = 0;
        this.decodeAudioData = jest.fn();
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      createBufferSource() {
        return {
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          disconnect: jest.fn()
        };
      }

      createGain() {
        return {
          gain: { value: 0 },
          connect: jest.fn(),
          disconnect: jest.fn()
        };
      }
    }

    const engine = loadSoundEngine({
      AudioContext: FakeAudioContext,
      fetch: jest.fn(() => Promise.reject(new Error('network unavailable'))),
      Audio: undefined
    });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;
    engine.playBgm = jest.fn(function () {
      this.allowBgmPlay = true;
      this.bgm.paused = false;
    });

    expect(engine.playResultBgm('lose')).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(engine.bgm.pause).toHaveBeenCalledTimes(1);
    expect(engine.playBgm).toHaveBeenCalledTimes(1);
    expect(engine.allowBgmPlay).toBe(true);
    expect(engine.bgm.paused).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Buffered result BGM unavailable for assets/audio/other/敗北リザルト-bpm115.mp3: network unavailable'
    );
    warnSpy.mockRestore();
  });

  test('real sound engine reports buffered result BGM stopped without resuming normal BGM', async () => {
    const createdSources = [];
    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
        this.currentTime = 0;
        this.decodeAudioData = jest.fn(() => Promise.resolve({ duration: 46.956553 }));
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      createBufferSource() {
        const source = {
          buffer: null,
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          disconnect: jest.fn(),
          onended: null
        };
        createdSources.push(source);
        return source;
      }

      createGain() {
        return {
          gain: { value: 0, setValueAtTime: jest.fn() },
          connect: jest.fn(),
          disconnect: jest.fn()
        };
      }
    }

    const engine = loadSoundEngine({
      AudioContext: FakeAudioContext,
      fetch: jest.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })),
      Audio: undefined
    });
    engine.bgm = { paused: false, pause: jest.fn(function () { this.paused = true; }) };
    engine.allowBgmPlay = true;
    engine.playBgm = jest.fn();

    expect(engine.playResultBgm('lose')).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(engine.stopResultBgm({ resumeBgm: false })).toBe(true);
    expect(createdSources[0].stop).toHaveBeenCalledTimes(1);
    expect(engine.playBgm).not.toHaveBeenCalled();
  });
});
