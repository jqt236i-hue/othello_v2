import { spawnSync } from 'child_process';
const path = require('path');

describe('check-window-usage', () => {
  test('inspects source-of-truth files without reporting generated wrappers', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const res = spawnSync(process.execPath, ['scripts/check-window-usage.js'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('No globalThis property access found in source-of-truth game files.');
    expect(res.stdout).not.toContain('dist/');
    expect(res.stdout).not.toContain('worker-public/');
    expect(res.stderr).toBe('');
  });
});
