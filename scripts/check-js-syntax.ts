import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as vm from 'vm';

import {
  GENERATED_OR_EXTERNAL_DIR_NAMES,
  collectSourceFiles,
  isExternalDataDir,
  toPosixRelative
} from './lib/source-file-walk';

// Syntax check for hand-maintained JavaScript in the checkout.
// Targets: `.js` / `.cjs` files are parsed as CommonJS (the package is "type": "commonjs"),
// using the same function wrapper as Node's CommonJS loader so top-level `return` is accepted.
// `.mjs` files are ES modules and are checked with `node --check`.
// Generated output, mirrors, and external data roots are not scanned, and links are not followed.

export type JsSyntaxError = { file: string; message: string };

const COMMONJS_WRAPPER_PARAMS = ['exports', 'require', 'module', '__filename', '__dirname'];

export function collectJsSyntaxTargets(root: string): string[] {
  return collectSourceFiles(['.'], {
    root,
    skipDirNames: GENERATED_OR_EXTERNAL_DIR_NAMES,
    skipDir: (relativeDir) => isExternalDataDir(relativeDir),
    includeFile: (_relativePath, name) => /\.(?:c?js|mjs)$/.test(name)
  });
}

function checkCommonJs(file: string): string | null {
  const code = fs.readFileSync(file, 'utf8').replace(/^#!.*/, '');
  try {
    vm.compileFunction(code, COMMONJS_WRAPPER_PARAMS, { filename: file });
    return null;
  } catch (error: any) {
    return error && error.message ? error.message : String(error);
  }
}

function checkEsModule(file: string): string | null {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.error) return result.error.message;
  if (result.status === 0) return null;
  const lines = String(result.stderr || '').split(/\r?\n/).filter((line) => /Error/.test(line));
  return lines[0] || `node --check exited with ${result.status}`;
}

export function checkJsSyntax(root: string): { files: string[]; emptyFiles: string[]; errors: JsSyntaxError[] } {
  const files = collectJsSyntaxTargets(root);
  const emptyFiles: string[] = [];
  const errors: JsSyntaxError[] = [];
  for (const file of files) {
    const relative = toPosixRelative(root, file);
    if (fs.statSync(file).size === 0) emptyFiles.push(relative);
    const message = file.endsWith('.mjs') ? checkEsModule(file) : checkCommonJs(file);
    if (message) errors.push({ file: relative, message });
  }
  return { files, emptyFiles, errors };
}

function main(): void {
  const root = process.cwd();
  const { files, emptyFiles, errors } = checkJsSyntax(root);
  if (emptyFiles.length) {
    console.log('EMPTY FILES:');
    emptyFiles.forEach((f) => console.log('  ' + f));
  }
  if (errors.length) {
    console.log('\nSYNTAX ERRORS:');
    errors.forEach((e) => console.log('  ' + e.file + ' -> ' + e.message));
    process.exit(2);
  }
  console.log(`\nAll ${files.length} JS files parsed OK (no syntax errors detected)`);
}

const isDirectRun = typeof require !== 'undefined'
  && !!require.main
  && /[\\/]check-js-syntax\.js$/.test(String(require.main.filename || ''));

if (isDirectRun) {
  main();
}
