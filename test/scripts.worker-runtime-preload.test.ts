import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { assertWorkerGraphHasNoPixi } = require('../scripts/check-worker-runtime-preload');

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
});
