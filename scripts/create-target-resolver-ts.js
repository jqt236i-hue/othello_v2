const fs = require('fs');

// game/cards/target-resolver.js - UMD with dependencies
const content = fs.readFileSync('game/cards/target-resolver.js', 'utf8');
const lines = content.split('\n');

let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (startLine === -1 && lines[i].trim() === "'use strict';") {
    startLine = i + 1;
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

const SharedConstants = _require('../../shared-constants');
const SharedBoardUtils = _require('../../shared/shared-board-utils');
const CardMarkers = _require('../logic/cards/markers');
const CardSelectors = _require('../logic/cards/selectors');
const CardTargets = _require('../logic/cards/targets');

const { BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE } = SharedConstants || {};
const BoardUtils = SharedBoardUtils || null;
const Markers = CardMarkers || {};
const Selectors = CardSelectors || {};
const Targets = CardTargets || {};

`;

  // Remove the destructuring lines from body
  let bodyLines = body.split('\n');
  bodyLines = bodyLines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('const { BLACK') &&
           !trimmed.startsWith('const BoardUtils') &&
           !trimmed.startsWith('const Markers') &&
           !trimmed.startsWith('const Selectors') &&
           !trimmed.startsWith('const Targets');
  });
  
  fs.writeFileSync('game/cards/target-resolver.ts', header + bodyLines.join('\n'));
  console.log('Created game/cards/target-resolver.ts');
} else {
  console.log('Could not find markers');
}
