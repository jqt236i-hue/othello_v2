const fs = require('fs');

// Read the file
const content = fs.readFileSync('game/card-effects/selection-flow.js', 'utf8');

// Find line 19 which has 'use strict';
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "'use strict';" && startLine === -1) {
    startLine = i + 1; // line after 'use strict'
  }
  if (lines[i].trim() === '};' && i > lines.length - 5) {
    endLine = i;
  }
}

console.log('Start line:', startLine, 'End line:', endLine);

if (startLine !== -1 && endLine !== -1) {
  const body = lines.slice(startLine, endLine).join('\n');
  console.log('Body length:', body.length);
  
  const header = `// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

`;

  fs.writeFileSync('game/card-effects/selection-flow.ts', header + body);
  console.log('Created game/card-effects/selection-flow.ts');
} else {
  console.log('Could not find markers');
}
