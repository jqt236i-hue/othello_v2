import { JSDOM } from 'jsdom';

const { createBoardLayoutRuntime } = require('../ui/board-visual/layout-runtime');
const { createBoardInputRuntime } = require('../ui/board-visual/input-runtime');
const { createBoardBackendRuntime } = require('../ui/board-visual/backend-runtime');
const { createBoardWriterRuntime } = require('../ui/board-visual/writer-runtime');

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
