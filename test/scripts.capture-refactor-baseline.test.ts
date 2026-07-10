import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const Baseline = require('../scripts/capture-refactor-baseline');

describe('capture-refactor-baseline', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-reversi-baseline-'));
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{"name":"fixture"}\n', 'utf8');
    fs.mkdirSync(path.join(tempDir, 'game'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'game', 'visual-effects-map.runtime.js'), 'module.exports = {};\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'game', 'network-turn-handoff.runtime.js'), 'module.exports = {};\n', 'utf8');
    fs.mkdirSync(path.join(tempDir, 'training', 'engine'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'training', 'engine', 'selfplay-runner.ts'), 'export = {};\n', 'utf8');
    fs.mkdirSync(path.join(tempDir, 'src', 'engine'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'engine', 'selfplay-runner.ts'), 'export = {};\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('uses the Windows npm executable when invoking npm through Node', () => {
    expect(Baseline.resolveCommandExecutable('npm')).toBe(process.platform === 'win32' ? 'npm.cmd' : 'npm');
    expect(Baseline.resolveCommandExecutable('git')).toBe('git');
    expect(Baseline.requiresCommandShell('npm')).toBe(process.platform === 'win32');
    expect(Baseline.requiresCommandShell('git')).toBe(false);
  });

  test('resolves the repository root from source and compiled script directories', () => {
    expect(Baseline.resolveRepositoryRoot(path.join(tempDir, 'scripts'))).toBe(tempDir);
    expect(Baseline.resolveRepositoryRoot(path.join(tempDir, 'dist', 'scripts'))).toBe(tempDir);
  });

  test('allows enough command output to count a large tracked artifact tree', () => {
    expect(Baseline.commandExecutionOptions(tempDir).maxBuffer).toBeGreaterThanOrEqual(64 * 1024 * 1024);
  });

  test('writes stable, redacted baseline metadata without traversing artifact contents', () => {
    const outputPath = path.join(tempDir, 'docs', 'baseline.md');
    const calls: Array<{ command: string; args: string[] }> = [];
    const runCommand = (command: string, args: string[]): string => {
      calls.push({ command, args });
      const key = `${command} ${args.join(' ')}`;
      if (key === 'git rev-parse HEAD') return 'abc123\n';
      if (key === 'git count-objects -vH') return 'size-pack: 1.23 MiB\n';
      if (key === 'git ls-files artifacts') return 'artifacts/profile/Cache/data\nartifacts/report.json\n';
      if (key === 'git ls-tree -r -l HEAD -- artifacts') return '100644 blob abc 1024\tartifacts/report.json\n';
      if (key === 'node --version') return 'v22.0.0\n';
      if (key === 'npm --version') return '10.0.0\n';
      throw new Error(`unexpected command: ${key}`);
    };

    const first = Baseline.captureRefactorBaseline({
      repoRoot: tempDir,
      outputPath,
      runCommand,
      pythonExecutablePath: path.join(tempDir, 'missing-python.exe')
    });
    const second = Baseline.captureRefactorBaseline({
      repoRoot: tempDir,
      outputPath,
      runCommand,
      pythonExecutablePath: path.join(tempDir, 'missing-python.exe')
    });

    expect(first).toBe(second);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe(first);
    expect(first).toContain('Starting commit: `abc123`');
    expect(first).toContain('Tracked artifact files: 2');
    expect(first).toContain('Logical artifact bytes: 1024');
    expect(first).toContain('Python: unavailable');
    expect(first).toContain('game/visual-effects-map.runtime.js');
    expect(first).not.toContain('artifacts/profile/Cache/data');
    expect(calls.every(({ command }) => command === 'git' || command === 'node' || command === 'npm')).toBe(true);
  });
});
