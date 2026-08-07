import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  DEFAULT_SERVER_ARGS,
  hasReusableViteBundle,
  hasCompiledServeEntrypoint,
  canStartServerImmediately,
  resolveNpmCommand,
  createServerCommand,
  createBuildCommand
} = require('../dist/scripts/dev-vite-fast');

describe('fast Vite development orchestrator', () => {
  test('recognizes a complete reusable Vite bundle', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-vite-fast-'));
    try {
      const outputDir = path.join(rootDir, 'vite-dist');
      fs.mkdirSync(path.join(outputDir, '.vite'), { recursive: true });
      fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'index.vite.html'), '<!doctype html>');
      fs.writeFileSync(path.join(outputDir, '.vite', 'manifest.json'), '{}');
      fs.writeFileSync(path.join(outputDir, 'assets', 'entry.js'), '');

      expect(hasReusableViteBundle(rootDir)).toBe(true);
      expect(hasCompiledServeEntrypoint(rootDir)).toBe(false);
      expect(canStartServerImmediately(rootDir)).toBe(false);

      fs.mkdirSync(path.join(rootDir, 'dist', 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(rootDir, 'dist', 'scripts', 'serve-with-fallback.js'), '');
      expect(hasCompiledServeEntrypoint(rootDir)).toBe(true);
      expect(canStartServerImmediately(rootDir)).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('rejects incomplete output instead of serving an empty asset directory', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-vite-fast-empty-'));
    try {
      const outputDir = path.join(rootDir, 'vite-dist');
      fs.mkdirSync(path.join(outputDir, '.vite'), { recursive: true });
      fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'index.vite.html'), '<!doctype html>');
      fs.writeFileSync(path.join(outputDir, '.vite', 'manifest.json'), '{}');
      expect(hasReusableViteBundle(rootDir)).toBe(false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test('constructs the existing server command and forwards overrides', () => {
    const command = createServerCommand('C:/workspace', ['--port', '5199']);
    expect(command.args.slice(1, 5)).toEqual([...DEFAULT_SERVER_ARGS]);
    expect(command.args.slice(-2)).toEqual(['--port', '5199']);
    expect(command.args[0]).toMatch(/scripts[\\/]serve-with-fallback\.js$/);
  });

  test('uses the platform npm command for the foreground build', () => {
    expect(resolveNpmCommand('win32')).toBe('npm.cmd');
    expect(resolveNpmCommand('linux')).toBe('npm');
    const windowsBuild = createBuildCommand('C:/workspace', 'win32');
    expect(windowsBuild.command.toLowerCase()).toMatch(/(?:cmd\.exe|command\.com)$/);
    expect(windowsBuild.args).toEqual(['/d', '/s', '/c', 'npm.cmd run build:vite']);
    expect(windowsBuild.cwd).toBe('C:/workspace');
    expect(createBuildCommand('C:/workspace', 'linux')).toEqual({
      command: 'npm',
      args: ['run', 'build:vite'],
      cwd: 'C:/workspace'
    });
  });
});
