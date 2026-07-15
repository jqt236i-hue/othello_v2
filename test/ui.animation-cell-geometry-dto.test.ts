import { JSDOM } from 'jsdom';

type CellRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

describe('board animation cell geometry DTO boundary', () => {
  let dom: JSDOM;
  let animateMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="board">
        <div class="cell has-disc" data-row="0" data-col="0"><div class="disc black"></div></div>
        <div class="cell" data-row="0" data-col="1"></div>
        <div class="cell" data-row="1" data-col="1"></div>
        <div class="cell" data-row="2" data-col="3"></div>
      </div>
    </body></html>`, { pretendToBeVisual: true });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    };
    animateMock = jest.fn(() => ({ finished: Promise.resolve(), cancel: jest.fn() }));
    (dom.window.HTMLElement.prototype as any).animate = animateMock;
    document.querySelectorAll('.cell').forEach((cell: any) => {
      cell.getBoundingClientRect = () => { throw new Error('live cell geometry must not be read'); };
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    dom.window.close();
    delete (global as any).requestAnimationFrame;
    delete (global as any).window;
    delete (global as any).document;
  });

  function createRect(left: number, top: number): CellRect {
    return { left, top, right: left + 40, bottom: top + 40, width: 40, height: 40 };
  }

  function createMoveDeps(rectByKey: Record<string, CellRect>) {
    return {
      eventTypes: { MOVE: 'move' },
      moveMs: 300,
      effectTargetHighlightClass: 'effect-target-highlight',
      effectTargetPositiveHighlightClass: 'effect-target-highlight-positive',
      highlightToneNegative: 'negative',
      highlightTonePositive: 'positive',
      isNoAnim: () => false,
      getCellEl: (row: number, col: number) => document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      getCellClientRect: jest.fn((row: number, col: number) => rectByKey[`${row},${col}`] || null),
      createDisc: jest.fn((state: any) => {
        const disc = document.createElement('div');
        disc.className = `disc ${state && state.color === -1 ? 'white' : 'black'}`;
        return disc;
      }),
      getTargetCause: (target: any) => String(target && target.cause || '').toUpperCase(),
      getTargetReason: (target: any) => String(target && target.reason || '').toLowerCase(),
      resolveEffectTargetHighlightTone: () => null,
      resolveMoveDurationScale: () => 1,
      waitForAnimationFinish: jest.fn(() => Promise.resolve()),
      syncDiscVisual: jest.fn((disc: HTMLElement, state: any) => {
        disc.classList.toggle('black', state && state.color === 1);
        disc.classList.toggle('white', state && state.color === -1);
      }),
      removeDiscFromCell: jest.fn((cell: HTMLElement, disc: HTMLElement | null) => {
        if (disc && disc.parentElement === cell) cell.removeChild(disc);
        if (!cell.querySelector('.disc')) cell.classList.remove('has-disc');
      })
    };
  }

  test('MOVE の from/to/waypoint 座標は DTO だけからアニメーション経路を作る', async () => {
    const moveEvents = require('../ui/animation-move-events.js');
    const deps = createMoveDeps({
      '0,0': createRect(10, 20),
      '0,1': createRect(70, 20),
      '1,1': createRect(70, 80)
    });

    await moveEvents.handleMoveEvent({
      type: 'move',
      targets: [{
        from: { r: 0, col: 0 },
        to: { r: 1, col: 1 },
        cause: 'SUPER_ATTRACTION_WILL',
        reason: 'super_attraction_move',
        before: { color: 1 },
        after: { color: 1 },
        meta: {
          moveIntent: 'crush_move',
          waypoints: [{ row: 0, col: 1 }],
          segments: [{ length: 1 }, { length: 1 }]
        }
      }]
    }, deps);

    expect(deps.getCellClientRect.mock.calls).toEqual([[0, 0], [1, 1], [0, 1], [1, 1]]);
    const keyframes = animateMock.mock.calls[0][0];
    expect(keyframes.map((frame: any) => frame.transform)).toEqual([
      'translate(0, 0) scale(1)',
      'translate(60px, 0px) scale(1.05)',
      'translate(60px, 60px) scale(1)'
    ]);
  });

  test('極端活発の強制交換は往路・復路とも DTO 座標だけを使う', async () => {
    const moveEvents = require('../ui/animation-move-events.js');
    const overlapCell = document.querySelector('.cell[data-row="0"][data-col="1"]') as HTMLElement;
    overlapCell.classList.add('has-disc');
    overlapCell.innerHTML = '<div class="disc white"></div>';
    const deps = createMoveDeps({
      '0,0': createRect(15, 25),
      '0,1': createRect(75, 25)
    });

    await moveEvents.handleMoveEvent({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' },
      targets: [
        {
          from: { r: 0, col: 0 },
          to: { r: 0, col: 1 },
          cause: 'EXTREME_HYPERACTIVE_WILL',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'lead',
          before: { color: 1 },
          after: { color: 1 }
        },
        {
          from: { r: 0, col: 1 },
          to: { r: 0, col: 0 },
          cause: 'EXTREME_HYPERACTIVE_WILL',
          reason: 'extreme_hyperactive_forced_swap',
          extremeForcedSwapRole: 'follow',
          before: { color: -1 },
          after: { color: -1 }
        }
      ]
    }, deps);

    expect(deps.getCellClientRect.mock.calls).toEqual([[0, 0], [0, 1], [0, 1], [0, 0]]);
    expect(animateMock).toHaveBeenCalledTimes(2);
    expect(animateMock.mock.calls[0][0].at(-1).transform).toBe('translate(60px, 0px) scale(1.06)');
    expect(animateMock.mock.calls[1][0].at(-1).transform).toBe('translate(-60px, 0px)');
  });

  test('観測吹き出しのアンカーは DTO を使い live cell geometry を読まない', async () => {
    const feedbackEvents = require('../ui/animation-feedback-events.js');
    const getCellClientRect = jest.fn(() => createRect(120, 220));

    await feedbackEvents.handleObserverBubbleEvent({
      type: 'observer_bubble',
      targets: [{ r: 2, col: 3, owner: 'black', gained: 4 }]
    }, {
      observerBubbleMs: 3000,
      observerBubbleFadeMs: 700,
      getCellClientRect
    });

    const bubble = document.querySelector('.observer-speech-bubble') as HTMLElement;
    expect(getCellClientRect).toHaveBeenCalledWith(2, 3);
    expect(bubble.style.left).toBe('140px');
    expect(bubble.style.top).toBe('212px');
  });
});
