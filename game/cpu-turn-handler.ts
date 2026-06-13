declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';

// Global declarations for functions not in ui/globals.d.ts
declare const countDiscs: any;
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

// Timers abstraction (injected by UI)
let timers: any = null;
if (typeof require === 'function') {
    try { timers = _require('./timers'); } catch (e) { /* ignore */ }
}
let passHandler: any = null;
if (typeof require === 'function') {
    try { passHandler = _require('./pass-handler'); } catch (e) { /* ignore */ }
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
const CpuDecisionRuntimeModule = requireCpuTurnHandlerModuleOrNull('./cpu-decision');
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
function setCpuUIImpl(obj: any): void {
    if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
        __uiImpl_cpu = {};
        return;
    }
    __uiImpl_cpu = Object.assign({}, __uiImpl_cpu, obj || {});
}
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
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.resolveRuntimeFunction === 'function') {
            const candidate = __uiImpl_cpu.resolveRuntimeFunction(name);
            if (typeof candidate === 'function') return candidate;
        }
        if (__uiImpl_cpu && typeof __uiImpl_cpu[name] === 'function') {
            return __uiImpl_cpu[name];
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
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.resolveRuntimeValue === 'function') {
            const value = __uiImpl_cpu.resolveRuntimeValue(name);
            if (typeof value !== 'undefined') return value;
        }
        if (__uiImpl_cpu && Object.prototype.hasOwnProperty.call(__uiImpl_cpu, name)) {
            return __uiImpl_cpu[name];
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && Object.prototype.hasOwnProperty.call(globalThis, name)) {
            return (globalThis as any)[name];
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function clampCpuLevelForTurn(value: any): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(6, Math.floor(n)));
}

function readRawCpuSmartnessForTurn(playerKey: PlayerKey): any {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readCpuSmartness === 'function') {
            const smartness = __uiImpl_cpu.readCpuSmartness();
            if (smartness && Object.prototype.hasOwnProperty.call(smartness, playerKey)) {
                return smartness[playerKey];
            }
        }
    } catch (e) { /* ignore */ }

    const cpuSmartnessRef = resolveRuntimeValue('cpuSmartness')
        || (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (cpuSmartnessRef && Object.prototype.hasOwnProperty.call(cpuSmartnessRef, playerKey)) {
        return cpuSmartnessRef[playerKey];
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

function resolveCpuOpponentProfileForTurn(playerKey: PlayerKey): any {
    const raw = readRawCpuSmartnessForTurn(playerKey);
    if (CpuOpponentProfiles && typeof CpuOpponentProfiles.getCpuOpponentProfile === 'function') {
        return CpuOpponentProfiles.getCpuOpponentProfile(raw);
    }
    return null;
}

function resolveCpuLevelForTurn(playerKey: PlayerKey): number {
    const raw = readRawCpuSmartnessForTurn(playerKey);
    if (CpuOpponentProfiles && typeof CpuOpponentProfiles.getCpuOpponentDecisionLevel === 'function') {
        return CpuOpponentProfiles.getCpuOpponentDecisionLevel(raw);
    }
    return clampCpuLevelForTurn(raw);
}

function shouldSkipCardPhaseForProfile(playerKey: PlayerKey): boolean {
    const profile = resolveCpuOpponentProfileForTurn(playerKey);
    if (!profile || !Number.isFinite(Number(profile.cardUseUnlockTurnNumber))) return false;
    const turnNumber = getCurrentTurnNumberSafe();
    if (!Number.isFinite(Number(turnNumber))) return false;
    return Number(turnNumber) < Math.max(0, Math.floor(Number(profile.cardUseUnlockTurnNumber)));
}

function resolveCpuCardLogic() {
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.getCpuCardLogic === 'function') {
            const logic = __uiImpl_cpu.getCpuCardLogic();
            if (logic && typeof logic === 'object') return logic;
        }
        if (__uiImpl_cpu && __uiImpl_cpu.CardLogic && typeof __uiImpl_cpu.CardLogic === 'object') {
            return __uiImpl_cpu.CardLogic;
        }
    } catch (e) { /* ignore */ }
    const runtimeCardLogic = resolveRuntimeValue('CardLogic');
    if (runtimeCardLogic && typeof runtimeCardLogic === 'object') return runtimeCardLogic;
    if (cpuCardLogic && typeof cpuCardLogic === 'object') return cpuCardLogic;
    return null;
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
        return type === 'FATE_WILL' || type === 'CORNER_TRIBUTE';
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

function readCpuPendingSelection(playerKey: PlayerKey) {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.readPendingEffect === 'function') {
        return coordinator.readPendingEffect(cardState, playerKey);
    }
    if (cardState && cardState.pendingEffectByPlayer) {
        return cardState.pendingEffectByPlayer[playerKey] || null;
    }
    return null;
}

function clearCpuPendingSelection(playerKey: PlayerKey): boolean {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.clearPendingEffect === 'function') {
        const result = coordinator.clearPendingEffect(cardState, playerKey);
        return !!(result && result.ok);
    }
    if (cardState && cardState.pendingEffectByPlayer) {
        cardState.pendingEffectByPlayer[playerKey] = null;
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
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readProcessing === 'function') {
            return __uiImpl_cpu.readProcessing() === true;
        }
    } catch (e) { /* ignore */ }
    const runtimeProcessing = resolveRuntimeValue('isProcessing');
    if (typeof runtimeProcessing !== 'undefined') return runtimeProcessing === true;
    return false;
}

function setCpuProcessing(active: any) {
    const next = active === true;
    let handled = false;
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.setProcessing === 'function') {
            __uiImpl_cpu.setProcessing(next);
            handled = true;
        }
    } catch (e) { /* ignore */ }
    if (!handled) {
        try {
            const runtimeRoot = (typeof globalThis !== 'undefined')
                ? (globalThis as any)
                : (typeof self !== 'undefined' ? (self as any) : null);
            if (runtimeRoot && typeof runtimeRoot === 'object') {
                runtimeRoot['isProcessing'] = next;
            }
        } catch (e) { /* ignore */ }
    }
    return next;
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

function resolveCpuLv6BrowserRuntimeCapability() {
    const shared = readExplicitCpuLv6SharedProfile();
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    if (!shared || !capabilityModule || typeof capabilityModule.resolveCpuLv6BrowserRuntimeCapability !== 'function') return null;
    return capabilityModule.resolveCpuLv6BrowserRuntimeCapability(shared);
}

function shouldUseOnnxMoveDecision(level: any) {
    if (!Number.isFinite(level) || level < 6) return true;
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

function countDiscsSafe(state: any) {
    try {
        if (typeof countDiscs === 'function') {
            const counted = countDiscs(state);
            if (counted && Number.isFinite(counted.black) && Number.isFinite(counted.white)) {
                return { black: counted.black, white: counted.white };
            }
        }
    } catch (e) { /* ignore */ }

    const board = state && Array.isArray(state.board) ? state.board : [];
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
        return helpers.countDiscsFromBoard(board, {
            blackValues: [CONST_BLACK, 1, '1', 'black'],
            whiteValues: [CONST_WHITE, -1, '-1', 'white']
        });
    }
    return { black: 0, white: 0 };
}

function countOwnedBasicCornersSafe(stateOrBoard: any, playerKey: any) {
    const board = Array.isArray(stateOrBoard)
        ? stateOrBoard
        : (stateOrBoard && Array.isArray(stateOrBoard.board) ? stateOrBoard.board : null);
    if (!Array.isArray(board) || board.length < 8) return 0;

    const ownValue = playerKey === 'black' ? CONST_BLACK : CONST_WHITE;
    const cornerPoints = [[0, 0], [0, 7], [7, 0], [7, 7]];
    let owned = 0;
    for (const point of cornerPoints) {
        const row = board[point[0]];
        if (!Array.isArray(row)) continue;
        if (row[point[1]] === ownValue) owned += 1;
    }
    return owned;
}

function resolvePhaseByTurn(turnNumber: any, occupiedCells: any) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
        return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
    }
    return 'middle';
}

function resolveAdvantageLabel(playerKey: any, counts: any) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
        return helpers.resolveAdvantageLabel(playerKey, counts);
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

function emitCpuCommentary(eventType: any, playerKey: any, extra: any) {
    const runtime = resolveCpuCommentaryRuntime();
    if (!runtime || typeof runtime.requestCommentary !== 'function') return;

    const helpers = resolveCommentaryContextHelpers();
    const counts = countDiscsSafe(gameState);
    const turnNumber = gameState && Number.isFinite(gameState.turnNumber) ? gameState.turnNumber : null;
    const commentaryLevel = resolveCommentaryCpuLevel(playerKey, extra && extra.level);
    const fallbackContext = Object.assign({
        eventType: String(eventType || 'turn_start'),
        playerKey: playerKey === 'black' ? 'black' : 'white',
        turnNumber,
        phase: resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
        advantage: resolveAdvantageLabel(playerKey, counts),
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
            board: gameState && gameState.board,
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
    countDiscs: countDiscsSafe,
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

function selectCpuMoveSafe(candidateMoves: any, playerKey: any) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    try {
        const selectCpuMoveWithPolicyFn = resolveRuntimeFunction('selectCpuMoveWithPolicy')
            || (typeof selectCpuMoveWithPolicy === 'function' ? selectCpuMoveWithPolicy : null);
        if (typeof selectCpuMoveWithPolicyFn === 'function') {
            const selected = selectCpuMoveWithPolicyFn(candidateMoves, playerKey);
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
    try {
        if (__uiImpl_cpu && typeof __uiImpl_cpu.readAnimationBusy === 'function') {
            return __uiImpl_cpu.readAnimationBusy() === true;
        }
    } catch (e) { /* ignore */ }
    const runtimeCard = resolveRuntimeValue('isCardAnimating');
    const runtimePlayback = resolveRuntimeValue('VisualPlaybackActive');
    const localCard = typeof runtimeCard !== 'undefined' ? runtimeCard === true : false;
    const winPlayback = typeof runtimePlayback !== 'undefined' ? runtimePlayback === true : false;
    return localCard || winPlayback;
}
const CpuTurnScheduler = (CpuTurnSchedulerModule && typeof CpuTurnSchedulerModule.createCpuTurnScheduler === 'function')
    ? CpuTurnSchedulerModule.createCpuTurnScheduler({
        debugCpuTrace,
        getAnimationRetryDelayMs,
        getCurrentPlayerKeySafe,
        getCurrentTurnNumberSafe,
        getTimerService: () => getCpuTurnTimerService(),
        getTimers,
        runCpuTurn: (playerKey: any, options?: any) => runCpuTurn(playerKey, options || {}),
        shouldAbortCpuForHumanMode
    })
    : null;

function resetPendingSelectRetryState(playerKey: any) {
    return CpuTurnScheduler.resetPendingSelectRetryState(playerKey);
}

function resetCpuTurnHandlerState() {
    return CpuTurnScheduler.resetCpuTurnHandlerState();
}

function shouldAbortStuckPendingSelection(playerKey: any, pending: any) {
    return CpuTurnScheduler.shouldAbortStuckPendingSelection(playerKey, pending);
}

function scheduleRunCpuTurn(playerKey: any, options: any, delayMs: any) {
    return CpuTurnScheduler.scheduleRunCpuTurn(playerKey, options, delayMs);
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
    if (passHandler && typeof passHandler.processPassTurn === 'function') return passHandler.processPassTurn;
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

function getUsableCardIdsForCpuRetry(playerKey: any) {
    const cardLogicForRetry = resolveCpuCardLogic();
    if (!cardLogicForRetry) return [];
    if (typeof cardLogicForRetry.getUsableCardIds === 'function') {
        const usable = cardLogicForRetry.getUsableCardIds(cardState, gameState, playerKey);
        return Array.isArray(usable) ? usable.slice() : [];
    }
    if (typeof cardLogicForRetry.hasUsableCard === 'function' && cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey)) {
        const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
            ? cardState.hands[playerKey]
            : [];
        return hand.slice();
    }
    return [];
}

function isCpuRetryCardChoiceAllowed(playerKey: any, level: any, legalMovesCount: any, legalMoves: any[], cardId: any, usableIds: any[]) {
    const buildCardUseDecisionContextFn = resolveCpuDecisionFunction('buildCardUseDecisionContext')
        || (typeof buildCardUseDecisionContext === 'function' ? buildCardUseDecisionContext : null);
    const isCardChoiceAllowedByRiskFn = resolveCpuDecisionFunction('isCardChoiceAllowedByRisk')
        || (typeof isCardChoiceAllowedByRisk === 'function' ? isCardChoiceAllowedByRisk : null);
    if (typeof isCardChoiceAllowedByRiskFn !== 'function') return true;
    let decisionContext = null;
    if (typeof buildCardUseDecisionContextFn === 'function') {
        try {
            decisionContext = buildCardUseDecisionContextFn(playerKey, level, legalMovesCount, legalMoves, usableIds);
        } catch (e) { /* ignore */ }
    }
    try {
        return isCardChoiceAllowedByRiskFn(playerKey, level, legalMovesCount, cardId, decisionContext) === true;
    } catch (e) {
        return true;
    }
}

function tryApplyAnyUsableCard(playerKey: any, level?: any, legalMovesCount?: any, legalMoves?: any[]) {
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
    const usableIds = getUsableCardIdsForCpuRetry(playerKey);
    if (!usableIds.length) return false;
    const resolvedLevel = Number.isFinite(Number(level)) ? Number(level) : resolveCpuLevelForTurn(playerKey);
    const safeMoves = Array.isArray(legalMoves) ? legalMoves : [];
    const safeLegalMovesCount = Number.isFinite(Number(legalMovesCount)) ? Number(legalMovesCount) : safeMoves.length;
    for (const cardId of usableIds) {
        const cardLogicForRetry = resolveCpuCardLogic();
        const cardDef = (cardLogicForRetry && typeof cardLogicForRetry.getCardDef === 'function')
            ? cardLogicForRetry.getCardDef(cardId)
            : null;
        if (!isCpuRetryCardChoiceAllowed(playerKey, resolvedLevel, safeLegalMovesCount, safeMoves, cardId, usableIds)) {
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

const CpuTurnCardPhase = (CpuTurnCardPhaseModule && typeof CpuTurnCardPhaseModule.createCpuTurnCardPhase === 'function')
    ? CpuTurnCardPhaseModule.createCpuTurnCardPhase({
        emitCpuCommentary,
        getAnimationRetryDelayMs,
        getDestroyHandCardWithPolicyFn: () => (
            resolveRuntimeFunction('cpuMaybeDestroyHandCardWithPolicy')
            || (typeof cpuMaybeDestroyHandCardWithPolicy === 'function' ? cpuMaybeDestroyHandCardWithPolicy : null)
        ),
        getLastUsedCardIdSafe,
        getUseCardWithPolicyFn: () => (
            resolveRuntimeFunction('cpuMaybeUseCardWithPolicy')
            || (typeof cpuMaybeUseCardWithPolicy === 'function' ? cpuMaybeUseCardWithPolicy : null)
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
        countOwnedBasicCornersSafe,
        debugCpuTrace,
        emitCpuCommentary,
        emitCpuDebugLog,
        getActiveProtectionSafe,
        getAnimationRetryDelayMs,
        getCardState: () => ((typeof cardState !== 'undefined') ? cardState : null),
        getCurrentPlayerKeySafe,
        getCurrentTurnNumberSafe,
        getFlipBlockersSafe,
        getGameState: () => ((typeof gameState !== 'undefined') ? gameState : null),
        getSelectMoveFromOnnxFn: () => (
            resolveRuntimeFunction('selectMoveFromOnnxPolicyAsync')
            || (typeof selectMoveFromOnnxPolicyAsync === 'function' ? selectMoveFromOnnxPolicyAsync : null)
        ),
        getUseCardWithPolicyFn: () => (
            resolveRuntimeFunction('cpuMaybeUseCardWithPolicy')
            || (typeof cpuMaybeUseCardWithPolicy === 'function' ? cpuMaybeUseCardWithPolicy : null)
        ),
        handleCpuTurnError,
        isCpuDebugLogAvailable,
        isUiAnimationBusy,
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

async function processCpuTurn(): Promise<void> {
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
        scheduleRunCpuTurn(cpuTurnOwnerKey, { autoMode: false }, getAnimationRetryDelayMs());
        debugCpuTrace('[DEBUG][processCpuTurn] defer: busy');
        return;
    }
    await runCpuTurn(cpuTurnOwnerKey, { autoMode: false });
    debugCpuTrace('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn(): Promise<void> {
    if (isHumanVsHumanModeEnabled()) return;
    // Re-enabled for Auto mode: invoke black run with autoMode flag
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        showCpuResultIfAvailable();
        setCpuProcessing(false);
        return;
    }
    if (readCpuProcessing() || isUiAnimationBusy()) return;
    if (gameState.currentPlayer !== CONST_BLACK) return;
    return runCpuTurn('black', { autoMode: true });
}

function handleCpuTurnError(playerKey: PlayerKey, selfName: string, error: any, autoMode: boolean): void {
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
    const stuckPending = readCpuPendingSelection(playerKey);
    if (stuckPending) {
        debugCpuTrace('[AI] clearing stuck pending after CPU error', {
            playerKey,
            pendingType: stuckPending.type || 'unknown',
            error: message
        });
        clearCpuPendingSelection(playerKey);
    }
    setCpuProcessing(false);
    emitCpuTurnLogAdded(`${selfName}の思考中にエラーが発生しました`);
    resetPendingSelectRetryState(playerKey);
    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
}

async function runCpuTurn(playerKey: PlayerKey, { autoMode = false }: { autoMode?: boolean } = {}): Promise<void> {
    const turnStartMs = Date.now();
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';
    const currentPlayer = gameState ? gameState.currentPlayer : null;
    const currentPlayerKey = (currentPlayer === CONST_BLACK || currentPlayer === 'black')
        ? 'black'
        : ((currentPlayer === CONST_WHITE || currentPlayer === 'white') ? 'white' : null);

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

    // Re-entrancy guard: prevent multiple concurrent runCpuTurn invocations
    // which can happen when processCpuTurn fires during a card-use resume window
    if (readCpuProcessing()) {
        debugCpuTrace('[AI] runCpuTurn deferred: processing already active', {
            playerKey,
            autoMode
        });
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
        return;
    }

    setCpuProcessing(true);

    if (isUiAnimationBusy()) {
        setCpuProcessing(false);
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
        return;
    }

    try {
        const level = resolveCpuLevelForTurn(playerKey);
        const hasUsedCardThisTurn = !!(cardState && cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey]);
        const hasPendingSelection = !!readCpuPendingSelection(playerKey);
        const othelloMode = isOthelloModeForCpuTurnHandler();

        emitCpuCommentary('turn_start', playerKey, {
            level,
            hasPendingSelection,
            hasUsedCardThisTurn
        });

        if (!othelloMode && !hasUsedCardThisTurn && !hasPendingSelection) {
            const cardPhaseResult = await CpuTurnCardPhase.runCpuTurnCardPhase({
                playerKey,
                autoMode,
                level,
                selfColor,
                othelloMode,
                hasUsedCardThisTurn,
                hasPendingSelection
            });
            if (cardPhaseResult && cardPhaseResult.status === 'handled') {
                return;
            }
        }

        let pending = readCpuPendingSelection(playerKey);
        if (pending && pending.stage === 'selectTarget') {
            const pendingPhaseResult = await CpuTurnPendingPhase.runCpuTurnPendingPhase({
                playerKey,
                autoMode,
                level,
                pending
            });
            if (pendingPhaseResult && pendingPhaseResult.status === 'handled') {
                return;
            }
            pending = pendingPhaseResult ? pendingPhaseResult.pending : readCpuPendingSelection(playerKey);
        } else {
            resetPendingSelectRetryState(playerKey);
        }

        await CpuTurnMovePhase.runCpuTurnMovePhase({
            playerKey,
            autoMode,
            level,
            selfColor,
            selfName,
            othelloMode,
            pending,
            turnStartMs
        });
    } catch (error) {
        handleCpuTurnError(playerKey, selfName, error, autoMode);
    }
}

export = {
    processCpuTurn,
    processAutoBlackTurn,
    setTimers,
    getTimers,
    setCpuTurnTimerService,
    setCpuUIImpl,
    scheduleRetry,
    getPendingTypeHandlers,
    runCpuTurn,
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
