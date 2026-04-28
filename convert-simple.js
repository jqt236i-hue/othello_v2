const fs = require('fs');
const path = require('path');

const filesToConvert = [
  { path: 'data/dialogue/fixed-commentary-data.js', type: 'umd_return' },
  { path: 'game/visual-effects-map.js', type: 'iife' },
  { path: 'game/pass-handler.js', type: 'iife' },
  { path: 'game/network-turn-handoff.js', type: 'umd_return' },
  { path: 'game/move-executor.js', type: 'iife' },
  { path: 'cards/card-interaction-effects.js', type: 'umd_return' },
  { path: 'game/special-effects/hyperactive.js', type: 'none' },
  { path: 'game/move-generator.js', type: 'none' },
  { path: 'game/schema/action_manager.js', type: 'umd_return' },
  { path: 'game/special-effects/dragons.js', type: 'none' },
  { path: 'utils/owner-helpers.js', type: 'iife_root' },
  { path: 'game/turn-handlers/pending-target-selector.js', type: 'none' },
  { path: 'game/cpu-decision-board-utils.js', type: 'umd_return' },
  { path: 'game/debug/debug-actions.js', type: 'umd_return' }
];

function getTypeImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  return '../'.repeat(depth) + 'src/types';
}

function getWrapperRequirePath(filePath) {
  const parts = filePath.split('/');
  const depth = parts.length - 1;
  const prefix = '../'.repeat(depth);
  const baseName = path.basename(filePath, '.js');
  const dirName = path.dirname(filePath);
  return prefix + 'dist/' + dirName + '/' + baseName;
}

function extractIIFEBody(content) {
  // Remove "(function () {" from start
  let body = content;
  if (body.startsWith('(function () {\n')) {
    body = body.substring('(function () {\n'.length);
  } else if (body.startsWith('(function() {\n')) {
    body = body.substring('(function() {\n'.length);
  } else if (body.startsWith('(function () {')) {
    body = body.substring('(function () {'.length);
  } else if (body.startsWith('(function() {')) {
    body = body.substring('(function() {'.length);
  }
  
  // Remove "})();" from end
  body = body.trimEnd();
  if (body.endsWith('})();')) {
    body = body.substring(0, body.length - 5);
  } else if (body.endsWith('})()')) {
    body = body.substring(0, body.length - 4);
  } else if (body.endsWith('})();\n')) {
    body = body.substring(0, body.length - 6);
  }
  
  return body;
}

function extractIIFERootBody(content) {
  // (function(root) { ... })(typeof self !== 'undefined' ? self : this);
  let body = content;
  const startPatterns = ['(function(root) {\n', '(function (root) {\n', '(function(root) {', '(function (root) {'];
  for (const pattern of startPatterns) {
    if (body.startsWith(pattern)) {
      body = body.substring(pattern.length);
      break;
    }
  }
  
  // Remove closing })(...);
  body = body.trimEnd();
  const endPatterns = ['})(typeof self !== \'undefined\' ? self : this);', '})(typeof self !== "undefined" ? self : this);'];
  for (const pattern of endPatterns) {
    if (body.endsWith(pattern)) {
      body = body.substring(0, body.length - pattern.length);
      break;
    }
  }
  
  return body;
}

function extractUMDBody(content) {
  // UMD: (function (root, factory) { ... }(..., function() { BODY return {...}; }))
  // Find the inner "function() {" and extract until the matching "}" before "})"
  
  // Find last occurrence of "function() {" or "function (...) {"
  let lastFuncIdx = -1;
  let searchPos = 0;
  while (true) {
    const idx = content.indexOf('function', searchPos);
    if (idx === -1) break;
    const braceIdx = content.indexOf('{', idx);
    if (braceIdx === -1) break;
    lastFuncIdx = idx;
    searchPos = braceIdx + 1;
  }
  
  if (lastFuncIdx === -1) return { body: content };
  
  const openBrace = content.indexOf('{', lastFuncIdx);
  if (openBrace === -1) return { body: content };
  
  // Count braces to find matching close
  let braceCount = 1;
  let closeBrace = -1;
  for (let i = openBrace + 1; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  
  if (closeBrace === -1) return { body: content };
  
  let body = content.substring(openBrace + 1, closeBrace);
  
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract return statement
  const returnMatch = body.match(/return\s+(\{[\s\S]*?\})\s*;?\s*$/);
  if (returnMatch) {
    body = body.substring(0, returnMatch.index).trimEnd();
    return { body, exportObj: returnMatch[1] };
  }
  
  return { body };
}

function processNoneBody(content) {
  let body = content;
  
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract module.exports
  let exportObj = null;
  let exportName = null;
  
  const exportsObjMatch = body.match(/module\.exports\s*=\s*(\{[\s\S]*?\n\})\s*;?/);
  if (exportsObjMatch) {
    exportObj = exportsObjMatch[1];
    body = body.replace(exportsObjMatch[0], '');
  }
  
  const exportsNameMatch = body.match(/module\.exports\s*=\s*(\w+)\s*;?/);
  if (exportsNameMatch) {
    exportName = exportsNameMatch[1];
    body = body.replace(exportsNameMatch[0], '');
  }
  
  // Remove conditional exports
  body = body.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  return { body: body.trimEnd(), exportObj, exportName };
}

function cleanupBody(body) {
  // Remove globalThis assignments
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up extra whitespace
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  return body;
}

filesToConvert.forEach(fileInfo => {
  const jsPath = fileInfo.path;
  const tsPath = jsPath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath}`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  
  let body, exportObj, exportName;
  
  if (fileInfo.type === 'iife') {
    body = extractIIFEBody(content);
    const processed = processNoneBody(body);
    body = processed.body;
    exportObj = processed.exportObj;
    exportName = processed.exportName;
  } else if (fileInfo.type === 'iife_root') {
    body = extractIIFERootBody(content);
    const processed = processNoneBody(body);
    body = processed.body;
    exportObj = processed.exportObj;
    exportName = processed.exportName;
  } else if (fileInfo.type === 'umd_return') {
    const result = extractUMDBody(content);
    body = result.body;
    exportObj = result.exportObj;
  } else {
    const result = processNoneBody(content);
    body = result.body;
    exportObj = result.exportObj;
    exportName = result.exportName;
  }
  
  body = cleanupBody(body);
  
  // Determine final export
  let finalExport;
  if (exportObj) {
    finalExport = `export = ${exportObj};`;
  } else if (exportName) {
    finalExport = `export = ${exportName};`;
  } else {
    const baseName = path.basename(jsPath, '.js').replace(/-/g, '_');
    finalExport = `export = ${baseName};`;
  }
  
  // Build TS content
  const typeImportPath = getTypeImportPath(jsPath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  tsContent += body + '\n\n';
  tsContent += finalExport + '\n';
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Created ${tsPath}`);
  
  // Write wrapper
  const wrapperPath = getWrapperRequirePath(jsPath);
  const wrapperContent = `"use strict";\n/** @type {any} */\nmodule.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Updated ${jsPath}`);
});

console.log('Conversion complete!');
