const fs = require('fs');

function createTsFromJs(jsPath, tsPath, typesPath, startPattern, endPattern) {
  const content = fs.readFileSync(jsPath, 'utf8');
  const lines = content.split('\n');
  
  let startLine = -1;
  let endLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (startLine === -1 && lines[i].includes(startPattern)) {
      startLine = i + 1;
    }
    if (endLine === -1 && lines[i].trim() === endPattern) {
      endLine = i;
    }
  }
  
  console.log(`${jsPath}: Start line ${startLine}, End line ${endLine}`);
  
  if (startLine === -1 || endLine === -1) {
    console.log(`ERROR: Could not find markers in ${jsPath}`);
    return false;
  }
  
  const body = lines.slice(startLine, endLine).join('\n');
  
  const header = `// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '${typesPath}';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

`;

  fs.writeFileSync(tsPath, header + body);
  console.log(`Created ${tsPath}`);
  return true;
}

// 2. policy-onnx-runtime.js - IIFE
createTsFromJs(
  'game/ai/policy-onnx-runtime.js',
  'game/ai/policy-onnx-runtime.ts',
  '../../src/types',
  "'use strict';",
  '})();'
);

// 6. fixed-commentary-engine.js - UMD
createTsFromJs(
  'game/ai/fixed-commentary-engine.js',
  'game/ai/fixed-commentary-engine.ts',
  '../../src/types',
  "'use strict';",
  '}));'
);

console.log('Done creating remaining TS files');
