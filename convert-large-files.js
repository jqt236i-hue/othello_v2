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

function extractAndConvert(content, filePath) {
  let body = content;
  let exportsObj = null;
  let exportsName = null;
  
  // Pattern 1: UMD with factory function returning object
  // (function (root, factory) { ... }(..., function(...) { ... return {...}; }))
  const umdWithReturnPattern = /\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?\}\s*\)\s*\([\s\S]*?,\s*function\s*\([^)]*\)\s*\{([\s\S]*?)return\s+(\{[\s\S]*?\})\s*;?\s*\}\s*\)\s*;?/;
  const umdWithReturnMatch = content.match(umdWithReturnPattern);
  if (umdWithReturnMatch) {
    body = umdWithReturnMatch[1].trim();
    exportsObj = umdWithReturnMatch[2].trim();
  }
  
  // Pattern 2: UMD with factory function that uses module.exports internally
  const umdWithExportsPattern = /\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?\}\s*\)\s*\([\s\S]*?,\s*function\s*\([^)]*\)\s*\{([\s\S]*)\}\s*\)\s*;?/;
  if (!exportsObj) {
    const umdWithExportsMatch = content.match(umdWithExportsPattern);
    if (umdWithExportsMatch) {
      body = umdWithExportsMatch[1].trim();
    }
  }
  
  // Pattern 3: IIFE (function() { ... })();
  const iifePattern = /^\s*\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/;
  const iifeMatch = content.match(iifePattern);
  if (iifeMatch && !umdWithReturnMatch && !umdWithExportsMatch) {
    body = iifeMatch[1].trim();
  }
  
  // Pattern 4: IIFE with root parameter (function(root) { ... })(...);
  const iifeRootPattern = /^\s*\(function\s*\(\s*root\s*\)\s*\{([\s\S]*)\}\s*\)\s*\([\s\S]*?\)\s*;?\s*$/;
  const iifeRootMatch = content.match(iifeRootPattern);
  if (iifeRootMatch && !iifeMatch && !umdWithReturnMatch && !umdWithExportsMatch) {
    body = iifeRootMatch[1].trim();
  }
  
  // If no wrapper matched, use content as-is (but remove module.exports)
  if (body === content) {
    body = content.trim();
  }
  
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Handle module.exports patterns
  // Pattern A: module.exports = { ... };
  const exportsObjPattern = /module\.exports\s*=\s*(\{[\s\S]*?\})\s*;?/;
  const exportsObjMatch = body.match(exportsObjPattern);
  if (exportsObjMatch) {
    exportsObj = exportsObjMatch[1];
    body = body.replace(exportsObjPattern, '');
  }
  
  // Pattern B: module.exports = SomeName;
  const exportsNamePattern = /module\.exports\s*=\s*(\w+)\s*;?/;
  const exportsNameMatch = body.match(exportsNamePattern);
  if (exportsNameMatch) {
    exportsName = exportsNameMatch[1];
    body = body.replace(exportsNamePattern, '');
  }
  
  // Pattern C: if (typeof module !== 'undefined' && module.exports) { module.exports = ... }
  const conditionalExportsPattern = /if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g;
  body = body.replace(conditionalExportsPattern, '');
  
  // Remove globalThis assignments at the end
  const globalThisPattern = /try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([\s\S]*?\)\s*\{[\s\S]*?\}/g;
  body = body.replace(globalThisPattern, '');
  
  // Remove window assignments
  const windowPattern = /try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([\s\S]*?\)\s*\{[\s\S]*?\}/g;
  body = body.replace(windowPattern, '');
  
  // Clean up trailing whitespace and extra newlines
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  // Build TypeScript content
  const typeImportPath = getTypeImportPath(filePath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  
  tsContent += body + '\n';
  
  // Add export
  if (exportsObj) {
    tsContent += `\nexport = ${exportsObj};\n`;
  } else if (exportsName) {
    tsContent += `\nexport = ${exportsName};\n`;
  } else {
    // Default export for files without explicit exports
    const baseName = path.basename(filePath, '.js').replace(/-/g, '_');
    tsContent += `\nexport = ${baseName};\n`;
  }
  
  return tsContent;
}

function createWrapper(filePath) {
  const requirePath = getWrapperRequirePath(filePath);
  return `"use strict";\n/** @type {any} */\nmodule.exports = require('${requirePath}');\n`;
}

filesToConvert.forEach(filePath => {
  const jsPath = filePath;
  const tsPath = filePath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath} - file not found`);
    return;
  }
  
  // Restore original from wrapper if needed
  let content;
  const wrapperPattern = /^"use strict";\n\/\*\* @type \{any\} \*\/\nmodule\.exports = require\(['"][^'"]+['"]\);/;
  const currentContent = fs.readFileSync(jsPath, 'utf8');
  
  if (wrapperPattern.test(currentContent)) {
    // Already converted, need to read from TS or skip
    if (fs.existsSync(tsPath)) {
      console.log(`${jsPath} already converted, regenerating from ${tsPath}`);
      content = fs.readFileSync(tsPath, 'utf8');
      // Remove TS header to get back to JS-like content
      const lines = content.split('\n');
      const bodyStart = lines.findIndex(l => l.startsWith('import type') || l.startsWith('declare const'));
      // Actually, better to restore from git
      console.log(`Skipping ${jsPath} - already converted`);
      return;
    }
  }
  
  content = currentContent;
  const tsContent = extractAndConvert(content, filePath);
  const wrapperContent = createWrapper(filePath);
  
  // Write TS file
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Created ${tsPath}`);
  
  // Replace JS with wrapper
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Updated ${jsPath} with wrapper`);
});

console.log('Conversion complete!');
