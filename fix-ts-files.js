const fs = require('fs');
const path = require('path');

const filesToFix = [
  'data/dialogue/fixed-commentary-data.ts',
  'game/visual-effects-map.ts',
  'game/pass-handler.ts',
  'game/network-turn-handoff.ts',
  'game/move-executor.ts',
  'cards/card-interaction-effects.ts',
  'game/special-effects/hyperactive.ts',
  'game/move-generator.ts',
  'game/schema/action_manager.ts',
  'game/special-effects/dragons.ts',
  'utils/owner-helpers.ts',
  'game/turn-handlers/pending-target-selector.ts',
  'game/cpu-decision-board-utils.ts',
  'game/debug/debug-actions.ts'
];

function getTypeImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  return '../'.repeat(depth) + 'src/types';
}

function fixTypeScriptFile(tsPath) {
  if (!fs.existsSync(tsPath)) {
    console.log(`Skipping ${tsPath} - file not found`);
    return;
  }
  
  const content = fs.readFileSync(tsPath, 'utf8');
  
  // Remove the bad TS header we added
  let body = content;
  const headerEnd = body.indexOf('import type { CardState, GameState, PlayerKey }');
  if (headerEnd !== -1) {
    const importEnd = body.indexOf('\n\n', headerEnd);
    if (importEnd !== -1) {
      body = body.substring(importEnd + 2);
    }
  }
  
  // Now properly handle the body
  // Remove 'use strict'
  body = body.replace(/['"]use strict['"];?\n?/g, '');
  
  // Convert module.exports patterns
  // Pattern: module.exports = { ... };
  body = body.replace(/module\.exports\s*=\s*(\{[\s\S]*?\})\s*;?/g, (match, p1) => {
    // Keep the object, just replace module.exports with export
    return `export = ${p1};`;
  });
  
  // Pattern: module.exports = SomeName;
  body = body.replace(/module\.exports\s*=\s*(\w+)\s*;?/g, 'export = $1;');
  
  // Pattern: if (typeof module !== 'undefined' && module.exports) { ... }
  body = body.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  // Remove try/catch blocks that assign to globalThis
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  body = body.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up UMD wrapper remnants
  body = body.replace(/\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?export\s*=\s*factory;?\(\);?[\s\S]*?\}\s*\)\s*\([\s\S]*?\)\s*;?/g, '');
  body = body.replace(/root\.\w+\s*=\s*factory\(\);?/g, '');
  
  // Remove IIFE wrappers if present
  body = body.replace(/^\s*\(function\s*\(\s*\)\s*\{/g, '');
  body = body.replace(/\}\s*\)\s*\(\s*\)\s*;?\s*$/g, '');
  
  // Clean up empty lines
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  
  // Build proper TypeScript content
  const typeImportPath = getTypeImportPath(tsPath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  
  tsContent += body + '\n';
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Fixed ${tsPath}`);
}

filesToFix.forEach(fixTypeScriptFile);
console.log('Fix complete!');
