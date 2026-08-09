import * as fs from 'fs';
import * as path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

function functionSource(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('board playback current-runtime-state contract', () => {
  test('normal board playback gating delegates to the current card-state resolver', () => {
    const source = read('ui/board-renderer.ts');
    const gateSource = functionSource(
      source,
      '_getCardStateForBoardRendererPlayback',
      '_hasPendingPlaybackEventsForBoardRenderer'
    );

    expect(source).toContain("const RuntimeStateAccessModule = _require('./runtime-state-access');");
    expect(gateSource).toContain('return _resolveGlobalCardStateForBoardRenderer();');
    expect(gateSource).not.toContain('typeof cardState');
  });

  test('state adapter and DOM compatibility use the shared current-state resolver', () => {
    const adapterSource = read('ui/board-visual/state-adapter.ts');
    const compatibilitySource = read('ui/board-dom-compat/renderer.ts');
    const compatibilityGateSource = functionSource(
      compatibilitySource,
      '_getCardStateForDiffPlayback',
      '_hasPendingPlaybackEvents'
    );

    expect(adapterSource).toContain("const RuntimeStateAccessModule = _require('../runtime-state-access');");
    expect(adapterSource).toContain(
      "RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState'"
    );
    expect(compatibilitySource).toContain(
      "const RuntimeStateAccessModule = _require('../runtime-state-access');"
    );
    expect(compatibilityGateSource).toContain(
      "RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState'"
    );
    expect(compatibilityGateSource.indexOf('resolveCurrentRuntimeObject')).toBeLessThan(
      compatibilityGateSource.indexOf('typeof cardState')
    );
  });

  test('presentation draining enters through the board-renderer facade capability', () => {
    const handlerSource = read('ui/presentation-handler.ts');

    expect(handlerSource).toContain(
      'renderer.getBoardVisualControllerReadyForPresentationDrain'
    );
  });
});
