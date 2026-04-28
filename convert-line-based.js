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

function findIIFERange(lines) {
  let startLine = -1;
  let startCol = -1;
  
  // Find the line with "(function() {" or "(function () {"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idx = line.indexOf('(function()');
    if (idx !== -1) {
      const braceIdx = line.indexOf('{', idx);
      if (braceIdx !== -1) {
        startLine = i;
        startCol = braceIdx;
        break;
      }
    }
    const idx2 = line.indexOf('(function ()');
    if (idx2 !== -1) {
      const braceIdx = line.indexOf('{', idx2);
      if (braceIdx !== -1) {
        startLine = i;
        startCol = braceIdx;
        break;
      }
    }
  }
  
  if (startLine === -1) return null;
  
  // Count braces from startLine/startCol
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
  
  if (endLine === -1) return null;
  
  return { startLine, startCol, endLine, endCol };
}

function extractIIFE(lines) {
  const range = findIIFERange(lines);
  if (!range) return null;
  
  let bodyLines = [];
  for (let i = range.startLine; i <= range.endLine; i++) {
    let line = lines[i];
    if (i === range.startLine) {
      line = line.substring(range.startCol + 1);
    } else if (i === range.endLine) {
      line = line.substring(0, range.endCol);
    }
    bodyLines.push(line);
  }
  
  return bodyLines;
}

function findUMDFactoryRange(lines) {
  // UMD: find the last "function() {" which is the factory function
  let startLine = -1;
  let startCol = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that are part of the outer UMD wrapper
    if (line.includes('module.exports = factory(') || line.includes('root.')) {
      continue;
    }
    
    const idx = line.indexOf('function');
    if (idx !== -1) {
      const braceIdx = line.indexOf('{', idx);
      if (braceIdx !== -1) {
        startLine = i;
        startCol = braceIdx;
      }
    }
  }
  
  if (startLine === -1) return null;
  
  // Count braces
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
  
  if (endLine === -1) return null;
  
  return { startLine, startCol, endLine, endCol };
}

function extractUMD(lines) {
  const range = findUMDFactoryRange(lines);
  if (!range) return null;
  
  let bodyLines = [];
  for (let i = range.startLine; i <= range.endLine; i++) {
    let line = lines[i];
    if (i === range.startLine) {
      line = line.substring(range.startCol + 1);
    } else if (i === range.endLine) {
      line = line.substring(0, range.endCol);
    }
    bodyLines.push(line);
  }
  
  return bodyLines;
}

function processBodyLines(bodyLines) {
  let body = bodyLines.join('\n');
  
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
    console.log(`Skipping ${jsPath} - not found`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  const lines = content.split('\n');
  
  // Try IIFE extraction first
  let bodyLines = extractIIFE(lines);
  let type = 'iife';
  
  // If no IIFE found, try UMD
  if (!bodyLines) {
    bodyLines = extractUMD(lines);
    type = 'umd';
  }
  
  // If still not found, use entire content
  if (!bodyLines) {
    bodyLines = lines;
    type = 'none';
  }
  
  const { body, exportObj, exportName } = processBodyLines(bodyLines);
  
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
  console.log(`Created ${tsPath} (${type})`);
  
  // Write wrapper
  const wrapperPath = getWrapperRequirePath(jsPath);
  const wrapperContent = `"use strict";\n/** @type {any} */\nmodule.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);
  console.log(`Updated ${jsPath}`);
});

console.log('Conversion complete!');
