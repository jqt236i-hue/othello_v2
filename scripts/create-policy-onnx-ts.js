const fs = require('fs');

// policy-onnx-runtime.js - IIFE pattern
const content = fs.readFileSync('game/ai/policy-onnx-runtime.js', 'utf8');
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

console.log('Start line:', startIdx, 'End line:', endIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const body = lines.slice(startIdx, endIdx).join('\n');
  console.log('Body length:', body.length);
  
  const header = `// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

`;

  fs.writeFileSync('game/ai/policy-onnx-runtime.ts', header + body);
  console.log('Created game/ai/policy-onnx-runtime.ts');
} else {
  console.log('Could not find markers');
}
