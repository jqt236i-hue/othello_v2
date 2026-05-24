import { spawnSync } from 'child_process';
import * as fs from 'fs';
const path = require('path');

describe('check-window-usage', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const fixturePath = path.join(repoRoot, 'game', '__window-check-fixture.ts');
  const networkClientFixturePath = path.join(repoRoot, 'game', 'card-effects', '__network-client-check-fixture.ts');
  const networkHandoffRuntimePath = path.join(repoRoot, 'game', 'network-turn-handoff.runtime.js');

  afterEach(() => {
    try {
      if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
      if (fs.existsSync(networkClientFixturePath)) fs.unlinkSync(networkClientFixturePath);
    } catch (e) {
      // Best-effort cleanup for negative static-check fixtures.
    }
  });

  function runCheckWindowUsage() {
    return spawnSync(process.execPath, ['scripts/check-window-usage.js'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
  }

  test('inspects source-of-truth files without reporting generated wrappers', () => {
    const res = runCheckWindowUsage();

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('No globalThis property access found in source-of-truth game files.');
    expect(res.stdout).not.toContain('dist/');
    expect(res.stdout).not.toContain('worker-public/');
    expect(res.stderr).toBe('');
  });

  test('rejects TypeScript-casted globalThis property access in game source', () => {
    fs.writeFileSync(
      fixturePath,
      'export function fixture() { return (globalThis as any).__forbiddenGameRuntimeRoot; }\n',
      'utf8'
    );

    const res = runCheckWindowUsage();

    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Forbidden globalThis property access found');
    expect(res.stderr).toContain('game/__window-check-fixture.ts');
  });

  test('rejects root NetworkMatchClient discovery from game source', () => {
    fs.writeFileSync(
      networkClientFixturePath,
      "export function fixture() { return (globalThis as any)['NetworkMatchClient']; }\n",
      'utf8'
    );

    const res = runCheckWindowUsage();

    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Forbidden usage found in non-UI files');
    expect(res.stderr).toContain('game/card-effects/__network-client-check-fixture.ts');
    expect(res.stderr).toContain('root NetworkMatchClient');
  });

  test('rejects root NetworkMatchClient name smuggling from game source', () => {
    fs.writeFileSync(
      networkClientFixturePath,
      "export function fixture(resolveGlobalValue) { return resolveGlobalValue('NetworkMatchClient'); }\n",
      'utf8'
    );

    const res = runCheckWindowUsage();

    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Forbidden usage found in non-UI files');
    expect(res.stderr).toContain('game/card-effects/__network-client-check-fixture.ts');
    expect(res.stderr).toContain('root NetworkMatchClient');
  });

  test('rejects root NetworkMatchClient fallback in network handoff runtime projection', () => {
    const original = fs.readFileSync(networkHandoffRuntimePath, 'utf8');
    try {
      fs.writeFileSync(networkHandoffRuntimePath, `${original}\n;void 'NetworkMatchClient';\n`, 'utf8');

      const res = runCheckWindowUsage();

      expect(res.status).toBe(2);
      expect(res.stderr).toContain('Forbidden usage found in non-UI files');
      expect(res.stderr).toContain('game/network-turn-handoff.runtime.js');
      expect(res.stderr).toContain('root NetworkMatchClient');
    } finally {
      fs.writeFileSync(networkHandoffRuntimePath, original, 'utf8');
    }
  });
});
