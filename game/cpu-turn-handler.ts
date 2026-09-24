declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';
import { isCardRuntimeUnavailableError } from './logic/card-runtime-errors';
import { runLv10Turn, type Lv10TurnRecord, type Lv10TurnDeps } from './cpu-lv10-turn';
import CpuOpponentStartupOptions = require('../shared/cpu-opponent-startup-options');
import {
    createCpuTurnPerformanceScope,
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    readCpuTurnPerformanceCorrelationId,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceRecorder,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

// Global declarations for functions not in ui/globals.d.ts
declare const applyCardChoice: any;
declare const buildCardUseDecisionContext: any;
declare const isCardChoiceAllowedByPlan: any;
declare const isCardChoiceAllowedByRisk: any;
declare const isCardChoiceAllowedByHighConfidence: any;
declare const selectCpuMoveWithPolicy: any;
declare const selectMoveFromOnnxPolicyAsync: any;
declare const generateMovesForPlayer: any;
declare const cpuMaybeDestroyHandCardWithPolicy: any;
declare const cpuMaybeUseCardWithPolicy: any;
declare const cpuSelectDestroyWithPolicy: any;
declare const cpuSelectStrongWindWillWithPolicy: any;
declare const cpuSelectSuperBuoyancyWillWithPolicy: any;
declare const cpuSelectSuperGravityWillWithPolicy: any;
declare const cpuSelectSuperAttractionWillWithPolicy: any;
declare const cpuSelectHeavenBlessingWithPolicy: any;
declare const cpuSelectCondemnWillWithPolicy: any;
declare const cpuSelectObserverWillWithPolicy: any;
declare const cpuSelectSwapWithEnemyWithPolicy: any;
declare const cpuSelectPositionSwapWillWithPolicy: any;
declare const cpuSelectTrapWillWithPolicy: any;
declare const cpuSelectGuardWillWithPolicy: any;
declare const cpuSelectLivingWillWithPolicy: any;
declare const cpuSelectHyperactiveInheritWillWithPolicy: any;
declare const cpuSelectExtendLifeWillWithPolicy: any;
declare const cpuSelectCorrosionWillWithPolicy: any;
declare const cpuSelectTeleportWillWithPolicy: any;
declare const cpuSelectCellTeleportWillWithPolicy: any;
declare const cpuSelectTemptWillWithPolicy: any;
declare const cpuSelectCaptureWillWithPolicy: any;
declare const cpuSelectTimeBombWithPolicy: any;
declare const cpuSelectBoardExpansionWillWithPolicy: any;
declare const cpuSelectBoardShrinkWillWithPolicy: any;
declare const cpuSelectBlockadeWillWithPolicy: any;
declare const cpuSelectMeteorWillWithPolicy: any;
declare const cpuSelectFreezeWillWithPolicy: any;
declare const cpuSelectSeedWillWithPolicy: any;
declare const cpuSelectCloneWillWithPolicy: any;
declare const cpuSelectReverseWillWithPolicy: any;

// CPU turn orchestration extracted from turn-manager

// TimerService DI
let cpuTurnTimerService: any = null;
function setCpuTurnTimerService(service: any): void { cpuTurnTimerService = service; }
function getCpuTurnTimerService() {
    return cpuTurnTimerService || null;
}
function readCpuTurnNowMs(): number {
    if (__uiImpl_cpu && typeof __uiImpl_cpu.recordCpuTurnStage === 'function'
        && typeof __uiImpl_cpu.readCpuTurnPerformanceNowMs === 'function') {
        try {
            const performanceValue = Number(__uiImpl_cpu.readCpuTurnPerformanceNowMs());
            if (Number.isFinite(performanceValue)) return performanceValue;
        } catch (_error) { /* fall through */ }
    }
    const timerService = getCpuTurnTimerService();
    if (timerService && typeof timerService.now === 'function') {
        const value = Number(timerService.now());
        if (Number.isFinite(value)) return value;
    }
    return Date.now();
}

function readInjectedCpuTurnPerformanceNowMs(): number {
    if (!getCpuTurnPerformanceRecorder()) return Number.NaN;
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readCpuTurnPerformanceNowMs === 'function') {
            const value = Number(__uiImpl_cpu.readCpuTurnPerformanceNowMs());
            if (Number.isFinite(value)) return Math.max(0, value);
        }
    } catch (_error) { /* invalid performance sample */ }
    return Number.NaN;
}

// Timers abstraction (injected by UI)
let timers: any = null;
if (typeof require === 'function') {
    try { timers = _require('./timers'); } catch (e) { /* ignore */ }
}
let moveGenerator: any = null;
if (typeof require === 'function') {
    try { moveGenerator = _require('./move-generator'); } catch (e) { /* ignore */ }
}
function requireCpuTurnHandlerModuleOrNull(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const PendingSelectionRegistryForCpu = requireCpuTurnHandlerModuleOrNull('./logic/cards-internal/pending-selection-registry');
const CpuTurnControllerEvents = requireCpuTurnHandlerModuleOrNull('./controller-events');
const CpuTurnSchedulerModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-scheduler');
const CpuTurnPresentationRuntimeModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-presentation-runtime');
const CpuTurnCardPhaseModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-card-phase');
const CpuTurnPendingPhaseModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-pending-phase');
const CpuTurnMovePhaseModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-move-phase');
const CpuTurnAnalysisModule = requireCpuTurnHandlerModuleOrNull('./cpu-turn-analysis');
const CpuDecisionRuntimeModule = requireCpuTurnHandlerModuleOrNull('./cpu-decision');
const CpuRuntimeBoundaryModule = requireCpuTurnHandlerModuleOrNull('./cpu-decision-runtime');
let cardEffectsHelpers: any = null;
if (typeof require === 'function') {
    try { cardEffectsHelpers = _require('./card-effects/helpers'); } catch (e) { /* ignore */ }
}
let specialEffectsHelpers: any = null;
if (typeof require === 'function') {
    try { specialEffectsHelpers = _require('./special-effects/helpers'); } catch (e) { /* ignore */ }
}
let cpuCommentaryRuntime: any = null;
let commentaryContextHelpers: any = null;
if (typeof require === 'function') {
    try { commentaryContextHelpers = _require('../shared/commentary-context-helpers'); } catch (e) { /* ignore */ }
}
let sharedBoardUtilsForCpuTurn: any = null;
if (typeof require === 'function') {
    try { sharedBoardUtilsForCpuTurn = _require('../shared/shared-board-utils'); } catch (e) { /* ignore */ }
}
let commentaryRuntimeHelpers: any = null;
if (typeof require === 'function') {
    try { commentaryRuntimeHelpers = _require('../shared/commentary-runtime-helpers'); } catch (e) { /* ignore */ }
}
let cpuCardLogic: any = null;
if (typeof require === 'function') {
    try { cpuCardLogic = _require('./logic/cards'); } catch (e) { /* ignore */ }
}
let pendingCoordinator: any = null;
if (typeof require === 'function') {
    try { pendingCoordinator = _require('./turn/pending-coordinator'); } catch (e) { /* ignore */ }
}
let cpuLv6RuntimeCapability: any = null;
if (typeof require === 'function') {
    try { cpuLv6RuntimeCapability = _require('../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}
let CpuOpponentProfiles: any = null;
if (typeof require === 'function') {
    try { CpuOpponentProfiles = _require('../shared/cpu-opponent-profiles'); } catch (e) { /* ignore */ }
}

// ===== Module-level DI (replaces globalThis reads for bootstrap flags) =====
let __uiImpl_cpu: Record<string, any> = {};
let cpuTurnPerformanceRunSequence = 0;
let cpuTurnInvocationRunSequence = 0;
let cpuTurnDecisionEpochSequence = 0;
let cpuRuntimeIntegrityFailure: unknown = null;
const lv10RecentDecisions: Lv10TurnRecord[] = [];
const lv10DecisionTotals = { decisions: 0, fallback: 0, rejected: 0, stale: 0, noAction: 0 };
const lv10RejectedActions: Record<PlayerKey, NonNullable<Lv10TurnDeps['rejectedActions']>> = {
    black: { identity: null, actions: [] }, white: { identity: null, actions: [] }
};
const lv11RecentDecisions: Lv10TurnRecord[] = [];
const lv11DecisionTotals = { decisions: 0, fallback: 0, rejected: 0, stale: 0, noAction: 0 };
const lv11RejectedActions: Record<PlayerKey, NonNullable<Lv10TurnDeps['rejectedActions']>> = {
    black: { identity: null, actions: [] }, white: { identity: null, actions: [] }
};
const lv12RecentDecisions: Lv10TurnRecord[] = [];
const lv12DecisionTotals = { decisions: 0, fallback: 0, rejected: 0, stale: 0, noAction: 0 };
const lv12RejectedActions: Record<PlayerKey, NonNullable<Lv10TurnDeps['rejectedActions']>> = {
    black: { identity: null, actions: [] }, white: { identity: null, actions: [] }
};
// Presentation and extra-action handoffs may release the shared processing flag
// while an advisory action is still awaiting completion. Keep the Lv10 request
// exclusive through that completion; a reset cannot release an older request.
let advisedTurnInFlight = false;
function getLv10DecisionDiagnostics() {
    return { totals: { ...lv10DecisionTotals }, recent: lv10RecentDecisions.slice() };
}
function getLv11DecisionDiagnostics() {
    return { totals: { ...lv11DecisionTotals }, recent: lv11RecentDecisions.slice() };
}
function getLv12DecisionDiagnostics() {
    return { totals: { ...lv12DecisionTotals }, recent: lv12RecentDecisions.slice() };
}
function setCpuUIImpl(obj: any): void {
    if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
        __uiImpl_cpu = {};
        return;
    }
    __uiImpl_cpu = Object.assign({}, __uiImpl_cpu, obj || {});
}

function isCpuRuntimeIntegrityBlocked(): boolean {
    if (cpuRuntimeIntegrityFailure !== null) return true;
    if (!__uiImpl_cpu || typeof __uiImpl_cpu.isCardRuntimeIntegrityBlocked !== 'function') return false;
    try { return __uiImpl_cpu.isCardRuntimeIntegrityBlocked() === true; } catch (_error) { return true; }
}

function stopCpuForRuntimeIntegrityIfBlocked(): boolean {
    if (!isCpuRuntimeIntegrityBlocked()) return false;
    if (CpuTurnScheduler && typeof CpuTurnScheduler.resetCpuTurnHandlerState === 'function') {
        CpuTurnScheduler.resetCpuTurnHandlerState();
    }
    setCpuProcessing(false);
    return true;
}

function getCpuTurnPerformanceRecorder(): CpuTurnPerformanceRecorder | null {
    return __uiImpl_cpu && typeof __uiImpl_cpu.recordCpuTurnStage === 'function'
        ? __uiImpl_cpu.recordCpuTurnStage
        : null;
}

function createCpuTurnPerformanceCorrelationId(): string | null {
    if (!getCpuTurnPerformanceRecorder()) return null;
    try {
        const value = __uiImpl_cpu && typeof __uiImpl_cpu.createCpuTurnPerformanceCorrelationId === 'function'
            ? __uiImpl_cpu.createCpuTurnPerformanceCorrelationId()
            : null;
        const normalized = String(value || '').trim();
        return normalized || null;
    } catch (_error) {
        return null;
    }
}

function createRunPerformanceScope(
    playerKey: PlayerKey,
    level: any,
    options: any
): CpuTurnPerformanceScope | null {
    const recorder = getCpuTurnPerformanceRecorder();
    if (!recorder) return null;
    const correlationId = readCpuTurnPerformanceCorrelationId(options) || createCpuTurnPerformanceCorrelationId();
    if (!correlationId) return null;
    cpuTurnPerformanceRunSequence += 1;
    return createCpuTurnPerformanceScope({
        recorder,
        correlationId,
        runId: cpuTurnPerformanceRunSequence,
        playerKey,
        level,
        readNowMs: readInjectedCpuTurnPerformanceNowMs
    });
}

const CpuTurnRuntimeBoundary = (CpuRuntimeBoundaryModule && typeof CpuRuntimeBoundaryModule.createCpuTurnRuntimeBoundary === 'function')
    ? CpuRuntimeBoundaryModule.createCpuTurnRuntimeBoundary({
        getUiImpl: () => __uiImpl_cpu,
        getFallbackCardLogic: () => cpuCardLogic
    })
    : null;
const ANIMATION_RETRY_DELAY_MS = 80;

// Local safe constants to avoid ReferenceError for undeclared runtime constants in test environments
const CONST_BLACK = (typeof BLACK !== 'undefined') ? BLACK : 1;
const CONST_WHITE = (typeof WHITE !== 'undefined') ? WHITE : -1;

function getAnimationRetryDelayMs() {
    return ANIMATION_RETRY_DELAY_MS;
}

function getActiveProtectionSafe(playerValue: any) {
    try {
        const fn = cardEffectsHelpers && typeof cardEffectsHelpers.getActiveProtectionForPlayer === 'function'
            ? cardEffectsHelpers.getActiveProtectionForPlayer
            : null;
        if (fn) {
            return fn(playerValue) || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getFlipBlockersSafe() {
    try {
        const fn = specialEffectsHelpers && typeof specialEffectsHelpers.getFlipBlockers === 'function'
            ? specialEffectsHelpers.getFlipBlockers
            : null;
        if (fn) {
            return fn() || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getCurrentPlayerKeySafe(): PlayerKey | null {
    try {
        const runtimeGameState = resolveRuntimeValue('gameState');
        const current = runtimeGameState && typeof runtimeGameState === 'object'
            ? runtimeGameState.currentPlayer
            : (gameState ? gameState.currentPlayer : null);
        if (current === CONST_BLACK || current === 'black') return 'black';
        if (current === CONST_WHITE || current === 'white') return 'white';
    } catch (e) { /* ignore */ }
    return null;
}

function getCurrentTurnNumberSafe() {
    try {
        const runtimeGameState = resolveRuntimeValue('gameState');
        const turnNumber = runtimeGameState && typeof runtimeGameState === 'object'
            ? runtimeGameState.turnNumber
            : (gameState ? gameState.turnNumber : null);
        return Number.isFinite(turnNumber) ? turnNumber : null;
    } catch (e) { /* ignore */ }
    return null;
}

function resolveRuntimeFunction(name: string): Function | null {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.resolveRuntimeFunction === 'function'
        ? CpuTurnRuntimeBoundary.resolveRuntimeFunction(name)
        : null;
}

function getCurrentStateVersionSafe(): number | string | null {
    try {
        const injected = __uiImpl_cpu && typeof __uiImpl_cpu.readCpuStateVersion === 'function'
            ? __uiImpl_cpu.readCpuStateVersion()
            : null;
        if (Number.isSafeInteger(injected) && Number(injected) >= 0) return Number(injected);
        if (typeof injected === 'string' && injected.length > 0 && injected.length <= 160) return injected;
        const runtimeGameState = resolveRuntimeValue('gameState');
        const value = runtimeGameState && typeof runtimeGameState === 'object'
            ? runtimeGameState.stateVersion
            : (gameState && typeof gameState === 'object' ? (gameState as any).stateVersion : null);
        if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
        if (typeof value === 'string' && value.length > 0 && value.length <= 160) return value;
        const runtimeCardState = resolveRuntimeValue('cardState');
        const turnIndex = runtimeCardState && typeof runtimeCardState === 'object'
            ? runtimeCardState.turnIndex
            : (cardState && typeof cardState === 'object' ? (cardState as any).turnIndex : null);
        if (Number.isSafeInteger(turnIndex) && Number(turnIndex) >= 0) {
            return `local-turn:${Number(turnIndex)}`;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function emitCpuTurnLogAdded(message: any, kind?: string): boolean {
    try {
        const runtimeEmitLogAdded = resolveRuntimeFunction('emitLogAdded');
        if (typeof runtimeEmitLogAdded === 'function') {
            if (typeof kind === 'undefined') runtimeEmitLogAdded(message);
            else runtimeEmitLogAdded(message, kind);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (CpuTurnControllerEvents && typeof CpuTurnControllerEvents.emitLogAdded === 'function') {
            CpuTurnControllerEvents.emitLogAdded(message, kind);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function showCpuResultIfAvailable(): boolean {
    const showResultFn = resolveRuntimeFunction('showResult');
    if (typeof showResultFn !== 'function') return false;
    try {
        showResultFn();
        return true;
    } catch (e) { /* ignore */ }
    return false;
}

function resolveGenerateMovesForPlayer(): Function | null {
    const runtimeFn = resolveRuntimeFunction('generateMovesForPlayer');
    if (runtimeFn) return runtimeFn;
    if (moveGenerator && typeof moveGenerator.generateMovesForPlayer === 'function') {
        return moveGenerator.generateMovesForPlayer;
    }
    return null;
}
function resolveRuntimeValue(name: string): any {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.resolveRuntimeValue === 'function'
        ? CpuTurnRuntimeBoundary.resolveRuntimeValue(name)
        : undefined;
}

function clampCpuLevelForTurn(value: any): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(6, Math.floor(n)));
}

function readCpuProfileValueForTurn(playerKey: PlayerKey): any {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readCpuSmartness === 'function') {
            const profileValues = __uiImpl_cpu.readCpuSmartness();
            if (profileValues && Object.prototype.hasOwnProperty.call(profileValues, playerKey)) {
                return profileValues[playerKey];
            }
        }
    } catch (e) { /* ignore */ }

    const cpuProfileValuesRef = resolveRuntimeValue('cpuSmartness')
        || (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (cpuProfileValuesRef && Object.prototype.hasOwnProperty.call(cpuProfileValuesRef, playerKey)) {
        return cpuProfileValuesRef[playerKey];
    }
    return null;
}

function resolveCpuDecisionFunction(name: string): Function | null {
    const runtimeFn = resolveRuntimeFunction(name);
    if (runtimeFn) return runtimeFn;
    try {
        if (CpuDecisionRuntimeModule && typeof CpuDecisionRuntimeModule[name] === 'function') {
            return CpuDecisionRuntimeModule[name];
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function') {
            return (globalThis as any)[name];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuRuntimeSelectionForTurn(playerKey: PlayerKey): any {
    const profileValue = readCpuProfileValueForTurn(playerKey);
    if (CpuOpponentProfiles && typeof CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection === 'function') {
        return CpuOpponentProfiles.resolveCpuOpponentRuntimeSelection(profileValue);
    }
    return null;
}

function resolveCpuDecisionLevelForTurn(playerKey: PlayerKey): number {
    const profileValue = readCpuProfileValueForTurn(playerKey);
    const selection = resolveCpuRuntimeSelectionForTurn(playerKey);
    const controller = (resolveRuntimeValue('cardState') || ((typeof cardState !== 'undefined') ? cardState : null))?.fateWillControllerByTurnOwner?.[playerKey];
    if (controller && controller !== playerKey) {
        const controllerSelection = resolveCpuRuntimeSelectionForTurn(controller);
        if ([10, 11, 12].includes(selection?.decisionLevel) || [10, 11, 12].includes(controllerSelection?.decisionLevel)) {
            return controllerSelection?.decisionLevel || 1;
        }
    }
    if (selection && Number.isFinite(Number(selection.decisionLevel))) {
        return Math.max(1, Math.floor(Number(selection.decisionLevel)));
    }
    return clampCpuLevelForTurn(profileValue);
}

function shouldSkipCardPhaseForProfile(playerKey: PlayerKey): boolean {
    const profileValue = readCpuProfileValueForTurn(playerKey);
    const turnNumber = getCurrentTurnNumberSafe();
    if (CpuOpponentProfiles && typeof CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase === 'function') {
        return !!CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase(profileValue, turnNumber);
    }
    const selection = resolveCpuRuntimeSelectionForTurn(playerKey);
    if (!selection || !Number.isFinite(Number(selection.cardUseUnlockTurnNumber))) return false;
    if (!Number.isFinite(Number(turnNumber))) return false;
    return Number(turnNumber) < Math.max(0, Math.floor(Number(selection.cardUseUnlockTurnNumber)));
}

function resolveCpuCardLogic() {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.resolveCpuCardLogic === 'function'
        ? CpuTurnRuntimeBoundary.resolveCpuCardLogic()
        : null;
}

function applyCpuRuntimeStatePatch(nextCardState: any, nextGameState: any) {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.applyRuntimeStatePatch === 'function') {
            __uiImpl_cpu.applyRuntimeStatePatch(nextCardState, nextGameState);
            return;
        }
    } catch (e) { /* ignore */ }
    if (nextCardState) {
        try {
            if (cardState && typeof cardState === 'object') {
                for (const key of Object.keys(cardState)) delete cardState[key];
                Object.assign(cardState, nextCardState);
            }
        } catch (e) { /* ignore */ }
    }
    if (nextGameState) {
        try {
            if (gameState && typeof gameState === 'object') {
                for (const key of Object.keys(gameState)) delete gameState[key];
                Object.assign(gameState, nextGameState);
            }
        } catch (e) { /* ignore */ }
    }
}

function tryDestroyHighPriorityHandCardViaAdapter(playerKey: PlayerKey): boolean {
    const cardLogicRef = resolveCpuCardLogic();
    const adapter = resolveRuntimeValue('TurnPipelineUIAdapter');
    const pipeline = resolveRuntimeValue('TurnPipeline');
    if (!cardLogicRef || !adapter || typeof adapter.runTurnWithAdapter !== 'function') return false;
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return false;
    const hand = cardState.hands[playerKey];
    const destroyCardId = hand.find((cardId: any) => {
        const def = typeof cardLogicRef.getCardDef === 'function' ? cardLogicRef.getCardDef(cardId) : null;
        const type = String(def && def.type || '').trim();
        return type === 'FATE_WILL';
    });
    if (!destroyCardId) return false;
    const action = { type: 'destroy_hand_card', destroyCardId };
    const result = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline || {});
    if (!result || result.ok !== true) return false;
    applyCpuRuntimeStatePatch(result.nextCardState, result.nextGameState);
    return true;
}

function resolvePendingCoordinatorForCpu() {
    if (pendingCoordinator && typeof pendingCoordinator === 'object') return pendingCoordinator;
    return null;
}

function resolvePendingSelectionDispatchKeyForCpu(pendingType: any) {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (!coordinator || typeof coordinator.resolvePendingSelectionDispatchKey !== 'function') return null;
    return coordinator.resolvePendingSelectionDispatchKey(pendingType);
}

function readCpuPendingSelection(
    playerKey: PlayerKey,
    cardStateRef: any = resolveCurrentCpuCardState()
) {
    if (!cardStateRef || typeof cardStateRef !== 'object') return null;
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.readPendingEffect === 'function') {
        return coordinator.readPendingEffect(cardStateRef, playerKey);
    }
    if (cardStateRef.pendingEffectByPlayer) {
        return cardStateRef.pendingEffectByPlayer[playerKey] || null;
    }
    return null;
}

function clearCpuPendingSelection(
    playerKey: PlayerKey,
    cardStateRef: any = resolveCurrentCpuCardState()
): boolean {
    if (!cardStateRef || typeof cardStateRef !== 'object') return false;
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.clearPendingEffect === 'function') {
        const result = coordinator.clearPendingEffect(cardStateRef, playerKey);
        return !!(result && result.ok);
    }
    if (cardStateRef.pendingEffectByPlayer) {
        cardStateRef.pendingEffectByPlayer[playerKey] = null;
        return true;
    }
    return false;
}

async function runOptionalCpuPendingSelectionHandler(handlerFn: any, playerKey: PlayerKey): Promise<void> {
    if (typeof handlerFn === 'function') {
        await handlerFn(playerKey);
        return;
    }
    clearCpuPendingSelection(playerKey);
}

function getFateWillControllerForTurnOwnerSafe(turnOwnerKey: PlayerKey, cardStateRef: CardState | null) {
    const cardStateValue = cardStateRef && typeof cardStateRef === 'object' ? cardStateRef : resolvePresentationCardState(null);
    const logic = resolveCpuCardLogic();
    if (logic && typeof logic.getFateWillControllerForTurnOwner === 'function') {
        try {
            return logic.getFateWillControllerForTurnOwner(cardStateValue, turnOwnerKey);
        } catch (e) { /* ignore */ }
    }
    if (!cardStateValue || !(cardStateValue as any).fateWillControllerByTurnOwner) return null;
    const controllerKey = (cardStateValue as any).fateWillControllerByTurnOwner[turnOwnerKey];
    if (controllerKey === 'black' || controllerKey === 'white') return controllerKey;
    return null;
}

function resolveCpuControlledTurnOwnerKey(): PlayerKey | null {
    const turnOwnerKey = getCurrentPlayerKeySafe();
    if (!turnOwnerKey) return null;
    const controllerKey = getFateWillControllerForTurnOwnerSafe(turnOwnerKey, null);
    const effectiveOperatorKey = controllerKey || turnOwnerKey;
    return effectiveOperatorKey === 'white' ? turnOwnerKey : null;
}

function readCpuMatchMode(): any {
    if (__uiImpl_cpu && typeof __uiImpl_cpu.readMatchMode === 'function') {
        try {
            const mode = __uiImpl_cpu.readMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (__uiImpl_cpu && typeof __uiImpl_cpu.getCurrentMatchMode === 'function') {
        try {
            const mode = __uiImpl_cpu.getCurrentMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (__uiImpl_cpu && typeof __uiImpl_cpu.MATCH_MODE !== 'undefined') {
        return __uiImpl_cpu.MATCH_MODE;
    }
    return null;
}

function readCpuHumanVsHumanFlag(): boolean {
    if (__uiImpl_cpu && typeof __uiImpl_cpu.readHumanVsHumanMode === 'function') {
        try { return __uiImpl_cpu.readHumanVsHumanMode() === true; } catch (e) { /* ignore */ }
    }
    if (__uiImpl_cpu && typeof __uiImpl_cpu.DEBUG_HUMAN_VS_HUMAN !== 'undefined') {
        return __uiImpl_cpu.DEBUG_HUMAN_VS_HUMAN === true;
    }
    return false;
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = readCpuHumanVsHumanFlag();
    const matchMode = String(readCpuMatchMode() || '').trim().toLowerCase();
    return debugHvH || matchMode === 'network';
}

function isOthelloModeForCpuTurnHandler() {
    const mode = String(readCpuMatchMode() || '').trim().toLowerCase();
    return mode === 'reversi' || mode === 'othello';
}

function readCpuTurnQuerySearch(): string {
    try {
        const readQuerySearch = (__uiImpl_cpu && typeof __uiImpl_cpu.readQuerySearch === 'function')
            ? __uiImpl_cpu.readQuerySearch
            : ((__uiImpl_cpu && typeof __uiImpl_cpu.readLocationSearch === 'function')
                ? __uiImpl_cpu.readLocationSearch
                : null);
        if (readQuerySearch) {
            const value = readQuerySearch();
            return typeof value === 'string' ? value : '';
        }
    } catch (e) { /* ignore */ }
    return '';
}

function shouldUseOthelloOnnxMoveDecisionForCpuTurnHandler() {
    if (!isOthelloModeForCpuTurnHandler()) return false;
    try {
        if (typeof process !== 'undefined' && process && process.env && process.env.CPU_DISABLE_OTHELLO_ONNX === '1') return false;
    } catch (e) { /* ignore */ }
    try {
        const qs = readCpuTurnQuerySearch();
        if (/[?&]othelloOnnx=(?:0|false)\b/i.test(qs) || /[?&]othello_onnx=(?:0|false)\b/i.test(qs)) return false;
    } catch (e) { /* ignore */ }
    return true;
}

function readCpuProcessing() {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.readProcessing === 'function'
        ? CpuTurnRuntimeBoundary.readProcessing()
        : false;
}

function setCpuProcessing(active: any) {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.setProcessing === 'function'
        ? CpuTurnRuntimeBoundary.setProcessing(active)
        : active === true;
}

function shouldAbortCpuForHumanMode(playerKey: any, context: any) {
    if (!isHumanVsHumanModeEnabled()) return false;
    resetPendingSelectRetryState(playerKey);
    setCpuProcessing(false);
    debugCpuTrace('[AI] abort CPU run in human-controlled mode', {
        playerKey,
        context: context || 'unknown'
    });
    return true;
}

function debugCpuTrace(message: any, meta?: any) {
    emitCpuDebugLog(message, 'debug', meta || {});
}

function isCpuDebugLogAvailable(): boolean {
    try {
        const isDebugAvailableFn = resolveRuntimeFunction('isDebugLogAvailable');
        if (typeof isDebugAvailableFn === 'function') {
            return isDebugAvailableFn() === true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (resolveRuntimeValue('DEBUG_CPU_LOG') === true) return true;
    } catch (e) { /* ignore */ }
    try {
        const qs = readCpuTurnQuerySearch();
        return /[?&]debug=(?:1|true)\b/i.test(qs);
    } catch (e) { /* ignore */ }
    return false;
}

function emitCpuDebugLog(message: any, level?: any, meta?: any) {
    try {
        if (isCpuDebugLogAvailable()) {
            const debugLogFn = resolveRuntimeFunction('debugLog');
            if (typeof debugLogFn === 'function') {
                debugLogFn(message, level || 'debug', meta || {});
            } else {
                console.log(message, meta || {});
            }
        }
    } catch (e) { /* ignore */ }
}

function isCpuFastBenchModeEnabled() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readBenchFastMode === 'function') {
            return __uiImpl_cpu.readBenchFastMode() === true;
        }
        if (__uiImpl_cpu && typeof __uiImpl_cpu.__BENCH_FAST_MODE !== 'undefined') {
            return __uiImpl_cpu.__BENCH_FAST_MODE === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function resolveCpuLv6SharedProfile() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.getCpuLv6SharedProfile === 'function') {
            const profile = __uiImpl_cpu.getCpuLv6SharedProfile();
            if (profile && typeof profile === 'object') return profile;
        }
        if (__uiImpl_cpu && __uiImpl_cpu.CPU_LV6_SHARED_PROFILE) {
            return __uiImpl_cpu.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const shared = _require('../constants/cpu-lv6-shared-profile.js');
            if (shared && typeof shared === 'object') return shared;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readExplicitCpuLv6SharedProfile() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.getCpuLv6SharedProfile === 'function') {
            const profile = __uiImpl_cpu.getCpuLv6SharedProfile();
            if (profile && typeof profile === 'object') return profile;
        }
        if (__uiImpl_cpu && __uiImpl_cpu.CPU_LV6_SHARED_PROFILE) {
            return __uiImpl_cpu.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuLv6RuntimeCapabilityModule() {
    if (
        cpuLv6RuntimeCapability &&
        typeof cpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
    ) {
        return cpuLv6RuntimeCapability;
    }
    try {
        if (typeof require === 'function') {
            cpuLv6RuntimeCapability = _require('../shared/cpu-lv6-runtime-capability');
            if (
                cpuLv6RuntimeCapability &&
                typeof cpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
            ) {
                return cpuLv6RuntimeCapability;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function shouldUseOnnxMoveDecision(level: any) {
    if (!Number.isFinite(level) || level < 6) return true;
    try {
        const qs = readCpuTurnQuerySearch();
        if (/[?&]othelloOnnx=(?:0|false)\b/i.test(qs) || /[?&]othello_onnx=(?:0|false)\b/i.test(qs)) return false;
    } catch (e) { /* ignore */ }
    if (shouldUseOthelloOnnxMoveDecisionForCpuTurnHandler()) return true;
    const shared = readExplicitCpuLv6SharedProfile() || resolveCpuLv6SharedProfile();
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    if (shared && capabilityModule) {
        if (typeof capabilityModule.shouldUseCpuLv6OnnxMoveDecision === 'function') {
            return capabilityModule.shouldUseCpuLv6OnnxMoveDecision(shared);
        }
        if (typeof capabilityModule.resolveCpuLv6BrowserRuntimeCapability === 'function') {
            const capability = capabilityModule.resolveCpuLv6BrowserRuntimeCapability(shared);
            if (capability && typeof capability.usesOnnxMoveDecision === 'boolean') {
                return capability.usesOnnxMoveDecision === true;
            }
        }
    }
    return true;
}

function resolveLv6MinThinkMs(playerKey: any, level: any, autoMode: any) {
    if (autoMode) return 0;
    if (!Number.isFinite(level) || level < 6) return 0;
    if (playerKey !== 'white') return 0;
    if (isCpuFastBenchModeEnabled()) return 0;
    try {
        const shared = resolveCpuLv6SharedProfile();
        const configured = Number(shared && shared.browser && shared.browser.minThinkMsWhite);
        if (Number.isFinite(configured) && configured >= 0) {
            return Math.floor(configured);
        }
    } catch (e) { /* ignore */ }
    try {
        const override = (__uiImpl_cpu && typeof __uiImpl_cpu.readCpuLv6MinThinkMs === 'function')
            ? __uiImpl_cpu.readCpuLv6MinThinkMs()
            : (__uiImpl_cpu ? __uiImpl_cpu.CPU_LV6_MIN_THINK_MS : undefined);
        if (Number.isFinite(Number(override))) {
            return Math.max(0, Math.floor(Number(override)));
        }
    } catch (e) { /* ignore */ }
    return 250;
}

function resolveCpuCommentaryRuntime() {
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeFromGlobal === 'function') {
        const runtimeRoot = (__uiImpl_cpu && typeof __uiImpl_cpu.getCommentaryRuntimeRoot === 'function')
            ? __uiImpl_cpu.getCommentaryRuntimeRoot()
            : null;
        const globalRuntime = runtimeRoot
            ? runtimeHelpers.resolveCommentaryRuntimeFromGlobal(runtimeRoot)
            : null;
        if (globalRuntime) {
            cpuCommentaryRuntime = globalRuntime;
            return cpuCommentaryRuntime;
        }
    }
    if (runtimeHelpers && typeof runtimeHelpers.hasCommentaryRuntime === 'function' && runtimeHelpers.hasCommentaryRuntime(cpuCommentaryRuntime)) {
        return cpuCommentaryRuntime;
    }
    if (cpuCommentaryRuntime && typeof cpuCommentaryRuntime.requestCommentary === 'function') {
        return cpuCommentaryRuntime;
    }

    const requiredRuntimes = [];
    if (typeof _require === 'function') {
        for (const moduleId of [
            './ai/cpu-commentary-runtime',
            './ai/cpu-commentary-runtime.js',
            '../dist/game/ai/cpu-commentary-runtime'
        ]) {
            try {
                const runtime = _require(moduleId);
                if (runtime && typeof runtime.requestCommentary === 'function') {
                    requiredRuntimes.push(runtime);
                }
            } catch (e) { /* ignore */ }
        }
        const mockedRuntime = requiredRuntimes.find((runtime) => !!(
            runtime &&
            runtime.requestCommentary &&
            runtime.requestCommentary._isMockFunction === true
        ));
        if (mockedRuntime) {
            cpuCommentaryRuntime = mockedRuntime;
            return cpuCommentaryRuntime;
        }
        if (requiredRuntimes.length > 0) {
            cpuCommentaryRuntime = requiredRuntimes[0];
            return cpuCommentaryRuntime;
        }
    }
    try {
        if (typeof require === 'function') {
            const direct = _require('./ai/cpu-commentary-runtime');
            if (direct && typeof direct.requestCommentary === 'function') {
                cpuCommentaryRuntime = direct;
                return cpuCommentaryRuntime;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryContextHelpers() {
    if (commentaryContextHelpers) return commentaryContextHelpers;
    try {
        if (typeof require === 'function') {
            commentaryContextHelpers = _require('../shared/commentary-context-helpers');
            if (commentaryContextHelpers) return commentaryContextHelpers;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryRuntimeHelpers() {
    if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
    try {
        if (typeof require === 'function') {
            commentaryRuntimeHelpers = _require('../shared/commentary-runtime-helpers');
            if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveSharedBoardUtilsForCpuTurn() {
    if (sharedBoardUtilsForCpuTurn) return sharedBoardUtilsForCpuTurn;
    try {
        if (typeof require === 'function') {
            sharedBoardUtilsForCpuTurn = _require('../shared/shared-board-utils');
            if (sharedBoardUtilsForCpuTurn) return sharedBoardUtilsForCpuTurn;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCurrentCpuGameStateForBoard() {
    const runtimeGameState = resolveRuntimeValue('gameState');
    if (runtimeGameState && typeof runtimeGameState === 'object') return runtimeGameState;
    try {
        return (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object')
            ? gameState
            : null;
    } catch (e) {
        if (isCardRuntimeUnavailableError(e)) throw e;
        return null;
    }
}

function resolveCurrentCpuCardState() {
    const runtimeCardState = resolveRuntimeValue('cardState');
    if (runtimeCardState && typeof runtimeCardState === 'object') return runtimeCardState;
    try {
        return (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            ? cardState
            : null;
    } catch (e) {
        if (isCardRuntimeUnavailableError(e)) throw e;
        return null;
    }
}

function createCpuTurnBoardContext(state: any, cardStateRef: any) {
    const boardUtils = resolveSharedBoardUtilsForCpuTurn();
    if (
        !state ||
        typeof state !== 'object' ||
        !boardUtils ||
        typeof boardUtils.createBoardContext !== 'function'
    ) {
        return null;
    }
    try {
        return boardUtils.createBoardContext(state, cardStateRef);
    } catch (e) {
        if (isCardRuntimeUnavailableError(e)) throw e;
        return null;
    }
}

function countDiscsFromCpuBoardContext(boardContext: any) {
    const boardUtils = resolveSharedBoardUtilsForCpuTurn();
    if (
        boardContext &&
        boardUtils &&
        typeof boardUtils.countDiscsByPlayer === 'function'
    ) {
        const counts = boardUtils.countDiscsByPlayer(boardContext);
        if (counts && Number.isFinite(counts.black) && Number.isFinite(counts.white)) {
            return { black: Number(counts.black), white: Number(counts.white) };
        }
    }
    return { black: 0, white: 0 };
}

function countOwnedEffectiveCornersSafe(state: any, playerKey: any) {
    const boardUtils = resolveSharedBoardUtilsForCpuTurn();
    const boardContext = createCpuTurnBoardContext(state, resolveCurrentCpuCardState());
    if (
        !boardContext ||
        !boardUtils ||
        typeof boardUtils.countCornerControl !== 'function'
    ) {
        return 0;
    }
    const ownValue = playerKey === 'black' ? CONST_BLACK : CONST_WHITE;
    const control = boardUtils.countCornerControl(boardContext, ownValue);
    return Number(control && control.ownCorners) || 0;
}

function resolvePhaseByTurn(turnNumber: any, occupiedCells: any) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
        return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
    }
    return 'middle';
}

function resolveAdvantageLabel(playerKey: any, counts: any, options?: any) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
        return helpers.resolveAdvantageLabel(playerKey, counts, options);
    }
    return 'even';
}

function getLastUsedCardIdSafe(playerKey: any) {
    try {
        if (cardState && cardState.lastUsedCardByPlayer) {
            return cardState.lastUsedCardByPlayer[playerKey] || null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryCpuLevel(playerKey: any, explicitLevel: any) {
    const direct = Number(explicitLevel);
    if (Number.isFinite(direct) && direct >= 1) return Math.max(1, Math.floor(direct));

    try {
        if (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey])) {
            return Math.max(1, Math.floor(cpuSmartness[playerKey]));
        }
    } catch (e) { /* ignore */ }

    return 1;
}

function emitCpuCommentary(eventType: any, playerKey: any, extra: any, analysisOptions?: any) {
    const runtime = resolveCpuCommentaryRuntime();
    if (!runtime || typeof runtime.requestCommentary !== 'function') return;
    if (typeof runtime.isEnabled === 'function') {
        try {
            if (runtime.isEnabled() !== true) return;
        } catch (e) { /* use the established request fallback */ }
    }

    const helpers = resolveCommentaryContextHelpers();
    let preparedMetrics: any = null;
    try {
        const invocation = analysisOptions && analysisOptions.invocation;
        const snapshotMoment = analysisOptions && analysisOptions.snapshotMoment;
        if (invocation && typeof invocation.deriveCommentaryAnalysis === 'function' && snapshotMoment) {
            const analysis = invocation.deriveCommentaryAnalysis(snapshotMoment);
            preparedMetrics = analysis && analysis.metrics ? analysis.metrics : null;
        }
    } catch (e) { /* fall back to the existing commentary context path */ }
    const gameStateRef = resolveCurrentCpuGameStateForBoard();
    const cardStateRef = resolveCurrentCpuCardState();
    const boardContext = createCpuTurnBoardContext(gameStateRef, cardStateRef);
    if (
        !preparedMetrics &&
        helpers &&
        typeof helpers.buildCpuCommentaryMetrics === 'function'
    ) {
        preparedMetrics = helpers.buildCpuCommentaryMetrics({
            gameState: gameStateRef,
            cardState: cardStateRef,
            board: boardContext,
            turnNumber: gameStateRef && gameStateRef.turnNumber,
            playerKey
        });
    }
    const counts = preparedMetrics && preparedMetrics.counts
        ? preparedMetrics.counts
        : countDiscsFromCpuBoardContext(boardContext);
    const turnNumber = preparedMetrics && preparedMetrics.turnNumber !== null
        && Number.isFinite(Number(preparedMetrics.turnNumber))
        ? Number(preparedMetrics.turnNumber)
        : (gameStateRef && Number.isFinite(gameStateRef.turnNumber) ? gameStateRef.turnNumber : null);
    const commentaryLevel = resolveCommentaryCpuLevel(playerKey, extra && extra.level);
    const fallbackContext = Object.assign({
        eventType: String(eventType || 'turn_start'),
        playerKey: playerKey === 'black' ? 'black' : 'white',
        turnNumber,
        board: boardContext,
        phase: preparedMetrics && preparedMetrics.phase
            ? preparedMetrics.phase
            : resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
        advantage: preparedMetrics && preparedMetrics.advantage
            ? preparedMetrics.advantage
            : resolveAdvantageLabel(playerKey, counts),
        counts,
        occupiedCells: (counts.black || 0) + (counts.white || 0),
        level: commentaryLevel,
        cpuLevel: commentaryLevel,
        difficultyLevel: commentaryLevel,
        legalMovesCount: Number.isFinite(extra && extra.legalMovesCount) ? extra.legalMovesCount : null,
        cardId: (extra && extra.cardId) ? String(extra.cardId) : null,
        pendingType: (extra && extra.pendingType) ? String(extra.pendingType) : null
    }, extra || {});
    const context = (helpers && typeof helpers.buildCommentaryContext === 'function')
        ? helpers.buildCommentaryContext({
            eventType,
            playerKey,
            turnNumber,
            counts,
            gameState: gameStateRef,
            cardState: cardStateRef,
            board: boardContext,
            preparedMetrics,
            cardId: extra && extra.cardId,
            extra: Object.assign({
                level: commentaryLevel,
                cpuLevel: commentaryLevel,
                difficultyLevel: commentaryLevel,
                legalMovesCount: Number.isFinite(extra && extra.legalMovesCount) ? extra.legalMovesCount : null,
                pendingType: (extra && extra.pendingType) ? String(extra.pendingType) : null
            }, extra || {})
        })
        : fallbackContext;

    runtime.requestCommentary(context).then((text: any) => {
        const entry = formatPresentationCommentaryResult(playerKey, text);
        if (!entry) return;
        emitCpuTurnLogAdded(Object.assign({
            kind: 'commentary',
            speakerRole: 'cpu'
        }, entry));
    }).catch(() => {
        // Ignore commentary failures to keep turn processing deterministic.
    });
}

function normalizePresentationPlayerKey(value: any, fallbackKey: any) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.normalizePlayerKey === 'function') {
        return helpers.normalizePlayerKey(value, fallbackKey);
    }
    if (value === 'white' || value === CONST_WHITE || value === -1 || value === '-1') return 'white';
    if (value === 'black' || value === CONST_BLACK || value === 1 || value === '1') return 'black';
    return fallbackKey === 'white' ? 'white' : 'black';
}

function resolvePresentationGameState(options: { gameState?: GameState | null } | null): GameState | null {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.gameState && typeof opts.gameState === 'object') return opts.gameState;
    const runtimeGameState = resolveRuntimeValue('gameState');
    if (runtimeGameState && typeof runtimeGameState === 'object') return runtimeGameState;
    try {
        return gameState || null;
    } catch (e) { /* ignore */ }
    return null;
}

function resolvePresentationCardState(cardStateRef: CardState | null | undefined): CardState | null {
    if (cardStateRef && typeof cardStateRef === 'object') return cardStateRef;
    const runtimeCardState = resolveRuntimeValue('cardState');
    if (runtimeCardState && typeof runtimeCardState === 'object') return runtimeCardState;
    try {
        return cardState || null;
    } catch (e) { /* ignore */ }
    return null;
}

function getCurrentPlayerKeyFromState(state: GameState | null): PlayerKey | null {
    try {
        const current = state ? state.currentPlayer : null;
        if (current === CONST_BLACK || current === 'black') return 'black';
        if (current === CONST_WHITE || current === 'white') return 'white';
    } catch (e) { /* ignore */ }
    return null;
}

function getTurnNumberFromState(state: GameState | null): number | null {
    try {
        const turnNumber = state ? (state as any).turnNumber : null;
        return Number.isFinite(turnNumber) ? turnNumber : null;
    } catch (e) { /* ignore */ }
    return null;
}

function formatPresentationCommentaryResult(playerKey: any, text: any) {
    const line = String(text || '').trim();
    if (!line) return null;
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    const prefix = (runtimeHelpers && typeof runtimeHelpers.getCpuSpeakerPrefix === 'function')
        ? runtimeHelpers.getCpuSpeakerPrefix(playerKey)
        : (playerKey === 'black' ? '黒CPU' : '白CPU');
    return {
        kind: 'commentary',
        speakerRole: 'cpu',
        playerKey,
        prefix,
        line,
        text: `${prefix}: ${line}`
    };
}

const presentationRuntime = CpuTurnPresentationRuntimeModule.createPresentationRuntime({
    normalizePlayerKey: normalizePresentationPlayerKey,
    resolveGameState: resolvePresentationGameState,
    resolveCardState: resolvePresentationCardState,
    getCurrentPlayerKeyFromState,
    getTurnNumberFromState,
    createBoardContext: createCpuTurnBoardContext,
    countBoardDiscs: countDiscsFromCpuBoardContext,
    resolveCommentaryContextHelpers,
    resolveCommentaryCpuLevel,
    resolvePhaseByTurn,
    resolveAdvantageLabel,
    resolveCommentaryRuntimeHelpers,
    resolveCpuCommentaryRuntime,
    formatCommentaryResult: formatPresentationCommentaryResult,
    isHumanVsHumanModeEnabled,
    getTimerService: () => getCpuTurnTimerService(),
    flushPresentationEvents: (state: any) => {
        const logic = resolveCpuCardLogic();
        if (logic && typeof logic.flushPresentationEvents === 'function') return logic.flushPresentationEvents(state);
        if (cpuCardLogic && typeof cpuCardLogic.flushPresentationEvents === 'function') return cpuCardLogic.flushPresentationEvents(state);
        return [];
    },
    processCpuTurn: () => processCpuTurn()
});

function selectCpuMoveSafe(
    candidateMoves: any,
    playerKey: any,
    candidateScoringPrecompute?: any,
    placementLookaheadPrecompute?: any
) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    try {
        const selectCpuMoveWithPolicyFn = resolveRuntimeFunction('selectCpuMoveWithPolicy')
            || (typeof selectCpuMoveWithPolicy === 'function' ? selectCpuMoveWithPolicy : null);
        if (typeof selectCpuMoveWithPolicyFn === 'function') {
            const selected = selectCpuMoveWithPolicyFn(
                candidateMoves,
                playerKey,
                candidateScoringPrecompute,
                placementLookaheadPrecompute
            );
            if (selected && Number.isFinite(selected.row) && Number.isFinite(selected.col)) {
                return selected;
            }
        }
    } catch (e) {
        debugCpuTrace('[AI] selectCpuMoveWithPolicy failed; fallback to first candidate', {
            playerKey,
            error: e && (e as any).message ? (e as any).message : String(e)
        });
    }
    // Test/headless fallback: keep deterministic behavior instead of throwing.
    return candidateMoves[0];
}

// Allow injection of timers for tests and for alternate scheduler implementations
function setTimers(t: any): void {
    timers = t;
}
function getTimers(): any { return timers; }

function isUiAnimationBusy() {
    return CpuTurnRuntimeBoundary && typeof CpuTurnRuntimeBoundary.isAnimationBusy === 'function'
        ? CpuTurnRuntimeBoundary.isAnimationBusy()
        : false;
}
const CpuTurnScheduler = (CpuTurnSchedulerModule && typeof CpuTurnSchedulerModule.createCpuTurnScheduler === 'function')
    ? CpuTurnSchedulerModule.createCpuTurnScheduler({
        debugCpuTrace,
        getAnimationRetryDelayMs,
        getCurrentPlayerKeySafe,
        getCurrentTurnNumberSafe,
        getCpuTurnPerformanceRecorder,
        getTimerService: () => getCpuTurnTimerService(),
        getTimers,
        createCpuTurnPerformanceCorrelationId,
        readNowMs: () => readInjectedCpuTurnPerformanceNowMs(),
        isAborted: () => isCpuRuntimeIntegrityBlocked(),
        runCpuTurn: (playerKey: any, options?: any) => runCpuTurn(playerKey, options || {}),
        setProcessing: (nextValue: boolean) => setCpuProcessing(nextValue),
        shouldAbortCpuForHumanMode
    })
    : null;

function resetPendingSelectRetryState(playerKey: any) {
    return CpuTurnScheduler.resetPendingSelectRetryState(playerKey);
}

function resetCpuTurnHandlerState() {
    for (const memory of [...Object.values(lv10RejectedActions), ...Object.values(lv11RejectedActions), ...Object.values(lv12RejectedActions)]) { memory.identity = null; memory.actions = []; delete memory.cancelledCards; }
    return CpuTurnScheduler.resetCpuTurnHandlerState();
}

function exportBattleCpuMemory() {
    return JSON.parse(JSON.stringify({ lv10: lv10RejectedActions, lv11: lv11RejectedActions, lv12: lv12RejectedActions }));
}
function validateBattleCpuMemory(memory: any) {
    for (const key of ['lv10', 'lv11', 'lv12'] as const) {
        if (!memory[key]) continue;
        for (const player of ['black', 'white'] as const) {
            const entry = memory[key][player];
            if (!entry || !Array.isArray(entry.actions) || (entry.identity !== null && typeof entry.identity !== 'string')) throw new Error('Invalid CPU continuation memory');
        }
    }
}
function restoreBattleCpuMemory(memory: any) {
    validateBattleCpuMemory(memory);
    for (const [key, target] of [['lv10', lv10RejectedActions], ['lv11', lv11RejectedActions], ['lv12', lv12RejectedActions]] as const) {
        if (!memory[key]) continue;
        for (const player of ['black', 'white'] as const) Object.assign(target[player], JSON.parse(JSON.stringify(memory[key][player])));
    }
}

function shouldAbortStuckPendingSelection(playerKey: any, pending: any) {
    return CpuTurnScheduler.shouldAbortStuckPendingSelection(playerKey, pending);
}

function scheduleRunCpuTurn(playerKey: any, options: any, delayMs: any) {
    return CpuTurnScheduler.scheduleRunCpuTurn(playerKey, options, delayMs);
}

function getCpuRetryGenerationSafe(): number {
    if (CpuTurnScheduler && typeof CpuTurnScheduler.getCpuRetryGeneration === 'function') {
        const value = Number(CpuTurnScheduler.getCpuRetryGeneration());
        if (Number.isSafeInteger(value) && value >= 0) return value;
    }
    return 0;
}

function resolveCpuPendingIdentity(pending: any): { pendingEffectId: string | null; pendingStage: string | null } {
    if (!pending || typeof pending !== 'object') {
        return { pendingEffectId: null, pendingStage: null };
    }
    const id = pending.pendingEffectId
        ?? pending.effectId
        ?? pending.instanceId
        ?? pending.id
        ?? null;
    return {
        pendingEffectId: id === null || typeof id === 'undefined' ? null : String(id),
        pendingStage: pending.stage === null || typeof pending.stage === 'undefined'
            ? null
            : String(pending.stage)
    };
}

function buildCpuTurnInvocationIdentity(
    playerKey: PlayerKey,
    level: number,
    runId: number,
    decisionEpoch: number
): any {
    const pendingIdentity = resolveCpuPendingIdentity(readCpuPendingSelection(playerKey));
    return {
        runId,
        playerKey,
        turnNumber: getCurrentTurnNumberSafe(),
        decisionLevel: level,
        stateVersion: getCurrentStateVersionSafe(),
        decisionEpoch,
        pendingEffectId: pendingIdentity.pendingEffectId,
        pendingStage: pendingIdentity.pendingStage,
        retryGeneration: getCpuRetryGenerationSafe()
    };
}

function isCpuTurnAnalysisIdentityCurrent(seed: any, crossedAsyncBoundary = false): boolean {
    if (!seed || !seed.identity || !CpuTurnAnalysisModule
        || typeof CpuTurnAnalysisModule.isCpuTurnInvocationIdentityCurrent !== 'function') {
        return false;
    }
    const expected = seed.identity;
    if (getCurrentPlayerKeySafe() !== expected.playerKey) return false;
    const current = buildCpuTurnInvocationIdentity(
        expected.playerKey,
        resolveCpuDecisionLevelForTurn(expected.playerKey),
        cpuTurnInvocationRunSequence,
        cpuTurnDecisionEpochSequence
    );
    return CpuTurnAnalysisModule.isCpuTurnInvocationIdentityCurrent(expected, current, {
        crossedAsyncBoundary
    });
}

function prepareCpuTurnCardUsability(playerKey: PlayerKey, performanceScope: CpuTurnPerformanceScope | null): any {
    const prepareFn = resolveRuntimeFunction('prepareCpuTurnCardUsabilityAnalysis')
        || (CpuDecisionRuntimeModule && typeof CpuDecisionRuntimeModule.prepareCpuTurnCardUsabilityAnalysis === 'function'
            ? CpuDecisionRuntimeModule.prepareCpuTurnCardUsabilityAnalysis
            : null);
    const prepare = () => {
        if (typeof prepareFn === 'function') {
            const prepared = prepareFn(playerKey);
            if (prepared && prepared.cardUsability && Array.isArray(prepared.cardUsability.usableCardIds)) {
                return prepared;
            }
        }
        return {
            trapPrepared: false,
            trapId: null,
            cardPolicyLevel: null,
            cardUsability: getCardUsabilityAnalysisForCpuRetry(playerKey)
        };
    };
    return performanceScope
        ? measureCpuTurnSync(performanceScope, 'card-availability', prepare)
        : prepare();
}

function createCpuTurnAnalysisForRun(args: any): any {
    if (!CpuTurnAnalysisModule
        || typeof CpuTurnAnalysisModule.buildCpuTurnAnalysisSeed !== 'function'
        || typeof CpuTurnAnalysisModule.createCpuTurnAnalysisInvocation !== 'function') {
        return null;
    }
    const playerKey: PlayerKey = args.playerKey === 'white' ? 'white' : 'black';
    const level = Number(args.level) || 1;
    const selfColor = args.selfColor;
    const performanceScope = (args.performanceScope || null) as CpuTurnPerformanceScope | null;
    const gameStateRef = resolveRuntimeValue('gameState') || ((typeof gameState !== 'undefined') ? gameState : null);
    const cardStateRef = resolveRuntimeValue('cardState') || ((typeof cardState !== 'undefined') ? cardState : null);
    const protection = getActiveProtectionSafe(selfColor);
    const flipBlockers = getFlipBlockersSafe();
    const cardPreparation = args.othelloMode === true
        ? {
            trapPrepared: false,
            trapId: null,
            cardPolicyLevel: null,
            cardUsability: Object.freeze({ usableCardIds: Object.freeze([]), usableCardTypes: Object.freeze([]), selectorEvidence: Object.freeze({}), usableSlots: Object.freeze([]) })
        }
        : prepareCpuTurnCardUsability(playerKey, performanceScope);
    const cardPolicyLevel = Number.isFinite(Number(cardPreparation.cardPolicyLevel))
        ? Math.max(1, Math.floor(Number(cardPreparation.cardPolicyLevel)))
        : Math.max(6, level);
    const seed = CpuTurnAnalysisModule.buildCpuTurnAnalysisSeed({
        identity: args.identity,
        protection,
        flipBlockers,
        cardUsability: cardPreparation.cardUsability
    });
    const pendingAtSeed = readCpuPendingSelection(playerKey, cardStateRef);
    const runtimeGenerateMoves = resolveRuntimeFunction('generateMovesForPlayer');
    const runtimeGetLegalMoves = resolveRuntimeFunction('getLegalMoves');
    const canUseCanonicalSharedMoveScan = !!(
        moveGenerator
        && typeof moveGenerator.deriveEquivalentCpuMoveScanInState === 'function'
        && (!runtimeGenerateMoves || runtimeGenerateMoves === moveGenerator.generateMovesForPlayer)
        && (!runtimeGetLegalMoves || runtimeGetLegalMoves === moveGenerator.getLegalMoves)
    );
    const deriveEquivalentMoveScan = () => (
        canUseCanonicalSharedMoveScan
            ? moveGenerator.deriveEquivalentCpuMoveScanInState({
                identity: seed.identity,
                gameState: gameStateRef,
                cardState: cardStateRef,
                playerValue: selfColor,
                pending: pendingAtSeed,
                protection: seed.protection,
                flipBlockers: seed.flipBlockers
            })
            : null
    );
    const getCardLegalMoves = () => {
        if (typeof runtimeGetLegalMoves === 'function') {
            return runtimeGetLegalMoves(gameStateRef, seed.protection, seed.flipBlockers) || [];
        }
        return moveGenerator && typeof moveGenerator.getLegalMoves === 'function'
            ? (moveGenerator.getLegalMoves(gameStateRef, seed.protection, seed.flipBlockers, cardStateRef) || [])
            : [];
    };
    const generatePlacementCandidates = () => {
        if (
            typeof runtimeGenerateMoves === 'function'
            && (!moveGenerator || runtimeGenerateMoves !== moveGenerator.generateMovesForPlayer)
        ) {
            return runtimeGenerateMoves(selfColor, pendingAtSeed, seed.protection, seed.flipBlockers) || [];
        }
        if (moveGenerator && typeof moveGenerator.generateMovesForPlayerInState === 'function') {
            return moveGenerator.generateMovesForPlayerInState(
                gameStateRef,
                cardStateRef,
                selfColor,
                pendingAtSeed,
                seed.protection,
                seed.flipBlockers
            ) || [];
        }
        const generateMovesForPlayerFn = resolveGenerateMovesForPlayer();
        return generateMovesForPlayerFn
            ? (generateMovesForPlayerFn(selfColor, pendingAtSeed, seed.protection, seed.flipBlockers) || [])
            : [];
    };
    const buildCommentaryMetrics = () => {
        const helpers = resolveCommentaryContextHelpers();
        if (helpers && typeof helpers.buildCpuCommentaryMetrics === 'function') {
            const boardContext = createCpuTurnBoardContext(gameStateRef, cardStateRef);
            return helpers.buildCpuCommentaryMetrics({
                gameState: gameStateRef,
                cardState: cardStateRef,
                board: boardContext,
                turnNumber: gameStateRef && gameStateRef.turnNumber,
                playerKey
            });
        }
        return {};
    };
    const invocation = CpuTurnAnalysisModule.createCpuTurnAnalysisInvocation(seed, {
        card: {
            deriveEquivalentMoveScan,
            getCardLegalMoves,
            buildBoardMetrics: (cardLegalMoves: readonly any[]) => buildCpuRetryCardDecisionContext(
                playerKey,
                cardPolicyLevel,
                cardLegalMoves.length,
                cardLegalMoves as any[],
                seed.cardUsability,
                performanceScope
            )
        },
        placement: {
            generatePlacementCandidates,
            reuseMoveScanEvidence: (evidence: any) => (
                moveGenerator && typeof moveGenerator.reuseEquivalentCpuMoveScanEvidence === 'function'
                    ? moveGenerator.reuseEquivalentCpuMoveScanEvidence(evidence, {
                        identity: seed.identity,
                        gameState: gameStateRef,
                        cardState: cardStateRef,
                        playerValue: selfColor,
                        pending: pendingAtSeed,
                        protection: seed.protection,
                        flipBlockers: seed.flipBlockers
                    })
                    : null
            )
        },
        commentary: {
            'turn-start': { buildMetrics: buildCommentaryMetrics },
            'post-card': { buildMetrics: buildCommentaryMetrics },
            'post-move': { buildMetrics: buildCommentaryMetrics }
        }
    });
    let preparedCardDecision: any = null;
    const getPreparedCardDecision = () => {
        if (preparedCardDecision) return preparedCardDecision;
        const cardAnalysis = invocation.deriveCardDecisionAnalysis();
        const hand = cardStateRef && cardStateRef.hands && Array.isArray(cardStateRef.hands[playerKey])
            ? cardStateRef.hands[playerKey]
            : [];
        preparedCardDecision = {
            analysisSeed: seed,
            cardAnalysis,
            cardState: cardStateRef,
            gameState: gameStateRef,
            playerKey,
            level: cardPolicyLevel,
            usability: seed.cardUsability,
            handSnapshot: hand.slice(),
            legalMoves: Array.from(cardAnalysis.cardLegalMoves),
            legalMovesCount: cardAnalysis.cardLegalMoves.length,
            decisionContext: cardAnalysis.boardMetrics,
            trapPrepared: cardPreparation.trapPrepared === true,
            trapId: cardPreparation.trapId || null
        };
        return preparedCardDecision;
    };
    return {
        seed,
        invocation,
        getPreparedCardDecision,
        peekPreparedCardDecision: () => preparedCardDecision,
        isCurrent: (crossedAsyncBoundary = false) => {
            if (!isCpuTurnAnalysisIdentityCurrent(seed, crossedAsyncBoundary)) return false;
            if (seed.identity.pendingEffectId !== null) return true;
            return readCpuPendingSelection(playerKey) === pendingAtSeed;
        }
    };
}

async function prepareCpuCardQuiescenceForRun(
    analysisForRun: any,
    playerKey: PlayerKey,
    performanceScope: CpuTurnPerformanceScope | null
): Promise<'continue' | 'stale'> {
    if (!analysisForRun || !analysisForRun.seed || !analysisForRun.getPreparedCardDecision) return 'continue';
    const usability = analysisForRun.seed.cardUsability;
    if (!usability || !Array.isArray(usability.usableCardIds) || usability.usableCardIds.length === 0) return 'continue';

    const prepared = analysisForRun.getPreparedCardDecision();
    if (!prepared) return 'continue';
    const shouldBuild = resolveCpuDecisionFunction('shouldBuildCardQuiescenceSnapshot');
    if (typeof shouldBuild !== 'function' || shouldBuild(
        prepared.level,
        prepared.legalMoves,
        prepared.decisionContext,
        Array.isArray(usability.usableCardTypes) ? usability.usableCardTypes : undefined
    ) !== true) {
        prepared.quiescenceSnapshot = null;
        prepared.quiescencePrepared = true;
        return 'continue';
    }

    const prepareRequest = resolveCpuDecisionFunction('prepareCardQuiescenceRequest');
    const buildSnapshot = resolveCpuDecisionFunction('buildCardQuiescenceSnapshotFromBestMove');
    const searchInWorker = __uiImpl_cpu
        && typeof __uiImpl_cpu.searchCardQuiescenceInWorker === 'function'
        && (
            typeof __uiImpl_cpu.isCpuCardQuiescenceAvailable !== 'function'
            || __uiImpl_cpu.isCpuCardQuiescenceAvailable() === true
        )
        ? __uiImpl_cpu.searchCardQuiescenceInWorker
        : null;
    const disallowSyncFallback = __uiImpl_cpu
        && __uiImpl_cpu.disableSynchronousCardQuiescenceFallback === true;
    if (typeof prepareRequest !== 'function' || typeof buildSnapshot !== 'function' || typeof searchInWorker !== 'function') {
        if (disallowSyncFallback) {
            prepared.quiescenceSnapshot = null;
            prepared.quiescencePrepared = true;
        }
        return 'continue';
    }

    let request: any = null;
    try {
        request = prepareRequest(
            playerKey,
            prepared.level,
            prepared.legalMoves,
            prepared.decisionContext,
            analysisForRun.seed.identity
        );
    } catch (_error) {
        request = null;
    }
    if (!request) {
        if (disallowSyncFallback) {
            prepared.quiescenceSnapshot = null;
            prepared.quiescencePrepared = true;
        }
        return 'continue';
    }

    const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : Number.NaN;
    try {
        const batch = await Promise.resolve(searchInWorker(request));
        if (performanceScope) {
            recordCpuTurnPerformanceInterval(
                performanceScope,
                'card-quiescence',
                'wait',
                waitStartedAtMs,
                readCpuTurnPerformanceNowMs(performanceScope),
                'continue'
            );
        }
        if (!analysisForRun.isCurrent(true)) return 'stale';
        const response = batch && batch.response ? batch.response : batch;
        prepared.quiescenceSnapshot = buildSnapshot(
            playerKey,
            prepared.decisionContext,
            response && response.bestMove
        );
        prepared.quiescencePrepared = true;
        return 'continue';
    } catch (_error) {
        if (performanceScope) {
            recordCpuTurnPerformanceInterval(
                performanceScope,
                'card-quiescence',
                'wait',
                waitStartedAtMs,
                readCpuTurnPerformanceNowMs(performanceScope),
                'error'
            );
        }
        if (!analysisForRun.isCurrent(true)) return 'stale';
        if (disallowSyncFallback) {
            prepared.quiescenceSnapshot = null;
            prepared.quiescencePrepared = true;
        }
        return 'continue';
    }
}

function resolveProcessPassTurn() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.resolveProcessPassTurn === 'function') {
            const candidate = __uiImpl_cpu.resolveProcessPassTurn();
            return typeof candidate === 'function' ? candidate : null;
        }
        if (__uiImpl_cpu && typeof __uiImpl_cpu.processPassTurn === 'function') {
            return __uiImpl_cpu.processPassTurn;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveExecuteMoveFn() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.resolveExecuteMove === 'function') {
            const candidate = __uiImpl_cpu.resolveExecuteMove();
            if (typeof candidate === 'function') return candidate;
        }
        if (__uiImpl_cpu && typeof __uiImpl_cpu.executeMove === 'function') {
            return __uiImpl_cpu.executeMove;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveApplyCardChoiceFn() {
    const globalApplyCardChoice = resolveRuntimeFunction('applyCardChoice');
    if (globalApplyCardChoice) return globalApplyCardChoice;
    if (typeof applyCardChoice === 'function') return applyCardChoice;
    return null;
}

function getCardUsabilityAnalysisForCpuRetry(playerKey: any) {
    const cardLogicForRetry = resolveCpuCardLogic();
    if (!cardLogicForRetry) return { usableCardIds: [], usableCardTypes: [], selectorEvidence: {}, usableSlots: [] };
    if (typeof cardLogicForRetry.analyzeCardUsability === 'function') {
        const analysis = cardLogicForRetry.analyzeCardUsability(cardState, gameState, playerKey);
        if (analysis && Array.isArray(analysis.usableCardIds)) return analysis;
    }
    if (typeof cardLogicForRetry.getUsableCardIds === 'function') {
        const usable = cardLogicForRetry.getUsableCardIds(cardState, gameState, playerKey);
        return {
            usableCardIds: Array.isArray(usable) ? usable.slice() : [],
            usableCardTypes: [],
            selectorEvidence: {},
            usableSlots: []
        };
    }
    if (typeof cardLogicForRetry.hasUsableCard === 'function' && cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey)) {
        const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
            ? cardState.hands[playerKey]
            : [];
        return { usableCardIds: hand.slice(), usableCardTypes: [], selectorEvidence: {}, usableSlots: [] };
    }
    return { usableCardIds: [], usableCardTypes: [], selectorEvidence: {}, usableSlots: [] };
}

function buildCpuRetryCardDecisionContext(
    playerKey: any,
    level: any,
    legalMovesCount: any,
    legalMoves: any[],
    usability: any,
    performanceScope?: CpuTurnPerformanceScope | null
): any {
    const buildCardUseDecisionContextFn = resolveCpuDecisionFunction('buildCardUseDecisionContext')
        || (typeof buildCardUseDecisionContext === 'function' ? buildCardUseDecisionContext : null);
    if (typeof buildCardUseDecisionContextFn !== 'function') return null;
    try {
        return buildCardUseDecisionContextFn(
            playerKey,
            level,
            legalMovesCount,
            legalMoves,
            usability,
            performanceScope || null
        );
    } catch (e) {
        if (isCardRuntimeUnavailableError(e)) throw e;
        return null;
    }
}

function isCpuRetryCardChoiceAllowed(
    playerKey: any,
    level: any,
    legalMovesCount: any,
    cardId: any,
    decisionContext: any
) {
    const isCardChoiceAllowedByRiskFn = resolveCpuDecisionFunction('isCardChoiceAllowedByRisk')
        || (typeof isCardChoiceAllowedByRisk === 'function' ? isCardChoiceAllowedByRisk : null);
    if (typeof isCardChoiceAllowedByRiskFn !== 'function') return true;
    try {
        return isCardChoiceAllowedByRiskFn(playerKey, level, legalMovesCount, cardId, decisionContext) === true;
    } catch (e) {
        if (isCardRuntimeUnavailableError(e)) throw e;
        return true;
    }
}

function tryApplyAnyUsableCard(
    playerKey: any,
    level?: any,
    legalMovesCount?: any,
    legalMoves?: any[],
    preparedInput?: any
) {
    const hasUsedCardThisTurn = !!(
        cardState &&
        cardState.hasUsedCardThisTurnByPlayer &&
        cardState.hasUsedCardThisTurnByPlayer[playerKey]
    );
    const hasPendingSelection = !!(
        cardState &&
        readCpuPendingSelection(playerKey)
    );
    if (hasUsedCardThisTurn || hasPendingSelection) return false;
    const applyChoice = resolveApplyCardChoiceFn();
    if (typeof applyChoice !== 'function') return false;
    const prepared = preparedInput && typeof preparedInput === 'object' ? preparedInput : {};
    const hand = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
        ? cardState.hands[playerKey]
        : [];
    const preparedIsCurrent = !!(
        prepared.cardState === cardState
        && prepared.gameState === gameState
        && prepared.playerKey === playerKey
        && prepared.usability
        && Array.isArray(prepared.handSnapshot)
        && prepared.handSnapshot.length === hand.length
        && prepared.handSnapshot.every((cardId: any, index: number) => cardId === hand[index])
    );
    const usability = preparedIsCurrent
        ? prepared.usability
        : getCardUsabilityAnalysisForCpuRetry(playerKey);
    const usableIds = Array.isArray(usability && usability.usableCardIds)
        ? usability.usableCardIds
        : [];
    if (!usableIds.length) return false;
    const resolvedLevel = Number.isFinite(Number(level)) ? Number(level) : resolveCpuDecisionLevelForTurn(playerKey);
    const safeMoves = Array.isArray(legalMoves) ? legalMoves : [];
    const safeLegalMovesCount = Number.isFinite(Number(legalMovesCount)) ? Number(legalMovesCount) : safeMoves.length;
    const decisionContext = preparedIsCurrent && prepared.decisionContext
        ? prepared.decisionContext
        : buildCpuRetryCardDecisionContext(
            playerKey,
            resolvedLevel,
            safeLegalMovesCount,
            safeMoves,
            usability
        );
    for (const cardId of usableIds) {
        const cardLogicForRetry = resolveCpuCardLogic();
        const cardDef = (cardLogicForRetry && typeof cardLogicForRetry.getCardDef === 'function')
            ? cardLogicForRetry.getCardDef(cardId)
            : null;
        if (!isCpuRetryCardChoiceAllowed(playerKey, resolvedLevel, safeLegalMovesCount, cardId, decisionContext)) {
            continue;
        }
        if (applyChoice(playerKey, { cardId, cardDef })) {
            return true;
        }
    }
    return false;
}

function scheduleRetry(fn: any, delayMs: any = getAnimationRetryDelayMs()) {
    return CpuTurnScheduler.scheduleRetry(fn, delayMs);
}

function resolvePreparedCardPolicyHook(name: string, fallback: any): any {
    const hook = resolveRuntimeFunction(name)
        || (typeof fallback === 'function' ? fallback : null);
    if (typeof hook !== 'function') return null;
    return (playerKey: any, performanceScope?: CpuTurnPerformanceScope | null, prepared?: any) => {
        if ((hook as any).supportsCpuTurnPreparedAnalysis === true) {
            return hook(playerKey, performanceScope || null, prepared);
        }
        return performanceScope ? hook(playerKey, performanceScope) : hook(playerKey);
    };
}

const CpuTurnCardPhase = (CpuTurnCardPhaseModule && typeof CpuTurnCardPhaseModule.createCpuTurnCardPhase === 'function')
    ? CpuTurnCardPhaseModule.createCpuTurnCardPhase({
        emitCpuCommentary,
        getAnimationRetryDelayMs,
        getCurrentPlayerKeySafe,
        getCurrentTurnNumberSafe,
        getDestroyHandCardWithPolicyFn: () => resolvePreparedCardPolicyHook(
            'cpuMaybeDestroyHandCardWithPolicy',
            typeof cpuMaybeDestroyHandCardWithPolicy === 'function' ? cpuMaybeDestroyHandCardWithPolicy : null
        ),
        getLastUsedCardIdSafe,
        isAborted: stopCpuForRuntimeIntegrityIfBlocked,
        getUseCardWithPolicyFn: () => resolvePreparedCardPolicyHook(
            'cpuMaybeUseCardWithPolicy',
            typeof cpuMaybeUseCardWithPolicy === 'function' ? cpuMaybeUseCardWithPolicy : null
        ),
        isUiAnimationBusy,
        runCpuTurn: (playerKey: any, options?: any) => runCpuTurn(playerKey, options || {}),
        scheduleRetry,
        scheduleRunCpuTurn,
        setCpuProcessing,
        shouldAbortCpuForHumanMode,
        shouldSkipCardPhaseForProfile,
        tryDestroyHighPriorityHandCardViaAdapter
    })
    : null;

// Return a mapping of shared pending-dispatch keys => async handler for a given playerKey.
function getPendingDispatchHandlers(playerKey: any) {
    const resolveCpuPendingHandler = (...names: string[]) => {
        for (const name of names) {
            const handler = resolveRuntimeFunction(name);
            if (handler) return handler;
        }
        return null;
    };
    const handlerNamesByDispatch = PendingSelectionRegistryForCpu && typeof PendingSelectionRegistryForCpu.getPendingSelectionCpuHandlerNamesByDispatchKey === 'function'
        ? PendingSelectionRegistryForCpu.getPendingSelectionCpuHandlerNamesByDispatchKey()
        : {};
    const handlers: Record<string, any> = {};
    Object.keys(handlerNamesByDispatch).forEach((dispatchKey) => {
        const names = Array.isArray(handlerNamesByDispatch[dispatchKey]) ? handlerNamesByDispatch[dispatchKey] : [];
        handlers[dispatchKey] = async () => {
            await runOptionalCpuPendingSelectionHandler(resolveCpuPendingHandler(...names), playerKey);
        };
    });
    return handlers;
}

function getPendingTypeHandlers(playerKey: PlayerKey) {
    const dispatchHandlers = getPendingDispatchHandlers(playerKey);
    const registry = PendingSelectionRegistryForCpu && typeof PendingSelectionRegistryForCpu.getPendingSelectionRegistry === 'function'
        ? PendingSelectionRegistryForCpu.getPendingSelectionRegistry()
        : {};
    const handlers: Record<string, any> = {};
    Object.keys(registry).forEach((cardType) => {
        const dispatchKey = registry[cardType] && registry[cardType].dispatchKey;
        if (dispatchKey && dispatchHandlers[dispatchKey]) {
            handlers[cardType] = dispatchHandlers[dispatchKey];
        }
    });
    return handlers;
}

const CpuTurnPendingPhase = (CpuTurnPendingPhaseModule && typeof CpuTurnPendingPhaseModule.createCpuTurnPendingPhase === 'function')
    ? CpuTurnPendingPhaseModule.createCpuTurnPendingPhase({
        clearCpuPendingSelection,
        emitCpuCommentary,
        emitCpuDebugLog,
        getAnimationRetryDelayMs,
        getCurrentPlayerKeySafe,
        getPendingDispatchHandlers,
        isCpuDebugLogAvailable,
        isAborted: stopCpuForRuntimeIntegrityIfBlocked,
        isUiAnimationBusy,
        readCpuPendingSelection,
        resetPendingSelectRetryState,
        resolvePendingSelectionDispatchKeyForCpu,
        scheduleRunCpuTurn,
        setCpuProcessing,
        shouldAbortCpuForHumanMode,
        shouldAbortStuckPendingSelection
    })
    : null;

const CpuTurnMovePhase = (CpuTurnMovePhaseModule && typeof CpuTurnMovePhaseModule.createCpuTurnMovePhase === 'function')
    ? CpuTurnMovePhaseModule.createCpuTurnMovePhase({
        blackValue: CONST_BLACK,
        countOwnedBasicCornersSafe: countOwnedEffectiveCornersSafe,
        debugCpuTrace,
        emitCpuCommentary,
        emitCpuDebugLog,
        getActiveProtectionSafe,
        getAnimationRetryDelayMs,
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCardUsabilityAnalysis: (playerKey: any) => getCardUsabilityAnalysisForCpuRetry(playerKey),
        getCurrentPlayerKeySafe,
        getCurrentStateVersionSafe,
        getCurrentTurnNumberSafe,
        getFlipBlockersSafe,
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getSelectMoveFromOnnxFn: () => (
            resolveRuntimeFunction('selectMoveFromOnnxPolicyAsync')
            || (typeof selectMoveFromOnnxPolicyAsync === 'function' ? selectMoveFromOnnxPolicyAsync : null)
        ),
        getPrepareCpuCandidateScoringRequestFn: () => (
            resolveRuntimeFunction('prepareCpuCandidateScoringRequest')
            || (CpuDecisionRuntimeModule && typeof CpuDecisionRuntimeModule.prepareCpuCandidateScoringRequest === 'function'
                ? CpuDecisionRuntimeModule.prepareCpuCandidateScoringRequest
                : null)
        ),
        getPrepareCpuPlacementLookaheadRequestFn: () => (
            resolveRuntimeFunction('prepareCpuPlacementLookaheadRequest')
            || (CpuDecisionRuntimeModule && typeof CpuDecisionRuntimeModule.prepareCpuPlacementLookaheadRequest === 'function'
                ? CpuDecisionRuntimeModule.prepareCpuPlacementLookaheadRequest
                : null)
        ),
        getSearchCpuPlacementLookaheadInWorkerFn: () => (
            __uiImpl_cpu
            && typeof __uiImpl_cpu.searchCardQuiescenceInWorker === 'function'
            && (
                typeof __uiImpl_cpu.isCpuCardQuiescenceAvailable !== 'function'
                || __uiImpl_cpu.isCpuCardQuiescenceAvailable() === true
            )
                ? __uiImpl_cpu.searchCardQuiescenceInWorker
                : null
        ),
        disableSynchronousPlacementLookaheadFallback: !!(
            __uiImpl_cpu
            && __uiImpl_cpu.disableSynchronousCardQuiescenceFallback === true
        ),
        getScoreCandidatesInWorkerFn: () => (
            __uiImpl_cpu &&
            typeof __uiImpl_cpu.scoreCandidatesInWorker === 'function' &&
            (
                typeof __uiImpl_cpu.isCpuCandidateScoringAvailable !== 'function' ||
                __uiImpl_cpu.isCpuCandidateScoringAvailable() === true
            )
                ? __uiImpl_cpu.scoreCandidatesInWorker
                : null
        ),
        getUseCardWithPolicyFn: () => (
            resolveRuntimeFunction('cpuMaybeUseCardWithPolicy')
            || (typeof cpuMaybeUseCardWithPolicy === 'function' ? cpuMaybeUseCardWithPolicy : null)
        ),
        handleCpuTurnError,
        isAborted: stopCpuForRuntimeIntegrityIfBlocked,
        isCpuDebugLogAvailable,
        isUiAnimationBusy,
        readNowMs: () => readCpuTurnNowMs(),
        resetPendingSelectRetryState,
        resolveCpuCardLogic,
        resolveExecuteMoveFn,
        resolveGenerateMovesForPlayer,
        resolveLv6MinThinkMs,
        resolveProcessPassTurn,
        scheduleRetry,
        scheduleRunCpuTurn,
        selectCpuMoveSafe,
        setCpuProcessing,
        shouldAbortCpuForHumanMode,
        shouldUseOnnxMoveDecision,
        tryApplyAnyUsableCard,
        whiteValue: CONST_WHITE
    })
    : null;

async function processCpuTurn(options: any = {}): Promise<void> {
    if (isCpuRuntimeIntegrityBlocked()) {
        CpuTurnScheduler.resetCpuTurnHandlerState();
        setCpuProcessing(false);
        return;
    }
    const internalOptions = options && typeof options === 'object' ? options : {};
    const performanceCorrelationId = getCpuTurnPerformanceRecorder()
        ? readCpuTurnPerformanceCorrelationId(internalOptions)
        : null;
    const createProcessOptions = (): any => performanceCorrelationId
        ? withCpuTurnPerformanceOptions({ autoMode: false }, performanceCorrelationId)
        : { autoMode: false };
    if (isHumanVsHumanModeEnabled()) {
        setCpuProcessing(false);
        return;
    }
    const localIsCardAnimating = isUiAnimationBusy();
    debugCpuTrace('[DEBUG][processCpuTurn] enter', {
        isProcessing: readCpuProcessing(),
        isCardAnimating: localIsCardAnimating,
        gameStateCurrentPlayer: gameState && gameState.currentPlayer
    });
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        showCpuResultIfAvailable();
        setCpuProcessing(false);
        debugCpuTrace('[DEBUG][processCpuTurn] skip: game over');
        return;
    }
    const cpuTurnOwnerKey = resolveCpuControlledTurnOwnerKey();
    if (!gameState || !cpuTurnOwnerKey) {
        setCpuProcessing(false);
        debugCpuTrace('[DEBUG][processCpuTurn] skip: no local CPU-controlled turn');
        return;
    }
    if (readCpuProcessing() || isUiAnimationBusy()) {
        scheduleRunCpuTurn(
            cpuTurnOwnerKey,
            createProcessOptions(),
            getAnimationRetryDelayMs()
        );
        debugCpuTrace('[DEBUG][processCpuTurn] defer: busy');
        return;
    }
    await runCpuTurn(cpuTurnOwnerKey, createProcessOptions());
    debugCpuTrace('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn(): Promise<void> {
    if (isCpuRuntimeIntegrityBlocked()) {
        CpuTurnScheduler.resetCpuTurnHandlerState();
        setCpuProcessing(false);
        return;
    }
    if (isHumanVsHumanModeEnabled()) return;
    // Auto operates the black seat, including a white turn legitimately
    // controlled by that seat through FATE. Actions still name the turn owner.
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        showCpuResultIfAvailable();
        setCpuProcessing(false);
        return;
    }
    const owner = getCurrentPlayerKeySafe();
    if (!owner || (getFateWillControllerForTurnOwnerSafe(owner, null) || owner) !== 'black') return;
    if (readCpuProcessing() || isUiAnimationBusy()) {
        scheduleRunCpuTurn(owner, { autoMode: true }, getAnimationRetryDelayMs());
        return;
    }
    return runCpuTurn(owner, { autoMode: true });
}

function handleCpuTurnError(
    playerKey: PlayerKey,
    selfName: string,
    error: any,
    autoMode: boolean,
    performanceScope?: CpuTurnPerformanceScope | null
): void {
    if (stopCpuForRuntimeIntegrityIfBlocked()) return;
    if (isCardRuntimeUnavailableError(error)) {
        const firstFailure = cpuRuntimeIntegrityFailure === null;
        cpuRuntimeIntegrityFailure = error;
        if (CpuTurnScheduler && typeof CpuTurnScheduler.resetCpuTurnHandlerState === 'function') {
            CpuTurnScheduler.resetCpuTurnHandlerState();
        }
        setCpuProcessing(false);
        if (firstFailure) {
            emitCpuTurnLogAdded(`${selfName}のゲーム実行環境を確認できませんでした。再読み込みしてください`);
            try {
                if (__uiImpl_cpu && typeof __uiImpl_cpu.handleCardRuntimeIntegrityFailure === 'function') {
                    __uiImpl_cpu.handleCardRuntimeIntegrityFailure(error, 'cpu-turn-handler');
                }
            } catch (_notificationError) { /* the CPU remains terminally stopped */ }
        }
        return;
    }
    const message = error && error.message ? error.message : String(error);
    console.error(`[AI] Error in runCpuTurn for ${playerKey}:`, error);
    console.error(`[AI] Error message: ${message}`);
    console.error(`[AI] Error stack: ${error && error.stack ? error.stack : ''}`);
    if (isCpuDebugLogAvailable()) {
        emitCpuDebugLog(`[AI] CPU Error for ${playerKey}: ${message}`, 'error', {
            errorStack: error && error.stack ? error.stack : '',
            playerKey
        });
    }
    const cardStateRef = resolveCurrentCpuCardState();
    const stuckPending = readCpuPendingSelection(playerKey, cardStateRef);
    if (stuckPending) {
        debugCpuTrace('[AI] clearing stuck pending after CPU error', {
            playerKey,
            pendingType: stuckPending.type || 'unknown',
            error: message
        });
        clearCpuPendingSelection(playerKey, cardStateRef);
    }
    setCpuProcessing(false);
    emitCpuTurnLogAdded(`${selfName}の思考中にエラーが発生しました`);
    resetPendingSelectRetryState(playerKey);
    scheduleRunCpuTurn(
        playerKey,
        performanceScope
            ? withCpuTurnPerformanceOptions({ autoMode }, performanceScope.correlationId, performanceScope.level)
            : { autoMode },
        getAnimationRetryDelayMs()
    );
}

async function runCpuTurn(playerKey: PlayerKey, options: any = {}): Promise<void> {
    if (isCpuRuntimeIntegrityBlocked()) {
        CpuTurnScheduler.resetCpuTurnHandlerState();
        setCpuProcessing(false);
        return;
    }
    const autoMode = options && options.autoMode === true;
    const inheritedPerformanceCorrelationId = getCpuTurnPerformanceRecorder()
        ? readCpuTurnPerformanceCorrelationId(options)
        : null;
    const inheritedResumeOptions = inheritedPerformanceCorrelationId
        ? withCpuTurnPerformanceOptions({ autoMode }, inheritedPerformanceCorrelationId)
        : { autoMode };
    const turnStartMs = readCpuTurnNowMs();
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';
    const currentPlayer = (() => {
        try {
            const runtimeGameState = resolveRuntimeValue('gameState');
            const state = runtimeGameState && typeof runtimeGameState === 'object'
                ? runtimeGameState
                : (gameState || null);
            return state ? state.currentPlayer : null;
        } catch (e) { /* ignore */ }
        return null;
    })();
    const currentPlayerKey = getCurrentPlayerKeySafe();

    if (shouldAbortCpuForHumanMode(playerKey, 'run_start')) {
        return;
    }

    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        showCpuResultIfAvailable();
        setCpuProcessing(false);
        return;
    }
    if (currentPlayerKey && currentPlayerKey !== playerKey) {
        debugCpuTrace('[AI] runCpuTurn aborted: out-of-turn invocation', {
            playerKey,
            currentPlayer,
            autoMode
        });
        setCpuProcessing(false);
        return;
    }

    if (isCpuDebugLogAvailable()) {
        emitCpuDebugLog(`[AI] Starting CPU turn for ${playerKey}`, 'info', {
            playerKey,
            isWhite,
            autoMode,
            hasUsedCard: cardState.hasUsedCardThisTurnByPlayer[playerKey],
            pendingEffect: !!readCpuPendingSelection(playerKey)
        });
    }

    const level = resolveCpuDecisionLevelForTurn(playerKey);
    // Evaluation can ask a frozen browser for the opponent's action. This
    // DI seam is inactive in normal play and never replaces Lv10 judgment.
    const comparisonAdvisor = level !== 10 && level !== 11 && level !== 12 && isCpuFastBenchModeEnabled()
        && typeof __uiImpl_cpu.adviseComparisonOpponent === 'function'
        ? __uiImpl_cpu.adviseComparisonOpponent : null;

    // Re-entrancy guard: prevent multiple concurrent runCpuTurn invocations
    // which can happen when processCpuTurn fires during a card-use resume window
    if (readCpuProcessing() || (advisedTurnInFlight && (level === 10 || level === 11 || level === 12 || comparisonAdvisor))) {
        debugCpuTrace('[AI] runCpuTurn deferred: processing already active', {
            playerKey,
            autoMode
        });
        scheduleRunCpuTurn(playerKey, inheritedResumeOptions, getAnimationRetryDelayMs());
        return;
    }

    // Handoff publishes currentPlayer before its awaited presentation and turn-start work.
    // Wait for the canonical draw/effects/reset so decisions cannot use the previous turn's state.
    const turnCardState = resolveRuntimeValue('cardState') || ((typeof cardState !== 'undefined') ? cardState : null);
    if (!isOthelloModeForCpuTurnHandler() && turnCardState
        && turnCardState.lastTurnStartedFor !== undefined && turnCardState.lastTurnStartedFor !== playerKey) {
        scheduleRunCpuTurn(playerKey, inheritedResumeOptions, getAnimationRetryDelayMs());
        return;
    }

    setCpuProcessing(true);

    if (isUiAnimationBusy()) {
        setCpuProcessing(false);
        scheduleRunCpuTurn(playerKey, inheritedResumeOptions, getAnimationRetryDelayMs());
        return;
    }

    let performanceScope: CpuTurnPerformanceScope | null = null;
    let ownsAdvisedTurn = false;
    try {
        performanceScope = createRunPerformanceScope(playerKey, level, options);
        if (level === 10 || level === 11 || level === 12 || comparisonAdvisor) {
            // A frozen opponent reply is also asynchronous. Keep its next
            // request behind the previous action's full UI commit, including
            // repeated placements within the same turn.
            advisedTurnInFlight = true;
            ownsAdvisedTurn = true;
            const generation = CpuTurnScheduler.getCpuRetryGeneration();
            const expectedTurn = getCurrentTurnNumberSafe();
            const viewer = (resolveRuntimeValue('cardState') || cardState)?.fateWillControllerByTurnOwner?.[playerKey] || playerKey;
            await runLv10Turn(viewer, {
                rejectedActions: level === 12 ? lv12RejectedActions[viewer as PlayerKey]
                    : level === 11 ? lv11RejectedActions[viewer as PlayerKey]
                    : level === 10 ? lv10RejectedActions[viewer as PlayerKey] : undefined,
                getState: () => ({ gameState: resolveRuntimeValue('gameState') || gameState, cardState: resolveRuntimeValue('cardState') || cardState }),
                getPublicRecipes: () => {
                    const recipes: any = {};
                    for (const key of ['black', 'white'] as PlayerKey[]) {
                        const ids = CpuOpponentStartupOptions.getCpuOpponentDeckCardIds(readCpuProfileValueForTurn(key));
                        if (ids) recipes[key] = ids;
                    }
                    return recipes;
                },
                advise: (request) => {
                    if (comparisonAdvisor) return comparisonAdvisor(request);
                    if (level === 12) {
                        if (typeof __uiImpl_cpu.adviseLv12InWorker !== 'function') return Promise.reject(new Error('Lv12 Worker unavailable'));
                        return __uiImpl_cpu.adviseLv12InWorker(request);
                    }
                    if (level === 11) {
                        if (typeof __uiImpl_cpu.adviseLv11InWorker !== 'function') return Promise.reject(new Error('Lv11 Worker unavailable'));
                        return __uiImpl_cpu.adviseLv11InWorker(request);
                    }
                    if (typeof __uiImpl_cpu.adviseLv10InWorker !== 'function') return Promise.reject(new Error('Lv10 Worker unavailable'));
                    return __uiImpl_cpu.adviseLv10InWorker(request);
                },
                isCurrent: () => CpuTurnScheduler.getCpuRetryGeneration() === generation
                    && getCurrentPlayerKeySafe() === playerKey && getCurrentTurnNumberSafe() === expectedTurn
                    && resolveCpuDecisionLevelForTurn(playerKey) === level && !isUiAnimationBusy()
                    && !shouldAbortCpuForHumanMode(playerKey, 'lv10_commit') && !isCpuRuntimeIntegrityBlocked(),
                apply: async (action) => {
                    if (comparisonAdvisor && typeof __uiImpl_cpu.applyComparisonOpponentPrelude === 'function') {
                        await __uiImpl_cpu.applyComparisonOpponentPrelude(action);
                    }
                    if (action.type === 'pass') {
                        const pass = resolveProcessPassTurn();
                        if (!pass) return { ok: false, reason: 'pass_runtime_unavailable' };
                        return pass(playerKey, { autoMode }, { performanceScope });
                    }
                    if (action.type === 'place' && readCpuPendingSelection(playerKey)?.stage !== 'selectTarget'
                        && Number.isInteger(action.row) && Number.isInteger(action.col)) {
                        const execute = resolveExecuteMoveFn();
                        if (!execute) return { ok: false, reason: 'move_runtime_unavailable' };
                        const generate = resolveGenerateMovesForPlayer();
                        const moves = generate ? generate(selfColor, readCpuPendingSelection(playerKey), getActiveProtectionSafe(selfColor), getFlipBlockersSafe()) : [];
                        const move = (moves || []).find((candidate: any) => candidate.row === action.row && candidate.col === action.col);
                        if (!move) return { ok: false, reason: 'placement_no_longer_legal' };
                        return execute(move, { performanceScope });
                    }
                    const applySelection = resolveCpuDecisionFunction('applyCpuAdvisedSelection');
                    if (!applySelection) return { ok: false, reason: 'selection_runtime_unavailable' };
                    return applySelection(playerKey, action, performanceScope);
                },
                performanceScope,
                record: (record) => {
                    if (comparisonAdvisor) return;
                    const totals = level === 12 ? lv12DecisionTotals : level === 11 ? lv11DecisionTotals : lv10DecisionTotals;
                    const recent = level === 12 ? lv12RecentDecisions : level === 11 ? lv11RecentDecisions : lv10RecentDecisions;
                    totals.decisions++;
                    if (record.source === 'fallback') totals.fallback++;
                    if (record.outcome === 'rejected') totals.rejected++;
                    if (record.outcome === 'stale') totals.stale++;
                    if (record.outcome === 'no_action') totals.noAction++;
                    recent.push(record);
                    if (recent.length > 256) recent.shift();
                }
            });
            setCpuProcessing(false);
            if (getCurrentPlayerKeySafe() === playerKey && !(typeof isGameOver === 'function' && isGameOver(gameState))) {
                scheduleRunCpuTurn(playerKey, inheritedResumeOptions, getAnimationRetryDelayMs());
            }
            return;
        }
        const hasUsedCardThisTurn = !!(cardState && cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey]);
        const hasPendingSelection = !!readCpuPendingSelection(playerKey);
        const othelloMode = isOthelloModeForCpuTurnHandler();
        cpuTurnInvocationRunSequence += 1;
        cpuTurnDecisionEpochSequence += 1;
        const invocationIdentity = buildCpuTurnInvocationIdentity(
            playerKey,
            level,
            cpuTurnInvocationRunSequence,
            cpuTurnDecisionEpochSequence
        );
        const analysisForRun = createCpuTurnAnalysisForRun({
            playerKey,
            level,
            selfColor,
            othelloMode,
            performanceScope,
            identity: invocationIdentity
        });

        if (performanceScope) {
            measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                emitCpuCommentary('turn_start', playerKey, {
                    level,
                    hasPendingSelection,
                    hasUsedCardThisTurn
                }, {
                    invocation: analysisForRun && analysisForRun.invocation,
                    snapshotMoment: 'turn-start'
                });
            });
        } else {
            emitCpuCommentary('turn_start', playerKey, {
                level,
                hasPendingSelection,
                hasUsedCardThisTurn
            }, {
                invocation: analysisForRun && analysisForRun.invocation,
                snapshotMoment: 'turn-start'
            });
        }

        if (stopCpuForRuntimeIntegrityIfBlocked()) return;

        if (!othelloMode && !hasUsedCardThisTurn && !hasPendingSelection) {
            const quiescencePreparation = await prepareCpuCardQuiescenceForRun(
                analysisForRun,
                playerKey,
                performanceScope
            );
            if (stopCpuForRuntimeIntegrityIfBlocked()) return;
            if (quiescencePreparation === 'stale') {
                setCpuProcessing(false);
                scheduleRunCpuTurn(playerKey, inheritedResumeOptions, 0);
                return;
            }
            const cardPhaseResult = await CpuTurnCardPhase.runCpuTurnCardPhase({
                playerKey,
                autoMode,
                level,
                selfColor,
                othelloMode,
                hasUsedCardThisTurn,
                hasPendingSelection,
                performanceScope,
                analysisSeed: analysisForRun && analysisForRun.seed,
                getPreparedCardDecision: analysisForRun && analysisForRun.getPreparedCardDecision
            });
            if (stopCpuForRuntimeIntegrityIfBlocked()) return;
            if (cardPhaseResult && cardPhaseResult.status === 'handled') {
                return;
            }
            if (analysisForRun && !analysisForRun.isCurrent(false)) {
                setCpuProcessing(false);
                scheduleRunCpuTurn(playerKey, inheritedResumeOptions, 0);
                return;
            }
        }

        let pending = readCpuPendingSelection(playerKey);
        if (pending && pending.stage === 'selectTarget') {
            // A selection that already existed at turn start is reached without an
            // intervening await or card phase, so the turn-start commentary
            // snapshot still describes this board; the identity check guards it.
            const reuseTurnStartCommentary = hasPendingSelection
                && !!(analysisForRun && analysisForRun.invocation && analysisForRun.isCurrent(false));
            const pendingPhaseResult = await CpuTurnPendingPhase.runCpuTurnPendingPhase({
                playerKey,
                autoMode,
                level,
                pending,
                performanceScope,
                analysisSeed: analysisForRun && analysisForRun.seed,
                commentaryAnalysis: reuseTurnStartCommentary
                    ? { invocation: analysisForRun.invocation, snapshotMoment: 'turn-start' }
                    : null
            });
            if (stopCpuForRuntimeIntegrityIfBlocked()) return;
            if (pendingPhaseResult && pendingPhaseResult.status === 'handled') {
                return;
            }
            pending = pendingPhaseResult ? pendingPhaseResult.pending : readCpuPendingSelection(playerKey);
        } else {
            resetPendingSelectRetryState(playerKey);
        }

        if (stopCpuForRuntimeIntegrityIfBlocked()) return;
        await CpuTurnMovePhase.runCpuTurnMovePhase({
            playerKey,
            autoMode,
            level,
            selfColor,
            selfName,
            othelloMode,
            pending,
            turnStartMs,
            performanceScope,
            minThinkSatisfied: options && options.cpuMinThinkSatisfied === true,
            skipAsyncDecision: options && options.cpuSkipAsyncDecision === true,
            analysisSeed: analysisForRun && analysisForRun.seed,
            analysisInvocation: analysisForRun && analysisForRun.invocation,
            preparedCardDecision: analysisForRun && analysisForRun.peekPreparedCardDecision
                ? analysisForRun.peekPreparedCardDecision()
                : null,
            isAnalysisCurrent: analysisForRun && analysisForRun.isCurrent
        });
        stopCpuForRuntimeIntegrityIfBlocked();
    } catch (error) {
        handleCpuTurnError(playerKey, selfName, error, autoMode, performanceScope);
    } finally {
        if (ownsAdvisedTurn) advisedTurnInFlight = false;
    }
}

export = {
    exportBattleCpuMemory,
    validateBattleCpuMemory,
    restoreBattleCpuMemory,
    processCpuTurn,
    processAutoBlackTurn,
    setTimers,
    getTimers,
    setCpuTurnTimerService,
    setCpuUIImpl,
    scheduleRetry,
    getPendingTypeHandlers,
    runCpuTurn,
    getLv10DecisionDiagnostics,
    getLv11DecisionDiagnostics,
    getLv12DecisionDiagnostics,
    resetCpuTurnHandlerState,
    PresentationRuntime: presentationRuntime
};

// Prefer registering these functions with UIBootstrap so UI can access them via a canonical API
try {
    const uiBootstrap = _require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn, GamePresentationRuntime: presentationRuntime });
    }
} catch (e) { /* ignore in headless contexts */ }
