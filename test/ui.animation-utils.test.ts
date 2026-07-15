import * as path from 'path';

const boardRendererPath = path.resolve(__dirname, '..', 'ui', 'board-renderer.ts');

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises(iterations = 8) {
  for (let index = 0; index < iterations; index += 1) await Promise.resolve();
}

describe('animation-utils board playback port', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock(boardRendererPath);
  });

  test('concurrent public wrappers share one ready writer and settle after every visual completes', async () => {
    const ready = deferred<void>();
    const fadeVisual = deferred<void>();
    const strongWillVisual = deferred<void>();
    const writerToken = { id: 7, frameToken: 'local:legacy-board-animation:1', mode: 'local' };
    const getBoardVisualControllerReady = jest.fn(() => ready.promise);
    const claimBoardVisualWriter = jest.fn(() => writerToken);
    const playBoardVisualPhase = jest.fn()
      .mockImplementationOnce(() => fadeVisual.promise)
      .mockImplementationOnce(() => strongWillVisual.promise);
    const settleBoardVisualWriter = jest.fn(async () => true);
    jest.doMock(boardRendererPath, () => ({
      getBoardVisualControllerReady,
      claimBoardVisualWriter,
      playBoardVisualPhase,
      settleBoardVisualWriter,
      getBoardCellClientRect: jest.fn()
    }));

    const animationUtils = require('../ui/animation-utils.js');
    const fade = animationUtils.animateFadeOutAt(1, 2, { createGhost: true, color: 1 });
    const strongWill = animationUtils.animateStrongWillApply(3, 4);

    expect(getBoardVisualControllerReady).toHaveBeenCalledTimes(1);
    expect(claimBoardVisualWriter).not.toHaveBeenCalled();
    expect(playBoardVisualPhase).not.toHaveBeenCalled();

    ready.resolve();
    await flushPromises();

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenNthCalledWith(1, writerToken, [{
      type: 'legacy_fade_out',
      row: 1,
      col: 2,
      options: { createGhost: true, color: 1 }
    }]);
    expect(playBoardVisualPhase).toHaveBeenNthCalledWith(2, writerToken, [{
      type: 'legacy_strong_will_apply',
      row: 3,
      col: 4
    }]);

    fadeVisual.resolve();
    await flushPromises();
    expect(settleBoardVisualWriter).not.toHaveBeenCalled();

    strongWillVisual.resolve();
    await Promise.all([fade, strongWill]);
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(settleBoardVisualWriter).toHaveBeenCalledWith(writerToken);
  });

  test('a wrapper arriving during settlement waits before claiming the next writer', async () => {
    const firstSettlement = deferred<void>();
    const firstToken = { id: 11, frameToken: 'local:legacy-board-animation:1', mode: 'local' };
    const secondToken = { id: 12, frameToken: 'local:legacy-board-animation:2', mode: 'local' };
    const getBoardVisualControllerReady = jest.fn(async () => undefined);
    const claimBoardVisualWriter = jest.fn()
      .mockReturnValueOnce(firstToken)
      .mockReturnValueOnce(secondToken);
    const playBoardVisualPhase = jest.fn(async () => undefined);
    const settleBoardVisualWriter = jest.fn()
      .mockImplementationOnce(() => firstSettlement.promise)
      .mockResolvedValueOnce(true);
    jest.doMock(boardRendererPath, () => ({
      getBoardVisualControllerReady,
      claimBoardVisualWriter,
      playBoardVisualPhase,
      settleBoardVisualWriter,
      getBoardCellClientRect: jest.fn()
    }));

    const animationUtils = require('../ui/animation-utils.js');
    const first = animationUtils.animateFadeOutAt(0, 0);
    await flushPromises();
    expect(settleBoardVisualWriter).toHaveBeenCalledWith(firstToken);

    const second = animationUtils.animateHyperactiveMove(
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { carryDisc: null }
    );
    await flushPromises();

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(1);

    firstSettlement.resolve();
    await first;
    await second;

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(playBoardVisualPhase).toHaveBeenNthCalledWith(2, secondToken, [{
      type: 'legacy_hyperactive_move',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
      options: { carryDisc: null }
    }]);
    expect(settleBoardVisualWriter).toHaveBeenNthCalledWith(2, secondToken);
  });

  test('recovers a failed shared-writer settlement before allowing a new wrapper to claim', async () => {
    const firstToken = { id: 21, frameToken: 'local:legacy-board-animation:1', mode: 'local' };
    const secondToken = { id: 22, frameToken: 'local:legacy-board-animation:2', mode: 'local' };
    const claimBoardVisualWriter = jest.fn()
      .mockReturnValueOnce(firstToken)
      .mockReturnValueOnce(secondToken);
    const playBoardVisualPhase = jest.fn(async () => undefined);
    const enterBoardVisualRecovery = jest.fn(() => true);
    const settleBoardVisualWriter = jest.fn()
      .mockRejectedValueOnce(new Error('initial_settlement_failed'))
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const releaseBoardVisualWriter = jest.fn();
    jest.doMock(boardRendererPath, () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter,
      playBoardVisualPhase,
      enterBoardVisualRecovery,
      settleBoardVisualWriter,
      releaseBoardVisualWriter,
      getBoardCellClientRect: jest.fn()
    }));

    const animationUtils = require('../ui/animation-utils.js');
    await expect(animationUtils.animateFadeOutAt(1, 1)).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed',
      eventType: 'legacy_fade_out'
    }));

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledWith(firstToken, expect.objectContaining({
      code: 'board_writer_settlement_failed'
    }));
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();

    await expect(animationUtils.animateStrongWillApply(2, 2)).resolves.toBeUndefined();
    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(2);
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(3);
    expect(settleBoardVisualWriter).toHaveBeenNthCalledWith(3, secondToken);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();
  });

  test('retains the shared writer and typed-rejects the next wrapper when recovery cannot settle', async () => {
    const retainedToken = { id: 31, frameToken: 'local:legacy-board-animation:1', mode: 'local' };
    const claimBoardVisualWriter = jest.fn(() => retainedToken);
    const playBoardVisualPhase = jest.fn(async () => undefined);
    const enterBoardVisualRecovery = jest.fn(() => true);
    const settleBoardVisualWriter = jest.fn(async () => {
      throw new Error('checkpoint_restore_failed');
    });
    const releaseBoardVisualWriter = jest.fn();
    jest.doMock(boardRendererPath, () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter,
      playBoardVisualPhase,
      enterBoardVisualRecovery,
      settleBoardVisualWriter,
      releaseBoardVisualWriter,
      getBoardCellClientRect: jest.fn()
    }));

    const animationUtils = require('../ui/animation-utils.js');
    await expect(animationUtils.animateFadeOutAt(3, 3)).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed'
    }));
    await expect(animationUtils.animateHyperactiveMove(
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      {}
    )).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_recovery_unresolved',
      eventType: 'legacy_hyperactive_move'
    }));

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledTimes(1);
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(settleBoardVisualWriter.mock.calls.map((call) => call[0])).toEqual([
      retainedToken,
      retainedToken
    ]);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();
  });
});
