const fs = require('fs');
const path = require('path');

const filesToConvert = [
  { path: 'data/dialogue/fixed-commentary-data.js', wrapper: 'umd' },
  { path: 'game/visual-effects-map.js', wrapper: 'iife_with_comments' },
  { path: 'game/pass-handler.js', wrapper: 'iife' },
  { path: 'game/network-turn-handoff.js', wrapper: 'umd' },
  { path: 'game/move-executor.js', wrapper: 'iife' },
  { path: 'cards/card-interaction-effects.js', wrapper: 'umd' },
  { path: 'game/special-effects/hyperactive.js', wrapper: 'none' },
  { path: 'game/move-generator.js', wrapper: 'none' },
  { path: 'game/schema/action_manager.js', wrapper: 'umd' },
  { path: 'game/special-effects/dragons.js', wrapper: 'none' },
  { path: 'utils/owner-helpers.js', wrapper: 'iife_root' },
  { path: 'game/turn-handlers/pending-target-selector.js', wrapper: 'none' },
  { path: 'game/cpu-decision-board-utils.js', wrapper: 'umd' },
  { path: 'game/debug/debug-actions.js', wrapper: 'umd' }
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

function extractIIFE(content) {
  const lines = content.split('\n');
  
  // Find line with "(function() {" or "(function () {"
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('(function() {') || lines[i].includes('(function () {')) {
      startIdx = i;
      break;
    }
  }
  
  if (startIdx === -1) return null;
  
  // Find matching closing - look for "})();" at the end
  let endIdx = -1;
  for (let i = lines.length - 1; i >= startIdx; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '})();' || trimmed === '})(); // end IIFE') {
      endIdx = i;
      break;
    }
  }
  
  if (endIdx === -1) return null;
  
  // Extract body lines (between start and end)
  return lines.slice(startIdx + 1, endIdx);
}

function extractIIFERoot(content) {
  const lines = content.split('\n');
  
  // Find line with "(function(root) {" or "(function (root) {"
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('(function(root) {') || lines[i].includes('(function (root) {')) {
      startIdx = i;
      break;
    }
  }
  
  if (startIdx === -1) return null;
  
  // Find closing - look for "})(...);" at the end
  let endIdx = -1;
  for (let i = lines.length - 1; i >= startIdx; i--) {
    if (lines[i].trim().startsWith('})(') && lines[i].trim().endsWith(');')) {
      endIdx = i;
      break;
    }
  }
  
  if (endIdx === -1) return null;
  
  return lines.slice(startIdx + 1, endIdx);
}

function extractUMD(content) {
  const lines = content.split('\n');
  
  // Find the inner factory function - look for "function(...) {" after "module.exports = factory("
  let startIdx = -1;
  let foundFactory = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('module.exports = factory(') || lines[i].includes('module.exports = factory()')) {
      foundFactory = true;
    }
    if (foundFactory && /function\s*\([^)]*\)\s*\{/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  
  // If not found, try finding the last "function(...) {" in the file
  if (startIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (/function\s*\([^)]*\)\s*\{/.test(lines[i])) {
        startIdx = i;
      }
    }
  }
  
  if (startIdx === -1) return null;
  
  // Find the position of the opening brace on the start line
  const funcMatch = lines[startIdx].match(/function\s*\([^)]*\)\s*\{/);
  const bracePos = lines[startIdx].indexOf('{', funcMatch.index);
  
  // Count braces starting from AFTER this brace
  let braceCount = 1; // The opening brace is already counted
  let endIdx = -1;
  
  for (let i = startIdx; i < lines.length; i++) {
    const startJ = (i === startIdx) ? bracePos + 1 : 0;
    for (let j = startJ; j < lines[i].length; j++) {
      if (lines[i][j] === '{') {
        braceCount++;
      } else if (lines[i][j] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) break;
  }
  
  if (endIdx === -1) return null;
  
  // Extract lines between the braces
  let bodyLines = [];
  for (let i = startIdx; i <= endIdx; i++) {
    let line = lines[i];
    if (i === startIdx) {
      const bracePos = line.indexOf('{');
      line = line.substring(bracePos + 1);
    } else if (i === endIdx) {
      const lastBrace = line.lastIndexOf('}');
      line = line.substring(0, lastBrace);
    }
    bodyLines.push(line);
  }
  
  return bodyLines;
}

function processBody(bodyLines) {
  let body = bodyLines.join('\n');
  
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Extract return statement
  let exportObj = null;
  const returnMatch = body.match(/return\s+(\{[\s\S]*?\n\})\s*;?\s*$/);
  if (returnMatch) {
    exportObj = returnMatch[1];
    body = body.substring(0, returnMatch.index).trimEnd();
  }
  
  // Extract module.exports
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
  
  // Remove globalThis assignments
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  return { body, exportObj, exportName };
}

filesToConvert.forEach(fileInfo => {
  const jsPath = fileInfo.path;
  const tsPath = jsPath.replace(/\.js$/, '.ts');
  
  if (!fs.existsSync(jsPath)) {
    console.log(`Skipping ${jsPath} - not found`);
    return;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  
  let bodyLines;
  if (fileInfo.wrapper === 'iife') {
    bodyLines = extractIIFE(content);
  } else if (fileInfo.wrapper === 'iife_with_comments') {
    bodyLines = extractIIFE(content);
  } else if (fileInfo.wrapper === 'iife_root') {
    bodyLines = extractIIFERoot(content);
  } else if (fileInfo.wrapper === 'umd') {
    bodyLines = extractUMD(content);
  } else {
    bodyLines = content.split('\n');
  }
  
  if (!bodyLines) {
    console.log(`Failed to extract ${jsPath}`);
    return;
  }
  
  const { body, exportObj, exportName } = processBody(bodyLines);
  
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
