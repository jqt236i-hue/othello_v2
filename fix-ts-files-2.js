const fs = require('fs');

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

function fixFile(tsPath) {
  if (!fs.existsSync(tsPath)) {
    console.log(`Skipping ${tsPath}`);
    return;
  }
  
  let content = fs.readFileSync(tsPath, 'utf8');
  
  // Step 1: Remove everything before the actual body starts
  // Find where the real code begins (after any wrappers)
  
  // Handle UMD wrapper: remove the outer wrapper, keep the factory function body
  if (content.includes('(function (root, factory)')) {
    // Find the factory function parameters and opening brace
    const factoryStart = content.indexOf('function ()');
    if (factoryStart !== -1) {
      // Find the opening brace after 'function ()'
      let bracePos = content.indexOf('{', factoryStart);
      if (bracePos !== -1) {
        // Remove everything before this brace
        content = content.substring(bracePos + 1);
      }
    }
    
    // Remove the closing '});' at the end
    if (content.trim().endsWith('}));')) {
      content = content.trim().slice(0, -3);
    } else if (content.trim().endsWith('}')) {
      content = content.trim().slice(0, -1);
    }
  }
  
  // Handle IIFE wrapper
  if (content.includes('(function ()') || content.includes('(function()')) {
    const iifeStart = content.indexOf('(function');
    if (iifeStart !== -1) {
      let bracePos = content.indexOf('{', iifeStart);
      if (bracePos !== -1) {
        content = content.substring(bracePos + 1);
      }
    }
    // Remove trailing '})();'
    const trimmed = content.trim();
    if (trimmed.endsWith('})();')) {
      content = trimmed.slice(0, -5);
    } else if (trimmed.endsWith('})()')) {
      content = trimmed.slice(0, -4);
    }
  }
  
  // Handle IIFE with root: (function(root) { ... })(...)
  if (content.includes('(function (root)')) {
    const iifeStart = content.indexOf('(function (root)');
    if (iifeStart !== -1) {
      let bracePos = content.indexOf('{', iifeStart);
      if (bracePos !== -1) {
        content = content.substring(bracePos + 1);
      }
    }
    // Find and remove the closing pattern
    const rootClosePattern = /}\s*\)\s*\(\s*typeof\s+self[\s\S]*?\)\s*;?/;
    content = content.replace(rootClosePattern, '');
  }
  
  // Remove 'use strict'
  content = content.replace(/['"]use strict['"];?\n?/g, '');
  
  // Fix broken export = factory;();
  content = content.replace(/export\s*=\s*factory;\(\);?/g, '');
  content = content.replace(/root\.\w+\s*=\s*factory\(\);?/g, '');
  
  // Convert remaining module.exports
  content = content.replace(/module\.exports\s*=\s*(\{[\s\S]*?\n\})\s*;?/g, (match, p1) => {
    return `export = ${p1};`;
  });
  content = content.replace(/module\.exports\s*=\s*(\w+)\s*;?/g, 'export = $1;');
  
  // Remove conditional module.exports blocks
  content = content.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  // Remove globalThis/window assignment blocks
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up
  content = content.replace(/\n{3,}/g, '\n\n').trim();
  
  // Add proper TS header
  const typeImportPath = getTypeImportPath(tsPath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  
  tsContent += content + '\n';
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Fixed ${tsPath}`);
}

filesToFix.forEach(fixFile);
console.log('Done!');
