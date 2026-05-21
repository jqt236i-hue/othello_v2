import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

const AUTHORITY_RANDOM_TARGETS = [
  'utils/match-runtime-core.ts',
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

  test('shared authority core fails closed when required runtime dependencies are missing', () => {
    const MatchRuntimeCore = require('../utils/match-runtime-core');
    const room = {
      stateVersion: 0,
      snapshot: {
        stateVersion: 0,
        gameState: { currentPlayer: 1, board: [] },
        cardState: { turnIndex: 0 }
      }
    };

    const result = MatchRuntimeCore.applyCommandToSnapshot(room, {
      seatKey: 'black',
      playerKey: 'black',
      actor: 'black',
      actionType: 'place',
      operationId: 'op_missing_deps_1',
      baseVersion: 0,
      params: { row: 0, col: 0 },
      turnIndex: 0
    }, 'black', {});

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE'
    }));
  });
});

