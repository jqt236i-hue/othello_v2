import * as fs from 'fs';
import * as path from 'path';

describe('board renderer single-writer ownership', () => {
  test('routes full renders through BoardVisualController without a second DOM writer', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-renderer.ts'), 'utf8');
    const fullRenderSource = source.slice(source.indexOf('function renderBoardFull()'));

    expect(source).not.toContain('function renderBoardFullLegacy');
    expect(source).not.toContain('boardEl.innerHTML');
    expect(source).not.toContain('boardEl.appendChild');
    expect(fullRenderSource).toContain('const controller = getBoardVisualController();');
    expect(fullRenderSource).toContain("controller.invalidate");
    expect(fullRenderSource).toContain('return renderBoard();');
    expect(fullRenderSource).not.toContain('fullRender(boardEl);');
    expect(fullRenderSource).not.toContain('diffRender(boardEl);');
  });
});
