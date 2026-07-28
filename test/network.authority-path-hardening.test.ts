import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

const AUTHORITY_RANDOM_TARGETS = [
  'utils/match-command-runtime.ts',
  'workers/match-worker.ts',
  'scripts/local-match-server.ts',
  'game/turn',
  'game/cards',
  'game/logic/cards.ts',
  'game/logic/cards',
  'game/logic/effects'
];

function collectFiles(target: string): string[] {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    return /\.(ts|js)$/.test(absolute) ? [absolute] : [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(path.relative(ROOT, child)));
    } else if (/\.(ts|js)$/.test(entry.name)) {
      out.push(child);
    }
  }
  return out;
}

function readLineAt(source: string, index: number): string {
  const before = source.slice(0, index);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineEnd = source.indexOf('\n', index);
  return source.slice(lineStart, lineEnd >= 0 ? lineEnd : source.length);
}

describe('network authority path hardening', () => {
  test('match authority statically imports the shared network contract for Worker bundling', () => {
    const source = fs.readFileSync(path.join(ROOT, 'utils/match-authority.ts'), 'utf8');

    expect(source).toContain("import * as NetworkContract from '../shared/network-contract';");
    expect(source).not.toMatch(/_require\(['"]\.\.\/shared\/network-contract['"]\)/);
  });

  test('canonical authority paths do not use ambient Math.random without an explicit allowlist', () => {
    const violations: Array<{ file: string; line: string }> = [];
    const files = Array.from(new Set(AUTHORITY_RANDOM_TARGETS.flatMap(collectFiles))).sort();

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const matches = source.matchAll(/Math\.random\s*\(/g);
      for (const match of matches) {
        const index = typeof match.index === 'number' ? match.index : 0;
        const line = readLineAt(source, index);
        if (line.includes('network-authority-random-allowlist')) continue;
        violations.push({
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          line: line.trim()
        });
      }
    }

    expect(violations).toEqual([]);
  });

  test('direct local runtime delegates once to the synchronous shared-executor facade', () => {
    const LocalMatchRuntime = require('../scripts/local-match-runtime');
    const LocalMatchServer = require('../scripts/local-match-server');
    const facade = jest.spyOn(LocalMatchServer, 'applyCommandPublishToSnapshot');
    const runtime = LocalMatchRuntime.createRuntime({ seed: 67 });
    const snapshot = runtime.getSnapshot();
    const turnIndex = Number(snapshot.cardState && snapshot.cardState.turnIndex) || 0;
    const body = {
      actionType: 'pass',
      seatKey: 'black',
      playerKey: 'black',
      actor: 'black',
      baseVersion: runtime.getRoom().stateVersion,
      operationId: 'op_direct_local_authority_1',
      turnIndex,
      action: {
        type: 'pass',
        playerKey: 'black',
        turnIndex,
        forcePass: true
      }
    };

    try {
      const result = runtime.applyCommand(body);

      expect(result && typeof result.then).not.toBe('function');
      expect(facade).toHaveBeenCalledTimes(1);
      expect(facade).toHaveBeenCalledWith(runtime.getRoom(), body, 'black');
    } finally {
      facade.mockRestore();
    }
  });
});
