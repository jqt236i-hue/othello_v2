import * as fs from 'fs';
import * as path from 'path';

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('training TypeScript boundary', () => {
  const rootDir = path.join(__dirname, '..');

  test('package scripts typecheck and build training TypeScript sources explicitly', () => {
    const pkg = readJson(path.join(rootDir, 'package.json'));

    expect(pkg.scripts['typecheck:training']).toBe('tsc -p tsconfig.training.json --pretty false');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit && npm run typecheck:training');
    expect(pkg.scripts['typecheck:ts-only']).toBe(
      'tsc -p tsconfig.ts-only.json --pretty false && npm run typecheck:training'
    );
    expect(pkg.scripts['build:ts']).toBe(
      'tsc -p tsconfig.build.json && npm run typecheck:training && node scripts/build-training-cli.js'
    );
  });

  test('training tsconfig includes runtime training TypeScript sources', () => {
    const trainingConfig = readJson(path.join(rootDir, 'tsconfig.training.json'));
    const buildConfig = readJson(path.join(rootDir, 'tsconfig.training.build.json'));

    expect(trainingConfig.compilerOptions.noEmit).toBe(true);
    expect(trainingConfig.compilerOptions.allowJs).toBe(false);
    expect(trainingConfig.include).toEqual([
      'training/scripts/**/*.ts',
      'training/engine/**/*.ts'
    ]);

    expect(buildConfig.compilerOptions.noEmit).toBe(false);
    expect(buildConfig.compilerOptions.rootDir).toBe('./training/scripts');
    expect(buildConfig.compilerOptions.outDir).toBe('./dist/scripts');
    expect(buildConfig.include).toEqual(['training/scripts/**/*.ts']);
  });

  test('training CLI build uses a TypeScript program instead of transpileModule', () => {
    const source = readText(path.join(rootDir, 'scripts', 'build-training-cli.ts'));

    expect(source).toContain('ts.createProgram');
    expect(source).toContain('ts.getPreEmitDiagnostics');
    expect(source).not.toContain('ts.transpileModule');
  });
});
