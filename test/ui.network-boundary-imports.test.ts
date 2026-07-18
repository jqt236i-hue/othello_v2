import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function expectSourceNotToContain(relativePath: string, forbidden: RegExp, message: string): void {
  const source = read(relativePath);
  expect(source).not.toEqual(expect.stringMatching(forbidden), message);
}

describe('UI network boundary imports', () => {
  test('ui/network-client does not import game cards-internal modules', () => {
    expectSourceNotToContain(
      'ui/network-client.ts',
      /game\/logic\/cards-internal|game\\logic\\cards-internal|\.\.\/game\/logic\/cards-internal/,
      'ui/network-client.ts must use a public game boundary, not cards-internal'
    );
  });

  test('ui/network action bridge does not resolve game modules internally', () => {
    expectSourceNotToContain(
      'ui/network/action-bridge.ts',
      /_require\(['"]\.\.\/\.\.\/game\/|require\(['"]\.\.\/\.\.\/game\//,
      'ui/network/action-bridge.ts must receive game behavior by explicit injection'
    );
    expectSourceNotToContain(
      'ui/network/action-bridge.ts',
      /globalThis[\s\S]{0,80}CardLogic|globalThis[\s\S]{0,80}PendingCoordinator/,
      'ui/network/action-bridge.ts must not discover game globals'
    );
  });

  test('ui/network command payload does not resolve game modules internally', () => {
    expectSourceNotToContain(
      'ui/network/command-payload.ts',
      /_require\(['"]\.\.\/\.\.\/\.\.\/game\/|require\(['"]\.\.\/\.\.\/\.\.\/game\//,
      'ui/network/command-payload.ts must receive game behavior by explicit injection'
    );
  });
});

describe('UI renderer board hint boundaries', () => {
  test('renderers consume the shared board hint projection helper', () => {
    expect(read('ui/board-renderer.ts')).toContain('board-hint-projection');
    expect(read('ui/board-dom-compat/renderer.ts')).toContain('board-hint-projection');
  });

  test('renderers do not define duplicate random spawn preview helpers', () => {
    expect(read('ui/board-renderer.ts')).not.toContain('function collectRandomSpawnPreviewHighlightKeys');
    expect(read('ui/board-dom-compat/renderer.ts')).not.toContain('function _collectRandomSpawnPreviewHighlightKeysForDiff');
  });
});
