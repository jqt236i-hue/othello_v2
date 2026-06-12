import { JSDOM } from 'jsdom';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBoard(rows = 8, cols = 8) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createSnapshotMeta(stateVersion, seatKey = 'black') {
  return {
    authority: 'server',
    version: stateVersion,
    projectedForSeat: seatKey,
    turnStartReconciled: true
  };
}

function createSnapshot(stateVersion, pendingState, gameStateOverrides = {}) {
  return {
    stateVersion,
    _meta: createSnapshotMeta(stateVersion),
    gameState: {
      currentPlayer: 1,
      turnNumber: 12,
      board: createBoard(8, 8),
      ...gameStateOverrides
    },
    cardState: {
      turnIndex: 5,
      pendingEffectByPlayer: {
        black: pendingState ? cloneJson(pendingState) : null,
        white: null
      },
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    }
  };
}

const CASES = [
  {
    label: 'POSITION_SWAP_WILL',
    pendingType: 'POSITION_SWAP_WILL',
    modulePath: '../game/card-effects/position-swap',
    handlerName: 'handlePositionSwapSelection',
    actionField: 'positionSwapTarget',
    firstTarget: { row: 2, col: 3 },
    secondTarget: { row: 5, col: 4 },
    initialPending: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' },
    intermediatePending: {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      cardId: 'position_swap_01',
      firstTarget: { row: 2, col: 3 }
    },
    buildFirstResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'position_swap_first_selected',
        applied: true,
        completed: false,
        firstTarget: { row: 2, col: 3 }
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: {
          black: {
            type: 'POSITION_SWAP_WILL',
            stage: 'selectTarget',
            cardId: 'position_swap_01',
            firstTarget: { row: 2, col: 3 }
          },
          white: null
        }
      },
      nextGameState: cloneJson(currentSnapshot.gameState),
      playbackEvents: [{ type: 'selection_marker', phase: 1 }]
    }),
    buildFinalResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'position_swap_selected',
        applied: true,
        completed: true,
        from: { row: 2, col: 3 },
        to: { row: 5, col: 4 }
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: { black: null, white: null }
      },
      nextGameState: {
        ...cloneJson(currentSnapshot.gameState),
        turnNumber: 13
      },
      playbackEvents: [{ type: 'move', phase: 1 }]
    }),
    expectedTransportState: {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 3 }
    }
  },
  {
    label: 'SUPER_ATTRACTION_WILL',
    pendingType: 'SUPER_ATTRACTION_WILL',
    modulePath: '../game/card-effects/strong-wind',
    handlerName: 'handleSuperAttractionSelection',
    actionField: 'superAttractionTarget',
    firstTarget: { row: 2, col: 2 },
    secondTarget: { row: 5, col: 5 },
    initialPending: { type: 'SUPER_ATTRACTION_WILL', stage: 'selectTarget', cardId: 'super_attraction_01' },
    intermediatePending: {
      type: 'SUPER_ATTRACTION_WILL',
      stage: 'selectTarget',
      cardId: 'super_attraction_01',
      firstTarget: { row: 2, col: 2 }
    },
    buildFirstResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'super_attraction_first_selected',
        applied: true,
        completed: false,
        firstTarget: { row: 2, col: 2 }
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: {
          black: {
            type: 'SUPER_ATTRACTION_WILL',
            stage: 'selectTarget',
            cardId: 'super_attraction_01',
            firstTarget: { row: 2, col: 2 }
          },
          white: null
        }
      },
      nextGameState: cloneJson(currentSnapshot.gameState),
      playbackEvents: [{ type: 'selection_marker', phase: 1 }]
    }),
    buildFinalResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'super_attraction_selected',
        applied: true,
        completed: true,
        from: { row: 2, col: 2 },
        to: { row: 5, col: 5 },
        destroyed: [{ row: 4, col: 4 }]
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: { black: null, white: null }
      },
      nextGameState: {
        ...cloneJson(currentSnapshot.gameState),
        turnNumber: 13
      },
      playbackEvents: [{ type: 'move', phase: 1 }]
    }),
    expectedTransportState: {
      type: 'SUPER_ATTRACTION_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 2 }
    }
  },
  {
    label: 'BOARD_EXPANSION_GOD',
    pendingType: 'BOARD_EXPANSION_GOD',
    modulePath: '../game/card-effects/board-expansion',
    handlerName: 'handleBoardExpansionSelection',
    actionField: 'expansionTarget',
    firstTarget: { row: 0, col: 0 },
    secondTarget: { row: 6, col: 8 },
    snapshotGameStateOverrides: {
      board: createBoard(7, 9),
      boardConfig: { rows: 7, cols: 9, standard8x8: false }
    },
    createRoomBoardConfig: { rows: 7, cols: 9, standard8x8: false },
    initialPending: {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    },
    intermediatePending: {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 1,
      maxSelections: 2,
      selectedTargets: [{ row: 0, col: 0 }]
    },
    buildFirstResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'board_expansion_first_selected',
        applied: true,
        completed: false,
        selectedCount: 1,
        maxSelections: 2,
        selectedTargets: [{ row: 0, col: 0 }]
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: {
          black: {
            type: 'BOARD_EXPANSION_GOD',
            stage: 'selectTarget',
            selectedCount: 1,
            maxSelections: 2,
            selectedTargets: [{ row: 0, col: 0 }]
          },
          white: null
        }
      },
      nextGameState: cloneJson(currentSnapshot.gameState),
      playbackEvents: []
    }),
    buildFinalResult: (currentSnapshot, context) => {
      const target = (context && context.secondTarget) || { row: 7, col: 7 };
      return ({
      ok: true,
      rawEvents: [{
        type: 'board_expansion_selected',
        applied: true,
        completed: true,
        target,
        selectedTargets: [{ row: 0, col: 0 }, target],
        sources: [{ row: 0, col: 0 }, target],
        added: [
          { row: -1, col: 0 },
          { row: -1, col: -1 },
          { row: 0, col: -1 },
          { row: target.row, col: target.col + 1 },
          { row: target.row + 1, col: target.col + 1 },
          { row: target.row + 1, col: target.col }
        ]
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: { black: null, white: null }
      },
      nextGameState: {
        ...cloneJson(currentSnapshot.gameState),
        turnNumber: 13
      },
      playbackEvents: [{ type: 'board_expand', phase: 1 }]
    });
    },
    expectedTransportState: {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedTargets: [{ row: 0, col: 0 }],
      selectedCount: 1,
      maxSelections: 2
    }
  },
  {
    label: 'BOARD_SHRINK_GOD',
    pendingType: 'BOARD_SHRINK_GOD',
    modulePath: '../game/card-effects/board-shrink',
    handlerName: 'handleBoardShrinkSelection',
    actionField: 'shrinkTarget',
    firstTarget: { row: 0, col: 0 },
    secondTarget: { row: 0, col: 1 },
    initialPending: {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01'
    },
    intermediatePending: {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01',
      firstTarget: { row: 0, col: 0 }
    },
    buildFirstResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'board_shrink_selected',
        applied: true,
        completed: false,
        firstTarget: { row: 0, col: 0 }
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: {
          black: {
            type: 'BOARD_SHRINK_GOD',
            stage: 'selectTarget',
            cardId: 'board_shrink_god_01',
            firstTarget: { row: 0, col: 0 }
          },
          white: null
        }
      },
      nextGameState: cloneJson(currentSnapshot.gameState),
      playbackEvents: [{ type: 'selection_marker', phase: 1 }]
    }),
    buildFinalResult: (currentSnapshot) => ({
      ok: true,
      rawEvents: [{
        type: 'board_shrink_selected',
        applied: true,
        completed: true,
        firstTarget: { row: 0, col: 0 },
        target: { row: 0, col: 1 },
        lineKey: 'row:0',
        lineTargets: Array.from({ length: 8 }, (_, col) => ({ row: 0, col }))
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: { black: null, white: null }
      },
      nextGameState: {
        ...cloneJson(currentSnapshot.gameState),
        turnNumber: 13
      },
      playbackEvents: [{ type: 'board_shrink', phase: 1 }]
    }),
    expectedTransportState: {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      firstTarget: { row: 0, col: 0 }
    }
  }
];

describe.each(CASES)('$label authoritative multi-stage contract', ({
  pendingType,
  modulePath,
  handlerName,
  actionField,
  firstTarget,
  secondTarget,
  snapshotGameStateOverrides,
  createRoomBoardConfig,
  initialPending,
  intermediatePending,
  buildFirstResult,
  buildFinalResult,
  expectedTransportState
}) => {
  let dom;
  let publishBodies;
  let roomCreateSnapshot;
  let runTurnMock;
  let authoritativeSnapshotFactory;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;
    global.isProcessing = false;
    global.isCardAnimating = false;

    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.posToNotation = jest.fn((row, col) => `${row},${col}`);
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.waitForPlaybackIdle = jest.fn(async () => {});
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
    global.isGameOver = jest.fn(() => false);

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    runTurnMock = jest.fn();
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: (...args) => runTurnMock(...args)
    };
    window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    roomCreateSnapshot = createSnapshot(60, initialPending, snapshotGameStateOverrides);
    global.gameState = roomCreateSnapshot.gameState;
    global.cardState = roomCreateSnapshot.cardState;

    publishBodies = [];
    authoritativeSnapshotFactory = () => ({
      stateVersion: 61,
      gameState: cloneJson(global.gameState),
      cardState: cloneJson(global.cardState)
    });

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const pathName = parsedUrl.pathname;

      if (pathName === '/api/match/create') {
        const payload = {
          ok: true,
          roomId: 'MUL',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: roomCreateSnapshot.stateVersion,
          snapshot: cloneJson(roomCreateSnapshot)
        };
        if (createRoomBoardConfig) {
          payload.roomBoardConfig = cloneJson(createRoomBoardConfig);
        }
        return jsonResponse(200, payload);
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'MUL',
          stateVersion: 61,
          snapshot: authoritativeSnapshotFactory(),
          playbackEvents: []
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.gameState;
    delete global.cardState;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.posToNotation;
    delete global.SoundEngine;
    delete global.waitForPlaybackIdle;
    delete globalThis.waitForPlaybackIdle;
    delete global.isGameOver;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
  });

  test('first selection stays local and does not publish', async () => {
    runTurnMock.mockImplementation(() => buildFirstResult(roomCreateSnapshot, { firstTarget, secondTarget }));

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom(Object.assign(
      { serverUrl: 'http://localhost:8787', playerName: 'くろ' },
      createRoomBoardConfig ? { roomBoardConfig: cloneJson(createRoomBoardConfig) } : {}
    ));
    expect(created.ok).toBe(true);
    if (createRoomBoardConfig) {
      expect(client.getRoomBoardConfig()).toMatchObject(createRoomBoardConfig);
    }

    const handlers = require(modulePath);
    const result = await handlers[handlerName](firstTarget.row, firstTarget.col, 'black');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType,
      intermediatePreviewApplied: true
    }));
    expect(runTurnMock).toHaveBeenCalledTimes(1);
    expect(publishBodies).toHaveLength(0);
    expect(global.gameState.currentPlayer).toBe(global.BLACK);
    expect(global.gameState.turnNumber).toBe(12);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(intermediatePending);
    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('final selection publishes once with carried pendingSelectionState', async () => {
    roomCreateSnapshot = createSnapshot(60, intermediatePending, snapshotGameStateOverrides);
    global.gameState = roomCreateSnapshot.gameState;
    global.cardState = roomCreateSnapshot.cardState;

    runTurnMock.mockImplementation(() => buildFinalResult(roomCreateSnapshot, { firstTarget, secondTarget }));
    authoritativeSnapshotFactory = () => {
      const previewResult = runTurnMock.mock.results[0] && runTurnMock.mock.results[0].value;
      return {
        stateVersion: 61,
        _meta: createSnapshotMeta(61),
        gameState: cloneJson(previewResult.nextGameState),
        cardState: cloneJson(previewResult.nextCardState)
      };
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom(Object.assign(
      { serverUrl: 'http://localhost:8787', playerName: 'くろ' },
      createRoomBoardConfig ? { roomBoardConfig: cloneJson(createRoomBoardConfig) } : {}
    ));
    expect(created.ok).toBe(true);
    if (createRoomBoardConfig) {
      expect(client.getRoomBoardConfig()).toMatchObject(createRoomBoardConfig);
      expect(global.gameState.board).toHaveLength(7);
      expect(global.gameState.board[0]).toHaveLength(9);
    }

    const handlers = require(modulePath);
    const result = await handlers[handlerName](secondTarget.row, secondTarget.col, 'black');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType,
      publishedByNetwork: true,
      playbackEvents: []
    }));
    expect(runTurnMock).toHaveBeenCalledTimes(1);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual(expect.objectContaining({
      player: 'black',
      [actionField]: secondTarget,
      pendingSelectionState: expect.objectContaining(expectedTransportState)
    }));
    if (initialPending && typeof initialPending.cardId === 'string' && initialPending.cardId) {
      expect(publishBodies[0].params.pendingSelectionState).toEqual(expect.objectContaining({
        cardId: initialPending.cardId
      }));
      expect(publishBodies[0].params.useCardId).toBeUndefined();
      expect(publishBodies[0].params.useCardOwnerKey).toBeUndefined();
    }
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.gameState.turnNumber).toBe(13);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });
});

describe('BOARD_SHRINK_WILL authoritative three-stage network contract', () => {
  let dom;
  let publishBodies;
  let roomCreateSnapshot;
  let runTurnMock;
  let authoritativeSnapshotFactory;

  const initialPending = {
    type: 'BOARD_SHRINK_WILL',
    stage: 'selectTarget',
    cardId: 'board_shrink_01',
    selectedTargets: [],
    selectedCount: 0,
    maxSelections: 3
  };
  const firstTarget = { row: 0, col: 0 };
  const secondTarget = { row: 0, col: 1 };
  const finalTarget = { row: 0, col: 2 };

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;
    global.isProcessing = false;
    global.isCardAnimating = false;

    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.posToNotation = jest.fn((row, col) => `${row},${col}`);
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.waitForPlaybackIdle = jest.fn(async () => {});
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
    global.isGameOver = jest.fn(() => false);

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    runTurnMock = jest.fn();
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: (...args) => runTurnMock(...args)
    };
    window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    roomCreateSnapshot = createSnapshot(80, initialPending);
    global.gameState = roomCreateSnapshot.gameState;
    global.cardState = roomCreateSnapshot.cardState;

    publishBodies = [];
    authoritativeSnapshotFactory = () => ({
      stateVersion: 81,
      _meta: createSnapshotMeta(81),
      gameState: cloneJson(global.gameState),
      cardState: cloneJson(global.cardState)
    });

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const pathName = parsedUrl.pathname;

      if (pathName === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'SHR',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: roomCreateSnapshot.stateVersion,
          snapshot: cloneJson(roomCreateSnapshot)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'SHR',
          stateVersion: 81,
          snapshot: authoritativeSnapshotFactory(),
          playbackEvents: []
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.gameState;
    delete global.cardState;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.posToNotation;
    delete global.SoundEngine;
    delete global.waitForPlaybackIdle;
    delete globalThis.waitForPlaybackIdle;
    delete global.isGameOver;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
  });

  function buildIntermediateResult(currentSnapshot, selectedTargets) {
    return {
      ok: true,
      rawEvents: [{
        type: 'board_shrink_selected',
        applied: true,
        completed: false,
        selectedTargets,
        selectedCount: selectedTargets.length,
        maxSelections: 3,
        remainingSelections: 3 - selectedTargets.length
      }],
      nextCardState: {
        ...cloneJson(currentSnapshot.cardState),
        pendingEffectByPlayer: {
          black: {
            type: 'BOARD_SHRINK_WILL',
            stage: 'selectTarget',
            cardId: 'board_shrink_01',
            selectedTargets,
            selectedCount: selectedTargets.length,
            maxSelections: 3
          },
          white: null
        }
      },
      nextGameState: cloneJson(currentSnapshot.gameState),
      playbackEvents: []
    };
  }

  test('first two selections stay local and final selection publishes carried selectedTargets', async () => {
    const createdSnapshot = cloneJson(roomCreateSnapshot);
    runTurnMock
      .mockImplementationOnce(() => buildIntermediateResult(createdSnapshot, [firstTarget]))
      .mockImplementationOnce(() => buildIntermediateResult({
        gameState: global.gameState,
        cardState: global.cardState
      }, [firstTarget, secondTarget]))
      .mockImplementationOnce(() => ({
        ok: true,
        rawEvents: [{
          type: 'board_shrink_selected',
          applied: true,
          completed: true,
          selectedTargets: [firstTarget, secondTarget, finalTarget],
          changedTargets: [firstTarget, secondTarget, finalTarget]
        }],
        nextCardState: {
          ...cloneJson(global.cardState),
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: {
          ...cloneJson(global.gameState),
          turnNumber: 13
        },
        playbackEvents: [{ type: 'board_shrink', phase: 1 }]
      }));
    authoritativeSnapshotFactory = () => {
      const previewResult = runTurnMock.mock.results[2] && runTurnMock.mock.results[2].value;
      return {
        stateVersion: 81,
        _meta: createSnapshotMeta(81),
        gameState: cloneJson(previewResult.nextGameState),
        cardState: cloneJson(previewResult.nextCardState)
      };
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const handlers = require('../game/card-effects/board-shrink');

    const firstResult = await handlers.handleBoardShrinkSelection(firstTarget.row, firstTarget.col, 'black');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstResult).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'BOARD_SHRINK_WILL',
      intermediatePreviewApplied: true
    }));
    expect(publishBodies).toHaveLength(0);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      selectedTargets: [firstTarget],
      selectedCount: 1,
      maxSelections: 3
    }));

    const secondResult = await handlers.handleBoardShrinkSelection(secondTarget.row, secondTarget.col, 'black');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(secondResult).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'BOARD_SHRINK_WILL',
      intermediatePreviewApplied: true
    }));
    expect(publishBodies).toHaveLength(0);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      selectedTargets: [firstTarget, secondTarget],
      selectedCount: 2,
      maxSelections: 3
    }));

    const finalResult = await handlers.handleBoardShrinkSelection(finalTarget.row, finalTarget.col, 'black');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(finalResult).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'BOARD_SHRINK_WILL',
      publishedByNetwork: true,
      playbackEvents: []
    }));
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual(expect.objectContaining({
      player: 'black',
      shrinkTarget: finalTarget,
      pendingSelectionState: expect.objectContaining({
        type: 'BOARD_SHRINK_WILL',
        stage: 'selectTarget',
        cardId: 'board_shrink_01',
        selectedTargets: [firstTarget, secondTarget],
        selectedCount: 2,
        maxSelections: 3
      })
    }));
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.gameState.turnNumber).toBe(13);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });
});
