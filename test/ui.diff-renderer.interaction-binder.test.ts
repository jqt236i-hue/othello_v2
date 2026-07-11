import * as fs from 'fs';
import * as path from 'path';

describe('diff renderer interaction binder', () => {
  test('keeps pointer binding in a focused capability module', () => {
    const rendererSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer.ts'), 'utf8');
    const binderSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer', 'interaction-binder.ts'), 'utf8');
    const attachSource = rendererSource.slice(rendererSource.indexOf('function attachBoardCellInteraction'));

    expect(rendererSource).toContain("_require('./diff-renderer/interaction-binder')");
    expect(attachSource).toContain('DiffRendererInteractionBinder.bindBoardCellInteraction({');
    expect(attachSource).not.toContain("cell.addEventListener('pointerdown'");
    expect(binderSource).toContain("cell.addEventListener('pointerdown'");
    expect(binderSource).toContain('longPressMoveCancelPx');
  });

  test('passes the clicked expansion arrow direction to the canonical cell handler', () => {
    const { bindBoardCellInteraction } = require('../ui/diff-renderer/interaction-binder.ts');
    const listeners: Record<string, (event: any) => void> = {};
    const handleCellClick = jest.fn();
    const cell = {
      addEventListener: (type: string, listener: (event: any) => void) => {
        listeners[type] = listener;
      }
    };
    bindBoardCellInteraction({
      showIdleStoneInfoPanel: jest.fn(),
      ensureOutsideCloseHandler: jest.fn(),
      longPressMs: 500,
      longPressMoveCancelPx: 8,
      isHoverPointerEvent: () => false,
      setSuperAttractionHoverPreview: jest.fn(),
      clearSuperAttractionHoverPreview: jest.fn(),
      showSpecialStoneInfoAt: jest.fn(),
      isTouchStoneInfoEvent: () => false,
      handleCellClick,
      setTimeout: () => 1,
      clearTimeout: jest.fn()
    }, cell, 0, 0);

    listeners.pointerdown({ button: 0, clientX: 0, clientY: 0 });
    listeners.pointerup({
      target: {
        closest: (selector: string) => selector === '.board-expansion-direction-hint'
          ? { dataset: { direction: 'up-left' } }
          : null
      }
    });

    expect(handleCellClick).toHaveBeenCalledWith(0, 0, 'up-left');

    const preventDefault = jest.fn();
    listeners.keydown({
      key: 'Enter',
      preventDefault,
      target: {
        closest: () => ({ dataset: { direction: 'left' } })
      }
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(handleCellClick).toHaveBeenLastCalledWith(0, 0, 'left');
  });
});
