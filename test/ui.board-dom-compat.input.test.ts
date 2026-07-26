import * as fs from 'fs';
import * as path from 'path';

describe('diff renderer interaction binder', () => {
  test('is a stateless DOM adapter over the shared BoardInputController', () => {
    const rendererSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-dom-compat', 'renderer.ts'), 'utf8');
    const binderSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-dom-compat', 'input.ts'), 'utf8');
    const attachSource = rendererSource.slice(rendererSource.indexOf('function attachBoardCellInteraction'));

    expect(rendererSource).toContain("_require('./input')");
    expect(attachSource).toContain('DiffRendererInteractionBinder.bindBoardCellInteraction({');
    expect(attachSource).toContain("_getBoardRendererHelperForDiff('getBoardInputController')");
    expect(attachSource).toContain('return getBoardInputController()');
    expect(attachSource).not.toContain("_require('./board-renderer')");
    expect(attachSource).not.toContain("cell.addEventListener('pointerdown'");
    expect(binderSource).toContain("cell.addEventListener('pointerdown'");
    expect(binderSource).toContain('getInputController');
    expect(binderSource).not.toContain('setTimeout');
    expect(binderSource).not.toContain('pressActive');
    expect(binderSource).not.toContain('longPressed');
    expect(binderSource).not.toContain('showIdleStoneInfoPanel');
  });

  test('resolves the shared controller lazily and normalizes pointer lifecycle events', () => {
    const { bindBoardCellInteraction } = require('../ui/board-dom-compat/input.ts');
    const listeners: Record<string, (event: any) => void> = {};
    const controller = {
      handlePointer: jest.fn(),
      handleKeyboard: jest.fn(),
      getState: jest.fn(() => ({ activePointerId: 9 }))
    };
    const getInputController = jest.fn(() => controller);
    const cell = {
      addEventListener: (type: string, listener: (event: any) => void) => {
        listeners[type] = listener;
      }
    };

    bindBoardCellInteraction({ getInputController }, cell, 2, 3);

    expect(getInputController).not.toHaveBeenCalled();

    listeners.pointerenter({ pointerId: 7, pointerType: 'pen', clientX: 10, clientY: 20 });
    listeners.pointerdown({ pointerId: 7, pointerType: 'pen', button: 0, clientX: 11, clientY: 21 });
    listeners.pointermove({ pointerId: 7, pointerType: 'pen', clientX: 12, clientY: 22 });
    listeners.pointercancel({ pointerId: 7, pointerType: 'pen', clientX: 13, clientY: 23 });
    listeners.pointerleave({ pointerId: 7, pointerType: 'pen', clientX: 14, clientY: 24 });

    expect(getInputController).toHaveBeenCalledTimes(5);
    expect(controller.handlePointer.mock.calls.map(([event]) => event.type)).toEqual([
      'pointerenter', 'pointerdown', 'pointermove', 'pointercancel', 'pointerleave'
    ]);
    expect(controller.handlePointer.mock.calls[1][0]).toMatchObject({
      row: 2,
      col: 3,
      pointerId: 7,
      pointerType: 'pen',
      button: 0,
      clientX: 11,
      clientY: 21
    });

    listeners.mouseleave({ pointerType: 'mouse', clientX: 15, clientY: 25 });
    expect(controller.handlePointer).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'pointerleave', pointerId: 9
    }));
  });

  test('preserves expansion and shrink direction keys for pointer and keyboard activation', () => {
    const { bindBoardCellInteraction } = require('../ui/board-dom-compat/input.ts');
    const listeners: Record<string, (event: any) => void> = {};
    const controller = {
      handlePointer: jest.fn(),
      handleKeyboard: jest.fn((event: any) => event.preventDefault())
    };
    const cell = {
      addEventListener: (type: string, listener: (event: any) => void) => {
        listeners[type] = listener;
      }
    };
    bindBoardCellInteraction({
      getInputController: () => controller
    }, cell, 0, 0);

    listeners.pointerdown({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    listeners.pointerup({
      pointerId: 1,
      pointerType: 'mouse',
      target: {
        closest: (selector: string) => selector.includes('.board-expansion-direction-hint')
          ? { dataset: { direction: 'up-left' } }
          : null
      }
    });

    expect(controller.handlePointer).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'pointerup', row: 0, col: 0, directionKey: 'up-left'
    }));

    const preventDefault = jest.fn();
    listeners.keydown({
      code: 'Enter',
      key: 'Enter',
      preventDefault,
      target: {
        closest: (selector: string) => selector.includes('.board-shrink-will-direction-hint')
          ? { dataset: { direction: 'left' } }
          : null
      }
    });

    expect(controller.handleKeyboard).toHaveBeenLastCalledWith(expect.objectContaining({
      code: 'Enter', key: 'Enter', row: 0, col: 0, directionKey: 'left'
    }));
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
