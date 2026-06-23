import { JSDOM } from 'jsdom';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createBaseCardState(markers) {
  return {
    markers: Array.isArray(markers) ? markers : [],
    pendingEffectByPlayer: { black: null, white: null },
    boardBonusByCell: {},
    boardBonusConsumedByCell: {},
    presentationEvents: [],
    _presentationEventsPersist: []
  };
}

function createSnapshot(stateVersion, board, markers) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: stateVersion,
      board
    },
    cardState: createBaseCardState(markers)
  };
}

function createPlaybackMove(fromRow, fromCol, toRow, toCol, cause, reason) {
  return [{
    type: 'move',
    phase: 1,
    targets: [{
      from: { r: fromRow, col: fromCol },
      to: { r: toRow, col: toCol },
      cause,
      reason
    }]
  }];
}

function withUnclaimedPlaybackSettlement(options) {
  return Object.assign({
    releaseUnclaimedPlayback: true,
    clearUndrainedPlayback: true
  }, options || {});
}

function createSpecialMarker(row, col, type, extraData) {
  return {
    kind: 'specialStone',
    row,
    col,
    owner: 'black',
    data: Object.assign({ type }, extraData || {})
  };
}

function createController(stateRef) {
  const { createNetworkSnapshotController } = require('../ui/network/snapshot.js');
  return createNetworkSnapshotController({
    getState: () => stateRef,
    emitCardStateChange: global.emitCardStateChange,
    emitGameStateChange: global.emitGameStateChange,
    emitBoardUpdate: global.emitBoardUpdate,
    renderCardUI: global.renderCardUI
  });
}

function expectSourceToSyncWithoutDestroyFade(row, col) {
  const sourceCell = global.boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  expect(sourceCell).toBeTruthy();
  expect(sourceCell.classList.contains('has-disc')).toBe(false);
  expect(sourceCell.querySelector('.disc')).toBeNull();
}

function expectSourceToRemainUntilPlayback(row, col) {
  const sourceCell = global.boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  expect(sourceCell).toBeTruthy();
  expect(sourceCell.classList.contains('has-disc')).toBe(true);
  expect(sourceCell.querySelector('.disc')).toBeTruthy();
}

function flushDeferredPlaybackBoardUpdate() {
  if (global.cardState && typeof global.cardState === 'object') {
    global.cardState.presentationEvents = [];
    global.cardState._presentationEventsPersist = [];
  }
  global.emitBoardUpdate();
}

describe('Network snapshot move-source empty handling', () => {
  let dom;
  let diff;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;

    global.boardEl = document.getElementById('board');
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = () => {};
    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = () => [];
    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };

    global.gameState = {
      currentPlayer: global.BLACK,
      turnNumber: 1,
      board: createBoard()
    };
    global.cardState = createBaseCardState([]);

    diff = require('../ui/diff-renderer');

    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn(() => {
      diff.renderBoardDiff(global.boardEl);
    });
    global.BoardOps = {
      emitPresentationEvent: jest.fn((cardStateRef, ev) => {
        if (!cardStateRef || typeof cardStateRef !== 'object') return;
        if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
        cardStateRef.presentationEvents.push(ev);
      })
    };

    window.DISABLE_ANIMATIONS = false;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.boardEl;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.handleCellClick;
    delete global.getPlayerKey;
    delete global.getLegalMoves;
    delete global.CardLogic;
    delete global.gameState;
    delete global.cardState;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.BoardOps;
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  });

  test.each([
    {
      name: 'robot vacuum autonomous move',
      cause: 'ROBOT_VACUUM_WILL',
      reason: 'robot_vacuum_move',
      source: { row: 3, col: 3 },
      dest: { row: 3, col: 4 },
      beforeMarkers: [createSpecialMarker(3, 3, 'ROBOT_VACUUM', { remainingOwnerTurns: 5 })],
      afterMarkers: [createSpecialMarker(3, 4, 'ROBOT_VACUUM', { remainingOwnerTurns: 5 })]
    },
    {
      name: 'gluttonous eat move',
      cause: 'GLUTTONOUS_WILL',
      reason: 'gluttonous_eat_move',
      source: { row: 4, col: 4 },
      dest: { row: 4, col: 5 },
      beforeMarkers: [createSpecialMarker(4, 4, 'GLUTTONOUS', { gluttonousMissStreak: 0 })],
      afterMarkers: [createSpecialMarker(4, 5, 'GLUTTONOUS', { gluttonousMissStreak: 0 })]
    },
    {
      name: 'will hunter king slash move',
      cause: 'WILL_HUNTER_KING',
      reason: 'will_hunter_king_slash_move',
      source: { row: 2, col: 2 },
      dest: { row: 2, col: 5 },
      beforeMarkers: [createSpecialMarker(2, 2, 'WILL_HUNTER_KING', { remainingOwnerTurns: 8, destroyEvadeRemaining: 2, flipEvadeRemaining: 2 })],
      afterMarkers: [createSpecialMarker(2, 5, 'WILL_HUNTER_KING', { remainingOwnerTurns: 8, destroyEvadeRemaining: 2, flipEvadeRemaining: 2 })]
    },
    {
      name: 'strong wind ordinary move',
      cause: 'STRONG_WIND_WILL',
      reason: 'strong_wind_move',
      source: { row: 3, col: 1 },
      dest: { row: 3, col: 6 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'super buoyancy ordinary move',
      cause: 'SUPER_BUOYANCY_WILL',
      reason: 'super_buoyancy_move',
      source: { row: 5, col: 3 },
      dest: { row: 1, col: 3 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'buoyancy ordinary move',
      cause: 'BUOYANCY_WILL',
      reason: 'buoyancy_move',
      source: { row: 6, col: 2 },
      dest: { row: 1, col: 2 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'super gravity ordinary move',
      cause: 'SUPER_GRAVITY_WILL',
      reason: 'super_gravity_move',
      source: { row: 2, col: 4 },
      dest: { row: 6, col: 4 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'gravity ordinary move',
      cause: 'GRAVITY_WILL',
      reason: 'gravity_move',
      source: { row: 1, col: 5 },
      dest: { row: 6, col: 5 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'super attraction ordinary move',
      cause: 'SUPER_ATTRACTION_WILL',
      reason: 'super_attraction_move',
      source: { row: 6, col: 1 },
      dest: { row: 2, col: 5 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'teleport ordinary move',
      cause: 'TELEPORT_WILL',
      reason: 'teleport_move',
      source: { row: 1, col: 1 },
      dest: { row: 5, col: 5 },
      beforeMarkers: [],
      afterMarkers: []
    },
    {
      name: 'cell teleport ordinary move',
      cause: 'CELL_TELEPORT_WILL',
      reason: 'teleport_move',
      source: { row: 4, col: 4 },
      dest: { row: 2, col: 6 },
      beforeMarkers: [],
      afterMarkers: []
    }
  ])('network snapshot keeps $name source from destroy-fading when source is already empty', ({ cause, reason, source, dest, beforeMarkers, afterMarkers }) => {
    const beforeBoard = createBoard();
    beforeBoard[source.row][source.col] = global.BLACK;
    global.gameState.board = beforeBoard;
    global.cardState = createBaseCardState(beforeMarkers);
    diff.renderBoardDiff(global.boardEl);

    const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
    const controller = createController(controllerState);

    const afterBoard = createBoard();
    afterBoard[dest.row][dest.col] = global.BLACK;
    const applied = controller.applySnapshot(
      createSnapshot(2, afterBoard, afterMarkers),
      withUnclaimedPlaybackSettlement({
        playbackEvents: createPlaybackMove(source.row, source.col, dest.row, dest.col, cause, reason)
      })
    );

    expect(applied).toBe(true);
    expectSourceToRemainUntilPlayback(source.row, source.col);
    flushDeferredPlaybackBoardUpdate();
    expectSourceToSyncWithoutDestroyFade(source.row, source.col);
    const destCell = global.boardEl.querySelector(`.cell[data-row="${dest.row}"][data-col="${dest.col}"]`);
    expect(destCell).toBeTruthy();
    expect(destCell.querySelector('.disc')).toBeTruthy();
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(
      global.cardState,
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        meta: expect.objectContaining({ source: 'network_snapshot' })
      })
    );
  });

  test('self snapshot shadow playback keeps move source from destroy-fading without replay queue loss', () => {
    const source = { row: 3, col: 3 };
    const dest = { row: 3, col: 4 };
    const beforeBoard = createBoard();
    beforeBoard[source.row][source.col] = global.BLACK;
    global.gameState.board = beforeBoard;
    global.cardState = createBaseCardState([
      createSpecialMarker(3, 3, 'ROBOT_VACUUM', { remainingOwnerTurns: 5 })
    ]);
    diff.renderBoardDiff(global.boardEl);

    const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
    const controller = createController(controllerState);

    const afterBoard = createBoard();
    afterBoard[dest.row][dest.col] = global.BLACK;
    const applied = controller.applySnapshot(
      createSnapshot(2, afterBoard, [
        createSpecialMarker(3, 4, 'ROBOT_VACUUM', { remainingOwnerTurns: 5 })
      ]),
      withUnclaimedPlaybackSettlement({
        shadowPlaybackEvents: createPlaybackMove(source.row, source.col, dest.row, dest.col, 'ROBOT_VACUUM_WILL', 'robot_vacuum_move')
      })
    );

    expect(applied).toBe(true);
    expectSourceToRemainUntilPlayback(source.row, source.col);
    flushDeferredPlaybackBoardUpdate();
    expectSourceToSyncWithoutDestroyFade(source.row, source.col);
    const destCell = global.boardEl.querySelector(`.cell[data-row="${dest.row}"][data-col="${dest.col}"]`);
    expect(destCell).toBeTruthy();
    expect(destCell.querySelector('.disc')).toBeTruthy();
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(
      global.cardState,
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        meta: expect.objectContaining({
          source: 'self_snapshot_sync',
          suppressPlayback: true
        })
      })
    );
  });

  test('network snapshot keeps extreme forced-swap source and destination aligned without destroy-fade fallback', () => {
    const source = { row: 4, col: 4 };
    const dest = { row: 4, col: 5 };
    const beforeBoard = createBoard();
    beforeBoard[source.row][source.col] = global.BLACK;
    beforeBoard[dest.row][dest.col] = global.WHITE;
    global.gameState.board = beforeBoard;
    global.cardState = createBaseCardState([
      createSpecialMarker(source.row, source.col, 'EXTREME_HYPERACTIVE', { remainingOwnerTurns: 8, flipEvadeRemaining: 5, destroyEvadeRemaining: 5 })
    ]);
    diff.renderBoardDiff(global.boardEl);

    const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
    const controller = createController(controllerState);

    const afterBoard = createBoard();
    afterBoard[source.row][source.col] = global.WHITE;
    afterBoard[dest.row][dest.col] = global.BLACK;
    const applied = controller.applySnapshot(
      createSnapshot(2, afterBoard, [
        createSpecialMarker(dest.row, dest.col, 'EXTREME_HYPERACTIVE', { remainingOwnerTurns: 8, flipEvadeRemaining: 5, destroyEvadeRemaining: 5 })
      ]),
      withUnclaimedPlaybackSettlement({
        playbackEvents: [{
          type: 'move',
          phase: 1,
          meta: { sequence: 'extreme_hyperactive_forced_swap' },
          targets: [{
            from: { r: source.row, col: source.col },
            to: { r: dest.row, col: dest.col },
            cause: 'EXTREME_HYPERACTIVE_WILL',
            reason: 'extreme_hyperactive_forced_swap',
            extremeForcedSwapRole: 'lead',
            after: { color: 1, special: 'EXTREME_HYPERACTIVE', timer: 8, owner: 'black' }
          }, {
            from: { r: dest.row, col: dest.col },
            to: { r: source.row, col: source.col },
            cause: 'EXTREME_HYPERACTIVE_WILL',
            reason: 'extreme_hyperactive_forced_swap',
            extremeForcedSwapRole: 'follow',
            after: { color: -1, special: null, timer: null, owner: 'white' }
          }]
        }]
      })
    );

    expect(applied).toBe(true);
    expectSourceToRemainUntilPlayback(source.row, source.col);
    flushDeferredPlaybackBoardUpdate();
    const sourceCell = global.boardEl.querySelector(`.cell[data-row="${source.row}"][data-col="${source.col}"]`);
    const destCell = global.boardEl.querySelector(`.cell[data-row="${dest.row}"][data-col="${dest.col}"]`);
    expect(sourceCell).toBeTruthy();
    expect(destCell).toBeTruthy();
    expect(sourceCell.querySelectorAll('.disc.white')).toHaveLength(1);
    expect(sourceCell.querySelector('.disc.black')).toBeNull();
    expect(destCell.querySelectorAll('.disc.black')).toHaveLength(1);
    expect(destCell.querySelector('.disc.white')).toBeNull();
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(
      global.cardState,
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        meta: expect.objectContaining({ source: 'network_snapshot' })
      })
    );
  });

  test('network snapshot still uses destroy-fade for unrelated removals when a different move is queued', () => {
    const beforeBoard = createBoard();
    beforeBoard[1][1] = global.BLACK;
    beforeBoard[3][3] = global.BLACK;
    global.gameState.board = beforeBoard;
    global.cardState = createBaseCardState([]);
    diff.renderBoardDiff(global.boardEl);

    const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
    const controller = createController(controllerState);

    const afterBoard = createBoard();
    afterBoard[4][4] = global.BLACK;
    const applied = controller.applySnapshot(
      createSnapshot(2, afterBoard, []),
      withUnclaimedPlaybackSettlement({
        playbackEvents: createPlaybackMove(3, 3, 4, 4, 'STRONG_WIND_WILL', 'strong_wind_move')
      })
    );

    expect(applied).toBe(true);
    expectSourceToRemainUntilPlayback(3, 3);
    flushDeferredPlaybackBoardUpdate();
    const destroyedCell = global.boardEl.querySelector('.cell[data-row="1"][data-col="1"]');
    expect(destroyedCell).toBeTruthy();
    const fadingDisc = destroyedCell.querySelector('.disc');
    expect(fadingDisc).toBeTruthy();
    expect(fadingDisc.classList.contains('destroy-fade')).toBe(true);
  });
});
