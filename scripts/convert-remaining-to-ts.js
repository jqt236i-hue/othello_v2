const fs = require('fs');
const path = require('path');

// Files to convert
const files = [
  { js: 'game/card-effects/selection-flow.js', ts: 'game/card-effects/selection-flow.ts', typesPath: '../../src/types' },
  { js: 'game/ai/policy-onnx-runtime.js', ts: 'game/ai/policy-onnx-runtime.ts', typesPath: '../../src/types' },
  { js: 'game/cards/target-resolver.js', ts: 'game/cards/target-resolver.ts', typesPath: '../../src/types' },
  { js: 'game/game/cards/target-resolver.js', ts: 'game/game/cards/target-resolver.ts', typesPath: '../../../src/types' },
  { js: 'game/turn-manager.js', ts: 'game/turn-manager.ts', typesPath: '../src/types' },
  { js: 'game/ai/fixed-commentary-engine.js', ts: 'game/ai/fixed-commentary-engine.ts', typesPath: '../../src/types' },
  { js: 'cards/catalog.js', ts: 'cards/catalog.ts', typesPath: '../src/types' },
];

for (const { js, ts, typesPath } of files) {
  const jsPath = path.join(process.cwd(), js);
  const tsPath = path.join(process.cwd(), ts);
  
  if (!fs.existsSync(jsPath)) {
    console.log(`SKIP: ${js} does not exist`);
    continue;
  }
  
  if (fs.existsSync(tsPath)) {
    console.log(`SKIP: ${ts} already exists`);
    continue;
  }
  
  let content = fs.readFileSync(jsPath, 'utf8');
  
  // Add @ts-nocheck at top for files > 500 lines
  const lines = content.split('\n');
  const header = `// @ts-nocheck\nimport type { CardState, GameState, PlayerKey } from '${typesPath}';\n\ndeclare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n\n`;
  
  // Check if file has UMD wrapper
  if (content.trim().startsWith('(function (root, factory)')) {
    // Extract the factory function body
    const match = content.match(/\(function \(root, factory\) \{[\s\S]*?\}\(typeof self[^,]+, function \(([^)]*)\) \{\n?\s*['"]use strict['"];?\n?([\s\S]*)\}\)\);?$/);
    if (match) {
      const deps = match[1].split(',').map(d => d.trim()).filter(d => d);
      const body = match[2];
      
      // Create imports for dependencies
      let imports = '';
      if (deps.length > 0) {
        // For target-resolver.js with specific deps
        if (js.includes('target-resolver') && !js.includes('game/game')) {
          imports = `const SharedConstants = _require('../../shared-constants');\nconst SharedBoardUtils = _require('../../shared/shared-board-utils');\nconst CardMarkers = _require('../logic/cards/markers');\nconst CardSelectors = _require('../logic/cards/selectors');\nconst CardTargets = _require('../logic/cards/targets');\n\n`;
        } else if (js.includes('game/game/cards/target-resolver')) {
          imports = `const SharedConstants = _require('../../shared-constants');\nconst BoardUtils = _require('../../shared/shared-board-utils');\nconst Markers = _require('../logic/cards/markers');\nconst Selectors = _require('../logic/cards/selectors');\nconst Targets = _require('../logic/cards/targets');\n\n`;
        } else if (js.includes('fixed-commentary-engine')) {
          imports = `const Data = _require('../../data/dialogue/fixed-commentary-data');\nconst CommentaryContextHelpers = _require('../../shared/commentary-context-helpers');\nconst CommentaryRuntimeHelpers = _require('../../shared/commentary-runtime-helpers');\nconst OwnerHelpersModule = _require('../../utils/owner-helpers');\n\n`;
        }
      }
      
      content = header + imports + body;
    }
  } else if (content.trim().startsWith('(() =>')) {
    // IIFE pattern
    const match = content.match(/\(\(\) => \{\n?\s*['"]use strict['"];?\n?([\s\S]*)\}\)\(\);?$/);
    if (match) {
      content = header + match[1];
    }
  } else {
    // Regular file
    content = header + content;
  }
  
  // Replace module.exports with export =
  content = content.replace(/if \(typeof module !== 'undefined' && module\.exports\) \{\n?\s*module\.exports = ([^;]+);?\n?\s*\}/g, 'export = $1;');
  content = content.replace(/module\.exports = \{([\s\S]*?)\};?$/m, 'export = {\n$1\n};');
  
  fs.writeFileSync(tsPath, content);
  console.log(`CREATED: ${ts}`);
}

console.log('Done!');
