import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('board renderer recovery boundary', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-renderer.ts'), 'utf8');

  test('observes the controller readiness generation used after backend fallback', () => {
    const start = source.indexOf('function getBoardVisualControllerReady()');
    const end = source.indexOf('function claimBoardVisualWriter(', start);
    const readySource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(readySource).toContain("typeof controller.waitUntilReady === 'function'");
    expect(readySource).toContain('await controller.waitUntilReady();');
    expect(readySource).toContain("controller.getMode() === 'idle'");
    expect(readySource).toContain('await controller.waitForIdle();');
  });

  test('claims synchronously when idle is settled and defers frame construction otherwise', () => {
    const prepareStart = source.indexOf('function prepareBoardVisualUpdate()');
    const prepareEnd = source.indexOf('function renderBoard(', prepareStart);
    const prepareSource = source.slice(prepareStart, prepareEnd);
    const requestStart = source.indexOf('function _requestAutoBoardVisualWriterForBoardRenderer(');
    const requestEnd = source.indexOf('async function getBoardVisualControllerReady()', requestStart);
    const requestSource = source.slice(requestStart, requestEnd);
    const waitAt = requestSource.indexOf('await controller.waitForIdle();');
    const claimAt = requestSource.indexOf('controller.claimWriter(');

    expect(prepareStart).toBeGreaterThanOrEqual(0);
    expect(prepareSource).toContain("typeof controller.isIdleSettlementPending === 'function'");
    expect(prepareSource).toContain('_requestAutoBoardVisualWriterForBoardRenderer(controller, true)');
    expect(prepareSource).toContain('deferredUntilAutoWriter: true');
    expect(prepareSource).toContain('controller.claimWriter(');
    expect(prepareSource.indexOf('deferredUntilAutoWriter: true')).toBeLessThan(
      prepareSource.indexOf('controller.claimWriter(')
    );
    expect(requestStart).toBeGreaterThanOrEqual(0);
    expect(waitAt).toBeGreaterThanOrEqual(0);
    expect(claimAt).toBeGreaterThan(waitAt);
  });

  test('does not build or submit a playback frame until pending idle settlement finishes', async () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).cardState = {};
    (global as any).countDiscs = jest.fn(() => ({ black: 2, white: 2 }));
    const settlement = deferred();
    const autoWriterSettlement = deferred();
    const buildModel = jest.fn(() => ({
      visualRevision: 0,
      topology: {
        baseRows: 8,
        baseCols: 8,
        minRow: 0,
        maxRow: 7,
        minCol: 0,
        maxCol: 7,
        renderRowOffset: 0,
        renderColOffset: 0,
        renderRows: 8,
        renderCols: 8,
        existingKeys: [],
        playableKeys: [],
        holeKeys: []
      },
      cells: [],
      keyboardCursorKey: null,
      viewerContext: 'black',
      currentPlayer: 'black',
      canControlCurrentTurn: true,
      isHumanTurn: true
    }));
    jest.doMock('../ui/playback-state-manager', () => ({
      shouldDeferBoardUpdate: jest.fn(() => true),
      getPlaybackActive: jest.fn(() => true),
      hasPendingVisualPlayback: jest.fn(() => true)
    }));
    jest.doMock('../ui/board-visual/state-adapter', () => ({
      createBoardRenderInputs: jest.fn(() => ({
        baseVisualState: { gameState: {}, cardState: {} },
        presentationOverlayState: {}
      })),
      createBoardRenderProjection: jest.fn(() => ({})),
      buildCurrentCellState: jest.fn(() => ({})),
      createBoardPresentationOverlayState: jest.fn(() => ({})),
      buildBoardRenderModel: buildModel
    }));
    jest.doMock('../ui/presentation/committed-world-state', () => ({
      createCommittedManifestPresentationState: jest.fn(() => ({})),
      presentCommittedWorldState: jest.fn()
    }));
    jest.doMock('../ui/board-visual/layout', () => ({
      createBoardViewportLayout: jest.fn((_topology: any, options: any) => ({
        ...options,
        revision: 0,
        logicalWidth: 8,
        logicalHeight: 8,
        visibleWorldWindow: { minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 }
      }))
    }));
    jest.doMock('../ui/board-visual/theme', () => ({
      resolveBoardVisualThemeDescriptor: jest.fn(() => ({ revision: 0 })),
      observeBoardVisualThemeFonts: jest.fn(() => () => {})
    }));
    jest.doMock('../ui/board-visual/frame-presenter', () => ({
      resolveBoardAppearanceDescriptor: jest.fn(() => ({
        revision: 0,
        boardSkinId: 'test',
        boardImageUrl: '',
        boardFrameSkinId: 'test',
        boardFrameLayout: {},
        stoneSkinId: 'test',
        blackStoneImageUrl: '',
        whiteStoneImageUrl: ''
      })),
      createBoardVisualFrameRevisionComposer: jest.fn(() => ({
        compose: (value: any) => Object.freeze(value)
      }))
    }));
    jest.doMock('../ui/presentation/world-state-presenter', () => ({
      createWorldStatePresenter: jest.fn(() => ({ presentTimeStop: jest.fn() }))
    }));

    let pending = true;
    let mode = 'idle';
    let activeToken: any = null;
    const submitted: any[] = [];
    const controller = {
      ready: Promise.resolve(),
      waitUntilReady: jest.fn(async () => undefined),
      waitForIdle: jest.fn(() => settlement.promise),
      isIdleSettlementPending: jest.fn(() => pending),
      getMode: jest.fn(() => mode),
      getActiveWriterToken: jest.fn(() => activeToken),
      getActiveFrameToken: jest.fn(() => activeToken && activeToken.frameToken),
      claimWriter: jest.fn((frameToken: string, writerMode: string) => {
        activeToken = Object.freeze({ id: 1, frameToken, mode: writerMode });
        mode = 'playback';
        return activeToken;
      }),
      submitFrame: jest.fn((value: any) => {
        submitted.push(value);
        return false;
      }),
      settleLocalWriter: jest.fn(async (token: any, frame: any) => {
        expect(token).toBe(activeToken);
        expect(frame.frameToken).toBe(activeToken.frameToken);
        await autoWriterSettlement.promise;
        mode = 'idle';
        activeToken = null;
        return true;
      }),
      destroy: jest.fn()
    };

    try {
      const renderer = require('../ui/board-renderer.ts');
      renderer.configureBoardVisualController(controller, { host: (global as any).boardEl });
      renderer.renderBoard();

      expect(controller.claimWriter).not.toHaveBeenCalled();
      expect(controller.submitFrame).not.toHaveBeenCalled();
      expect(buildModel).not.toHaveBeenCalled();

      pending = false;
      settlement.resolve();
      await settlement.promise;
      await Promise.resolve();
      await Promise.resolve();

      expect(controller.claimWriter).toHaveBeenCalledTimes(1);
      expect(controller.submitFrame).not.toHaveBeenCalled();
      expect(buildModel).not.toHaveBeenCalled();

      renderer.renderBoard();
      renderer.renderBoard();
      expect(controller.submitFrame).not.toHaveBeenCalled();
      expect(buildModel).not.toHaveBeenCalled();

      await renderer.getBoardVisualControllerReadyForPresentationDrain();
      expect(controller.settleLocalWriter).not.toHaveBeenCalled();
      expect(controller.getMode()).toBe('playback');

      let readyResolved = false;
      const readyPromise = renderer.getBoardVisualControllerReady().then(() => {
        readyResolved = true;
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(controller.settleLocalWriter).toHaveBeenCalledTimes(1);
      expect(readyResolved).toBe(false);
      expect(buildModel).toHaveBeenCalledTimes(1);
      autoWriterSettlement.resolve();
      await readyPromise;
      expect(renderer.getBoardVisualInvalidationDiagnostics()).toMatchObject({
        requestCount: 3,
        mergeCount: 2,
        finalFrameBuildCount: 1,
        finalFrameSubmitCount: 1,
        pending: false
      });
    } finally {
      dom.window.close();
      delete (global as any).window;
      delete (global as any).document;
      delete (global as any).boardEl;
      delete (global as any).cardState;
      delete (global as any).countDiscs;
    }
  });

  test('requires exact writer ownership before post-handoff cancellation', () => {
    const start = source.indexOf('async function cancelBoardVisualWriterAfterHandoff(');
    const end = source.indexOf('async function settleBoardVisualWriter(', start);
    const cancelSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(cancelSource).toContain('controller.getActiveWriterToken() !== token');
    expect(cancelSource).toContain('await controller.cancelWriterAfterHandoff(token, checkpoint);');
    expect(cancelSource).toContain('BoardVisualInvalidationAccumulatorForBoardRenderer.discard(token);');
  });

  test('routes real local final sync through the async controller settlement API', () => {
    const start = source.indexOf('async function settleBoardVisualWriter(');
    const end = source.indexOf('function beginBoardVisualFrameCommit(', start);
    const settlementSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(settlementSource).toContain("typeof controller.settleLocalWriter === 'function'");
    expect(settlementSource).toContain('_buildFinalBoardVisualFrameForWriter(controller, token)');
    expect(settlementSource).toContain('controller.settleLocalWriter(token, finalFrame)');
    expect(settlementSource).not.toContain('renderBoard();');
  });

  test('requires exact writer and frame identity before entering recovery', () => {
    const start = source.indexOf('function enterBoardVisualRecovery(');
    const end = source.indexOf('function settleAutoBoardVisualWriter(', start);
    const recoverySource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(recoverySource).toContain('controller.getActiveWriterToken() !== token');
    expect(recoverySource).toContain("controller.getActiveFrameToken() !== String(token && token.frameToken || '')");
    expect(recoverySource).toContain('return controller.enterRecovery(token, error);');
  });

  test('keeps the synthetic legacy writer through async local settlement', () => {
    const start = source.indexOf('async function settleAutoBoardVisualWriter(');
    const end = source.indexOf('const BOARD_FRAME_LAYOUT_STYLE_PROPERTIES_FOR_TRANSACTION', start);
    const settlementSource = source.slice(start, end);
    const renderStart = source.indexOf('function renderBoard(');
    const renderEnd = source.indexOf('let BoardVisualRuntimeForBoardRenderer', renderStart);
    const renderSource = source.slice(renderStart, renderEnd);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(settlementSource).toContain('await controller.settleLocalWriter(token, finalFrame);');
    expect(settlementSource).toContain('AutoBoardWriterTokenForBoardRenderer = null;');
    expect(renderSource).not.toContain('controller.releaseWriter(token);');
  });

  test('binds every built frame to the module-local render session epoch', () => {
    const buildStart = source.indexOf('function _buildBoardVisualFrameForBoardRenderer(');
    const buildEnd = source.indexOf('function renderBoardFull()', buildStart);
    const buildSource = source.slice(buildStart, buildEnd);
    const resetStart = source.indexOf('function resetBoardVisualRenderSession()');
    const resetEnd = source.indexOf('function renderBoardFull()', resetStart);
    const resetSource = source.slice(resetStart, resetEnd);

    expect(buildStart).toBeGreaterThanOrEqual(0);
    expect(buildSource).toContain('renderSessionId: `board-render-session:${BoardVisualRenderSessionEpochForBoardRenderer}`');
    expect(resetStart).toBeGreaterThanOrEqual(0);
    expect(resetSource).toContain('BoardVisualRenderSessionEpochForBoardRenderer + 1');
    expect(source).toContain('resetBoardVisualRenderSession,');
  });

  test('presents and measures live Pixi geometry only inside the authorized apply transaction', () => {
    const start = source.indexOf('function _beginBoardVisualApplyTransactionForBoardRenderer(');
    const end = source.indexOf('function _readBoardCellSizeForLayout(', start);
    const transactionSource = source.slice(start, end);
    const presentAt = transactionSource.indexOf('FramePresenterModule.presentBoardFrame(host, frame);');
    const sizingAt = transactionSource.indexOf('syncBoardPixelSizing(host, {');
    const viewportAt = transactionSource.indexOf('_capPixiBoardViewportForBoardRenderer(host, topology);');
    const layoutAt = transactionSource.indexOf('_createBoardVisualFrameWithLiveLayoutForBoardRenderer(host, frame)');

    expect(start).toBeGreaterThanOrEqual(0);
    expect(transactionSource).toContain("context.backendKind !== 'pixi'");
    expect(presentAt).toBeGreaterThanOrEqual(0);
    expect(sizingAt).toBeGreaterThan(presentAt);
    expect(viewportAt).toBeGreaterThan(sizingAt);
    expect(layoutAt).toBeGreaterThan(viewportAt);
    expect(transactionSource).toContain('rollback: snapshot.rollback');
    expect(transactionSource).toContain('snapshot.rollback();');
  });
});
