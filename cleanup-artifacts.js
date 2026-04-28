const fs = require('fs');

const filesToClean = [
  'game/pass-handler.ts',
  'game/visual-effects-map.ts',
  'game/network-turn-handoff.ts',
  'game/move-executor.ts',
  'utils/owner-helpers.ts'
];

filesToClean.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove remaining try/catch globalThis blocks more aggressively
  // Match the pattern: try { if (typeof globalThis !== 'undefined') { ... } } catch (e) { ... }
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\(e\)\s*\{[\s\S]*?\}/g, '');
  
  // Remove standalone catch blocks at the end
  content = content.replace(/catch\s*\(e\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}\s*\n/g, '');
  content = content.replace(/catch\s*\(e\)\s*\{\s*\}\s*\n/g, '');
  
  // Fix extra closing braces before export
  content = content.replace(/\n\}\s*\n\nexport\s*=/g, '\n\nexport =');
  content = content.replace(/\n\}\s*;?\s*\nexport\s*=/g, '\n\nexport =');
  content = content.replace(/\n\}\s*\n\}\s*\nexport\s*=/g, '\n\nexport =');
  
  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n');
  
  fs.writeFileSync(filePath, content);
  console.log(`Cleaned ${filePath}`);
});

console.log('Cleanup complete!');
