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

function findMatchingBrace(content, startIndex) {
  let braceCount = 0;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    else if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0) return i;
    }
  }
  return -1;
}

function extractBody(content) {
  const trimmed = content.trim();
  
  // Check for IIFE: (function() { ... })() or (function () { ... })()
  if (trimmed.startsWith('(function()') || trimmed.startsWith('(function ()')) {
    const openBrace = trimmed.indexOf('{');
    if (openBrace !== -1) {
      // Find matching brace for the IIFE
      let braceCount = 1;
      let closeBrace = -1;
      for (let i = openBrace + 1; i < trimmed.length; i++) {
        if (trimmed[i] === '{') braceCount++;
        else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            closeBrace = i;
            break;
          }
        }
      }
      if (closeBrace !== -1) {
        return trimmed.substring(openBrace + 1, closeBrace);
      }
    }
  }
  
  // Check for IIFE with root: (function(root) { ... })(...)
  if (trimmed.startsWith('(function(root)') || trimmed.startsWith('(function (root)')) {
    const openBrace = trimmed.indexOf('{');
    if (openBrace !== -1) {
      let braceCount = 1;
      let closeBrace = -1;
      for (let i = openBrace + 1; i < trimmed.length; i++) {
        if (trimmed[i] === '{') braceCount++;
        else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            closeBrace = i;
            break;
          }
        }
      }
      if (closeBrace !== -1) {
        return trimmed.substring(openBrace + 1, closeBrace);
      }
    }
  }
  
  // Check for UMD: (function (root, factory) { ... }(..., function(...) { ... return {...} }))
  if (trimmed.startsWith('(function (root, factory)') || trimmed.startsWith('(function(root, factory)')) {
    // Find the inner factory function - it's the last "function(...) {" before the content
    let lastFuncIndex = -1;
    let searchPos = 0;
    while (true) {
      const funcIdx = trimmed.indexOf('function', searchPos);
      if (funcIdx === -1) break;
      const openBrace = trimmed.indexOf('{', funcIdx);
      if (openBrace === -1) break;
      lastFuncIndex = funcIdx;
      searchPos = openBrace + 1;
    }
    
    if (lastFuncIndex !== -1) {
      const openBrace = trimmed.indexOf('{', lastFuncIndex);
      if (openBrace !== -1) {
        const closeBrace = findMatchingBrace(trimmed, openBrace);
        if (closeBrace !== -1) {
          return trimmed.substring(openBrace + 1, closeBrace);
        }
      }
    }
  }
  
  // No wrapper found
  return trimmed;
}

function processBody(body) {
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract module.exports object
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
  
  // Remove conditional module.exports blocks
  body = body.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  // Remove globalThis assignments
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up extra whitespace
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  return { body, exportObj, exportName };
}

filesToConvert.forEach(filePath => {
  const jsPath = filePath;
  const tsPath = jsPath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath}`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  
  // Extract body from wrapper
  const rawBody = extractBody(content);
  
  // Process body
  const { body, exportObj, exportName } = processBody(rawBody);
  
  // Determine export
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
