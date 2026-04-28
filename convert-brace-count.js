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

function extractBodyByBraces(content) {
  const lines = content.split('\n');
  
  // Find the first line with function() or function (...) {
  let startLine = -1;
  let startCol = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for pattern like "function() {" or "function (...) {"
    const funcMatch = line.match(/function\s*\([^)]*\)\s*\{/);
    if (funcMatch) {
      startLine = i;
      startCol = line.indexOf('{', funcMatch.index);
      break;
    }
  }
  
  if (startLine === -1) {
    // No wrapper found, return as-is
    return { body: content, hasWrapper: false };
  }
  
  // Count braces to find the matching closing brace
  let braceCount = 0;
  let endLine = -1;
  let endCol = -1;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const startIdx = (i === startLine) ? startCol : 0;
    
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
  
  if (endLine === -1) {
    return { body: content, hasWrapper: false };
  }
  
  // Extract body (between the braces)
  let bodyLines = [];
  for (let i = startLine; i <= endLine; i++) {
    let line = lines[i];
    if (i === startLine) {
      line = line.substring(startCol + 1);
    } else if (i === endLine) {
      line = line.substring(0, endCol);
    }
    bodyLines.push(line);
  }
  
  let body = bodyLines.join('\n');
  
  // Remove trailing wrapper calls like })(); or })(typeof self...);
  const remainingLines = lines.slice(endLine + 1);
  const remaining = remainingLines.join('\n').trim();
  
  return { body, remaining, hasWrapper: true };
}

function processFile(filePath) {
  const jsPath = filePath;
  const tsPath = filePath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath}`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  
  // Extract body
  const { body: rawBody, remaining, hasWrapper } = extractBodyByBraces(content);
  
  let body = rawBody;
  
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract and remove module.exports
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
  
  // Remove globalThis assignments
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  // Determine export
  let finalExport = '';
  if (exportObj) {
    finalExport = `export = ${exportObj};`;
  } else if (exportName) {
    finalExport = `export = ${exportName};`;
  } else {
    // Try to extract return statement from remaining
    const returnMatch = remaining ? remaining.match(/return\s+(\{[\s\S]*?\})\s*;?/) : null;
    if (returnMatch) {
      finalExport = `export = ${returnMatch[1]};`;
    } else {
      const baseName = path.basename(filePath, '.js').replace(/-/g, '_');
      finalExport = `export = ${baseName};`;
    }
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
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Created ${tsPath}`);
  
  // Write wrapper
  const wrapperPath = getWrapperRequirePath(filePath);
  const wrapperContent = `"use strict";\n/** @type {any} */\nmodule.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Updated ${jsPath}`);
}

filesToConvert.forEach(processFile);
console.log('Done!');
