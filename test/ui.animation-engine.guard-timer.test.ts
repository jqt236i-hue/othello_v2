import { JSDOM } from 'jsdom';
const AnimationConstants = require('../ui/animation-constants.js');
describe('animation-engine guard timer rendering', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.getEffectKeyForSpecialType = () => null;
    global.window.applyStoneVisualEffect = () => {};
  });

  afterEach(() => {
    jest.useRealTimers();
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
    delete global.SoundEngine;
  });

  test('uses only guard-timer for GUARD status updates', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    const oldTimer = document.createElement('div');
    oldTimer.className = 'stone-timer bomb-timer';
    oldTimer.textContent = '3';
    disc.appendChild(oldTimer);

    engine.syncDiscVisual(disc, { color: 1, special: 'GUARD', timer: 2, owner: 'black' });

    const guardTimers = disc.querySelectorAll('.guard-timer');
    expect(guardTimers.length).toBe(1);
    expect(guardTimers[0].textContent).toBe('2');
    expect(disc.querySelector('.bomb-timer')).toBeNull();
    expect(disc.querySelector('.stone-timer')).toBeNull();
  });

  test('uses countdown timer for Strong Will countdown updates', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, { color: 1, special: 'PERMA_PROTECTED', timer: 9, owner: 'black' });

    const countdownTimers = disc.querySelectorAll('.countdown-timer');
    expect(countdownTimers.length).toBe(1);
    expect(countdownTimers[0].textContent).toBe('9');
    expect(disc.querySelector('.guard-timer')).toBeNull();
    expect(disc.querySelector('.special-timer')).toBeNull();
  });

  test('syncDiscVisual marks flip-protected stones with the protection badge', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, { color: 1, special: 'PERMA_PROTECTED', timer: 9, owner: 'black' });

    const badge = disc.querySelector('.stone-flip-protection-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('反');

    engine.syncDiscVisual(disc, { color: 1, special: 'GHOST', timer: 3, owner: 'black' });
    expect(disc.querySelector('.stone-flip-protection-badge')).toBeNull();
  });

  test('syncDiscVisual uses shared special-stone timer classes for body duration labels', () => {
    const engine = require('../ui/animation-engine');
    const SpecialStoneRegistry = require('../shared/special-stone-registry.js');

    for (const item of [
      { type: 'STONE_SALVATION_GOD', timer: 12 },
      { type: 'LIGHTNING', timer: 6 },
      { type: 'METEOR_GOD', timer: 5 }
    ]) {
      const disc = document.createElement('div');
      disc.className = 'disc black';
      engine.syncDiscVisual(disc, { color: 1, special: item.type, timer: item.timer, owner: 'black' });

      const expectedClass = SpecialStoneRegistry.getSpecialStoneTimerClass(item.type, 'special-timer');
      const timer = disc.querySelector(`.${expectedClass}`);
      expect(timer).not.toBeNull();
      expect(timer!.textContent).toBe(String(item.timer));
      if (expectedClass !== 'countdown-timer') {
        expect(disc.querySelector('.countdown-timer')).toBeNull();
      }
    }
  });

  test('syncDiscVisual toggles living will aura without dropping the current special visual', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, { color: 1, special: 'WORK', timer: 4, owner: 'black', livingWillAura: true });
    expect(disc.classList.contains('living-will-aura')).toBe(true);

    engine.syncDiscVisual(disc, { color: 1, special: 'WORK', timer: 4, owner: 'black', livingWillAura: false });
    expect(disc.classList.contains('living-will-aura')).toBe(false);
  });

  test('STATUS_TICK updates timer without crossfade replay', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '0';
    cell.dataset.col = '0';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    const timer = document.createElement('div');
    timer.className = 'guard-timer';
    timer.textContent = '3';
    disc.appendChild(timer);
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_TICK',
      targets: [{ r: 0, col: 0, after: { color: 1, special: 'GUARD', timer: 2, owner: 'black' } }],
      meta: { special: 'GUARD', timer: 2, owner: 'black' }
    });

    const guardTimer = disc.querySelector('.guard-timer');
    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(guardTimer).not.toBeNull();
    expect(guardTimer.textContent).toBe('2');
    expect(disc.querySelectorAll('.guard-timer').length).toBe(1);
  });

  test('延命系の STATUS_TICK は紫セルハイライトを出しつつ timer だけ更新する', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '0';
    cell.dataset.col = '1';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    const timer = document.createElement('div');
    timer.className = 'stone-timer work-timer';
    timer.textContent = '5';
    disc.appendChild(timer);
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_TICK',
      targets: [{ r: 0, col: 1, after: { color: 1, special: 'WORK', timer: 20, owner: 'black' } }],
      meta: { special: 'WORK', timer: 20, owner: 'black', reason: 'extend_life_applied', highlightTone: 'positive' }
    });

    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);
    expect(disc.querySelector('.work-timer').textContent).toBe('20');
  });

  test('腐食の STATUS_TICK は紫セルハイライトを出しつつ timer だけ更新する', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '0';
    cell.dataset.col = '2';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    const timer = document.createElement('div');
    timer.className = 'stone-timer work-timer';
    timer.textContent = '5';
    disc.appendChild(timer);
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_TICK',
      targets: [{ r: 0, col: 2, after: { color: 1, special: 'WORK', timer: 2, owner: 'black' } }],
      meta: { special: 'WORK', timer: 2, owner: 'black', reason: 'corrosion_applied', highlightTone: 'negative' }
    });

    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(disc.querySelector('.work-timer').textContent).toBe('2');
  });

  test('strong_will_promoted の STATUS_APPLIED は紫セルハイライトを一瞬出す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '1';
    cell.dataset.col = '1';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 1, col: 1, after: { color: 1, special: 'ABSOLUTE_PROTECTED', timer: null, owner: 'black' } }],
      meta: {
        special: 'ABSOLUTE_PROTECTED',
        owner: 'black',
        reason: 'strong_will_promoted',
        promotedFrom: 'PERMA_PROTECTED'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalled();
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(cell.classList.contains('effect-target-highlight-positive')).toBe(false);
  });

  test('GUARD の STATUS_APPLIED は紫セルハイライトを一瞬出す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '2';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 2, after: { color: 1, special: 'GUARD', timer: 2, owner: 'black' } }],
      meta: {
        special: 'GUARD',
        owner: 'black',
        timer: 2,
        reason: 'guard_applied'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(cell.classList.contains('effect-target-highlight-positive')).toBe(false);
  });

  test('HYPERACTIVE の STATUS_APPLIED は color=0 でも owner 色を保って crossfade する', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    global.window.getEffectKeyForSpecialType = () => 'hyperactiveStone';
    const engine = require('../ui/animation-engine');
    jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '6';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 6, after: { color: 0, special: 'HYPERACTIVE', timer: 3, owner: 'black' } }],
      meta: {
        special: 'HYPERACTIVE',
        owner: 'black',
        timer: 3,
        reason: 'instant_hyperactive_applied'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledWith(disc, expect.objectContaining({
      effectKey: 'hyperactiveStone',
      owner: 'black',
      newColor: 1,
      fadeIn: true
    }));
    expect(disc.classList.contains('black')).toBe(true);
    expect(disc.classList.contains('white')).toBe(false);
  });

  test('TIME_BOMB の STATUS_APPLIED は紫セルハイライトを一瞬出す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 3, after: { color: 1, special: 'TIME_BOMB', timer: 3, owner: 'black' } }],
      meta: {
        special: 'TIME_BOMB',
        owner: 'black',
        timer: 3,
        reason: 'time_bomb_applied'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(cell.classList.contains('effect-target-highlight-positive')).toBe(false);
  });

  test('AFTERIMAGE_WILL の STATUS_APPLIED は紫セルハイライトを一瞬出す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 3, after: { color: 1, special: 'AFTERIMAGE_WILL', timer: null, owner: 'black' } }],
      meta: {
        special: 'AFTERIMAGE_WILL',
        owner: 'black'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(cell.classList.contains('effect-target-highlight-positive')).toBe(false);
  });

  test('BLOCKADE の STATUS_APPLIED は赤も紫も出さない', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '4';
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 4, after: { color: 0, special: 'BLOCKADE', timer: 3, owner: 'black' } }],
      meta: {
        special: 'BLOCKADE',
        owner: 'black',
        timer: 3
      }
    });

    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
  });

  test('METEOR_HOLE の STATUS_APPLIED は残っていた disc を消す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell has-disc';
    cell.dataset.row = '2';
    cell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 4, after: { color: 0, special: 'METEOR_HOLE', timer: null, owner: 'black' } }],
      meta: {
        special: 'METEOR_HOLE',
        owner: 'black'
      }
    });

    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(cell.querySelector('.disc')).toBeNull();
    expect(cell.classList.contains('has-disc')).toBe(false);
    expect(cell.classList.contains('board-shrink-hole-cell')).toBe(false);
    expect(cell.querySelector('.board-shrink-hole-mark')).toBeNull();
  });

  test('BOARD_FRAME の METEOR_HOLE STATUS_APPLIED は縮小フレーム押し込みマークを作る', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    engine._sleep = jest.fn(() => Promise.resolve());
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell has-disc';
    cell.dataset.row = '0';
    cell.dataset.col = '7';

    const disc = document.createElement('div');
    disc.className = 'disc white special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 0, col: 7, after: { color: 0, special: 'METEOR_HOLE', timer: null, owner: 'black' } }],
      meta: {
        special: 'METEOR_HOLE',
        visualVariant: 'BOARD_FRAME',
        owner: 'black'
      }
    });

    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(cell.classList.contains('blocked-cell')).toBe(true);
    expect(cell.classList.contains('board-shrink-hole-cell')).toBe(true);
    expect(cell.classList.contains('meteor-hole-cell')).toBe(false);
    expect(cell.querySelector('.board-shrink-hole-mark')).toBeTruthy();
    expect(engine._sleep).toHaveBeenCalled();
  });

  test('trap_expired_reveal の STATUS_APPLIED は赤セルハイライトを一瞬出す', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '5';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleStatusChange({
      type: 'status_applied',
      rawType: 'STATUS_APPLIED',
      targets: [{ r: 2, col: 5, after: { color: 1, special: 'TRAP_REVEAL', timer: null, owner: 'black' } }],
      meta: {
        special: 'TRAP_REVEAL',
        owner: 'black',
        reason: 'trap_expired_reveal'
      }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(cell.classList.contains('effect-target-highlight')).toBe(false);
  });

  test('blockedByGhost flip only shows highlight and keeps the disc owner', async () => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const syncSpy = jest.spyOn(engine, 'syncDiscVisual');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '3';
    cell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleFlip({
      targets: [{
        r: 3,
        col: 3,
        ownerBefore: 'black',
        ownerAfter: 'white',
        meta: { blockedByGhost: true }
      }]
    });

    expect(syncSpy).not.toHaveBeenCalled();
    expect(disc.classList.contains('black')).toBe(true);
    expect(disc.classList.contains('white')).toBe(false);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(sleepSpy).toHaveBeenCalled();
  });

  test('blockedByGhost destroy only shows highlight and keeps the disc in place', async () => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '4';
    cell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleDestroy({
      targets: [{
        r: 4,
        col: 4,
        ownerBefore: 'black',
        cause: 'DESTROY_ONE_STONE',
        reason: 'destroy_one_stone',
        meta: { blockedByGhost: true }
      }]
    });

    expect(cell.querySelector('.disc')).toBe(disc);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
  });

  test('proliferated destroy only shows highlight and keeps the disc in place', async () => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '5';
    cell.dataset.col = '5';

    const disc = document.createElement('div');
    disc.className = 'disc white';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleDestroy({
      targets: [{
        r: 5,
        col: 5,
        ownerBefore: 'white',
        cause: 'DESTROY_ONE_STONE',
        reason: 'destroy_one_stone',
        meta: { proliferated: true, special: 'PROLIFERATION' }
      }]
    });

    expect(cell.querySelector('.disc')).toBe(disc);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
  });

  test('regenerated destroy only shows highlight and keeps the disc in place', async () => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '5';
    cell.dataset.col = '6';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleDestroy({
      targets: [{
        r: 5,
        col: 6,
        ownerBefore: 'black',
        cause: 'DESTROY_ONE_STONE',
        reason: 'destroy_selected',
        meta: { regenerated: true, special: 'REGEN', owner: 'black', timer: 2 }
      }]
    });

    expect(cell.querySelector('.disc')).toBe(disc);
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
  });

  test.each([
    ['GLUTTONOUS_WILL', 'gluttonous_eat'],
    ['WILL_HUNTER_KING', 'will_hunter_king_slash']
  ])('proliferated %s destroy keeps highlight visible through overlap midpoint', async (cause, reason) => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '5';
    cell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc white';
    cell.appendChild(disc);
    board.appendChild(cell);
    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');

    await engine.handleDestroy({
      targets: [{
        r: 5,
        col: 4,
        ownerBefore: 'white',
        cause,
        reason,
        meta: { proliferated: true, special: 'PROLIFERATION' }
      }]
    });

    const minimumVisibleMs = Math.max(120, Math.floor(AnimationConstants.MOVE_MS / 2));
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy.mock.calls.some((args) => Number(args[0]) >= (minimumVisibleMs - 20))).toBe(true);
  });

  test.each([
    ['GLUTTONOUS_WILL', 'gluttonous_eat'],
    ['WILL_HUNTER_KING', 'will_hunter_king_slash']
  ])('ghost-blocked %s destroy keeps highlight visible through overlap midpoint', async (cause, reason) => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '5';
    cell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc white';
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleDestroy({
      targets: [{
        r: 5,
        col: 3,
        ownerBefore: 'white',
        cause,
        reason,
        meta: { blockedByGhost: true, special: 'GHOST', timer: 5, owner: 'white' }
      }]
    });

    const minimumVisibleMs = Math.max(120, Math.floor(AnimationConstants.MOVE_MS / 2));
    expect(sleepSpy.mock.calls.some((args) => Number(args[0]) >= (minimumVisibleMs - 20))).toBe(true);
  });

  test('regenerated will_hunter destroy keeps highlight visible through overlap midpoint', async () => {
    const engine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '5';
    cell.dataset.col = '2';

    const disc = document.createElement('div');
    disc.className = 'disc white';
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.handleDestroy({
      targets: [{
        r: 5,
        col: 2,
        ownerBefore: 'white',
        cause: 'WILL_HUNTER_KING',
        reason: 'will_hunter_king_slash',
        meta: { regenerated: true, special: 'REGEN', owner: 'white', timer: 2 }
      }]
    });

    const minimumVisibleMs = Math.max(120, Math.floor(AnimationConstants.MOVE_MS / 2));
    expect(sleepSpy.mock.calls.some((args) => Number(args[0]) >= (minimumVisibleMs - 20))).toBe(true);
  });

  test('loss_will_reset の STATUS_REMOVED は crossfadeDiscToState を使う', async () => {
    const crossfadeSpy = jest.fn(() => Promise.resolve());
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '0';
    cell.dataset.col = '0';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');
    const discCrossfadeSpy = jest.spyOn(engine, 'crossfadeDiscToState').mockResolvedValue(undefined);

    await engine.handleStatusChange({
      type: 'status_removed',
      rawType: 'STATUS_REMOVED',
      targets: [{ r: 0, col: 0, after: { color: 1, special: null, timer: null, owner: 'black' } }],
      meta: { special: 'GUARD', reason: 'loss_will_reset' }
    });

    expect(discCrossfadeSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
  });

  test('freeze duration_end の STATUS_REMOVED は freeze overlay fade を使う', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell frozen-cell';
    cell.dataset.row = '0';
    cell.dataset.col = '0';

    const freezeMark = document.createElement('div');
    freezeMark.className = 'freeze-mark';
    cell.appendChild(freezeMark);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');
    const freezeFadeSpy = jest.spyOn(engine, 'fadeOutFreezeOverlay').mockResolvedValue(undefined);

    await engine.handleStatusChange({
      type: 'status_removed',
      rawType: 'STATUS_REMOVED',
      targets: [{ r: 0, col: 0, after: { color: 0, special: null, timer: null, owner: null } }],
      meta: { special: 'FREEZE', reason: 'duration_end' }
    });

    expect(freezeFadeSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
  });

  test('special stone duration_end の STATUS_REMOVED は通常石へクロスフェードする', async () => {
    const crossfadeSpy = jest.fn(async (disc, opts = {}) => {
      disc.dataset.effectKey = String(opts.effectKey || '');
    });
    jest.doMock('../ui/stone-visuals', () => ({
      crossfadeStoneVisual: crossfadeSpy
    }));
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '2';
    cell.dataset.col = '2';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    cell.appendChild(disc);
    board.appendChild(cell);

    const addSpy = jest.spyOn(cell.classList, 'add');
    const removeSpy = jest.spyOn(cell.classList, 'remove');
    await engine.handleStatusChange({
      type: 'status_removed',
      rawType: 'STATUS_REMOVED',
      targets: [{ r: 2, col: 2, after: { color: 1, special: null, timer: null, owner: 'black' } }],
      meta: { special: 'TIME_STOP', reason: 'duration_end' }
    });

    expect(crossfadeSpy).toHaveBeenCalledTimes(1);
    expect(crossfadeSpy.mock.calls[0][1]).toEqual(expect.objectContaining({
      effectKey: null,
      owner: 'black',
      newColor: 1,
      fadeIn: false
    }));
    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
  });

  test('manifest_ending は通常石化と暗転を同時に開始し同 phase の他演出を待たせる', async () => {
    jest.useFakeTimers();
    global.SoundEngine = { syncManifestBgmOverride: jest.fn() };
    global.window.PLAYBACK_WATCHDOG_MS = 30000;

    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell has-disc';
    cell.dataset.row = '3';
    cell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone manifest-stone-aura manifest-stone-aura-black';
    disc.style.setProperty('--special-stone-image', 'url("manifest.png")');
    cell.appendChild(disc);
    board.appendChild(cell);

    const logSpy = jest.spyOn(engine, 'log').mockImplementation(() => {});
    const playPromise = engine.play([
      {
        type: 'manifest_ending',
        phase: 1,
        targets: [{
          r: 3,
          col: 4,
          after: { color: 1, special: null, timer: null, owner: 'black' }
        }]
      },
      {
        type: 'log',
        phase: 1,
        message: 'same phase should wait'
      }
    ]);

    await Promise.resolve();

    expect(disc.classList.contains('manifest-stone-aura')).toBe(false);
    expect(disc.classList.contains('special-stone')).toBe(false);
    const overlay = document.querySelector('.manifest-ending-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.getPropertyValue('--manifest-ending-duration')).toBe('2000ms');
    expect(overlay.style.getPropertyValue('--manifest-ending-opacity')).toBe('0.6');
    expect((global.SoundEngine.syncManifestBgmOverride as jest.Mock)).toHaveBeenCalledWith(
      null,
      null,
      { transitionMs: 2000 }
    );
    expect(board.classList.contains('playback-locked')).toBe(true);
    expect(logSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1999);
    await Promise.resolve();
    expect(logSpy).not.toHaveBeenCalled();
    expect(document.querySelector('.manifest-ending-overlay')).toBeTruthy();

    jest.advanceTimersByTime(1);
    await playPromise;

    expect(logSpy).toHaveBeenCalledWith('same phase should wait');
    expect(document.querySelector('.manifest-ending-overlay')).toBeNull();
    expect(board.classList.contains('playback-locked')).toBe(false);

    jest.useRealTimers();
    delete global.SoundEngine;
  });

  test('fadeOutFreezeOverlay removes frozen-cell visuals after fade', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell frozen-cell';
    cell.dataset.row = '1';
    cell.dataset.col = '1';

    const freezeMark = document.createElement('div');
    freezeMark.className = 'freeze-mark';
    cell.appendChild(freezeMark);
    board.appendChild(cell);

    await engine.fadeOutFreezeOverlay(cell, 1);

    expect(cell.classList.contains('frozen-cell')).toBe(false);
    expect(cell.querySelector('.freeze-mark')).toBeNull();
  });

  test('play accepts STATUS_TICK targets with row/col keys', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = '0';
    cell.dataset.col = '0';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    const timer = document.createElement('div');
    timer.className = 'guard-timer';
    timer.textContent = '3';
    disc.appendChild(timer);
    cell.appendChild(disc);
    board.appendChild(cell);

    await engine.play([
      {
        type: 'status_applied',
        rawType: 'STATUS_TICK',
        phase: 1,
        targets: [{ row: 0, col: 0, after: { color: 1, special: 'GUARD', timer: 2, owner: 'black' } }],
        meta: { special: 'GUARD', timer: 2, owner: 'black' }
      }
    ]);

    const guardTimer = disc.querySelector('.guard-timer');
    expect(guardTimer).not.toBeNull();
    expect(guardTimer.textContent).toBe('2');
  });

  test('play accepts MOVE targets with from/to row keys', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    window.DISABLE_ANIMATIONS = true;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '0';
    fromCell.dataset.col = '0';
    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '0';
    toCell.dataset.col = '1';
    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    await engine.play([
      {
        type: 'move',
        phase: 1,
        targets: [
          {
            from: { row: 0, col: 0 },
            to: { row: 0, col: 1 },
            ownerAfter: 'black',
            after: { color: 1, special: null, timer: null }
          }
        ]
      }
    ]);

    expect(fromCell.querySelector('.disc')).toBeNull();
    expect(toCell.querySelector('.disc')).not.toBeNull();
  });

  test('move duration is fixed regardless of distance for strong wind / ultimate hyperactive / position swap', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    const animateMock = jest.fn(() => ({
      addEventListener: (type, cb) => {
        if (type === 'finish') setTimeout(cb, 0);
      },
      removeEventListener: () => {},
      finished: Promise.resolve()
    }));
    if (proto) proto.animate = animateMock;

    const setRect = (el, row, col) => {
      const left = col * 100;
      const top = row * 100;
      el.getBoundingClientRect = () => ({
        left,
        top,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: top + 100
      });
    };

    const makeCell = (row, col) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      setRect(cell, row, col);
      board.appendChild(cell);
      return cell;
    };

    const assertFixedDuration = async (cause, reason, expectedDuration) => {
      board.innerHTML = '';

      const shortFrom = makeCell(0, 0);
      const shortTo = makeCell(0, 1);
      const shortDisc = document.createElement('div');
      shortDisc.className = 'disc black';
      shortFrom.appendChild(shortDisc);

      await engine.handleMove({
        type: 'move',
        targets: [{
          from: { r: 0, col: 0 },
          to: { r: 0, col: 1 },
          ownerAfter: 'black',
          cause,
          reason
        }]
      });

      const shortDuration = animateMock.mock.calls[0][1].duration;
      animateMock.mockClear();

      const longFrom = makeCell(1, 0);
      const longTo = makeCell(1, 5);
      const longDisc = document.createElement('div');
      longDisc.className = 'disc black';
      longFrom.appendChild(longDisc);

      await engine.handleMove({
        type: 'move',
        targets: [{
          from: { r: 1, col: 0 },
          to: { r: 1, col: 5 },
          ownerAfter: 'black',
          cause,
          reason
        }]
      });

      const longDuration = animateMock.mock.calls[0][1].duration;
      animateMock.mockClear();

      expect(shortDuration).toBe(longDuration);
      expect(shortDuration).toBe(expectedDuration);
      const shortFinalDisc = shortTo.querySelector('.disc');
      const longFinalDisc = longTo.querySelector('.disc');
      expect(shortFinalDisc).not.toBeNull();
      expect(longFinalDisc).not.toBeNull();
      expect(shortFinalDisc.style.visibility).not.toBe('hidden');
      expect(longFinalDisc.style.visibility).not.toBe('hidden');
      expect(shortFinalDisc.classList.contains('stone-hidden')).toBe(false);
      expect(shortFinalDisc.classList.contains('stone-hidden-all')).toBe(false);
      expect(longFinalDisc.classList.contains('stone-hidden')).toBe(false);
      expect(longFinalDisc.classList.contains('stone-hidden-all')).toBe(false);
      expect(shortFinalDisc.style.opacity).not.toBe('0');
      expect(longFinalDisc.style.opacity).not.toBe('0');
    };

    try {
      await assertFixedDuration('STRONG_WIND_WILL', 'strong_wind_move', 400);
      await assertFixedDuration('SUPER_BUOYANCY_WILL', 'super_buoyancy_move', 400);
      await assertFixedDuration('SUPER_GRAVITY_WILL', 'super_gravity_move', 400);
      await assertFixedDuration('ULTIMATE_REVERSE_DRAGON', 'ultimate_reverse_dragon_move', 400);
      await assertFixedDuration('ULTIMATE_DESTROY_GOD', 'ultimate_destroy_god_move', 400);
      await assertFixedDuration('ULTIMATE_HYPERACTIVE_GOD', 'ultimate_hyperactive_move', 400);
      await assertFixedDuration('POSITION_SWAP_WILL', 'position_swap', 320);
    } finally {
      if (proto) proto.animate = originalAnimate;
    }
  });

  test('move fallback keeps destination white disc visible when animate API is unavailable', async () => {
    const board = document.getElementById('board')!;
    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '0';
    fromCell.dataset.col = '0';
    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '0';
    toCell.dataset.col = '1';
    const movedDisc = document.createElement('div');
    movedDisc.className = 'disc white';
    toCell.appendChild(movedDisc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    if (proto) proto.animate = undefined;

    try {
      const engine = require('../ui/animation-engine');
      await engine.play([
        {
          type: 'move',
          phase: 1,
          targets: [
            {
              from: { row: 0, col: 0 },
              to: { row: 0, col: 1 },
              ownerAfter: 'white',
              cause: 'STRONG_WIND_WILL',
              reason: 'strong_wind_move'
            }
          ]
        }
      ]);
    } finally {
      if (proto) proto.animate = originalAnimate;
    }

    const finalDisc = toCell.querySelector('.disc');
    expect(finalDisc).not.toBeNull();
    expect(finalDisc.classList.contains('white')).toBe(true);
    expect(finalDisc.style.visibility).not.toBe('hidden');
  });

  test.each([
    ['CLONE_WILL', 'clone_spawn'],
    ['PROLIFERATION_WILL', 'proliferation_spawn']
  ])('%s after-state playback keeps purple highlight on destination until move finishes', async (cause, reason) => {
    const board = document.getElementById('board')!;
    const setRect = (el, row, col) => {
      const left = col * 100;
      const top = row * 100;
      el.getBoundingClientRect = () => ({
        left,
        top,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: top + 100
      });
    };
    const makeCell = (row, col) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      setRect(cell, row, col);
      board.appendChild(cell);
      return cell;
    };

    const fromCell = makeCell(2, 2);
    const toCell = makeCell(2, 3);
    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc black';
    fromCell.appendChild(sourceDisc);
    const finalDisc = document.createElement('div');
    finalDisc.className = 'disc black';
    toCell.appendChild(finalDisc);
    const addToSpy = jest.spyOn(toCell.classList, 'add');
    const removeToSpy = jest.spyOn(toCell.classList, 'remove');

    let finishAnimation = null;
    const finished = new Promise((resolve) => {
      finishAnimation = resolve;
    });

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    if (proto) {
      proto.animate = () => ({
        addEventListener: (type, cb) => {
          if (type === 'finish') {
            finished.then(cb);
          }
        },
        removeEventListener: () => {},
        finished
      });
    }

    try {
      const engine = require('../ui/animation-engine');
      const playbackPromise = engine.handleMove({
        type: 'move',
        targets: [{
          from: { r: 2, col: 2 },
          to: { r: 2, col: 3 },
          ownerAfter: 'black',
          cause,
          reason,
          clone: true,
          after: { color: 1, special: null, timer: null, owner: 'black' }
        }]
      });

      await Promise.resolve();
      expect(toCell.querySelector('.disc')).toBe(finalDisc);
      expect(finalDisc.style.visibility).toBe('hidden');

      finishAnimation();
      await playbackPromise;
    } finally {
      if (proto) proto.animate = originalAnimate;
    }

    expect(fromCell.querySelector('.disc')).toBe(sourceDisc);
    expect(finalDisc.style.visibility).not.toBe('hidden');
    expect(toCell.querySelector('.disc')).toBe(finalDisc);
    expect(addToSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeToSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addToSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeToSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    addToSpy.mockRestore();
    removeToSpy.mockRestore();
  });

  test.each([
    ['HYPERACTIVE', 'hyperactive_move'],
    ['ULTIMATE_HYPERACTIVE_GOD', 'ultimate_hyperactive_step_move'],
    ['ULTIMATE_REVERSE_DRAGON', 'ultimate_reverse_dragon_move'],
    ['ULTIMATE_DESTROY_GOD', 'ultimate_destroy_god_move']
  ])('%s after-state playback hides destination disc during hyperactive-family move', async (cause, reason) => {
    const board = document.getElementById('board')!;
    const setRect = (el, row, col) => {
      const left = col * 100;
      const top = row * 100;
      el.getBoundingClientRect = () => ({
        left,
        top,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: top + 100
      });
    };
    const makeCell = (row, col) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      setRect(cell, row, col);
      board.appendChild(cell);
      return cell;
    };

    const fromCell = makeCell(1, 0);
    const toCell = makeCell(2, 0);
    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc white special-stone';
    fromCell.appendChild(sourceDisc);
    const finalDisc = document.createElement('div');
    finalDisc.className = 'disc white special-stone';
    toCell.appendChild(finalDisc);

    let finishAnimation = null;
    const finished = new Promise((resolve) => {
      finishAnimation = resolve;
    });

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    if (proto) {
      proto.animate = () => ({
        addEventListener: (type, cb) => {
          if (type === 'finish') {
            finished.then(cb);
          }
        },
        removeEventListener: () => {},
        finished
      });
    }

    try {
      const engine = require('../ui/animation-engine');
      const playbackPromise = engine.handleMove({
        type: 'move',
        targets: [{
          from: { r: 1, col: 0 },
          to: { r: 2, col: 0 },
          ownerAfter: 'white',
          cause,
          reason,
          after: { color: -1, special: 'HYPERACTIVE', timer: 1, owner: 'white' }
        }]
      });

      await Promise.resolve();
      expect(toCell.querySelector('.disc')).toBe(finalDisc);
      expect(finalDisc.style.visibility).toBe('hidden');

      finishAnimation();
      await playbackPromise;
    } finally {
      if (proto) proto.animate = originalAnimate;
    }

    expect(finalDisc.style.visibility).not.toBe('hidden');
    expect(toCell.querySelector('.disc')).toBeTruthy();
  });

  test.each([
    ['SUPER_BUOYANCY_WILL', 'super_buoyancy_move', 'super_buoyancy_collision'],
    ['SUPER_GRAVITY_WILL', 'super_gravity_move', 'super_gravity_collision'],
    ['SUPER_ATTRACTION_WILL', 'super_attraction_move', 'super_attraction_collision']
  ])('%s destination collision keeps final disc visible during after-state playback', async (cause, moveReason, destroyReason) => {
    const board = document.getElementById('board')!;
    const setRect = (el, row, col) => {
      const left = col * 100;
      const top = row * 100;
      el.getBoundingClientRect = () => ({
        left,
        top,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: top + 100
      });
    };
    const makeCell = (row, col) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      setRect(cell, row, col);
      board.appendChild(cell);
      return cell;
    };

    const fromCell = makeCell(4, 4);
    const toCell = makeCell(1, 4);
    const finalDisc = document.createElement('div');
    finalDisc.className = 'disc black';
    toCell.appendChild(finalDisc);

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    if (proto) {
      proto.animate = () => ({
        addEventListener: (type, cb) => {
          if (type === 'finish') setTimeout(cb, 400);
        },
        removeEventListener: () => {},
        finished: new Promise((resolve) => setTimeout(resolve, 400))
      });
    }

    try {
      const engine = require('../ui/animation-engine');
      await engine.executePhase([
        {
          type: 'destroy',
          targets: [{
            r: 1,
            col: 4,
            cause,
            reason: destroyReason,
            ownerBefore: 'white',
            meta: { collisionProgress: 0.88 }
          }]
        },
        {
          type: 'move',
          targets: [{
            from: { r: 4, col: 4 },
            to: { r: 1, col: 4 },
            ownerAfter: 'black',
            cause,
            reason: moveReason,
            after: { color: 1, special: null, timer: null, owner: 'black' }
          }]
        }
      ]);
    } finally {
      if (proto) proto.animate = originalAnimate;
    }

    expect(fromCell.querySelector('.disc')).toBeNull();
    const visibleDisc = toCell.querySelector('.disc');
    expect(visibleDisc).not.toBeNull();
    expect(visibleDisc.classList.contains('black')).toBe(true);
    expect(visibleDisc.style.visibility).not.toBe('hidden');
    expect(visibleDisc.style.opacity).not.toBe('0');
    expect(visibleDisc.classList.contains('destroy-fade')).toBe(false);
  });

  test('TELEPORT_WILL move appears instantly at destination without translate trajectory', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '1';
    fromCell.dataset.col = '1';
    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '4';
    toCell.dataset.col = '4';
    const disc = document.createElement('div');
    disc.className = 'disc black';
    disc.animate = jest.fn(() => ({
      addEventListener: (type, cb) => {
        if (type === 'finish') setTimeout(cb, 0);
      },
      removeEventListener: () => {},
      finished: Promise.resolve()
    }));
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    await engine.play([
      {
        type: 'move',
        phase: 1,
        targets: [
          {
            from: { row: 1, col: 1 },
            to: { row: 4, col: 4 },
            ownerAfter: 'black',
            cause: 'TELEPORT_WILL',
            reason: 'teleport_move',
            after: { color: 1, special: null, timer: null }
          }
        ]
      }
    ]);

    expect(fromCell.querySelector('.disc')).toBeNull();
    expect(toCell.querySelector('.disc')).not.toBeNull();
    expect(disc.animate).toHaveBeenCalledTimes(1);

    const keyframes = disc.animate.mock.calls[0][0];
    expect(JSON.stringify(keyframes)).toContain('scale');
    expect(JSON.stringify(keyframes)).not.toContain('translate(');
  });

  test('sniper expiration destroy does not trigger projectile animation when source is null', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '3';
    targetCell.dataset.col = '3';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc black';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const projectileSpy = jest.spyOn(engine, 'animateSniperProjectile').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        cause: 'SNIPER_WILL',
        reason: 'anchor_expired',
        sourceRow: null,
        sourceCol: null
      }]
    });

    expect(projectileSpy).not.toHaveBeenCalled();
    projectileSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('sniper shot destroy triggers projectile animation when source exists', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const projectileSpy = jest.spyOn(engine, 'animateSniperProjectile').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(projectileSpy).toHaveBeenCalledTimes(1);
    projectileSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('sniper shot still fires projectile when target disc was already removed', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const projectileSpy = jest.spyOn(engine, 'animateSniperProjectile').mockResolvedValue(undefined);
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(projectileSpy).toHaveBeenCalledTimes(1);
    projectileSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test.each([
    ['destroy dragon breath legacy cause', 'DESTROY_DRAGON', 'destroy_dragon_breath', 'animateDestroyDragonBreath'],
    ['destroy dragon breath', 'DESTROY_DRAGON_WILL', 'destroy_dragon_breath', 'animateDestroyDragonBreath'],
    ['ultimate destroy god lightning', 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', 'animateUdgLightningStrike'],
    ['lightning will strike', 'LIGHTNING_WILL', 'lightning_destroyed', 'animateUdgLightningStrike'],
    ['meteor god black beam', 'METEOR_GOD', 'meteor_god_cell_destroy', 'animateMeteorGodBlackBeam'],
    ['will hunter king slash', 'WILL_HUNTER_KING', 'will_hunter_king_slash', 'animateWillHunterKingSlash'],
    ['robot vacuum suction', 'ROBOT_VACUUM', 'robot_vacuum_suck', 'animateRobotVacuumSuction']
  ])('%s still plays source animation when target disc was already removed', async (_label, cause, reason, methodName) => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const sourceAnimationSpy = jest.spyOn(engine, methodName).mockResolvedValue(undefined);
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        ownerBefore: 'black',
        cause,
        reason,
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(sourceAnimationSpy).toHaveBeenCalledTimes(1);
    sourceAnimationSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('generic card destroy still shows a ghost fade when target disc was already removed', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    board.appendChild(targetCell);

    const createDiscSpy = jest.spyOn(engine, 'createDisc');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        reason: 'bomb_explosion'
      }]
    });

    expect(createDiscSpy).toHaveBeenCalledWith(expect.objectContaining({
      color: 1,
      owner: 'black'
    }));
    createDiscSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('robot vacuum destroy triggers suction animation and skips fade-out path', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';
    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc black special-stone';
    sourceCell.appendChild(sourceDisc);

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const suctionSpy = jest.spyOn(engine, 'animateRobotVacuumSuction').mockImplementation(async () => {
      const liveDisc = targetCell.querySelector('.disc');
      expect(liveDisc).not.toBeNull();
      expect(liveDisc.style.visibility).not.toBe('hidden');
    });

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        cause: 'ROBOT_VACUUM',
        reason: 'robot_vacuum_suck',
        ownerBefore: 'white',
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(suctionSpy).toHaveBeenCalledTimes(1);
    expect(global.animateFadeOutAt).not.toHaveBeenCalled();
    expect(targetCell.querySelector('.disc')).toBeNull();

    suctionSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('gluttonous eat destroy skips fade and target is replaced by move', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;
    window.DISABLE_ANIMATIONS = true;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';
    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc black special-stone';
    sourceCell.appendChild(sourceDisc);

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '1';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 1,
        col: 2,
        cause: 'GLUTTONOUS_WILL',
        reason: 'gluttonous_eat',
        ownerBefore: 'white',
        sourceRow: 1,
        sourceCol: 1,
        meta: { sourceRow: 1, sourceCol: 1, bite: true }
      }]
    });

    expect(global.animateFadeOutAt).not.toHaveBeenCalled();
    expect(targetCell.querySelector('.disc.white')).not.toBeNull();

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 1, col: 1 },
        to: { r: 1, col: 2 },
        cause: 'GLUTTONOUS_WILL',
        reason: 'gluttonous_eat_move',
        ownerAfter: 'black',
        after: { color: 1, special: 'GLUTTONOUS', timer: null, owner: 'black' }
      }]
    });

    expect(sourceCell.querySelector('.disc')).toBeNull();
    expect(targetCell.querySelector('.disc.black')).not.toBeNull();

    delete global.animateFadeOutAt;
    delete window.DISABLE_ANIMATIONS;
  });

  test('robot vacuum anchor_expired destroy does not use suction animation', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '4';
    targetCell.dataset.col = '4';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc black special-stone';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const suctionSpy = jest.spyOn(engine, 'animateRobotVacuumSuction').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 4,
        col: 4,
        cause: 'ROBOT_VACUUM',
        reason: 'anchor_expired',
        ownerBefore: 'black',
        sourceRow: 4,
        sourceCol: 4
      }]
    });

    expect(suctionSpy).not.toHaveBeenCalled();
    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(1);
    expect(targetCell.querySelector('.disc')).toBeNull();

    suctionSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('udg destroy triggers lightning animation when source exists', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const lightningSpy = jest.spyOn(engine, 'animateUdgLightningStrike').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        cause: 'ULTIMATE_DESTROY_GOD',
        reason: 'udg_destroyed',
        ownerBefore: 'white',
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(lightningSpy).toHaveBeenCalledTimes(1);
    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(1);
    lightningSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('udg anchor_expired destroy does not trigger lightning animation', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '4';
    targetCell.dataset.col = '4';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc black special-stone';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const lightningSpy = jest.spyOn(engine, 'animateUdgLightningStrike').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 4,
        col: 4,
        cause: 'ULTIMATE_DESTROY_GOD',
        reason: 'anchor_expired',
        ownerBefore: 'black',
        sourceRow: 4,
        sourceCol: 4
      }]
    });

    expect(lightningSpy).not.toHaveBeenCalled();
    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(1);
    lightningSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('lightning_will destroy triggers lightning animation when source exists', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const sourceCell = document.createElement('div');
    sourceCell.className = 'cell';
    sourceCell.dataset.row = '1';
    sourceCell.dataset.col = '1';

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);

    board.appendChild(sourceCell);
    board.appendChild(targetCell);

    const lightningSpy = jest.spyOn(engine, 'animateUdgLightningStrike').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 2,
        col: 2,
        cause: 'LIGHTNING_WILL',
        reason: 'lightning_destroyed',
        ownerBefore: 'white',
        sourceRow: 1,
        sourceCol: 1
      }]
    });

    expect(lightningSpy).toHaveBeenCalledTimes(1);
    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(1);
    lightningSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('lightning_will anchor_expired destroy does not trigger lightning animation', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '4';
    targetCell.dataset.col = '4';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc black special-stone';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const lightningSpy = jest.spyOn(engine, 'animateUdgLightningStrike').mockResolvedValue(undefined);

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 4,
        col: 4,
        cause: 'LIGHTNING_WILL',
        reason: 'anchor_expired',
        ownerBefore: 'black',
        sourceRow: 4,
        sourceCol: 4
      }]
    });

    expect(lightningSpy).not.toHaveBeenCalled();
    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(1);
    lightningSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('card-effect flip applies and clears purple cell highlight during animation', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '2';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');

    await engine.handleFlip({
      type: 'flip',
      targets: [{
        r: 2,
        col: 2,
        cause: 'TEMPT_WILL',
        reason: 'tempt_applied',
        ownerBefore: 'white',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(targetCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    sleepSpy.mockRestore();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('non-card-effect flip does not apply effect cell highlight', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '3';
    targetCell.dataset.col = '3';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const addSpy = jest.spyOn(targetCell.classList, 'add');

    await engine.handleFlip({
      type: 'flip',
      targets: [{
        r: 3,
        col: 3,
        cause: 'SYSTEM',
        reason: 'standard_flip',
        ownerBefore: 'white',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(targetCell.classList.contains('effect-target-highlight')).toBe(false);

    sleepSpy.mockRestore();
    addSpy.mockRestore();
  });

  test('card-effect destroy applies and clears red cell highlight', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '5';
    targetCell.dataset.col = '5';
    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    targetCell.appendChild(targetDisc);
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 5,
        col: 5,
        cause: 'DESTROY_ONE_STONE',
        reason: 'destroy_one_stone',
        ownerBefore: 'white'
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(targetCell.classList.contains('effect-target-highlight')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('destroy highlight still applies red cell highlight when disc was already removed', async () => {
    global.animateFadeOutAt = jest.fn(() => Promise.resolve());
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '3';
    targetCell.dataset.col = '3';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');

    await engine.handleDestroy({
      type: 'destroy',
      targets: [{
        r: 3,
        col: 3,
        cause: 'DESTROY_ONE_STONE',
        reason: 'destroy_selected',
        ownerBefore: 'black'
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(targetCell.classList.contains('effect-target-highlight')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    delete global.animateFadeOutAt;
  });

  test('breeding spawn applies and clears purple cell highlight on spawn moment', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '1';
    targetCell.dataset.col = '6';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const fadeSpy = jest.spyOn(engine, 'getSpawnFadeInMs').mockReturnValue(0);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 1,
        col: 6,
        cause: 'BREEDING',
        reason: 'breeding_spawn',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(targetCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    fadeSpy.mockRestore();
  });

  test('free placement spawn applies and clears purple cell highlight', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '0';
    targetCell.dataset.col = '7';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 0,
        col: 7,
        cause: 'FREE_PLACEMENT',
        reason: 'free_placement_place',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(targetCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('Seed Will sprout spawn keeps purple cell highlight visible briefly', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '1';
    targetCell.dataset.col = '1';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 1,
        col: 1,
        cause: 'SEED_WILL',
        reason: 'seed_sprout',
        ownerAfter: 'black',
        meta: {
          spawnIntent: 'normal_spawn',
          seedSprout: true,
          seedOwner: 'black'
        },
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(sleepSpy).toHaveBeenCalled();
    expect(targetCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('Equality Will spawn keeps purple cell highlight visible briefly', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '2';
    targetCell.dataset.col = '5';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 2,
        col: 5,
        cause: 'EQUALITY_WILL',
        reason: 'equality_will_spawn',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('Salvation Will spawn keeps purple cell highlight visible briefly', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '3';
    targetCell.dataset.col = '6';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 3,
        col: 6,
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('Stone Salvation God revive keeps purple cell highlight visible briefly', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '3';
    targetCell.dataset.col = '6';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 3,
        col: 6,
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('Reinforcement Will spawn keeps purple cell highlight visible briefly', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '4';
    targetCell.dataset.col = '6';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);

    await engine.handleSpawn({
      type: 'spawn',
      targets: [{
        r: 4,
        col: 6,
        cause: 'REINFORCEMENT_WILL',
        reason: 'reinforcement_will_spawn',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight-spawn');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(sleepSpy).toHaveBeenCalled();
    expect(sleepSpy.mock.calls.some(([ms]) => Number(ms) >= (AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS - 20))).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    sleepSpy.mockRestore();
  });

  test('free placement place event applies and clears purple cell highlight', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '0';
    targetCell.dataset.col = '6';
    board.appendChild(targetCell);

    const addSpy = jest.spyOn(targetCell.classList, 'add');
    const removeSpy = jest.spyOn(targetCell.classList, 'remove');

    await engine.handlePlace({
      type: 'place',
      targets: [{
        r: 0,
        col: 6,
        cause: 'FREE_PLACEMENT',
        reason: 'free_placement_place',
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(targetCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('normal place event inserts the disc immediately without fade setup', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const targetCell = document.createElement('div');
    targetCell.className = 'cell';
    targetCell.dataset.row = '1';
    targetCell.dataset.col = '1';
    board.appendChild(targetCell);

    await engine.handlePlace({
      type: 'place',
      targets: [{
        r: 1,
        col: 1,
        ownerAfter: 'black',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    const disc = targetCell.querySelector('.disc');
    expect(disc).not.toBeNull();
    expect(disc.classList.contains('stone-hidden')).toBe(false);
    expect(disc.classList.contains('stone-hidden-all')).toBe(false);
    expect(disc.classList.contains('stone-instant')).toBe(false);
    expect(disc.style.opacity).toBe('');
    expect(disc.style.transition).toBe('');
  });

  test('strong wind move applies and clears purple cell highlight at destination', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '2';
    fromCell.dataset.col = '2';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '2';
    toCell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc white';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addSpy = jest.spyOn(toCell.classList, 'add');
    const removeSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: 2, col: 3 },
        ownerAfter: 'white',
        cause: 'STRONG_WIND_WILL',
        reason: 'strong_wind_move'
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('gluttonous eat move applies and clears purple cell highlight at destination', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '3';
    fromCell.dataset.col = '3';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '3';
    toCell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addSpy = jest.spyOn(toCell.classList, 'add');
    const removeSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 3, col: 3 },
        to: { r: 3, col: 4 },
        ownerAfter: 'black',
        cause: 'GLUTTONOUS_WILL',
        reason: 'gluttonous_eat_move',
        after: { color: 1, special: 'GLUTTONOUS', timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('gluttonous eat phase keeps red highlight on move target without destroy/remove race', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '6';
    fromCell.dataset.col = '1';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '6';
    toCell.dataset.col = '2';

    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc black special-stone';
    fromCell.appendChild(sourceDisc);

    const targetDisc = document.createElement('div');
    targetDisc.className = 'disc white';
    toCell.appendChild(targetDisc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addSpy = jest.spyOn(toCell.classList, 'add');
    const removeSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.executePhase([
      {
        type: 'destroy',
        targets: [{
          r: 6,
          col: 2,
          cause: 'GLUTTONOUS_WILL',
          reason: 'gluttonous_eat',
          ownerBefore: 'white',
          sourceRow: 6,
          sourceCol: 1,
          meta: { sourceRow: 6, sourceCol: 1, bite: true }
        }]
      },
      {
        type: 'move',
        targets: [{
          from: { r: 6, col: 1 },
          to: { r: 6, col: 2 },
          ownerAfter: 'black',
          cause: 'GLUTTONOUS_WILL',
          reason: 'gluttonous_eat_move',
          after: { color: 1, special: 'GLUTTONOUS', timer: null, owner: 'black' }
        }]
      }
    ]);

    const addCalls = addSpy.mock.calls.filter((args) => args[0] === 'effect-target-highlight').length;
    const removeCalls = removeSpy.mock.calls.filter((args) => args[0] === 'effect-target-highlight').length;

    expect(addCalls).toBe(1);
    expect(removeCalls).toBe(1);
    expect(toCell.classList.contains('effect-target-highlight')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('teleport move applies and clears purple cell highlight at destination', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '1';
    fromCell.dataset.col = '1';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '4';
    toCell.dataset.col = '4';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addSpy = jest.spyOn(toCell.classList, 'add');
    const removeSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 1, col: 1 },
        to: { r: 4, col: 4 },
        ownerAfter: 'black',
        cause: 'TELEPORT_WILL',
        reason: 'teleport_move',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('cell teleport move applies and clears purple cell highlight at destination', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '2';
    fromCell.dataset.col = '2';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '-1';
    toCell.dataset.col = '0';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addSpy = jest.spyOn(toCell.classList, 'add');
    const removeSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 2, col: 2 },
        to: { r: -1, col: 0 },
        ownerAfter: 'black',
        cause: 'CELL_TELEPORT_WILL',
        reason: 'teleport_move',
        meta: { moveIntent: 'teleport_move' },
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('destroy evade move applies and clears red cell highlight at source', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '4';
    fromCell.dataset.col = '4';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '7';
    toCell.dataset.col = '7';

    const disc = document.createElement('div');
    disc.className = 'disc white special-stone';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addFromSpy = jest.spyOn(fromCell.classList, 'add');
    const addToSpy = jest.spyOn(toCell.classList, 'add');
    const removeFromSpy = jest.spyOn(fromCell.classList, 'remove');
    const removeToSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 4, col: 4 },
        to: { r: 7, col: 7 },
        ownerAfter: 'white',
        cause: 'DESTROY_EVADE',
        reason: 'destroy_evade_move',
        after: {
          color: -1,
          special: 'WILL_HUNTER_KING',
          timer: null,
          owner: 'white'
        }
      }]
    });

    expect(addFromSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(removeFromSpy).toHaveBeenCalledWith('effect-target-highlight');
    expect(addToSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(removeToSpy).not.toHaveBeenCalledWith('effect-target-highlight');
    expect(fromCell.classList.contains('effect-target-highlight')).toBe(false);
    expect(toCell.classList.contains('effect-target-highlight')).toBe(false);

    addFromSpy.mockRestore();
    addToSpy.mockRestore();
    removeFromSpy.mockRestore();
    removeToSpy.mockRestore();
  });

  test('position swap move applies and clears purple cell highlight on both cells', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '5';
    fromCell.dataset.col = '1';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '5';
    toCell.dataset.col = '2';

    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addFromSpy = jest.spyOn(fromCell.classList, 'add');
    const addToSpy = jest.spyOn(toCell.classList, 'add');
    const removeFromSpy = jest.spyOn(fromCell.classList, 'remove');
    const removeToSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 5, col: 1 },
        to: { r: 5, col: 2 },
        ownerAfter: 'black',
        cause: 'POSITION_SWAP_WILL',
        reason: 'position_swap',
        after: { color: 1, special: null, timer: null, owner: 'black' }
      }]
    });

    expect(addFromSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addToSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeFromSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeToSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(fromCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addFromSpy.mockRestore();
    addToSpy.mockRestore();
    removeFromSpy.mockRestore();
    removeToSpy.mockRestore();
  });

  test('flip evade move applies and clears purple cell highlight on source cell only', async () => {
    const engine = require('../ui/animation-engine');
    const board = document.getElementById('board')!;

    const fromCell = document.createElement('div');
    fromCell.className = 'cell';
    fromCell.dataset.row = '4';
    fromCell.dataset.col = '4';

    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '3';
    toCell.dataset.col = '3';

    const disc = document.createElement('div');
    disc.className = 'disc black special-stone';
    fromCell.appendChild(disc);

    board.appendChild(fromCell);
    board.appendChild(toCell);

    const addFromSpy = jest.spyOn(fromCell.classList, 'add');
    const addToSpy = jest.spyOn(toCell.classList, 'add');
    const removeFromSpy = jest.spyOn(fromCell.classList, 'remove');
    const removeToSpy = jest.spyOn(toCell.classList, 'remove');

    await engine.handleMove({
      type: 'move',
      targets: [{
        from: { r: 4, col: 4 },
        to: { r: 3, col: 3 },
        ownerAfter: 'black',
        cause: 'AFTERIMAGE_WILL',
        reason: 'afterimage_will_flip_evade_move',
        after: {
          color: 1,
          special: 'AFTERIMAGE_WILL',
          timer: null,
          owner: 'black'
        }
      }]
    });

    expect(addFromSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeFromSpy).toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(addToSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(removeToSpy).not.toHaveBeenCalledWith('effect-target-highlight-positive');
    expect(fromCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(toCell.classList.contains('effect-target-highlight-positive')).toBe(false);

    addFromSpy.mockRestore();
    addToSpy.mockRestore();
    removeFromSpy.mockRestore();
    removeToSpy.mockRestore();
  });
});
