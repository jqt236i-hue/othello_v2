/**
 * Second pass: fix remaining TypeScript errors in game/cpu-decision.ts
 * Run AFTER fix-cpu-decision-ts.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'game', 'cpu-decision.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// ========================
// FIX 1: TS2554 - Make snapshotOverride optional in publishCpuSelectionNetworkSnapshot
// ========================
content = content.replace(
  'function publishCpuSelectionNetworkSnapshot(playerKey: any, action: any, playbackEvents: any, snapshotOverride: any): any {',
  'function publishCpuSelectionNetworkSnapshot(playerKey: any, action: any, playbackEvents: any, snapshotOverride?: any): any {'
);

// ========================
// FIX 2: TS2554 - Make stateRef optional in readCpuPendingEffect
// ========================
content = content.replace(
  'function readCpuPendingEffect(playerKey: any, stateRef: any): any {',
  'function readCpuPendingEffect(playerKey: any, stateRef?: any): any {'
);

// ========================
// FIX 3: TS2554 - Make candidateMoves optional in buildOnnxContext
// ========================
content = content.replace(
  'function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves: any): any {',
  'function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any): any {'
);

// ========================
// FIX 4: TS2554 - Make legalMoves and usableCardIds optional in buildCardUseDecisionContext
// ========================
content = content.replace(
  'function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any): any {',
  'function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any): any {'
);

// ========================
// FIX 5: TS2554 - Make markerProfile optional in isCloneSplitEligibleSource
// ========================
content = content.replace(
  'function isCloneSplitEligibleSource(playerKey: any, row: any, col: any, markerProfile: any): any {',
  'function isCloneSplitEligibleSource(playerKey: any, row: any, col: any, markerProfile?: any): any {'
);

// ========================
// FIX 6: TS7053 - globalThis[globalKey] needs cast
// Lines 124-125
// ========================
content = content.replace(
  'globalThis[globalKey]',
  '(globalThis as any)[globalKey]'
);

// ========================
// FIX 7: TS7017 - Remaining globalThis property accesses
// CPU_LV6_SHARED_PROFILE, CPU_LV6_ONNX_RUNTIME_GUARD, CPU_LV6_PENDING_SELECTION_ONNX_MAX_MS
// ========================
content = content.replace(
  /\bglobalThis\.CPU_LV6_SHARED_PROFILE\b/g,
  '(globalThis as any).CPU_LV6_SHARED_PROFILE'
);
content = content.replace(
  /\bglobalThis\.CPU_LV6_ONNX_RUNTIME_GUARD\b/g,
  '(globalThis as any).CPU_LV6_ONNX_RUNTIME_GUARD'
);
content = content.replace(
  /\bglobalThis\.CPU_LV6_PENDING_SELECTION_ONNX_MAX_MS\b/g,
  '(globalThis as any).CPU_LV6_PENDING_SELECTION_ONNX_MAX_MS'
);
content = content.replace(
  /\bglobalThis\.computeCpuAction\b/g,
  '(globalThis as any).computeCpuAction'
);

// ========================
// FIX 8: TS7017 - globalThis.CARD_DEFS access (line ~2874)
// ========================
content = content.replace(
  /root\.CARD_DEFS/g,
  '(root as any).CARD_DEFS'
);

// ========================
// FIX 9: TS7017 - globalThis.PresentationHelper access (line ~3215-3217)
// ========================
// These are globalThis references inside a specific function
// Let me just cast all remaining globalThis.X that aren't standard globals
const additionalGlobalAccessors = [
  'PresentationHelper', 'BoardOps', 'presentationHelper', 'boardOps'
];
for (const name of additionalGlobalAccessors) {
  content = content.replace(
    new RegExp(`\\bglobalThis\\.${name}\\b`, 'g'),
    `(globalThis as any).${name}`
  );
}

// ========================
// FIX 10: TS7017 - Line ~3289-3291 globalThis references
// ========================
content = content.replace(
  /\bglobalThis\.BoardOps\b/g,
  '(globalThis as any).BoardOps'
);
// Also handle globalThis.waitForPlaybackIdle (at line ~3289)
content = content.replace(
  /\bglobalThis\.waitForPlaybackIdle\b/g,
  '(globalThis as any).waitForPlaybackIdle'
);

// ========================
// FIX 11: TS7031 - Add :any to destructured callback params (lines 1758, 1762)
// ========================
content = content.replace(
  'publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }) => {',
  'publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }: any) => {'
);
content = content.replace(
  'scheduleCpuTurn: ({ delayMs, expectedTurnNumber }) => {',
  'scheduleCpuTurn: ({ delayMs, expectedTurnNumber }: any) => {'
);

// ========================
// FIX 12: TS7006 - Remaining arrow function params in callbacks
// These are all simple single-param arrow functions in resolveModuleReference calls
// ========================

// resolveModuleReference isValid callbacks
content = content.replace(
  "isValid: (moduleRef) => !!(moduleRef && typeof moduleRef === 'object')",
  "isValid: (moduleRef: any) => !!(moduleRef && typeof moduleRef === 'object')"
);

// resolveModuleReference with hasPendingSelectionFlowFunction
content = content.replace(
  'isValid: (moduleRef) => requiredName',
  'isValid: (moduleRef: any) => requiredName'
);

// resolveModuleReference with hasPendingSelectionFlowContract
content = content.replace(
  'isValid: (moduleRef) => requiredName\n            ? hasPendingSelectionFlowFunction(moduleRef, requiredName)\n            : hasPendingSelectionFlowContract(moduleRef)',
  'isValid: (moduleRef: any) => requiredName\n            ? hasPendingSelectionFlowFunction(moduleRef, requiredName)\n            : hasPendingSelectionFlowContract(moduleRef)'
);

// resolvePolicyTableRuntime isValid
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.getActionScoreForKey === 'function'\n            )\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.getActionScoreForKey === 'function'\n            )\n        )"
);

// resolvePolicyOnnxRuntime isValid
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.chooseCard === 'function' ||\n                typeof moduleRef.choosePendingTarget === 'function' ||\n                typeof moduleRef.evaluatePosition === 'function'\n            )\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            (\n                typeof moduleRef.chooseMove === 'function' ||\n                typeof moduleRef.chooseCard === 'function' ||\n                typeof moduleRef.choosePendingTarget === 'function' ||\n                typeof moduleRef.evaluatePosition === 'function'\n            )\n        )"
);

// resolveCpuLv6RuntimeCapabilityModule isValid
content = content.replace(
  "isValid: (moduleRef) => !!(\n            moduleRef &&\n            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'\n        )",
  "isValid: (moduleRef: any) => !!(\n            moduleRef &&\n            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'\n        )"
);

// TurnPipelineUIAdapter isValid
content = content.replace(
  "isValid: (moduleRef) => !!moduleRef",
  "isValid: (moduleRef: any) => !!moduleRef"
);

// TurnPipeline isValid
content = content.replace(
  "isValid: (moduleRef) => !!(moduleRef && typeof moduleRef === 'object')",
  "isValid: (moduleRef: any) => !!(moduleRef && typeof moduleRef === 'object')"
);

// ========================
// FIX 13: TS7006 - Other arrow function params in callbacks
// ========================

// (key, fallback) => {
content = content.replace(
  'const readNumber = (key, fallback) => {',
  'const readNumber = (key: any, fallback: any) => {'
);

// (ev) => { (in map)
content = content.replace(
  'return events.map((ev) => {',
  'return events.map((ev: any) => {'
);

// (t) => { (in map)
content = content.replace(
  ': targets.map((t) => Object.assign({}, t, {',
  ': targets.map((t: any) => Object.assign({}, t, {'
);

// (id) => { (in filter)
content = content.replace(
  'return hand.filter((id) => {',
  'return hand.filter((id: any) => {'
);

// (m) => (computeCallCount) 
content = content.replace(
  '.map((m) => (m.isCpuPlan === true ? 1 : 0))',
  '.map((m: any) => (m.isCpuPlan === true ? 1 : 0))'
);

// (c) => (in find)
content = content.replace(
  "defs.find(c => c && c.type === 'TRAP_WILL'",
  "defs.find((c: any) => c && c.type === 'TRAP_WILL'"
);

// (choice) => { (in isAllowedChoice)
content = content.replace(
  "const isAllowedChoice = (choice) => {",
  "const isAllowedChoice = (choice: any) => {"
);

// (moves, lv) => { (in AISystem fallback)
content = content.replace(
  '? (moves, lv) => AISystem.selectMove(gameState, cardState, moves, lv, null)',
  '? (moves: any, lv: any) => AISystem.selectMove(gameState, cardState, moves, lv, null)'
);

// (move) => { (in scoreMove)
content = content.replace(
  'return function scoreMove(move) {',
  'return function scoreMove(move: any) {'
);

// (move) => { (in combinedScoreFn)
content = content.replace(
  'const combinedScoreFn = (move) => {',
  'const combinedScoreFn = (move: any) => {'
);

// (move) => { in filter
content = content.replace(
  '.filter((move) => {',
  '.filter((move: any) => {'
);

// (marker) => { in filter (make unique by checking context)
// Be careful not to double-replace
content = content.replace(
  'markers.filter((marker) => {',
  'markers.filter((marker: any) => {'
);

// (target) => { in filter (for clone split)
content = content.replace(
  'return targets.filter((target) => {',
  'return targets.filter((target: any) => {'
);

// (result) => { in then()
// Be specific about which then
content = content.replace(
  '.then((result) => {',
  '.then((result: any) => {'
);

// (row, r) => ... and (_, c) => ... in flatMap (line ~2561)
// These are complex nested arrows. Let me find the specific pattern.
content = content.replace(
  'board.flatMap((row, r) => (Array.isArray(row) ? row.map((_, c) => ({ row: r, col: c })) : []))',
  'board.flatMap((row: any, r: any) => (Array.isArray(row) ? row.map((_: any, c: any) => ({ row: r, col: c })) : []))'
);

// ========================
// FIX 14: More TS7006 - (cell) callbacks
// ========================
content = content.replace(
  '.forEach((cell) => {',
  '.forEach((cell: any) => {'
);

// ========================
// FIX 15: TS7017 - globalThis with computeCpuAction at line ~6188
// ========================
// The line: if (typeof global !== 'undefined') { global.computeCpuAction = computeCpuAction; ... }
// This uses Node.js 'global' which is fine, but also at line 6194:
// try { if (typeof globalThis !== 'undefined') globalThis.computeCpuAction = computeCpuAction; } catch (e) {}
content = content.replace(
  "globalThis.computeCpuAction = computeCpuAction;",
  "(globalThis as any).computeCpuAction = computeCpuAction;"
);

// ========================
// FIX 16: TS2339 - globalThis.CARD_DEFS at line 2874
// ========================
// Already handled by FIX 8 (root.CARD_DEFS -> (root as any).CARD_DEFS)

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Second pass fixes applied');
