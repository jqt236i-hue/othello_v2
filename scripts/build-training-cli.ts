import * as path from 'path';
import * as ts from 'typescript';

const currentDir = path.resolve(__dirname);
const repoRoot = path.basename(path.dirname(currentDir)) === 'dist'
  ? path.resolve(currentDir, '..', '..')
  : path.resolve(currentDir, '..');
const configFileName = 'tsconfig.training.build.json';

function resolveTrainingBuildConfigPath(): string {
  const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, configFileName);
  if (!configPath) {
    throw new Error(`[build-training-cli] ${configFileName} not found from ${repoRoot}`);
  }
  return configPath;
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => ts.sys.newLine
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
}

function readTrainingBuildConfig(configPath = resolveTrainingBuildConfigPath()): ts.ParsedCommandLine {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath
  );
  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors));
  }
  return parsed;
}

function emitTrainingScripts(configPath = resolveTrainingBuildConfigPath()): string[] {
  const parsed = readTrainingBuildConfig(configPath);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics));
  }

  const emitResult = program.emit();
  if (emitResult.diagnostics.length > 0 || emitResult.emitSkipped) {
    throw new Error(formatDiagnostics(emitResult.diagnostics));
  }

  return parsed.fileNames.filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts'));
}

function main(): void {
  try {
    const files = emitTrainingScripts();
    console.log(`[build-training-cli] emitted ${files.length} files to dist${path.sep}scripts`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

export = {
  emitTrainingScripts,
  readTrainingBuildConfig,
  resolveTrainingBuildConfigPath,
  main
};
