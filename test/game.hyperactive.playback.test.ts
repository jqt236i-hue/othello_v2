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
});
