import { JSDOM } from 'jsdom';

describe('board cell information separation', () => {
  let sharedInputController: any = null;

  function getSharedInputController() {
    if (sharedInputController) return sharedInputController;
    const diff = require('../ui/board-dom-compat/renderer');
    const inputModule = require('../ui/board-input-controller.ts');
    sharedInputController = inputModule.createBoardInputController({
      ...diff.getBoardInputPresentationCapabilities(),
      handleCellClick: (row: number, col: number, directionKey?: string) => {
        if (directionKey == null) return (global as any).handleCellClick(row, col);
        return (global as any).handleCellClick(row, col, directionKey);
      }
    });
    sharedInputController.activate();
    return sharedInputController;
  }

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
    sharedInputController = null;
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
    require('../ui/board-dom-compat/renderer').configureBoardRendererCapabilities({
      getBoardInputController: () => getSharedInputController()
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.Event; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('short press keeps normal click behavior', () => {
    const mod = require('../ui/board-dom-compat/renderer');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 3);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 50, clientY: 60 });
    jest.advanceTimersByTime(120);
    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 50, clientY: 60 });

    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(2, 3);
  });

  test('mouse hover never creates stone detail UI', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/board-dom-compat/renderer');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerenter', { pointerType: 'mouse', clientX: 88, clientY: 92 });
    dispatchPointer(cell, 'pointerleave', { pointerType: 'mouse', clientX: 120, clientY: 132 });

    expect(document.getElementById('stone-info-detail-panel')).toBeNull();
    expect(global.handleCellClick).not.toHaveBeenCalled();
  });

  test('touch tap performs the board action without opening stone detail', () => {
    global.gameState.board[4][2] = global.BLACK;

    const mod = require('../ui/board-dom-compat/renderer');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 4, 2);

    dispatchPointer(cell, 'pointerdown', { pointerType: 'touch', button: 0, clientX: 88, clientY: 92 });
    dispatchPointer(cell, 'pointerup', { pointerType: 'touch', button: 0, clientX: 88, clientY: 92 });

    expect(document.getElementById('stone-info-detail-panel')).toBeNull();
    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(4, 2);
  });

  test('holding a board press never opens detail and clicks normally on release', () => {
    const mod = require('../ui/board-dom-compat/renderer');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 1);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 80, clientY: 90 });
    jest.advanceTimersByTime(430);

    expect(document.getElementById('stone-info-detail-panel')).toBeNull();

    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 80, clientY: 90 });
    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(1, 1);
  });

  test('stone info reads custom-board and expansion owners from the canonical BoardView', () => {
    global.gameState = {
      board: Array.from({ length: 10 }, () => Array(10).fill(global.EMPTY)),
      boardConfig: { rows: 10, cols: 10, shape: 'rectangle' },
      boardExpansion: {
        cells: [{ side: 'right', row: 2, col: 10, owner: global.WHITE }]
      }
    };
    global.gameState.board[9][9] = global.BLACK;

    const mod = require('../ui/board-dom-compat/renderer');

    expect(mod.showSpecialStoneInfoAt(9, 9)).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');

    expect(mod.showSpecialStoneInfoAt(2, 10)).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('白石');
  });

  test('森羅万象神は2×2のどのマスからも同じ詳細と専用背景を表示する', () => {
    [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3]
    ].forEach(([row, col]) => {
      global.gameState.board[row][col] = global.BLACK;
    });
    global.cardState.markers = [{
      id: 'shinra-info',
      markerId: 'shinra-info',
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: {
        type: 'SHINRA_BANSHO_GOD',
        footprint: 'square_2x2.v1',
        permanent: true
      }
    }];

    const mod = require('../ui/board-dom-compat/renderer');

    expect(mod.showSpecialStoneInfoAt(3, 3)).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('森羅万象神');
    expect(document.getElementById('stone-info-desc').textContent).toContain('2×2の永続特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('不可侵');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('完全保護');

    const panel = document.getElementById('stone-info-detail-panel') as HTMLElement;
    expect(panel.classList.contains('has-special-background')).toBe(true);
    expect(panel.style.getPropertyValue('--stone-info-detail-background-image'))
      .toContain('shinra_bansho_god_background.png');
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

    const mod = require('../ui/board-dom-compat/renderer');
    const shown = mod.showSpecialStoneInfoAt(2, 2);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('通常の石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('生きる意志付与');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
  });

  test('detail popup shows breeding-generated stone information', () => {
    global.gameState.board[4][2] = global.BLACK;
    global.cardState.breedingSproutByOwner = {
      black: [{ row: 4, col: 2 }],
      white: []
    };

    const mod = require('../ui/board-dom-compat/renderer');
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

    const mod = require('../ui/board-dom-compat/renderer');
    const shown = mod.showSpecialStoneInfoAt(2, 2);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('時間停石');
    const desc = document.getElementById('stone-info-desc') as HTMLElement;
    expect(desc.textContent).toContain('カウント終了時に時間停止を発動する。');
    expect(desc.textContent).not.toContain('3回目');
    expect(Array.from(desc.querySelectorAll('.game-term-highlight')).some((el) => el.textContent === '時間停止')).toBe(true);
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り4T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転無効');
  });

  test('detail resolution accepts network-style string coordinates for marker lookup', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: '2',
      col: '4',
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(2, 4)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('究極多動神');
  });

  test('detail resolution accepts ULTIMATE_HYPERACTIVE_GOD alias and shows updated description', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 3,
      col: 5,
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE_GOD', remainingOwnerTurns: 12 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(3, 5)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('究極多動神');
    expect(document.getElementById('stone-info-desc').textContent).toContain('ターン開始時に大きく移動し、移動後に反転する。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り12T');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転無効');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り5回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り2回');
  });

  test('detail shows 幽体 tag without mislabeling it as flip protection', () => {
    global.cardState.markers = [{
      kind: 'specialStone',
      row: 2,
      col: 6,
      owner: 'black',
      data: { type: 'GHOST', remainingOwnerTurns: 8 }
    }];
    global.gameState.board[2][6] = global.BLACK;

    const mod = require('../ui/board-dom-compat/renderer');
    const shown = mod.showSpecialStoneInfoAt(2, 6);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('幽体石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転や破壊の対象になるが、その効果を受けない。');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り8T');
    expect(document.getElementById('stone-info-meta').textContent).toContain('幽体');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('反転無効');
  });

  test('detail renders effect tags as buttons and toggles tag detail panel', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 4,
      owner: 'black',
      data: { type: 'HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(1, 4)).toBe(true);

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
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('最も近い空きマス');
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('次に近い空きマス');

    evadeTagButton.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(tagPanel.classList.contains('is-open')).toBe(false);

    remainingTurnTagButton.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(tagPanel.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('stone-info-tag-title').textContent).toBe('残り10T');
    expect(document.getElementById('stone-info-tag-body').textContent).toContain('ターン数');
  });

  test('detail popup adds 多動状態/反転回避 tags for hyperactive-family stones', () => {
    const mod = require('../ui/board-dom-compat/renderer');
    const cases = [
      { type: 'HYPERACTIVE', name: '多動石' },
      { type: 'EXTREME_HYPERACTIVE', name: '極悪多動魔' },
      { type: 'ESCAPE_HYPERACTIVE', name: '逃亡石' },
      { type: 'ULTIMATE_HYPERACTIVE', name: '究極多動神' }
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
      expect(document.getElementById('stone-info-meta').textContent).toContain('残り10T');
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

    const mod = require('../ui/board-dom-compat/renderer');
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
        flipEvadeRemaining: 5,
        destroyEvadeRemaining: 5
      }
    }];

    const mod = require('../ui/board-dom-compat/renderer');
    const shown = mod.showSpecialStoneInfoAt(5, 4);
    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('極悪多動魔');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転回避 残り5回');
    expect(document.getElementById('stone-info-meta').textContent).toContain('破壊回避 残り5回');
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

    const mod = require('../ui/board-dom-compat/renderer');
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

    const mod = require('../ui/board-dom-compat/renderer');
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

    const mod = require('../ui/board-dom-compat/renderer');
    const shown = mod.showSpecialStoneInfoAt(4, 4);

    expect(shown).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('黒石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('通常石');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
  });

  test('detail on GLUTTONOUS shows registered info with flip protection and special-stone badge', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 6,
      owner: 'black',
      data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(1, 6)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('悪食石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('ターン開始時に移動し、隣接する敵石を捕食する。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転無効');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('交換保護');
  });

  test('detail on LIGHTNING shows registered lightning info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 5,
      col: 1,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 6 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(5, 1)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('落雷石');
    expect(document.getElementById('stone-info-desc').textContent).toContain('敵石をランダムに1つ破壊する。');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り6T');
  });

  test('detail on METEOR_HOLE shows registered meteor hole info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(6, 6)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('流星穴');
    expect(document.getElementById('stone-info-desc').textContent).toContain('永続穴');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転経路も遮断');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
  });

  test('detail on FREEZE shows registered freeze-cell info', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 2,
      col: 6,
      owner: 'black',
      data: { type: 'FREEZE', remainingOwnerTurns: 5 }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(2, 6)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('凍結マス');
    expect(document.getElementById('stone-info-desc').textContent).toContain('5ターン');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転・破壊・移動されない');
    expect(document.getElementById('stone-info-desc').textContent).toContain('反転経路も遮断');
    expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
  });

  test('detail on OBSERVER_WILL shows inviolable and remaining turns', () => {
    global.cardState.markers.push({
      kind: 'manifestStone',
      row: 4,
      col: 5,
      owner: 'black',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, inviolable: true }
    });

    const mod = require('../ui/board-dom-compat/renderer');
    expect(mod.showSpecialStoneInfoAt(4, 5)).toBe(true);

    expect(document.getElementById('stone-info-name').textContent).toBe('盤理の観測者');
    expect(document.getElementById('stone-info-desc').textContent).toContain('5ターン不可侵');
    expect(document.getElementById('stone-info-meta').textContent).toContain('顕現石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('不可侵');
    expect(document.getElementById('stone-info-meta').textContent).not.toContain('特殊石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('残り4T');
  });
});
