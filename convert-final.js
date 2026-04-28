const fs = require('fs');
const path = require('path');

const filesToConvert = [
  { path: 'data/dialogue/fixed-commentary-data.js', type: 'umd' },
  { path: 'game/visual-effects-map.js', type: 'iife' },
  { path: 'game/pass-handler.js', type: 'iife' },
  { path: 'game/network-turn-handoff.js', type: 'umd' },
  { path: 'game/move-executor.js', type: 'iife' },
  { path: 'cards/card-interaction-effects.js', type: 'umd' },
  { path: 'game/special-effects/hyperactive.js', type: 'none' },
  { path: 'game/move-generator.js', type: 'none' },
  { path: 'game/schema/action_manager.js', type: 'umd' },
  { path: 'game/special-effects/dragons.js', type: 'none' },
  { path: 'utils/owner-helpers.js', type: 'iife_root' },
  { path: 'game/turn-handlers/pending-target-selector.js', type: 'none' },
  { path: 'game/cpu-decision-board-utils.js', type: 'umd' },
  { path: 'game/debug/debug-actions.js', type: 'umd' }
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

function extractUMDBody(content) {
  // UMD pattern: (function (root, factory) { ... }(..., function(...) { BODY return {...}; }))
  // We need to find the factory function and extract its body
  
  // Find "function(...) {" that comes after the module.exports check
  const lines = content.split('\n');
  let factoryStartLine = -1;
  let factoryStartCol = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('module.exports = factory(') || lines[i].includes('module.exports = factory')) {
      // Found the module.exports line, now find the next "function(...) {"
      for (let j = i + 1; j < lines.length; j++) {
        const match = lines[j].match(/function\s*\([^)]*\)\s*\{/);
        if (match) {
          factoryStartLine = j;
          factoryStartCol = lines[j].indexOf('{', match.index);
          break;
        }
      }
      break;
    }
  }
  
  if (factoryStartLine === -1) {
    // Try alternative: find the last "function(...) {" before the content
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/function\s*\([^)]*\)\s*\{/);
      if (match) {
        factoryStartLine = i;
        factoryStartCol = lines[i].indexOf('{', match.index);
      }
    }
  }
  
  if (factoryStartLine === -1) return content;
  
  // Count braces from factoryStartLine/factoryStartCol to find matching }
  let braceCount = 0;
  let endLine = -1;
  let endCol = -1;
  
  for (let i = factoryStartLine; i < lines.length; i++) {
    const line = lines[i];
    const startIdx = (i === factoryStartLine) ? factoryStartCol : 0;
    
    for (let j = startIdx; j < line.length; j++) {
      if (line[j] === '{') braceCount++;
      else if (line[j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endLine = i;
          endCol = j;
          break;
        }
      }
    }
    if (endLine !== -1) break;
  }
  
  // Extract body
  let bodyLines = [];
  for (let i = factoryStartLine; i <= endLine; i++) {
    let line = lines[i];
    if (i === factoryStartLine) line = line.substring(factoryStartCol + 1);
    else if (i === endLine) line = line.substring(0, endCol);
    bodyLines.push(line);
  }
  
  return bodyLines.join('\n');
}

function extractIIFEBody(content) {
  // IIFE pattern: (function() { BODY })();
  const match = content.match(/^\s*\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/);
  if (match) return match[1];
  
  // IIFE with root: (function(root) { BODY })(...);
  const rootMatch = content.match(/^\s*\(function\s*\(\s*root\s*\)\s*\{([\s\S]*)\}\s*\)\s*\([\s\S]*?\)\s*;?\s*$/);
  if (rootMatch) return rootMatch[1];
  
  return content;
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
  
  // Remove conditional module.exports
  body = body.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  // Remove globalThis/window assignments
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up extra whitespace
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  return { body, exportObj, exportName };
}

filesToConvert.forEach(fileInfo => {
  const jsPath = fileInfo.path;
  const tsPath = jsPath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath}`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  
  let rawBody;
  if (fileInfo.type === 'umd') {
    rawBody = extractUMDBody(content);
  } else if (fileInfo.type === 'iife' || fileInfo.type === 'iife_root') {
    rawBody = extractIIFEBody(content);
  } else {
    rawBody = content;
  }
  
  const { body, exportObj, exportName } = processBody(rawBody);
  
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
