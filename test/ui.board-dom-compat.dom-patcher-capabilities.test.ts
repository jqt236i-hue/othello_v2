import * as fs from 'fs';
import * as path from 'path';

describe('diff renderer DOM patcher capabilities', () => {
  test('passes DOM patcher capabilities by responsibility instead of one flat context', () => {
    const rendererSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-dom-compat', 'renderer.ts'), 'utf8');
    const patcherSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'board-dom-compat', 'dom-patcher.ts'), 'utf8');

    expect(rendererSource).toContain('board: {');
    expect(rendererSource).toContain('playback: {');
    expect(rendererSource).toContain('runtime: {');
    expect(rendererSource).toContain('stones: {');
    expect(patcherSource).toContain('board: boardCapabilities');
    expect(patcherSource).toContain('playback: playbackCapabilities');
    expect(patcherSource).toContain('stones: stoneCapabilities');
    expect(patcherSource).not.toContain('} = deps;');
  });
});
