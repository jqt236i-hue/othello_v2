import { JSDOM } from 'jsdom';

describe('AnimationFlipEvents', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><div class="cell" data-row="2" data-col="3"><div class="disc black"></div></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  function createDeps(triggerFlip: jest.Mock) {
    return {
      eventTypes: { FLIP: 'flip' },
      flipMs: 10,
      fadeOutMs: 10,
      isNoAnim: () => false,
      getCellEl: (row: number, col: number) => document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      resolveOwnerColorFromBefore: () => 1,
      resolveOwnerClassFromColor: () => 'black',
      syncDiscVisual: jest.fn((disc: HTMLElement, state: any) => {
        disc.classList.toggle('black', state.color === 1);
        disc.classList.toggle('white', state.color === -1);
      }),
      runWithEffectTargetHighlight: (_cell: Element, _eventType: string, _target: unknown, runner: () => Promise<void>) => runner(),
      sleep: jest.fn(() => Promise.resolve()),
      animationShared: {
        triggerFlip,
        removeFlip: jest.fn()
      }
    };
  }

  test('dedupes repeated flip targets for the same cell in one event', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);

    await flipEvents.handleFlipEvent(
      {
        type: 'flip',
        targets: [
          { r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } },
          { r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }
        ]
      },
      deps
    );

    expect(triggerFlip).toHaveBeenCalledTimes(1);
    expect(deps.syncDiscVisual).toHaveBeenCalledTimes(2);
  });
});
