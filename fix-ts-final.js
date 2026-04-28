const fs = require('fs');

const files = [
  { path: 'data/dialogue/fixed-commentary-data.ts', export: 'export = {\n    CARD_TYPE_LABELS,\n    CARD_EFFECT_SUMMARIES,\n    CPU_COMMENTARY_DEFAULT_LEVEL,\n    resolveCpuCommentaryTier,\n    cpuChatterLines,\n    cpuAheadLines,\n    cpuBehindLines,\n    cpuCornerGainLines,\n    cpuCornerLossLines,\n    getCpuChatterLines,\n    getCpuAheadLines,\n    getCpuBehindLines,\n    getCpuCornerGainLines,\n    getCpuCornerLossLines,\n    openingLines,\n    middleAheadLines,\n    middleEvenLines,\n    middleBehindLines,\n    endAheadLines,\n    endEvenLines,\n    endBehindLines,\n    chatterLines,\n    tauntLines,\n    negativeLines,\n    bluffLines,\n    boardSwingLines,\n    passLines,\n    cardTargetLines,\n    cornerFirstOwnedLines,\n    cornerFirstLostLines,\n    cornerStreakTwoOwnedLines,\n    cornerStreakTwoLostLines,\n    cornerStreakThreeOwnedLines,\n    cornerStreakThreeLostLines,\n    cornerAllOwnedLines,\n    cornerAllLostLines,\n    getCardUseLines,\n    getCardHitLines,\n    heroChatterLines,\n    heroAheadLines,\n    heroBehindLines,\n    heroCornerGainLines,\n    heroCornerLossLines,\n    getHeroCardUseLines,\n    getHeroCardHitLines\n};' },
  { path: 'game/visual-effects-map.ts', export: 'export = {\n    STONE_VISUAL_EFFECTS: GAME_STONE_VISUAL_EFFECTS,\n    PENDING_TYPE_TO_EFFECT_KEY,\n    getEffectKeyForPendingType,\n    collectEffectImagePaths,\n    resolveEffectImagePath,\n    getCardVisualImagePaths,\n    resolveCardVisualImagePath,\n    isNormalStoneImagePath,\n    cardTypeUsesNonNormalStoneImage,\n    SPECIAL_TYPE_TO_EFFECT_KEY,\n    getEffectKeyForSpecialType,\n    applyStoneVisualEffect,\n    removeStoneVisualEffect,\n    getSupportedEffectKeys,\n    setUIImpl\n};' },
  { path: 'game/pass-handler.ts', export: 'export = {\n    applyPassViaPipeline,\n    handleDoublePlaceNoSecondMove,\n    handleBlackPassWhenNoMoves,\n    processPassTurn,\n    hasUsableCardFor,\n    ensureCurrentPlayerCanActOrPass,\n    setPassHandlerTimerService\n};' },
  { path: 'game/network-turn-handoff.ts', export: 'export = {\n    captureNetworkPublishSnapshot,\n    publishNetworkSnapshot,\n    waitForPlaybackIdleIfNeeded,\n    finalizeNetworkTurnHandoff,\n    resolvePlayerKeyFromTurnValue\n};' },
  { path: 'game/move-executor.ts', export: 'export = {\n    executeMove,\n    executeMoveViaPipeline,\n    setUIImpl,\n    setMoveExecutorTimerService\n};' },
  { path: 'cards/card-interaction-effects.ts', export: 'export = {\n    CARD_EFFECT_TAG_KIND,\n    CARD_NUMERIC_TAG_KIND,\n    isCardNumericTagKind,\n    quickCardEffectByType,\n    detailCardEffectByType,\n    cardEffectTagsByType,\n    cardNumericTagsByType,\n    normalizeCardDescText,\n    splitCardDescSentences,\n    buildCardDescComparisonKey,\n    isCardDescPlaceholderText,\n    buildCardEffectTag,\n    fallbackQuickCardEffect,\n    fallbackDetailCardEffect,\n    buildCardNumericTag,\n    resolveCardEffectTags,\n    resolveCardNumericTags,\n    resolveNonDuplicateDetailText,\n    resolveCardDescriptionTexts,\n    getQuickCardEffect,\n    getDetailCardEffect\n};' },
  { path: 'game/special-effects/hyperactive.ts', export: 'export = {\n    processHyperactiveMovesAtTurnStart,\n    processHyperactiveImmediateAtPlacement\n};' },
  { path: 'game/move-generator.ts', export: 'export = {\n    getLegalMoves,\n    generateMovesForPlayer,\n    generateFreePlacementMoves,\n    generateSwapMoves,\n    findMoveForCell,\n    posToNotation,\n    isCorner,\n    isEdge\n};' },
  { path: 'game/schema/action_manager.ts', export: 'export = {\n    generateActionId,\n    ActionManager,\n    setActionIdGenerator,\n    setTimeProvider,\n    setStorageAdapter\n};' },
  { path: 'game/special-effects/dragons.ts', export: 'export = {\n    processUltimateReverseDragonsAtTurnStart,\n    processUltimateReverseDragonImmediateAtPlacement\n};' },
  { path: 'utils/owner-helpers.ts', export: 'export = OwnerHelpers;' },
  { path: 'game/turn-handlers/pending-target-selector.ts', export: 'export = {\n    buildPendingSelectionAction,\n    createCancelCardAction,\n    choosePendingTargetWithPolicy\n};' },
  { path: 'game/cpu-decision-board-utils.ts', export: 'export = {\n    DEFAULT_CORNER_RECOVERY_CARD_TYPES,\n    DEFAULT_CORNER_HOLD_CARD_TYPES,\n    DEFAULT_CHARGE_RAMP_CARD_TYPES,\n    countBoardEmpties,\n    isStandardBoard8x8,\n    resolveBoardBounds,\n    isCornerCell,\n    isEdgeCell,\n    getBoardBonusValueAt,\n    countCornerControl,\n    countEdgeControl,\n    isRecoveryCardType,\n    isHoldCardType,\n    isChargeRampCardType,\n    resolveCardType\n};' },
  { path: 'game/debug/debug-actions.ts', export: 'export = {\n    fillDebugHand,\n    applyVisualTestBoard\n};' }
];

function getTypeImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  return '../'.repeat(depth) + 'src/types';
}

function cleanAndFixFile(fileInfo) {
  const tsPath = fileInfo.path;
  if (!fs.existsSync(tsPath)) {
    console.log(`Skipping ${tsPath}`);
    return;
  }
  
  let content = fs.readFileSync(tsPath, 'utf8');
  
  // Remove all instances of the TS header
  const headerPattern = /\/\*\* @ts-nocheck \*\/\n declare const __non_webpack_require__: NodeRequire \| undefined;\n\n const _require: NodeRequire = \(typeof __non_webpack_require__ !== 'undefined'\)\n\s*\? __non_webpack_require__\n\s*: require;\n\n import type \{ CardState, GameState, PlayerKey \} from '[^']+';\n\n/g;
  content = content.replace(headerPattern, '');
  
  // Also try without the import line
  const headerPattern2 = /\/\*\* @ts-nocheck \*\/\n declare const __non_webpack_require__: NodeRequire \| undefined;\n\n const _require: NodeRequire = \(typeof __non_webpack_require__ !== 'undefined'\)\n\s*\? __non_webpack_require__\n\s*: require;\n\n/g;
  content = content.replace(headerPattern2, '');
  
  // Remove standalone duplicate declarations
  content = content.replace(/declare const __non_webpack_require__: NodeRequire \| undefined;\n\n const _require: NodeRequire = \(typeof __non_webpack_require__ !== 'undefined'\)\n\s*\? __non_webpack_require__\n\s*: require;\n\n import type \{ CardState, GameState, PlayerKey \} from '[^']+';\n\n/g, '');
  
  // Remove 'use strict'
  content = content.replace(/['"]use strict['"];?\n?/g, '');
  
  // Remove remaining wrapper artifacts
  content = content.replace(/\(function\s*\(\s*root\s*,\s*factory\s*\)\s*\{[\s\S]*?\}\s*\)\s*\([\s\S]*?\)\s*;?/g, '');
  content = content.replace(/root\.\w+\s*=\s*factory\(\);?/g, '');
  
  // Remove conditional exports blocks
  content = content.replace(/if\s*\(\s*typeof\s+module\s*!==?\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[\s\S]*?\}\s*/g, '');
  
  // Remove globalThis assignment blocks
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+globalThis\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  content = content.replace(/try\s*\{\s*if\s*\(\s*typeof\s+window\s*!==?\s*['"]undefined['"]\s*\)\s*\{[\s\S]*?\}\s*\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '');
  
  // Clean up remaining export artifacts
  content = content.replace(/export\s*=\s*factory;\(\);?/g, '');
  content = content.replace(/export\s*=\s*\w+;\(\);?/g, '');
  
  // Remove trailing semicolons and braces from old wrappers
  content = content.replace(/;\s*\}\s*$/, '');
  content = content.replace(/\}\s*$/, '');
  
  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n').trim();
  
  // Build proper TS content
  const typeImportPath = getTypeImportPath(tsPath);
  let tsContent = `/** @ts-nocheck */\n`;
  tsContent += `declare const __non_webpack_require__: NodeRequire | undefined;\n\n`;
  tsContent += `const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')\n`;
  tsContent += `  ? __non_webpack_require__\n`;
  tsContent += `  : require;\n\n`;
  tsContent += `import type { CardState, GameState, PlayerKey } from '${typeImportPath}';\n\n`;
  
  tsContent += content + '\n\n';
  tsContent += fileInfo.export + '\n';
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`Fixed ${tsPath}`);
}

files.forEach(cleanAndFixFile);
console.log('All files fixed!');
