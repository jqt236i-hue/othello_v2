import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

interface CommandSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_SERVER_ARGS = Object.freeze([
  '--host',
  '0.0.0.0',
  '--port',
  '5174'
]);

function hasRegularFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_error) {
    return false;
  }
}

function hasRegularFiles(directoryPath: string): boolean {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true })
      .some((entry) => entry.isFile());
  } catch (_error) {
    return false;
  }
}

function hasReusableViteBundle(rootDir = ROOT_DIR): boolean {
  const outputDir = path.join(rootDir, 'vite-dist');
  const manifestExists = [
    path.join(outputDir, '.vite', 'manifest.json'),
    path.join(outputDir, 'manifest.json')
  ].some(hasRegularFile);

  return hasRegularFile(path.join(outputDir, 'index.vite.html'))
    && manifestExists
    && hasRegularFiles(path.join(outputDir, 'assets'));
}

function hasCompiledServeEntrypoint(rootDir = ROOT_DIR): boolean {
  return hasRegularFile(path.join(rootDir, 'dist', 'scripts', 'serve-with-fallback.js'));
}

function canStartServerImmediately(rootDir = ROOT_DIR): boolean {
  return hasCompiledServeEntrypoint(rootDir) && hasReusableViteBundle(rootDir);
}

function resolveNpmCommand(platform: string = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

function createServerCommand(rootDir = ROOT_DIR, extraArgs: readonly string[] = []): CommandSpec {
  return Object.freeze({
    command: process.execPath,
    args: [
      path.join(rootDir, 'scripts', 'serve-with-fallback.js'),
      ...DEFAULT_SERVER_ARGS,
      ...extraArgs
    ],
    cwd: rootDir
  });
}

function createBuildCommand(rootDir = ROOT_DIR, platform: string = process.platform): CommandSpec {
  if (platform === 'win32') {
    const npmCommand = resolveNpmCommand(platform);
    return Object.freeze({
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `${npmCommand} run build:vite`],
      cwd: rootDir
    });
  }
  return Object.freeze({
    command: resolveNpmCommand(platform),
    args: ['run', 'build:vite'],
    cwd: rootDir
  });
}

function spawnManaged(commandSpec: CommandSpec): ChildProcess {
  return spawn(commandSpec.command, [...commandSpec.args], {
    cwd: commandSpec.cwd,
    stdio: 'inherit',
    windowsHide: false
  });
}

function stopChild(child: ChildProcess | null): void {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    child.kill();
  } catch (_error) {
    // The child may have exited between the state check and kill().
  }
}

function main(argv: readonly string[] = process.argv.slice(2)): void {
  const immediate = canStartServerImmediately(ROOT_DIR);
  const serverCommand = createServerCommand(ROOT_DIR, argv);
  const buildCommand = createBuildCommand(ROOT_DIR);
  let serverProcess: ChildProcess | null = null;
  let buildProcess: ChildProcess | null = null;
  let shuttingDown = false;

  const shutdown = (exitCode?: number): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopChild(buildProcess);
    stopChild(serverProcess);
    if (exitCode !== undefined) process.exitCode = exitCode;
  };

  const handleSignal = (signal: string): void => {
    console.log(`[dev] received ${signal}; stopping local server and build`);
    shutdown(0);
  };
  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  const startServer = (): void => {
    if (shuttingDown || serverProcess) return;
    serverProcess = spawnManaged(serverCommand);
    serverProcess.once('error', (error) => {
      console.error(`[dev] local server failed to start: ${error.message}`);
      shutdown(1);
    });
    serverProcess.once('close', (code, signal) => {
      if (shuttingDown) return;
      if (signal) {
        console.error(`[dev] local server stopped by ${signal}`);
        shutdown(1);
        return;
      }
      if (code !== 0) {
        console.error(`[dev] local server exited with code ${code}`);
        shutdown(Number.isInteger(code) && (code as number) > 0 ? (code as number) : 1);
        return;
      }
      shutdown(0);
    });
  };

  const startBuild = (): void => {
    buildProcess = spawnManaged(buildCommand);
    buildProcess.once('error', (error) => {
      console.error(`[dev] browser build failed to start: ${error.message}`);
      shutdown(1);
    });
    buildProcess.once('close', (code, signal) => {
      if (shuttingDown) return;
      if (signal || code !== 0) {
        console.error(
          `[dev] browser build failed${signal ? ` (${signal})` : ` with code ${code}`}`
        );
        shutdown(Number.isInteger(code) && (code as number) > 0 ? (code as number) : 1);
        return;
      }
      console.log('[dev] browser build completed; refresh the page to use the new bundle');
      if (!serverProcess) startServer();
    });
  };

  if (immediate) {
    console.log('[dev] serving the previous Vite bundle while the current build runs');
    startServer();
    startBuild();
    return;
  }

  console.log('[dev] no reusable Vite bundle found; building before starting the server');
  startBuild();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[dev] failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export = {
  DEFAULT_SERVER_ARGS,
  hasReusableViteBundle,
  hasCompiledServeEntrypoint,
  canStartServerImmediately,
  resolveNpmCommand,
  createServerCommand,
  createBuildCommand,
  main
};
