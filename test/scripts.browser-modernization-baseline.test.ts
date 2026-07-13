import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  captureCpuFixtures,
  capturePresentationBaseline,
  normalizeAction,
  stableJson,
  toMarkdown
} = require('../scripts/capture-browser-modernization-baseline');

describe('browser modernization baseline capture', () => {
  test('captures deterministic CPU actions and scores', () => {
    const first = captureCpuFixtures();
    const second = captureCpuFixtures();

    expect(second).toEqual(first);
    expect(first.fixtures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'level3_heuristic_move',
        action: expect.objectContaining({ type: 'move', move: expect.objectContaining({ row: 0, col: 0 }) })
      }),
      expect.objectContaining({ name: 'no_move_use_card', action: { type: 'useCard', cardId: 'guard_will' } }),
      expect.objectContaining({ name: 'no_move_pass', action: { type: 'pass' } })
    ]));
    expect(first.scoreDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  test('normalizes actions without retaining mutable definitions', () => {
    expect(normalizeAction({
      type: 'useCard',
      cardId: 'guard_will',
      cardDef: { id: 'guard_will', nested: { mutable: true } }
    })).toEqual({ type: 'useCard', cardId: 'guard_will' });
  });

  test('uses stable sorted object keys for digests', () => {
    const left = stableJson({ z: 2, a: { y: 1, b: 3 } });
    const right = stableJson({ a: { b: 3, y: 1 }, z: 2 });
    expect(left).toBe(right);
  });

  test('captures screen contract and file digests from an isolated root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-modernization-baseline-'));
    try {
      fs.mkdirSync(path.join(root, 'tests', 'visual-regression'), { recursive: true });
      fs.writeFileSync(path.join(root, 'index.html'), [
        '<div id="board"></div>',
        '<div id="leftActionButtons"></div>',
        '<button id="resetBtn"></button>',
        '<button id="rulesHelpBtn"></button>',
        '<div id="rules-help-panel"></div>',
        '<button id="gachaOpenBtn"></button>',
        '<div id="gachaOverlay"></div>',
        '<button id="modeNetworkBtn"></button>',
        '<div id="networkOverlay"></div>'
      ].join('\n'));
      fs.writeFileSync(path.join(root, 'tests', 'visual-regression', 'baseline-board.png'), Buffer.from('png-baseline'));
      const captured = capturePresentationBaseline(root);
      expect(captured.visualBaselineSha256).toBe(crypto.createHash('sha256').update('png-baseline').digest('hex'));
      expect(Object.values(captured.requiredElementIds).every(Boolean)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('renders a concise markdown comparison surface', () => {
    const markdown = toMarkdown({
      commit: 'abc',
      capturedAt: '2026-07-13T00:00:00.000Z',
      environment: { node: 'v24.0.0' },
      boot: { sample: {
        moduleRegistryBytes: 10,
        optionalRegistryBytes: 2,
        requiredBootModuleCount: 3,
        optionalBootModuleCount: 1,
        networkModeReadyMs: 5,
        optionalRegistryLoadedAtStartup: false,
        onnxScriptLoadedAtStartup: false
      } },
      cpu: { fixtures: [{ name: 'pass', action: { type: 'pass' }, actionDigest: 'd' }], scoreDigest: 's' },
      presentation: { visualBaselinePath: 'x.png', visualBaselineSha256: 'v', sourceDigest: 'p' },
      verificationContracts: ['npm run checkall'],
      verificationRun: ['Focused checks: pass.']
    });
    expect(markdown).toContain('Browser modernization baseline');
    expect(markdown).toContain('| pass | pass |');
    expect(markdown).toContain('`npm run checkall`');
    expect(markdown).toContain('Focused checks: pass.');
  });
});
