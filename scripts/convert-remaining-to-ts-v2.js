const fs = require('fs');
const path = require('path');

// Files to convert with their specific configurations
const files = [
  { 
    js: 'game/card-effects/selection-flow.js', 
    ts: 'game/card-effects/selection-flow.ts', 
    typesPath: '../../src/types',
    extractBody: (content) => {
      // Extract body from UMD wrapper: (function (root, factory) { ... }(globalThis, function (root) { BODY }));
      const match = content.match(/\(function \(root, factory\) \{[\s\S]*?\}\(typeof globalThis[^,]+, function \(root\) \{\n?\s*['"]use strict['"];?\n?([\s\S]*)\}\)\);?$/);
      return match ? match[1] : null;
    }
  },
  { 
    js: 'game/ai/policy-onnx-runtime.js', 
    ts: 'game/ai/policy-onnx-runtime.ts', 
    typesPath: '../../src/types',
    extractBody: (content) => {
      // Extract body from IIFE: (() => { 'use strict'; BODY })();
      const match = content.match(/\(\(\) =\> \{\n?\s*['"]use strict['"];?\n?([\s\S]*)\}\)\(\);?$/);
      return match ? match[1] : null;
    }
  },
  { 
    js: 'game/cards/target-resolver.js', 
    ts: 'game/cards/target-resolver.ts', 
    typesPath: '../../src/types',
    extractBody: (content) => {
      // Extract body from UMD with dependencies
      const match = content.match(/\(function \(root, factory\) \{[\s\S]*?\}\(typeof self[^,]+, function \([^)]+\) \{\n?\s*['"]use strict['"];?\n?([\s\S]*)\}\)\);?$/);
      return match ? match[1] : null;
    },
    addImports: `const SharedConstants = _require('../../shared-constants');\nconst SharedBoardUtils = _require('../../shared/shared-board-utils');\nconst CardMarkers = _require('../logic/cards/markers');\nconst CardSelectors = _require('../logic/cards/selectors');\nconst CardTargets = _require('../logic/cards/targets');\n\n`
  },
  { 
    js: 'game/game/cards/target-resolver.js', 
    ts: 'game/game/cards/target-resolver.ts', 
    typesPath: '../../../src/types',
    extractBody: (content) => {
      // This file has a custom _require function at top
      const match = content.match(/'use strict';\nfunction _require\(id\) \{[\s\S]*?\}\nconst SharedConstants[\s\S]*?\nconst \{ BLACK, WHITE, EMPTY, DIRECTIONS \} = SharedConstants \|\| \{\};\n([\s\S]*)$/);
      return match ? match[1] : null;
    },
    addImports: `const SharedConstants = _require('../../shared-constants');\nconst BoardUtils = _require('../../shared/shared-board-utils');\nconst Markers = _require('../logic/cards/markers');\nconst Selectors = _require('../logic/cards/selectors');\nconst Targets = _require('../logic/cards/targets');\nconst { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};\n\n`
  },
  { 
    js: 'game/turn-manager.js', 
    ts: 'game/turn-manager.ts', 
    typesPath: '../src/types',
    extractBody: (content) => {
      // This file is mostly plain with some require calls at top
      return content;
    }
  },
  { 
    js: 'game/ai/fixed-commentary-engine.js', 
    ts: 'game/ai/fixed-commentary-engine.ts', 
    typesPath: '../../src/types',
    extractBody: (content) => {
      const match = content.match(/\(function \(root, factory\) \{[\s\S]*?\}\(typeof self[^,]+, function \(\) \{\n?\s*let Data = null;[\s\S]*?\}\)\);?$/);
      return match ? match[0] : null;
    }
  },
  { 
    js: 'cards/catalog.js', 
    ts: 'cards/catalog.ts', 
    typesPath: '../src/types',
    extractBody: (content) => {
      return content;
    }
  },
];

for (const config of files) {
  const { js, ts, typesPath, extractBody, addImports } = config;
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
  
  const originalContent = fs.readFileSync(jsPath, 'utf8');
  
  let body = extractBody(originalContent);
  if (!body) {
    console.log(`WARNING: Could not extract body from ${js}, using full content`);
    body = originalContent;
  }
  
  // Build the TypeScript file
  const header = `// @ts-nocheck\nimport type { CardState, GameState, PlayerKey } from '${typesPath}';\n\ndeclare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n\n`;
  
  let tsContent = header;
  
  if (addImports) {
    tsContent += addImports;
  }
  
  tsContent += body;
  
  // Replace module.exports patterns with export =
  tsContent = tsContent.replace(/if \(typeof module !== 'undefined' \&\& module\.exports\) \{\n?\s*module\.exports = ([^;]+);?\n?\s*\}/g, 'export = $1;');
  tsContent = tsContent.replace(/module\.exports = \{([\s\S]*?)\};?$/m, 'export = {\n$1\n};');
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`CREATED: ${ts}`);
}

console.log('Done!');
