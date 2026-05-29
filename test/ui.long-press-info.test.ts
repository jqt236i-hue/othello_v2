import { JSDOM } from 'jsdom';

describe('board cell long press info', () => {
  function dispatchPointer(target, type, props) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const p = props || {};
    Object.defineProperty(ev, 'button', { value: p.button ?? 0 });
    Object.defineProperty(ev, 'clientX', { value: p.clientX ?? 0 });
    Object.defineProperty(ev, 'clientY', { value: p.clientY ?? 0 });
    Object.defineProperty(ev, 'pointerType', { value: p.pointerType });
    target.dispatchEvent(ev);
  }

  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    jest.useFakeTimers();

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = jest.fn();
    global.cardState = { markers: [] };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    const board = document.createElement('div');
    board.id = 'board';
    document.body.appendChild(board);
  });

  afterEach(() => {
    jest.useRealTimers();
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.Event; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('short press keeps normal click behavior', () => {
    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 3);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 50, clientY: 60 });
    jest.advanceTimersByTime(120);
    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 50, clientY: 60 });

    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(2, 3);
  });

  test('mouse hover shows stone info without clicking', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerenter', { pointerType: 'mouse', clientX: 88, clientY: 92 });

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(global.handleCellClick).toHaveBeenCalledTimes(0);
  });

  test('mouse leave keeps hover stone info visible', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerenter', { pointerType: 'mouse', clientX: 88, clientY: 92 });
    const panel = document.getElementById('stone-info-panel');
    expect(panel.classList.contains('visible')).toBe(true);

    dispatchPointer(cell, 'pointerleave', { pointerType: 'mouse', clientX: 120, clientY: 132 });
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
  });

  test('touch tap shows stone info and keeps normal click behavior', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerdown', { pointerType: 'touch', button: 0, clientX: 88, clientY: 92 });
    jest.advanceTimersByTime(120);
    dispatchPointer(cell, 'pointerup', { pointerType: 'touch', button: 0, clientX: 88, clientY: 92 });

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(4, 2);
  });

  test('hover on empty cell keeps stone info panel hidden', () => {
    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 0, 0);

    dispatchPointer(cell, 'pointerenter', { pointerType: 'mouse', clientX: 20, clientY: 20 });

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(false);
  });

  test('hover on empty cell after visible stone preserves previous stone info', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const board = document.getElementById('board');
    const stoneCell = document.createElement('div');
    const emptyCell = document.createElement('div');
    board.appendChild(stoneCell);
    board.appendChild(emptyCell);
    mod.attachBoardCellInteraction(stoneCell, 4, 2);
    mod.attachBoardCellInteraction(emptyCell, 0, 0);

    dispatchPointer(stoneCell, 'pointerenter', { pointerType: 'mouse', clientX: 88, clientY: 92 });
    const panel = document.getElementById('stone-info-panel');
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');

    dispatchPointer(emptyCell, 'pointerenter', { pointerType: 'mouse', clientX: 20, clientY: 20 });
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
  });

  test('long press shows info and does not execute click action', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: 2 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 1);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 80, clientY: 90 });
    jest.advanceTimersByTime(430);

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('繁殖石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('交換保護');

    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 80, clientY: 90 });
    expect(global.handleCellClick).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(10000);
    expect(panel.classList.contains('visible')).toBe(true);

    dispatchPointer(document.body, 'pointerdown', { button: 0, clientX: 5, clientY: 5 });
    expect(panel.classList.contains('visible')).toBe(false);
  });

  test('long press on normal stone shows info and does not execute click action', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 88, clientY: 92 });
    jest.advanceTimersByTime(430);

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('通常の石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('通常石');

    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 88, clientY: 92 });
    expect(global.handleCellClick).toHaveBeenCalledTimes(0);
  });

  test('showSpecialStoneInfoAt keeps normal stone info for living-will aura and adds its badge', () => {
    global.gameState.board[2][2] = global.BLACK;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: global.BLACK, markers: [] } }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(2, 2);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('通常の石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('生きる意志付与');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
  });

  test('long press on breeding-generated stone shows breeding-generated info', () => {
    global.gameState.board[4][2] = global.BLACK;
    global.cardState.breedingSproutByOwner = {
      black: [{ row: 4, col: 2 }],
      white: []
    };

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(4, 2);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石（繁殖生成）');
    expect(document.getElementById('stone-info-desc').textContent).toContain('繁殖の意志でこのターンに生成された石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('繁殖生成石');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('通常石');
  });

  test('showSpecialStoneInfoAt uses shared TIME_STOP rulebook text', () => {
    global.gameState.board[2][2] = global.BLACK;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: 4 }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(2, 2);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('時間停石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('カウント終了時に時間停止を発動する。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('3回目');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り4T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転保護');
  });

  test('long press resolves network-style string coordinates for marker lookup', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: '2',
      col: '4',
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 4);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 80, clientY: 90 });
    jest.advanceTimersByTime(430);

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('究極多動神');
  });

  test('long press accepts ULTIMATE_HYPERACTIVE_GOD alias and shows updated description', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 3,
      col: 5,
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE_GOD', remainingOwnerTurns: 10 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 3, 5);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 120, clientY: 100 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('究極多動神');
    expect(document.getElementById('stone-info-desc').textContent).toContain('ターン開始時に大きく移動し、移動後に反転する。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り10T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り3回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り1回');
  });

  test('long press shows 幽体 tag without mislabeling it as flip protection', () => {
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 2,
      col: 6,
      owner: 'black',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    }];
    global.gameState.board[2][6] = global.BLACK;

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(2, 6);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('幽体石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転や破壊の対象になるが、その効果を受けない。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り5T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('幽体');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('破壊保護');
  });

  test('long press renders effect tags as buttons and toggles tag detail panel', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 4,
      owner: 'black',
      data: { type: 'HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 4);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 94, clientY: 90 });
    jest.advanceTimersByTime(430);

    const tagButtons = Array.from(document.querySelectorAll('#stone-info-meta .stone-info-effect-tag-button'));
    expect(tagButtons.length).toBeGreaterThan(0);

    const evadeTagButton = tagButtons.find((el) => el.textContent.startsWith('反転回避'));
    const remainingTurnTagButton = tagButtons.find((el) => el.textContent.startsWith('残り10T'));
    expect(evadeTagButton).toBeTruthy();
    expect(remainingTurnTagButton).toBeTruthy();

    evadeTagButton.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    const tagPanel = document.getElementById('stone-info-tag-panel');
    expect(tagPanel).not.toBeNull();
    expect(tagPanel.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('stone-info-tag-title').textContent).toBe('反転回避 残り1回');
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('回避');

    evadeTagButton.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(tagPanel.classList.contains('is-open')).toBe(false);

    remainingTurnTagButton.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(tagPanel.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('stone-info-tag-title').textContent).toBe('残り10T');
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('ターン数');
  });

  test('long press adds 多動状態/反転回避 tags for hyperactive-family stones', () => {
    const mod = require('../ui/diff-renderer.js');
    const cases = [
      { type: 'HYPERACTIVE', name: '多動石' },
      { type: 'EXTREME_HYPERACTIVE', name: '極悪多動魔' },
      { type: 'ESCAPE_HYPERACTIVE', name: '逃亡石' },
      { type: 'ULTIMATE_HYPERACTIVE', name: '究極多動神' },
      { type: 'INHERITED_HYPERACTIVE', name: '継承多動石' }
    ];

    cases.forEach((target, index) => {
      global.cardState.markers = [{
        kind: 'specialStone',
        row: 4,
        col: index,
        owner: 'black',
        data: {
          type: target.type,
          remainingOwnerTurns: 10,
          flipEvadeRemaining: 1
        }
      }];

      const shown = mod.showSpecialStoneInfoAt(4, index);
      expect(shown).toBe(true);
      expect(document.getElementById('stone-info-name').textContent).toBe(target.name);
      expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
      expect(document.getElementById('stone-info-meta').textContent).toContain('多動状態');
      if (target.type === 'INHERITED_HYPERACTIVE') {
        expect(document.getElementById('stone-info-meta').textContent).not.toContain('残り10T');
      } else {
        expect(document.getElementById('stone-info-meta').textContent).toContain('残り10T');
      }
      expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り1回');
    });
  });

  test('showSpecialStoneInfoAt adds 破壊回避 tag for will hunter king', () => {
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 5,
      col: 5,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(5, 5);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('意志狩りの王');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り8T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り2回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り2回');
  });

  test('showSpecialStoneInfoAt adds 破壊回避 tag for extreme hyperactive', () => {
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 5,
      col: 4,
      owner: 'black',
      data: {
        type: 'EXTREME_HYPERACTIVE',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 1
      }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(5, 4);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('極悪多動魔');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り3回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り1回');
  });

  test('showSpecialStoneInfoAt shows afterimage tags without 多動状態', () => {
    global.gameState.board[5][6] = global.BLACK;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 5,
      col: 6,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 3
      }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(5, 6);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('残像石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転や破壊を回避する。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り3回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り3回');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('多動状態');
  });

  test('showSpecialStoneInfoAt hides trap info from the owner seat while hidden', () => {
    global.window.LOCAL_PLAYER_KEY = 'black';
    global.gameState.board[4][4] = global.BLACK;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'TRAP', remainingOwnerTurns: 1 }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(4, 4);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('通常石');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
  });

  test('showSpecialStoneInfoAt hides trap info from the non-owner seat', () => {
    global.window.LOCAL_PLAYER_KEY = 'white';
    global.gameState.board[4][4] = global.BLACK;
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'TRAP', remainingOwnerTurns: 1 }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(4, 4);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('通常石');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
  });

  test('long press keeps inherited-hyperactive tags when base special stone coexists', () => {
    global.cardState.markers = [
      {
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 4 }
      },
      {
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
      }
    ];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(3, 3);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('究極反転龍');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).toContain('多動状態');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り4T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り1回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り1回');
  });

  test('long press on INHERITED_HYPERACTIVE shows registered inherited hyperactive info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 2);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 90, clientY: 90 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('継承多動石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('多動状態が付与されている。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('残り10T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り1回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り1回');
  });

  test('long press on GLUTTONOUS shows registered info with flip protection and special-stone badge', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 6,
      owner: 'black',
      data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 6);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 100, clientY: 90 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('悪食石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('ターン開始時に移動し、隣接する敵石を捕食する。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('交換保護');
  });

  test('long press on OBSERVER shows registered observer info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 5,
      col: 1,
      owner: 'black',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 5, 1);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 100, clientY: 80 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('盤理の観測者石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('ターン開始時、一定確率で布石を得る。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り5T');
  });

  test('long press on METEOR_HOLE shows registered meteor hole info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 6, 6);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 110, clientY: 95 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('流星穴');
    expect(document.getElementById('stone-info-desc').textContent).toContain('永続穴');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転経路も遮断');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
  });

  test('long press on FREEZE shows registered freeze-cell info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 2,
      col: 6,
      owner: 'black',
      data: { type: 'FREEZE', remainingOwnerTurns: 5 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 6);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 118, clientY: 84 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-name').textContent).toBe('凍結マス');
    expect(document.getElementById('stone-info-desc').textContent).toContain('5ターン');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転・破壊・移動されない');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転経路も遮断');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
  });

  test('long press on ABSOLUTE_PROTECTED shows registered info with flip and destroy protection tags', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED' }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 3, 3);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 100, clientY: 100 });
    jest.advanceTimersByTime(430);

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('絶対保護石');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-desc').textContent).toContain('あらゆる効果を受けない。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊保護');
  });

  test('showSpecialStoneInfoAt ABSOLUTE_PROTECTED does not show fallback text', () => {
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 5,
      col: 2,
      owner: 'white',
      data: { type: 'ABSOLUTE_PROTECTED' }
    }];

    const mod = require('../ui/diff-renderer.js');
    const shown = mod.showSpecialStoneInfoAt(5, 2);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('絶対保護石');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊保護');
  });
});
