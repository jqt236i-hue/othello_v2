import * as fs from 'fs';
import * as path from 'path';

describe('diff renderer projector capabilities', () => {
  test('passes grouped projector capabilities instead of a flat renderer context', () => {
    const rendererSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer.ts'), 'utf8');
    const projectorSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer', 'projector.ts'), 'utf8');

    expect(rendererSource).toContain('state: {');
    expect(rendererSource).toContain('hints: {');
    expect(rendererSource).toContain('markers: {');
    expect(rendererSource).toContain('debug: {');
    expect(projectorSource).toContain('state: stateCapabilities');
    expect(projectorSource).toContain('hints: hintCapabilities');
    expect(projectorSource).not.toContain('} = deps;');
  });
});
