import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  assertStaticDependencyChain,
  assertWorkerGraphHasNoPixi,
  collectEagerModuleSpecifiers,
  collectGraphModuleSpecifiers
} = require('../scripts/check-worker-runtime-preload');

const ROOT = path.resolve(__dirname, '..');

describe('worker runtime preload checks', () => {
  test('verifies the preload registry remains the single Worker dependency source', () => {
    const result = spawnSync(process.execPath, ['dist/scripts/check-worker-runtime-preload.js'], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('[worker-runtime-preload] single source verified registrations=');
    expect(`${result.stdout}${result.stderr}`).toContain('pixiExcludedGraphFiles=');
  });

  test('follows explicit .js source imports to .ts and rejects PixiJS in the Worker graph', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-pixi-graph-'));
    try {
      const workersDir = path.join(rootDir, 'workers');
      fs.mkdirSync(workersDir, { recursive: true });
      fs.writeFileSync(
        path.join(workersDir, 'match-worker.ts'),
        "import './match-worker-runtime-preload.js';\n",
        'utf8'
      );
      fs.writeFileSync(
        path.join(workersDir, 'match-worker-runtime-preload.ts'),
        "const PIXI = require('pixi.js');\nexport = PIXI;\n",
        'utf8'
      );
      expect(() => assertWorkerGraphHasNoPixi(rootDir))
        .toThrow(/Worker runtime imports PixiJS.*match-worker-runtime-preload\.ts.*pixi\.js/s);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('rejects a dynamic-only board contract dependency that bundlers cannot traverse', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-board-contract-graph-'));
    const chain = [
      'utils/match-authority.ts',
      'shared/shared-board-utils.ts',
      'shared/board/state-kernel.ts'
    ];
    try {
      fs.mkdirSync(path.join(rootDir, 'utils'), { recursive: true });
      fs.mkdirSync(path.join(rootDir, 'shared', 'board'), { recursive: true });
      fs.writeFileSync(
        path.join(rootDir, 'utils', 'match-authority.ts'),
        [
          "const modulePath = '../shared/shared-board-utils';",
          "require(modulePath);",
          "// import '../shared/shared-board-utils';",
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(rootDir, 'shared', 'shared-board-utils.ts'),
        [
          "const modulePath = './board/state-kernel';",
          "require(modulePath);",
          "const decoy = \"require('./board/state-kernel')\";",
          "void decoy;",
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(rootDir, 'shared', 'board', 'state-kernel.ts'),
        'export {};\n',
        'utf8'
      );

      expect(() => assertStaticDependencyChain(rootDir, chain))
        .toThrow(/required static dependency missing.*match-authority\.ts.*shared-board-utils\.ts/s);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('does not accept a literal dynamic import as an eager board contract dependency', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-board-contract-lazy-'));
    const chain = [
      'utils/match-authority.ts',
      'shared/shared-board-utils.ts',
      'shared/board/state-kernel.ts'
    ];
    try {
      fs.mkdirSync(path.join(rootDir, 'utils'), { recursive: true });
      fs.mkdirSync(path.join(rootDir, 'shared', 'board'), { recursive: true });
      fs.writeFileSync(
        path.join(rootDir, 'utils', 'match-authority.ts'),
        "void import('../shared/shared-board-utils');\n",
        'utf8'
      );
      fs.writeFileSync(
        path.join(rootDir, 'shared', 'shared-board-utils.ts'),
        "require('./board/state-kernel');\n",
        'utf8'
      );
      fs.writeFileSync(
        path.join(rootDir, 'shared', 'board', 'state-kernel.ts'),
        'export {};\n',
        'utf8'
      );

      expect(() => assertStaticDependencyChain(rootDir, chain))
        .toThrow(/required static dependency missing.*match-authority\.ts.*shared-board-utils\.ts/s);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('separates graph-reachable dynamic imports from eager value dependencies', () => {
    const source = [
      "import RuntimeEquals = require('./runtime-equals');",
      "import type TypeEquals = require('./type-equals');",
      "import type DefaultType from './type-default';",
      "import { type NamedType } from './type-named';",
      "import { type MixedType, runtimeValue } from './runtime-mixed';",
      "export type { ExportedType } from './type-export';",
      "export { type MixedExportType, runtimeExport } from './runtime-export';",
      "const lazy = import('./runtime-dynamic', { with: { type: 'json' } });",
      "const decoy = \"require('./string-decoy')\";",
      "// import './comment-decoy';",
      "void RuntimeEquals; void runtimeValue; void runtimeExport; void lazy; void decoy;",
    ].join('\n');

    expect(collectGraphModuleSpecifiers(source).sort()).toEqual([
      './runtime-dynamic',
      './runtime-equals',
      './runtime-export',
      './runtime-mixed',
    ]);
    expect(collectEagerModuleSpecifiers(source).sort()).toEqual([
      './runtime-equals',
      './runtime-export',
      './runtime-mixed',
    ]);
  });
});
