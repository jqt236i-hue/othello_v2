/**
 * Fix TypeScript errors in game/cpu-decision.ts
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'game', 'cpu-decision.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// FIX 1: Remove duplicate declare const CPU_ONNX_BUDGET_TIMEOUT
content = content.replace(
  /^declare const CPU_ONNX_BUDGET_TIMEOUT: any;\r?\n/m,
  ''
);

// FIX 2: Add declare let for cardState/gameState + missing declares
content = content.replace(
  /(declare const assignCardPlayedSoundForCpu:)/,
  'declare let cardState: any;\ndeclare let gameState: any;\ndeclare const CARD_DEFS: any;\ndeclare const waitForPlaybackIdle: any;\ndeclare const processCpuTurn: any;\n$1'
);

// FIX 3: TS7006 - Add :any to named function params
content = content.replace(
  /((?:async\s+)?function\s+\w+\s*\()([\s\S]*?)(\)\s*(?::\s*\w+(?:<[\s\S]*?>)?)?\s*\{)/gm,
  (match, prefix, paramsRaw, suffix) => {
    const params = paramsRaw.trim();
    if (!params) return match;
    const paramList = splitTopLevel(params);
    let changed = false;
    const fixedParams = paramList.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return p;
      if (hasTopLevelColon(trimmed)) return p;
      if (trimmed.startsWith('...')) { changed = true; return trimmed + ': any'; }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) { changed = true; return trimmed + ': any'; }
      changed = true;
      return trimmed + ': any';
    });
    if (!changed) return match;
    return prefix + fixedParams.join(', ') + suffix;
  }
);

// FIX 5: TS1064 - Async function return types
content = content.replace(
  /(async\s+function\s+\w+\s*\([^)]*\))\s*:\s*any\s*\{/g,
  '$1: Promise<any> {'
);
content = content.replace(
  /(async\s+function\s+\w+\s*\([^)]*\))\s*\{/g,
  '$1: Promise<any> {'
);

// FIX 6: TS2554 - Make specific params optional
content = content.replace(
  /function readCpuPendingEffect\(playerKey,\s*stateRef\)/,
  'function readCpuPendingEffect(playerKey, stateRef?)'
);
content = content.replace(
  /function buildOnnxContext\(playerKey,\s*level,\s*legalMovesCount,\s*handCardIds,\s*usableCardIds,\s*candidateMoves\)/,
  'function buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, usableCardIds, candidateMoves?)'
);
content = content.replace(
  /function buildCardUseDecisionContext\(playerKey,\s*level,\s*legalMovesCount,\s*legalMoves,\s*usableCardIds\)/,
  'function buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves?, usableCardIds?)'
);

// FIX 7: TS7017/TS7053 - Cast globalThis.X
content = content.replace(
  /\bglobalThis\.(NetworkMatchClient|DEBUG_HUMAN_VS_HUMAN|getCurrentMatchMode|MATCH_MODE|waitForPlaybackIdle|SharedBoardUtils|PendingSelectionFlow|NetworkTurnHandoff|PendingCoordinator|CpuDecisionBoardUtils|DEBUG_CPU_LOG|CARD_DEFS)\b/g,
  '(globalThis as any).$1'
);

// FIX 8: TS2339 - Fix meta.action/meta.snapshot
content = content.replace(
  /\b(meta)\.(action|snapshot)\s*=/g,
  '(meta as any).$2 ='
);

// FIX 9: TS7053 - Pressure profile index
content = content.replace(
  /CARD_TYPE_PLAN_PRESSURE_PROFILE\[([^\]]+)\]/g,
  '(CARD_TYPE_PLAN_PRESSURE_PROFILE as any)[$1]'
);
content = content.replace(
  /GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE\[([^\]]+)\]/g,
  '(GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE as any)[$1]'
);

// FIX 10: global.BLACK/WHITE
content = content.replace(
  /typeof global !== 'undefined' \? global\.BLACK/g,
  "typeof globalThis !== 'undefined' ? (globalThis as any).BLACK"
);
content = content.replace(
  /typeof global !== 'undefined' \? global\.WHITE/g,
  "typeof globalThis !== 'undefined' ? (globalThis as any).WHITE"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixes applied to', filePath);

function splitTopLevel(str) {
  const result = [];
  let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) result.push(cur);
  return result;
}

function hasTopLevelColon(str) {
  let depth = 0;
  for (const ch of str) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ':' && depth === 0) return true;
  }
  return false;
}
