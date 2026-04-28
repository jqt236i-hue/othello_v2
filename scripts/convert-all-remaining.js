const fs = require('fs');
const path = require('path');

function convertFile(jsPath, tsPath, typesPath, extractFn) {
  console.log(`\nConverting ${jsPath}...`);
  
  if (!fs.existsSync(jsPath)) {
    console.log(`  SKIP: ${jsPath} does not exist`);
    return false;
  }
  
  if (fs.existsSync(tsPath)) {
    console.log(`  SKIP: ${tsPath} already exists`);
    return false;
  }
  
  const content = fs.readFileSync(jsPath, 'utf8');
  const body = extractFn(content);
  
  if (!body) {
    console.log(`  ERROR: Could not extract body from ${jsPath}`);
    return false;
  }
  
  const header = `// @ts-nocheck\nimport type { CardState, GameState, PlayerKey } from '${typesPath}';\n\ndeclare const __non_webpack_require__: NodeRequire | undefined;\n\nconst _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n  ? __non_webpack_require__\n  : require;\n\n`;
  
  fs.writeFileSync(tsPath, header + body);
  console.log(`  CREATED: ${tsPath} (${body.length} chars)`);
  return true;
}

// 1. selection-flow.js - UMD wrapper with root parameter
convertFile(
  'game/card-effects/selection-flow.js',
  'game/card-effects/selection-flow.ts',
  '../../src/types',
  (content) => {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (startIdx === -1 && lines[i].trim() === "'use strict';" && i > 10) {
        startIdx = i + 1;
      }
      if (lines[i].trim() === '};' && i > lines.length - 10) {
        endIdx = i;
      }
    }
    
    if (startIdx === -1 || endIdx === -1) return null;
    return lines.slice(startIdx, endIdx).join('\n');
  }
);

// 2. policy-onnx-runtime.js - IIFE
convertFile(
  'game/ai/policy-onnx-runtime.js',
  'game/ai/policy-onnx-runtime.ts',
  '../../src/types',
  (content) => {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (startIdx === -1 && lines[i].trim() === "'use strict';" && i > 0) {
        startIdx = i + 1;
      }
      if (lines[i].trim() === '})();' && i > lines.length - 10) {
        endIdx = i;
      }
    }
    
    if (startIdx === -1 || endIdx === -1) return null;
    return lines.slice(startIdx, endIdx).join('\n');
  }
);

// 3. game/cards/target-resolver.js - UMD with deps
convertFile(
  'game/cards/target-resolver.js',
  'game/cards/target-resolver.ts',
  '../../src/types',
  (content) => {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (startIdx === -1 && lines[i].trim() === "'use strict';" && i > 20) {
        startIdx = i + 1;
      }
      if (lines[i].trim() === '}));' && i > lines.length - 10) {
        endIdx = i;
      }
    }
    
    if (startIdx === -1 || endIdx === -1) return null;
    
    let body = lines.slice(startIdx, endIdx).join('\n');
    
    // Add imports at the beginning
    const imports = `const SharedConstants = _require('../../shared-constants');\nconst SharedBoardUtils = _require('../../shared/shared-board-utils');\nconst CardMarkers = _require('../logic/cards/markers');\nconst CardSelectors = _require('../logic/cards/selectors');\nconst CardTargets = _require('../logic/cards/targets');\n\nconst { BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE } = SharedConstants || {};\nconst BoardUtils = SharedBoardUtils || null;\nconst Markers = CardMarkers || {};\nconst Selectors = CardSelectors || {};\nconst Targets = CardTargets || {};\n\n`;
    
    // Remove the destructuring lines from body
    body = body.replace(/const \{ BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE \} = SharedConstants \|\| \{\};\n/, '');
    body = body.replace(/const BoardUtils = SharedBoardUtils \|\| null;\n/, '');
    body = body.replace(/const Markers = CardMarkers \|\| \{\};\n/, '');
    body = body.replace(/const Selectors = CardSelectors \|\| \{\};\n/, '');
    body = body.replace(/const Targets = CardTargets \|\| \{\};\n/, '');
    
    return imports + body;
  }
);

// 4. game/game/cards/target-resolver.js - custom _require
convertFile(
  'game/game/cards/target-resolver.js',
  'game/game/cards/target-resolver.ts',
  '../../../src/types',
  (content) => {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (startIdx === -1 && lines[i].includes('const { BLACK, WHITE, EMPTY, DIRECTIONS }')) {
        startIdx = i + 1;
      }
      if (lines[i].trim() === '};' && i > lines.length - 10) {
        endIdx = i;
      }
    }
    
    if (startIdx === -1 || endIdx === -1) return null;
    
    let body = lines.slice(startIdx, endIdx).join('\n');
    
    // Add imports
    const imports = `const SharedConstants = _require('../../shared-constants');\nconst BoardUtils = _require('../../shared/shared-board-utils');\nconst Markers = _require('../logic/cards/markers');\nconst Selectors = _require('../logic/cards/selectors');\nconst Targets = _require('../logic/cards/targets');\n\nconst { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};\n\n`;
    
    return imports + body;
  }
);

// 5. turn-manager.js - plain file
convertFile(
  'game/turn-manager.js',
  'game/turn-manager.ts',
  '../src/types',
  (content) => {
    // Replace require with _require
    let body = content;
    body = body.replace(/if \(typeof require === 'function'\) \{\n?\s*try \{ ([^}]+)\} catch \(e\) \{ \/\* ignore \*\/ \}\n?\s*\}/g, (match, p1) => {
      return p1.replace(/require\(/g, '_require(');
    });
    body = body.replace(/require\(/g, '_require(');
    return body;
  }
);

// 6. fixed-commentary-engine.js - UMD without deps
convertFile(
  'game/ai/fixed-commentary-engine.js',
  'game/ai/fixed-commentary-engine.ts',
  '../../src/types',
  (content) => {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (startIdx === -1 && lines[i].trim() === 'let Data = null;') {
        startIdx = i;
      }
      if (lines[i].trim() === '}));' && i > lines.length - 10) {
        endIdx = i;
      }
    }
    
    if (startIdx === -1 || endIdx === -1) return null;
    
    let body = lines.slice(startIdx, endIdx).join('\n');
    
    // Replace require block with typed version
    const requireBlock = `let Data: any = null;
let CommentaryContextHelpers: any = null;
let CommentaryRuntimeHelpers: any = null;
let OwnerHelpersModule: any = null;
try {
    Data = _require('../../data/dialogue/fixed-commentary-data');
} catch (e) { Data = null; }
if (!Data) {
    try { Data = _require('../..//data/dialogue/fixed-commentary-data'); } catch (e) { Data = null; }
}
try { CommentaryContextHelpers = _require('../../shared/commentary-context-helpers'); } catch (e) { CommentaryContextHelpers = null; }
try { CommentaryRuntimeHelpers = _require('../../shared/commentary-runtime-helpers'); } catch (e) { CommentaryRuntimeHelpers = null; }
try { OwnerHelpersModule = _require('../../utils/owner-helpers'); } catch (e) { OwnerHelpersModule = null; }

`;
    
    // Remove the original require block
    body = body.replace(/let Data = null;\nlet CommentaryContextHelpers = null;\nlet CommentaryRuntimeHelpers = null;\nlet OwnerHelpersModule = null;\nif \(typeof require === 'function'\) \{[\s\S]*?\}\n/, '');
    
    // Remove the globalThis fallback block
    body = body.replace(/if \(!Data \|\| !CommentaryContextHelpers[\s\S]*?\}\n/, '');
    
    return requireBlock + body;
  }
);

// 7. cards/catalog.js - data file
convertFile(
  'cards/catalog.js',
  'cards/catalog.ts',
  '../src/types',
  (content) => {
    return content.replace('window.CardCatalog = ', 'const CardCatalog = ') + '\n\nexport = CardCatalog;\n';
  }
);

console.log('\nAll conversions complete!');
