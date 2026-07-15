import {
  clearAnimationEngineDomBackendSleepControl,
  installAnimationEngineDomBackendMock,
  setAnimationEngineDomBackendSleepControl
} from './helpers/animation-engine-dom-backend';

installAnimationEngineDomBackendMock();

function installAnimationClock(options: { noAnim?: boolean } = {}) {
  let nextTimerId = 1;
  const timer = {
    setTimeout: jest.fn((callback: () => void, durationMs: number) => {
      const timerId = nextTimerId++;
      // The playback watchdog must remain armed until play() settles. All
      // presentation delays are completed synchronously so the public API can
      // be tested without reaching into AnimationEngine's private sleep hook.
      if (Number(durationMs) < 10000) callback();
      return timerId;
    }),
    clearTimeout: jest.fn(),
    clearAll: jest.fn(),
    pendingCount: jest.fn(() => 0),
    newScope: jest.fn(() => null),
    clearScope: jest.fn()
  };
  jest.doMock('../ui/animation-shared.js', () => ({
    isNoAnim: () => typeof options.noAnim === 'boolean'
      ? options.noAnim
      : (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1'),
    getTimer: () => timer
  }));
  return timer;
}

function usedPhaseGap(timer: { setTimeout: jest.Mock }): boolean {
  return timer.setTimeout.mock.calls.some((call) => Number(call[1]) === 200);
}

describe('animation-engine public playback contract', () => {
  beforeEach(() => {
    jest.resetModules();
    clearAnimationEngineDomBackendSleepControl();
  });

  afterEach(() => {
    clearAnimationEngineDomBackendSleepControl();
    jest.dontMock('../ui/animation-shared.js');
  });

  test('NOANIM playback skips the readable phase gap through the public play API', async () => {
    const timer = installAnimationClock({ noAnim: true });
    // Minimal fake document so the PlaybackEngine constructor succeeds in node tests
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = { addLog: jest.fn() };
    const engine = require('../ui/animation-engine.js');
    await expect(engine.play([
      { type: 'log', phase: 1, message: 'first' },
      { type: 'log', phase: 2, message: 'second' }
    ])).resolves.toBeUndefined();

    expect(usedPhaseGap(timer)).toBe(false);
    expect(global.window.addLog).toHaveBeenCalledTimes(2);
    delete global.window;
    delete global.document;
  });

  test('public board playback creates and clears one backend layout batch for the phase', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body><div id="board"><div class="cell" data-row="1" data-col="2"></div></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    const actualLayoutReadBatch = jest.requireActual('../ui/layout-read-batch');
    const clear = jest.fn();
    const createLayoutReadBatch = jest.fn(() => ({
      readRect: actualLayoutReadBatch.createLayoutReadBatch().readRect,
      clear
    }));
    jest.doMock('../ui/layout-read-batch', () => ({
      ...actualLayoutReadBatch,
      createLayoutReadBatch
    }));

    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([{
      type: 'spawn',
      phase: 1,
      targets: [{ r: 1, col: 2, after: { color: 1, owner: 'black' } }]
    }]);

    expect(createLayoutReadBatch).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(dom.window.document.querySelector('.cell[data-row="1"][data-col="2"] .disc')).toBeTruthy();

    jest.dontMock('../ui/layout-read-batch');
    dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('public spawn playback waits 500ms fade only for breeding spawn targets', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`<!doctype html><html><body><div id="board">
      <div class="cell" data-row="1" data-col="1"></div>
      <div class="cell" data-row="1" data-col="2"></div>
      <div class="cell" data-row="1" data-col="3"></div>
    </div></body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    const sleepControl = setAnimationEngineDomBackendSleepControl();
    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([{
      type: 'spawn',
      phase: 1,
      targets: [
        { r: 1, col: 1, cause: 'BREEDING', reason: 'breeding_spawn', after: { color: 1, owner: 'black' } },
        { r: 1, col: 2, cause: 'BREEDING', reason: 'breeding_spawn_immediate', after: { color: 1, owner: 'black' } },
        { r: 1, col: 3, cause: 'SYSTEM', reason: 'standard_place', after: { color: 1, owner: 'black' } }
      ]
    }]);

    const noAnimRun = process.env.NOANIM === '1'
      || process.env.NOANIM === 'true'
      || process.env.DISABLE_ANIMATIONS === '1';
    expect(sleepControl.mock.calls.filter((call) => Number(call[0]) === 620)).toHaveLength(noAnimRun ? 0 : 2);
    expect(dom.window.document.querySelectorAll('.disc')).toHaveLength(3);

    dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('public compatibility settlement resolves cells rendered in the board expansion layer', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board-stack">
            <div id="board-frame"><div id="board"></div></div>
            <div id="board-expansion-layer">
              <div class="cell cell-expanded cell-expanded-top" data-row="-1" data-col="0"></div>
            </div>
          </div>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    const engine = require('../ui/animation-engine.js');

    await engine.applyFinalStates({
      targets: [{ r: -1, col: 0, after: { color: 1, owner: 'black' } }]
    });

    expect(dom.window.document.querySelector('#board-expansion-layer .cell .disc.black')).toBeTruthy();

    dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('同じphaseに treasure_gain がある場合は charge_gain_common を再生しない', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'charge_gain_common' }] },
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'treasure_gain' }] }
    ]);

    expect(playEffectByKey).toHaveBeenCalledWith('treasure_gain');
    expect(playEffectByKey).not.toHaveBeenCalledWith('charge_gain_common');
    delete global.SoundEngine;
  });

  test('card_use_animation の直後 phase にある treasure_gain は追加ギャップなしで再生する', async () => {
    const timer = installAnimationClock();
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    global.emitBoardUpdate = jest.fn();
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };

    const engine = require('../ui/animation-engine.js');

    await engine.play([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'black', owner: 'black', cardId: 'TREASURE_BOX_001' }] },
      { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'treasure_gain' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(playEffectByKey).toHaveBeenCalledWith('treasure_gain');
    expect(usedPhaseGap(timer)).toBe(false);

    delete global.SoundEngine;
    delete global.emitBoardUpdate;
    delete global.window;
  });

  test('round_bonus_banner playback delegates to the status-display round pill helper', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      showRoundBonusDisplay: jest.fn()
    };

    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      {
        type: 'round_bonus_banner',
        phase: 3,
        targets: [{ roundNumber: 10, amount: 5, durationMs: 3000, text: 'BONUS ROUND +5' }]
      }
    ]);

    expect(global.window.showRoundBonusDisplay).toHaveBeenCalledWith({
      roundNumber: 10,
      amount: 5,
      durationMs: 3000,
      text: 'BONUS ROUND +5'
    });

    delete global.window;
  });

  test('place_hand_animation の直後 phase に spawn だけがある特殊石配置でも追加ギャップなしで再生する', async () => {
    const timer = installAnimationClock();
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body><div id="board"><div class="cell" data-row="4" data-col="4"></div></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.emitBoardUpdate = jest.fn();

    const engine = require('../ui/animation-engine.js');
    const executePhaseSpy = jest.spyOn(engine, 'executePhase');

    await engine.play([
      { type: 'place_hand_animation', phase: 0, targets: [{ r: 4, col: 4, player: 'black', owner: 'black' }] },
      {
        type: 'spawn',
        phase: 1,
        targets: [{
          r: 4,
          col: 4,
          ownerAfter: 'black',
          cause: 'SYSTEM',
          reason: 'standard_place',
          after: { color: 1, special: 'ULTIMATE_DESTROY_GOD', timer: 5, owner: 'black' }
        }]
      }
    ]);

    expect(executePhaseSpy).toHaveBeenCalledTimes(2);
    expect(usedPhaseGap(timer)).toBe(false);
    expect(dom.window.document.querySelector('.cell[data-row="4"][data-col="4"] .disc')).toBeTruthy();

    executePhaseSpy.mockRestore();
    dom.window.close();
    delete global.emitBoardUpdate;
    delete global.window;
    delete global.document;
  });

  test('regen placement animation uses heart badge instead of duration timer', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="1" data-col="2"></div>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    global.window.getEffectKeyForSpecialType = jest.fn(() => 'regenStone');
    global.window.applyStoneVisualEffect = jest.fn((disc) => disc.classList.add('special-stone', 'regen-stone'));

    const engine = require('../ui/animation-engine.js');
    await engine.applyFinalStates({
      targets: [{
        r: 1,
        col: 2,
        after: { color: 1, special: 'REGEN', timer: 3, owner: 'black' }
      }]
    });
    await engine.applyFinalStates({
      targets: [{
        r: 1,
        col: 2,
        after: { color: 1, special: 'REGEN', timer: 2, owner: 'black' }
      }]
    });

    const disc = dom.window.document.querySelector('.cell[data-row="1"][data-col="2"] .disc');
    expect(disc.querySelector('.special-timer')).toBeNull();
    expect(disc.querySelector('.stone-timer')).toBeNull();
    expect(disc.querySelectorAll('.stone-regen-badge')).toHaveLength(1);
    expect(disc.querySelector('.stone-regen-badge')?.textContent).toBe('2');
    expect(disc.querySelector('.stone-regen-badge-value')?.textContent).toBe('2');

    dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('spawn の直後 phase に多動系 move がある network playback でも追加ギャップなしで再生する', async () => {
    const timer = installAnimationClock();
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="2" data-col="2"></div>
            <div class="cell" data-row="2" data-col="3"></div>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.getEffectKeyForSpecialType = jest.fn(() => 'hyperactiveStone');
    global.window.setDiscStoneImage = jest.fn();
    global.window.clearStoneVisualEffectState = jest.fn();
    global.window.applyStoneVisualEffect = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.SoundEngine = { init: jest.fn(), playEffectByKey: jest.fn() };

    const animateSpy = jest.fn(() => ({
      addEventListener(eventName, handler) {
        if (eventName === 'finish' && typeof handler === 'function') handler();
      },
      removeEventListener() {},
      finished: Promise.resolve()
    }));
    global.window.Element.prototype.animate = animateSpy;

    const engine = require('../ui/animation-engine.js');

    await engine.play([
      {
        type: 'spawn',
        phase: 1,
        targets: [{
          r: 2,
          col: 3,
          ownerAfter: 'black',
          cause: 'HYPERACTIVE',
          reason: 'instant_hyperactive_spawn',
          after: { color: 1, special: 'HYPERACTIVE', timer: 9, owner: 'black', flipEvadeRemaining: 1 }
        }]
      },
      {
        type: 'move',
        phase: 2,
        targets: [{
          from: { r: 2, col: 3 },
          to: { r: 2, col: 2 },
          ownerAfter: 'black',
          cause: 'HYPERACTIVE',
          reason: 'hyperactive_move',
          meta: { moveIntent: 'hyperactive_move' },
          after: { color: 1, special: 'HYPERACTIVE', timer: 9, owner: 'black', flipEvadeRemaining: 1 }
        }]
      }
    ]);

    expect(usedPhaseGap(timer)).toBe(false);

    dom.window.close();
    delete global.SoundEngine;
    delete global.emitBoardUpdate;
    delete global.requestAnimationFrame;
    delete global.window;
    delete global.document;
  });

  test('network の place_hand_animation -> 特殊 spawn では通常石への描き戻しなしで配置する', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="2" data-col="3"></div>
          </div>
        </body>
      </html>
    `);
    const setDiscStoneImage = jest.fn();
    const clearStoneVisualEffectState = jest.fn();
    const applyStoneVisualEffect = jest.fn();

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.MATCH_MODE = 'network';
    global.window.playHandAnimation = jest.fn((player, row, col, done) => {
      if (typeof done === 'function') done();
    });
    global.window.getEffectKeyForSpecialType = jest.fn(() => 'hyperactiveStone');
    global.window.setDiscStoneImage = setDiscStoneImage;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    global.getEffectKeyForSpecialType = global.window.getEffectKeyForSpecialType;
    global.setDiscStoneImage = setDiscStoneImage;
    global.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.applyStoneVisualEffect = applyStoneVisualEffect;
    global.emitBoardUpdate = jest.fn();

    const engine = require('../ui/animation-engine.js');
    global.window.MATCH_MODE = 'network';
    global.window.playHandAnimation = jest.fn((player, row, col, done) => {
      if (typeof done === 'function') done();
    });
    global.window.getEffectKeyForSpecialType = jest.fn(() => 'hyperactiveStone');
    global.window.setDiscStoneImage = setDiscStoneImage;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    await engine.play([
      { type: 'place_hand_animation', phase: 0, targets: [{ r: 2, col: 3, player: 'black', owner: 'black' }] },
      {
        type: 'spawn',
        phase: 1,
        targets: [{
          r: 2,
          col: 3,
          ownerAfter: 'black',
          cause: 'HYPERACTIVE',
          reason: 'instant_hyperactive_spawn',
          after: { color: 1, special: 'HYPERACTIVE', owner: 'black' }
        }]
      }
    ]);

    expect(global.window.playHandAnimation).toHaveBeenCalled();
    expect(setDiscStoneImage).not.toHaveBeenCalled();
    expect(clearStoneVisualEffectState).toHaveBeenCalledWith(expect.any(dom.window.Element), { skipRenderReset: true });
    expect(applyStoneVisualEffect).toHaveBeenCalledWith(expect.any(dom.window.Element), 'hyperactiveStone', { owner: 'black' });

    dom.window.close();
    delete global.emitBoardUpdate;
    delete global.requestAnimationFrame;
    delete global.getEffectKeyForSpecialType;
    delete global.setDiscStoneImage;
    delete global.clearStoneVisualEffectState;
    delete global.applyStoneVisualEffect;
    delete global.window;
    delete global.document;
  });

  test('observer will spawn playback renders manifest visual and aura', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="4" data-col="5"></div>
          </div>
        </body>
      </html>
    `);
    const setDiscStoneImage = jest.fn();
    const clearStoneVisualEffectState = jest.fn();
    const applyStoneVisualEffect = jest.fn();

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.getEffectKeyForSpecialType = jest.fn((type) => String(type || '').toUpperCase() === 'OBSERVER_WILL' ? 'observerWillStone' : null);
    global.window.setDiscStoneImage = setDiscStoneImage;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    global.getEffectKeyForSpecialType = global.window.getEffectKeyForSpecialType;
    global.setDiscStoneImage = setDiscStoneImage;
    global.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.applyStoneVisualEffect = applyStoneVisualEffect;
    global.emitBoardUpdate = jest.fn();

    const engine = require('../ui/animation-engine.js');
    global.window.getEffectKeyForSpecialType = jest.fn((type) => String(type || '').toUpperCase() === 'OBSERVER_WILL' ? 'observerWillStone' : null);
    global.window.setDiscStoneImage = setDiscStoneImage;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectState;
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    await engine.play([
      {
        type: 'spawn',
        phase: 0,
        targets: [{
          r: 4,
          col: 5,
          ownerAfter: 'black',
          after: {
            color: 1,
            special: 'OBSERVER_WILL',
            timer: 5,
            owner: 'black',
            manifestAura: { owner: 'black' }
          }
        }]
      }
    ]);

    const disc = dom.window.document.querySelector('.cell[data-row="4"][data-col="5"] .disc');
    expect(disc).toBeTruthy();
    expect(applyStoneVisualEffect).toHaveBeenCalledWith(expect.any(dom.window.Element), 'observerWillStone', { owner: 'black' });
    expect(disc.classList.contains('manifest-stone-aura')).toBe(true);
    expect(disc.classList.contains('manifest-stone-aura-black')).toBe(true);
    expect(disc.classList.contains('manifest-stone-aura-white')).toBe(false);

    dom.window.close();
    delete global.emitBoardUpdate;
    delete global.requestAnimationFrame;
    delete global.getEffectKeyForSpecialType;
    delete global.setDiscStoneImage;
    delete global.clearStoneVisualEffectState;
    delete global.applyStoneVisualEffect;
    delete global.window;
    delete global.document;
  });

  test('theory incarnation roulette playback materializes selected special stone', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="0" data-col="0"></div>
            <div class="cell" data-row="0" data-col="1"></div>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    const applyStoneVisualEffect = jest.fn();
    global.window.getEffectKeyForSpecialType = jest.fn((type) => String(type || '').toUpperCase() === 'GHOST' ? 'ghostStone' : null);
    global.window.setDiscStoneImage = jest.fn();
    global.window.clearStoneVisualEffectState = jest.fn();
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    global.getEffectKeyForSpecialType = global.window.getEffectKeyForSpecialType;
    global.setDiscStoneImage = global.window.setDiscStoneImage;
    global.clearStoneVisualEffectState = global.window.clearStoneVisualEffectState;
    global.applyStoneVisualEffect = applyStoneVisualEffect;
    global.emitBoardUpdate = jest.fn();

    const engine = require('../ui/animation-engine.js');
    global.window.getEffectKeyForSpecialType = jest.fn((type) => String(type || '').toUpperCase() === 'GHOST' ? 'ghostStone' : null);
    global.window.applyStoneVisualEffect = applyStoneVisualEffect;
    await engine.executePhase([{
      type: 'theory_incarnation_spawn_roulette',
      phase: 2,
      durationMs: 0,
      materializeMs: 0,
      targets: [{
        r: 0,
        row: 0,
        col: 1,
        owner: 'black',
        ownerAfter: 'black',
        spawnedMarkerType: 'GHOST',
        candidateCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        selectedCell: { row: 0, col: 1 },
        after: { color: 1, special: 'GHOST', timer: 5, owner: 'black' }
      }]
    }]);

    const selectedCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="1"]');
    const disc = selectedCell.querySelector('.disc');

    expect(disc).toBeTruthy();
    expect(applyStoneVisualEffect).toHaveBeenCalledWith(expect.any(dom.window.Element), 'ghostStone', { owner: 'black' });
    expect(selectedCell.classList.contains('theory-spawn-materialize')).toBe(false);

    dom.window.close();
    delete global.emitBoardUpdate;
    delete global.requestAnimationFrame;
    delete global.getEffectKeyForSpecialType;
    delete global.setDiscStoneImage;
    delete global.clearStoneVisualEffectState;
    delete global.applyStoneVisualEffect;
    delete global.window;
    delete global.document;
  });

  test('宝箱 card_use_animation では direct sound を鳴らさない', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      LOCAL_PLAYER_KEY: 'black',
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'TREASURE_BOX_001', type: 'TREASURE_BOX' }))
    };

    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'white', owner: 'white', cardId: 'TREASURE_BOX_001' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();

    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.window;
  });

  test('通常カード card_use_animation でも direct sound を鳴らさない', async () => {
    const cellEl = { classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) };
    global.document = { getElementById: () => cellEl };
    global.window = {
      LOCAL_PLAYER_KEY: 'black',
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'WORK_WILL_001', type: 'WORK_WILL' }))
    };

    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      { type: 'card_use_animation', phase: 1, targets: [{ player: 'white', owner: 'white', cardId: 'WORK_WILL_001' }] }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();

    delete global.CardLogic;
    delete global.SoundEngine;
    delete global.window;
  });

  test('local skip registry がある matching playback sound は 1 回だけ抑止する', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      __skipNextPlaybackSoundUntilByKey: {
        stone_destroy: Date.now() + 1000
      }
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'stone_destroy' }] }
    ]);

    expect(playEffectByKey).not.toHaveBeenCalledWith('stone_destroy');
    expect(global.window.__skipNextPlaybackSoundUntilByKey).toBeUndefined();

    delete global.SoundEngine;
    delete global.window;
  });

  test('local skip registry は対象 key だけ消して他 key は残す', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      __skipNextPlaybackSoundUntilByKey: {
        charge_gain_common: Date.now() + 1000,
        stone_destroy: Date.now() + 2000
      }
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      { type: 'sound_effect', phase: 5, targets: [{ soundKey: 'charge_gain_common' }] }
    ]);

    expect(playEffectByKey).not.toHaveBeenCalledWith('charge_gain_common');
    expect(global.window.__skipNextPlaybackSoundUntilByKey).toMatchObject({
      stone_destroy: expect.any(Number)
    });
    expect(global.window.__skipNextPlaybackSoundUntilByKey.charge_gain_common).toBeUndefined();

    delete global.SoundEngine;
    delete global.window;
  });

  test('local pending preview の card_use は後続 authoritative playback を一度だけ抑止する', async () => {
    global.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({}) }) };
    global.window = {
      playCardUseHandAnimation: jest.fn(() => Promise.resolve())
    };
    const playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };
    const engine = require('../ui/animation-engine.js');
    await engine.executePhase([
      {
        type: 'card_use_animation',
        phase: 1,
        meta: { sourceType: 'card_used', localPendingPreview: true },
        targets: [{ player: 'black', owner: 'black', cardId: 'guard_01' }]
      },
      {
        type: 'sound_effect',
        phase: 1,
        targets: [{ soundKey: 'card_use_button' }],
        meta: { sourceType: 'card_used', localPendingPreview: true }
      }
    ]);

    await engine.executePhase([
      {
        type: 'card_use_animation',
        phase: 1,
        targets: [{ player: 'black', owner: 'black', cardId: 'guard_01' }]
      },
      {
        type: 'sound_effect',
        phase: 1,
        targets: [{ soundKey: 'card_use_button' }]
      }
    ]);

    expect(global.window.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    expect(playEffectByKey).toHaveBeenCalledTimes(1);
    expect(playEffectByKey).toHaveBeenCalledWith('card_use_button');
    expect(global.window.__skipNextCardUseAnimationUntilByKey).toBeUndefined();
    expect(global.window.__skipNextCardUseButtonSoundCount).toBeUndefined();

    delete global.SoundEngine;
    delete global.window;
  });
});
