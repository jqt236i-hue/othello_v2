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
});
