const fs = require('fs');

// fixed-commentary-engine.js doesn't have 'use strict', starts with let Data = null;
const content = fs.readFileSync('game/ai/fixed-commentary-engine.js', 'utf8');
const lines = content.split('\n');

let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (startLine === -1 && lines[i].trim() === 'let Data = null;') {
    startLine = i;
  }
  if (lines[i].trim() === '}));') {
    endLine = i;
  }
}

console.log('Start line:', startLine, 'End line:', endLine);

if (startLine !== -1 && endLine !== -1) {
  const body = lines.slice(startLine, endLine).join('\n');
  
  const header = `// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let Data: any = null;
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

  // Remove the original require block from body
  const bodyLines = body.split('\n');
  let requireEndLine = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    if (bodyLines[i].includes('OwnerHelpersModule = null;')) {
      requireEndLine = i + 1;
      break;
    }
  }
  
  // Find the end of the require block
  let inRequireBlock = false;
  let requireBlockEnd = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    if (bodyLines[i].includes('if (typeof require')) {
      inRequireBlock = true;
    }
    if (inRequireBlock && bodyLines[i].trim() === '}' && !bodyLines[i].includes('catch')) {
      requireBlockEnd = i + 1;
      break;
    }
  }
  
  // Also remove the globalThis fallback block
  let globalThisEnd = 0;
  for (let i = requireBlockEnd; i < bodyLines.length; i++) {
    if (bodyLines[i].includes('if (!OwnerHelpersModule && typeof globalThis')) {
      // Find the end of this block
      for (let j = i; j < bodyLines.length; j++) {
        if (bodyLines[j].trim() === '}' && !bodyLines[j].includes('catch')) {
          globalThisEnd = j + 1;
          break;
        }
      }
      break;
    }
  }
  
  const cleanBody = bodyLines.slice(globalThisEnd > requireBlockEnd ? globalThisEnd : requireBlockEnd).join('\n');
  
  fs.writeFileSync('game/ai/fixed-commentary-engine.ts', header + cleanBody);
  console.log('Created game/ai/fixed-commentary-engine.ts');
} else {
  console.log('Could not find markers');
}
