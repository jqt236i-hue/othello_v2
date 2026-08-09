import * as path from 'path';
import { JSDOM } from 'jsdom';

import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';

const PRESENTATION_PATH = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForMilestoneBeforeHandler<T>(
  milestone: Promise<T>,
  handler: Promise<unknown>,
  prematureMessage: string
): Promise<T> {
  return Promise.race([
    milestone,
    handler.then(
      () => Promise.reject(new Error(prematureMessage)),
      (error) => Promise.reject(error)
    )
  ]);
}

const CASES = [
  {
    label: 'TEMPT_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'tempt.js'),
    handlerName: 'handleTemptSelection',
    pendingType: 'TEMPT_WILL',
    rawEventType: 'tempt_selected',
    cardId: 'tempt_01',
    expectSelectionBoardSyncRequest: true,
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 21,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'WORK', remainingOwnerTurns: 2 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'WORK', remainingOwnerTurns: 2 })
        })
      ]));
    }
  },
  {
    label: 'CAPTURE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'capture.js'),
    handlerName: 'handleCaptureSelection',
    pendingType: 'CAPTURE_WILL',
    rawEventType: 'capture_selected',
    cardId: 'capture_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      hands: {
        ...cloneJson(cardState.hands),
        black: ['captured_01']
      },
      markers: []
    }),
    assertAppliedState: ({ cardState, emitLogAdded }) => {
      expect(cardState.hands.black).toEqual(['captured_01']);
      expect(cardState.markers).toEqual([]);
      expect(emitLogAdded).not.toHaveBeenCalled();
    }
  },
  {
    label: 'DESTROY_ONE_STONE',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'destroy.js'),
    handlerName: 'handleDestroySelection',
    pendingType: 'DESTROY_ONE_STONE',
    rawEventType: 'destroy_selected',
    rawEvent: { destroyed: true },
    cardId: 'destroy_01',
    initialBoardEntries: [
      { row: 2, col: 2, value: -1 }
    ],
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: []
    }),
    buildNextGameState: (gameState) => {
      const nextGameState = cloneJson(gameState);
      nextGameState.board[2][2] = 0;
      nextGameState.currentPlayer = global.WHITE;
      nextGameState.turnNumber = 12;
      return nextGameState;
    },
    assertAppliedState: ({ gameState, cardState }) => {
      expect(gameState.board[2][2]).toBe(0);
      expect(cardState.markers).toEqual([]);
    }
  },
  {
    label: 'REVERSE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'reverse-will.js'),
    handlerName: 'handleReverseWillSelection',
    pendingType: 'REVERSE_WILL',
    rawEventType: 'reverse_will_flipped',
    rawEvent: {
      details: [
        { row: 2, col: 2, ownerBefore: 'white', ownerAfter: 'black' }
      ]
    },
    cardId: 'reverse_will_01',
    initialBoardEntries: [
      { row: 2, col: 2, value: -1 }
    ],
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: []
    }),
    buildNextGameState: (gameState) => {
      const nextGameState = cloneJson(gameState);
      nextGameState.board[2][2] = 1;
      nextGameState.currentPlayer = global.WHITE;
      nextGameState.turnNumber = 12;
      return nextGameState;
    },
    assertAppliedState: ({ gameState, cardState }) => {
      expect(gameState.board[2][2]).toBe(1);
      expect(cardState.markers).toEqual([]);
    }
  },
  {
    label: 'EXTEND_LIFE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'extend-life.js'),
    handlerName: 'handleExtendLifeSelection',
    pendingType: 'EXTEND_LIFE_WILL',
    rawEventType: 'extend_life_selected',
    cardId: 'extend_life_01',
    initialMarkers: [
      {
        id: 81,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    ],
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 81,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 6 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 6 })
        })
      ]));
    }
  },
  {
    label: 'EXTEND_LIFE_GOD',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'extend-life.js'),
    handlerName: 'handleExtendLifeSelection',
    pendingType: 'EXTEND_LIFE_GOD',
    rawEventType: 'extend_life_selected',
    cardId: 'extend_life_god_01',
    initialMarkers: [
      {
        id: 91,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    ],
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 91,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 12 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 12 })
        })
      ]));
    }
  },
  {
    label: 'CORROSION_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'extend-life.js'),
    handlerName: 'handleCorrosionSelection',
    pendingType: 'CORROSION_WILL',
    rawEventType: 'corrosion_will_resolved',
    rawEvent: { affectedCount: 1 },
    cardId: 'corrosion_01',
    initialMarkers: [
      {
        id: 101,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'WORK', remainingOwnerTurns: 5 }
      }
    ],
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 101,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'white',
          data: { type: 'WORK', remainingOwnerTurns: 2 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'white',
          data: expect.objectContaining({ type: 'WORK', remainingOwnerTurns: 2 })
        })
      ]));
    }
  },
  {
    label: 'SEED_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'seed.js'),
    handlerName: 'handleSeedSelection',
    pendingType: 'SEED_WILL',
    rawEventType: 'seed_selected',
    cardId: 'seed_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 111,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'SEED', remainingOwnerTurns: 5 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'SEED', remainingOwnerTurns: 5 })
        })
      ]));
    }
  },
  {
    label: 'FREEZE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'freeze.js'),
    handlerName: 'handleFreezeSelection',
    pendingType: 'FREEZE_WILL',
    rawEventType: 'freeze_selected',
    cardId: 'freeze_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 121,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'FREEZE', remainingOwnerTurns: 5 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'FREEZE', remainingOwnerTurns: 5 })
        })
      ]));
    }
  },
  {
    label: 'GUARD_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'guard.js'),
    handlerName: 'handleGuardSelection',
    pendingType: 'GUARD_WILL',
    rawEventType: 'guard_selected',
    cardId: 'guard_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 31,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 3 })
        })
      ]));
    }
  },
  {
    label: 'GUARDIAN_GOD',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'guard.js'),
    handlerName: 'handleGuardSelection',
    pendingType: 'GUARDIAN_GOD',
    rawEventType: 'guard_selected',
    cardId: 'guardian_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 41,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 10 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 10 })
        })
      ]));
    }
  },
  {
    label: 'LIVING_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'living-will.js'),
    handlerName: 'handleLivingWillSelection',
    pendingType: 'LIVING_WILL',
    rawEventType: 'living_will_selected',
    cardId: 'living_will_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 51,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: {
            type: 'LIVING_WILL',
            baseline: { owner: 'black', value: 1, markers: [] }
          }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'LIVING_WILL' })
        })
      ]));
    }
  },
  {
    label: 'CLONE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'clone.js'),
    handlerName: 'handleCloneSelection',
    pendingType: 'CLONE_WILL',
    rawEventType: 'clone_selected',
    cardId: 'clone_01',
    expectPublishOnlySelection: true,
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 61,
          kind: 'specialStone',
          row: 3,
          col: 4,
          owner: 'black',
          data: { type: 'DRAGON', remainingOwnerTurns: 2 }
        }
      ]
    }),
    buildNextGameState: (gameState) => {
      const nextGameState = cloneJson(gameState);
      nextGameState.board[3][3] = 1;
      nextGameState.board[3][4] = 1;
      nextGameState.currentPlayer = global.WHITE;
      nextGameState.turnNumber = 12;
      return nextGameState;
    },
    assertAppliedState: ({ gameState, cardState }) => {
      expect(gameState.board[3][3]).toBe(1);
      expect(gameState.board[3][4]).toBe(1);
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          col: 4,
          owner: 'black',
          data: expect.objectContaining({ type: 'DRAGON', remainingOwnerTurns: 2 })
        })
      ]));
    }
  },
  {
    label: 'BLOCKADE_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'blockade.js'),
    handlerName: 'handleBlockadeSelection',
    pendingType: 'BLOCKADE_WILL',
    rawEventType: 'blockade_selected',
    cardId: 'blockade_01',
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 'blockade_1',
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
        }
      ]
    }),
    assertAppliedState: ({ cardState }) => {
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'BLOCKADE', remainingOwnerTurns: 3 })
        })
      ]));
    }
  },
  {
    label: 'METEOR_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'meteor.js'),
    handlerName: 'handleMeteorSelection',
    pendingType: 'METEOR_WILL',
    rawEventType: 'meteor_selected',
    cardId: 'meteor_01',
    expectPublishOnlySelection: true,
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 71,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'METEOR_HOLE' }
        }
      ]
    }),
    buildNextGameState: (gameState) => {
      const nextGameState = cloneJson(gameState);
      nextGameState.board[2][2] = 0;
      nextGameState.currentPlayer = global.WHITE;
      nextGameState.turnNumber = 12;
      return nextGameState;
    },
    assertAppliedState: ({ gameState, cardState }) => {
      expect(gameState.board[2][2]).toBe(0);
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          data: expect.objectContaining({ type: 'METEOR_HOLE' })
        })
      ]));
    }
  },
  {
    label: 'CELL_TELEPORT_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'teleport.js'),
    handlerName: 'handleTeleportSelection',
    pendingType: 'CELL_TELEPORT_WILL',
    rawEventType: 'teleport_selected',
    cardId: 'cell_teleport_01',
    initialBoardEntries: [
      { row: 2, col: 2, value: 1 }
    ],
    expectPublishOnlySelection: true,
    buildNextCardState: (cardState) => ({
      ...cloneJson(cardState),
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          id: 72,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'METEOR_HOLE' }
        }
      ]
    }),
    buildNextGameState: (gameState) => {
      const nextGameState = cloneJson(gameState);
      nextGameState.board[2][2] = 0;
      nextGameState.boardExpansion = {
        cells: [
          { row: -1, col: 2, owner: 1 }
        ]
      };
      nextGameState.currentPlayer = global.WHITE;
      nextGameState.turnNumber = 12;
      return nextGameState;
    },
    assertAppliedState: ({ gameState, cardState }) => {
      expect(gameState.board[2][2]).toBe(0);
      expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: -1, col: 2, owner: 1 })
      ]));
      expect(cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          data: expect.objectContaining({ type: 'METEOR_HOLE' })
        })
      ]));
    }
  }
];

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

function createLiveResponseSnapshot(stateVersion) {
  return {
    stateVersion,
    _meta: createSnapshotMeta(stateVersion),
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createSnapshot(stateVersion, pendingType, cardId, options = {}) {
  const board = createBoard(8, 8);
  for (const entry of options.initialBoardEntries || []) {
    if (
      entry
      && Number.isInteger(entry.row)
      && Number.isInteger(entry.col)
      && board[entry.row]
      && Object.prototype.hasOwnProperty.call(board[entry.row], entry.col)
    ) {
      board[entry.row][entry.col] = entry.value;
    }
  }

  return {
    stateVersion,
    _meta: createSnapshotMeta(stateVersion),
    gameState: {
      currentPlayer: 1,
      turnNumber: 11,
      board
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: {
        black: { type: pendingType, stage: 'selectTarget', cardId, pendingEffectId: options.pendingEffectId || 'pending_4_1' },
        white: null
      },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: cloneJson(options.initialMarkers || []),
      discard: [],
      turnIndex: 4
    }
  };
}

describe.each(CASES)('NetworkMatchClient $label deferred publish', (caseConfig) => {
  const {
    modulePath,
    handlerName,
    pendingType,
    rawEventType,
    rawEvent,
    buildNextCardState,
    buildNextGameState,
    assertAppliedState,
    cardId,
    expectPublishOnlySelection,
    expectSelectionBoardSyncRequest
  } = caseConfig;
  let dom;
  let publishBodies;
  let runTurnMock;
  let trackerGate;
  let drainGate;
  let activeHandlerPromise;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock(PRESENTATION_PATH, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[modulePath];

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;

    const initial = createSnapshot(20, pendingType, cardId, caseConfig);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.LOG_MESSAGES = {
      temptSelectPrompt: jest.fn(() => '相手の石を選んでください'),
      temptApplied: jest.fn(() => '誘惑を適用しました'),
      captureSelectPrompt: jest.fn(() => '特殊石を選んでください'),
      captureApplied: jest.fn(() => '捕獲を適用しました')
    };
    global.posToNotation = jest.fn(() => 'C3');
    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn(() => true);
    global.renderCardUI = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.waitForPlaybackIdle = jest.fn(async () => {});
    global.onTurnStart = jest.fn(async () => ({
      playbackEvents: [{ type: 'draw', phase: 2 }]
    }));
    global.isGameOver = jest.fn(() => false);
    global.processCpuTurn = jest.fn();
    global.requestAnimationFrame = jest.fn((callback) => {
      if (typeof callback === 'function') callback();
      return 1;
    });
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    const nextCardState = buildNextCardState(global.cardState);
    const nextGameState = typeof buildNextGameState === 'function'
      ? buildNextGameState(global.gameState)
      : {
          ...global.gameState,
          currentPlayer: global.WHITE,
          turnNumber: 12
        };
    const appliedRawEvent = {
      type: rawEventType,
      applied: true,
      ...(rawEvent || {})
    };
    runTurnMock = expectPublishOnlySelection
      ? jest.fn(() => {
        throw new Error(`${pendingType} must not locally preview network target selection`);
      })
      : jest.fn(() => ({
        ok: true,
        rawEvents: [appliedRawEvent],
        nextCardState,
        nextGameState,
        playbackEvents: [{ type: 'status_applied', phase: 1 }]
      }));
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: runTurnMock
    };
    window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    publishBodies = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const pathName = parsedUrl.pathname;

      if (pathName === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'GTD',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          snapshot: createSnapshot(20, pendingType, cardId, caseConfig)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        const previewResult = runTurnMock.mock.results[0] && runTurnMock.mock.results[0].value;
        const authoritativeSnapshot = expectPublishOnlySelection
          ? {
              stateVersion: 21,
              _meta: createSnapshotMeta(21),
              gameState: cloneJson(nextGameState),
              cardState: cloneJson(nextCardState)
            }
          : (
              previewResult && previewResult.nextGameState && previewResult.nextCardState
                ? {
                    stateVersion: 21,
                    _meta: createSnapshotMeta(21),
                    gameState: cloneJson(previewResult.nextGameState),
                    cardState: cloneJson(previewResult.nextCardState)
                  }
                : createLiveResponseSnapshot(21)
            );
        return jsonResponse(200, {
          ok: true,
          roomId: 'GTD',
          stateVersion: 21,
          operationId: body.operationId,
          presentationCursor: { visualSeq: 1, stateVersion: 21 },
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 21
            }
            : authoritativeSnapshot
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(async () => {
    if (trackerGate) trackerGate.resolve({ ok: true, visualSeq: 1 });
    if (drainGate) drainGate.resolve();
    if (activeHandlerPromise) {
      await Promise.allSettled([activeHandlerPromise]);
    }
    trackerGate = null;
    drainGate = null;
    activeHandlerPromise = null;
    jest.restoreAllMocks();
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }
    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.gameState;
    delete global.cardState;
    delete global.LOG_MESSAGES;
    delete global.posToNotation;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.waitForPlaybackIdle;
    delete global.onTurnStart;
    delete global.isGameOver;
    delete global.processCpuTurn;
    delete global.requestAnimationFrame;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
    delete globalThis.waitForPlaybackIdle;
  });

  test('selection publishes only the deferred command once', async () => {
    const playbackStateModule = require('../ui/playback-state-manager.js');
    trackerGate = createDeferred<any>();
    drainGate = createDeferred<void>();
    const trackerEntered = createDeferred<void>();
    const drainEntered = createDeferred<void>();
    const trackerSpy = jest.spyOn(playbackStateModule, 'waitForNetworkVisualSeq')
      .mockImplementation(() => {
        trackerEntered.resolve();
        return trackerGate.promise;
      });
    const drainSpy = jest.spyOn(playbackStateModule, 'waitForVisualPlaybackDrain')
      .mockImplementation(() => {
        drainEntered.resolve();
        return drainGate.promise;
      });
    const selectionFlowModule = require('../game/card-effects/selection-flow.ts');
    const setSignalBridgeSpy = jest.spyOn(selectionFlowModule, 'setSignalBridge');
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();
    expect(setSignalBridgeSpy).toHaveBeenCalled();
    const signalBridge = setSignalBridgeSpy.mock.calls.at(-1)[0];
    expect(signalBridge).toEqual(expect.objectContaining({
      waitForPlaybackIdle: expect.any(Function),
      waitForAuthoritativeVisualSettlement: expect.any(Function)
    }));
    const bridgeSettlementSpy = jest.spyOn(signalBridge, 'waitForAuthoritativeVisualSettlement');
    const armBoardUpdateDuringPlaybackSpy = jest.spyOn(signalBridge, 'armBoardUpdateDuringPlayback');
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const handlers = require(modulePath);
    const handlerPromise = Promise.resolve(handlers[handlerName](2, 2, 'black'));
    activeHandlerPromise = handlerPromise;
    let handlerSettled = false;
    void handlerPromise.then(
      () => { handlerSettled = true; },
      () => { handlerSettled = true; }
    );
    await waitForMilestoneBeforeHandler(
      trackerEntered.promise,
      handlerPromise,
      `${pendingType} handler settled before exact visual tracking began`
    );

    const presentation = require(PRESENTATION_PATH);
    const registryActionConfig = PendingSelectionRegistry.getPendingSelectionActionConfig(pendingType);

    expect(registryActionConfig).toEqual(expect.objectContaining({
      field: expect.any(String)
    }));
    expect(publishBodies).toHaveLength(1);
    if (expectPublishOnlySelection) {
      expect(runTurnMock).not.toHaveBeenCalled();
    }
    const action = expectPublishOnlySelection
      ? publishBodies[0].action
      : runTurnMock.mock.calls[0][3];
    const actionParamKey = registryActionConfig.field;
    expect(action).toEqual(expect.objectContaining({
      deferNetworkPublish: true
    }));
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual(expect.objectContaining({
      player: 'black',
      [actionParamKey]: action[actionParamKey],
      pendingSelectionState: {
        type: pendingType,
        stage: 'selectTarget',
        cardId,
        pendingEffectId: 'pending_4_1'
      }
    }));
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    const operationId = publishBodies[0].operationId;
    expect(operationId).toEqual(expect.any(String));
    expect(operationId).not.toBe('');
    expect(bridgeSettlementSpy).toHaveBeenCalledTimes(1);
    expect(bridgeSettlementSpy.mock.calls[0][0]).toEqual(expect.objectContaining({
      ok: true,
      operationId,
      presentationCursor: { visualSeq: 1, stateVersion: 21 }
    }));
    expect(trackerSpy).toHaveBeenCalledTimes(1);
    expect(trackerSpy).toHaveBeenCalledWith(1, { operationId });
    expect(drainSpy).not.toHaveBeenCalled();
    expect(global.waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(global.gameState.turnNumber).toBe(12);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(handlerSettled).toBe(false);
    expect(selectionFlowModule.isSelectionSettlementLocked()).toBe(true);

    trackerGate.resolve({ ok: true, visualSeq: 1 });
    await waitForMilestoneBeforeHandler(
      drainEntered.promise,
      handlerPromise,
      `${pendingType} handler settled before visual playback drain began`
    );
    expect(drainSpy).toHaveBeenCalledTimes(1);
    const drainOptions = drainSpy.mock.calls[0][0];
    expect(drainOptions).toEqual(expect.objectContaining({
      root: window,
      getCardState: expect.any(Function),
      disableTimeout: true
    }));
    const currentCardState = (window as any).cardState || global.cardState;
    expect(drainOptions.getCardState()).toBe(currentCardState);
    expect(currentCardState).toEqual(expect.objectContaining({
      pendingEffectByPlayer: expect.objectContaining({ black: null })
    }));
    expect(selectionFlowModule.isSelectionSettlementLocked()).toBe(true);
    expect(handlerSettled).toBe(false);
    expect(global.waitForPlaybackIdle).not.toHaveBeenCalled();

    drainGate.resolve();
    const handlerResult = await handlerPromise;
    expect(handlerResult).toEqual(expect.objectContaining({ ok: true }));
    expect(selectionFlowModule.isSelectionSettlementLocked()).toBe(false);
    expect(publishBodies).toHaveLength(1);
    if (expectPublishOnlySelection) {
      expect(runTurnMock).not.toHaveBeenCalled();
    }
    expect(bridgeSettlementSpy).toHaveBeenCalledTimes(1);
    expect(trackerSpy).toHaveBeenCalledTimes(1);
    expect(drainSpy).toHaveBeenCalledTimes(1);
    expect(global.waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(presentation.emitPresentationEvent).not.toHaveBeenCalled();
    assertAppliedState({
      gameState: global.gameState,
      cardState: global.cardState,
      emitLogAdded: global.emitLogAdded
    });
    if (expectSelectionBoardSyncRequest) {
      const matchingCallIndex = armBoardUpdateDuringPlaybackSpy.mock.calls.findIndex(([context]) => (
        context
        && context.source === 'selection-flow'
        && context.reason === 'selection_state_sync'
      ));
      expect(matchingCallIndex).toBeGreaterThanOrEqual(0);
      expect(armBoardUpdateDuringPlaybackSpy.mock.results[matchingCallIndex]).toEqual({
        type: 'return',
        value: true
      });
    }
  });
});
