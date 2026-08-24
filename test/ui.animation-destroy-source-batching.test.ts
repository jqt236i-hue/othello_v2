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

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

describe('destroy source animation batching', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test.each([
    ['dragon beam', 'animateDestroyDragonBreath'],
    ['meteor black beam', 'animateMeteorGodBlackBeam']
  ])('%s settles on actual Web Animation completion and keeps the deadline as fallback', async (_label, methodName) => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;

    const finishAnimations: Array<() => void> = [];
    const animate = jest.fn(() => {
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => { finish = resolve; });
      finishAnimations.push(finish);
      return { finished, cancel: jest.fn() };
    });
    Object.defineProperty(dom.window.HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate
    });
    const deadlineCallbacks: Array<() => void> = [];
    const clearTimeout = jest.fn();
    const source = { row: 1, col: 1 };
    const target = {
      r: 2,
      col: 2,
      meta: { sourceTrajectoryProfile: 'fireWillFlameBeam' }
    };
    const animationModule = require('../ui/animation-destroy-source-events');
    const makeDeps = () => ({
      isNoAnim: () => false,
      getCellClientRect: (row: number, col: number) => (
        row === source.row && col === source.col
          ? makeRect(100, 100)
          : row === target.r && col === target.col
            ? makeRect(220, 180)
            : null
      ),
      resolveSniperSource: () => source,
      resolveRobotVacuumSource: () => source,
      resolveDestroyDragonSource: () => source,
      waitForAnimationFinish: jest.fn(),
      sleep: jest.fn(),
      timer: () => ({
        setTimeout: (callback: () => void) => {
          deadlineCallbacks.push(callback);
          return deadlineCallbacks.length;
        },
        clearTimeout
      }),
      playbackScope: null,
      suppressTargetImpact: true,
      random: () => 0.5
    });
    let settled = false;
    const pending = animationModule[methodName](target, makeDeps())
      .then(() => { settled = true; });

    await Promise.resolve();
    expect(finishAnimations.length).toBeGreaterThan(0);
    expect(deadlineCallbacks).toHaveLength(1);
    finishAnimations.forEach((finish) => finish());
    await flushMicrotasks();
    const settledAtAnimationFinish = settled;

    deadlineCallbacks.forEach((finish) => finish());
    await pending;
    expect(settledAtAnimationFinish).toBe(true);
    expect(clearTimeout).toHaveBeenCalled();

    deadlineCallbacks.length = 0;
    clearTimeout.mockClear();
    animate.mockImplementation(() => ({ cancel: jest.fn() } as any));
    let fallbackSettled = false;
    const fallbackPending = animationModule[methodName](target, makeDeps())
      .then(() => { fallbackSettled = true; });

    await flushMicrotasks();
    expect(fallbackSettled).toBe(false);
    expect(deadlineCallbacks).toHaveLength(1);
    deadlineCallbacks.forEach((finish) => finish());
    await fallbackPending;
    expect(fallbackSettled).toBe(true);

    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
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
