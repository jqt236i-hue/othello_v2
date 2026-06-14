# Training Typecheck And Selfplay Mirror Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `training/scripts/**/*.ts` and the training selfplay runner boundary semantically typechecked, and remove the duplicate `training/engine/selfplay-runner.ts` implementation while preserving existing CLI and require paths.

**Architecture:** `src/engine/selfplay-runner.ts` remains the single canonical selfplay implementation. `training/engine/selfplay-runner.{ts,js}` becomes a compatibility adapter to that canonical module, and `training/scripts/**/*.ts` is compiled through a dedicated TypeScript program instead of `ts.transpileModule`.

**Tech Stack:** TypeScript 6, CommonJS modules, npm scripts, Jest, existing `dist/scripts/*` CLI wrapper contract.

---

## Current Problems

1. `training/scripts/**/*.ts` is documented as source of truth, but root `tsconfig.json` and `tsconfig.build.json` do not include `training/**/*.ts`.
2. `scripts/build-training-cli.ts` emits runtime JS with `ts.transpileModule`, which does not perform semantic typechecking.
3. `training/engine/selfplay-runner.ts` is a large near-copy of `src/engine/selfplay-runner.ts`, while `training/engine/selfplay-runner.js` already delegates to `../../src/engine/selfplay-runner.js`.
4. `test/selfplay.position-weights.test.ts` currently protects the mirror shape instead of protecting the intended single-source boundary.

## Behavior To Preserve

- Existing public CLI entrypoints under `scripts/*.js` continue to load `dist/scripts/*.js` through `scripts/dist-cli-wrapper.js`.
- `npm run build:ts` still emits training CLI files into `dist/scripts`, not `dist/training/scripts`.
- `training/engine/selfplay-runner.js` remains require-compatible for existing Node callers.
- Selfplay schema versions and exported runner functions continue to come from `src/engine/selfplay-runner.ts`.
- No gameplay, training policy, network, card, or UI behavior changes are included in this refactor.

## File Structure

- Create `tsconfig.training.json`: semantic no-emit typecheck for training runtime TypeScript.
- Create `tsconfig.training.build.json`: emit-only training CLI build into `dist/scripts`.
- Modify `package.json`: add `typecheck:training`; wire it into `typecheck`, `typecheck:ts-only`, and `build:ts`.
- Modify `scripts/build-training-cli.ts`: replace `transpileModule` with a `ts.createProgram` build that fails on diagnostics.
- Modify `training/engine/selfplay-runner.ts`: replace duplicate implementation with a thin adapter to `../../src/engine/selfplay-runner`.
- Keep `training/engine/selfplay-runner.js`: compatibility adapter to `../../src/engine/selfplay-runner.js`.
- Modify `test/selfplay.position-weights.test.ts`: assert canonical root matrix and thin training adapter.
- Create `test/training.typecheck-boundary.test.ts`: guard package scripts, tsconfig inclusion, and compiler-program build path.
- Modify `docs/refactor-boundary-debt.md`: replace stale `"typechecks"` wording with the new explicit training typecheck boundary.

## Risk Classification

Risk: medium.

Reason: this changes build and typecheck boundaries and deletes a duplicate implementation body. Public runtime paths stay stable, but the validation surface must include CLI wrapper tests, selfplay tests, typecheck, and build.

Rollback: revert the commit for the failing task. Because the plan keeps public JS wrappers and does not change data formats, rollback should be a normal Git revert without data migration.

---

### Task 1: Add Boundary Characterization Tests

**Files:**
- Create: `test/training.typecheck-boundary.test.ts`
- Modify: `test/selfplay.position-weights.test.ts`

- [ ] **Step 1: Add the training typecheck boundary test**

Create `test/training.typecheck-boundary.test.ts`:

```ts
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
```

- [ ] **Step 2: Update the selfplay runner boundary test**

Replace the second test in `test/selfplay.position-weights.test.ts` with:

```ts
  test('training selfplay runner paths delegate to the canonical src runner', () => {
    const srcRunner = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'selfplay-runner.ts'), 'utf8');
    const trainingRunnerTs = fs.readFileSync(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner.ts'), 'utf8');
    const trainingRunnerJs = fs.readFileSync(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner.js'), 'utf8');

    expect(srcRunner).toContain("const SelfplayPositionWeights = require('./selfplay-position-weights.js');");
    expect(srcRunner).toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(srcRunner).not.toContain('const POSITION_WEIGHTS = [');

    expect(trainingRunnerTs).toContain("_require('../../src/engine/selfplay-runner')");
    expect(trainingRunnerTs).toContain('export = runner;');
    expect(trainingRunnerTs).not.toContain('function runSelfPlayGames');
    expect(trainingRunnerTs).not.toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(trainingRunnerTs.split(/\r?\n/).filter((line) => line.trim().length > 0).length).toBeLessThanOrEqual(12);

    expect(trainingRunnerJs).toContain('module.exports = require("../../src/engine/selfplay-runner.js");');
  });
```

- [ ] **Step 3: Run tests and verify they fail for the intended reasons**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\training.typecheck-boundary.test.ts test\selfplay.position-weights.test.ts
```

Expected: fail because `tsconfig.training.json` and `tsconfig.training.build.json` do not exist, `package.json` does not expose `typecheck:training`, `scripts/build-training-cli.ts` still contains `ts.transpileModule`, and `training/engine/selfplay-runner.ts` is still a large mirror.

- [ ] **Step 4: Commit the failing characterization tests**

```powershell
git add test/training.typecheck-boundary.test.ts test/selfplay.position-weights.test.ts
git commit -m "test: characterize training typecheck boundary"
```

---

### Task 2: Add Training Typecheck And Build Configs

**Files:**
- Create: `tsconfig.training.json`
- Create: `tsconfig.training.build.json`
- Modify: `package.json`

- [ ] **Step 1: Create the no-emit training typecheck config**

Create `tsconfig.training.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "noEmit": true
  },
  "include": [
    "training/scripts/**/*.ts",
    "training/engine/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "worker-public",
    "coverage",
    "dist",
    "**/__pycache__/**",
    "training/tests/**/*"
  ]
}
```

- [ ] **Step 2: Create the training CLI build config**

Create `tsconfig.training.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "declaration": false,
    "declarationMap": false,
    "noEmit": false,
    "outDir": "./dist/scripts",
    "rootDir": "./training/scripts",
    "sourceMap": true
  },
  "include": [
    "training/scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "worker-public",
    "coverage",
    "dist",
    "**/__pycache__/**",
    "training/tests/**/*"
  ]
}
```

- [ ] **Step 3: Wire package scripts to the training typecheck**

Update `package.json` scripts to these exact values:

```json
"typecheck": "tsc --noEmit && npm run typecheck:training",
"typecheck:ts-only": "tsc -p tsconfig.ts-only.json --pretty false && npm run typecheck:training",
"build:ts": "tsc -p tsconfig.build.json && npm run typecheck:training && node scripts/build-training-cli.js",
"typecheck:training": "tsc -p tsconfig.training.json --pretty false"
```

Keep every other script unchanged.

- [ ] **Step 4: Run the boundary test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\training.typecheck-boundary.test.ts
```

Expected: still fail only on the `scripts/build-training-cli.ts` `ts.transpileModule` assertion until Task 3 is complete.

- [ ] **Step 5: Commit the config and package script change**

```powershell
git add package.json tsconfig.training.json tsconfig.training.build.json
git commit -m "build: add training typecheck config"
```

---

### Task 3: Replace `transpileModule` Training Build With Program Emit

**Files:**
- Modify: `scripts/build-training-cli.ts`

- [ ] **Step 1: Replace `scripts/build-training-cli.ts`**

Replace the file with:

```ts
import * as fs from 'fs';
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

function removePreviousTrainingOutputs(outDir: string): void {
  if (!fs.existsSync(outDir)) return;
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.js.map')) continue;
    fs.rmSync(path.join(outDir, entry.name), { force: true });
  }
}

function emitTrainingScripts(configPath = resolveTrainingBuildConfigPath()): string[] {
  const parsed = readTrainingBuildConfig(configPath);
  const outDir = parsed.options.outDir ? path.resolve(parsed.options.outDir) : path.join(repoRoot, 'dist', 'scripts');
  removePreviousTrainingOutputs(outDir);

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics));
  }

  const emitResult = program.emit();
  if (emitResult.diagnostics.length > 0 || emitResult.emitSkipped) {
    throw new Error(formatDiagnostics(emitResult.diagnostics));
  }

  return parsed.fileNames
    .map((filePath) => {
      const relative = path.relative(path.join(repoRoot, 'training', 'scripts'), filePath);
      return path.join(outDir, relative).replace(/\.ts$/i, '.js');
    })
    .filter((filePath) => fs.existsSync(filePath));
}

function main(): void {
  try {
    const files = emitTrainingScripts();
    console.log(`[build-training-cli] emitted ${files.length} files to ${path.relative(repoRoot, path.join(repoRoot, 'dist', 'scripts'))}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
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
```

- [ ] **Step 2: Run the boundary test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\training.typecheck-boundary.test.ts
```

Expected: pass.

- [ ] **Step 3: Run the training build script directly**

Run:

```powershell
npm run build:ts
```

Expected: if Task 4 has not been done yet, this may fail on `training/engine/selfplay-runner.ts` type errors only when `typecheck:training` reaches the mirror. If it fails there, continue to Task 4 before treating the failure as blocking.

- [ ] **Step 4: Commit the compiler-program build change**

If the boundary test passes, commit this task even if `npm run build:ts` is waiting on Task 4:

```powershell
git add scripts/build-training-cli.ts
git commit -m "build: typecheck training cli emit"
```

---

### Task 4: Replace The Training Selfplay Runner Mirror With An Adapter

**Files:**
- Modify: `training/engine/selfplay-runner.ts`
- Keep: `training/engine/selfplay-runner.js`
- Modify: `test/selfplay.position-weights.test.ts`

- [ ] **Step 1: Replace the TypeScript mirror with a thin adapter**

Replace `training/engine/selfplay-runner.ts` with:

```ts
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const runner = _require('../../src/engine/selfplay-runner');

export = runner;
```

- [ ] **Step 2: Confirm the JavaScript compatibility adapter is still unchanged**

`training/engine/selfplay-runner.js` must remain:

```js
"use strict";
/** @type {any} */
module.exports = require("../../src/engine/selfplay-runner.js");
```

- [ ] **Step 3: Run selfplay boundary tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\selfplay.position-weights.test.ts training\tests\selfplay.runtime-parity.test.ts training\tests\selfplay.runner.test.ts
```

Expected: pass.

- [ ] **Step 4: Run the new training typecheck**

Run:

```powershell
npm run typecheck:training
```

Expected: pass.

- [ ] **Step 5: Commit the selfplay mirror removal**

```powershell
git add training/engine/selfplay-runner.ts test/selfplay.position-weights.test.ts
git commit -m "refactor: collapse training selfplay mirror"
```

---

### Task 5: Update Boundary Documentation

**Files:**
- Modify: `docs/refactor-boundary-debt.md`

- [ ] **Step 1: Update the training boundary notes**

Replace the existing bullets about `training/scripts/*.ts` and `training/engine/selfplay-runner.ts` typechecking with:

```md
- `training/scripts/**/*.ts` is now covered by `tsconfig.training.json` through `npm run typecheck:training`; `npm run build:ts` also runs that check before emitting `dist/scripts/*`.
- `scripts/build-training-cli.ts` now emits training CLI wrappers through a TypeScript program based on `tsconfig.training.build.json`, so semantic diagnostics block generated CLI output.
- `training/engine/selfplay-runner.ts` is now a thin adapter to `src/engine/selfplay-runner.ts`; the root runner is the only selfplay implementation body.
```

Do not edit `01-rulebook.md` or `正本/*.md`; this refactor does not change player-visible behavior.

- [ ] **Step 2: Run documentation diff check**

Run:

```powershell
git diff --check -- docs/refactor-boundary-debt.md
```

Expected: no whitespace errors.

- [ ] **Step 3: Commit the documentation update**

```powershell
git add docs/refactor-boundary-debt.md
git commit -m "docs: record training typecheck boundary"
```

---

### Task 6: Final Validation Bundle

**Files:**
- Inspect only unless validation exposes a task-owned failure.

- [ ] **Step 1: Run focused regression tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\training.typecheck-boundary.test.ts test\selfplay.position-weights.test.ts training\tests\selfplay.training-cli-wrapper.test.ts training\tests\selfplay.runtime-parity.test.ts training\tests\selfplay.runner.test.ts
```

Expected: pass.

- [ ] **Step 2: Run training typecheck**

Run:

```powershell
npm run typecheck:training
```

Expected: pass.

- [ ] **Step 3: Run root typecheck**

Run:

```powershell
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: pass and emit training CLI files into `dist/scripts`.

- [ ] **Step 5: Run checkall**

Run:

```powershell
npm run checkall
```

Expected: pass.

- [ ] **Step 6: Inspect generated output and status**

Run:

```powershell
git status --short
git diff --stat
```

Expected: intentional source changes only, plus generated `dist/` output ignored by Git. Do not stage unrelated pre-existing files.

- [ ] **Step 7: Commit final fixes if validation required any source adjustment**

If validation required a small source-only fix, stage only task-owned files:

```powershell
git add package.json tsconfig.training.json tsconfig.training.build.json scripts/build-training-cli.ts training/engine/selfplay-runner.ts test/training.typecheck-boundary.test.ts test/selfplay.position-weights.test.ts docs/refactor-boundary-debt.md
git commit -m "refactor: harden training source boundary"
```

Skip this commit when the preceding task commits already contain the exact final source state.

---

## Self-Review

- Spec coverage: the plan covers the two requested refactor targets: training TypeScript typecheck/build boundary and duplicated training selfplay runner implementation.
- Behavior preservation: public JS wrapper paths, CLI wrapper paths, `dist/scripts` output location, and canonical selfplay exports are preserved.
- Placeholder scan: no deferred implementation text remains; every task has exact files, code, commands, and expected results.
- Split safety: tasks are independently committable and keep tests ahead of behavior-preserving source edits.
