import * as fs from 'fs';
import * as path from 'path';

describe('diff renderer world effects', () => {
  test('keeps manifestation BGM and background side effects in their focused module', () => {
    const rendererSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer.ts'), 'utf8');
    const worldEffectsSource = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'diff-renderer', 'world-effects.ts'), 'utf8');

    expect(rendererSource).toContain("_require('./diff-renderer/world-effects')");
    expect(rendererSource).toContain('DiffRendererWorldEffects.syncManifestWorldEffects({');
    expect(rendererSource).toContain('DiffRendererWorldEffects.resetManifestWorldEffects({');
    expect(rendererSource).not.toContain('function _syncManifestBgmForDiff');
    expect(rendererSource).not.toContain('function _syncManifestWorldBackgroundForDiff');
    expect(worldEffectsSource).toContain('syncManifestWorldEffects');
    expect(worldEffectsSource).toContain('resetManifestWorldEffects');
  });
});
