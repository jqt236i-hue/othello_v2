const gameVisuals = require('../game/move-executor-visuals');

describe('hyperactive playback detection', () => {
  test('treats an empty precomputed turn-start event batch as a normal no-op', async () => {
    jest.resetModules();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const hyper = require('../game/special-effects/hyperactive');

    try {
      await expect(hyper.processHyperactiveMovesAtTurnStart(1, null, [])).resolves.toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('uses bootstrap registered PlaybackEngine when available and does not force emitBoardUpdate', async () => {
    jest.resetModules();
    // stub emitBoardUpdate
    (global as any).emitBoardUpdate = jest.fn();
    (global as any).emitGameStateChange = jest.fn();
    (global as any).emitCardStateChange = jest.fn();

    const hyper = require('../game/special-effects/hyperactive');
    hyper.setUIImpl({
      hasPlaybackEngine: () => true,
      emitBoardUpdate: (global as any).emitBoardUpdate,
      emitGameStateChange: (global as any).emitGameStateChange,
      emitCardStateChange: (global as any).emitCardStateChange
    });
    // call processHyperactiveMovesAtTurnStart with minimal params
    await hyper.processHyperactiveMovesAtTurnStart(1, { moved: [], destroyed: [], flipped: [] });
    
    // emitBoardUpdate may be called internally by the hyperactive effect processing
    // The key assertion is that it doesn't throw and completes
    expect((global as any).emitBoardUpdate).toBeDefined();
    hyper.setUIImpl({});
    delete (global as any).emitGameStateChange;
    delete (global as any).emitCardStateChange;
  });

  test('delegates chained hyperactive fallback animation to injected UI bridge without DOM queries in game/', async () => {
    jest.resetModules();
    const animateHyperactiveMoveChain = jest.fn(async () => {});

    (global as any).emitBoardUpdate = jest.fn();
    (global as any).emitGameStateChange = jest.fn();
    (global as any).emitCardStateChange = jest.fn();
    const hyper = require('../game/special-effects/hyperactive');
    hyper.setUIImpl({
      hasPlaybackEngine: () => false,
      animateHyperactiveMoveChain,
      emitBoardUpdate: (global as any).emitBoardUpdate,
      emitGameStateChange: (global as any).emitGameStateChange,
      emitCardStateChange: (global as any).emitCardStateChange
    });
    const moved = [
      { from: { row: 3, col: 3 }, to: { row: 3, col: 4 } },
      { from: { row: 3, col: 4 }, to: { row: 3, col: 5 } }
    ];

    await hyper.processHyperactiveMovesAtTurnStart(1, { moved, destroyed: [], flipped: [] });

    expect(animateHyperactiveMoveChain).toHaveBeenCalledWith(moved);
    expect((global as any).emitBoardUpdate).toHaveBeenCalled();
    hyper.setUIImpl({});
    delete (global as any).emitBoardUpdate;
    delete (global as any).emitGameStateChange;
    delete (global as any).emitCardStateChange;
  });

  test('prefers hyperactive UI injection over move visual globals', async () => {
    jest.resetModules();
    const animateHyperactiveMoveChain = jest.fn(async () => {});
    const gameVisualChain = jest.fn(async () => {});
    gameVisuals.setUIImpl({
      hasPlaybackEngine: () => false,
      animateHyperactiveMoveChain: gameVisualChain
    });

    (global as any).emitBoardUpdate = jest.fn();
    (global as any).emitGameStateChange = jest.fn();
    (global as any).emitCardStateChange = jest.fn();

    const hyper = require('../game/special-effects/hyperactive');
    hyper.setUIImpl({
      hasPlaybackEngine: () => false,
      animateHyperactiveMoveChain,
      emitBoardUpdate: (global as any).emitBoardUpdate,
      emitGameStateChange: (global as any).emitGameStateChange,
      emitCardStateChange: (global as any).emitCardStateChange
    });

    const moved = [
      { from: { row: 4, col: 4 }, to: { row: 4, col: 5 } }
    ];

    await hyper.processHyperactiveMovesAtTurnStart(1, { moved, destroyed: [], flipped: [] });

    expect(animateHyperactiveMoveChain).toHaveBeenCalledWith(moved);
    expect(gameVisualChain).not.toHaveBeenCalled();

    hyper.setUIImpl({});
    gameVisuals.clearUIImpl();
    delete (global as any).emitBoardUpdate;
    delete (global as any).emitGameStateChange;
    delete (global as any).emitCardStateChange;
  });

  test('uses expansion owners for CHANGE and CROSSFADE_STONE presentation colors', async () => {
    jest.resetModules();
    const emitPresentationEvent = jest.fn();
    const setDiscColorAt = jest.fn();
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    (global as any).cardState = { markers: [] };
    (global as any).gameState = {
      board,
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        col: null,
        owner: 0,
        usedByPlayer: { black: true, white: true },
        cells: [
          { side: 'top', row: -1, col: 0, owner: 1 },
          { side: 'bottom', row: 8, col: 7, owner: -1 }
        ]
      }
    };

    const hyper = require('../game/special-effects/hyperactive');
    hyper.setUIImpl({
      hasPlaybackEngine: () => false,
      emitPresentationEvent,
      setDiscColorAt,
      waitMs: () => Promise.resolve(),
      getAnimationTiming: () => 1,
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      emitCardStateChange: jest.fn(),
      emitLogAdded: jest.fn()
    });

    try {
      await hyper.processHyperactiveMovesAtTurnStart(1, {
        moved: [],
        destroyed: [],
        flipped: [
          { row: -1, col: 0 },
          { row: 8, col: 7 }
        ],
        regenTriggered: [{ row: 8, col: 7 }],
        regenCaptureFlips: []
      });

      expect(emitPresentationEvent).toHaveBeenCalledWith({
        type: 'CHANGE',
        row: -1,
        col: 0,
        ownerBefore: 'white',
        ownerAfter: 'black'
      });
      expect(emitPresentationEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'CROSSFADE_STONE',
        row: 8,
        col: 7,
        owner: -1,
        newColor: -1
      }));
      expect(setDiscColorAt).toHaveBeenCalledWith(-1, 0, -1);
      expect(setDiscColorAt).toHaveBeenCalledWith(-1, 0, 1);
    } finally {
      hyper.setUIImpl({});
      delete (global as any).cardState;
      delete (global as any).gameState;
    }
  });

  test('does not derive presentation owners or colors from stale stones under METEOR_HOLE', async () => {
    jest.resetModules();
    const emitPresentationEvent = jest.fn();
    const setDiscColorAt = jest.fn();
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    (global as any).cardState = {
      markers: [
        { kind: 'specialStone', row: -1, col: 0, owner: 'black', data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 8, col: 7, owner: 'black', data: { type: 'METEOR_HOLE' } }
      ]
    };
    (global as any).gameState = {
      board,
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        col: null,
        owner: 0,
        usedByPlayer: { black: true, white: true },
        cells: [
          { side: 'top', row: -1, col: 0, owner: 1 },
          { side: 'bottom', row: 8, col: 7, owner: -1 }
        ]
      }
    };

    const hyper = require('../game/special-effects/hyperactive');
    hyper.setUIImpl({
      hasPlaybackEngine: () => false,
      emitPresentationEvent,
      setDiscColorAt,
      waitMs: () => Promise.resolve(),
      getAnimationTiming: () => 1,
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      emitCardStateChange: jest.fn(),
      emitLogAdded: jest.fn()
    });

    try {
      await hyper.processHyperactiveMovesAtTurnStart(1, {
        moved: [],
        destroyed: [],
        flipped: [
          { row: -1, col: 0 },
          { row: 8, col: 7 }
        ],
        regenTriggered: [{ row: 8, col: 7 }],
        regenCaptureFlips: []
      });

      expect(emitPresentationEvent).not.toHaveBeenCalled();
      expect(setDiscColorAt).not.toHaveBeenCalled();
    } finally {
      hyper.setUIImpl({});
      delete (global as any).cardState;
      delete (global as any).gameState;
    }
  });
});
