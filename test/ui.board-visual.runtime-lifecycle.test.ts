import { JSDOM } from 'jsdom';

const { createBoardLayoutRuntime } = require('../ui/board-visual/layout-runtime');
const { createBoardInputRuntime } = require('../ui/board-visual/input-runtime');
const { createBoardBackendRuntime } = require('../ui/board-visual/backend-runtime');
const { createBoardWriterRuntime } = require('../ui/board-visual/writer-runtime');
const { createBoardRenderSubmissionRuntime } = require('../ui/board-visual/render-submission-runtime');

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function expectPromiseToRemainPending(promise: Promise<unknown>): Promise<void> {
  let status = 'pending';
  void promise.then(
    () => { status = 'fulfilled'; },
    () => { status = 'rejected'; }
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(status).toBe('pending');
}

describe('board visual runtime lifecycle ownership', () => {
  test('session reset retains layout listeners while page destroy removes them', () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="game-container"><div id="board-frame"><div id="board"></div></div></div>
    </body></html>`);
    const previousWindow = (global as any).window;
    const previousDocument = (global as any).document;
    const previousResizeObserver = (global as any).ResizeObserver;
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const disconnect = jest.fn();
    const observe = jest.fn();
    (global as any).ResizeObserver = jest.fn(() => ({ observe, disconnect }));
    const addEventListener = jest.spyOn(dom.window, 'addEventListener');
    const removeEventListener = jest.spyOn(dom.window, 'removeEventListener');
    const frame = dom.window.document.getElementById('board-frame') as HTMLElement;
    const board = dom.window.document.getElementById('board') as HTMLElement;
    frame.getBoundingClientRect = jest.fn(() => ({
      left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400,
      x: 0, y: 0, toJSON: () => ({})
    }));
    board.getBoundingClientRect = jest.fn(() => ({
      left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400,
      x: 0, y: 0, toJSON: () => ({})
    }));
    const runtime = createBoardLayoutRuntime({
      resolveBoardShape: () => ({ rows: 8, cols: 8 }),
      requestRender: jest.fn(),
      domLayoutGeometry: { readBoardFrameGeometryForLayout: jest.fn(() => ({})) }
    });

    try {
      runtime.syncBoardPixelSizing(board, { rows: 8, cols: 8 });
      runtime.resetSession();
      runtime.resetSession();
      runtime.syncBoardPixelSizing(board, { rows: 8, cols: 8 });

      expect(addEventListener.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
      expect(disconnect).not.toHaveBeenCalled();
      expect(removeEventListener).not.toHaveBeenCalled();

      runtime.destroyPageRuntime();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('pageshow', expect.any(Function));
    } finally {
      dom.window.close();
      (global as any).window = previousWindow;
      (global as any).document = previousDocument;
      (global as any).ResizeObserver = previousResizeObserver;
    }
  });

  test('input reset preserves its controller and page destroy releases it', () => {
    const runtime = createBoardInputRuntime({
      getVisualRuntime: () => null,
      renderBoard: jest.fn(),
      getRenderStateSource: () => ({ resolvePair: jest.fn() }),
      resolveBoardElement: () => null,
      handleCellClick: jest.fn()
    });
    const controller = runtime.getController();
    const reset = jest.spyOn(controller, 'reset');
    const destroy = jest.spyOn(controller, 'destroy');

    runtime.resetSession();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    runtime.destroyPageRuntime();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test('backend reset retains an injected controller and page destroy releases subscriptions', () => {
    const unsubscribe = jest.fn();
    const beforeControllerReplace = jest.fn();
    const installHostResources = jest.fn();
    const afterControllerReplace = jest.fn();
    const controller = {
      submitFrame: jest.fn(),
      ready: Promise.resolve(),
      destroy: jest.fn()
    };
    const runtime = createBoardBackendRuntime({
      getRenderStateSource: jest.fn(),
      syncBoardPixelSizing: jest.fn(),
      renderBoard: jest.fn(),
      renderBoardFull: jest.fn(),
      getInputController: jest.fn(),
      applyTimeStopLegalEmphasis: jest.fn(),
      resolveBoardExpansionLayerElement: jest.fn(),
      playTopologyRevealSound: jest.fn(),
      beginApplyFrame: jest.fn(),
      resolveHost: jest.fn(),
      subscribeSettledFrame: jest.fn(() => unsubscribe),
      beforeControllerReplace,
      installHostResources,
      afterControllerReplace
    });

    runtime.configureController(controller, { host: {} });
    runtime.resetSession();
    expect(controller.destroy).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();

    runtime.destroyPageRuntime();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(controller.destroy).toHaveBeenCalledTimes(1);
    expect(beforeControllerReplace).toHaveBeenCalledTimes(2);
    expect(installHostResources).toHaveBeenCalledTimes(1);
    expect(afterControllerReplace).toHaveBeenCalledTimes(1);
    expect(runtime.getController()).toBeNull();
    expect(() => runtime.configureController(controller, { host: {} }))
      .toThrow('Board visual backend runtime is destroyed');
  });

  test('render submission cannot recreate or claim a controller after page destroy', () => {
    const controller = {
      submitFrame: jest.fn(),
      ready: Promise.resolve(),
      destroy: jest.fn()
    };
    const backendRuntime = createBoardBackendRuntime({
      getRenderStateSource: jest.fn(),
      syncBoardPixelSizing: jest.fn(),
      renderBoard: jest.fn(),
      renderBoardFull: jest.fn(),
      getInputController: jest.fn(),
      applyTimeStopLegalEmphasis: jest.fn(),
      resolveBoardExpansionLayerElement: jest.fn(),
      playTopologyRevealSound: jest.fn(),
      beginApplyFrame: jest.fn(),
      resolveHost: jest.fn(),
      subscribeSettledFrame: jest.fn(() => jest.fn()),
      beforeControllerReplace: jest.fn(),
      installHostResources: jest.fn(),
      afterControllerReplace: jest.fn()
    });
    backendRuntime.configureController(controller, { host: {} });
    const writerRuntime = {
      preparePlaybackOwnership: jest.fn(),
      checkInvalidation: jest.fn()
    };
    const submissionRuntime = createBoardRenderSubmissionRuntime({
      getController: () => backendRuntime.getController(),
      shouldDeferRenderForPlayback: () => true,
      writerRuntime,
      syncTimeStopClass: jest.fn(),
      buildFrame: jest.fn(),
      updateOccupancy: jest.fn()
    });
    backendRuntime.destroyPageRuntime();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      submissionRuntime.render();
    } finally {
      errorSpy.mockRestore();
    }

    expect(backendRuntime.getController()).toBeNull();
    expect(writerRuntime.preparePlaybackOwnership).not.toHaveBeenCalled();
    expect(writerRuntime.checkInvalidation).not.toHaveBeenCalled();
    expect(controller.submitFrame).not.toHaveBeenCalled();
  });

  test('presentation drain preserves an in-flight synthetic writer for network reclaim', async () => {
    const idleGate = createDeferred<void>();
    let mode: string = 'idle';
    const syntheticToken = Object.freeze({
      id: 1,
      frameToken: 'legacy-playback:41',
      mode: 'local'
    });
    const networkToken = Object.freeze({
      id: 2,
      frameToken: 'network:next',
      mode: 'network'
    });
    const controller = {
      ready: Promise.resolve(),
      waitForIdle: jest.fn(() => idleGate.promise),
      getMode: jest.fn(() => mode),
      isIdleSettlementPending: jest.fn(() => true),
      claimWriter: jest.fn(() => {
        mode = 'playback';
        return syntheticToken;
      }),
      reclaimWriter: jest.fn(() => {
        mode = 'playback';
        return networkToken;
      }),
      settleLocalWriter: jest.fn(async () => true)
    };
    const renderBoard = jest.fn();
    const buildFrame = jest.fn(() => ({ kind: 'final-frame' }));
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 41,
      shouldDeferRenderForPlayback: () => true,
      renderBoard,
      buildFrame,
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });

    expect(runtime.preparePlaybackOwnership(controller, true)).toEqual({
      deferredUntilAutoWriter: true
    });
    expect(controller.waitForIdle).toHaveBeenCalledTimes(1);

    const drainReadiness = runtime.getControllerReadyForPresentationDrain();
    await expectPromiseToRemainPending(drainReadiness);
    expect(controller.settleLocalWriter).not.toHaveBeenCalled();
    expect(buildFrame).not.toHaveBeenCalled();

    idleGate.resolve();
    await drainReadiness;

    expect(controller.claimWriter).toHaveBeenCalledWith('legacy-playback:41', 'local');
    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(controller.settleLocalWriter).not.toHaveBeenCalled();
    expect(buildFrame).not.toHaveBeenCalled();

    expect(runtime.claim('network:next', 'network')).toBe(networkToken);
    expect(controller.reclaimWriter).toHaveBeenCalledWith(
      syntheticToken,
      'network:next',
      'network'
    );
  });

  test('presentation drain without a synthetic claim waits for ordinary idle', async () => {
    const idleGate = createDeferred<void>();
    const controller = {
      ready: Promise.resolve(),
      waitForIdle: jest.fn(() => idleGate.promise),
      getMode: jest.fn(() => 'idle'),
      claimWriter: jest.fn()
    };
    const buildFrame = jest.fn();
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 1,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame,
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });

    const drainReadiness = runtime.getControllerReadyForPresentationDrain();
    await expectPromiseToRemainPending(drainReadiness);

    expect(controller.waitForIdle).toHaveBeenCalledTimes(1);
    expect(controller.claimWriter).not.toHaveBeenCalled();
    expect(buildFrame).not.toHaveBeenCalled();

    idleGate.resolve();
    await drainReadiness;
    expect(controller.claimWriter).not.toHaveBeenCalled();
    expect(buildFrame).not.toHaveBeenCalled();
  });

  test.each([
    ['drain-first', true],
    ['generic-first', false]
  ])('%s readiness preserves synthetic ownership until network reclaim', async (_label, drainFirst) => {
    let mode = 'idle';
    const syntheticToken = Object.freeze({ id: 1, frameToken: 'legacy-playback:9', mode: 'local' });
    const networkToken = Object.freeze({ id: 2, frameToken: 'network:9', mode: 'network' });
    const controller = {
      ready: Promise.resolve(),
      getMode: jest.fn(() => mode),
      isIdleSettlementPending: jest.fn(() => false),
      waitForIdle: jest.fn(async () => undefined),
      claimWriter: jest.fn(() => {
        mode = 'playback';
        return syntheticToken;
      }),
      reclaimWriter: jest.fn(() => networkToken),
      settleLocalWriter: jest.fn(async () => true)
    };
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 9,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(() => ({ kind: 'final-frame' })),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });
    runtime.preparePlaybackOwnership(controller, true);

    const first = drainFirst
      ? runtime.getControllerReadyForPresentationDrain()
      : runtime.getControllerReady();
    const second = drainFirst
      ? runtime.getControllerReady()
      : runtime.getControllerReadyForPresentationDrain();
    await Promise.all([first, second]);

    expect(controller.settleLocalWriter).not.toHaveBeenCalled();
    expect(runtime.claim('network:9', 'network')).toBe(networkToken);
    expect(controller.reclaimWriter).toHaveBeenCalledWith(
      syntheticToken,
      'network:9',
      'network'
    );
  });

  test('presentation drain waits for an active synthetic settlement before a fresh claim', async () => {
    const settlementGate = createDeferred<void>();
    let mode = 'idle';
    const syntheticToken = Object.freeze({ id: 1, frameToken: 'legacy-playback:12', mode: 'local' });
    const networkToken = Object.freeze({ id: 2, frameToken: 'network:12', mode: 'network' });
    const controller = {
      ready: Promise.resolve(),
      getMode: jest.fn(() => mode),
      isIdleSettlementPending: jest.fn(() => false),
      waitForIdle: jest.fn(async () => undefined),
      claimWriter: jest.fn((frameToken: string) => {
        mode = 'playback';
        return frameToken === syntheticToken.frameToken ? syntheticToken : networkToken;
      }),
      settleLocalWriter: jest.fn(async () => {
        await settlementGate.promise;
        mode = 'idle';
        return true;
      })
    };
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 12,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(() => ({ kind: 'final-frame' })),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });
    runtime.preparePlaybackOwnership(controller, true);
    const settlement = runtime.settleAutoWriter();
    await Promise.resolve();
    const drainReadiness = runtime.getControllerReadyForPresentationDrain();

    await expectPromiseToRemainPending(drainReadiness);
    expect(() => runtime.claim('network:12', 'network'))
      .toThrow('Cannot claim board visual writer while synthetic settlement is active');

    settlementGate.resolve();
    await expect(settlement).resolves.toBe(true);
    await expect(drainReadiness).resolves.toBeUndefined();
    expect(runtime.claim('network:12', 'network')).toBe(networkToken);
    expect(controller.claimWriter).toHaveBeenLastCalledWith('network:12', 'network');
  });

  test.each([
    ['generic readiness', 'getControllerReady'],
    ['presentation-drain readiness', 'getControllerReadyForPresentationDrain']
  ])('%s retries the current controller after replacement', async (_label, methodName) => {
    const staleReady = createDeferred<void>();
    const currentReady = createDeferred<void>();
    const staleController = {
      waitUntilReady: jest.fn(() => staleReady.promise),
      getMode: jest.fn(() => 'idle'),
      waitForIdle: jest.fn(async () => undefined)
    };
    const currentController = {
      waitUntilReady: jest.fn(() => currentReady.promise),
      getMode: jest.fn(() => 'idle'),
      waitForIdle: jest.fn(async () => undefined)
    };
    let controller = staleController;
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 1,
      shouldDeferRenderForPlayback: () => false,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });

    const readiness = (runtime as any)[methodName]();
    controller = currentController;
    runtime.replaceController();
    staleReady.reject(new Error('stale controller destroyed'));

    await expectPromiseToRemainPending(readiness);
    expect(currentController.waitUntilReady).toHaveBeenCalledTimes(1);
    currentReady.resolve();
    await expect(readiness).resolves.toBeUndefined();
    expect(currentController.waitForIdle).toHaveBeenCalledTimes(1);
  });

  test('replacement during auto settlement retries readiness without stale occupancy mutation', async () => {
    const staleSettlement = createDeferred<void>();
    const currentReady = createDeferred<void>();
    let mode = 'idle';
    const syntheticToken = Object.freeze({ id: 1, frameToken: 'legacy-playback:22', mode: 'local' });
    const staleController = {
      ready: Promise.resolve(),
      getMode: jest.fn(() => mode),
      isIdleSettlementPending: jest.fn(() => false),
      waitForIdle: jest.fn(async () => undefined),
      claimWriter: jest.fn(() => {
        mode = 'playback';
        return syntheticToken;
      }),
      settleLocalWriter: jest.fn(async () => {
        await staleSettlement.promise;
        return true;
      })
    };
    const currentController = {
      waitUntilReady: jest.fn(() => currentReady.promise),
      getMode: jest.fn(() => 'idle'),
      waitForIdle: jest.fn(async () => undefined)
    };
    let controller: any = staleController;
    const updateOccupancy = jest.fn();
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 22,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(() => ({ kind: 'final-frame' })),
      getRenderStateSource: jest.fn(),
      updateOccupancy
    });
    runtime.preparePlaybackOwnership(staleController, true);
    const readiness = runtime.getControllerReady();
    await Promise.resolve();
    await Promise.resolve();
    expect(staleController.settleLocalWriter).toHaveBeenCalledTimes(1);

    controller = currentController;
    runtime.replaceController();
    staleSettlement.resolve();
    await expectPromiseToRemainPending(readiness);

    expect(updateOccupancy).not.toHaveBeenCalled();
    currentReady.resolve();
    await expect(readiness).resolves.toBeUndefined();
    expect(currentController.waitForIdle).toHaveBeenCalledTimes(1);
  });

  test('session reset cancels a pending synthetic claim from the previous session', async () => {
    const staleIdle = createDeferred<void>();
    const controller = {
      getMode: jest.fn(() => 'idle'),
      isIdleSettlementPending: jest.fn(() => true),
      waitForIdle: jest.fn(() => staleIdle.promise),
      claimWriter: jest.fn()
    };
    const renderBoard = jest.fn();
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 31,
      shouldDeferRenderForPlayback: () => true,
      renderBoard,
      buildFrame: jest.fn(),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });
    runtime.preparePlaybackOwnership(controller, true);

    runtime.resetSession();
    staleIdle.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.claimWriter).not.toHaveBeenCalled();
    expect(renderBoard).not.toHaveBeenCalled();
  });

  test('session reset requests a fresh render after an active old-session settlement', async () => {
    const settlementGate = createDeferred<void>();
    const order: string[] = [];
    let mode = 'idle';
    const syntheticToken = Object.freeze({ id: 1, frameToken: 'legacy-playback:41', mode: 'local' });
    const controller = {
      getMode: jest.fn(() => mode),
      getActiveWriterToken: jest.fn(() => mode === 'playback' ? syntheticToken : null),
      isIdleSettlementPending: jest.fn(() => false),
      claimWriter: jest.fn(() => {
        mode = 'playback';
        return syntheticToken;
      }),
      settleLocalWriter: jest.fn(async (_token: any, frame: any) => {
        order.push(`settle:${frame.session}`);
        await settlementGate.promise;
        order.push('old-frame-applied');
        mode = 'idle';
        return true;
      })
    };
    const renderBoard = jest.fn(() => { order.push('fresh-render-requested'); });
    const updateOccupancy = jest.fn();
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 41,
      shouldDeferRenderForPlayback: () => true,
      renderBoard,
      buildFrame: jest.fn(() => ({ session: 'old' })),
      getRenderStateSource: jest.fn(),
      updateOccupancy
    });
    runtime.preparePlaybackOwnership(controller, true);
    const settlement = runtime.settleAutoWriter();
    await Promise.resolve();
    expect(controller.settleLocalWriter).toHaveBeenCalledTimes(1);

    runtime.resetSession();
    expect(runtime.checkInvalidation(controller)).toEqual({ invalidated: true });
    settlementGate.resolve();

    await expect(settlement).resolves.toBe(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['settle:old', 'old-frame-applied', 'fresh-render-requested']);
    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(updateOccupancy).not.toHaveBeenCalled();
    expect(runtime.getInvalidationDiagnostics()).toMatchObject({
      pending: false,
      discardedWriterCount: 1
    });
  });

  test('page destroy terminates pending readiness without reacquiring a controller', async () => {
    const readyGate = createDeferred<void>();
    const controller = {
      waitUntilReady: jest.fn(() => readyGate.promise),
      getMode: jest.fn(() => 'idle'),
      waitForIdle: jest.fn(async () => undefined)
    };
    const getController = jest.fn(() => controller);
    const runtime = createBoardWriterRuntime({
      getController,
      getNextFrameSerial: () => 1,
      shouldDeferRenderForPlayback: () => false,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });
    const readiness = runtime.getControllerReady();
    expect(getController).toHaveBeenCalledTimes(1);

    runtime.destroyPageRuntime();
    readyGate.reject(new Error('controller destroyed'));

    await expect(readiness).rejects.toThrow('Board visual page runtime is destroyed');
    expect(getController).toHaveBeenCalledTimes(1);
    expect(() => runtime.preparePlaybackOwnership(controller, false))
      .toThrow('Board visual page runtime is destroyed');
    expect(() => runtime.checkInvalidation(controller))
      .toThrow('Board visual page runtime is destroyed');
  });

  test('legacy writer controllers fail explicitly when synthetic ownership cannot be reclaimed', () => {
    let mode = 'idle';
    const syntheticToken = Object.freeze({
      id: 1,
      frameToken: 'legacy-playback:1',
      mode: 'local'
    });
    const controller = {
      getMode: jest.fn(() => mode),
      claimWriter: jest.fn(() => {
        mode = 'playback';
        return syntheticToken;
      })
    };
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 1,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });

    expect(runtime.preparePlaybackOwnership(controller, true)).toEqual({});
    expect(controller.claimWriter).toHaveBeenCalledWith('legacy-playback:1', 'local');
    expect(runtime.checkInvalidation(controller)).toEqual({ invalidated: true });
    expect(() => runtime.claim('network:2', 'network'))
      .toThrow('Board visual controller cannot reclaim synthetic writer ownership');
  });

  test('legacy writer controllers fail explicitly when playback mode is unavailable', () => {
    const controller = {
      claimWriter: jest.fn()
    };
    const runtime = createBoardWriterRuntime({
      getController: () => controller,
      getNextFrameSerial: () => 1,
      shouldDeferRenderForPlayback: () => true,
      renderBoard: jest.fn(),
      buildFrame: jest.fn(),
      getRenderStateSource: jest.fn(),
      updateOccupancy: jest.fn()
    });

    expect(() => runtime.preparePlaybackOwnership(controller, true))
      .toThrow('Board visual controller cannot report writer mode for playback ownership');
    expect(controller.claimWriter).not.toHaveBeenCalled();
  });
});
