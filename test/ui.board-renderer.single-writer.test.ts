import * as fs from 'fs';
import * as path from 'path';

describe('board renderer single-writer ownership', () => {
  test('removes the legacy board DOM writer and delegates full renders to diff-renderer capabilities', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-renderer.ts'), 'utf8');
    const fullRenderSource = source.slice(source.indexOf('function renderBoardFull()'));

    expect(source).not.toContain('function renderBoardFullLegacy');
    expect(source).not.toContain('boardEl.innerHTML');
    expect(source).not.toContain('boardEl.appendChild');
    expect(fullRenderSource).toContain('const fullRender = _resolveBoardFullRenderDelegate();');
    expect(fullRenderSource).toContain('fullRender(boardEl);');
    expect(fullRenderSource).toContain('diffRender(boardEl);');
    expect(fullRenderSource).toContain("console.error('[Board Renderer] diff-renderer.js not loaded; full rendering skipped')");
  });
});
