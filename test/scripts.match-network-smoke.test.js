const { spawnSync } = require('child_process');

describe('match-network-smoke', () => {
  test('starts a managed local server by default and completes the smoke flow', () => {
    const result = spawnSync(process.execPath, ['scripts/match-network-smoke.js'], {
      encoding: 'utf8',
      timeout: 20000
    });

    if (result.error) {
      throw result.error;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\[match-check\] auto-start local server http:\/\/127\.0\.0\.1:\d+/);
    expect(result.stdout).toMatch(/\[match-check\] success/);
  });
});
