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

  test('UDG lightning uses layout batch for repeated source rect reads', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (global.window as any).innerWidth = 800;
    (global.window as any).innerHeight = 600;

    const sourceCell = document.createElement('div');
    const targetCellA = document.createElement('div');
    const targetCellB = document.createElement('div');
    const sourceRect = jest.fn(() => makeRect(100, 100));
    const targetRectA = jest.fn(() => makeRect(200, 200));
    const targetRectB = jest.fn(() => makeRect(240, 240));
    sourceCell.getBoundingClientRect = sourceRect;
    targetCellA.getBoundingClientRect = targetRectA;
    targetCellB.getBoundingClientRect = targetRectB;

    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const layoutBatch = createLayoutReadBatch();
    const sourceEvents = require('../ui/animation-destroy-source-events.js');
    const baseDeps = {
      isNoAnim: () => false,
      getCellEl: (row: number, col: number) => {
        if (row === 1 && col === 1) return sourceCell;
        if (row === 3 && col === 3) return targetCellA;
        return targetCellB;
      },
      resolveSniperSource: () => ({ row: 1, col: 1 }),
      waitForAnimationFinish: () => Promise.resolve(),
      sleep: () => Promise.resolve(),
      timer: makeTimer,
      playbackScope: null,
      layoutBatch
    };

    await sourceEvents.animateUdgLightningStrike(
      { r: 3, col: 3, source: { r: 1, col: 1 } },
      baseDeps
    );
    await sourceEvents.animateUdgLightningStrike(
      { r: 4, col: 4, source: { r: 1, col: 1 } },
      baseDeps
    );

    expect(sourceRect).toHaveBeenCalledTimes(1);
    expect(targetRectA).toHaveBeenCalledTimes(1);
    expect(targetRectB).toHaveBeenCalledTimes(1);

    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });
});
