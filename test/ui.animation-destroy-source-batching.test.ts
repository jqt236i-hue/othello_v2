import { JSDOM } from 'jsdom';

function makeRect(left: number, top: number) {
  return { left, top, width: 20, height: 20, right: left + 20, bottom: top + 20 };
}

function makeTimer() {
  return {
    setTimeout: (fn: Function) => {
      fn();
      return 1;
    },
    clearTimeout: jest.fn()
  };
}

describe('destroy source animation batching', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('DOM runtime keeps shared-launch order while owning cached cell-to-client-rect reads', async () => {
    const dom = new JSDOM(`<!doctype html><html><body><div id="board">
      <div class="cell" data-row="1" data-col="1"></div>
      <div class="cell" data-row="3" data-col="3"></div>
      <div class="cell" data-row="4" data-col="4"></div>
    </div></body></html>`);
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (global.window as any).innerWidth = 800;
    (global.window as any).innerHeight = 600;

    const sourceCell = document.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
    const targetCellA = document.querySelector('.cell[data-row="3"][data-col="3"]') as HTMLElement;
    const targetCellB = document.querySelector('.cell[data-row="4"][data-col="4"]') as HTMLElement;
    const sourceRect = jest.fn(() => makeRect(100, 100));
    const targetRectA = jest.fn(() => makeRect(200, 200));
    const targetRectB = jest.fn(() => makeRect(240, 240));
    sourceCell.getBoundingClientRect = sourceRect;
    targetCellA.getBoundingClientRect = targetRectA;
    targetCellB.getBoundingClientRect = targetRectB;

    const observedRects: any[] = [];
    const launchOrder: string[] = [];
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateUdgLightningStrike: jest.fn(async (target: any, deps: any) => {
        launchOrder.push(`source:${target.r},${target.col}`);
        observedRects.push(deps.getCellClientRect(1, 1));
        observedRects.push(deps.getCellClientRect(target.r, target.col));
      })
    }));
    jest.doMock('../ui/animation-destroy-events', () => ({
      handleDestroyEvent: jest.fn(async (event: any, deps: any) => {
        for (const target of event.targets || []) {
          launchOrder.push(`board:${target.r},${target.col}`);
          const profile = deps.resolveDestroySourceAnimationProfile(target);
          await deps.playDestroySourceAnimation(target, profile);
        }
      })
    }));

    const { createDomBoardPlaybackHandlers } = require('../ui/board-dom-compat/runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-dom-compat/playback');
    const handlers = createDomBoardPlaybackHandlers({
      boardElement: document.getElementById('board'),
      documentRef: document,
      isNoAnim: () => false,
      getTimer: makeTimer
    });
    const executor = createDomBoardPlaybackExecutor(handlers);
    const events = [
      { type: 'destroy', targets: [{ r: 3, col: 3, sourceRow: 1, sourceCol: 1, cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed' }] },
      { type: 'destroy', targets: [{ r: 4, col: 4, sourceRow: 1, sourceCol: 1, cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed' }] }
    ];
    const context = {
      token: { id: 1, frameToken: 'local:destroy-source-batch', mode: 'local' },
      strictNetworkPlayback: false,
      phaseScope: { phaseKey: '0', stepIndex: 0, events }
    };

    await Promise.all([
      executor.playPhase([events[0]], context),
      executor.playPhase([events[1]], context)
    ]);

    expect(launchOrder).toEqual([
      'source:3,3',
      'board:3,3',
      'source:4,4',
      'board:4,4'
    ]);
    expect(sourceRect).toHaveBeenCalledTimes(1);
    expect(targetRectA).toHaveBeenCalledTimes(1);
    expect(targetRectB).toHaveBeenCalledTimes(1);
    expect(observedRects).toEqual([
      makeRect(100, 100),
      makeRect(200, 200),
      makeRect(100, 100),
      makeRect(240, 240)
    ]);

    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    jest.dontMock('../ui/animation-destroy-source-events');
    jest.dontMock('../ui/animation-destroy-events');
  });
});
