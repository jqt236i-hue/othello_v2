#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'scripts', 'dev-vite-fast.ts');
const compiledPath = path.join(rootDir, 'dist/scripts/', 'dev-vite-fast.js');

function prepare() {
  let compile = true;
  try {
    compile = !fs.statSync(compiledPath).isFile()
      || fs.statSync(sourcePath).mtimeMs > fs.statSync(compiledPath).mtimeMs;
  } catch (_error) {}
  if (!compile) return;
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run build:ts']
    : ['run', 'build:ts'];
  const result = spawnSync(command, args, { cwd: rootDir, stdio: 'inherit' });
  if (result.error) { console.error(`[dev] failed to prepare the dev CLI: ${result.error.message}`); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}

prepare();
const implementation = require(compiledPath);
if (require.main === module) {
  try { implementation.main(process.argv.slice(2)); }
  catch (error) { console.error(`[dev] failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; }
}
module.exports = implementation;
