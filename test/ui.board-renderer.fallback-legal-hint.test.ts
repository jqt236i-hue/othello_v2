import { JSDOM } from 'jsdom';

describe('board-renderer fallback legal hints', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = jest.fn(() => [{ row: 0, col: 0 }]);
    global.countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
    global.handleCellClick = jest.fn();
    global.applyStoneVisualEffect = jest.fn();
    global.renderBoardDiff = jest.fn();
    global.forceFullRender = (el) => require('../ui/diff-renderer.js').forceFullRender(el);
    global.updateOccupancyUI = jest.fn();
    global.renderCardUI = jest.fn();
    global.SoundEngine = {
      bgm: { paused: false },
      allowBgmPlay: true,
      pauseBgm: jest.fn(function () {
        this.allowBgmPlay = false;
        this.bgm.paused = true;
      }),
      playBgm: jest.fn(function () {
        this.allowBgmPlay = true;
        this.bgm.paused = false;
      })
    };

    global.CardLogic = {
      getCardContext: () => ({
        protectedStones: [{ row: 4, col: 4 }],
        permaProtectedStones: [{ row: 5, col: 5 }],
        bombs: []
      }),
      getSelectableTargets: () => [],
      getCardDef: () => null,
      getReinforcementWillTargets: () => [],
      getSupportTroopsWillTargets: () => []
    };

    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };

    global.cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null }
    };
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.boardEl;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.getPlayerKey;
    delete global.getLegalMoves;
    delete global.countDiscs;
    delete global.handleCellClick;
    delete global.applyStoneVisualEffect;
    delete global.renderBoardDiff;
    delete global.forceFullRender;
    delete global.updateOccupancyUI;
    delete global.renderCardUI;
    delete global.SoundEngine;
    delete global.CardLogic;
    delete global.gameState;
    delete global.cardState;
    delete global.PlaybackStateManager;
  });

  test('renderBoardFull passes protected and perma arrays to getLegalMoves', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.getLegalMoves).toHaveBeenCalledWith(
      global.gameState,
      [{ row: 4, col: 4 }],
      [{ row: 5, col: 5 }]
    );

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('renderBoard skips board diff while playback defers updates even when allowBoardUpdateDuringPlayback is armed', () => {
    const boardUpdateSyncRuntime = require('../ui/board-update-sync-runtime.js');
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1 }] }
    ];
    boardUpdateSyncRuntime.armBoardUpdateSyncContext({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'board-selection-preview'
    });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoard();

    expect(global.renderBoardDiff).not.toHaveBeenCalled();
    expect(global.updateOccupancyUI).not.toHaveBeenCalled();
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
  });

  test('renderBoardFull keeps circle void cells invisible and non-interactive', () => {
    global.gameState = {
      currentPlayer: global.BLACK,
      boardConfig: { rows: 10, cols: 10, shape: 'circle', standard8x8: false },
      board: Array.from({ length: 10 }, () => Array(10).fill(global.EMPTY)),
    };
    global.getLegalMoves.mockReturnValue([{ row: 0, col: 0 }, { row: 2, col: 4 }]);

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const voidCells = global.boardEl.querySelectorAll('.cell.cell-void');
    const cornerVoid = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const playable = global.boardEl.querySelector('.cell[data-row="2"][data-col="4"]');
    expect(global.boardEl.children).toHaveLength(100);
    expect(voidCells).toHaveLength(20);
    expect(cornerVoid.getAttribute('aria-hidden')).toBe('true');
    expect(cornerVoid.classList.contains('legal')).toBe(false);
    expect(playable.classList.contains('cell-void')).toBe(false);
    expect(playable.classList.contains('legal')).toBe(true);
  });

  test('renderBoardFull marks all empty cells as legal-free for UDR pending placement', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.isFreePlacementPendingType = (type) => type === 'ULTIMATE_REVERSE_DRAGON';
    global.cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_REVERSE_DRAGON',
      stage: null,
      cardId: 'udr_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const legalFreeCells = global.boardEl.querySelectorAll('.cell.legal-free');
    const normalLegalCells = global.boardEl.querySelectorAll('.cell.legal');
    expect(legalFreeCells).toHaveLength(64);
    expect(normalLegalCells).toHaveLength(0);
  });

  test('renderBoard enters selection mode for BLOCKADE_WILL board targeting', () => {
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 1 }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BLOCKADE_WILL',
      stage: 'selectTarget',
      cardId: 'blockade_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoard();

    expect(global.boardEl.classList.contains('selection-mode')).toBe(true);
    expect(global.renderBoardDiff).toHaveBeenCalledTimes(1);
  });

  test('renderBoardFull suppresses normal legal hints while BLOCKADE_WILL target selection is active', () => {
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 1 }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BLOCKADE_WILL',
      stage: 'selectTarget',
      cardId: 'blockade_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.boardEl.classList.contains('selection-mode')).toBe(true);

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const selectableCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    expect(legalCell).toBeTruthy();
    expect(selectableCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(false);
    expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
  });

  test('renderBoardFull shows causal replay hole targets as selectable while preserving hole styling', () => {
    global.getLegalMoves.mockReturnValue([{ row: 0, col: 0 }]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 1 }]);
    global.cardState.markers = [
      { id: 'hole-1', kind: 'specialStone', row: 0, col: 1, owner: 'black', data: { type: 'METEOR_HOLE' } }
    ];
    global.cardState.pendingEffectByPlayer.black = {
      type: 'CAUSAL_REPLAY_WILL',
      stage: 'selectTarget',
      cardId: 'causal_replay_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const normalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const holeCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    expect(normalCell).toBeTruthy();
    expect(holeCell).toBeTruthy();
    expect(normalCell.classList.contains('legal')).toBe(false);
    expect(normalCell.classList.contains('selectable-friendly')).toBe(false);
    expect(holeCell.classList.contains('meteor-hole-cell')).toBe(true);
    expect(holeCell.classList.contains('blocked-cell')).toBe(true);
    expect(holeCell.classList.contains('selectable-friendly')).toBe(true);
  });

  test('renderBoardFull previews random spawn targets for REINFORCEMENT_WILL without using selectable target styling', () => {
    global.CardLogic.getCardDef = jest.fn(() => ({ type: 'REINFORCEMENT_WILL' }));
    global.CardLogic.getReinforcementWillTargets = jest.fn(() => [{ row: 0, col: 1 }, { row: 1, col: 1 }]);
    global.cardState.selectedCardId = 'reinforcement_01';
    global.cardState.selectedCardOwnerKey = 'black';

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const firstPreviewCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    const secondPreviewCell = global.boardEl.querySelector('.cell[data-row="1"][data-col="1"]');
    expect(global.boardEl.classList.contains('selection-mode')).toBe(false);
    expect(legalCell.classList.contains('legal')).toBe(false);
    expect(firstPreviewCell.classList.contains('random-spawn-preview')).toBe(true);
    expect(secondPreviewCell.classList.contains('random-spawn-preview')).toBe(true);
    expect(firstPreviewCell.classList.contains('selectable-friendly')).toBe(false);
    expect(secondPreviewCell.classList.contains('selectable-friendly')).toBe(false);
  });

  test('renderBoardFull highlights the first selected stone during POSITION_SWAP_WILL targeting', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.gameState.board[0][0] = global.BLACK;
    global.gameState.board[0][1] = global.WHITE;
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 1 }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      cardId: 'position_swap_01',
      firstTarget: { row: 0, col: 0 }
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const firstCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const secondCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    expect(firstCell).toBeTruthy();
    expect(secondCell).toBeTruthy();
    expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
    expect(secondCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(secondCell.classList.contains('selectable-friendly')).toBe(true);
  });

  test('renderBoardFull highlights already selected perimeter cells during BOARD_SHRINK_WILL targeting', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 2, direction: { row: 0, col: 1 } }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      selectedCount: 2,
      maxSelections: 3
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const firstCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const secondCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    const selectableCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="2"]');
    expect(firstCell).toBeTruthy();
    expect(secondCell).toBeTruthy();
    expect(selectableCell).toBeTruthy();
    expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(secondCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
    expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    expect(selectableCell.getAttribute('data-board-shrink-will-direction-hint')).toBe('right');
    expect(selectableCell.querySelector('.board-shrink-will-direction-hint')?.textContent).toBe('→');
  });

  test('renderBoardFull highlights the first selected corner during BOARD_SHRINK_GOD targeting', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [{
      row: 0,
      col: 1,
      lineCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]
    }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01',
      firstTarget: { row: 0, col: 0 }
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const firstCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const selectableCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
    const previewCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="2"]');
    expect(firstCell).toBeTruthy();
    expect(selectableCell).toBeTruthy();
    expect(previewCell).toBeTruthy();
    expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(firstCell.classList.contains('selectable-friendly')).toBe(false);
    expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
    expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    expect(previewCell.classList.contains('selectable-friendly')).toBe(true);
    expect(selectableCell.getAttribute('data-board-shrink-god-direction-hint')).toBe('right');
    expect(selectableCell.querySelector('.board-shrink-god-direction-hint')?.textContent).toBe('→');
  });

  test('renderBoardFull highlights BOARD_EXPANSION_GOD selected corners from firstTarget and selectedTargets', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 7 }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      cardId: 'board_expand_god_01',
      firstTarget: { row: 0, col: 0 },
      selectedTargets: [{ row: 0, col: 0 }, { row: 7, col: 7 }],
      selectedCount: 2,
      maxSelections: 2
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const firstCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const secondSelectedCell = global.boardEl.querySelector('.cell[data-row="7"][data-col="7"]');
    const selectableCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="7"]');
    expect(firstCell).toBeTruthy();
    expect(secondSelectedCell).toBeTruthy();
    expect(selectableCell).toBeTruthy();
    expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(secondSelectedCell.classList.contains('effect-target-highlight-positive')).toBe(true);
    expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
    expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
  });

  test('renderBoardFull shows outward direction hints while selecting board expansion targets', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [
      { row: 2, col: 0, side: 'left', directionKey: 'left' },
      { row: 5, col: 7, side: 'right', directionKey: 'right' }
    ]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_WILL',
      stage: 'selectTarget',
      cardId: 'board_expand_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const leftCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="0"]');
    const rightCell = global.boardEl.querySelector('.cell[data-row="5"][data-col="7"]');
    expect(leftCell.getAttribute('data-board-expansion-direction-hint')).toBe('left');
    expect(leftCell.querySelector('.board-expansion-direction-hint')?.textContent).toBe('←');
    expect(rightCell.getAttribute('data-board-expansion-direction-hint')).toBe('right');
    expect(rightCell.querySelector('.board-expansion-direction-hint')?.textContent).toBe('→');
  });

  test('renderBoardFull shows diagonal outward direction hints while selecting board expansion god corners', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 0, directionKey: 'up-left' }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      cardId: 'board_expand_god_01'
    };

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const cornerCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cornerCell.getAttribute('data-board-expansion-direction-hint')).toBe('up-left');
    expect(cornerCell.querySelector('.board-expansion-direction-hint')?.textContent).toBe('↖');
  });

  test('renderBoard skips diff render while PLAYBACK_EVENTS are pending', () => {
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hyperactive_move', phase: 1 }] }
    ];

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoard();

    expect(global.renderBoardDiff).not.toHaveBeenCalled();
    expect(global.updateOccupancyUI).not.toHaveBeenCalled();
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });

  test('renderBoard toggles time-stop-active class from card state and pauses/resumes BGM', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoard();

    expect(document.documentElement.classList.contains('time-stop-active')).toBe(true);
    expect(document.body.classList.contains('time-stop-active')).toBe(true);
    expect(global.SoundEngine.pauseBgm).toHaveBeenCalledTimes(1);

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
    boardRenderer.renderBoard();

    expect(document.documentElement.classList.contains('time-stop-active')).toBe(false);
    expect(document.body.classList.contains('time-stop-active')).toBe(false);
    expect(global.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('renderBoard pauses manifestation BGM during time stop and resumes it afterward', () => {
    global.SoundEngine.bgm.paused = true;
    global.SoundEngine._manifestBgm = { paused: false };
    const boardRenderer = require('../ui/board-renderer.js');

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoard();

    expect(global.SoundEngine.pauseBgm).toHaveBeenCalledTimes(1);

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
    boardRenderer.renderBoard();

    expect(global.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('renderBoard does not resume BGM if time stop started while BGM was already paused', () => {
    global.SoundEngine.allowBgmPlay = false;
    global.SoundEngine.bgm.paused = true;
    const boardRenderer = require('../ui/board-renderer.js');
    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoard();

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
    boardRenderer.renderBoard();

    expect(global.SoundEngine.pauseBgm).not.toHaveBeenCalled();
    expect(global.SoundEngine.playBgm).not.toHaveBeenCalled();
  });

  test('renderBoardFull adds time-stop legal emphasis to legal cells during time stop', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoardFull();

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
    expect(legalCell.classList.contains('time-stop-legal-emphasis')).toBe(true);
  });

  test('renderBoardFull skips full redraw while persisted PLAYBACK_EVENTS are pending', () => {
    global.boardEl.innerHTML = '<div class="sentinel"></div>';
    global.cardState._presentationEventsPersist = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hyperactive_move', phase: 1 }] }
    ];

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.getLegalMoves).not.toHaveBeenCalled();
    expect(global.boardEl.querySelector('.sentinel')).toBeTruthy();
  });

  test('renderBoardFull skips full redraw with persisted PLAYBACK_EVENTS even when allowBoardUpdateDuringPlayback is armed', () => {
    const boardUpdateSyncRuntime = require('../ui/board-update-sync-runtime.js');
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
    global.boardEl.innerHTML = '<div class="sentinel"></div>';
    global.cardState._presentationEventsPersist = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1 }] }
    ];
    boardUpdateSyncRuntime.armBoardUpdateSyncContext({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'snapshot_playback_board_sync'
    });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.getLegalMoves).not.toHaveBeenCalled();
    expect(global.boardEl.querySelector('.sentinel')).toBeTruthy();
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
  });

  test('renderBoardDiff leaves selection-mode unchanged while PLAYBACK_EVENTS are pending', () => {
    global.CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 1 }]);
    global.cardState.pendingEffectByPlayer.black = {
      type: 'BLOCKADE_WILL',
      stage: 'selectTarget',
      cardId: 'blockade_01'
    };
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hyperactive_move', phase: 1 }] }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const updatedCount = diffRenderer.renderBoardDiff(global.boardEl);
    warnSpy.mockRestore();

    expect(updatedCount).toBe(0);
    expect(global.boardEl.classList.contains('selection-mode')).toBe(false);
    expect(global.boardEl.children).toHaveLength(0);
  });

  test('renderBoardDiff skips DOM updates while playback is pending even when allowBoardUpdateDuringPlayback is armed', () => {
    const boardUpdateSyncRuntime = require('../ui/board-update-sync-runtime.js');
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1 }] }
    ];
    global.boardEl.innerHTML = '<div class="sentinel"></div>';
    boardUpdateSyncRuntime.armBoardUpdateSyncContext({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'network_timeline_board_sync'
    });

    const diffRenderer = require('../ui/diff-renderer.js');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const updatedCount = diffRenderer.renderBoardDiff(global.boardEl);
    warnSpy.mockRestore();

    expect(updatedCount).toBe(0);
    expect(global.boardEl.querySelector('.sentinel')).toBeTruthy();
    boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
  });

  test('renderBoardFull delegates to canonical full render when available', () => {
    global.forceFullRender = jest.fn();

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.forceFullRender).toHaveBeenCalledTimes(1);
    expect(global.forceFullRender).toHaveBeenCalledWith(global.boardEl);
    expect(global.renderBoardDiff).not.toHaveBeenCalled();
    expect(global.getLegalMoves).not.toHaveBeenCalled();

    delete global.forceFullRender;
  });

  test('renderBoardFull falls back to diff renderer when canonical full render is unavailable', () => {
    delete global.forceFullRender;
    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.renderBoardDiff).toHaveBeenCalledTimes(1);
    expect(global.renderBoardDiff).toHaveBeenCalledWith(global.boardEl);
    expect(global.getLegalMoves).not.toHaveBeenCalled();
  });

  test('renderBoardFull fallback restores missing cells through a full refresh', () => {
    const diffRenderer = require('../ui/diff-renderer.js');
    global.renderBoardDiff = jest.fn((board) => diffRenderer.renderBoardDiff(board));
    delete global.forceFullRender;
    delete window.forceFullRender;

    diffRenderer.forceFullRender(global.boardEl);
    global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]')?.remove();

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    expect(global.renderBoardDiff).toHaveBeenCalledTimes(1);
    expect(global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]')).toBeTruthy();
    expect(global.boardEl.children).toHaveLength(64);
  });
});
