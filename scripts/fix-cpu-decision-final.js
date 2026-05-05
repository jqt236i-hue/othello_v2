/**
 * Final pass: fix ALL remaining TypeScript errors in game/cpu-decision.ts
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'game', 'cpu-decision.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// ========================
// FIX 1: Fix globalThis[globalKey] at line 125 - the first replacement only got line 124
// ========================
content = content.replace(
  'return globalThis[globalKey];',
  'return (globalThis as any)[globalKey];'
);

// ========================
// FIX 2: Fix root.DEBUG_UNLIMITED_USAGE at line ~2855
// ========================
content = content.replace(
  'root.DEBUG_UNLIMITED_USAGE',
  '(root as any).DEBUG_UNLIMITED_USAGE'
);

// ========================
// FIX 3: Remaining moduleRef callbacks in isValid
// These have multi-line bodies
// ========================
// The simplest approach: find (moduleRef) => !! and (moduleRef) => !!(
// and add :any

// resolvePolicyTableRuntime
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.getActionScoreForKey === 'function'\n            )\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.getActionScoreForKey === 'function'\n            )\n        )"
);

// resolvePolicyOnnxRuntime
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.chooseCard === 'function' ||\n                typeof moduleRef.choosePendingTarget === 'function' ||\n                typeof moduleRef.evaluatePosition === 'function'\n            )\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.chooseCard === 'function' ||\n                typeof moduleRef.choosePendingTarget === 'function' ||\n                typeof moduleRef.evaluatePosition === 'function'\n            )\n        )"
);

// resolveCpuLv6RuntimeCapabilityModule
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'\n        )"
);

// resolveTurnPipeline  
content = content.replace(
  "isValid: (moduleRef) => !!moduleRef",
  "isValid: (moduleRef: any) => !!moduleRef"
);

// ========================
// FIX 4: TS7006 - Remaining arrow function params
// ========================

// (id) => typeof id === 'string' (line ~1301)
content = content.replace(
  "filter((id) => typeof id === 'string'",
  "filter((id: any) => typeof id === 'string'"
);

// (t) => Object.assign (line ~1921 - but specificity needed)
// Actually let me check the exact pattern
content = content.replace(
  ': targets.map((t: any) => Object.assign({}, t, {',
  ': targets.map((t: any) => Object.assign({}, t, {'
);
// It's already replaced, so skip this one.

// (m) => (m.isCpuPlan (line ~2687)
content = content.replace(
  'legal.some((m) => m && isCornerCell(Number(m.row), Number(m.col), board))',
  'legal.some((m: any) => m && isCornerCell(Number(m.row), Number(m.col), board))'
);

// (move) => { (line ~3386) - function scoreMove
content = content.replace(
  'return function scoreMove(move: any) {',
  'return function scoreMove(move: any) {'
);
// Already fixed! Let me check what line 3386 actually is.

// (move) => { (line ~3876) - filter
content = content.replace(
  'profiledMoves.filter((one) =>',
  'profiledMoves.filter((one: any) =>'
);

// (marker) => { (line ~4089)  
content = content.replace(
  'markers.filter((marker: any) => {',
  'markers.filter((marker: any) => {'
);
// skip if already done

// (target) => { (line ~4620) 
content = content.replace(
  'return targets.filter((target: any) => {',
  'return targets.filter((target: any) => {'
);
// skip if already done

// (cell) => { (line ~4890)
content = content.replace(
  '.forEach((cell: any) => {',
  '.forEach((cell: any) => {'
);
// skip if already done

// More TS7006 checks using the error info
// Let me just use a blanket approach - find all remaining (param) => patterns
// where param is a word without type annotation

// (move) => {...} in filter patterns
content = content.replace(
  'candidateMoves.filter((move) => {',
  'candidateMoves.filter((move: any) => {'
);

// (move) => {...} in .some
content = content.replace(
  '.some((move) => {',
  '.some((move: any) => {'
);

// ========================
// FIX 5: TS2554 - clearCpuPendingEffect needs optional stateRef
// ========================
content = content.replace(
  'function clearCpuPendingEffect(playerKey: any, stateRef: any): any {',
  'function clearCpuPendingEffect(playerKey: any, stateRef?: any): any {'
);

// ========================
// FIX 6: TS2554 - maybeContinueCpuSelectionTurnHandoff needs optional action
// ========================
content = content.replace(
  'function maybeContinueCpuSelectionTurnHandoff(playerKey: any, pendingType: any, playbackEvents: any, action: any): any {',
  'function maybeContinueCpuSelectionTurnHandoff(playerKey: any, pendingType: any, playbackEvents: any, action?: any): any {'
);

// ========================
// FIX 7: TS7017 - globalThis.playCardUseHandAnimation, VisualPlaybackActive
// ========================
content = content.replace(
  "globalThis.playCardUseHandAnimation",
  "(globalThis as any).playCardUseHandAnimation"
);
content = content.replace(
  "globalThis.VisualPlaybackActive",
  "(globalThis as any).VisualPlaybackActive"
);

// ========================
// FIX 8: TS7017 - More globalThis references 
// Check lines 3289-3291
// ========================
// Look for patterns like globalThis.waitForPlaybackIdle that weren't caught
content = content.replace(
  /globalThis\.(\w+)(?!\s*\()/g,
  (match, name) => {
    // Skip known safe globals
    const safe = ['undefined', 'Object', 'Array', 'String', 'Number', 'Boolean',
      'console', 'location', 'process', 'setTimeout', 'setInterval', 'clearTimeout',
      'clearInterval', 'Promise', 'Math', 'JSON', 'isNaN', 'isFinite', 'parseInt',
      'parseFloat', 'Error', 'Date', 'RegExp', 'Map', 'Set', 'Symbol'];
    if (safe.includes(name)) return match;
    // Already cast
    if (match.includes('as any')) return match;
    return `(globalThis as any).${name}`;
  }
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Final pass fixes applied');
