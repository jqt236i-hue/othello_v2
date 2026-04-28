const fs = require('fs');

const filesToClean = [
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

filesToClean.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove wrapper artifacts that might have been left behind
  
  // Remove lines that look like wrapper references
  content = content.replace(/\/\*\* @type \{any\} \*\/\n\(['"][^'"]+['"]\);\n?/g, '');
  
  // Remove remaining try/catch globalThis blocks
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Remove standalone catch blocks
  content = content.replace(/catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*\n/g, '');
  
  // Fix extra closing braces before export
  content = content.replace(/\n\}\s*;?\s*\n\nexport\s*=/g, '\n\nexport =');
  content = content.replace(/\n\}\s*\nexport\s*=/g, '\nexport =');
  
  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n');
  
  fs.writeFileSync(filePath, content);
  console.log(`Cleaned ${filePath}`);
});

console.log('Cleanup complete!');
