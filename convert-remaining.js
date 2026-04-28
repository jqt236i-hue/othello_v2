const fs = require('fs');
const path = require('path');

// Files that need TS created from JS (no existing .ts)
const filesNeedTsCreated = [
  'game/ai/policy-table-runtime.js',
  'game/turn/turn_pipeline_phase_helpers.js',
  'game/cards/effect-resolver.js'
];

// Files that need @ts-nocheck added to existing .ts
const filesNeedNocheck = [
  'ui.js',
  'ui/network/snapshot.js',
  'ui/status-display.js',
  'ui/tutorial/tutorial-steps.js',
  'sound-engine.js',
  'ui/handlers/debug.js',
  'ui/handlers/rules-help.js',
  'ui/presentation-handler.js',
  'ui/tutorial/tutorial-controller.js',
  'ui/move-executor-visuals.js',
  'ui/story/story-controller.js'
];

// Files that need .js converted to wrapper (but already have .ts with @ts-nocheck)
const filesNeedWrapper = [
  'src/engine/selfplay-runner.js',
  'ui/animation-engine.js',
  'ui/handlers/match-mode.js',
  'scripts/generate-selfplay-data.js',
  'ui/result-overlay.js',
  'scripts/benchmark-policy-adoption.js',
  'ui/story/story-steps.js',
  'ui/board-renderer.js',
  'game/ai/policy-onnx-runtime.js',
  'ui/bootstrap.js',
  'ui/deck-builder-controller.js',
  'scripts/benchmark-selfplay-policy.js',
  'scripts/load-training-profile.js',
  'scripts/benchmark-policy-onnx-gate.js',
  'scripts/monitor-selfplay-training-run.js',
  'ui/handlers/cpu-policy.js',
  'ui/playback-state-manager.js'
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
  let body = content;
  const startPatterns = ['(function () {\n', '(function() {\n', '(function () {', '(function() {'];
  for (const pattern of startPatterns) {
    if (body.startsWith(pattern)) {
      body = body.substring(pattern.length);
      break;
    }
  }
  
  body = body.trimEnd();
  const endPatterns = ['})();', '})()'];
  for (const pattern of endPatterns) {
    if (body.endsWith(pattern)) {
      body = body.substring(0, body.length - pattern.length);
      break;
    }
  }
  
  return body;
}

function extractIIFERootBody(content) {
  let body = content;
  const startPatterns = ['(function(root) {\n', '(function (root) {\n', '(function(root) {', '(function (root) {'];
  for (const pattern of startPatterns) {
    if (body.startsWith(pattern)) {
      body = body.substring(pattern.length);
      break;
    }
  }
  
  body = body.trimEnd();
  const endPatterns = ["})(typeof self !== 'undefined' ? self : this);", '})(typeof self !== "undefined" ? self : this);'];
  for (const pattern of endPatterns) {
    if (body.endsWith(pattern)) {
      body = body.substring(0, body.length - pattern.length);
      break;
    }
  }
  
  return body;
}

function extractUMDBody(content) {
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
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  const returnMatch = body.match(/return\s+(\{[\s\S]*?\})\s*;?\s*$/);
  if (returnMatch) {
    body = body.substring(0, returnMatch.index).trimEnd();
    return { body, exportObj: returnMatch[1] };
  }
  
  return { body };
}

function processNoneBody(content) {
  let body = content;
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
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
  
  body = body.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  return { body: body.trimEnd(), exportObj, exportName };
}

function cleanupBody(body) {
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  return body;
}

function detectWrapperType(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith('(function(root)') || trimmed.startsWith('(function (root)')) {
    return 'iife_root';
  }
  if (trimmed.startsWith('(function ()') || trimmed.startsWith('(function()')) {
    return 'iife';
  }
  if (trimmed.includes('(function (root, factory)') || trimmed.includes('(function(root, factory)')) {
    return 'umd';
  }
  return 'none';
}

function createTsFromJs(jsPath) {
  const content = fs.readFileSync(jsPath, 'utf8');
  const type = detectWrapperType(content);
  
  let body, exportObj, exportName;
  
  if (type === 'iife') {
    body = extractIIFEBody(content);
    const processed = processNoneBody(body);
    body = processed.body;
    exportObj = processed.exportObj;
    exportName = processed.exportName;
  } else if (type === 'iife_root') {
    body = extractIIFERootBody(content);
    const processed = processNoneBody(body);
    body = processed.body;
    exportObj = processed.exportObj;
    exportName = processed.exportName;
  } else if (type === 'umd') {
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
  
  let finalExport;
  if (exportObj) {
    finalExport = `export = ${exportObj};`;
  } else if (exportName) {
    finalExport = `export = ${exportName};`;
  } else {
    const baseName = path.basename(jsPath, '.js').replace(/-/g, '_');
    finalExport = `export = ${baseName};`;
  }
  
  const typeImportPath = getTypeImportPath(jsPath);
  let tsContent = `// @ts-nocheck\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  tsContent += body + '\n\n';
  tsContent += finalExport + '\n';
  
  const tsPath = jsPath.replace('.js', '.ts');
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Created ${tsPath}`);
}

function addNocheckToTs(tsPath) {
  const content = fs.readFileSync(tsPath, 'utf8');
  if (content.includes('@ts-nocheck')) {
    console.log(`Already has @ts-nocheck: ${tsPath}`);
    return;
  }
  
  const typeImportPath = getTypeImportPath(tsPath);
  const header = `// @ts-nocheck\ndeclare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n\nimport type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  
  fs.writeFileSync(tsPath, header + content);
  console.log(`Added @ts-nocheck to ${tsPath}`);
}

function convertToWrapper(jsPath) {
  const wrapperPath = getWrapperRequirePath(jsPath);
  const wrapperContent = `"use strict";\n/** @type {any} */\nmodule.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Converted to wrapper: ${jsPath}`);
}

// Process files that need TS created
console.log('=== Creating .ts files ===');
filesNeedTsCreated.forEach(jsPath => {
  if (fs.existsSync(jsPath)) {
    createTsFromJs(jsPath);
    convertToWrapper(jsPath);
  } else {
    console.log(`Missing: ${jsPath}`);
  }
});

// Process files that need @ts-nocheck added
console.log('\n=== Adding @ts-nocheck ===');
filesNeedNocheck.forEach(jsPath => {
  const tsPath = jsPath.replace('.js', '.ts');
  if (fs.existsSync(tsPath)) {
    addNocheckToTs(tsPath);
  } else {
    console.log(`Missing TS: ${tsPath}`);
  }
  if (fs.existsSync(jsPath)) {
    convertToWrapper(jsPath);
  }
});

// Process files that need wrapper conversion
console.log('\n=== Converting to wrappers ===');
filesNeedWrapper.forEach(jsPath => {
  if (fs.existsSync(jsPath)) {
    convertToWrapper(jsPath);
  } else {
    console.log(`Missing: ${jsPath}`);
  }
});

console.log('\nConversion complete!');
