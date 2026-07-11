import { spawnSync } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('worker runtime preload checks', () => {
  test('verifies the preload registry remains the single Worker dependency source', () => {
    const result = spawnSync(process.execPath, ['dist/scripts/check-worker-runtime-preload.js'], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('[worker-runtime-preload] single source verified registrations=');
  });
});
