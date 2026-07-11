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
});
