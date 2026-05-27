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
            cpuDecisionRuntime &&
            typeof cpuDecisionRuntime.isDebugLogAvailable === 'function' &&
            cpuDecisionRuntime.isDebugLogAvailable() === true
        ) {
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readDebugFlag === 'function') {
            const flag = cpuDecisionRuntime.readDebugFlag('DEBUG_CPU_LOG');
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
let CpuLv6RuntimeCapabilityModule: any = null;
if (typeof require === 'function') {
    try { CpuLv6RuntimeCapabilityModule = _require('../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}

function readRuntimeModule(moduleKey: any): any {
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readModule === 'function') {
            const moduleRef = cpuDecisionRuntime.readModule(moduleKey);
            if (moduleRef) return moduleRef;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuSmartnessLevel(playerKey: any): number {
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readCpuSmartness === 'function') {
            const smartness = cpuDecisionRuntime.readCpuSmartness();
            const value = smartness && smartness[playerKey];
            if (Number.isFinite(Number(value))) {
                return Math.max(1, Math.min(6, Math.floor(Number(value))));
            }
        }
    } catch (e) { /* ignore and fall back to legacy globals */ }
    const smartness = (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (smartness && Number.isFinite(smartness[playerKey])) {
        return Number(smartness[playerKey]);
    }
    return 1;
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
const CpuDecisionPlanPressureModule = requireCpuDecisionModuleOrNull('./cpu-decision-plan-pressure');
const CpuDecisionMovePlanModule = requireCpuDecisionModuleOrNull('./cpu-decision-move-plan');
const CpuDecisionCardContextModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-context');
const CpuDecisionCardRiskModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-risk');
const CpuDecisionCardOnnxModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-onnx');
const CpuDecisionCardLearnedModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-learned');
const CpuDecisionPendingScoreModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-score');
const CpuDecisionPendingOnnxModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-onnx');
const CpuDecisionCardActionsModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-actions');
const CpuDecisionCardPipelineModule = requireCpuDecisionModuleOrNull('./cpu-decision-card-pipeline');
const CpuDecisionPendingPipelineModule = requireCpuDecisionModuleOrNull('./cpu-decision-pending-pipeline');
const CpuDecisionSelectionFlowModule = requireCpuDecisionModuleOrNull('./cpu-decision-selection-flow');
const CpuDecisionControllerEvents = requireCpuDecisionModuleOrNull('./controller-events');

const countBoardEmpties = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countBoardEmpties === 'function')
    ? CpuDecisionBoardUtilsModule.countBoardEmpties
    : function countBoardEmptiesFallback(board: any) {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                if (row[c] === 0) empties += 1;
            }
        }
        return empties;
    };

const isStandardBoard8x8 = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isStandardBoard8x8 === 'function')
    ? CpuDecisionBoardUtilsModule.isStandardBoard8x8
    : function isStandardBoard8x8Fallback() { return false; };

const isCornerCell = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isCornerCell === 'function')
    ? CpuDecisionBoardUtilsModule.isCornerCell
    : function isCornerCellFallback(row: any, col: any, board?: any) {
        const boardUtils = resolveSharedBoardUtilsModule();
        if (boardUtils && typeof boardUtils.isCornerCell === 'function') {
            return boardUtils.isCornerCell(row, col, board);
        }
        return (row === 0 || row === 7) && (col === 0 || col === 7);
    };

const isEdgeCell = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isEdgeCell === 'function')
    ? CpuDecisionBoardUtilsModule.isEdgeCell
    : function isEdgeCellFallback(row: any, col: any, board?: any) {
        const boardUtils = resolveSharedBoardUtilsModule();
        if (boardUtils && typeof boardUtils.isEdgeCell === 'function') {
            return boardUtils.isEdgeCell(row, col, board);
        }
        return row === 0 || row === 7 || col === 0 || col === 7;
    };

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
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.getBoardBonusValueAt === 'function') {
        const cs = (typeof cardState !== 'undefined') ? cardState : null;
        return CpuDecisionBoardUtilsModule.getBoardBonusValueAt(row, col, cs);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    if (!cs) return 0;
    const key = `${row},${col}`;
    const consumed = (cs.boardBonusConsumedByCell && cs.boardBonusConsumedByCell[key] === true);
    if (consumed) return 0;
    const raw = Number(cs.boardBonusByCell && cs.boardBonusByCell[key] ? cs.boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

const countCornerControl = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countCornerControl === 'function')
    ? CpuDecisionBoardUtilsModule.countCornerControl
    : function countCornerControlFallback(board: any, playerValue: any) {
        if (!isPlayableBoard(board)) return { ownCorners: 0, oppCorners: 0 };
        const maxRow = board.length - 1;
        const maxCol = Array.isArray(board[0]) ? (board[0].length - 1) : maxRow;
        const corners = [
            [0, 0],
            [0, maxCol],
            [maxRow, 0],
            [maxRow, maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const one of corners) {
            const row = Array.isArray(board[one[0]]) ? board[one[0]] : null;
            if (!row || one[1] < 0 || one[1] >= row.length) continue;
            const v = row[one[1]];
            if (v === playerValue) ownCorners += 1;
            else if (v === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    };

const countEdgeControl = (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.countEdgeControl === 'function')
    ? CpuDecisionBoardUtilsModule.countEdgeControl
    : function countEdgeControlFallback(board: any, playerValue: any) {
        if (!isPlayableBoard(board)) return { ownEdges: 0, oppEdges: 0 };
        const maxRow = board.length - 1;
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row <= maxRow; row++) {
            const cells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < cells.length; col++) {
                if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) continue;
                const v = cells[col];
                if (v === playerValue) ownEdges += 1;
                else if (v === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    };

function isRecoveryCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerRecoveryCardType === 'function') {
        try { return CpuPolicyCore.isCornerRecoveryCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isRecoveryCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isRecoveryCardType(type);
    }
    return false;
}

function isHoldCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isCornerHoldCardType === 'function') {
        try { return CpuPolicyCore.isCornerHoldCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isHoldCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isHoldCardType(type);
    }
    return false;
}

function isChargeRampCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!type) return false;
    if (CpuPolicyCore && typeof CpuPolicyCore.isChargeRampCardType === 'function') {
        try { return CpuPolicyCore.isChargeRampCardType(type) === true; } catch (e) { /* ignore */ }
    }
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.isChargeRampCardType === 'function') {
        return CpuDecisionBoardUtilsModule.isChargeRampCardType(type);
    }
    return false;
}

function resolveCardType(cardId: any, cardDef: any): any {
    if (CpuDecisionBoardUtilsModule && typeof CpuDecisionBoardUtilsModule.resolveCardType === 'function') {
        const logic = (typeof CardLogic !== 'undefined') ? CardLogic : null;
        return CpuDecisionBoardUtilsModule.resolveCardType(cardId, cardDef, logic);
    }
    if (cardDef && typeof cardDef.type === 'string' && cardDef.type) return cardDef.type;
    if (!cardId || typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getCardDef !== 'function') return '';
    try {
        const def = CardLogic.getCardDef(cardId);
        return (def && typeof def.type === 'string') ? def.type : '';
    } catch (e) {
        return '';
    }
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
            typeof globalModule.chooseCard === 'function' ||
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
                typeof moduleRef.chooseCard === 'function' ||
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

function isOthelloModeForCpuDecision(): boolean {
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readMatchMode === 'function') {
            const mode = String(cpuDecisionRuntime.readMatchMode() || '').trim().toLowerCase();
            if (mode) return mode === 'reversi' || mode === 'othello';
        }
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.getCurrentMatchMode === 'function') {
            const mode = String(cpuDecisionRuntime.getCurrentMatchMode() || '').trim().toLowerCase();
            if (mode) return mode === 'reversi' || mode === 'othello';
        }
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.MATCH_MODE !== 'undefined') {
            const mode = String(cpuDecisionRuntime.MATCH_MODE || '').trim().toLowerCase();
            return mode === 'reversi' || mode === 'othello';
        }
    } catch (e) { /* ignore */ }
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
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readDebugFlag === 'function' && cpuDecisionRuntime.readDebugFlag('CPU_DISABLE_OTHELLO_ONNX') === true) return false;
    } catch (e) { /* ignore */ }
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readDebugFlag === 'function' && cpuDecisionRuntime.readDebugFlag('CPU_FORCE_OTHELLO_ONNX') === true) return true;
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
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const moves = Array.isArray(candidateMoves)
        ? candidateMoves.filter((one) => one && Number.isFinite(one.row) && Number.isFinite(one.col))
        : [];
    let hasCornerMoveNow = false;
    let hasEdgeMoveNow = false;
    let maxLegalMoveBonus = 0;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const deckMetrics = getDeckMetricsForPlayer(playerKey);
    const boardRef = getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
    for (const move of moves) {
        if (!hasCornerMoveNow && isCornerCell(move.row, move.col, boardRef)) hasCornerMoveNow = true;
        if (!hasEdgeMoveNow && isEdgeCell(move.row, move.col, boardRef) && !isCornerCell(move.row, move.col, boardRef)) hasEdgeMoveNow = true;
        const bonus = getBoardBonusValueAt(move.row, move.col);
        if (bonus > maxLegalMoveBonus) maxLegalMoveBonus = bonus;
    }
    return {
        playerKey,
        level,
        board: boardRef,
        pendingType: resolvePendingType(playerKey),
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        ownCharge: (cs && cs.charge && Number.isFinite(cs.charge[playerKey])) ? cs.charge[playerKey] : 0,
        oppCharge: (cs && cs.charge && Number.isFinite(cs.charge[opponentKey])) ? cs.charge[opponentKey] : 0,
        deckCount: Number.isFinite(deckMetrics.legacyDeckCount) ? deckMetrics.legacyDeckCount : 0,
        ownDeckCount: Number.isFinite(deckMetrics.ownDeckCount) ? deckMetrics.ownDeckCount : 0,
        initialDeckSize: Number.isFinite(deckMetrics.initialDeckSize) ? deckMetrics.initialDeckSize : 0,
        boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
            ? cs.boardBonusByCell
            : null,
        boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
            ? cs.boardBonusConsumedByCell
            : null,
        handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : getHandCardIdsForPlayer(playerKey),
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null,
        candidateMoves: moves,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        maxLegalMoveBonus,
        highBonusMoveAvailable: maxLegalMoveBonus >= 3
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

function selectMoveFromOthelloPolicy(candidateMoves: any, playerKey: any, level: any): any {
    if (!isOthelloModeForCpuDecision() || !Number.isFinite(level) || level < 6) return null;
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
            cpuDecisionRuntime &&
            typeof cpuDecisionRuntime.getCpuLv6SharedProfile === 'function'
        ) {
            const profile = cpuDecisionRuntime.getCpuLv6SharedProfile();
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
            cpuDecisionRuntime &&
            typeof cpuDecisionRuntime.readCpuLv6OnnxRuntimeGuard === 'function'
        ) {
            const guard = cpuDecisionRuntime.readCpuLv6OnnxRuntimeGuard();
            if (guard && typeof guard === 'object') return guard;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readLegacyPendingSelectionBudgetMs(): any {
    try {
        if (
            cpuDecisionRuntime &&
            typeof cpuDecisionRuntime.readCpuLv6PendingSelectionBudgetMs === 'function'
        ) {
            return Number(cpuDecisionRuntime.readCpuLv6PendingSelectionBudgetMs());
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
        cardBudgetMs: Math.max(0, Math.floor(readNumber('cardBudgetMs', 0))),
        pendingSelectionBudgetMs: Math.max(0, Math.floor(pendingSelectionBudgetMs))
    };
}

function resolveCpuLv6OnnxRuntimeBudgetMs(level: any, operationKey: any): any {
    if (!Number.isFinite(level) || level < 6) return 0;
    const guard = resolveCpuLv6OnnxRuntimeGuard();
    if (!guard) return 0;
    if (operationKey === 'chooseMove') return guard.moveBudgetMs;
    if (operationKey === 'chooseCard') return guard.cardBudgetMs;
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

let cpuDecisionRuntime: any = null;
function setCpuDecisionRuntime(runtime: any): any {
    if (!runtime || typeof runtime !== 'object') {
        cpuDecisionRuntime = null;
        return;
    }
    cpuDecisionRuntime = Object.assign({}, cpuDecisionRuntime || {}, runtime);
}

function readCpuDecisionQuerySearch(): string {
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.readQuerySearch === 'function') {
            const qs = cpuDecisionRuntime.readQuerySearch();
            return typeof qs === 'string' ? qs : String(qs || '');
        }
    } catch (e) { /* ignore */ }
    return '';
}

function emitCpuDecisionBoardUpdate(): any {
    try {
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.emitBoardUpdate === 'function') {
            cpuDecisionRuntime.emitBoardUpdate();
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
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.emitCardStateChange === 'function') {
            cpuDecisionRuntime.emitCardStateChange();
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
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.emitGameStateChange === 'function') {
            cpuDecisionRuntime.emitGameStateChange();
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
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.emitLogAdded === 'function') {
            if (typeof kind === 'undefined') {
                cpuDecisionRuntime.emitLogAdded(message);
            } else {
                cpuDecisionRuntime.emitLogAdded(message, kind);
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
        if (cpuDecisionRuntime && typeof cpuDecisionRuntime.emitEffectLog === 'function') {
            cpuDecisionRuntime.emitEffectLog(message);
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
    if (cpuTimerService) return cpuTimerService;
    try {
        const { createTimerService } = _require('./timer-service');
        cpuTimerService = createTimerService('browser');
        return cpuTimerService;
    } catch (e) {
        return null;
    }
}

const CpuDecisionSelectionFlow = (CpuDecisionSelectionFlowModule && typeof CpuDecisionSelectionFlowModule.createCpuDecisionSelectionFlow === 'function')
    ? CpuDecisionSelectionFlowModule.createCpuDecisionSelectionFlow({
        getRuntime: () => cpuDecisionRuntime,
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
        resolveCpuSmartnessLevel: (playerKey: any) => resolveCpuSmartnessLevel(playerKey),
        readCardUseDisplayLevel: (playerKey: any) => ((typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? Number(cpuSmartness[playerKey])
            : 1),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getActiveProtectionForPlayer: (playerValue: any) => ((typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(playerValue) : []),
        getFlipBlockers: () => ((typeof getFlipBlockers === 'function') ? getFlipBlockers() : []),
        getLegalMoves: (gameStateValue: any, protection: any, perma: any) => ((typeof getLegalMoves === 'function') ? (getLegalMoves(gameStateValue, protection, perma) || []) : []),
        getTargetAwareUsableCardIds: (playerKey: any) => getTargetAwareUsableCardIds(playerKey),
        buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any) => buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds),
        chooseHandDestroyTargetForCycle: (hand: any, usableCardIds: any, getCardCost: any, getCardDef: any, decisionContext: any) => (
            CpuPolicyCore && typeof CpuPolicyCore.chooseHandDestroyTargetForCycle === 'function'
                ? CpuPolicyCore.chooseHandDestroyTargetForCycle(hand, usableCardIds, getCardCost, getCardDef, decisionContext)
                : null
        ),
        runCpuHandDestroyViaPipeline: (playerKey: any, destroyCardId: any) => runCpuHandDestroyViaPipeline(playerKey, destroyCardId),
        runCpuCardUseViaPipeline: (playerKey: any, cardId: any, cardDef: any) => runCpuCardUseViaPipeline(playerKey, cardId, cardDef),
        resolveTurnPipelineUIAdapter: () => resolveTurnPipelineAdapter(),
        getRuntime: () => cpuDecisionRuntime,
        emitCpuSelectionStateChange: () => emitCpuSelectionStateChange(),
        emitCardStateChange: () => emitCpuDecisionCardStateChange(),
        emitBoardUpdate: () => emitCpuDecisionBoardUpdate(),
        emitLogAdded: (...args: any[]) => emitCpuDecisionLogAdded(args[0], args[1]),
        emitPresentationEventForCpu: (event: any) => emitPresentationEventForCpu(event),
        emitCpuCardUseLog: (playerKey: any, level: any, cardDefOrNull: any, cardIdOrNull: any) => emitCpuCardUseLog(playerKey, level, cardDefOrNull, cardIdOrNull),
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        isOthelloModeForCpuDecision: () => isOthelloModeForCpuDecision(),
        selectCardToUse: (playerKey: any) => selectCardToUse(playerKey),
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

async function selectMoveFromOnnxPolicyAsync(candidateMoves: any, playerKey: any, level: any): Promise<any> {
    const useOthelloOnnx = isOthelloModeForCpuDecision() && shouldUseOthelloOnnxRuntime();
    const runtime = useOthelloOnnx ? resolveOthelloOnnxRuntime() : resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    const board = getCurrentCpuBoard();
    if (!canUseStandardBoardCpuPolicy(board, useOthelloOnnx ? 'othello-onnx-move' : 'onnx-move', playerKey, level)) return null;
    let prioritizedCandidateMoves = useOthelloOnnx
        ? (Array.isArray(candidateMoves) ? candidateMoves : [])
        : filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    if (!useOthelloOnnx && Number.isFinite(level) && level >= 6) {
        prioritizedCandidateMoves = filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
    }
    const preGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
    if (preGate.shouldDegrade) {
        logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', preGate.reason);
        return null;
    }
    const budgetMs = resolveCpuLv6OnnxRuntimeBudgetMs(level, 'chooseMove');
    try {
        const handCardIds = getHandCardIdsForPlayer(playerKey);
        const selected = await awaitCpuPromiseWithinBudget(
            () => runtime.chooseMove(
                prioritizedCandidateMoves,
                useOthelloOnnx
                    ? { playerKey, level, board, legalMovesCount: prioritizedCandidateMoves.length }
                    : buildOnnxContext(playerKey, level, prioritizedCandidateMoves.length, handCardIds, null)
            ),
            budgetMs,
            CPU_ONNX_BUDGET_TIMEOUT
        );
        if (selected === CPU_ONNX_BUDGET_TIMEOUT) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', `timeout budget=${budgetMs}ms`);
            return null;
        }
        const postGate = evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
        if (postGate.shouldDegrade) {
            logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', postGate.reason);
            return null;
        }
        if (useOthelloOnnx) {
            const resolved = resolveCandidateMoveByCoord(prioritizedCandidateMoves, selected) || selected;
            if (resolved) {
                cpuDebugLog(`[CPU] Lv${level} ${playerKey}: リバーシONNX選択 (${resolved.row},${resolved.col})`);
            }
            return resolved;
        }
        const tactical = refineOnnxMoveByTacticalPlan(prioritizedCandidateMoves, selected, playerKey, level);
        if (!Number.isFinite(level) || level < 6) {
            return tactical;
        }
        const searched = selectMoveByLookahead(prioritizedCandidateMoves, playerKey, level, selected);
        if (!searched) return tactical;
        const resolved = resolveCandidateMoveByCoord(prioritizedCandidateMoves, searched) || searched;
        if (tactical && !isSameMoveByCoord(resolved, tactical)) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ONNX手を先読み補正 (${tactical.row},${tactical.col}) -> (${resolved.row},${resolved.col})`
            );
        }
        return resolved;
    } catch (e) {
        console.warn(useOthelloOnnx ? '[CPU] othello ONNX runtime failed, fallback to default policy' : '[CPU] policy-onnx runtime failed, fallback to default policy', e);
        return null;
    }
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

function canRerankOnnxCardChoice(level: any, usableCardIds: any): any {
    return !!(CpuDecisionCardOnnx && typeof CpuDecisionCardOnnx.canRerankOnnxCardChoice === 'function'
        ? CpuDecisionCardOnnx.canRerankOnnxCardChoice(level, usableCardIds)
        : false);
}

function scoreCardForOnnxRerank(cardId: any, playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
    return CpuDecisionCardOnnx && typeof CpuDecisionCardOnnx.scoreCardForOnnxRerank === 'function'
        ? CpuDecisionCardOnnx.scoreCardForOnnxRerank(cardId, playerKey, level, legalMovesCount, legalMoves, usableCardIds, prebuiltContext)
        : Number.NEGATIVE_INFINITY;
}

function rerankOnnxCardChoice(selectedCardId: any, playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any): any {
    return CpuDecisionCardOnnx && typeof CpuDecisionCardOnnx.rerankOnnxCardChoice === 'function'
        ? CpuDecisionCardOnnx.rerankOnnxCardChoice(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usableCardIds)
        : { cardId: selectedCardId, changed: false, gap: 0 };
}

async function selectCardFromOnnxPolicyAsync(playerKey: any, level: any, legalMovesCount: any, usableCardIds: any, legalMoves: any): Promise<any> {
    return CpuDecisionCardOnnx && typeof CpuDecisionCardOnnx.selectCardFromOnnxPolicyAsync === 'function'
        ? CpuDecisionCardOnnx.selectCardFromOnnxPolicyAsync(playerKey, level, legalMovesCount, usableCardIds, legalMoves)
        : null;
}

function selectCardFromLearnedPolicy(playerKey: any, level: any, legalMovesCount: any, usableCardIds: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.selectCardFromLearnedPolicy === 'function'
        ? CpuDecisionCardLearned.selectCardFromLearnedPolicy(playerKey, level, legalMovesCount, usableCardIds)
        : null;
}

function shouldUseSharedPolicyTableCoreCardDecisionLocal(level: any): any {
    if (!Number.isFinite(level) || level < 6) return false;
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability) return capability.usesPolicyTableCoreCardDecision === true;
    const browserProfile = resolveCpuLv6BrowserProfile();
    return !!(browserProfile && browserProfile.cardDecisionMode === 'policy-table-core');
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

function getLearnedCardActionScore(cardId: any, playerKey: any, level: any, legalMovesCount: any): any {
    return CpuDecisionCardLearned && typeof CpuDecisionCardLearned.getLearnedCardActionScore === 'function'
        ? CpuDecisionCardLearned.getLearnedCardActionScore(cardId, playerKey, level, legalMovesCount)
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

function runCpuCardUseViaPipeline(playerKey: any, cardId: any, cardDef: any): any {
    if (CpuDecisionCardPipeline && typeof CpuDecisionCardPipeline.runCpuCardUseViaPipeline === 'function') {
        return CpuDecisionCardPipeline.runCpuCardUseViaPipeline(playerKey, cardId, cardDef);
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

function getTargetAwareUsableCardIds(playerKey: any): any {
    const cs = (typeof cardState !== 'undefined') ? cardState : null;
    const gs = (typeof gameState !== 'undefined') ? gameState : null;
    const cardLogicRef = resolveCardLogicForCpuDecision();
    if (!cardLogicRef) return [];
    if (!cs || !gs) return [];
    if (typeof cardLogicRef.getUsableCardIds === 'function') {
        try {
            return cardLogicRef.getUsableCardIds(cs, gs, playerKey) || [];
        } catch (e) { /* ignore */ }
    }
    if (typeof cardLogicRef.hasUsableCard === 'function' && cardLogicRef.hasUsableCard(cs, gs, playerKey)) {
        // Fallback when only boolean API is available.
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        return hand.slice();
    }
    if (typeof cardLogicRef.canUseCard === 'function') {
        const hand = (cs.hands && cs.hands[playerKey]) ? cs.hands[playerKey] : [];
        return hand.filter((id: any) => {
            try { return !!cardLogicRef.canUseCard(cs, playerKey, id); } catch (e) { return false; }
        });
    }
    return [];
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
            cpuDebugLog(
                `[CPU] Lv${cpuSmartness[playerKey] || 1} ${playerKey}: ${pendingType}配置を安定寄せへ補正 (${bestAnchoredMove.row}, ${bestAnchoredMove.col})`
            );
        }
    })
    : null;

const CpuDecisionCardContext = (CpuDecisionCardContextModule && typeof CpuDecisionCardContextModule.createCpuDecisionCardContext === 'function')
    ? CpuDecisionCardContextModule.createCpuDecisionCardContext({
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        resolvePlayerValue: (playerKey: any) => (playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1)),
        getShapeAwareBoard,
        countBoardStatsForPlayer,
        countEdgeControl,
        buildCornerPlanState,
        getBoardBonusValueAt,
        getBoardCellValueSafe,
        getCpuPolicyCore: () => CpuPolicyCore
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

const CpuDecisionCardOnnx = (CpuDecisionCardOnnxModule && typeof CpuDecisionCardOnnxModule.createCpuDecisionCardOnnx === 'function')
    ? CpuDecisionCardOnnxModule.createCpuDecisionCardOnnx({
        getCpuPolicyCore: () => CpuPolicyCore,
        resolveCardLogic: () => resolveCardLogicForCpuDecision(),
        resolvePolicyOnnxRuntime,
        canUseStandardBoardCpuPolicy,
        evaluateCpuOnnxLatencyGate,
        logCpuOnnxLatencyDegrade,
        resolveCpuLv6OnnxRuntimeBudgetMs,
        getHandCardIdsForPlayer,
        buildOnnxContext,
        awaitCpuPromiseWithinBudget,
        getCpuOnnxBudgetTimeout: () => CPU_ONNX_BUDGET_TIMEOUT,
        buildCardUseDecisionContext,
        resolveCardType,
        isRecoveryCardType,
        isHoldCardType,
        isChargeRampCardType,
        whiteLv6CornerSwingKeepTypes: WHITE_LV6_CORNER_SWING_KEEP_TYPES,
        cpuDebugLog: (...args: any[]) => cpuDebugLog(...args),
        warn: (...args: any[]) => console.warn(...args)
    })
    : null;

const CpuDecisionCardLearned = (CpuDecisionCardLearnedModule && typeof CpuDecisionCardLearnedModule.createCpuDecisionCardLearned === 'function')
    ? CpuDecisionCardLearnedModule.createCpuDecisionCardLearned({
        resolvePolicyTableRuntime,
        getCurrentCpuBoard,
        canUseStandardBoardCpuPolicy,
        resolvePendingType,
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
        getCpuSmartnessLevel: (playerKey: any) => ((typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? Number(cpuSmartness[playerKey])
            : 1),
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
        getCpuSmartnessLevel: (playerKey: any) => ((typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? Number(cpuSmartness[playerKey])
            : 1),
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

function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any): any {
    if (CpuDecisionCardContext && typeof CpuDecisionCardContext.buildCardUseDecisionContext === 'function') {
        return CpuDecisionCardContext.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
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
        ownGuardCount: 0,
        oppGuardCount: 0,
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : [],
        cornerPlanState: buildCornerPlanState(playerKey, legalMoves, usableCardIds)
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
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.buildCardQuiescenceSnapshot === 'function'
        ? CpuDecisionCardRisk.buildCardQuiescenceSnapshot(playerKey, level, legalMoves, context)
        : null;
}

function shouldHoldCardByQuiescence(playerKey: any, level: any, cardId: any, cardDef: any, context: any, snapshot: any): any {
    return !!(CpuDecisionCardRisk && typeof CpuDecisionCardRisk.shouldHoldCardByQuiescence === 'function'
        ? CpuDecisionCardRisk.shouldHoldCardByQuiescence(playerKey, level, cardId, cardDef, context, snapshot)
        : false);
}

function isCardChoiceAllowedByRisk(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.isCardChoiceAllowedByRisk === 'function'
        ? CpuDecisionCardRisk.isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, cardId, prebuiltContext)
        : !!cardId;
}

function isCardChoiceAllowedByHighConfidence(playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any): any {
    return CpuDecisionCardRisk && typeof CpuDecisionCardRisk.isCardChoiceAllowedByHighConfidence === 'function'
        ? CpuDecisionCardRisk.isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, cardId, prebuiltContext)
        : !!cardId;
}

function _isCpuTrapOnlyModeEnabled(playerKey: any): any {
    try {
        const qs = readCpuDecisionQuerySearch();
        const debugEnabled =
            /[?&]debug=(1|true)\b/i.test(qs) ||
            (cpuDecisionRuntime && typeof cpuDecisionRuntime.readDebugFlag === 'function' && cpuDecisionRuntime.readDebugFlag('DEBUG_UNLIMITED_USAGE') === true);
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
            cpuDecisionRuntime &&
            typeof cpuDecisionRuntime.getCardDefs === 'function'
        )
            ? cpuDecisionRuntime.getCardDefs()
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

function selectCardFallback(cardState: any, gameState: any, playerKey: any, level: any, legalMoves: any): any {
    if (typeof cardState === 'undefined' || !cardState) return null;
    if (typeof CardLogic === 'undefined') return null;
    const usable = getTargetAwareUsableCardIds(playerKey);
    if (!usable.length) return null;
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usable);

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
        const selected = CpuPolicyCore.chooseCardWithRiskProfile(
            usable,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            decisionContext
        );
        if (selected) return selected;
    }
    if (CpuPolicyCore && typeof CpuPolicyCore.chooseHighestCostCard === 'function') {
        const fallback = CpuPolicyCore.chooseHighestCostCard(usable, CardLogic.getCardCost, CardLogic.getCardDef);
        if (!fallback) return null;
        return isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, fallback.cardId, decisionContext)
            ? fallback
            : null;
    }
    const choiceId = usable[0];
    const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
    if (!isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choiceId, decisionContext)) return null;
    return { cardId: choiceId, cardDef };
}

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
function selectCardToUse(playerKey: any): any {
    // Pure decision: returns a candidate { cardId, cardDef } or null but does NOT apply it.
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness[playerKey] !== 'undefined') ? cpuSmartness[playerKey] : 1;
    const player = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const protection = (typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(player) : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
    const legalMoves = (typeof getLegalMoves === 'function') ? getLegalMoves(safeGameState, protection, perma) : [];
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const usableNow = (typeof CardLogic !== 'undefined' && CardLogic)
        ? getTargetAwareUsableCardIds(playerKey)
        : [];
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableNow);
    if (
        Number.isFinite(level) &&
        level >= 6 &&
        decisionContext &&
        decisionContext.hasCornerMoveNow === true &&
        decisionContext.forceUseCard !== true
    ) {
        return null;
    }
    const quiescenceSnapshot = buildCardQuiescenceSnapshot(playerKey, level, legalMoves, decisionContext);
    const cornerPlanState = decisionContext.cornerPlanState || buildCornerPlanState(playerKey, legalMoves, usableNow);
    const isAllowedChoice = (choice: any) => {
        if (!choice || !choice.cardId) return false;
        if (!isCardChoiceAllowedByPlan(playerKey, level, legalMovesCount, choice.cardId, choice.cardDef, cornerPlanState, decisionContext)) {
            return false;
        }
        if (!isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
            return false;
        }
        const stableLeadState = !!(decisionContext &&
            Number(decisionContext.discDiff || 0) >= 10 &&
            Number(decisionContext.handSize || 0) <= 2 &&
            Number(decisionContext.ownCharge || 0) <= 18 &&
            Number(decisionContext.legalMovesCount || legalMovesCount || 0) >= 5 &&
            decisionContext.highBonusMoveAvailable !== true &&
            decisionContext.lowDiscEmergency !== true);
        const requireHighConfidence = Number.isFinite(level) && level >= 6 &&
            decisionContext &&
            decisionContext.forceUseCard !== true &&
            decisionContext.cornerEmergency !== true &&
            stableLeadState;
        if (requireHighConfidence) {
            if (!isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
                return false;
            }
        }
        if (shouldHoldCardByQuiescence(playerKey, level, choice.cardId, choice.cardDef, decisionContext, quiescenceSnapshot)) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 高分散カードを保留(静止探索) - ${choice.cardId}`);
            return false;
        }
        return true;
    };

    // Debug-only accelerator: CPU uses Trap Will preferentially.
    const trapId = _prepareCpuTrapOnlyCard(playerKey);
    if (trapId) {
        const usableTrap = getTargetAwareUsableCardIds(playerKey);
        if (usableTrap.includes(trapId)) {
            const trapDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
                ? CardLogic.getCardDef(trapId)
                : null;
            return { cardId: trapId, cardDef: trapDef };
        }
    }

    if (typeof CardLogic !== 'undefined') {
        const usable = usableNow;
        if (shouldUseSharedPolicyTableCoreCardDecision(level)) {
            return selectCardBySharedPolicyTableCore(
                playerKey,
                level,
                legalMoves.length,
                legalMoves,
                usable,
                decisionContext
            ) || null;
        }
        if (usable.length) {
            const lv6Consensus = selectCardByLevel6Consensus(
                playerKey,
                level,
                legalMoves.length,
                legalMoves,
                usable,
                decisionContext
            );
            if (isAllowedChoice(lv6Consensus)) {
                return lv6Consensus;
            }
            const learnedChoice = selectCardFromLearnedPolicy(playerKey, level, legalMoves.length, usable);
            if (isAllowedChoice(learnedChoice)) {
                return learnedChoice;
            }
        }
        if (usable.length) {
            if (CpuPolicyCore && typeof CpuPolicyCore.chooseCardWithRiskProfile === 'function') {
                const selected = CpuPolicyCore.chooseCardWithRiskProfile(
                    usable,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    decisionContext
                );
                if (isAllowedChoice(selected)) return selected;
            }
            if (CpuPolicyCore && typeof CpuPolicyCore.chooseHighestCostCard === 'function') {
                const fallback = CpuPolicyCore.chooseHighestCostCard(usable, CardLogic.getCardCost, CardLogic.getCardDef);
                if (isAllowedChoice(fallback)) {
                    return fallback;
                }
            }
            const choiceId = usable[0];
            const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
            if (isAllowedChoice({ cardId: choiceId, cardDef })) {
                return { cardId: choiceId, cardDef };
            }
        }
    }

    // Try AISystem via safe wrapper
    let cardChoice: any = null;
    if (isAISystemAvailable() && typeof AISystem.selectCardToUse === 'function') {
        try {
            const safeCardState = (typeof cardState !== 'undefined') ? cardState : null;
            const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
            cardChoice = AISystem.selectCardToUse(safeCardState, safeGameState, playerKey, level, legalMoves, null);
        } catch (e) {
            console.warn('[CPU] AISystem.selectCardToUse failed', e);
            cardChoice = null;
        }
    }

    if (!cardChoice) {
        const safeCardState = (typeof cardState !== 'undefined') ? cardState : null;
        const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
        cardChoice = selectCardFallback(safeCardState, safeGameState, playerKey, level, legalMoves);
    }
    if (cardChoice && !isAllowedChoice(cardChoice)) {
        return null;
    }
    return cardChoice || null;
}

function selectHandCardToDestroy(playerKey: any): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.selectHandCardToDestroy === 'function') {
        return CpuDecisionCardActions.selectHandCardToDestroy(playerKey);
    }
    return null;
}

function applyHandCardDestroy(playerKey: any, destroyChoice: any): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.applyHandCardDestroy === 'function') {
        return CpuDecisionCardActions.applyHandCardDestroy(playerKey, destroyChoice);
    }
    return false;
}

function cpuMaybeDestroyHandCardWithPolicy(playerKey: any): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.cpuMaybeDestroyHandCardWithPolicy === 'function') {
        return CpuDecisionCardActions.cpuMaybeDestroyHandCardWithPolicy(playerKey);
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
function applyCardChoice(playerKey: any, cardChoice: any): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.applyCardChoice === 'function') {
        return CpuDecisionCardActions.applyCardChoice(playerKey, cardChoice);
    }
    return false;
}

function cpuMaybeUseCardWithPolicy(playerKey: any): any {
    if (CpuDecisionCardActions && typeof CpuDecisionCardActions.cpuMaybeUseCardWithPolicy === 'function') {
        return CpuDecisionCardActions.cpuMaybeUseCardWithPolicy(playerKey);
    }
    return false;
}

/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
function selectCpuMoveWithPolicy(candidateMoves: any, playerKey: any): any {
    const level = resolveCpuSmartnessLevel(playerKey);

    // 人間プレイヤーの場合はエラー（このコードは呼ばれてはいけない）
    if (level < 0) {
        console.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }

    let prioritizedCandidateMoves = filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    if (Number.isFinite(level) && level >= 6) {
        const board = getCurrentCpuBoard();
        prioritizedCandidateMoves = filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
    }

    const aiSelector = isAISystemAvailable() && typeof AISystem.selectMove === 'function'
        ? (moves: any, lv: any) => AISystem.selectMove(gameState, cardState, moves, lv, null)
        : null;
    const pendingType = resolvePendingType(playerKey);
    if (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') {
        const pending = readCpuPendingEffect(playerKey);
        const pendingPicked = choosePendingTargetWithPolicy(playerKey, pendingType, prioritizedCandidateMoves, pending);
        if (pendingPicked) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: ${pendingType}選択 (${pendingPicked.row}, ${pendingPicked.col}) - 反転${Array.isArray(pendingPicked.flips) ? pendingPicked.flips.length : 0}枚`
            );
            return pendingPicked;
        }
    }

    const othelloMove = (level >= 6) ? selectMoveFromOthelloPolicy(prioritizedCandidateMoves, playerKey, level) : null;
    if (othelloMove) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: リバーシ専用AI選択 (${othelloMove.row}, ${othelloMove.col}) - 反転${Array.isArray(othelloMove.flips) ? othelloMove.flips.length : 0}枚`);
        return othelloMove;
    }

    const learnedMove = (level >= 6) ? selectMoveFromLearnedPolicy(prioritizedCandidateMoves, playerKey, level) : null;
    const learnedScoreFn = createLearnedScoreFn(playerKey, level, prioritizedCandidateMoves.length);
    const movePlanContext = (level >= 4) ? buildMovePlanContext(playerKey, level, prioritizedCandidateMoves) : null;
    const movePlanScoreFn = (
        movePlanContext &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function'
    )
        ? (move: any) => {
            try {
                return Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0);
            } catch (e) {
                return 0;
            }
        }
        : null;

    if (learnedMove && !movePlanScoreFn) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 学習選択 (${learnedMove.row}, ${learnedMove.col}) - 反転${learnedMove.flips.length}枚`);
        return learnedMove;
    }

    const combinedScoreFn = (move: any) => {
        let score = 0;
        if (movePlanScoreFn) score += movePlanScoreFn(move);
        if (learnedScoreFn) {
            const learnedWeight = movePlanScoreFn ? (level >= 6 ? 0.35 : 0.15) : 1.0;
            score += (Number(learnedScoreFn(move) || 0) * learnedWeight);
        }
        if (learnedMove && move && move.row === learnedMove.row && move.col === learnedMove.col) {
            score += movePlanScoreFn ? 1200 : 2500;
        }
        return score;
    };

    if (
        level >= 6 &&
        CpuPolicyCore &&
        typeof CpuPolicyCore.chooseMoveByLookahead === 'function' &&
        isPlayableBoard(gameState && gameState.board)
    ) {
        const playerValue = playerKey === 'black'
            ? (typeof BLACK !== 'undefined' ? BLACK : 1)
            : (typeof WHITE !== 'undefined' ? WHITE : -1);
        const lv6Lookahead = buildLv6LookaheadOptions(level, gameState.board, prioritizedCandidateMoves.length, playerKey);
        const onSearchMeta = createLookaheadMetaLogger(playerKey, level, 'policy-lookahead');
        const weightConfig = resolveCpuLv6LookaheadWeights();
        const looked = CpuPolicyCore.chooseMoveByLookahead(prioritizedCandidateMoves, {
            board: gameState.board,
            playerValue,
            level,
            depth: lv6Lookahead.depth,
            maxBranch: lv6Lookahead.maxBranch,
            nodeBudget: lv6Lookahead.nodeBudget,
            scoreMove: combinedScoreFn,
            priorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
            searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8,
            endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
            endgameDepth: lv6Lookahead.endgameDepth || 16,
            endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
            maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
            endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600,
            onSearchMeta,
            boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? cardState.boardBonusConsumedByCell
                : null
        });
        if (looked) {
            const stabilized = maybeOverrideWithStrictPendingPlacement(looked, prioritizedCandidateMoves, playerKey, movePlanScoreFn);
            if (stabilized) {
                cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 先読み選択 (${stabilized.row}, ${stabilized.col}) - 反転${stabilized.flips.length}枚`);
                return stabilized;
            }
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 先読み選択 (${looked.row}, ${looked.col}) - 反転${looked.flips.length}枚`);
            return looked;
        }
    }

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseMove === 'function') {
        const useHeuristic = !movePlanScoreFn && level >= 3;
        const selected = CpuPolicyCore.chooseMove(prioritizedCandidateMoves, level, cpuRng, aiSelector, {
            enableHeuristic: useHeuristic,
            scoreMove: (movePlanScoreFn || learnedScoreFn || learnedMove) ? combinedScoreFn : null
        });
        if (selected) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selected.row}, ${selected.col}) - 反転${selected.flips.length}枚`);
            return selected;
        }
    }

    if (!isAISystemAvailable() || typeof AISystem.selectMove !== 'function') {
        // フォールバック: ランダム (injectable via setCpuRng)
        console.warn('[CPU] AISystem not available, using random');
        return prioritizedCandidateMoves[Math.floor(cpuRng.random() * prioritizedCandidateMoves.length)];
    }
    try {
        const selectedMove = AISystem.selectMove(gameState, cardState, prioritizedCandidateMoves, level, null);
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selectedMove.row}, ${selectedMove.col}) - 反転${selectedMove.flips.length}枚`);
        return selectedMove;
    } catch (e) {
        console.warn('[CPU] AISystem.selectMove failed, falling back to random', e);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }
}

function getBoardCellValueSafe(board: any, row: any, col: any): any {
    if (!Array.isArray(board)) return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return getBoardCellValue(board, row, col);
}

function countAdjacentCellsByValue(board: any, row: any, col: any, value: any): any {
    if (!Array.isArray(board)) return 0;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            const cell = getBoardCellValueSafe(board, r, c);
            if (cell === value) count += 1;
        }
    }
    return count;
}

function getMarkerPriorityValue(type: any): any {
    const t = String(type || '').toUpperCase();
    if (!t) return 120;
    if (t === 'GUARD') return 280;
    if (t === 'WORK') return 320;
    if (t.includes('ULTIMATE')) return 260;
    if (t === 'SNIPER' || t === 'ROBOT_VACUUM') return 240;
    if (t === 'TRAP') return 180;
    return 140;
}

function getTimedMarkerProfileAt(playerKey: any, row: any, col: any): any {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const out = {
        ownTimedCount: 0,
        oppTimedCount: 0,
        ownTimedScore: 0,
        oppTimedScore: 0,
        ownRemainingSum: 0,
        oppRemainingSum: 0,
        ownCriticalCount: 0,
        oppCriticalCount: 0
    };
    for (const m of markers) {
        if (!m || m.kind !== 'specialStone' || m.row !== row || m.col !== col) continue;
        const remaining = Number(m.data && m.data.remainingOwnerTurns);
        if (!Number.isFinite(remaining) || remaining <= 0) continue;
        const weight = getMarkerPriorityValue(m.data && m.data.type) + (Math.min(6, remaining) * 28);
        if (m.owner === playerKey) {
            out.ownTimedCount += 1;
            out.ownTimedScore += weight;
            out.ownRemainingSum += remaining;
            if (remaining <= 2) out.ownCriticalCount += 1;
        } else {
            out.oppTimedCount += 1;
            out.oppTimedScore += weight;
            out.oppRemainingSum += remaining;
            if (remaining <= 2) out.oppCriticalCount += 1;
        }
    }
    return out;
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
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const out = {
        ownSpecialScore: 0,
        oppSpecialScore: 0,
        ownBombCount: 0,
        oppBombCount: 0
    };
    for (const m of markers) {
        if (!m || m.row !== row || m.col !== col) continue;
        if (m.kind === 'bomb') {
            if (m.owner === playerKey) out.ownBombCount += 1;
            else out.oppBombCount += 1;
            continue;
        }
        if (m.kind !== 'specialStone') continue;
        const priority = getMarkerPriorityValue(m.data && m.data.type);
        if (m.owner === playerKey) out.ownSpecialScore += priority;
        else out.oppSpecialScore += priority;
    }
    return out;
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

function scoreLv6PlacementPlanMove(playerKey: any, level: any, move: any, planContext: any): any {
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') {
        return 0;
    }
    const context = planContext || buildMovePlanContext(playerKey, Math.max(4, level), [move]);
    if (!context) return 0;
    const score = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, context) || 0);
    return Number.isFinite(score) ? score : 0;
}

function filterLv6SpecialRemovalMoves(playerKey: any, level: any, candidateMoves: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];

    const profiledMoves = [];
    for (const move of candidateMoves) {
        const profile = getMoveOpponentSpecialFlipProfile(playerKey, move);
        if (!profile || profile.count <= 0) continue;
        profiledMoves.push({ move, profile });
    }
    if (profiledMoves.length <= 1) return profiledMoves.map((one) => one.move);

    const maxCount = profiledMoves.reduce((best, one) => Math.max(best, Number(one.profile.count) || 0), 0);
    let narrowed = profiledMoves.filter((one: any) => (Number(one.profile.count) || 0) === maxCount);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const maxScore = narrowed.reduce((best, one) => Math.max(best, Number(one.profile.score) || 0), 0);
    narrowed = narrowed.filter((one) => (Number(one.profile.score) || 0) === maxScore);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const narrowedMoves = narrowed.map((one) => one.move);
    const planContext = buildMovePlanContext(playerKey, Math.max(4, level), narrowedMoves);
    let bestPlanScore = Number.NEGATIVE_INFINITY;
    const planScored = narrowed.map((one) => {
        const planScore = scoreLv6PlacementPlanMove(playerKey, level, one.move, planContext);
        if (planScore > bestPlanScore) bestPlanScore = planScore;
        return { move: one.move, planScore };
    });
    const finalists = planScored.filter((one) => one.planScore >= (bestPlanScore - 1e-6)).map((one) => one.move);
    return finalists.length > 0 ? finalists : narrowedMoves;
}

function isEdgeDangerousCornerAdjacent(row: any, col: any, board: any): any {
    if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) return false;
    return isLv6OpenCornerAdjacentCell(row, col, board);
}

function isLv6OpenCornerAdjacentCell(row: any, col: any, board: any): any {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (isCornerCell(row, col, board)) return false;
    const cornerHint = getCornerProximity(row, col, board);
    if (!cornerHint) return false;
    return getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]) === 0;
}

function filterLv6OpenCornerAdjacentMoves(candidateMoves: any, board: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1 || !Array.isArray(board)) return candidateMoves;
    const safeMoves = candidateMoves.filter((move: any) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        return !isLv6OpenCornerAdjacentCell(row, col, board);
    });
    return safeMoves.length > 0 ? safeMoves : candidateMoves;
}

function filterLv6EdgeMovesByPlan(playerKey: any, level: any, candidateMoves: any, board: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0 || !board) return [];

    const edgeMoves = candidateMoves.filter((move: any) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        return Number.isInteger(row) && Number.isInteger(col) && !isCornerCell(row, col, board) && isEdgeCell(row, col, board);
    });

    const safeEdgeMoves = edgeMoves.filter((move) => {
        return !isEdgeDangerousCornerAdjacent(Number(move.row), Number(move.col), board);
    });
    if (safeEdgeMoves.length <= 0) return [];
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreMoveForCornerEdgePlan !== 'function') return safeEdgeMoves;

    const planContext = buildMovePlanContext(playerKey, Math.max(4, level), candidateMoves);
    if (!planContext) return safeEdgeMoves;

    const safeEdgeSet = new Set(safeEdgeMoves);
    const edgeFinalistMargin = 1200;
    const edgeEscapeMargin = 3000;
    const strictPendingPlacement = shouldRespectPendingPlacementPlanStrictly(resolvePendingType(playerKey));
    let bestPlanScore = Number.NEGATIVE_INFINITY;
    let bestOverallPlanScore = Number.NEGATIVE_INFINITY;
    let bestOverallMove: any = null;
    const planScored = candidateMoves.map((move) => {
        const planScore = scoreLv6PlacementPlanMove(playerKey, level, move, planContext);
        if (safeEdgeSet.has(move) && planScore > bestPlanScore) bestPlanScore = planScore;
        if (planScore > bestOverallPlanScore) {
            bestOverallPlanScore = planScore;
            bestOverallMove = move;
        }
        return { move, planScore };
    });

    const finalists = planScored
        .filter((one) => safeEdgeSet.has(one.move) && one.planScore >= (bestPlanScore - edgeFinalistMargin))
        .map((one) => one.move);

    const bestOverallIsSafeEdge = !!bestOverallMove && safeEdgeSet.has(bestOverallMove);
    if (
        !strictPendingPlacement &&
        candidateMoves.length > safeEdgeMoves.length &&
        !bestOverallIsSafeEdge &&
        Number.isFinite(bestOverallPlanScore) &&
        Number.isFinite(bestPlanScore) &&
        (bestOverallPlanScore - bestPlanScore) >= edgeEscapeMargin
    ) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 辺優先を緩和し、内側の安全候補も保持 (${Math.round(bestOverallPlanScore - bestPlanScore)})`
        );
        return candidateMoves;
    }

    return finalists.length > 0 ? finalists : safeEdgeMoves;
}

function filterMovesByLv6PlacementPriority(playerKey: any, level: any, candidateMoves: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];
    if (!Number.isFinite(level) || level < 6) return candidateMoves;

    const board = getCurrentCpuBoard();
    const filteredCandidates = (board && candidateMoves.length > 1)
        ? filterLv6OpenCornerAdjacentMoves(candidateMoves, board)
        : candidateMoves;
    const candidatePool = filteredCandidates.length > 0 ? filteredCandidates : candidateMoves;

    if (board && filteredCandidates.length > 0 && filteredCandidates.length < candidateMoves.length) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 角隣接の危険候補を除外 (${filteredCandidates.length}/${candidateMoves.length})`
        );
    }

    if (board) {
        const cornerMoves = candidatePool.filter((move: any) => {
            if (!move) return false;
            const row = Number(move.row);
            const col = Number(move.col);
            return Number.isInteger(row) && Number.isInteger(col) && isCornerCell(row, col, board);
        });
        if (cornerMoves.length > 0) {
            cpuDebugLog(
                `[CPU] Lv${level} ${playerKey}: 角合法手を最優先 (${cornerMoves.length}/${candidatePool.length})`
            );
            return cornerMoves;
        }
    }

    const prioritized = filterLv6SpecialRemovalMoves(playerKey, level, candidatePool);
    if (prioritized.length > 0) {
        let removedSpecialCount = 0;
        let strongestProfileScore = 0;
        for (const move of prioritized) {
            const profile = getMoveOpponentSpecialFlipProfile(playerKey, move);
            if (!profile) continue;
            removedSpecialCount += Number(profile.count) || 0;
            strongestProfileScore = Math.max(strongestProfileScore, Number(profile.score) || 0);
        }
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 相手特殊石を反転除去できる候補を優先 (${prioritized.length}/${candidatePool.length}, 対象${removedSpecialCount}個, 最大優先値${strongestProfileScore})`
        );
        return prioritized;
    }

    const edgeMoves = filterLv6EdgeMovesByPlan(playerKey, level, candidatePool, board);
    if (edgeMoves.length > 0) {
        cpuDebugLog(
            `[CPU] Lv${level} ${playerKey}: 安全な辺手を優先 (${edgeMoves.length}/${candidatePool.length})`
        );
        return edgeMoves;
    }

    return candidatePool;
}

function isCloneSplitEligibleSource(playerKey: any, row: any, col: any, markerProfile?: any): any {
    const board = getCurrentCpuBoard();
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    if (getBoardCellValueSafe(board, row, col) !== playerValue) return false;

    const profile = markerProfile || getMarkerProfileAt(playerKey, row, col);
    if (!profile || typeof profile !== 'object') return false;
    return (
        Number(profile.ownSpecialScore || 0) > 0 ||
        Number(profile.oppSpecialScore || 0) > 0 ||
        Number(profile.ownBombCount || 0) > 0 ||
        Number(profile.oppBombCount || 0) > 0
    );
}

function filterCloneSplitTargetsForLv6(playerKey: any, targets: any): any {
    if (!Array.isArray(targets) || targets.length <= 0) return [];
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    if (level < 6) return targets;
    return targets.filter((target: any) => {
        if (!target) return false;
        return isCloneSplitEligibleSource(playerKey, target.row, target.col);
    });
}

function getCornerProximity(row: any, col: any, boardOverride: any): any {
    const board = Array.isArray(boardOverride) ? boardOverride : getCurrentCpuBoard();
    const boardUtils = resolveSharedBoardUtilsModule();
    if (!board || !boardUtils) return null;
    if (typeof boardUtils.getCornerProximity === 'function') {
        return boardUtils.getCornerProximity(row, col, board);
    }
    if (typeof boardUtils.getCornerCells !== 'function') return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const isX = typeof boardUtils.isXSquare === 'function'
        ? boardUtils.isXSquare(row, col, board)
        : false;
    const isC = !isX && typeof boardUtils.isCSquare === 'function'
        ? boardUtils.isCSquare(row, col, board)
        : false;
    if (!isX && !isC) return null;

    const corners = boardUtils.getCornerCells(board);
    for (const corner of corners) {
        if (!corner || !Number.isInteger(corner.row) || !Number.isInteger(corner.col)) continue;
        for (const vertical of [-1, 1]) {
            for (const horizontal of [-1, 1]) {
                const verticalCell = getBoardCellValueSafe(board, corner.row + vertical, corner.col);
                const horizontalCell = getBoardCellValueSafe(board, corner.row, corner.col + horizontal);
                if (verticalCell !== null || horizontalCell !== null) continue;
                const inwardRow = corner.row - vertical;
                const inwardCol = corner.col - horizontal;
                if (isX && inwardRow === row && inwardCol === col) {
                    return { kind: 'X', corner: [corner.row, corner.col] };
                }
                if (isC && (
                    (inwardRow === row && corner.col === col) ||
                    (corner.row === row && inwardCol === col)
                )) {
                    return { kind: 'C', corner: [corner.row, corner.col] };
                }
            }
        }
    }
    return null;
}

function getForcedCornerLaneBonus(pendingType: any, row: any, col: any, board: any, playerValue: any): any {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const targetCell = getBoardCellValueSafe(board, row, col);
    if (targetCell !== playerValue) return 0;
    const boardUtils = resolveSharedBoardUtilsModule();
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;
    if (col !== bounds.minCol && col !== bounds.maxCol) return 0;

    if (String(pendingType || '') === 'BUOYANCY_WILL' || String(pendingType || '') === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        return getBoardCellValueSafe(board, bounds.minRow, col) === 0 ? 2600 : 0;
    }
    if (String(pendingType || '') === 'GRAVITY_WILL' || String(pendingType || '') === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        return getBoardCellValueSafe(board, bounds.maxRow, col) === 0 ? 2600 : 0;
    }
    return 0;
}

function getForcedCornerLaneAntiPatternPenalty(pendingType: any, row: any, col: any, board: any, playerValue: any): any {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const targetCell = getBoardCellValueSafe(board, row, col);
    if (targetCell === null || targetCell === playerValue) return 0;
    const type = String(pendingType || '');
    const boardUtils = resolveSharedBoardUtilsModule();
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;

    if (type === 'BUOYANCY_WILL' || type === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.minRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.minRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getBoardCellValueSafe(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    if (type === 'GRAVITY_WILL' || type === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.maxRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.maxRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getBoardCellValueSafe(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    return 0;
}

function simulatePendingPlacementBoard(board: any, playerValue: any, target: any): any {
    if (!Array.isArray(board)) return null;
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    const next = cloneBoardForCpu(board);
    if (!setBoardCellValue(next, target.row, target.col, playerValue)) return next;
    const flips = Array.isArray(target.flips) ? target.flips : [];
    for (const one of flips) {
        if (!one || !Number.isInteger(one.row) || !Number.isInteger(one.col)) continue;
        setBoardCellValue(next, one.row, one.col, playerValue);
    }
    return next;
}

function scorePendingTargetByType(playerKey: any, pendingType: any, target: any, pending: any): any {
    if (CpuDecisionPendingScore && typeof CpuDecisionPendingScore.scorePendingTargetByType === 'function') {
        return CpuDecisionPendingScore.scorePendingTargetByType(playerKey, pendingType, target, pending);
    }
    return Number.NEGATIVE_INFINITY;
}

function choosePendingTargetWithPolicy(playerKey: any, pendingType: any, targets: any, pending: any): any {
    if (
        PendingTargetSelector &&
        typeof PendingTargetSelector.choosePendingTargetWithPolicy === 'function'
    ) {
        return PendingTargetSelector.choosePendingTargetWithPolicy({
            playerKey,
            pendingType,
            pending,
            targets,
            scoreTarget: (target: any) => scorePendingTargetByType(playerKey, pendingType, target, pending)
        });
    }

    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const one of targets) {
        const score = scorePendingTargetByType(playerKey, pendingType, one, pending);
        if (score > bestScore) {
            bestScore = score;
            best = one;
            continue;
        }
        if (score === bestScore && best) {
            const row = Number(one && one.row);
            const col = Number(one && one.col);
            const bestRow = Number(best && best.row);
            const bestCol = Number(best && best.col);
            if (row < bestRow || (row === bestRow && col < bestCol)) {
                best = one;
            }
        }
    }
    return best || targets[0];
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
        return promiseFactory();
    }
    const timerService = getCpuTimerService();
    if (!timerService) {
        return promiseFactory();
    }
    return new Promise((resolve) => {
        let timeoutId: any = null;
        promiseFactory().then((result: any) => {
            if (timeoutId !== null) timerService.clearTimeout(timeoutId);
            resolve(result);
        });
        timeoutId = timerService.setTimeout(() => resolve(timeoutValue), budgetMs);
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
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.buildPendingTargetOnnxContext === 'function'
        ? CpuDecisionPendingOnnx.buildPendingTargetOnnxContext(playerKey, level, pendingType, targets)
        : {};
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
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.evaluatePendingTargetValue === 'function'
        ? CpuDecisionPendingOnnx.evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, target, budgetMs)
        : null;
}

function resolvePendingTargetOverrideThreshold(pendingType: any): any {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.resolvePendingTargetOverrideThreshold === 'function'
        ? CpuDecisionPendingOnnx.resolvePendingTargetOverrideThreshold(pendingType)
        : 24;
}

async function rerankOnnxPendingTargetChoice(runtime: any, selectedTarget: any, playerKey: any, level: any, pendingType: any, targets: any, pending: any, baseContext: any, budgetMs: any): Promise<any> {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.rerankOnnxPendingTargetChoice === 'function'
        ? CpuDecisionPendingOnnx.rerankOnnxPendingTargetChoice(runtime, selectedTarget, playerKey, level, pendingType, targets, pending, baseContext, budgetMs)
        : { target: selectedTarget, changed: false, gap: 0, selectedValue: null, fallbackValue: null };
}

async function choosePendingTargetWithPolicyAsync(playerKey: any, pendingType: any, targets: any, pending: any): Promise<any> {
    return CpuDecisionPendingOnnx && typeof CpuDecisionPendingOnnx.choosePendingTargetWithPolicyAsync === 'function'
        ? CpuDecisionPendingOnnx.choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending)
        : (Array.isArray(targets) && targets.length ? targets[0] : null);
}

/**
 * 破壊対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectDestroyWithPolicy(playerKey: any): Promise<any> {
    const level = cpuSmartness[playerKey] || 1;
    const board = getCurrentCpuBoard();
    const selectorTargets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    let targets = Array.isArray(selectorTargets)
        ? selectorTargets.filter((target) => {
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return false;
            const value = getBoardCellValueSafe(board, target.row, target.col);
            return value !== null && value !== 0;
        })
        : [];
    if (targets.length <= 0 && Array.isArray(board)) {
        const boardUtils = resolveSharedBoardUtilsModule();
        if (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function') {
            targets = boardUtils.collectBoardCoordinates(board)
                .filter((cell: any) => getBoardCellValueSafe(board, cell.row, cell.col) !== 0);
        } else {
            targets = [];
            for (let row = 0; row < board.length; row++) {
                const line = Array.isArray(board[row]) ? board[row] : [];
                for (let col = 0; col < line.length; col++) {
                    if (line[col] === 0) continue;
                    targets.push({ row, col });
                }
            }
        }
    }

    if (targets.length === 0) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'DESTROY_ONE_STONE', targets, null) || targets[0];

    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { destroyTarget: { row: target.row, col: target.col } },
        'DESTROY_ONE_STONE'
    );
    if (pipelineResult) return;

    // CPU must bypass UI lock-based handlers and apply effect directly.
    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyDestroyEffect === 'function') {
        const applied = !!CardLogic.applyDestroyEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
    clearCpuPendingEffect(playerKey);
    emitCpuSelectionStateChange();
}

/**
 * 強風の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectStrongWindWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 強風対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'STRONG_WIND_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 強風ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { strongWindTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'STRONG_WIND_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyStrongWindWill === 'function') {
        const res = CardLogic.applyStrongWindWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectSuperBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 超浮力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SUPER_BUOYANCY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 超浮力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { superBuoyancyTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'SUPER_BUOYANCY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySuperBuoyancyWill === 'function') {
        const res = CardLogic.applySuperBuoyancyWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 浮力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'BUOYANCY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 浮力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { buoyancyTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'BUOYANCY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBuoyancyWill === 'function') {
        const res = CardLogic.applyBuoyancyWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectSuperGravityWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 超重力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SUPER_GRAVITY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 超重力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { superGravityTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'SUPER_GRAVITY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySuperGravityWill === 'function') {
        const res = CardLogic.applySuperGravityWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectGravityWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 重力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'GRAVITY_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 重力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { gravityTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'GRAVITY_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyGravityWill === 'function') {
        const res = CardLogic.applyGravityWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

async function cpuSelectSuperAttractionWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 超引力対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SUPER_ATTRACTION_WILL', targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 超引力ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { superAttractionTarget: { row: target.row, col: target.col }, deferNetworkPublish: true },
        'SUPER_ATTRACTION_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySuperAttractionWill === 'function') {
        const res = CardLogic.applySuperAttractionWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}


/**
 * 天の恵み 候補選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHeavenBlessingWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 天の恵み候補なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    let targetCardId = offers[0];
    let bestCost = -Infinity;
    let bestScore = Number.NEGATIVE_INFINITY;
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const player = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const protection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(player)
        : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = (typeof getLegalMoves === 'function')
        ? (getLegalMoves(gameState, protection, perma) || [])
        : [];
    const usableCards = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
        ? cardState.hands[playerKey].slice()
        : [];
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMoves.length, legalMoves, usableCards);

    for (const cardId of offers) {
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(cardId) || 0)
            : 0;
        let score = cost * 0.35;
        if (
            CpuPolicyCore &&
            typeof CpuPolicyCore.scoreCardUseDecision === 'function' &&
            typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.getCardDef === 'function' &&
            typeof CardLogic.getCardCost === 'function'
        ) {
            const useDecision = CpuPolicyCore.scoreCardUseDecision(
                cardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                decisionContext
            );
            const retention = (typeof CpuPolicyCore.scoreCardRetentionPriority === 'function')
                ? CpuPolicyCore.scoreCardRetentionPriority(
                    cardId,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    decisionContext
                )
                : null;
            if (useDecision && Number.isFinite(useDecision.score)) {
                score += Number(useDecision.score) * 0.95;
                if (useDecision.shouldUse === true) score += 18;
            }
            if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.8;
        }
        if (score > bestScore || (score === bestScore && cost > bestCost)) {
            bestScore = score;
            bestCost = cost;
            targetCardId = cardId;
        }
    }
    cpuDebugLog(`[CPU] ${playerKey}: 天の恵み選択 ${targetCardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { heavenBlessingCardId: targetCardId },
        'HEAVEN_BLESSING'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyHeavenBlessingChoice === 'function') {
        const res = CardLogic.applyHeavenBlessingChoice(cardState, playerKey, targetCardId);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            const actor = playerKey === 'black' ? '黒' : '白';
            emitCpuEffectLog(`${actor}: 天の恵みでカード獲得`);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 断罪の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCondemnWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 断罪候補なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    let target = offers[0];
    let bestCost = -Infinity;
    let bestScore = Number.NEGATIVE_INFINITY;
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
        ? Number(cpuSmartness[playerKey])
        : 1;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const opponentValue = opponentKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const opponentProtection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(opponentValue)
        : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const opponentLegalMoves = (typeof getLegalMoves === 'function')
        ? (getLegalMoves(gameState, opponentProtection, perma) || [])
        : [];
    const opponentUsableCards = (cardState && cardState.hands && Array.isArray(cardState.hands[opponentKey]))
        ? cardState.hands[opponentKey].slice()
        : [];
    const opponentContext = buildCardUseDecisionContext(
        opponentKey,
        level,
        opponentLegalMoves.length,
        opponentLegalMoves,
        opponentUsableCards
    );
    for (const offer of offers) {
        if (!offer || !offer.cardId) continue;
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(offer.cardId) || 0)
            : 0;
        let score = cost * 0.45;
        if (
            CpuPolicyCore &&
            typeof CpuPolicyCore.scoreCardRetentionPriority === 'function' &&
            typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.getCardDef === 'function' &&
            typeof CardLogic.getCardCost === 'function'
        ) {
            const retention = CpuPolicyCore.scoreCardRetentionPriority(
                offer.cardId,
                CardLogic.getCardCost,
                CardLogic.getCardDef,
                opponentContext
            );
            const useDecision = (typeof CpuPolicyCore.scoreCardUseDecision === 'function')
                ? CpuPolicyCore.scoreCardUseDecision(
                    offer.cardId,
                    CardLogic.getCardCost,
                    CardLogic.getCardDef,
                    opponentContext
                )
                : null;
            if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.9;
            if (useDecision && Number.isFinite(useDecision.score)) {
                score += Number(useDecision.score) * 0.75;
                if (useDecision.shouldUse === true) score += 16;
            }
        }
        if (score > bestScore || (score === bestScore && cost > bestCost)) {
            bestScore = score;
            bestCost = cost;
            target = offer;
        }
    }
    if (!target || !Number.isInteger(target.handIndex)) {
        clearCpuPendingEffect(playerKey);
        return;
    }
    cpuDebugLog(`[CPU] ${playerKey}: 断罪選択 index=${target.handIndex} card=${target.cardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { condemnTargetIndex: target.handIndex },
        'CONDEMN_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCondemnWill === 'function') {
        const res = CardLogic.applyCondemnWill(cardState, playerKey, target.handIndex);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 交換の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSwapWithEnemyWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 交換対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SWAP_WITH_ENEMY', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 交換ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { swapTarget: { row: target.row, col: target.col } },
        'SWAP_WITH_ENEMY'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySwapEffect === 'function') {
        const applied = !!CardLogic.applySwapEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            handOffSelectionTurnInGameState(playerKey);
            maybeContinueCpuSelectionTurnHandoff(playerKey, 'SWAP_WITH_ENEMY', []);
        }
        emitCpuSelectionStateChange();
        return;
    }

    clearCpuPendingEffect(playerKey);
    emitCpuSelectionStateChange();
}

/**
 * 入替の意志 対象選択（2段階）
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectPositionSwapWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 入替対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const pending = readCpuPendingEffect(playerKey);
    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'POSITION_SWAP_WILL', targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 入替ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { positionSwapTarget: { row: target.row, col: target.col } },
        'POSITION_SWAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyPositionSwapWill === 'function') {
        const res = CardLogic.applyPositionSwapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }

    clearCpuPendingEffect(playerKey);
    emitCpuSelectionStateChange();
}

/**
 * 罠の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTrapWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 罠対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TRAP_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 罠ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { trapTarget: { row: target.row, col: target.col } },
        'TRAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTrapWill === 'function') {
        const res = CardLogic.applyTrapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        } else {
            handOffSelectionTurnInGameState(playerKey);
            maybeContinueCpuSelectionTurnHandoff(playerKey, 'TRAP_WILL', []);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 守る意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectGuardWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD'))
        ? pending.type
        : 'GUARD_WILL';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 守る対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 守るターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { guardTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyGuardWill === 'function') {
        const res = CardLogic.applyGuardWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 生きる意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectLivingWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = (pending && pending.type === 'LIVING_WILL') ? pending.type : 'LIVING_WILL';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getLivingWillTargets === 'function')
        ? CardLogic.getLivingWillTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 生きる意志対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 生きる意志ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { livingWillTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyLivingWill === 'function') {
        const res = CardLogic.applyLivingWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 多動の継承 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHyperactiveInheritWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getHyperactiveInheritTargets === 'function')
        ? CardLogic.getHyperactiveInheritTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 継承多動対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'HYPERACTIVE_INHERIT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 継承多動ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { hyperactiveInheritTarget: { row: target.row, col: target.col } },
        'HYPERACTIVE_INHERIT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyHyperactiveInheritWill === 'function') {
        const res = CardLogic.applyHyperactiveInheritWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 延命系カード 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectExtendLifeWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && pending.type === 'EXTEND_LIFE_GOD'
        ? 'EXTEND_LIFE_GOD'
        : 'EXTEND_LIFE_WILL';
    const applyMethodName = pendingType === 'EXTEND_LIFE_GOD' ? 'applyExtendLifeGod' : 'applyExtendLifeWill';
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getExtendLifeTargets === 'function')
        ? CardLogic.getExtendLifeTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${pendingType === 'EXTEND_LIFE_GOD' ? '延命神' : '延命'}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${pendingType === 'EXTEND_LIFE_GOD' ? '延命神' : '延命'}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { extendTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic[applyMethodName] === 'function') {
        const res = CardLogic[applyMethodName](cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 腐食の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCorrosionWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getCorrosionTargets === 'function')
        ? CardLogic.getCorrosionTargets(cardState, gameState, playerKey)
        : ((typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : []);

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 腐食対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CORROSION_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 腐食ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { corrosionTarget: { row: target.row, col: target.col } },
        'CORROSION_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCorrosionWill === 'function') {
        const res = CardLogic.applyCorrosionWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }
}

function scoreTimeBombTarget(playerKey: any, target: any): any {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return -Infinity;
    const board = getCurrentCpuBoard();
    if (!board) return -Infinity;
    if (getBoardCellValueSafe(board, target.row, target.col) === null) return -Infinity;

    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const stats = countBoardStatsForPlayer(playerValue);
    let score = 0;
    let oppCornerHits = 0;
    let ownCornerHits = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = target.row + dr;
            const c = target.col + dc;
            const cell = getBoardCellValueSafe(board, r, c);
            if (cell === null || cell === 0) continue;

            const corner = isCornerCell(r, c, board);
            const edge = isEdgeCell(r, c, board);
            const weight = corner ? 12 : (edge ? 4 : 2);
            const isOwn = cell === playerValue;
            const markerProfile = getMarkerProfileAt(playerKey, r, c);
            const timedProfile = getTimedMarkerProfileAt(playerKey, r, c);
            if (isOwn) {
                score -= weight * 100;
                score -= markerProfile.ownSpecialScore * 0.55;
                score -= markerProfile.ownBombCount * 160;
                score -= timedProfile.ownRemainingSum * 36;
                if (corner) ownCornerHits += 1;
            } else {
                score += weight * 100;
                score += markerProfile.oppSpecialScore * 0.55;
                score += markerProfile.oppBombCount * 160;
                score += timedProfile.oppRemainingSum * 36;
                if (corner) oppCornerHits += 1;
            }
        }
    }

    if (stats.discDiff <= -8) score += 140;
    if (stats.discDiff <= -14) score += 80;
    if (stats.discDiff >= 8) score -= 140;
    if (stats.discDiff >= 12) score -= 70;
    if (oppCornerHits > 0) score += 2400 * oppCornerHits;
    if (ownCornerHits > 0) score -= 3200 * ownCornerHits;
    if (stats.discDiff >= 0 && oppCornerHits <= 0) score -= 220;

    // Deterministic tie-break jitter from injected RNG.
    score += cpuRng.random() * 0.01;
    return score;
}

function chooseTimeBombTargetWithPolicy(playerKey: any, targets: any): any {
    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best: any = null;
    let bestScore = -Infinity;
    for (const target of targets) {
        const score = scoreTimeBombTarget(playerKey, target);
        if (score > bestScore) {
            bestScore = score;
            best = target;
        }
    }
    return best || targets[0];
}

/**
 * 時限爆弾 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTimeBombWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getTimeBombTargets === 'function')
        ? CardLogic.getTimeBombTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = chooseTimeBombTargetWithPolicy(playerKey, targets);
    if (!target) {
        clearCpuPendingEffect(playerKey);
        return;
    }
    cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { bombTarget: { row: target.row, col: target.col } },
        'TIME_BOMB'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTimeBombWill === 'function') {
        const res = CardLogic.applyTimeBombWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 盤面拡張 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardExpansionWillWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_EXPANSION_WILL';
    const isGodExpansion = pendingType === 'BOARD_EXPANSION_GOD';
    const cardLabel = isGodExpansion ? '盤面拡張神' : '盤面拡張';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { expansionTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    const applyFn = (typeof CardLogic !== 'undefined' && isGodExpansion && typeof CardLogic.applyBoardExpansionGod === 'function')
        ? CardLogic.applyBoardExpansionGod
        : (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBoardExpansionWill === 'function'
            ? CardLogic.applyBoardExpansionWill
            : null);

    if (typeof applyFn === 'function') {
        const res = applyFn(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 盤面縮小 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBoardShrinkWithPolicy(playerKey: any): Promise<any> {
    const pending = readCpuPendingEffect(playerKey);
    const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_SHRINK_WILL';
    const isGodShrink = pendingType === 'BOARD_SHRINK_GOD';
    const cardLabel = isGodShrink ? '盤面縮小神' : '盤面縮小';

    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: ${cardLabel}ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { shrinkTarget: { row: target.row, col: target.col } },
        pendingType
    );
    if (pipelineResult) return;

    const applyFn = (typeof CardLogic !== 'undefined' && isGodShrink && typeof CardLogic.applyBoardShrinkGod === 'function')
        ? CardLogic.applyBoardShrinkGod
        : (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBoardShrinkWill === 'function'
            ? CardLogic.applyBoardShrinkWill
            : null);

    if (typeof applyFn === 'function') {
        const res = applyFn(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 封鎖の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectBlockadeWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 封鎖対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'BLOCKADE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 封鎖ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { blockadeTarget: { row: target.row, col: target.col } },
        'BLOCKADE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyBlockadeWill === 'function') {
        const res = CardLogic.applyBlockadeWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 隕石 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectMeteorWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 隕石対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'METEOR_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 隕石ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { meteorTarget: { row: target.row, col: target.col } },
        'METEOR_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyMeteorWill === 'function') {
        const res = CardLogic.applyMeteorWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 凍結の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectFreezeWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 凍結対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'FREEZE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 凍結ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { freezeTarget: { row: target.row, col: target.col } },
        'FREEZE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyFreezeWill === 'function') {
        const res = CardLogic.applyFreezeWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 種まきの意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSeedWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 種まき対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'SEED_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 種まきターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { seedTarget: { row: target.row, col: target.col } },
        'SEED_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySeedWill === 'function') {
        const res = CardLogic.applySeedWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 複製の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCloneWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const eligibleTargets = filterCloneSplitTargetsForLv6(playerKey, targets);
    if (!eligibleTargets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし (通常石は除外)`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CLONE_WILL', eligibleTargets, null) || eligibleTargets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 複製ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { cloneTarget: { row: target.row, col: target.col } },
        'CLONE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCloneWill === 'function') {
        const res = CardLogic.applyCloneWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * テレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTeleportWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: テレポート対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TELEPORT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: テレポートターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { teleportTarget: { row: target.row, col: target.col } },
        'TELEPORT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTeleportWill === 'function') {
        const res = CardLogic.applyTeleportWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * マステレポート 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCellTeleportWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: マステレポート対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CELL_TELEPORT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: マステレポートターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { teleportTarget: { row: target.row, col: target.col } },
        'CELL_TELEPORT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCellTeleportWill === 'function') {
        const res = CardLogic.applyCellTeleportWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 誘惑の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTemptWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 誘惑対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'TEMPT_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 誘惑ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { temptTarget: { row: target.row, col: target.col } },
        'TEMPT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTemptWill === 'function') {
        const res = CardLogic.applyTemptWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
        return;
    }

    clearCpuPendingEffect(playerKey);
    emitCpuSelectionStateChange();
}

/**
 * 捕獲の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectCaptureWillWithPolicy(playerKey: any): Promise<any> {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 捕獲対象なし`);
        clearCpuPendingEffect(playerKey);
        return;
    }

    const target = await choosePendingTargetWithPolicyAsync(playerKey, 'CAPTURE_WILL', targets, null) || targets[0];
    cpuDebugLog(`[CPU] ${playerKey}: 捕獲ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = await runCpuPendingSelectionViaPipeline(
        playerKey,
        { captureTarget: { row: target.row, col: target.col } },
        'CAPTURE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCaptureWill === 'function') {
        const res = CardLogic.applyCaptureWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            clearCpuPendingEffect(playerKey);
        }
        emitCpuSelectionStateChange();
    } else {
        clearCpuPendingEffect(playerKey);
        emitCpuSelectionStateChange();
    }
}

// UI-level exposure is handled by UI layer; Node/CommonJS consumers should use module.exports.


// Compute a CPU action WITHOUT side effects. Returns an action descriptor object:
// { type: 'move', move }
// { type: 'useCard', cardId, cardDef }
// { type: 'pass' }
function computeCpuAction(playerKey: any): any {
    const player = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const protection = getActiveProtectionForPlayer(player);
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = getLegalMoves(gameState, protection, perma);

    if (!legalMoves.length) {
        // ask the centralized selector for a candidate
        let cardChoice: any = null;
        try {
            cardChoice = selectCardToUse(playerKey);
        } catch (e) {
            cardChoice = null;
        }
        if (cardChoice && cardChoice.cardId) {
            return { type: 'useCard', cardId: cardChoice.cardId, cardDef: cardChoice.cardDef };
        }
        return { type: 'pass' };
    }

    const move = selectCpuMoveWithPolicy(legalMoves, playerKey);
    return { type: 'move', move };
}

// Node.js環境用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cpuMaybeDestroyHandCardWithPolicy,
        cpuMaybeUseCardWithPolicy,
        selectHandCardToDestroy,
        applyHandCardDestroy,
        selectCardToUse,
        applyCardChoice,
        selectCpuMoveWithPolicy,
        selectMoveFromOnnxPolicyAsync,
        selectCardFromOnnxPolicyAsync,
        isCardChoiceAllowedByRisk,
        isCardChoiceAllowedByHighConfidence,
        hasPlanPressureProfileForCardType,
        buildOnnxContext,
        buildCardUseDecisionContext,
        cpuSelectDestroyWithPolicy,
        cpuSelectHeavenBlessingWithPolicy,
        cpuSelectCondemnWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
        cpuSelectPositionSwapWillWithPolicy,
        cpuSelectTrapWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectLivingWillWithPolicy,
        cpuSelectCaptureWillWithPolicy,
        cpuSelectHyperactiveInheritWillWithPolicy,
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
        cpuSelectMeteorWillWithPolicy,
        cpuSelectFreezeWillWithPolicy,
        cpuSelectSeedWillWithPolicy,
        cpuSelectCloneWillWithPolicy,
        cpuSelectTemptWillWithPolicy,
        computeCpuAction,
        setCpuRng,
        setCpuTimerService,
        setCpuExecutionMode,
        setCpuDecisionRuntime
    };
}

// Register via UIBootstrap when available for legacy global access at the UI boundary.
try {
    const uiBootstrap = _require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ computeCpuAction, selectCardToUse, applyCardChoice });
} catch (e) { /* ignore */ }
