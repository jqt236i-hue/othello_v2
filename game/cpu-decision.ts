declare const __non_webpack_require__: NodeRequire | undefined;
declare const AISystem: any;
declare const CardLogic: any;
declare const BLACK: any;
declare const WHITE: any;
declare const cpuSmartness: Record<string, number>;
declare const ActionManager: any;
declare const TurnPipelineUIAdapter: any;
declare const TurnPipeline: any;
declare const initCardState: (...args: any[]) => void;
declare const getLegalMoves: (...args: any[]) => any[];
declare const isBlockedCell: (...args: any[]) => boolean;
declare const HAND_LIMIT: number;
declare let cardState: any;
declare let gameState: any;
declare const CARD_DEFS: any;
declare const processCpuTurn: any;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';
import type { CpuTurnPerformanceScope } from './cpu-turn-performance';

/**
 * @file cpu-decision.ts
 * @description CPU意思決定モジュール
 * 
 * AISystemを利用してレベル別のCPU行動を実行する。
 */

// AISystemの存在確認 (lightweight helper used throughout CPU decision logic)
function isAISystemAvailable(): any {
    return (typeof AISystem !== 'undefined' && AISystem && typeof AISystem === 'object');
}

function isCpuDebugEnabled(): any {
    try {
        if (
            getCpuDecisionRuntime() &&
            typeof getCpuDecisionRuntime().isDebugLogAvailable === 'function' &&
            getCpuDecisionRuntime().isDebugLogAvailable() === true
        ) {
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().readDebugFlag === 'function') {
            const flag = getCpuDecisionRuntime().readDebugFlag('DEBUG_CPU_LOG');
            if (flag === true) return true;
        }
    } catch (e) { /* ignore */ }
    try {
        const qs = readCpuDecisionQuerySearch();
        if (/[?&]debug=(?:1|true)\b/i.test(qs)) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function cpuDebugLog(...args: any[]): void {
    if (!isCpuDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, args); } catch (e) { /* ignore */ }
}

if (!isAISystemAvailable()) {
    // Keep runtime warning in browser/dev, but avoid noisy test output.
    const isTestEnv = (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV === 'test');
    if (!isTestEnv) {
        console.error('[CPU] AISystem is not loaded. Please include game/ai/level-system.js');
    }
}

/**
 * フォールバック: レベルやハンド状況に基づいて使用候補を返す
 */
// CPU RNG injection (default deterministic to avoid random calls in game layer)
let cpuRng = { random: () => 0.5 };
function setCpuRng(rng: any): any { cpuRng = rng || cpuRng; }

let CpuPolicyCore: any = null;
if (typeof require === 'function') {
    try { CpuPolicyCore = _require('./ai/cpu-policy-core'); } catch (e) { /* ignore */ }
}
let CpuPolicyTableRuntime: any = null;
if (typeof require === 'function') {
    try { CpuPolicyTableRuntime = _require('./ai/policy-table-runtime'); } catch (e) { /* ignore */ }
}
let CpuPolicyOnnxRuntime: any = null;
if (typeof require === 'function') {
    try { CpuPolicyOnnxRuntime = _require('./ai/policy-onnx-runtime'); } catch (e) { /* ignore */ }
}
let OthelloOnnxRuntime: any = null;
if (typeof require === 'function') {
    try { OthelloOnnxRuntime = _require('./ai/othello-onnx-runtime'); } catch (e) { /* ignore */ }
}
let CpuDecisionCardEffectsHelpers: any = null;
if (typeof require === 'function') {
    try { CpuDecisionCardEffectsHelpers = _require('./card-effects/helpers'); } catch (e) { /* ignore */ }
}
let CpuDecisionSpecialEffectsHelpers: any = null;
if (typeof require === 'function') {
    try { CpuDecisionSpecialEffectsHelpers = _require('./special-effects/helpers'); } catch (e) { /* ignore */ }
}
let OthelloBrowserCpuRuntime: any = null;
if (typeof require === 'function') {
    try { OthelloBrowserCpuRuntime = _require('othello-ai/runtime/browser-cpu'); } catch (e) { /* ignore */ }
}
let SharedBoardUtilsModule: any = null;
if (typeof require === 'function') {
    try { SharedBoardUtilsModule = _require('../shared/shared-board-utils'); } catch (e) { /* ignore */ }
}
let CpuPolicyBoardMarkerPrimitives: any = null;
if (typeof require === 'function') {
    try { CpuPolicyBoardMarkerPrimitives = _require('./ai/cpu-policy-board-marker-primitives'); } catch (e) { /* ignore */ }
}
let CpuPolicyPlacementFilters: any = null;
if (typeof require === 'function') {
    try { CpuPolicyPlacementFilters = _require('./ai/cpu-policy-placement-filters'); } catch (e) { /* ignore */ }
}
let CpuPolicyPendingTargets: any = null;
if (typeof require === 'function') {
    try { CpuPolicyPendingTargets = _require('./ai/cpu-policy-pending-targets'); } catch (e) { /* ignore */ }
}
let CpuPolicyTimeBombTargets: any = null;
if (typeof require === 'function') {
    try { CpuPolicyTimeBombTargets = _require('./ai/cpu-policy-time-bomb-targets'); } catch (e) { /* ignore */ }
}
let CpuLv6RuntimeCapabilityModule: any = null;
if (typeof require === 'function') {
    try { CpuLv6RuntimeCapabilityModule = _require('../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}
let CpuOpponentProfiles: any = null;
if (typeof require === 'function') {
    try { CpuOpponentProfiles = _require('../shared/cpu-opponent-profiles'); } catch (e) { /* ignore */ }
}
let CpuDecisionRuntimeBoundaryModule: any = null;
if (typeof require === 'function') {
    try { CpuDecisionRuntimeBoundaryModule = _require('./cpu-decision-runtime'); } catch (e) { /* ignore */ }
}
const CpuDecisionRuntimeBoundary = CpuDecisionRuntimeBoundaryModule && typeof CpuDecisionRuntimeBoundaryModule.createCpuDecisionRuntimeBoundary === 'function'
    ? CpuDecisionRuntimeBoundaryModule.createCpuDecisionRuntimeBoundary()
    : null;

function getCpuDecisionRuntime(): any {
    return CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.getRuntime === 'function'
        ? CpuDecisionRuntimeBoundary.getRuntime()
        : null;
}

function readRuntimeModule(moduleKey: any): any {
    if (CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.readRuntimeModule === 'function') {
        return CpuDecisionRuntimeBoundary.readRuntimeModule(moduleKey);
    }
    return null;
}

function resolveCpuDecisionLevelValue(value: any): number | null {
    try {
        if (CpuOpponentProfiles && typeof CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection === 'function') {
            const selection = CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection(value);
            if (selection && Number.isFinite(Number(selection.decisionLevel))) {
                return Math.max(1, Math.min(6, Math.floor(Number(selection.decisionLevel))));
            }
        }
    } catch (e) { /* ignore and fall back to numeric values */ }
    if (Number.isFinite(Number(value))) {
        return Math.max(1, Math.min(6, Math.floor(Number(value))));
    }
    return null;
}

function resolveCpuDecisionLevelForPlayer(playerKey: any): number {
    try {
        const runtime = getCpuDecisionRuntime();
        if (runtime && typeof runtime.readCpuSmartness === 'function') {
            const profileValues = runtime.readCpuSmartness();
            const profileValue = profileValues && profileValues[playerKey];
            const decisionLevel = resolveCpuDecisionLevelValue(profileValue);
            if (decisionLevel !== null) return decisionLevel;
        }
    } catch (e) { /* ignore and fall back to legacy globals */ }
    const profileValues = (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (profileValues) {
        const decisionLevel = resolveCpuDecisionLevelValue(profileValues[playerKey]);
        if (decisionLevel !== null) return decisionLevel;
    }
    return 1;
}

function resolveCpuCardPolicyLevelValue(value: any): number {
    const decisionLevel = resolveCpuDecisionLevelValue(value);
    if (decisionLevel !== null) return Math.max(6, decisionLevel);
    return 6;
}

function resolveCpuCardPolicyLevelForPlayer(playerKey: any): number {
    try {
        const runtime = getCpuDecisionRuntime();
        if (runtime && typeof runtime.readCpuSmartness === 'function') {
            const profileValues = runtime.readCpuSmartness();
            const profileValue = profileValues && profileValues[playerKey];
            return resolveCpuCardPolicyLevelValue(profileValue);
        }
    } catch (e) { /* ignore and fall back to legacy globals */ }
    const profileValues = (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (profileValues) return resolveCpuCardPolicyLevelValue(profileValues[playerKey]);
    return 6;
}

function resolveCpuCardPolicyLevelFromLevel(level: any): number {
    return resolveCpuCardPolicyLevelValue(level);
}

function resolveCpuSmartnessValue(value: any): number | null {
    return resolveCpuDecisionLevelValue(value);
}

function resolveCpuSmartnessLevel(playerKey: any): number {
    return resolveCpuDecisionLevelForPlayer(playerKey);
}

function resolveCardLogicForCpuDecision(): any {
    return readRuntimeModule('CardLogic') || (typeof CardLogic !== 'undefined' ? CardLogic : null);
}

function getActiveProtectionForPlayer(playerValue: any): any[] {
    try {
        if (
            CpuDecisionCardEffectsHelpers &&
            typeof CpuDecisionCardEffectsHelpers.getActiveProtectionForPlayer === 'function'
        ) {
            return CpuDecisionCardEffectsHelpers.getActiveProtectionForPlayer(playerValue) || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getFlipBlockers(): any[] {
    try {
        if (
            CpuDecisionSpecialEffectsHelpers &&
            typeof CpuDecisionSpecialEffectsHelpers.getFlipBlockers === 'function'
        ) {
            return CpuDecisionSpecialEffectsHelpers.getFlipBlockers() || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function resolveModuleReference(currentValue: any, options: any): any {
    const opts = options || {};
    const isValid = (typeof opts.isValid === 'function')
        ? opts.isValid
        : function isTruthy(value: any) { return !!value; };
    if (isValid(currentValue)) return currentValue;

    let resolvedModule: any = null;
    if (typeof opts.readLocal === 'function') {
        try {
            resolvedModule = opts.readLocal();
        } catch (e) { /* ignore */ }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.requirePath && typeof require === 'function') {
        try {
            resolvedModule = _require(opts.requirePath);
        } catch (e) { /* ignore */ }
        if (isValid(resolvedModule)) return resolvedModule;
    }
    if (opts.globalKey) {
        resolvedModule = readRuntimeModule(opts.globalKey);
        if (isValid(resolvedModule)) return resolvedModule;
    }
    return null;
}

function resolveSharedBoardUtilsModule(): any {
    const resolvedModule = resolveModuleReference(SharedBoardUtilsModule, {
        requirePath: '../shared/shared-board-utils',
        isValid: (moduleRef: any) => !!(moduleRef && typeof moduleRef === 'object')
    });
    if (resolvedModule) SharedBoardUtilsModule = resolvedModule;
    return resolvedModule;
}

let PendingTargetSelector: any = null;
if (typeof require === 'function') {
    try { PendingTargetSelector = _require('./turn-handlers/pending-target-selector'); } catch (e) { /* ignore */ }
}
var PendingSelectionFlow: any = null;
if (typeof require === 'function') {
    try { PendingSelectionFlow = _require('./card-effects/selection-flow'); } catch (e) { /* ignore */ }
}
let cpuDecisionNetworkTurnHandoff: any = null;
if (typeof require === 'function') {
    try { cpuDecisionNetworkTurnHandoff = _require('./network-turn-handoff'); } catch (e) { /* ignore */ }
}
let CpuPendingCoordinator: any = null;
if (typeof require === 'function') {
    try { CpuPendingCoordinator = _require('./turn/pending-coordinator'); } catch (e) { /* ignore */ }
}

function hasPendingSelectionFlowContract(moduleRef: any): any {
    return !!(
        moduleRef
        && typeof moduleRef === 'object'
        && (
            typeof moduleRef.createPendingSelectionAction === 'function'
            || typeof moduleRef.finalizePendingSelectionFlow === 'function'
            || typeof moduleRef.isSelectionOnlyEndTurnPendingType === 'function'
        )
    );
}

function hasPendingSelectionFlowFunction(moduleRef: any, functionName: any): any {
    return !!(
        moduleRef
        && typeof moduleRef === 'object'
        && typeof moduleRef[functionName] === 'function'
    );
}

function resolvePendingSelectionFlow(requiredFunctionName: any): any {
    const requiredName = typeof requiredFunctionName === 'string' ? requiredFunctionName : '';
    const resolvedModule = resolveModuleReference(PendingSelectionFlow, {
        requirePath: './card-effects/selection-flow',
        isValid: (moduleRef: any) => requiredName
            ? hasPendingSelectionFlowFunction(moduleRef, requiredName)
            : hasPendingSelectionFlowContract(moduleRef)
    });
    if (resolvedModule) PendingSelectionFlow = resolvedModule;
    return resolvedModule;
}

function resolveCpuPendingCoordinator(): any {
    const resolvedModule = resolveModuleReference(CpuPendingCoordinator, {
        requirePath: './turn/pending-coordinator',
        isValid: (moduleRef: any) => !!(moduleRef && typeof moduleRef === 'object')
    });
    if (resolvedModule) CpuPendingCoordinator = resolvedModule;
    return resolvedModule;
}

function readCpuPendingEffect(playerKey: any, stateRef?: any): any {
    const resolvedState = stateRef || ((typeof cardState !== 'undefined') ? cardState : null);
    const pendingCoordinator = resolveCpuPendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function') {
        return pendingCoordinator.readPendingEffect(resolvedState, playerKey);
    }
    return (resolvedState && resolvedState.pendingEffectByPlayer)
        ? (resolvedState.pendingEffectByPlayer[playerKey] || null)
        : null;
}

function clearCpuPendingEffect(playerKey: any, stateRef?: any): any {
    const resolvedState = stateRef || ((typeof cardState !== 'undefined') ? cardState : null);
    const pendingCoordinator = resolveCpuPendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.clearPendingEffect === 'function') {
        return pendingCoordinator.clearPendingEffect(resolvedState, playerKey, {
            clearSelectionAction: true
        });
    }
    if (resolvedState && resolvedState.pendingEffectByPlayer) {
        resolvedState.pendingEffectByPlayer[playerKey] = null;
    }
    return { ok: true, playerKey };
}

function requireCpuDecisionModuleOrNull(id: string): any {
    if (typeof require !== 'function') return null;
    try {
        return _require(id);
    } catch (e) {
        /* ignore */
    }
    return null;
}

const CpuDecisionBoardUtilsModule = requireCpuDecisionModuleOrNull('./cpu-decision-board-utils');
const CpuDecisionSharedBoardUtils = requireCpuDecisionModuleOrNull('../shared/shared-board-utils');
const CpuDecisionPlanPressureModule = requireCpuDecisionModuleOrNull('./cpu-decision-plan-pressure');
const CpuDecisionMovePlanModule = requireCpuDecisionModuleOrNull('./cpu-decision-move-plan');
const CpuDecisionCardContextModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-context');
const CpuDecisionCardRiskModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-risk');
const CpuDecisionCardLearnedModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-learned');
const CpuDecisionCardChoiceModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-choice');
const CpuDecisionMoveSelectionModule = requireCpuDecisionModuleOrNull('./cpu-decision-move-selection');
const CpuDecisionPendingActionsModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-actions');
const CpuDecisionPendingScoreModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-score');
const CpuDecisionPendingOnnxModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-onnx');
const CpuDecisionOnnxMoveModule = requireCpuDecisionModuleOrNull('./cpu-decision-onnx-move');
const CpuDecisionActionModule = requireCpuDecisionModuleOrNull('./cpu-decision-action');
const CpuDecisionPlacementPriorityModule = requireCpuDecisionModuleOrNull('./cpu-decision-placement-priority');
const CpuDecisionPublicApiModule = requireCpuDecisionModuleOrNull('./cpu-decision-public-api');
const CpuDecisionCardActionsModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-actions');
const CpuDecisionCardPipelineModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-pipeline');
const CpuDecisionPendingPipelineModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-pipeline');
const CpuDecisionSelectionFlowModule = requireCpuDecisionModuleOrNull('./cpu-decision-selection-flow');
const CpuDecisionControllerEvents = requireCpuDecisionModuleOrNull('./controller-events');

const CPU_POLICY_BOARD_MARKER_PRIMITIVE_METHODS = [
    'getBoardCellValueSafe',
    'countAdjacentCellsByValue',
    'getMarkerPriorityValue',
    'getTimedMarkerProfileAt',
    'getMarkerProfileAt'
];

function requireCpuPolicyBoardMarkerPrimitives(): any {
    const missingMethod = CPU_POLICY_BOARD_MARKER_PRIMITIVE_METHODS.find((methodName) => (
        !CpuPolicyBoardMarkerPrimitives || typeof CpuPolicyBoardMarkerPrimitives[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`[cpu-decision] CpuPolicyBoardMarkerPrimitives.${missingMethod} is required`);
    }
    return CpuPolicyBoardMarkerPrimitives;
}

const CpuPolicyBoardMarkerPrimitivesRequired = requireCpuPolicyBoardMarkerPrimitives();

const CPU_POLICY_PLACEMENT_FILTER_METHODS = [
    'filterLv6OpenCornerAdjacentMoves',
    'filterMovesByLv6PlacementPriority',
    'isCloneSplitEligibleSource',
    'filterCloneSplitTargetsForLv6'
];

function requireCpuPolicyPlacementFilters(): any {
    const missingMethod = CPU_POLICY_PLACEMENT_FILTER_METHODS.find((methodName) => (
        !CpuPolicyPlacementFilters || typeof CpuPolicyPlacementFilters[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`[cpu-decision] CpuPolicyPlacementFilters.${missingMethod} is required`);
    }
    return CpuPolicyPlacementFilters;
}

const CpuPolicyPlacementFiltersRequired = requireCpuPolicyPlacementFilters();

const CPU_POLICY_PENDING_TARGET_METHODS = [
    'getCornerProximity',
    'getForcedCornerLaneBonus',
    'getForcedCornerLaneAntiPatternPenalty',
    'simulatePendingPlacementBoard',
    'choosePendingTargetWithPolicy',
    'buildPendingTargetOnnxContext',
    'choosePendingTargetWithPolicyAsync'
];

function requireCpuPolicyPendingTargets(): any {
    const missingMethod = CPU_POLICY_PENDING_TARGET_METHODS.find((methodName) => (
        !CpuPolicyPendingTargets || typeof CpuPolicyPendingTargets[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`[cpu-decision] CpuPolicyPendingTargets.${missingMethod} is required`);
    }
    return CpuPolicyPendingTargets;
}

const CpuPolicyPendingTargetsRequired = requireCpuPolicyPendingTargets();

const CPU_POLICY_TIME_BOMB_TARGET_METHODS = [
    'scoreTimeBombTarget',
    'chooseTimeBombTargetWithPolicy'
];

function requireCpuPolicyTimeBombTargets(): any {
    const missingMethod = CPU_POLICY_TIME_BOMB_TARGET_METHODS.find((methodName) => (
        !CpuPolicyTimeBombTargets || typeof CpuPolicyTimeBombTargets[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`[cpu-decision] CpuPolicyTimeBombTargets.${missingMethod} is required`);
    }
    return CpuPolicyTimeBombTargets;
}

const CpuPolicyTimeBombTargetsRequired = requireCpuPolicyTimeBombTargets();

function requireCpuDecisionAction(): any {
    if (!CpuDecisionActionModule || typeof CpuDecisionActionModule.computeCpuActionWithPolicy !== 'function') {
        throw new Error('[cpu-decision] CpuDecisionAction.computeCpuActionWithPolicy is required');
    }
    return CpuDecisionActionModule;
}

const CpuDecisionActionRequired = requireCpuDecisionAction();

const CpuDecisionBoardUtils = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.createCpuDecisionBoardUtils === 'function')
    ? CpuDecisionBoardUtilsModule.createCpuDecisionBoardUtils({ sharedBoardUtils: CpuDecisionSharedBoardUtils })
    : (() => { throw new Error('CpuDecisionBoardUtils is required by cpu-decision'); })();

const countBoardEmpties = CpuDecisionBoardUtils.countBoardEmpties;
const isStandardBoard8x8 = CpuDecisionBoardUtils.isStandardBoard8x8;
const isCornerCell = CpuDecisionBoardUtils.isCornerCell;
const isEdgeCell = CpuDecisionBoardUtils.isEdgeCell;

function isPlayableBoard(board: any): any {
    if (!Array.isArray(board) || board.length <= 0) return false;
    for (const row of board) {
        if (!Array.isArray(row) || row.length <= 0) return false;
    }
    return true;
}

function getShapeAwareBoard(board: any, gameStateOverride: any, cardStateOverride: any): any {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (!Array.isArray(board) || !boardUtils || typeof boardUtils.attachBoardShape !== 'function') {
        return board;
    }
    try {
        boardUtils.attachBoardShape(board, {
            boardExpansion: gameStateOverride && gameStateOverride.boardExpansion,
            cardState: cardStateOverride || null
        });
    } catch (e) { /* ignore */ }
    return board;
}

function getCurrentCpuBoard(): any {
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    return (gs && Array.isArray(gs.board))
        ? getShapeAwareBoard(gs.board, gs, cs)
        : null;
}

/**
 * Intentional product gate:
 * learned CPU routes (policy-table / ONNX / 8x8 teacher-aligned paths) stay standard-8x8 only.
 * Custom boards must fall back to the safe non-learned CPU path.
 */
function canUseStandardBoardCpuPolicy(boardRef: any, featureKey: any, playerKey: any, level: any): any {
    const board = boardRef || getCurrentCpuBoard();
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const supported = capabilityModule && typeof capabilityModule.isStandardBoardCpuPolicyCompatible === 'function'
        ? capabilityModule.isStandardBoardCpuPolicyCompatible(board)
        : isStandardBoard8x8(board);
    if (!supported) {
        const tag = String(featureKey || 'cpu-policy');
        const levelLabel = Number.isFinite(level) ? `Lv${level}` : 'Lv?';
        const actorLabel = String(playerKey || '').trim() || 'cpu';
        cpuDebugLog(
            `[CPU] ${levelLabel} ${actorLabel}: ${tag} は標準8x8専用の学習済みCPU経路のため無効化し、安全な通常判断へフォールバック`
        );
    }
    return supported;
}

function countPlayableCells(board: any): any {
    if (!Array.isArray(board)) return 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function') {
        return boardUtils.collectBoardCoordinates(board).length;
    }
    let total = 0;
    for (const row of board) total += Array.isArray(row) ? row.length : 0;
    return total;
}

function getBoardCellValue(board: any, row: any, col: any): any {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.getCellValue === 'function') {
        return boardUtils.getCellValue(board, row, col);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return null;
    return board[row][col];
}

function setBoardCellValue(board: any, row: any, col: any, value: any): any {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.setCellValue === 'function') {
        return boardUtils.setCellValue(board, row, col, value);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row]) || col < 0 || col >= board[row].length) return false;
    board[row][col] = value;
    return true;
}

function getBoardBonusValueAt(row: any, col: any): any {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    return CpuDecisionBoardUtils.getBoardBonusValueAt(row, col, cs);
}

const countCornerControl = CpuDecisionBoardUtils.countCornerControl;
const countEdgeControl = CpuDecisionBoardUtils.countEdgeControl;

function isRecoveryCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerRecoveryCardType === 'function') {
        try { return CpuPolicyCore.isCornerRecoveryCardType(type) === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function isHoldCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerHoldCardType === 'function') {
        try { return CpuPolicyCore.isCornerHoldCardType(type) === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function isChargeRampCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isChargeRampCardType === 'function') {
        try { return CpuPolicyCore.isChargeRampCardType(type) === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function resolveCardType(cardId: any, cardDef: any): any {
    const logic = (typeof CardLogic !== 'undefined') ? CardLogic : null;
    return CpuDecisionBoardUtils.resolveCardType(cardId, cardDef, logic);
}

const WHITE_LV6_CORNER_SWING_KEEP_TYPES = new Set([
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL'
]);

function resolvePolicyTableRuntime(): any {
    const globalModule = readRuntimeModule('CpuPolicyTableRuntime');
    if (
        globalModule &&
        (
            typeof globalModule.chooseMove === 'function' ||
            typeof globalModule.getActionScoreForKey === 'function'
        )
    ) {
        CpuPolicyTableRuntime = globalModule;
        return globalModule;
    }
    const resolvedModule = resolveModuleReference(CpuPolicyTableRuntime, {
        globalKey: 'CpuPolicyTableRuntime',
        isValid: (moduleRef: any) => !!(
            moduleRef &&
            (
                typeof moduleRef.chooseMove === 'function' ||
                typeof moduleRef.getActionScoreForKey === 'function'
            )
        )
    });
    if (resolvedModule) CpuPolicyTableRuntime = resolvedModule;
    return resolvedModule;
}

function resolvePolicyOnnxRuntime(): any {
    const globalModule = readRuntimeModule('CpuPolicyOnnxRuntime');
    if (
        globalModule &&
        (
            typeof globalModule.chooseMove === 'function' ||
            typeof globalModule.choosePendingTarget === 'function' ||
            typeof globalModule.evaluatePosition === 'function'
        )
    ) {
        CpuPolicyOnnxRuntime = globalModule;
        return globalModule;
    }
    const resolvedModule = resolveModuleReference(CpuPolicyOnnxRuntime, {
        globalKey: 'CpuPolicyOnnxRuntime',
        isValid: (moduleRef: any) => !!(
            moduleRef &&
            (
                typeof moduleRef.chooseMove === 'function' ||
                typeof moduleRef.choosePendingTarget === 'function' ||
                typeof moduleRef.evaluatePosition === 'function'
            )
        )
    });
    if (resolvedModule) CpuPolicyOnnxRuntime = resolvedModule;
    return resolvedModule;
}

function resolveOthelloBrowserCpuRuntime(): any {
    const globalModule = readRuntimeModule('OthelloBrowserCpuRuntime');
    if (globalModule && typeof globalModule.chooseMove === 'function') {
        OthelloBrowserCpuRuntime = globalModule;
        return globalModule;
    }
    const resolvedModule = resolveModuleReference(OthelloBrowserCpuRuntime, {
        globalKey: 'OthelloBrowserCpuRuntime',
        isValid: (moduleRef: any) => !!(
            moduleRef &&
            typeof moduleRef.chooseMove === 'function'
        )
    });
    if (resolvedModule) OthelloBrowserCpuRuntime = resolvedModule;
    return resolvedModule;
}

function resolveCpuDecisionMatchMode(): string {
    if (CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.resolveCpuDecisionMatchMode === 'function') {
        return CpuDecisionRuntimeBoundary.resolveCpuDecisionMatchMode();
    }
    return '';
}

function isOthelloModeForCpuDecision(): boolean {
    if (CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.isOthelloModeForCpuDecision === 'function') {
        return CpuDecisionRuntimeBoundary.isOthelloModeForCpuDecision();
    }
    return false;
}

function resolveOthelloOnnxRuntime(): any {
    const globalModule = readRuntimeModule('OthelloOnnxRuntime');
    if (globalModule && typeof globalModule.chooseMove === 'function') {
        OthelloOnnxRuntime = globalModule;
        return globalModule;
    }
    const resolvedModule = resolveModuleReference(OthelloOnnxRuntime, {
        requirePath: './ai/othello-onnx-runtime',
        globalKey: 'OthelloOnnxRuntime',
        isValid: (moduleRef: any) => !!(
            moduleRef &&
            typeof moduleRef.chooseMove === 'function'
        )
    });
    if (resolvedModule) OthelloOnnxRuntime = resolvedModule;
    return resolvedModule;
}

function shouldUseOthelloOnnxRuntime(): boolean {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().readDebugFlag === 'function' && getCpuDecisionRuntime().readDebugFlag('CPU_DISABLE_OTHELLO_ONNX') === true) return false;
    } catch (e) { /* ignore */ }
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().readDebugFlag === 'function' && getCpuDecisionRuntime().readDebugFlag('CPU_FORCE_OTHELLO_ONNX') === true) return true;
    } catch (e) { /* ignore */ }
    try {
        const qs = readCpuDecisionQuerySearch();
        if (/[?&]othelloOnnx=(?:0|false)\b/i.test(qs) || /[?&]othello_onnx=(?:0|false)\b/i.test(qs)) return false;
        if (/[?&]othelloOnnx=(?:1|true)\b/i.test(qs) || /[?&]othello_onnx=(?:1|true)\b/i.test(qs)) return true;
    } catch (e) {
        return true;
    }
    return true;
}

function resolveCpuLv6RuntimeCapabilityModule(): any {
    const resolvedModule = resolveModuleReference(CpuLv6RuntimeCapabilityModule, {
        globalKey: 'CpuLv6RuntimeCapability',
        isValid: (moduleRef: any) => !!(
            moduleRef &&
            typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function'
        )
    });
    if (resolvedModule) CpuLv6RuntimeCapabilityModule = resolvedModule;
    return resolvedModule;
}

function resolvePendingType(playerKey: any): any {
    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getPendingEffectType === 'function') {
            return CardLogic.getPendingEffectType(cardState, playerKey);
        }
    } catch (e) { /* ignore */ }
    try {
        const pending = readCpuPendingEffect(playerKey);
        return pending && pending.type ? pending.type : null;
    } catch (e) { /* ignore */ }
    return null;
}

function getHandCardIdsForPlayer(playerKey: any): any {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const hand = (cs && cs.hands && Array.isArray(cs.hands[playerKey]))
        ? cs.hands[playerKey]
        : [];
    return hand.slice();
}

function getDeckMetricsForPlayer(playerKey: any): any {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const legacyDeckCount = (cs && cs.deck && Number.isFinite(cs.deck.length))
        ? cs.deck.length
        : 0;
    const ownDeckCount = (cs && cs.decks && Array.isArray(cs.decks[playerKey]))
        ? cs.decks[playerKey].length
        : (legacyDeckCount > 0 ? legacyDeckCount : null);
    const initialDeckSizeByPlayer = (cs && cs.initialDeckSizeByPlayer && typeof cs.initialDeckSizeByPlayer === 'object')
        ? cs.initialDeckSizeByPlayer
        : null;
    const initialDeckSize = initialDeckSizeByPlayer && Number.isFinite(initialDeckSizeByPlayer[playerKey])
        ? initialDeckSizeByPlayer[playerKey]
        : ((cs && Number.isFinite(cs.initialDeckSize)) ? cs.initialDeckSize : ownDeckCount);
    return {
        legacyDeckCount,
        ownDeckCount,
        initialDeckSize
    };
}

function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any): any {
    if (CpuDecisionCardContext && typeof CpuDecisionCardContext.buildOnnxContext === 'function') {
        return CpuDecisionCardContext.buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, usableCardIds, candidateMoves);
    }
    return {
        playerKey,
        level,
        board: null,
        pendingType: null,
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        ownCharge: 0,
        oppCharge: 0,
        deckCount: 0,
        ownDeckCount: 0,
        initialDeckSize: 0,
        boardBonusByCell: null,
        boardBonusConsumedByCell: null,
        handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : [],
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null,
        candidateMoves: [],
        ownCornersBefore: 0,
        oppCornersBefore: 0,
        ownEdgesBefore: 0,
        oppEdgesBefore: 0,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: false,
        cornerHoldMode: false,
        maxLegalMoveBonus: 0,
        highBonusMoveAvailable: false
    };
}

function selectMoveFromLearnedPolicy(candidateMoves: any, playerKey: any, level: any): any {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    try {
        const boardRef = getCurrentCpuBoard();
        if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-move', playerKey, level)) return null;
        return runtime.chooseMove(candidateMoves, {
            playerKey,
            level,
            board: boardRef,
            pendingType: resolvePendingType(playerKey),
            legalMovesCount: candidateMoves.length
        });
    } catch (e) {
        console.warn('[CPU] policy-table runtime failed, fallback to default policy', e);
        return null;
    }
}

function selectMoveFromOthelloPolicy(candidateMoves: any, playerKey: any, level: any, options?: any): any {
    const forceEnabled = !!(options && options.forceEnabled === true);
    if ((!isOthelloModeForCpuDecision() && !forceEnabled) || !Number.isFinite(level) || level < 6) return null;
    if (shouldUseOthelloOnnxRuntime()) {
        const onnxRuntime = resolveOthelloOnnxRuntime();
        try {
            const boardRef = getCurrentCpuBoard();
            if (onnxRuntime && typeof onnxRuntime.chooseMove === 'function' && canUseStandardBoardCpuPolicy(boardRef, 'othello-onnx-move', playerKey, level)) {
                const status = (typeof onnxRuntime.getStatus === 'function') ? onnxRuntime.getStatus() : null;
                if (status && status.loaded === true) {
                    const selected = onnxRuntime.chooseMove(candidateMoves, {
                        playerKey,
                        level,
                        board: boardRef,
                        legalMovesCount: candidateMoves.length
                    });
                    if (selected && typeof selected.then !== 'function') return selected;
                }
            }
        } catch (e) {
            console.warn('[CPU] othello ONNX runtime failed, fallback to table/default policy', e);
        }
    }
    const runtime = resolveOthelloBrowserCpuRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    try {
        const boardRef = getCurrentCpuBoard();
        if (!canUseStandardBoardCpuPolicy(boardRef, 'othello-policy-table-move', playerKey, level)) return null;
        const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
        if (!status || status.loaded !== true || status.valueLoaded !== true) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: リバーシ専用モデル未ロードのため通常判断へフォールバック`);
            return null;
        }
        return runtime.chooseMove(candidateMoves, {
            playerKey,
            level,
            board: boardRef
        });
    } catch (e) {
        console.warn('[CPU] othello runtime failed, fallback to default policy', e);
        return null;
    }
}

function createLearnedScoreFn(playerKey: any, level: any, legalMovesCount: any): any {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScore !== 'function') return null;
    const boardRef = getCurrentCpuBoard();
    if (!canUseStandardBoardCpuPolicy(boardRef, 'policy-table-score', playerKey, level)) return null;
    return function scoreMove(move: any) {
        try {
            const s = runtime.getActionScore(move, {
                playerKey,
                level,
                board: boardRef,
                pendingType: resolvePendingType(playerKey),
                legalMovesCount
            });
            return Number.isFinite(s) ? s : 0;
        } catch (e) {
            return 0;
        }
    };
}

function createLookaheadPriorScoreFn(playerKey: any, level: any, legalMovesCount: any, onnxSelectedMove: any): any {
    const learnedScoreFn = createLearnedScoreFn(playerKey, level, legalMovesCount);
    return function priorScore(move: any) {
        let score = 0;
        if (learnedScoreFn) {
            const learned = Number(learnedScoreFn(move) || 0);
            if (Number.isFinite(learned) && learned !== 0) {
                score += Math.sign(learned) * Math.log1p(Math.abs(learned)) * 180;
            }
        }
        if (onnxSelectedMove && isSameMoveByCoord(move, onnxSelectedMove)) {
            score += 1100;
        }
        return score;
    };
}

function resolveCpuLv6SharedProfile(): any {
    try {
        if (
            getCpuDecisionRuntime() &&
            typeof getCpuDecisionRuntime().getCpuLv6SharedProfile === 'function'
        ) {
            const profile = getCpuDecisionRuntime().getCpuLv6SharedProfile();
            if (profile && typeof profile === 'object') return profile;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const loaded = _require('../constants/cpu-lv6-shared-profile.js');
            if (loaded && typeof loaded === 'object') return loaded;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuLv6BrowserProfile(): any {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6BrowserProfile === 'function') {
        return capabilityModule.resolveCpuLv6BrowserProfile(shared);
    }
    if (shared && shared.browser && typeof shared.browser === 'object') return shared.browser;
    return null;
}

function resolveCpuLv6LookaheadWeights(): any {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6LookaheadWeights === 'function') {
        return capabilityModule.resolveCpuLv6LookaheadWeights(shared);
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const weightConfig = browserProfile && browserProfile.lookaheadWeights && typeof browserProfile.lookaheadWeights === 'object'
        ? browserProfile.lookaheadWeights
        : null;
    return {
        onnxRefinePriorWeight: Number(weightConfig && weightConfig.onnxRefinePriorWeight) || 66,
        policyLookaheadPriorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
        searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8
    };
}

function resolveCpuCurrentTurnNumber(): any {
    const turnNumber = Number(gameState && gameState.turnNumber);
    if (Number.isFinite(turnNumber)) return Math.max(1, Math.floor(turnNumber) + 1);

    const turnIndex = Number(cardState && cardState.turnIndex);
    if (Number.isFinite(turnIndex)) return Math.max(1, Math.floor(turnIndex) + 1);

    return null;
}

function resolveCpuLv6OnnxRuntimeGuardOverrides(): any {
    try {
        if (
            getCpuDecisionRuntime() &&
            typeof getCpuDecisionRuntime().readCpuLv6OnnxRuntimeGuard === 'function'
        ) {
            const guard = getCpuDecisionRuntime().readCpuLv6OnnxRuntimeGuard();
            if (guard && typeof guard === 'object') return guard;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readLegacyPendingSelectionBudgetMs(): any {
    try {
        if (
            getCpuDecisionRuntime() &&
            typeof getCpuDecisionRuntime().readCpuLv6PendingSelectionBudgetMs === 'function'
        ) {
            return Number(getCpuDecisionRuntime().readCpuLv6PendingSelectionBudgetMs());
        }
    } catch (e) { /* ignore */ }
    return NaN;
}

function resolveCpuLv6BrowserRuntimeCapability(): any {
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (!capabilityModule || typeof capabilityModule.resolveCpuLv6BrowserRuntimeCapability !== 'function') return null;
    return capabilityModule.resolveCpuLv6BrowserRuntimeCapability(shared, {
        guardOverrides: resolveCpuLv6OnnxRuntimeGuardOverrides(),
        legacyPendingSelectionBudgetMs: readLegacyPendingSelectionBudgetMs()
    });
}

function resolveCpuLv6OnnxRuntimeGuard(): any {
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability && capability.onnxRuntimeGuard && typeof capability.onnxRuntimeGuard === 'object') {
        return capability.onnxRuntimeGuard;
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configured = browserProfile && browserProfile.onnxRuntimeGuard && typeof browserProfile.onnxRuntimeGuard === 'object'
        ? browserProfile.onnxRuntimeGuard
        : null;
    const overrides = resolveCpuLv6OnnxRuntimeGuardOverrides();
    const readNumber = (key: any, fallback: any) => {
        const overrideValue = Number(overrides && overrides[key]);
        if (Number.isFinite(overrideValue)) return overrideValue;
        const configuredValue = Number(configured && configured[key]);
        if (Number.isFinite(configuredValue)) return configuredValue;
        return fallback;
    };

    const legacyPendingBudgetMs = readLegacyPendingSelectionBudgetMs();
    const pendingSelectionBudgetMs = Number.isFinite(legacyPendingBudgetMs) && legacyPendingBudgetMs > 0
        ? legacyPendingBudgetMs
        : readNumber('pendingSelectionBudgetMs', Number(browserProfile && browserProfile.pendingSelectionOnnxMaxMs) || 120);

    return {
        minSamples: Math.max(1, Math.floor(readNumber('minSamples', 4))),
        maxAverageLatencyMs: Math.max(0, readNumber('maxAverageLatencyMs', 0)),
        maxP95LatencyMs: Math.max(0, readNumber('maxP95LatencyMs', 0)),
        maxMaxLatencyMs: Math.max(0, readNumber('maxMaxLatencyMs', 0)),
        moveBudgetMs: Math.max(0, Math.floor(readNumber('moveBudgetMs', 0))),
        pendingSelectionBudgetMs: Math.max(0, Math.floor(pendingSelectionBudgetMs))
    };
}

function resolveCpuLv6OnnxRuntimeBudgetMs(level: any, operationKey: any): any {
    if (!Number.isFinite(level) || level < 6) return 0;
    const guard = resolveCpuLv6OnnxRuntimeGuard();
    if (!guard) return 0;
    if (operationKey === 'chooseMove') return guard.moveBudgetMs;
    if (operationKey === 'choosePendingTarget') return guard.pendingSelectionBudgetMs;
    return 0;
}

function formatCpuOnnxLatencyGateReason(operationKey: any, sourceLabel: any, bucket: any, guard: any): any {
    const parts = [];
    const averageMs = Number(bucket && bucket.averageMs);
    const p95Ms = Number(bucket && bucket.p95Ms);
    const maxMs = Number(bucket && bucket.maxMs);
    if (guard.maxAverageLatencyMs > 0 && Number.isFinite(averageMs) && averageMs > guard.maxAverageLatencyMs) {
        parts.push(`avg=${averageMs.toFixed(1)}>${guard.maxAverageLatencyMs}`);
    }
    if (guard.maxP95LatencyMs > 0 && Number.isFinite(p95Ms) && p95Ms > guard.maxP95LatencyMs) {
        parts.push(`p95=${p95Ms.toFixed(1)}>${guard.maxP95LatencyMs}`);
    }
    if (guard.maxMaxLatencyMs > 0 && Number.isFinite(maxMs) && maxMs > guard.maxMaxLatencyMs) {
        parts.push(`max=${maxMs.toFixed(1)}>${guard.maxMaxLatencyMs}`);
    }
    return `${operationKey}:${sourceLabel}:${parts.join(',')}`;
}

function evaluateCpuOnnxLatencyGate(runtime: any, operationKey: any, level: any): any {
    if (!runtime || typeof runtime.getStatus !== 'function') return { shouldDegrade: false, reason: '' };
    if (!Number.isFinite(level) || level < 6) return { shouldDegrade: false, reason: '' };

    const guard = resolveCpuLv6OnnxRuntimeGuard();
    const thresholdEnabled = !!(
        guard && (
            guard.maxAverageLatencyMs > 0 ||
            guard.maxP95LatencyMs > 0 ||
            guard.maxMaxLatencyMs > 0
        )
    );
    if (!thresholdEnabled) return { shouldDegrade: false, reason: '' };

    const status = runtime.getStatus() || {};
    const latency = status && status.latency && typeof status.latency === 'object' ? status.latency : null;
    if (!latency) return { shouldDegrade: false, reason: '' };

    const buckets = [];
    const operationBucket = latency.perOperation && latency.perOperation[operationKey];
    if (operationBucket && Number(operationBucket.count) >= guard.minSamples) {
        buckets.push({ label: operationKey, bucket: operationBucket });
    }
    if (latency.overall && Number(latency.overall.count) >= guard.minSamples) {
        buckets.push({ label: 'overall', bucket: latency.overall });
    }

    for (const one of buckets) {
        const bucket = one.bucket;
        if (!bucket) continue;
        const averageMs = Number(bucket.averageMs);
        const p95Ms = Number(bucket.p95Ms);
        const maxMs = Number(bucket.maxMs);
        const exceeded = (
            (guard.maxAverageLatencyMs > 0 && Number.isFinite(averageMs) && averageMs > guard.maxAverageLatencyMs) ||
            (guard.maxP95LatencyMs > 0 && Number.isFinite(p95Ms) && p95Ms > guard.maxP95LatencyMs) ||
            (guard.maxMaxLatencyMs > 0 && Number.isFinite(maxMs) && maxMs > guard.maxMaxLatencyMs)
        );
        if (exceeded) {
            return {
                shouldDegrade: true,
                reason: formatCpuOnnxLatencyGateReason(operationKey, one.label, bucket, guard)
            };
        }
    }

    return { shouldDegrade: false, reason: '' };
}

function logCpuOnnxLatencyDegrade(level: any, playerKey: any, operationKey: any, reason: any): any {
    cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: ONNX縮退 ${operationKey}${reason ? ` ${reason}` : ''}`
    );
}

let cpuExecutionMode = 'browser';
function setCpuExecutionMode(mode: any): any { cpuExecutionMode = mode === 'headless' ? 'headless' : 'browser'; }

function setCpuDecisionRuntime(runtime: any): any {
    if (CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.setCpuDecisionRuntime === 'function') {
        CpuDecisionRuntimeBoundary.setCpuDecisionRuntime(runtime);
    }
}

function readCpuDecisionQuerySearch(): string {
    if (CpuDecisionRuntimeBoundary && typeof CpuDecisionRuntimeBoundary.readCpuDecisionQuerySearch === 'function') {
        return CpuDecisionRuntimeBoundary.readCpuDecisionQuerySearch();
    }
    return '';
}

function emitCpuDecisionBoardUpdate(): any {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().emitBoardUpdate === 'function') {
            getCpuDecisionRuntime().emitBoardUpdate();
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuDecisionControllerEvents && typeof CpuDecisionControllerEvents.emitBoardUpdate === 'function') {
            return CpuDecisionControllerEvents.emitBoardUpdate({ source: 'cpu-decision' });
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuDecisionCardStateChange(): any {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().emitCardStateChange === 'function') {
            getCpuDecisionRuntime().emitCardStateChange();
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuDecisionControllerEvents && typeof CpuDecisionControllerEvents.emitCardStateChange === 'function') {
            return CpuDecisionControllerEvents.emitCardStateChange({ source: 'cpu-decision' });
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuDecisionGameStateChange(): any {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().emitGameStateChange === 'function') {
            getCpuDecisionRuntime().emitGameStateChange();
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuDecisionControllerEvents && typeof CpuDecisionControllerEvents.emitGameStateChange === 'function') {
            return CpuDecisionControllerEvents.emitGameStateChange();
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuDecisionLogAdded(message: any, kind?: string): any {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().emitLogAdded === 'function') {
            if (typeof kind === 'undefined') {
                getCpuDecisionRuntime().emitLogAdded(message);
            } else {
                getCpuDecisionRuntime().emitLogAdded(message, kind);
            }
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuDecisionControllerEvents && typeof CpuDecisionControllerEvents.emitLogAdded === 'function') {
            CpuDecisionControllerEvents.emitLogAdded(message, kind);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuDecisionEffectLog(message: any): any {
    try {
        if (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().emitEffectLog === 'function') {
            getCpuDecisionRuntime().emitEffectLog(message);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuDecisionControllerEvents && typeof CpuDecisionControllerEvents.emitEffectLog === 'function') {
            CpuDecisionControllerEvents.emitEffectLog(message);
            return true;
        }
    } catch (e) { /* ignore */ }
    return emitCpuDecisionLogAdded(message, 'effect');
}

let cpuTimerService: any = null;
function setCpuTimerService(service: any): any { cpuTimerService = service; }
function getCpuTimerService(): any {
    return cpuTimerService || null;
}

const CpuDecisionSelectionFlow = (CpuDecisionSelectionFlowModule && typeof CpuDecisionSelectionFlowModule.createCpuDecisionSelectionFlow === 'function')
    ? CpuDecisionSelectionFlowModule.createCpuDecisionSelectionFlow({
        getRuntime: () => getCpuDecisionRuntime(),
        getNetworkTurnHandoff: () => cpuDecisionNetworkTurnHandoff,
        getTimerService: () => getCpuTimerService(),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        resolvePlayerKeyFromTurnValue: (value: any) => resolvePlayerKeyFromTurnValue(value),
        isSelectionOnlyEndTurnPendingType: (pendingType: any) => isSelectionOnlyEndTurnPendingType(pendingType),
        resolvePendingSelectionFlow: (requiredFunctionName: any) => resolvePendingSelectionFlow(requiredFunctionName),
        readLegacyProcessCpuTurn: () => {
            try {
                return (typeof processCpuTurn === 'function') ? processCpuTurn : null;
            } catch (e) { /* ignore */ }
            return null;
        },
        emitBoardUpdate: () => emitCpuDecisionBoardUpdate()
    })
    : null;

const CpuDecisionPendingPipeline = (CpuDecisionPendingPipelineModule && typeof CpuDecisionPendingPipelineModule.createCpuDecisionPendingPipeline === 'function')
    ? CpuDecisionPendingPipelineModule.createCpuDecisionPendingPipeline({
        readRuntimeModule,
        resolveModuleReference,
        readTurnPipelineAdapterLocal: () => (typeof TurnPipelineUIAdapter !== 'undefined' ? TurnPipelineUIAdapter : null),
        readTurnPipelineLocal: () => (typeof TurnPipeline !== 'undefined' ? TurnPipeline : null),
        resolvePendingSelectionFlow: (requiredFunctionName: any) => resolvePendingSelectionFlow(requiredFunctionName),
        createPlaceAction: (playerKey: any, actionPayload: any) => ((typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, actionPayload)
            : Object.assign({ type: 'place' }, actionPayload)),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        setCardState: (nextCardState: any) => { cardState = nextCardState; },
        setGameState: (nextGameState: any) => { gameState = nextGameState; },
        emitPresentationEventForCpu: (event: any) => emitPresentationEventForCpu(event),
        emitCpuSelectionStateChange: () => emitCpuSelectionStateChange(),
        finalizeCpuPendingSelectionFlow: (playerKey: any, pendingType: any, playbackEvents: any, action: any) => finalizeCpuPendingSelectionFlow(playerKey, pendingType, playbackEvents, action)
    })
    : null;

const CpuDecisionCardPipeline = (CpuDecisionCardPipelineModule && typeof CpuDecisionCardPipelineModule.createCpuDecisionCardPipeline === 'function')
    ? CpuDecisionCardPipelineModule.createCpuDecisionCardPipeline({
        resolveTurnPipelineAdapter,
        resolveTurnPipeline,
        createAction: (actionType: any, playerKey: any, actionPayload: any) => ((typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction(actionType, playerKey, actionPayload)
            : Object.assign({ type: actionType }, actionPayload)),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        setCardState: (nextCardState: any) => { cardState = nextCardState; },
        setGameState: (nextGameState: any) => { gameState = nextGameState; },
        getLastUsedCardId: (playerKey: any) => (cardState && cardState.lastUsedCardByPlayer ? cardState.lastUsedCardByPlayer[playerKey] : null),
        resolveCardDef: (cardId: any, fallbackCardDef: any) => ((typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? (CardLogic.getCardDef(cardId) || fallbackCardDef || null)
            : (fallbackCardDef || null)),
        emitPresentationEventForCpu: (event: any) => emitPresentationEventForCpu(event),
        emitCpuSelectionStateChange: () => emitCpuSelectionStateChange()
    })
    : null;

const CpuDecisionCardActions = (CpuDecisionCardActionsModule && typeof CpuDecisionCardActionsModule.createCpuDecisionCardActions === 'function')
    ? CpuDecisionCardActionsModule.createCpuDecisionCardActions({
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        resolveCardLogic: () => resolveCardLogicForCpuDecision(),
        readPendingEffect: (playerKey: any) => readCpuPendingEffect(playerKey),
        resolveCpuSmartnessLevel: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
        readCardUseDisplayLevel: (playerKey: any) => resolveCpuDecisionLevelForPlayer(playerKey),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getActiveProtectionForPlayer: (playerValue: any) => ((typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(playerValue) : []),
        getFlipBlockers: () => ((typeof getFlipBlockers === 'function') ? getFlipBlockers() : []),
        getLegalMoves: (gameStateValue: any, protection: any, perma: any) => ((typeof getLegalMoves === 'function') ? (getLegalMoves(gameStateValue, protection, perma) || []) : []),
        getTargetAwareCardUsabilityAnalysis: (playerKey: any) => getTargetAwareCardUsabilityAnalysis(playerKey),
        getTargetAwareUsableCardIds: (playerKey: any) => getTargetAwareUsableCardIds(playerKey),
        buildCardUseDecisionContext: (
            playerKey: any,
            level: any,
            legalMovesCount: any,
            legalMoves: any,
            usableCardIds: any,
            performanceScope?: CpuTurnPerformanceScope | null
        ) => buildCardUseDecisionContext(
            playerKey,
            level,
            legalMovesCount,
            legalMoves,
            usableCardIds,
            performanceScope
        ),
        chooseHandDestroyTargetForCycle: (hand: any, usableCardIds: any, getCardCost: any, getCardDef: any, decisionContext: any) => (
            CpuPolicyCore && typeof CpuPolicyCore.chooseHandDestroyTargetForCycle === 'function'
                ? CpuPolicyCore.chooseHandDestroyTargetForCycle(hand, usableCardIds, getCardCost, getCardDef, decisionContext)
                : null
        ),
        runCpuHandDestroyViaPipeline: (playerKey: any, destroyCardId: any) => runCpuHandDestroyViaPipeline(playerKey, destroyCardId),
        runCpuCardUseViaPipeline: (
            playerKey: any,
            cardId: any,
            cardDef: any,
            performanceScope?: CpuTurnPerformanceScope | null
        ) => runCpuCardUseViaPipeline(playerKey, cardId, cardDef, performanceScope),
        resolveTurnPipelineUIAdapter: () => resolveTurnPipelineAdapter(),
        getRuntime: () => getCpuDecisionRuntime(),
        emitCpuSelectionStateChange: () => emitCpuSelectionStateChange(),
        emitCardStateChange: () => emitCpuDecisionCardStateChange(),
        emitBoardUpdate: () => emitCpuDecisionBoardUpdate(),
        emitLogAdded: (...args: any[]) => emitCpuDecisionLogAdded(args[0], args[1]),
        emitPresentationEventForCpu: (event: any) => emitPresentationEventForCpu(event),
        emitCpuCardUseLog: (playerKey: any, level: any, cardDefOrNull: any, cardIdOrNull: any) => emitCpuCardUseLog(playerKey, level, cardDefOrNull, cardIdOrNull),
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        isOthelloModeForCpuDecision: () => isOthelloModeForCpuDecision(),
        selectCardDecision: (playerKey: any, performanceScope?: CpuTurnPerformanceScope | null, prepared?: any) => selectCardDecision(playerKey, performanceScope, prepared),
        selectCardToUse: (playerKey: any, performanceScope?: CpuTurnPerformanceScope | null) => selectCardToUse(playerKey, performanceScope),
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

function resolveLv6LookaheadTimeCaps(playerKey: any): any {
    const isWhite = String(playerKey || '') === 'white';
    const isBrowserUi = cpuExecutionMode !== 'headless';
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    const shared = resolveCpuLv6SharedProfile();
    if (capabilityModule && typeof capabilityModule.resolveCpuLv6LookaheadTimeCaps === 'function') {
        const resolved = capabilityModule.resolveCpuLv6LookaheadTimeCaps(shared, {
            playerKey,
            isBrowserUi
        });
        if (resolved) return resolved;
    }
    const browserProfile = resolveCpuLv6BrowserProfile();
    const configuredCaps = browserProfile && browserProfile.lookaheadTimeCaps && typeof browserProfile.lookaheadTimeCaps === 'object'
        ? browserProfile.lookaheadTimeCaps
        : null;
    if (configuredCaps) {
        if (isWhite && isBrowserUi && configuredCaps.whiteUi) return configuredCaps.whiteUi;
        if (isWhite && configuredCaps.whiteHeadless) return configuredCaps.whiteHeadless;
        if (configuredCaps.black) return configuredCaps.black;
    }
    if (isWhite && isBrowserUi) {
        return {
            moveCapMs: 1100,
            endgameCapMs: 1600,
            quiescenceMoveCapMs: 900,
            quiescenceEndgameCapMs: 1500,
            quiescenceEndgameMinMs: 700
        };
    }
    if (isWhite) {
        return {
            moveCapMs: 900,
            endgameCapMs: 1300,
            quiescenceMoveCapMs: 750,
            quiescenceEndgameCapMs: 1200,
            quiescenceEndgameMinMs: 600
        };
    }
    return {
        moveCapMs: 1000,
        endgameCapMs: 1500,
        quiescenceMoveCapMs: 800,
        quiescenceEndgameCapMs: 1400,
        quiescenceEndgameMinMs: 700
    };
}

function createLookaheadMetaLogger(playerKey: any, level: any, phaseLabel: any): any {
    if (!Number.isFinite(level) || level < 6) return null;
    if (typeof cpuDebugLog !== 'function') return null;
    return function onSearchMeta(meta: any) {
        if (!meta || typeof meta !== 'object') return;
        const depth = Number.isFinite(meta.depth) ? Number(meta.depth) : 'n/a';
        const branch = Number.isFinite(meta.branchLimit) ? Number(meta.branchLimit) : 'all';
        const nodes = Number.isFinite(meta.nodeBudget) ? Number(meta.nodeBudget) : 'n/a';
        const timeMs = Number.isFinite(meta.timeBudgetMs) ? Number(meta.timeBudgetMs) : 'n/a';
        const endgame = meta.endgameMode === true;
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey} ${phaseLabel}: depth=${depth} branch=${branch} nodes=${nodes} timeMs=${timeMs} endgame=${endgame}`
        );
    };
}

function buildLv6LookaheadOptions(level: any, board: any, legalMovesCount: any, playerKey: any): any {
    if (!Number.isFinite(level) || level < 6) return {};
    const empties = countBoardEmpties(board);
    const moves = Math.max(1, Number(legalMovesCount) || 1);
    const totalCells = Array.isArray(board)
        ? board.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0)
        : 0;
    const safeTotalCells = totalCells > 0 ? totalCells : 64;
    const occupiedRatio = Math.max(0, Math.min(1, 1 - (empties / safeTotalCells)));
    const sizeScale = Math.max(0.75, Math.min(1.8, Math.sqrt(safeTotalCells / 64)));
    const movePressure = Math.max(0.9, Math.min(1.5, (moves / 8)));
    const browserProfile = resolveCpuLv6BrowserProfile();
    const stageConfig = browserProfile && browserProfile.lookaheadStages && typeof browserProfile.lookaheadStages === 'object'
        ? browserProfile.lookaheadStages
        : null;
    const openingStage = stageConfig && stageConfig.opening ? stageConfig.opening : null;
    const midStage = stageConfig && stageConfig.mid ? stageConfig.mid : null;
    const endStage = stageConfig && stageConfig.end ? stageConfig.end : null;
    const selectedStage = (
        openingStage && occupiedRatio < Number(openingStage.maxOccupiedRatio)
    )
        ? openingStage
        : (
            midStage && occupiedRatio < Number(midStage.maxOccupiedRatio)
                ? midStage
                : endStage
        );
    const lowBranch = moves <= 4;
    let depth = Number(selectedStage && selectedStage.depth);
    if (!Number.isFinite(depth) || depth <= 0) {
        depth = occupiedRatio < 0.28 ? 4 : (occupiedRatio < 0.62 ? 5 : 6);
    }
    if (lowBranch) depth += 1;
    const maxBranchBase = Number(selectedStage && selectedStage.maxBranch);
    const maxBranch = Math.min(
        Number.isFinite(maxBranchBase) && maxBranchBase > 0 ? maxBranchBase : (occupiedRatio < 0.28 ? 6 : (occupiedRatio < 0.62 ? 7 : 8)),
        moves
    );
    const nodeBudgetBase = Number(selectedStage && selectedStage.nodeBudgetBase);
    const resolvedNodeBudgetBase = Number.isFinite(nodeBudgetBase) && nodeBudgetBase > 0
        ? nodeBudgetBase
        : (occupiedRatio < 0.28 ? 900_000 : (occupiedRatio < 0.62 ? 1_500_000 : 2_200_000));
    const maxTimeBase = Number(selectedStage && selectedStage.maxTimeBaseMs);
    const resolvedMaxTimeBase = Number.isFinite(maxTimeBase) && maxTimeBase > 0
        ? maxTimeBase
        : (occupiedRatio < 0.28 ? 900 : (occupiedRatio < 0.62 ? 1_100 : 1_500));
    const nodeBudget = Math.floor(resolvedNodeBudgetBase * sizeScale);
    const timeCaps = resolveLv6LookaheadTimeCaps(playerKey);
    const maxTimeMs = Math.min(
        Math.floor(resolvedMaxTimeBase * sizeScale * movePressure),
        timeCaps.moveCapMs
    );
    const endgameConfig = browserProfile && browserProfile.endgameLookahead && typeof browserProfile.endgameLookahead === 'object'
        ? browserProfile.endgameLookahead
        : null;
    const endgameSolveEmpties = occupiedRatio < 0.55
        ? Number(endgameConfig && endgameConfig.solveEmptiesOpeningMid) || 16
        : Number(endgameConfig && endgameConfig.solveEmptiesEnd) || 20;
    const endgameDepth = occupiedRatio < 0.55
        ? Number(endgameConfig && endgameConfig.depthOpeningMid) || 12
        : Number(endgameConfig && endgameConfig.depthEnd) || 16;
    const endgameNodeBudgetBase = Number(endgameConfig && endgameConfig.nodeBudgetBase);
    const endgameMaxTimeBase = Number(endgameConfig && endgameConfig.maxTimeBaseMs);

    return {
        depth,
        maxBranch,
        nodeBudget,
        maxTimeMs,
        endgameSolveEmpties,
        endgameDepth,
        endgameNodeBudget: Math.floor((Number.isFinite(endgameNodeBudgetBase) && endgameNodeBudgetBase > 0 ? endgameNodeBudgetBase : 64_000_000) * sizeScale),
        endgameMaxTimeMs: Math.min(
            Math.floor((Number.isFinite(endgameMaxTimeBase) && endgameMaxTimeBase > 0 ? endgameMaxTimeBase : 120_000) * sizeScale),
            timeCaps.endgameCapMs
        ),
    };
}

function selectMoveByLookahead(candidateMoves: any, playerKey: any, level: any, onnxSelectedMove: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return null;
    if (!CpuPolicyCore || typeof CpuPolicyCore.chooseMoveByLookahead !== 'function') return null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const board = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    if (!isPlayableBoard(board)) return null;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const priorScore = createLookaheadPriorScoreFn(playerKey, level, candidateMoves.length, onnxSelectedMove);
    const lv6Lookahead = buildLv6LookaheadOptions(level, board, candidateMoves.length, playerKey);
    const onSearchMeta = createLookaheadMetaLogger(playerKey, level, 'onnx-lookahead');
    const weightConfig = resolveCpuLv6LookaheadWeights();

    return CpuPolicyCore.chooseMoveByLookahead(candidateMoves, {
        board,
        playerValue,
        level,
        depth: lv6Lookahead.depth,
        maxBranch: lv6Lookahead.maxBranch,
        nodeBudget: lv6Lookahead.nodeBudget,
        scoreMove: priorScore,
        priorWeight: level >= 6 ? (Number(weightConfig && weightConfig.onnxRefinePriorWeight) || 66) : 82,
        searchWeight: level >= 6 ? (Number(weightConfig && weightConfig.searchWeight) || 1.8) : 1,
        endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
        endgameDepth: lv6Lookahead.endgameDepth || 16,
        endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
        maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
        endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600,
        onSearchMeta,
        boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
            ? cs.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
            ? cs.boardBonusConsumedByCell
            : null
    });
}

const CpuDecisionOnnxMove = (CpuDecisionOnnxMoveModule && typeof CpuDecisionOnnxMoveModule.createCpuDecisionOnnxMove === 'function')
    ? CpuDecisionOnnxMoveModule.createCpuDecisionOnnxMove({
        getCurrentCpuBoard,
        resolvePendingType,
        shouldUseOthelloOnnxRuntime,
        shouldForceCardModeLv6Placement,
        isOthelloModeForCpuDecision,
        resolveOthelloOnnxRuntime,
        resolvePolicyOnnxRuntime,
        canUseStandardBoardCpuPolicy,
        filterMovesByLv6PlacementPriority,
        filterLv6OpenCornerAdjacentMoves,
        evaluateCpuOnnxLatencyGate,
        logCpuOnnxLatencyDegrade,
        resolveCpuLv6OnnxRuntimeBudgetMs,
        awaitCpuPromiseWithinBudget,
        getCpuOnnxBudgetTimeout: () => CPU_ONNX_BUDGET_TIMEOUT,
        buildOnnxContext,
        getHandCardIdsForPlayer,
        resolveCandidateMoveByCoord,
        refineOnnxMoveByTacticalPlan,
        selectMoveByLookahead,
        isSameMoveByCoord,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

async function selectMoveFromOnnxPolicyAsync(candidateMoves: any, playerKey: any, level: any): Promise<any> {
    return CpuDecisionOnnxMove && typeof CpuDecisionOnnxMove.selectMoveFromOnnxPolicyAsync === 'function'
        ? CpuDecisionOnnxMove.selectMoveFromOnnxPolicyAsync(candidateMoves, playerKey, level)
        : null;
}

function shouldForceCardModeLv6Placement(playerKey: any, pendingType: any, boardRef: any): any {
    if (!playerKey) return false;
    const mode = resolveCpuDecisionMatchMode();
    if (mode !== 'cpu') return false;
    if (pendingType) return false;
    const board = boardRef || getCurrentCpuBoard();
    if (!isPlayableBoard(board)) return false;
    return canUseStandardBoardCpuPolicy(board, 'card-cpu-lv6-placement', playerKey, 6);
}

function isSameMoveByCoord(a: any, b: any): any {
    if (!a || !b) return false;
    return Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
}

function resolveCandidateMoveByCoord(candidateMoves: any, move: any): any {
    if (!Array.isArray(candidateMoves) || !move) return null;
    for (const one of candidateMoves) {
        if (isSameMoveByCoord(one, move)) return one;
    }
    return null;
}

function refineOnnxMoveByTacticalPlan(candidateMoves: any, selectedMove: any, playerKey: any, level: any): any {
    if (!selectedMove) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1) return selectedMove;
    if (!Number.isFinite(level) || level < 6) return selectedMove;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') return selectedMove;

    const context = buildMovePlanContext(playerKey, level, candidateMoves);
    if (!context) return resolveCandidateMoveByCoord(candidateMoves, selectedMove) || selectedMove;

    const selected = resolveCandidateMoveByCoord(candidateMoves, selectedMove) || selectedMove;
    let selectedScore = Number.NEGATIVE_INFINITY;
    try {
        selectedScore = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(selected, context) || 0);
    } catch (e) {
        selectedScore = Number.NEGATIVE_INFINITY;
    }

    let bestMove: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const move of candidateMoves) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            score = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, context) || 0);
        } catch (e) {
            score = Number.NEGATIVE_INFINITY;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
            continue;
        }
        if (score === bestScore && bestMove) {
            const bestRow = Number(bestMove.row);
            const bestCol = Number(bestMove.col);
            const row = Number(move.row);
            const col = Number(move.col);
            if (row < bestRow || (row === bestRow && col < bestCol)) {
                bestMove = move;
            }
        }
    }
    if (!bestMove) return selected;
    if (isSameMoveByCoord(bestMove, selected)) return selected;

    const gap = bestScore - selectedScore;
    const boardRef = context && Array.isArray(context.board) ? context.board : null;
    const selectedCorner = isCornerCell(selected.row, selected.col, boardRef);
    const bestCorner = isCornerCell(bestMove.row, bestMove.col, boardRef);
    const selectedEdge = !selectedCorner && isEdgeCell(selected.row, selected.col, boardRef);
    const bestEdge = !bestCorner && isEdgeCell(bestMove.row, bestMove.col, boardRef);
    const playerValue = Number(context && context.playerValue);
    const cornerStats = Number.isFinite(playerValue)
        ? countCornerControl(boardRef, playerValue)
        : { ownCorners: 0, oppCorners: 0 };
    const cornerLead = Number(cornerStats.ownCorners || 0) - Number(cornerStats.oppCorners || 0);

    const cornerOverride = bestCorner && !selectedCorner;
    const edgeConsolidationOverride = bestEdge && !selectedEdge && cornerLead > 0 && gap >= 180;
    const tacticalOverride = gap >= 700;
    if (cornerOverride || edgeConsolidationOverride || tacticalOverride) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: ONNX手を戦術補正 (${selected.row},${selected.col}) -> (${bestMove.row},${bestMove.col}) gap=${Number.isFinite(gap) ? gap.toFixed(1) : 'NA'}`
        );
        return bestMove;
    }
    return selected;
}

function shouldUseSharedPolicyTableCoreCardDecisionLocal(level: any): any {
    if (!Number.isFinite(level) || level < 6) return false;
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability) return capability.usesPolicyTableCoreCardDecision === true;
    return true;
}

function shouldUseSharedPolicyTableCoreCardDecision(level: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.shouldUseSharedPolicyTableCoreCardDecision === 'function'
        ? CpuDecisionCardLearned.shouldUseSharedPolicyTableCoreCardDecision(level)
        : shouldUseSharedPolicyTableCoreCardDecisionLocal(level);
}

function createCardChoiceFromId(cardId: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.createCardChoiceFromId === 'function'
        ? CpuDecisionCardLearned.createCardChoiceFromId(cardId)
        : null;
}

function selectCardBySharedPolicyTableCore(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.selectCardBySharedPolicyTableCore === 'function'
        ? CpuDecisionCardLearned.selectCardBySharedPolicyTableCore(playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext)
        : null;
}

function selectCardByLevel6Consensus(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.selectCardByLevel6Consensus === 'function'
        ? CpuDecisionCardLearned.selectCardByLevel6Consensus(playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext)
        : null;
}

function emitPresentationEventForCpu(ev: any): any {
    try {
        if (typeof require === 'function') {
            const pres = _require('./logic/presentation');
            if (pres && typeof pres.emitPresentationEvent === 'function') {
                return !!pres.emitPresentationEvent(cardState, ev);
            }
        }
    } catch (e) { /* ignore */ }
    try {
        // Last-resort persistence so PresentationHandler can consume on next BOARD_UPDATED.
        if (cardState && typeof cardState === 'object') {
            if (!Array.isArray(cardState._presentationEventsPersist)) {
                cardState._presentationEventsPersist = [];
            }
            cardState._presentationEventsPersist.push(ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuSelectionStateChange(): any {
    emitCpuDecisionCardStateChange();
    emitCpuDecisionBoardUpdate();
    emitCpuDecisionGameStateChange();
}

function isSelectionOnlyEndTurnPendingType(pendingType: any): any {
    const pendingSelectionFlow = resolvePendingSelectionFlow('isSelectionOnlyEndTurnPendingType');
    return !!(
        pendingSelectionFlow
        && typeof pendingSelectionFlow.isSelectionOnlyEndTurnPendingType === 'function'
        && pendingSelectionFlow.isSelectionOnlyEndTurnPendingType(pendingType)
    );
}

function resolvePlayerKeyFromTurnValue(value: any): any {
    if (value === 'black' || value === 1 || value === '1' || (typeof BLACK !== 'undefined' && value === BLACK)) return 'black';
    if (value === 'white' || value === -1 || value === '-1' || (typeof WHITE !== 'undefined' && value === WHITE)) return 'white';
    return null;
}

function handOffSelectionTurnInGameState(playerKey: any): any {
    if (!gameState) return false;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const turnNumberBeforeSelection = Number(gameState.turnNumber || 0);
    if (
        gameState.currentPlayer === 1 ||
        gameState.currentPlayer === -1 ||
        gameState.currentPlayer === '1' ||
        gameState.currentPlayer === '-1'
    ) {
        gameState.currentPlayer = opponentKey === 'black' ? 1 : -1;
    } else {
        gameState.currentPlayer = opponentKey;
    }
    gameState.consecutivePasses = 0;
    gameState.turnNumber = turnNumberBeforeSelection + 1;
    return true;
}

function captureNetworkPublishSnapshot(gameStateValue: any, cardStateValue: any): any {
    if (cpuDecisionNetworkTurnHandoff && typeof cpuDecisionNetworkTurnHandoff.captureNetworkPublishSnapshot === 'function') {
        return cpuDecisionNetworkTurnHandoff.captureNetworkPublishSnapshot(gameStateValue, cardStateValue);
    }
    if (!gameStateValue || !cardStateValue) return null;
    try {
        return {
            gameState: JSON.parse(JSON.stringify(gameStateValue)),
            cardState: JSON.parse(JSON.stringify(cardStateValue))
        };
    } catch (e) {
        return null;
    }
}

function publishCpuSelectionNetworkSnapshot(playerKey: any, action: any, playbackEvents: any, snapshotOverride?: any): any {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.publishCpuSelectionNetworkSnapshot === 'function') {
        return CpuDecisionSelectionFlow.publishCpuSelectionNetworkSnapshot(playerKey, action, playbackEvents, snapshotOverride);
    }
    return undefined;
}

function readCpuDecisionMatchMode(): any {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.readCpuDecisionMatchMode === 'function') {
        return CpuDecisionSelectionFlow.readCpuDecisionMatchMode();
    }
    return null;
}

function readCpuDecisionHumanVsHumanFlag(): boolean {
    return !!(CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.readCpuDecisionHumanVsHumanFlag === 'function'
        ? CpuDecisionSelectionFlow.readCpuDecisionHumanVsHumanFlag()
        : false);
}

function resolveCpuDecisionProcessCpuTurn(): any {
    return CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.resolveCpuDecisionProcessCpuTurn === 'function'
        ? CpuDecisionSelectionFlow.resolveCpuDecisionProcessCpuTurn()
        : null;
}

function isCpuSelectionHumanVsHumanModeEnabled(): any {
    return !!(CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.isCpuSelectionHumanVsHumanModeEnabled === 'function'
        ? CpuDecisionSelectionFlow.isCpuSelectionHumanVsHumanModeEnabled()
        : false);
}

async function waitForCpuSelectionPlaybackIdle(playbackEvents: any): Promise<any> {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.waitForCpuSelectionPlaybackIdle === 'function') {
        return CpuDecisionSelectionFlow.waitForCpuSelectionPlaybackIdle(playbackEvents);
    }
}

function scheduleCpuSelectionWhiteTurn(delayMs: any, expectedTurnNumber: any): any {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.scheduleCpuSelectionWhiteTurn === 'function') {
        return CpuDecisionSelectionFlow.scheduleCpuSelectionWhiteTurn(delayMs, expectedTurnNumber);
    }
}

async function continueCpuSelectionTurnHandoff(playerKey: any, playbackEvents: any, action: any): Promise<any> {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.continueCpuSelectionTurnHandoff === 'function') {
        return CpuDecisionSelectionFlow.continueCpuSelectionTurnHandoff(playerKey, playbackEvents, action);
    }
}

function maybeContinueCpuSelectionTurnHandoff(playerKey: any, pendingType: any, playbackEvents: any, action?: any): any {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.maybeContinueCpuSelectionTurnHandoff === 'function') {
        return CpuDecisionSelectionFlow.maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, playbackEvents, action);
    }
}

function finalizeCpuPendingSelectionFlow(playerKey: any, pendingType: any, playbackEvents: any, action: any): any {
    if (CpuDecisionSelectionFlow && typeof CpuDecisionSelectionFlow.finalizeCpuPendingSelectionFlow === 'function') {
        return CpuDecisionSelectionFlow.finalizeCpuPendingSelectionFlow(playerKey, pendingType, playbackEvents, action);
    }
    return Promise.resolve();
}

function resolveTurnPipelineAdapter(): any {
    if (CpuDecisionPendingPipeline && typeof CpuDecisionPendingPipeline.resolveTurnPipelineAdapter === 'function') {
        return CpuDecisionPendingPipeline.resolveTurnPipelineAdapter();
    }
    return null;
}

function resolveTurnPipeline(): any {
    if (CpuDecisionPendingPipeline && typeof CpuDecisionPendingPipeline.resolveTurnPipeline === 'function') {
        return CpuDecisionPendingPipeline.resolveTurnPipeline();
    }
    return null;
}

async function runCpuPendingSelectionViaPipeline(playerKey: any, actionPayload: any, pendingType: any): Promise<any> {
    if (CpuDecisionPendingPipeline && typeof CpuDecisionPendingPipeline.runCpuPendingSelectionViaPipeline === 'function') {
        return CpuDecisionPendingPipeline.runCpuPendingSelectionViaPipeline(playerKey, actionPayload, pendingType);
    }
    return null;
}

function isCpuPendingPipelineHandled(result: any): boolean {
    return !!(result && result.ok === true);
}

function resolveAppliedCardMeta(playerKey: any, fallbackCardId: any, fallbackCardDef: any): any {
    if (CpuDecisionCardPipeline && typeof CpuDecisionCardPipeline.resolveAppliedCardMeta === 'function') {
        return CpuDecisionCardPipeline.resolveAppliedCardMeta(playerKey, fallbackCardId, fallbackCardDef);
    }
    const appliedCardDef = fallbackCardDef || null;
    return {
        appliedCardId: fallbackCardId,
        appliedCardDef,
        appliedCardCost: (appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null,
        appliedCardName: (appliedCardDef && appliedCardDef.name) ? appliedCardDef.name : null
    };
}

function normalizeCardUsePlaybackEvents(playbackEvents: any, playerKey: any, cardMeta: any): any {
    if (CpuDecisionCardPipeline && typeof CpuDecisionCardPipeline.normalizeCardUsePlaybackEvents === 'function') {
        return CpuDecisionCardPipeline.normalizeCardUsePlaybackEvents(playbackEvents, playerKey, cardMeta);
    }
    return Array.isArray(playbackEvents) ? playbackEvents : [];
}

function emitCpuCardUseLog(playerKey: any, level: any, cardDefOrNull: any, cardIdOrNull: any): any {
    const shownName = cardDefOrNull ? cardDefOrNull.name : cardIdOrNull;
    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用 - ${shownName}`);
    emitCpuDecisionLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})がカードを使用: ${shownName}`);
}

function runCpuCardUseViaPipeline(
    playerKey: any,
    cardId: any,
    cardDef: any,
    performanceScope?: CpuTurnPerformanceScope | null
): any {
    if (CpuDecisionCardPipeline && typeof CpuDecisionCardPipeline.runCpuCardUseViaPipeline === 'function') {
        return performanceScope
            ? CpuDecisionCardPipeline.runCpuCardUseViaPipeline(playerKey, cardId, cardDef, performanceScope)
            : CpuDecisionCardPipeline.runCpuCardUseViaPipeline(playerKey, cardId, cardDef);
    }
    return null;
}

function runCpuHandDestroyViaPipeline(playerKey: any, destroyCardId: any): any {
    if (CpuDecisionCardPipeline && typeof CpuDecisionCardPipeline.runCpuHandDestroyViaPipeline === 'function') {
        return CpuDecisionCardPipeline.runCpuHandDestroyViaPipeline(playerKey, destroyCardId);
    }
    return null;
}

function emitCpuEffectLog(message: any): any {
    if (!message) return;
    emitCpuDecisionEffectLog(message);
}

function buildFallbackCardUsabilityAnalysis(playerKey: any, usableCardIds: any, cardLogicRef: any): any {
    const ids = Array.isArray(usableCardIds) ? usableCardIds.slice() : [];
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const hand = cs && cs.hands && Array.isArray(cs.hands[playerKey]) ? cs.hands[playerKey] : [];
    const copyIds = cs && cs._handCopyIdsByPlayer && Array.isArray(cs._handCopyIdsByPlayer[playerKey])
        ? cs._handCopyIdsByPlayer[playerKey]
        : [];
    const consumedIndexes = new Set<number>();
    const usableCardTypes: string[] = [];
    const usableSlots: any[] = [];
    for (const cardId of ids) {
        let handIndex = hand.findIndex((one: any, index: number) => !consumedIndexes.has(index) && one === cardId);
        if (handIndex < 0) handIndex = hand.indexOf(cardId);
        if (handIndex >= 0) consumedIndexes.add(handIndex);
        const def = cardLogicRef && typeof cardLogicRef.getCardDef === 'function'
            ? cardLogicRef.getCardDef(cardId)
            : null;
        const cardType = String(def && def.type || '');
        const rawCopyId = Number(handIndex >= 0 ? copyIds[handIndex] : NaN);
        const cardCopyId = Number.isInteger(rawCopyId) && rawCopyId > 0 ? rawCopyId : null;
        usableCardTypes.push(cardType);
        usableSlots.push(Object.freeze({ cardId, cardType, handIndex, cardCopyId }));
    }
    return Object.freeze({
        usableCardIds: Object.freeze(ids),
        usableCardTypes: Object.freeze(usableCardTypes),
        selectorEvidence: Object.freeze({}),
        usableSlots: Object.freeze(usableSlots)
    });
}

function getTargetAwareCardUsabilityAnalysis(playerKey: any): any {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cardLogicRef = resolveCardLogicForCpuDecision();
    if (!cardLogicRef || !cs || !gs) return buildFallbackCardUsabilityAnalysis(playerKey, [], cardLogicRef);
    if (typeof cardLogicRef.analyzeCardUsability === 'function') {
        try {
            const analysis = cardLogicRef.analyzeCardUsability(cs, gs, playerKey);
            if (analysis && Array.isArray(analysis.usableCardIds)) return analysis;
        } catch (e) { /* preserve compatibility fallback */ }
    }
    if (typeof cardLogicRef.getUsableCardIds === 'function') {
        try {
            return buildFallbackCardUsabilityAnalysis(
                playerKey,
                cardLogicRef.getUsableCardIds(cs, gs, playerKey) || [],
                cardLogicRef
            );
        } catch (e) { /* ignore */ }
    }
    if (typeof cardLogicRef.hasUsableCard === 'function' && cardLogicRef.hasUsableCard(cs, gs, playerKey)) {
        // Fallback when only boolean API is available.
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        return buildFallbackCardUsabilityAnalysis(playerKey, hand, cardLogicRef);
    }
    if (typeof cardLogicRef.canUseCard === 'function') {
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        const usable = hand.filter((id: any) => {
            try { return !!cardLogicRef.canUseCard(cs, playerKey, id); } catch (e) { return false; }
        });
        return buildFallbackCardUsabilityAnalysis(playerKey, usable, cardLogicRef);
    }
    return buildFallbackCardUsabilityAnalysis(playerKey, [], cardLogicRef);
}

function getTargetAwareUsableCardIds(playerKey: any): any {
    return getTargetAwareCardUsabilityAnalysis(playerKey).usableCardIds.slice();
}

const makePlanPressureProfile = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.makePlanPressureProfile === 'function')
    ? CpuDecisionPlanPressureModule.makePlanPressureProfile
    : function makePlanPressureProfileFallback(basePressure: any, cornerWindowPressure: any, recoveryGapPressure: any, recoveryEmergencyPressure: any): any {
        return Object.freeze({
            basePressure: Math.max(0, Number(basePressure) || 0),
            cornerWindowPressure: Math.max(0, Number(cornerWindowPressure) || 0),
            recoveryGapPressure: Math.max(0, Number(recoveryGapPressure) || 0),
            recoveryEmergencyPressure: Math.max(0, Number(recoveryEmergencyPressure) || 0)
        });
    };

const getGeneratedThrowChainPlanPressureProfile = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.getGeneratedThrowChainPlanPressureProfile === 'function')
    ? CpuDecisionPlanPressureModule.getGeneratedThrowChainPlanPressureProfile
    : function getGeneratedThrowChainPlanPressureProfileFallback() { return null; };

const hasPlanPressureProfileForCardType = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.hasPlanPressureProfileForCardType === 'function')
    ? CpuDecisionPlanPressureModule.hasPlanPressureProfileForCardType
    : function hasPlanPressureProfileForCardTypeFallback() { return false; };

const getCardPlanPressureProfile = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.getCardPlanPressureProfile === 'function')
    ? CpuDecisionPlanPressureModule.getCardPlanPressureProfile
    : function getCardPlanPressureProfileFallback() { return null; };

const computeCardPlanPressure = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.computeCardPlanPressure === 'function')
    ? CpuDecisionPlanPressureModule.computeCardPlanPressure
    : function computeCardPlanPressureFallback() { return 0; };

const resolveCardPlanPressureThreshold = (CpuDecisionPlanPressureModule && typeof CpuDecisionPlanPressureModule.resolveCardPlanPressureThreshold === 'function')
    ? CpuDecisionPlanPressureModule.resolveCardPlanPressureThreshold
    : function resolveCardPlanPressureThresholdFallback(_legalMovesCount: any, _planState: any, profile: any): any {
        const activeProfile = profile || makePlanPressureProfile(0, 0, 0, 0);
        return activeProfile.basePressure;
    };

const CpuDecisionMovePlan = (CpuDecisionMovePlanModule && typeof CpuDecisionMovePlanModule.createCpuDecisionMovePlan === 'function')
    ? CpuDecisionMovePlanModule.createCpuDecisionMovePlan({
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCardLogic: () => ((typeof CardLogic !== 'undefined') ? CardLogic : null),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getShapeAwareBoard,
        isPlayableBoard,
        countCornerControl,
        isCornerCell,
        isEdgeCell,
        getBoardBonusValueAt,
        getHandCardIdsForPlayer,
        resolveCardType,
        isRecoveryCardType,
        isHoldCardType,
        keepCardTypesForLowCharge: WHITE_LV6_CORNER_SWING_KEEP_TYPES,
        getCardPlanPressureProfile,
        computeCardPlanPressure,
        resolveCardPlanPressureThreshold,
        readPendingEffect: (playerKey: any, stateRef?: any) => readCpuPendingEffect(playerKey, stateRef),
        resolvePendingType,
        countBoardStatsForPlayer,
        countPlayableCells,
        getTargetAwareUsableCardIds,
        getCpuPolicyCore: () => CpuPolicyCore,
        getCurrentCpuBoard: () => getCurrentCpuBoard(),
        onStrictPendingPlacementOverride: (playerKey: any, pendingType: any, bestAnchoredMove: any) => {
            const level = resolveCpuDecisionLevelForPlayer(playerKey);
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ${pendingType}配置を安定寄せへ補正 (${bestAnchoredMove.row}, ${bestAnchoredMove.col})`
            );
        }
    })
    : null;

const CpuDecisionCardContext = (CpuDecisionCardContextModule && typeof CpuDecisionCardContextModule.createCpuDecisionCardContext === 'function')
    ? CpuDecisionCardContextModule.createCpuDecisionCardContext({
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCardLogic: () => resolveCardLogicForCpuDecision(),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getShapeAwareBoard,
        countBoardStatsForPlayer,
        countCornerControl,
        countEdgeControl,
        buildCornerPlanState,
        getBoardBonusValueAt,
        getBoardCellValueSafe,
        getCpuPolicyCore: () => CpuPolicyCore,
        getDeckMetricsForPlayer,
        getHandCardIdsForPlayer,
        isCornerCell,
        isEdgeCell,
        resolvePendingType
    })
    : null;

const CpuDecisionCardRisk = (CpuDecisionCardRiskModule && typeof CpuDecisionCardRiskModule.createCpuDecisionCardRisk === 'function')
    ? CpuDecisionCardRiskModule.createCpuDecisionCardRisk({
        getCpuPolicyCore: () => CpuPolicyCore,
        getCardLogic: () => ((typeof CardLogic !== 'undefined') ? CardLogic : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) => buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds),
        getCurrentCpuBoard: () => getCurrentCpuBoard(),
        isPlayableBoard,
        buildLv6LookaheadOptions,
        resolveLv6LookaheadTimeCaps,
        createLookaheadMetaLogger,
        getBoardBonusValueAt,
        isCornerCell,
        isEdgeCell,
        applyMoveByFlipsForCpu,
        hasCornerMoveOnBoardForPlayer,
        resolveCardType
    })
    : null;

const CpuDecisionCardLearned = (CpuDecisionCardLearnedModule && typeof CpuDecisionCardLearnedModule.createCpuDecisionCardLearned === 'function')
    ? CpuDecisionCardLearnedModule.createCpuDecisionCardLearned({
        resolveCardLogic: () => resolveCardLogicForCpuDecision(),
        getCpuPolicyCore: () => CpuPolicyCore,
        buildCardUseDecisionContext,
        isCardChoiceAllowedByHighConfidence,
        shouldUseSharedPolicyTableCoreCardDecision: (level: any) => shouldUseSharedPolicyTableCoreCardDecisionLocal(level)
    })
    : null;

const CpuDecisionPendingScore = (CpuDecisionPendingScoreModule && typeof CpuDecisionPendingScoreModule.createCpuDecisionPendingScore === 'function')
    ? CpuDecisionPendingScoreModule.createCpuDecisionPendingScore({
        getCurrentCpuBoard,
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getBoardCellValueSafe,
        isCornerCell,
        isEdgeCell,
        countAdjacentCellsByValue,
        getBoardBonusValueAt,
        getMarkerProfileAt,
        getTimedMarkerProfileAt,
        scoreSeatStrategicValue,
        countBoardStatsForPlayer,
        getCornerProximity,
        getCpuSmartnessLevel: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCpuPolicyCore: () => CpuPolicyCore,
        buildMovePlanContext,
        simulatePendingPlacementBoard,
        getStrongWindLandingProfile,
        getForcedCornerLaneBonus,
        getForcedCornerLaneAntiPatternPenalty,
        isCloneSplitEligibleSource
    })
    : null;

const CpuDecisionPendingOnnx = (CpuDecisionPendingOnnxModule && typeof CpuDecisionPendingOnnxModule.createCpuDecisionPendingOnnx === 'function')
    ? CpuDecisionPendingOnnxModule.createCpuDecisionPendingOnnx({
        getHandCardIdsForPlayer,
        buildOnnxContext,
        resolveCurrentLegalMovesCountForPlayer,
        getCurrentCpuBoard,
        isPlayableBoard,
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        simulatePendingPlacementBoard,
        cloneBoardForCpu,
        setBoardCellValue,
        awaitCpuPromiseWithinBudget,
        getPendingSelectionOnnxTimeout: () => PENDING_SELECTION_ONNX_TIMEOUT,
        getPendingSelectionValueWeight: () => PENDING_SELECTION_VALUE_WEIGHT,
        resolveCandidateMoveByCoord,
        choosePendingTargetWithPolicy,
        isSameMoveByCoord,
        scorePendingTargetByType,
        getCpuSmartnessLevel: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
        resolvePolicyOnnxRuntime,
        canUseStandardBoardCpuPolicy,
        resolvePendingSelectionOnnxBudgetMs,
        evaluateCpuOnnxLatencyGate,
        logCpuOnnxLatencyDegrade,
        getCpuOnnxBudgetTimeout: () => CPU_ONNX_BUDGET_TIMEOUT,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

function buildCornerPlanState(playerKey: any, legalMoves: any, usableCardIds: any): any {
    if (CpuDecisionMovePlan && typeof CpuDecisionMovePlan.buildCornerPlanState === 'function') {
        return CpuDecisionMovePlan.buildCornerPlanState(playerKey, legalMoves, usableCardIds);
    }
    return {
        ownCorners: 0,
        oppCorners: 0,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: false,
        cornerHoldMode: false,
        recoveryReady: false,
        recoveryCostGap: 0,
        maxBoardBonusOnLegalMoves: 0,
        highBonusMoveAvailable: false
    };
}

function isCardChoiceAllowedByPlan(playerKey: any, level: any, legalMovesCount: any, cardId: any, cardDef: any, planState: any, decisionContext: any): any {
    if (CpuDecisionMovePlan && typeof CpuDecisionMovePlan.isCardChoiceAllowedByPlan === 'function') {
        return CpuDecisionMovePlan.isCardChoiceAllowedByPlan(playerKey, level, legalMovesCount, cardId, cardDef, planState, decisionContext);
    }
    return !!cardId;
}

function buildMovePlanContext(playerKey: any, level: any, candidateMoves: any): any {
    if (CpuDecisionMovePlan && typeof CpuDecisionMovePlan.buildMovePlanContext === 'function') {
        return CpuDecisionMovePlan.buildMovePlanContext(playerKey, level, candidateMoves);
    }
    return null;
}

function shouldRespectPendingPlacementPlanStrictly(pendingType: any): any {
    if (CpuDecisionMovePlan && typeof CpuDecisionMovePlan.shouldRespectPendingPlacementPlanStrictly === 'function') {
        return CpuDecisionMovePlan.shouldRespectPendingPlacementPlanStrictly(pendingType);
    }
    return false;
}

const CpuDecisionPlacementPriority = (CpuDecisionPlacementPriorityModule && typeof CpuDecisionPlacementPriorityModule.createCpuDecisionPlacementPriority === 'function')
    ? CpuDecisionPlacementPriorityModule.createCpuDecisionPlacementPriority({
        buildMovePlanContext,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        getBoardCellValueSafe,
        getCornerProximity,
        getCpuPolicyCore: () => CpuPolicyCore,
        getCurrentCpuBoard,
        getMoveOpponentSpecialFlipProfile,
        isCornerCell,
        isEdgeCell,
        resolvePendingType,
        shouldRespectPendingPlacementPlanStrictly
    })
    : null;

function maybeOverrideWithStrictPendingPlacement(selectedMove: any, candidateMoves: any, playerKey: any, movePlanScoreFn: any): any {
    if (CpuDecisionMovePlan && typeof CpuDecisionMovePlan.maybeOverrideWithStrictPendingPlacement === 'function') {
        return CpuDecisionMovePlan.maybeOverrideWithStrictPendingPlacement(selectedMove, candidateMoves, playerKey, movePlanScoreFn);
    }
    return selectedMove;
}

function countBoardStatsForPlayer(playerValue: any): any {
    const board = getCurrentCpuBoard();
    if (!Array.isArray(board)) {
        return { discDiff: 0, empties: 0 };
    }
    let own = 0;
    let opp = 0;
    let empties = 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    const cells = (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function')
        ? boardUtils.collectBoardCoordinates(board)
        : board.flatMap((row: any, r: any) => (Array.isArray(row) ? row.map((_: any, c: any) => ({ row: r, col: c })) : []));
    for (const cell of cells) {
        const v = getBoardCellValue(board, cell.row, cell.col);
        if (v === playerValue) own += 1;
        else if (v === -playerValue) opp += 1;
        else if (v === 0) empties += 1;
    }
    return { discDiff: own - opp, empties };
}

function buildCardUseDecisionContext(
    playerKey: any,
    level: any,
    legalMovesCount: any,
    legalMoves?: any,
    usableCardIds?: any,
    performanceScope?: CpuTurnPerformanceScope | null
): any {
    const normalizedUsableCardIds = Array.isArray(usableCardIds && usableCardIds.usableCardIds)
        ? usableCardIds.usableCardIds.slice()
        : (Array.isArray(usableCardIds) ? usableCardIds.slice() : []);
    if (CpuDecisionCardContext && typeof CpuDecisionCardContext.buildCardUseDecisionContext === 'function') {
        return CpuDecisionCardContext.buildCardUseDecisionContext(
            playerKey,
            level,
            legalMovesCount,
            legalMoves,
            usableCardIds,
            performanceScope
        );
    }
    return {
        level,
        whiteLv6Mode: level >= 6 && playerKey === 'white',
        playerValue: playerKey === 'black' ? 1 : -1,
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        discDiff: 0,
        empties: 0,
        ownCharge: 0,
        oppCharge: 0,
        oppHandSize: 0,
        handSize: 0,
        handCardIds: [],
        deckRemaining: null,
        hasDestroyedCardThisTurn: false,
        forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
        ownCorners: 0,
        oppCorners: 0,
        swapEnemyNormalCornerTargetCount: 0,
        temptHighValueTargetCount: 0,
        boardExpansionEnemyCornerTargetCount: 0,
        boardExpansionWillEnemyCornerTargetCount: 0,
        boardExpansionGodEnemyCornerTargetCount: 0,
        movementCornerSwingTargetCounts: {
            BUOYANCY_WILL: 0,
            GRAVITY_WILL: 0,
            SUPER_BUOYANCY_WILL: 0,
            SUPER_GRAVITY_WILL: 0,
            SUPER_ATTRACTION_WILL: 0
        },
        movementCornerSwingTargetCount: 0,
        ownEdges: 0,
        oppEdges: 0,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: false,
        cornerHoldMode: false,
        recoveryCostGap: 0,
        highBonusMoveAvailable: false,
        maxLegalFlips: 0,
        avgLegalFlips: 0,
        maxLegalGain: 0,
        maxLegalBoardBonus: 0,
        cloneSplitEligibleSourceCount: 0,
        ownSpecialCount: 0,
        oppSpecialCount: 0,
        ownBombCount: 0,
        massFreezeOwnTargetCount: 0,
        massFreezeOpponentTargetCount: 0,
        ownGuardCount: 0,
        oppGuardCount: 0,
        usableCardIds: normalizedUsableCardIds,
        cornerPlanState: buildCornerPlanState(playerKey, legalMoves, normalizedUsableCardIds)
    };
}

function cloneBoardForCpu(board: any): any {
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.cloneBoard === 'function') {
        return boardUtils.cloneBoard(board);
    }
    if (!Array.isArray(board)) return [];
    return board.map((row) => (Array.isArray(row) ? row.slice() : []));
}

function applyMoveByFlipsForCpu(board: any, move: any, playerValue: any): any {
    if (!Array.isArray(board) || !move) return null;
    const row = Number(move.row);
    const col = Number(move.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const next = cloneBoardForCpu(board);
    if (!setBoardCellValue(next, row, col, playerValue)) return null;
    const flips = Array.isArray(move.flips) ? move.flips : [];
    for (const one of flips) {
        const fr = Number(one && one.row);
        const fc = Number(one && one.col);
        if (!Number.isInteger(fr) || !Number.isInteger(fc)) continue;
        setBoardCellValue(next, fr, fc, playerValue);
    }
    return next;
}

function hasCornerMoveOnBoardForPlayer(board: any, playerValue: any): any {
    if (!Array.isArray(board)) return false;
    const boardUtils = resolveSharedBoardUtilsModule();
    if (boardUtils && typeof boardUtils.getLegalMovesBasic === 'function') {
        try {
            const legal = boardUtils.getLegalMovesBasic(board, playerValue) || [];
            return legal.some((m: any) => m && isCornerCell(Number(m.row), Number(m.col), board));
        } catch (e) {
            return false;
        }
    }
    if (typeof getLegalMoves !== 'function') return false;
    try {
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(playerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const simulated = { board, currentPlayer: playerValue };
        const legal = getLegalMoves(simulated, protection, perma) || [];
        return legal.some((m) => m && isCornerCell(Number(m.row), Number(m.col), board));
    } catch (e) {
        return false;
    }
}

function buildCardQuiescenceSnapshot(playerKey: any, level: any, legalMoves: any, context: any): any {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.buildCardQuiescenceSnapshot === 'function'
        ? CpuDecisionCardRisk.buildCardQuiescenceSnapshot(playerKey, policyLevel, legalMoves, context)
        : null;
}

function shouldBuildCardQuiescenceSnapshot(level: any, legalMoves: any, context: any, usableCardTypes?: any): boolean {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return !!(CpuDecisionCardRisk && typeof CpuDecisionCardRisk.shouldBuildCardQuiescenceSnapshot === 'function'
        ? CpuDecisionCardRisk.shouldBuildCardQuiescenceSnapshot(policyLevel, legalMoves, context, usableCardTypes)
        : true);
}

function prepareCardQuiescenceRequest(playerKey: any, level: any, legalMoves: any, context: any, identity: any): any {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.prepareCardQuiescenceRequest === 'function'
        ? CpuDecisionCardRisk.prepareCardQuiescenceRequest(playerKey, policyLevel, legalMoves, context, identity)
        : null;
}

function buildCardQuiescenceSnapshotFromBestMove(playerKey: any, context: any, bestMove: any): any {
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.buildCardQuiescenceSnapshotFromBestMove === 'function'
        ? CpuDecisionCardRisk.buildCardQuiescenceSnapshotFromBestMove(playerKey, context, bestMove)
        : null;
}

function shouldHoldCardByQuiescence(playerKey: any, level: any, cardId: any, cardDef: any, context: any, snapshot: any): any {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return !!(CpuDecisionCardRisk && typeof CpuDecisionCardRisk.shouldHoldCardByQuiescence === 'function'
        ? CpuDecisionCardRisk.shouldHoldCardByQuiescence(playerKey, policyLevel, cardId, cardDef, context, snapshot)
        : false);
}

function isCardChoiceAllowedByRisk(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.isCardChoiceAllowedByRisk === 'function'
        ? CpuDecisionCardRisk.isCardChoiceAllowedByRisk(playerKey, policyLevel, legalMovesCount, cardId, prebuiltContext)
        : !!cardId;
}

function isCardChoiceAllowedByHighConfidence(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.isCardChoiceAllowedByHighConfidence === 'function'
        ? CpuDecisionCardRisk.isCardChoiceAllowedByHighConfidence(playerKey, policyLevel, legalMovesCount, cardId, prebuiltContext)
        : !!cardId;
}

function _isCpuTrapOnlyModeEnabled(playerKey: any): any {
    try {
        const qs = readCpuDecisionQuerySearch();
        const debugEnabled =
            /[?&]debug=(1|true)\b/i.test(qs) ||
            (getCpuDecisionRuntime() && typeof getCpuDecisionRuntime().readDebugFlag === 'function' && getCpuDecisionRuntime().readDebugFlag('DEBUG_UNLIMITED_USAGE') === true);
        if (!debugEnabled) return false;
        const enabled = /[?&]cpuTrapOnly=(1|true)\b/i.test(qs);
        if (!enabled) return false;
        // Default target is white CPU (opponent from normal player perspective).
        const m = qs.match(/[?&]cpuTrapOnlyFor=([^&]+)/i);
        const raw = m && m[1] ? decodeURIComponent(m[1]).toLowerCase() : 'white';
        if (raw === 'all') return true;
        return raw === String(playerKey || '').toLowerCase();
    } catch (e) {
        return false;
    }
}

function _findTrapCardIdInCatalog(): any {
    try {
        const injectedDefs = (
            getCpuDecisionRuntime() &&
            typeof getCpuDecisionRuntime().getCardDefs === 'function'
        )
            ? getCpuDecisionRuntime().getCardDefs()
            : null;
        const defs = (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS))
            ? CARD_DEFS
            : (Array.isArray(injectedDefs) ? injectedDefs : []);
        const def = defs.find((c: any) => c && c.type === 'TRAP_WILL' && c.enabled !== false);
        return def ? def.id : null;
    } catch (e) {
        return null;
    }
}

function _prepareCpuTrapOnlyCard(playerKey: any): any {
    if (!_isCpuTrapOnlyModeEnabled(playerKey)) return null;
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;

    const hand = cardState.hands[playerKey];
    let trapId: any = null;
    for (const id of hand) {
        try {
            const def = CardLogic.getCardDef ? CardLogic.getCardDef(id) : null;
            if (def && def.type === 'TRAP_WILL') {
                trapId = id;
                break;
            }
        } catch (e) { /* ignore */ }
    }
    if (!trapId) {
        trapId = _findTrapCardIdInCatalog();
        if (!trapId) return null;
        // Debug-only convenience: ensure CPU always has trap card in hand.
        if (hand.length >= ((typeof HAND_LIMIT !== 'undefined') ? HAND_LIMIT : 5)) {
            hand.shift();
        }
        hand.push(trapId);
    }

    try {
        const cost = (typeof CardLogic.getCardCost === 'function') ? (CardLogic.getCardCost(trapId) || 0) : 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const curr = Number(cardState.charge[playerKey] || 0);
        if (curr < cost) cardState.charge[playerKey] = cost;
    } catch (e) { /* ignore */ }

    return trapId;
}

const CpuDecisionCardChoice = (CpuDecisionCardChoiceModule && typeof CpuDecisionCardChoiceModule.createCpuDecisionCardChoice === 'function')
    ? CpuDecisionCardChoiceModule.createCpuDecisionCardChoice({
        buildCardQuiescenceSnapshot,
        buildCardUseDecisionContext,
        buildCornerPlanState,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        getActiveProtectionForPlayer: (playerValue: any) => ((typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(playerValue) : null),
        getAISystem: () => ((typeof AISystem !== 'undefined') ? AISystem : null),
        getCardLogic: () => ((typeof CardLogic !== 'undefined') ? CardLogic : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCpuPolicyCore: () => CpuPolicyCore,
        getFlipBlockers: () => ((typeof getFlipBlockers === 'function') ? getFlipBlockers() : []),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getLegalMoves: (state: any, protection: any, perma: any) => ((typeof getLegalMoves === 'function') ? getLegalMoves(state, protection, perma) : []),
        getTargetAwareCardUsabilityAnalysis,
        getTargetAwareUsableCardIds,
        isAISystemAvailable,
        isCardChoiceAllowedByHighConfidence,
        isCardChoiceAllowedByPlan,
        isCardChoiceAllowedByRisk,
        prepareCpuTrapOnlyCard: (playerKey: any) => _prepareCpuTrapOnlyCard(playerKey),
        resolveCpuSmartnessLevel: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        selectCardByLevel6Consensus,
        selectCardBySharedPolicyTableCore,
        shouldBuildCardQuiescenceSnapshot,
        shouldHoldCardByQuiescence,
        shouldUseSharedPolicyTableCoreCardDecision,
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

/**
 * カード使用判定・実行
 * @param {string} playerKey - 'black' または 'white'
 */
/**
 * Decide which card (if any) the CPU should use.
 * Pure function: inspects global state and returns a candidate object { cardId, cardDef } or null.
 * This function does NOT apply the card usage side effects; use `applyCardChoice` for that.
 * @param {string} playerKey - 'black' or 'white'
 * @returns {{cardId:string,cardDef:object}|null}
 */
function selectCardToUse(playerKey: any, performanceScope?: CpuTurnPerformanceScope | null): any {
    if (CpuDecisionCardChoice && typeof CpuDecisionCardChoice.selectCardToUse === 'function') {
        return CpuDecisionCardChoice.selectCardToUse(playerKey, performanceScope);
    }
    return null;
}

function selectHandCardToDestroy(
    playerKey: any,
    performanceScope?: CpuTurnPerformanceScope | null,
    prepared?: any
): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.selectHandCardToDestroy === 'function') {
        return CpuDecisionCardActions.selectHandCardToDestroy(playerKey, performanceScope, prepared);
    }
    return null;
}

function applyHandCardDestroy(
    playerKey: any,
    destroyChoice: any,
    performanceScope?: CpuTurnPerformanceScope | null
): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.applyHandCardDestroy === 'function') {
        return CpuDecisionCardActions.applyHandCardDestroy(playerKey, destroyChoice, performanceScope);
    }
    return false;
}

function cpuMaybeDestroyHandCardWithPolicy(
    playerKey: any,
    performanceScope?: CpuTurnPerformanceScope | null,
    prepared?: any
): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.cpuMaybeDestroyHandCardWithPolicy === 'function') {
        return CpuDecisionCardActions.cpuMaybeDestroyHandCardWithPolicy(playerKey, performanceScope, prepared);
    }
    return false;
}

function playCpuCardUseHandAnimation(payload: any): void {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.playCpuCardUseHandAnimation === 'function') {
        CpuDecisionCardActions.playCpuCardUseHandAnimation(payload);
    }
}

/**
 * Apply a chosen card. Performs state changes and emits UI hooks.
 * Side-effectful: mutates cardState/gameState and triggers emitters.
 * Returns true on success, false if application failed or card not in hand.
 */
function applyCardChoice(
    playerKey: any,
    cardChoice: any,
    performanceScope?: CpuTurnPerformanceScope | null
): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.applyCardChoice === 'function') {
        return CpuDecisionCardActions.applyCardChoice(playerKey, cardChoice, performanceScope);
    }
    return false;
}

function cpuMaybeUseCardWithPolicy(
    playerKey: any,
    performanceScope?: CpuTurnPerformanceScope | null,
    prepared?: any
): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.cpuMaybeUseCardWithPolicy === 'function') {
        return CpuDecisionCardActions.cpuMaybeUseCardWithPolicy(playerKey, performanceScope, prepared);
    }
    return false;
}

const CpuDecisionMoveSelection = (CpuDecisionMoveSelectionModule && typeof CpuDecisionMoveSelectionModule.createCpuDecisionMoveSelection === 'function')
    ? CpuDecisionMoveSelectionModule.createCpuDecisionMoveSelection({
        buildLv6LookaheadOptions,
        buildMovePlanContext,
        choosePendingTargetWithPolicy,
        createLearnedScoreFn,
        createLookaheadMetaLogger,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        error: (...args: any[]) => console.error(...args),
        filterLv6OpenCornerAdjacentMoves,
        filterMovesByLv6PlacementPriority,
        getAISystem: () => ((typeof AISystem !== 'undefined') ? AISystem : null),
        getBoardBonusValueAt,
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCpuPolicyCore: () => CpuPolicyCore,
        getCpuRng: () => cpuRng,
        getCurrentCpuBoard,
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        isAISystemAvailable,
        isPlayableBoard,
        maybeOverrideWithStrictPendingPlacement,
        readCpuPendingEffect: (playerKey: any) => readCpuPendingEffect(playerKey),
        resolveCpuLv6LookaheadWeights,
        resolveCpuSmartnessLevel,
        resolvePendingType,
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        selectMoveFromLearnedPolicy,
        selectMoveFromOthelloPolicy,
        shouldForceCardModeLv6Placement,
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
function prepareCpuCandidateScoringRequest(candidateMoves: any, playerKey: any, identity: any): any {
    if (CpuDecisionMoveSelection && typeof CpuDecisionMoveSelection.prepareCpuCandidateScoringRequest === 'function') {
        return CpuDecisionMoveSelection.prepareCpuCandidateScoringRequest(candidateMoves, playerKey, identity);
    }
    return null;
}

function prepareCpuPlacementLookaheadRequest(candidateMoves: any, playerKey: any, identity: any): any {
    if (CpuDecisionMoveSelection && typeof CpuDecisionMoveSelection.prepareCpuPlacementLookaheadRequest === 'function') {
        return CpuDecisionMoveSelection.prepareCpuPlacementLookaheadRequest(candidateMoves, playerKey, identity);
    }
    return null;
}

function selectCardDecision(
    playerKey: any,
    performanceScope?: CpuTurnPerformanceScope | null,
    prepared?: any
): any {
    if (CpuDecisionCardChoice && typeof CpuDecisionCardChoice.selectCardDecision === 'function') {
        return CpuDecisionCardChoice.selectCardDecision(playerKey, performanceScope, prepared);
    }
    return { choice: selectCardToUse(playerKey, performanceScope), prepared: null };
}

function prepareCpuTurnCardUsabilityAnalysis(playerKey: any): any {
    const trapId = _prepareCpuTrapOnlyCard(playerKey);
    return Object.freeze({
        trapPrepared: true,
        trapId: trapId || null,
        cardPolicyLevel: resolveCpuCardPolicyLevelForPlayer(playerKey),
        cardUsability: getTargetAwareCardUsabilityAnalysis(playerKey)
    });
}

function selectCpuMoveWithPolicy(
    candidateMoves: any,
    playerKey: any,
    candidateScoringPrecompute?: any,
    placementLookaheadPrecompute?: any
): any {
    if (CpuDecisionMoveSelection && typeof CpuDecisionMoveSelection.selectCpuMoveWithPolicy === 'function') {
        return CpuDecisionMoveSelection.selectCpuMoveWithPolicy(
            candidateMoves,
            playerKey,
            candidateScoringPrecompute,
            placementLookaheadPrecompute
        );
    }
    return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
}

function getBoardCellValueSafe(board: any, row: any, col: any): any {
    return CpuPolicyBoardMarkerPrimitivesRequired.getBoardCellValueSafe(
        resolveSharedBoardUtilsModule(),
        board,
        row,
        col
    );
}

function countAdjacentCellsByValue(board: any, row: any, col: any, value: any): any {
    return CpuPolicyBoardMarkerPrimitivesRequired.countAdjacentCellsByValue(
        resolveSharedBoardUtilsModule(),
        board,
        row,
        col,
        value
    );
}

function getMarkerPriorityValue(type: any): any {
    return CpuPolicyBoardMarkerPrimitivesRequired.getMarkerPriorityValue(type);
}

function getTimedMarkerProfileAt(playerKey: any, row: any, col: any): any {
    return CpuPolicyBoardMarkerPrimitivesRequired.getTimedMarkerProfileAt(cardState, playerKey, row, col);
}

function isCpuBlockedCell(row: any, col: any): any {
    try {
        if (typeof isBlockedCell === 'function') {
            return !!isBlockedCell(cardState, row, col, gameState);
        }
    } catch (e) {
        // ignore and treat as unblocked
    }
    return false;
}

function getStrongWindLandingProfile(row: any, col: any): any {
    const board = getCurrentCpuBoard();
    if (!board) return null;

    const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
    ];
    let maxDistance = 0;
    let longestOptionCount = 0;
    let longestCornerCount = 0;
    let longestEdgeCount = 0;
    let longestRiskCount = 0;
    let longestBonusTotal = 0;

    for (const d of dirs) {
        const nr = row + d.dr;
        const nc = col + d.dc;
        if (getBoardCellValueSafe(board, nr, nc) !== 0) continue;
        if (isCpuBlockedCell(nr, nc)) continue;

        let tr = nr;
        let tc = nc;
        while (true) {
            const rr = tr + d.dr;
            const cc = tc + d.dc;
            if (getBoardCellValueSafe(board, rr, cc) !== 0) break;
            if (isCpuBlockedCell(rr, cc)) break;
            tr = rr;
            tc = cc;
        }

        const distance = Math.abs(tr - row) + Math.abs(tc - col);
        if (distance <= 0) continue;

        if (distance > maxDistance) {
            maxDistance = distance;
            longestOptionCount = 0;
            longestCornerCount = 0;
            longestEdgeCount = 0;
            longestRiskCount = 0;
            longestBonusTotal = 0;
        }
        if (distance !== maxDistance) continue;

        longestOptionCount += 1;
        if (isCornerCell(tr, tc, board)) longestCornerCount += 1;
        else if (isEdgeCell(tr, tc, board)) longestEdgeCount += 1;
        longestBonusTotal += getBoardBonusValueAt(tr, tc);

        const landingCornerHint = getCornerProximity(tr, tc, board);
        if (landingCornerHint) {
            const cornerCell = getBoardCellValueSafe(
                board,
                landingCornerHint.corner[0],
                landingCornerHint.corner[1]
            );
            if (cornerCell === 0) longestRiskCount += 1;
        }
    }

    if (longestOptionCount <= 0) return null;
    return {
        maxDistance,
        longestOptionCount,
        longestCornerCount,
        longestEdgeCount,
        longestRiskCount,
        averageBonus: longestBonusTotal / longestOptionCount
    };
}

function scoreSeatStrategicValue(playerKey: any, row: any, col: any, markerProfile: any): any {
    const board = getCurrentCpuBoard();
    if (!board) return 0;
    const cell = getBoardCellValueSafe(board, row, col);
    if (cell === null) return 0;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const profile = markerProfile || getMarkerProfileAt(playerKey, row, col);
    const corner = isCornerCell(row, col, board);
    const edge = !corner && isEdgeCell(row, col, board);
    const bonus = getBoardBonusValueAt(row, col);
    const ownAdj = countAdjacentCellsByValue(board, row, col, playerValue);
    const oppAdj = countAdjacentCellsByValue(board, row, col, -playerValue);
    const cornerHint = getCornerProximity(row, col, board);

    let score = 0;
    if (corner) score += 3200;
    else if (edge) score += 900;
    score += bonus * 240;
    score += (profile.ownSpecialScore + profile.oppSpecialScore) * 0.7;
    score += (profile.ownBombCount + profile.oppBombCount) * 210;

    if (cornerHint) {
        const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
        if (cornerCell === 0) score += cornerHint.kind === 'X' ? -900 : -420;
    }

    if (cell === playerValue) score += (ownAdj * 30) - (oppAdj * 18);
    else if (cell === -playerValue) score += (oppAdj * 30) - (ownAdj * 18);
    else score += Math.max(ownAdj, oppAdj) * 18;

    return score;
}

function getMarkerProfileAt(playerKey: any, row: any, col: any): any {
    return CpuPolicyBoardMarkerPrimitivesRequired.getMarkerProfileAt(cardState, playerKey, row, col);
}

function getMoveOpponentSpecialFlipProfile(playerKey: any, move: any): any {
    const flips = Array.isArray(move && move.flips) ? move.flips : [];
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    if (flips.length <= 0 || markers.length <= 0) {
        return { count: 0, score: 0 };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const flippedCells = new Set();
    for (const one of flips) {
        const row = Number(one && one.row);
        const col = Number(one && one.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        flippedCells.add(`${row},${col}`);
    }
    if (flippedCells.size <= 0) {
        return { count: 0, score: 0 };
    }

    let count = 0;
    let score = 0;
    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone' || marker.owner !== opponentKey) continue;
        const row = Number(marker.row);
        const col = Number(marker.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        if (!flippedCells.has(`${row},${col}`)) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
        const type = data && typeof data.type === 'string' ? data.type : '';
        if (type === 'METEOR_HOLE') continue;
        count += 1;
        score += getMarkerPriorityValue(type);
        const remaining = Number(data && data.remainingOwnerTurns);
        if (Number.isFinite(remaining) && remaining > 0) {
            score += Math.min(6, remaining) * 28;
        }
    }

    return { count, score };
}

function filterLv6OpenCornerAdjacentMoves(candidateMoves: any, board: any): any {
    return CpuPolicyPlacementFiltersRequired.filterLv6OpenCornerAdjacentMoves(candidateMoves, board, {
        placementPriority: CpuDecisionPlacementPriority,
        getCornerProximity,
        getBoardCellValueSafe,
        isCornerCell
    });
}

function filterMovesByLv6PlacementPriority(
    playerKey: any,
    level: any,
    candidateMoves: any,
    options?: { emitDebugLog?: boolean }
): any {
    return CpuPolicyPlacementFiltersRequired.filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves, {
        placementPriority: CpuDecisionPlacementPriority
    }, options);
}

function isCloneSplitEligibleSource(playerKey: any, row: any, col: any, markerProfile?: any): any {
    return CpuPolicyPlacementFiltersRequired.isCloneSplitEligibleSource(playerKey, row, col, markerProfile, {
        getCurrentCpuBoard,
        resolvePlayerValue: (key: any) => (key === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getBoardCellValueSafe,
        getMarkerProfileAt
    });
}

function filterCloneSplitTargetsForLv6(playerKey: any, targets: any): any {
    return CpuPolicyPlacementFiltersRequired.filterCloneSplitTargetsForLv6(playerKey, targets, {
        getCurrentCpuBoard,
        resolvePlayerValue: (key: any) => (key === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getBoardCellValueSafe,
        getMarkerProfileAt,
        resolveCpuCardPolicyLevelForPlayer
    });
}

function getCornerProximity(row: any, col: any, boardOverride: any): any {
    return CpuPolicyPendingTargetsRequired.getCornerProximity(row, col, boardOverride, {
        resolveSharedBoardUtilsModule,
        getCurrentCpuBoard,
        getBoardCellValueSafe
    });
}

function getForcedCornerLaneBonus(pendingType: any, row: any, col: any, board: any, playerValue: any): any {
    return CpuPolicyPendingTargetsRequired.getForcedCornerLaneBonus(pendingType, row, col, board, playerValue, {
        resolveSharedBoardUtilsModule,
        getBoardCellValueSafe
    });
}

function getForcedCornerLaneAntiPatternPenalty(pendingType: any, row: any, col: any, board: any, playerValue: any): any {
    return CpuPolicyPendingTargetsRequired.getForcedCornerLaneAntiPatternPenalty(pendingType, row, col, board, playerValue, {
        resolveSharedBoardUtilsModule,
        getBoardCellValueSafe
    });
}

function simulatePendingPlacementBoard(board: any, playerValue: any, target: any): any {
    return CpuPolicyPendingTargetsRequired.simulatePendingPlacementBoard(board, playerValue, target, {
        cloneBoardForCpu,
        setBoardCellValue
    });
}

function scorePendingTargetByType(playerKey: any, pendingType: any, target: any, pending: any): any {
    if (CpuDecisionPendingScore && typeof CpuDecisionPendingScore.scorePendingTargetByType === 'function') {
        return CpuDecisionPendingScore.scorePendingTargetByType(playerKey, pendingType, target, pending);
    }
    return Number.NEGATIVE_INFINITY;
}

function choosePendingTargetWithPolicy(playerKey: any, pendingType: any, targets: any, pending: any): any {
    return CpuPolicyPendingTargetsRequired.choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending, {
        pendingTargetSelector: PendingTargetSelector,
        scorePendingTargetByType
    });
}

const PENDING_SELECTION_ONNX_TIMEOUT = { kind: 'pending-selection-onnx-timeout' };
const PENDING_SELECTION_VALUE_WEIGHT = 220;

const CPU_ONNX_BUDGET_TIMEOUT = { kind: 'cpu-onnx-budget-timeout' };

function resolvePendingSelectionOnnxBudgetMs(level: any): any {
    return resolveCpuLv6OnnxRuntimeBudgetMs(level, 'choosePendingTarget');
}

async function awaitCpuPromiseWithinBudget(promiseFactory: any, budgetMs: any, timeoutValue: any): Promise<any> {
    if (typeof promiseFactory !== 'function') return null;
    if (
        !Number.isFinite(budgetMs) ||
        budgetMs <= 0
    ) {
        return promiseFactory(null);
    }
    const timerService = getCpuTimerService();
    if (!timerService) {
        return promiseFactory(null);
    }
    const abortController = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId: any = null;
        let pending: Promise<any>;
        try {
            pending = Promise.resolve(promiseFactory(abortController ? abortController.signal : null));
        } catch (error) {
            reject(error);
            return;
        }
        pending.then((result: any) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== null) timerService.clearTimeout(timeoutId);
            resolve(result);
        }, (error: any) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== null) timerService.clearTimeout(timeoutId);
            reject(error);
        });
        timeoutId = timerService.setTimeout(() => {
            if (settled) return;
            settled = true;
            if (abortController) abortController.abort();
            resolve(timeoutValue);
        }, budgetMs);
    });
}

function resolveCurrentLegalMovesCountForPlayer(playerKey: any): any {
    if (typeof getLegalMoves !== 'function' || !gameState) return 0;
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    try {
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(playerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const legalMoves = getLegalMoves(gameState, protection, perma) || [];
        return Array.isArray(legalMoves) ? legalMoves.length : 0;
    } catch (e) {
        return 0;
    }
}

function buildPendingTargetOnnxContext(playerKey: any, level: any, pendingType: any, targets: any): any {
    return CpuPolicyPendingTargetsRequired.buildPendingTargetOnnxContext(playerKey, level, pendingType, targets, {
        cpuDecisionPendingOnnx: CpuDecisionPendingOnnx,
        resolveCpuCardPolicyLevelFromLevel
    });
}

function simulateBoardForPendingTarget(playerKey: any, pendingType: any, target: any): any {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.simulateBoardForPendingTarget === 'function'
        ? CpuDecisionPendingOnnx.simulateBoardForPendingTarget(playerKey, pendingType, target)
        : null;
}

function buildPendingTargetValueContext(baseContext: any, pendingType: any, target: any, boardOverride: any): any {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.buildPendingTargetValueContext === 'function'
        ? CpuDecisionPendingOnnx.buildPendingTargetValueContext(baseContext, pendingType, target, boardOverride)
        : Object.assign({}, baseContext || {});
}

async function evaluatePendingTargetValue(runtime: any, baseContext: any, playerKey: any, level: any, pendingType: any, target: any, budgetMs: any): Promise<any> {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.evaluatePendingTargetValue === 'function'
        ? CpuDecisionPendingOnnx.evaluatePendingTargetValue(runtime, baseContext, playerKey, policyLevel, pendingType, target, budgetMs)
        : null;
}

function resolvePendingTargetOverrideThreshold(pendingType: any): any {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.resolvePendingTargetOverrideThreshold === 'function'
        ? CpuDecisionPendingOnnx.resolvePendingTargetOverrideThreshold(pendingType)
        : 24;
}

async function rerankOnnxPendingTargetChoice(runtime: any, selectedTarget: any, playerKey: any, level: any, pendingType: any, targets: any, pending: any, baseContext: any, budgetMs: any): Promise<any> {
    const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.rerankOnnxPendingTargetChoice === 'function'
        ? CpuDecisionPendingOnnx.rerankOnnxPendingTargetChoice(runtime, selectedTarget, playerKey, policyLevel, pendingType, targets, pending, baseContext, budgetMs)
        : { target: selectedTarget, changed: false, gap: 0, selectedValue: null, fallbackValue: null };
}

async function choosePendingTargetWithPolicyAsync(playerKey: any, pendingType: any, targets: any, pending: any): Promise<any> {
    return CpuPolicyPendingTargetsRequired.choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending, {
        cpuDecisionPendingOnnx: CpuDecisionPendingOnnx
    });
}

const CpuDecisionPendingActions = (CpuDecisionPendingActionsModule && typeof CpuDecisionPendingActionsModule.createCpuDecisionPendingActions === 'function')
    ? CpuDecisionPendingActionsModule.createCpuDecisionPendingActions({
        buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) =>
            buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds),
        choosePendingTargetWithPolicyAsync,
        chooseTimeBombTargetWithPolicy: (playerKey: any, targets: any) => chooseTimeBombTargetWithPolicy(playerKey, targets),
        clearCpuPendingEffect: (playerKey: any) => clearCpuPendingEffect(playerKey),
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        emitCpuEffectLog: (message: any) => emitCpuEffectLog(message),
        emitCpuSelectionStateChange,
        filterCloneTargetsForLv6: (playerKey: any, targets: any) => filterCloneSplitTargetsForLv6(playerKey, targets),
        getActiveProtectionForPlayer: (playerValue: any) => ((typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(playerValue) : null),
        getBoardCellValueSafe: (board: any, row: any, col: any) => getBoardCellValueSafe(board, row, col),
        getCardLogic: () => ((typeof CardLogic !== 'undefined') ? CardLogic : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCpuPolicyCore: () => CpuPolicyCore,
        getCpuRng: () => cpuRng,
        getCurrentCpuBoard: () => getCurrentCpuBoard(),
        getFlipBlockers: () => ((typeof getFlipBlockers === 'function') ? getFlipBlockers() : []),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        isCornerCell,
        getLegalMoves: (gameStateValue: any, protection: any, perma: any) => ((typeof getLegalMoves === 'function') ? (getLegalMoves(gameStateValue, protection, perma) || []) : []),
        handOffSelectionTurnInGameState: (playerKey: any) => handOffSelectionTurnInGameState(playerKey),
        maybeContinueCpuSelectionTurnHandoff: (playerKey: any, pendingType: any, playbackEvents: any, action?: any) =>
            maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, playbackEvents, action),
        readCpuPendingEffect: (playerKey: any) => readCpuPendingEffect(playerKey),
        resolveCpuDecisionLevelForPlayer: (playerKey: any) => resolveCpuDecisionLevelForPlayer(playerKey),
        resolveCpuCardPolicyLevelForPlayer: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        resolveSharedBoardUtilsModule: () => resolveSharedBoardUtilsModule(),
        runCpuPendingSelectionViaPipeline
    })
    : null;

/**
 * 破壊対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectDestroyWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectDestroyWithPolicy(playerKey);
}

/**
 * 強風の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectStrongWindWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectStrongWindWillWithPolicy(playerKey);
}

async function cpuSelectSuperBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectSuperBuoyancyWillWithPolicy(playerKey);
}

async function cpuSelectBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectBuoyancyWillWithPolicy(playerKey);
}

async function cpuSelectSuperGravityWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectSuperGravityWillWithPolicy(playerKey);
}

async function cpuSelectGravityWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectGravityWillWithPolicy(playerKey);
}

async function cpuSelectSuperAttractionWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectSuperAttractionWillWithPolicy(playerKey);
}


/**
 * 天の恵み 候補選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHeavenBlessingWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectHeavenBlessingWithPolicy(playerKey);
}

/**
 * 断罪の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCondemnWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCondemnWillWithPolicy(playerKey);
}

async function cpuSelectObserverWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectObserverWillWithPolicy(playerKey);
}

/**
 * 交換の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSwapWithEnemyWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectSwapWithEnemyWithPolicy(playerKey);
}

/**
 * 入替の意志 対象選択（2段階）
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectPositionSwapWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectPositionSwapWillWithPolicy(playerKey);
}

/**
 * 罠の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTrapWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectTrapWillWithPolicy(playerKey);
}

/**
 * 守る意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectGuardWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectGuardWillWithPolicy(playerKey);
}

/**
 * 生きる意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectLivingWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectLivingWillWithPolicy(playerKey);
}

/**
 * 延命系カード 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectExtendLifeWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectExtendLifeWillWithPolicy(playerKey);
}

/**
 * 腐食の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCorrosionWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCorrosionWillWithPolicy(playerKey);
}

function scoreTimeBombTarget(playerKey: any, target: any): any {
    return CpuPolicyTimeBombTargetsRequired.scoreTimeBombTarget(playerKey, target, {
        getCurrentCpuBoard,
        getBoardCellValueSafe,
        resolvePlayerValue: (key: any) => (key === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        countBoardStatsForPlayer,
        isCornerCell,
        isEdgeCell,
        getMarkerProfileAt,
        getTimedMarkerProfileAt,
        random: () => cpuRng.random()
    });
}

function chooseTimeBombTargetWithPolicy(playerKey: any, targets: any): any {
    return CpuPolicyTimeBombTargetsRequired.chooseTimeBombTargetWithPolicy(playerKey, targets, {
        getCurrentCpuBoard,
        getBoardCellValueSafe,
        resolvePlayerValue: (key: any) => (key === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        countBoardStatsForPlayer,
        isCornerCell,
        isEdgeCell,
        getMarkerProfileAt,
        getTimedMarkerProfileAt,
        random: () => cpuRng.random()
    });
}

/**
 * 時限爆弾 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTimeBombWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectTimeBombWithPolicy(playerKey);
}

/**
 * 盤面拡張 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardExpansionWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectBoardExpansionWillWithPolicy(playerKey);
}

/**
 * 盤面縮小 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardShrinkWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectBoardShrinkWithPolicy(playerKey);
}

/**
 * 封鎖の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBlockadeWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectBlockadeWillWithPolicy(playerKey);
}

async function cpuSelectPoisonWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectPoisonWillWithPolicy(playerKey);
}

/**
 * 因果抹消 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectMeteorWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectMeteorWillWithPolicy(playerKey);
}

async function cpuSelectCausalReplayWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCausalReplayWillWithPolicy(playerKey);
}

/**
 * 凍結の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectFreezeWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectFreezeWillWithPolicy(playerKey);
}

/**
 * 種まきの意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSeedWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectSeedWillWithPolicy(playerKey);
}

/**
 * 複製の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCloneWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCloneWillWithPolicy(playerKey);
}

/**
 * 反転の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectReverseWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectReverseWillWithPolicy(playerKey);
}

/**
 * テレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTeleportWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectTeleportWillWithPolicy(playerKey);
}

/**
 * マステレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCellTeleportWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCellTeleportWillWithPolicy(playerKey);
}

/**
 * 意志の反転 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTemptWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectTemptWillWithPolicy(playerKey);
}

/**
 * 捕獲の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCaptureWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCaptureWillWithPolicy(playerKey);
}

// UI-level exposure is handled by UI layer; Node/CommonJS consumers should use module.exports.


// Compute a CPU action WITHOUT side effects. Returns an action descriptor object:
// { type: 'move', move }
// { type: 'useCard', cardId, cardDef }
// { type: 'pass' }
function computeCpuAction(playerKey: any): any {
    return CpuDecisionActionRequired.computeCpuActionWithPolicy(playerKey, {
        resolvePlayerValue: (key: any) => (key === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getActiveProtectionForPlayer: (playerValue: any) => getActiveProtectionForPlayer(playerValue),
        getFlipBlockers: () => ((typeof getFlipBlockers === 'function') ? getFlipBlockers() : []),
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getLegalMoves: (gameStateValue: any, protection: any, perma: any) => (
            (typeof getLegalMoves === 'function') ? (getLegalMoves(gameStateValue, protection, perma) || []) : []
        ),
        selectCardToUse: (key: any) => selectCardToUse(key),
        selectCpuMoveWithPolicy: (legalMoves: any, key: any) => selectCpuMoveWithPolicy(legalMoves, key)
    });
}

// Node.js環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    (cpuMaybeDestroyHandCardWithPolicy as any).supportsCpuTurnPreparedAnalysis = true;
    (cpuMaybeUseCardWithPolicy as any).supportsCpuTurnPreparedAnalysis = true;
    const cpuDecisionPublicApi = {
        cpuMaybeDestroyHandCardWithPolicy,
        cpuMaybeUseCardWithPolicy,
        prepareCpuTurnCardUsabilityAnalysis,
        prepareCardQuiescenceRequest,
        buildCardQuiescenceSnapshotFromBestMove,
        shouldBuildCardQuiescenceSnapshot,
        selectHandCardToDestroy,
        applyHandCardDestroy,
        selectCardToUse,
        applyCardChoice,
        prepareCpuCandidateScoringRequest,
        prepareCpuPlacementLookaheadRequest,
        selectCpuMoveWithPolicy,
        selectMoveFromOnnxPolicyAsync,
        isCardChoiceAllowedByRisk,
        isCardChoiceAllowedByHighConfidence,
        hasPlanPressureProfileForCardType,
        buildOnnxContext,
        buildCardUseDecisionContext,
        cpuSelectDestroyWithPolicy,
        cpuSelectHeavenBlessingWithPolicy,
        cpuSelectCondemnWillWithPolicy,
        cpuSelectObserverWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
        cpuSelectPositionSwapWillWithPolicy,
        cpuSelectTrapWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectLivingWillWithPolicy,
        cpuSelectCaptureWillWithPolicy,
        cpuSelectExtendLifeWillWithPolicy,
        cpuSelectCorrosionWillWithPolicy,
        cpuSelectBuoyancyWillWithPolicy,
        cpuSelectSuperBuoyancyWillWithPolicy,
        cpuSelectGravityWillWithPolicy,
        cpuSelectSuperGravityWillWithPolicy,
        cpuSelectSuperAttractionWillWithPolicy,
        cpuSelectTeleportWillWithPolicy,
        cpuSelectCellTeleportWillWithPolicy,
        cpuSelectTimeBombWithPolicy,
        cpuSelectBoardExpansionWillWithPolicy,
        cpuSelectBoardShrinkWithPolicy,
            cpuSelectBlockadeWillWithPolicy,
            cpuSelectPoisonWillWithPolicy,
        cpuSelectMeteorWillWithPolicy,
        cpuSelectCausalReplayWillWithPolicy,
        cpuSelectFreezeWillWithPolicy,
        cpuSelectSeedWillWithPolicy,
        cpuSelectCloneWillWithPolicy,
        cpuSelectReverseWillWithPolicy,
        cpuSelectTemptWillWithPolicy,
        cpuSelectStrongWindWillWithPolicy,
        computeCpuAction,
        setCpuRng,
        setCpuTimerService,
        setCpuExecutionMode,
        setCpuDecisionRuntime
    };
    module.exports = CpuDecisionPublicApiModule && typeof CpuDecisionPublicApiModule.assertCpuDecisionPublicApi === 'function'
        ? CpuDecisionPublicApiModule.assertCpuDecisionPublicApi(cpuDecisionPublicApi)
        : cpuDecisionPublicApi;
}

// Register via UIBootstrap when available for legacy global access at the UI boundary.
try {
    const uiBootstrap = _require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ computeCpuAction, selectCardToUse, applyCardChoice });
} catch (e) { /* ignore */ }
