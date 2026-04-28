const fs = require('fs');
const path = require('path');

const filesToConvert = [
  'data/dialogue/fixed-commentary-data.js',
  'game/visual-effects-map.js',
  'game/pass-handler.js',
  'game/network-turn-handoff.js',
  'game/move-executor.js',
  'cards/card-interaction-effects.js',
  'game/special-effects/hyperactive.js',
  'game/move-generator.js',
  'game/schema/action_manager.js',
  'game/special-effects/dragons.js',
  'utils/owner-helpers.js',
  'game/turn-handlers/pending-target-selector.js',
  'game/cpu-decision-board-utils.js',
  'game/debug/debug-actions.js'
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

function extractBody(content) {
  let body = content;
  let hadWrapper = false;
  
  // Pattern 1: UMD with return statement
  // (function (root, factory) { ... }(..., function(...) { ... return {...}; }))
  const umdReturnRegex = /^\s*\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?\}\s*\)\s*\([\s\S]*?function\s*\([^)]*\)\s*\{\s*(['"]use strict['"];?\s*)?([\s\S]*?)return\s+(\{[\s\S]*?\})\s*;?\s*\}\s*\)\s*;?\s*$/;
  const umdReturnMatch = content.match(umdReturnRegex);
  if (umdReturnMatch) {
    body = umdReturnMatch[2].trim();
    hadWrapper = true;
    // We'll add the export later based on the returned object
    return { body, exportObj: umdReturnMatch[3].trim(), hadWrapper };
  }
  
  // Pattern 2: UMD with module.exports inside factory
  const umdExportsRegex = /^\s*\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?\}\s*\)\s*\([\s\S]*?function\s*\([^)]*\)\s*\{\s*(['"]use strict['"];?\s*)?([\s\S]*)\}\s*\)\s*;?\s*$/;
  const umdExportsMatch = content.match(umdExportsRegex);
  if (umdExportsMatch) {
    body = umdExportsMatch[2].trim();
    hadWrapper = true;
  }
  
  // Pattern 3: IIFE (function() { ... })()
  if (!hadWrapper) {
    const iifeRegex = /^\s*\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/;
    const iifeMatch = content.match(iifeRegex);
    if (iifeMatch) {
      body = iifeMatch[1].trim();
      hadWrapper = true;
    }
  }
  
  // Pattern 4: IIFE with root (function(root) { ... })(...)
  if (!hadWrapper) {
    const iifeRootRegex = /^\s*\(function\s*\(\s*root\s*\)\s*\{([\s\S]*)\}\s*\)\s*\([\s\S]*?\)\s*;?\s*$/;
    const iifeRootMatch = content.match(iifeRootRegex);
    if (iifeRootMatch) {
      body = iifeRootMatch[1].trim();
      hadWrapper = true;
    }
  }
  
  return { body, exportObj: null, hadWrapper };
}

function processBody(body) {
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract export object from module.exports = { ... }
  let exportObj = null;
  let exportName = null;
  
  const exportsObjPattern = /module\.exports\s*=\s*(\{[\s\S]*?\n\})\s*;?/;
  const exportsObjMatch = body.match(exportsObjPattern);
  if (exportsObjMatch) {
    exportObj = exportsObjMatch[1];
    body = body.replace(exportsObjPattern, '');
  }
  
  // Extract export name from module.exports = Name;
  const exportsNamePattern = /module\.exports\s*=\s*(\w+)\s*;?/;
  const exportsNameMatch = body.match(exportsNamePattern);
  if (exportsNameMatch) {
    exportName = exportsNameMatch[1];
    body = body.replace(exportsNamePattern, '');
  }
  
  // Remove conditional module.exports blocks
  const conditionalExportsPattern = /if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g;
  body = body.replace(conditionalExportsPattern, '');
  
  // Remove globalThis assignments
  const globalThisPattern = /try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g;
  body = body.replace(globalThisPattern, '');
  
  // Remove window assignments
  const windowPattern = /try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g;
  body = body.replace(windowPattern, '');
  
  // Clean up
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  return { body, exportObj, exportName };
}

filesToConvert.forEach(filePath => {
  const jsPath = filePath;
  const tsPath = filePath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath} - not found`);
    return;
  }
  
  const originalContent = fs.readFileSync(jsPath, 'utf8');
  
  // Extract body from wrapper
  const { body: rawBody, exportObj: extractedExportObj, hadWrapper } = extractBody(originalContent);
  
  // Process body (remove exports, use strict, etc.)
  const { body, exportObj, exportName } = processBody(rawBody);
  
  // Determine final export
  let finalExport = '';
  if (extractedExportObj) {
    finalExport = `export = ${extractedExportObj};`;
  } else if (exportObj) {
    finalExport = `export = ${exportObj};`;
  } else if (exportName) {
    finalExport = `export = ${exportName};`;
  } else {
    // For files without clear exports, export the last defined variable/object
    const baseName = path.basename(filePath, '.js').replace(/-/g, '_');
    finalExport = `export = ${baseName};`;
  }
  
  // Build TS content
  const typeImportPath = getTypeImportPath(filePath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  tsContent += body + '\n\n';
  tsContent += finalExport + '\n';
  
  // Write TS file
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Created ${tsPath}`);
  
  // Create wrapper JS
  const wrapperPath = getWrapperRequirePath(filePath);
  const wrapperContent = `"use strict";\n/** @type {any} */\nmodule.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Updated ${jsPath}`);
});

console.log('Conversion complete!');
