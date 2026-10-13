import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');

describe('checkall critical-check wiring', () => {
  test('invokes dependency boundaries and the executable browser freshness check', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const checkallSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'run-all-checks.ts'), 'utf8');

    expect(packageJson.scripts['check:dependency-boundaries']).toBe(
      'jest --runInBand --runTestsByPath test\\refactor.dependency-boundary.test.ts'
    );
    expect(checkallSource).toContain('function runNpmScript(scriptName: string): boolean');
    expect(checkallSource).toContain("runNpmScript('check:dependency-boundaries')");
    expect(checkallSource).toContain("run('node', ['dist/scripts/check-browser-build-up-to-date.js'])");
    expect(checkallSource).not.toContain("run('node', ['scripts/check-browser-build-up-to-date.js'])");
  });

  test('runs every check against the prepared snapshot without nested build or generation steps', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const checkallSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'run-all-checks.ts'), 'utf8');
    const npmScripts = Array.from(checkallSource.matchAll(/runNpmScript\('([^']+)'\)/g)).map((match) => match[1]);
    const buildPattern = /\b(?:build:|build-|worker:prepare|tsc\b|vite build|generate:)/;

    expect(npmScripts.length).toBeGreaterThan(0);
    for (const scriptName of npmScripts) {
      expect({ scriptName, command: packageJson.scripts[scriptName] }).toEqual({
        scriptName,
        command: expect.not.stringMatching(buildPattern)
      });
    }
    expect(checkallSource).toContain("run('node', ['dist/scripts/check-worker-mirror.js'])");
    expect(checkallSource).toContain("run('node', ['dist/scripts/check-artifact-retention.js'])");
    expect(checkallSource).toContain("run('node', ['dist/scripts/build-vite-entry.js', '--check'])");
    expect(checkallSource).not.toMatch(/build-vite-entry\.js'\]\)/);
    expect(packageJson.scripts['check:worker-mirror']).not.toMatch(buildPattern);
    expect(packageJson.scripts['checkall:prepared']).toBe('node scripts/checkall-bootstrap.js --prepared');
  });
});
