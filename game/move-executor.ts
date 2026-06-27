/**
 * Move execution and flip animations extracted from turn-manager
 * Refactored to use Shared Logic via wrappers
 */

declare let cardState: any;
declare let gameState: any;
declare const BLACK: any;
declare const WHITE: any;
declare const TurnPipeline: any;
declare const TurnPipelineUIAdapter: any;
declare const processCpuTurn: any;
declare const onTurnStart: any;
declare const CPU_TURN_DELAY_MS: any;

let __uiImpl_move_executor: any = {};
function setUIImpl(obj: any) {
    const prev = __uiImpl_move_executor || {};
    __uiImpl_move_executor = Object.assign({}, prev, obj || {});
}

function writeMoveExecutorRuntimeValue(key: string, value: any): void {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.writeRuntimeValue === 'function') {
            __uiImpl_move_executor.writeRuntimeValue(key, value);
        }
    } catch (e) { /* ignore */ }
}

function readMoveExecutorProcessing() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.readProcessing === 'function') {
            return __uiImpl_move_executor.readProcessing() === true;
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function readMoveExecutorCardAnimating() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.readCardAnimating === 'function') {
            return __uiImpl_move_executor.readCardAnimating() === true;
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function requireMoveExecutorModuleOrNull(id: string): any {
    if (typeof require !== 'function') return null;
    try {
        return require(id);
    } catch (e) {
        return null;
    }
}

// Import event emitters from controller-events; fall back to global scope
let emitBoardUpdate_local: any;
let emitCardStateChange_local: any;
let emitGameStateChange_local: any;
const moveExecutorControllerEvents = requireMoveExecutorModuleOrNull('./controller-events');
if (moveExecutorControllerEvents) {
    if (typeof moveExecutorControllerEvents.emitBoardUpdate === 'function') emitBoardUpdate_local = moveExecutorControllerEvents.emitBoardUpdate;
    if (typeof moveExecutorControllerEvents.emitCardStateChange === 'function') emitCardStateChange_local = moveExecutorControllerEvents.emitCardStateChange;
    if (typeof moveExecutorControllerEvents.emitGameStateChange === 'function') emitGameStateChange_local = moveExecutorControllerEvents.emitGameStateChange;
}
// TimerService DI
let moveExecutorTimerService: any = null;
function setMoveExecutorTimerService(service: any) { moveExecutorTimerService = service; }

let moveExecutorNetworkTurnHandoff: any = requireMoveExecutorModuleOrNull('./network-turn-handoff');

let MoveExecutorOwnerHelpersModule: any = requireMoveExecutorModuleOrNull('../utils/owner-helpers');

function normalizeMoveExecutorPlayerKey(value: any, fallbackValue: any) {
    if (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.normalizePlayerKey === 'function') {
        return MoveExecutorOwnerHelpersModule.normalizePlayerKey(value, fallbackValue);
    }
    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();
    if (normalized === 'white' || normalized === '-1') return 'white';
    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (value === -1) return 'white';
    if (value === 1) return 'black';
    const fallback = (fallbackValue === null || typeof fallbackValue === 'undefined')
        ? ''
        : String(fallbackValue).trim().toLowerCase();
    if (fallback === 'white' || fallback === '-1') return 'white';
    if (fallback === 'black' || fallback === '1' || fallback === '+1') return 'black';
    if (fallbackValue === -1) return 'white';
    return 'black';
}

function resolveMoveExecutorTurnOwnerKey(move: any) {
    const currentPlayerValue = gameState ? gameState.currentPlayer : null;
    const movePlayerValue = move && (move.playerValue !== undefined ? move.playerValue : move.player);
    return normalizeMoveExecutorPlayerKey(movePlayerValue, currentPlayerValue);
}

function readMoveExecutorLocalPlayerKey(fallbackValue: any) {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getLocalPlayerKey === 'function') {
        try {
            return normalizeMoveExecutorPlayerKey(__uiImpl_move_executor.getLocalPlayerKey(), fallbackValue);
        } catch (e) { /* ignore */ }
    }
    if (__uiImpl_move_executor) {
        const directKey = __uiImpl_move_executor.LOCAL_PLAYER_KEY
            || __uiImpl_move_executor.__LOCAL_PLAYER_KEY
            || __uiImpl_move_executor.BOARD_VIEWER_KEY;
        if (directKey) return normalizeMoveExecutorPlayerKey(directKey, fallbackValue);
    }
    return normalizeMoveExecutorPlayerKey(fallbackValue, fallbackValue);
}

function resolveMoveExecutorAuthPlayerKey(turnOwnerKey: string) {
    const injectedLocalPlayerKey = readMoveExecutorLocalPlayerKey(turnOwnerKey);
    const localPlayerRef = { LOCAL_PLAYER_KEY: injectedLocalPlayerKey };
    const localPlayerKey = (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.resolveLocalPlayerKey === 'function')
        ? MoveExecutorOwnerHelpersModule.resolveLocalPlayerKey(localPlayerRef)
        : readMoveExecutorLocalPlayerKey(turnOwnerKey);
    const controlledTurnOwnerKey = (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.getFateWillControlledTurnOwnerForPlayer === 'function')
        ? MoveExecutorOwnerHelpersModule.getFateWillControlledTurnOwnerForPlayer(cardState, gameState, localPlayerKey)
        : null;
    return controlledTurnOwnerKey === turnOwnerKey
        ? localPlayerKey
        : turnOwnerKey;
}

function setMoveExecutorProcessing(active: boolean) {
    const next = active === true;
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.setProcessing === 'function') {
        try { __uiImpl_move_executor.setProcessing(next); } catch (e) { /* ignore */ }
    }
    return next;
}

function isMoveExecutorDebugEnabled() {
    try {
        if (__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_MOVE_EXEC_LOG === true) return true;
    } catch (e) { /* ignore */ }
    try {
        if (
            __uiImpl_move_executor &&
            typeof __uiImpl_move_executor.isDebugLogAvailable === 'function'
        ) {
            return __uiImpl_move_executor.isDebugLogAvailable() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function debugMoveExecutorLog(...args: any[]) {
    if (!isMoveExecutorDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, args); } catch (e) { /* ignore */ }
}

function debugMoveExecutorError(...args: any[]) {
    if (!isMoveExecutorDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.error) console.error.apply(console, args); } catch (e) { /* ignore */ }
}

function getTimeNow() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.now === 'function') {
        return __uiImpl_move_executor.now();
    }
    return null;
}

function getMoveExecutorCpuTurnProcessor() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.processCpuTurn === 'function') {
        return __uiImpl_move_executor.processCpuTurn;
    }
    return null;
}

function resolveMoveExecutorRuntimeValue(name: string): any {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.resolveRuntimeValue === 'function') {
            const value = __uiImpl_move_executor.resolveRuntimeValue(name);
            if (typeof value !== 'undefined') return value;
        }
        if (__uiImpl_move_executor && Object.prototype.hasOwnProperty.call(__uiImpl_move_executor, name)) {
            return __uiImpl_move_executor[name];
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function resolveMoveExecutorGameState(): any {
    const runtimeGameState = resolveMoveExecutorRuntimeValue('gameState');
    if (runtimeGameState && typeof runtimeGameState === 'object') return runtimeGameState;
    return gameState || null;
}

function shouldRunScheduledCpuTurn(expected: any) {
    const exp = expected || {};
    try {
        const currentGameState = resolveMoveExecutorGameState();
        const currentPlayer = currentGameState ? currentGameState.currentPlayer : null;
        const currentPlayerKey = (typeof WHITE !== 'undefined' && currentPlayer === WHITE)
            ? 'white'
            : (((typeof BLACK !== 'undefined' && currentPlayer === BLACK) || currentPlayer === 'black')
                ? 'black'
                : (currentPlayer === 'white' ? 'white' : null));
        const currentTurnNumber = (currentGameState && Number.isFinite(currentGameState.turnNumber)) ? currentGameState.turnNumber : null;
        if (exp.playerKey && currentPlayerKey !== exp.playerKey) return false;
        if (Number.isFinite(exp.turnNumber) && currentTurnNumber !== exp.turnNumber) return false;
    } catch (e) { /* ignore */ }
    return true;
}

function readMoveExecutorMatchMode() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.readMatchMode === 'function') {
        try {
            const mode = __uiImpl_move_executor.readMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getCurrentMatchMode === 'function') {
        try {
            const mode = __uiImpl_move_executor.getCurrentMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.MATCH_MODE !== 'undefined') {
        return __uiImpl_move_executor.MATCH_MODE;
    }
    return null;
}

function readMoveExecutorHumanVsHumanFlag() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.readHumanVsHumanMode === 'function') {
        try { return __uiImpl_move_executor.readHumanVsHumanMode() === true; } catch (e) { /* ignore */ }
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN !== 'undefined') {
        return __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN === true;
    }
    return false;
}

function resolveMoveExecutorTurnPipelineUIAdapter() {
    if (__uiImpl_move_executor && __uiImpl_move_executor.turnPipelineUIAdapter) {
        return __uiImpl_move_executor.turnPipelineUIAdapter;
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getTurnPipelineUIAdapter === 'function') {
        try {
            const adapter = __uiImpl_move_executor.getTurnPipelineUIAdapter();
            if (adapter && typeof adapter === 'object') return adapter;
        } catch (e) { /* ignore */ }
    }
    return requireMoveExecutorModuleOrNull('./turn/pipeline_ui_adapter');
}

function resolveMoveExecutorTurnPipeline() {
    if (__uiImpl_move_executor && __uiImpl_move_executor.turnPipeline) {
        return __uiImpl_move_executor.turnPipeline;
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getTurnPipeline === 'function') {
        try {
            const pipeline = __uiImpl_move_executor.getTurnPipeline();
            if (pipeline && typeof pipeline === 'object') return pipeline;
        } catch (e) { /* ignore */ }
    }
    return requireMoveExecutorModuleOrNull('./turn/turn_pipeline');
}

function resolveMoveExecutorNetworkTurnHandoff() {
    if (__uiImpl_move_executor && __uiImpl_move_executor.networkTurnHandoff) {
        return __uiImpl_move_executor.networkTurnHandoff;
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getNetworkTurnHandoff === 'function') {
        try {
            const handoff = __uiImpl_move_executor.getNetworkTurnHandoff();
            if (handoff && typeof handoff === 'object') return handoff;
        } catch (e) { /* ignore */ }
    }
    return moveExecutorNetworkTurnHandoff;
}

function resolveMoveExecutorActionManager() {
    if (__uiImpl_move_executor && __uiImpl_move_executor.actionManager) {
        return __uiImpl_move_executor.actionManager;
    }
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.getActionManager === 'function') {
        try {
            const actionManager = __uiImpl_move_executor.getActionManager();
            if (actionManager && typeof actionManager === 'object') return actionManager;
        } catch (e) { /* ignore */ }
    }
    return null;
}

function emitMoveExecutorBoardUpdate() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.emitBoardUpdate === 'function') {
            return __uiImpl_move_executor.emitBoardUpdate() === true;
        }
        if (emitBoardUpdate_local && typeof emitBoardUpdate_local === 'function') {
            return emitBoardUpdate_local() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitMoveExecutorCardStateChange() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.emitCardStateChange === 'function') {
            return __uiImpl_move_executor.emitCardStateChange() === true;
        }
        if (emitCardStateChange_local && typeof emitCardStateChange_local === 'function') {
            return emitCardStateChange_local() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitMoveExecutorGameStateChange() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.emitGameStateChange === 'function') {
            return __uiImpl_move_executor.emitGameStateChange() === true;
        }
        if (emitGameStateChange_local && typeof emitGameStateChange_local === 'function') {
            return emitGameStateChange_local() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitMoveExecutorPlaybackHandoffBeforeStateChange(playbackEvents: any, meta: any): boolean {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    const hasPlaybackEvents = events.length > 0;
    if (hasPlaybackEvents) {
        emitPresentationEventViaBoardOps({
            type: 'PLAYBACK_EVENTS',
            events,
            meta: (meta && typeof meta === 'object') ? meta : {}
        });
    }
    emitMoveExecutorGameStateChange();
    if (hasPlaybackEvents) {
        emitMoveExecutorBoardUpdate();
    }
    return hasPlaybackEvents;
}

function syncMoveExecutorVisibleChargeDisplaysNow() {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.syncVisibleChargeDisplaysNow === 'function') {
            return __uiImpl_move_executor.syncVisibleChargeDisplaysNow() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function readMoveExecutorChargeValue(state: any, ownerKey: 'black' | 'white') {
    const chargeValue = state && state.charge && typeof state.charge === 'object'
        ? Number(state.charge[ownerKey])
        : NaN;
    return Number.isFinite(chargeValue) ? chargeValue : 0;
}

function didMoveExecutorVisibleChargeValuesChange(prevCardState: any, nextCardState: any) {
    return readMoveExecutorChargeValue(prevCardState, 'black') !== readMoveExecutorChargeValue(nextCardState, 'black')
        || readMoveExecutorChargeValue(prevCardState, 'white') !== readMoveExecutorChargeValue(nextCardState, 'white');
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = readMoveExecutorHumanVsHumanFlag();
    const matchMode = String(readMoveExecutorMatchMode() || '').trim().toLowerCase();
    return !!debugHvH || matchMode === 'network';
}

function publishNetworkSnapshot(meta: any) {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.publishSnapshot === 'function') {
        if (typeof __uiImpl_move_executor.isNetworkPublishActive === 'function'
            && __uiImpl_move_executor.isNetworkPublishActive() !== true) {
            return undefined;
        }
        return __uiImpl_move_executor.publishSnapshot(meta || {});
    }
    const handoff = resolveMoveExecutorNetworkTurnHandoff();
    if (handoff && typeof handoff.publishNetworkSnapshot === 'function') {
        return handoff.publishNetworkSnapshot(meta);
    }
    return undefined;
}

function getMoveExecutorPublishPromise(result: any) {
    const publishPromise = result && typeof result === 'object'
        ? (result as any).publishPromise
        : null;
    return publishPromise && typeof publishPromise.then === 'function'
        ? publishPromise
        : null;
}

function emitPresentationEventViaBoardOps(ev: any) {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.emitPresentationEvent === 'function') {
            return __uiImpl_move_executor.emitPresentationEvent(ev) !== false;
        }
    } catch (e) { /* ignore */ }
    try {
        const pres = (typeof require === 'function') ? require('./logic/presentation') : null;
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    // Silent fallback: presentation helper may not be available during early bootstrap.
    return false;
}

function applyMoveExecutorCardStateSnapshot(snapshot: any) {
    if (!snapshot) return false;
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.applyCardStateSnapshot === 'function') {
            if (__uiImpl_move_executor.applyCardStateSnapshot(snapshot) === true) return true;
        }
    } catch (e) { /* ignore */ }
    try {
        let cs = null;
        if (typeof require === 'function') {
            try { cs = require('../card-system'); } catch (e) { cs = null; }
        }
        if (cs && typeof cs.applyCardStateSnapshot === 'function') {
            cs.applyCardStateSnapshot(snapshot);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function assignMoveExecutorCardState(snapshot: any) {
    if (!snapshot) return;
    if (cardState && typeof cardState === 'object') {
        for (const k in cardState) delete (cardState as any)[k];
        Object.assign(cardState, snapshot);
        return;
    }
    cardState = snapshot;
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.setCardState === 'function') {
            __uiImpl_move_executor.setCardState(cardState);
        }
    } catch (e) { /* ignore */ }
}

function assignMoveExecutorGameState(snapshot: any) {
    if (!snapshot) return;
    gameState = snapshot;
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.setGameState === 'function') {
            __uiImpl_move_executor.setGameState(gameState);
        }
    } catch (e) { /* ignore */ }
    writeMoveExecutorRuntimeValue('gameState', gameState);
}

async function executeMove(move: any) {
    try {
        const hadSelection = cardState.selectedCardId !== null;
        cardState.selectedCardId = null;
        const turnOwnerKey = resolveMoveExecutorTurnOwnerKey(move);
        const playerKey = resolveMoveExecutorAuthPlayerKey(turnOwnerKey);
        const debugUsePipeline = !!(__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_USE_TURN_PIPELINE) && typeof TurnPipeline !== 'undefined' && typeof TurnPipeline.applyTurn === 'function';
        const pipelineSnapshot = debugUsePipeline ? runPipelineDebugSnapshot(move, playerKey) : null;
        let adapter = resolveMoveExecutorTurnPipelineUIAdapter();
        let pipeline = resolveMoveExecutorTurnPipeline();
        const pipelineAvailable = (adapter && pipeline);

        const safeIsProcessing = readMoveExecutorProcessing();
        const safeIsCardAnimating = readMoveExecutorCardAnimating();
        debugMoveExecutorLog('[DEBUG][executeMove] enter', { playerKey, turnOwnerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, USE_TURN_PIPELINE: !!(__uiImpl_move_executor && __uiImpl_move_executor.USE_TURN_PIPELINE), DEBUG_HUMAN_VS_HUMAN: !!(__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN), pendingEffectByPlayer: cardState.pendingEffectByPlayer });

        if (!pipelineAvailable) {
            throw new Error('TurnPipeline/TurnPipelineUIAdapter is not available. Legacy path has been removed.');
        }

        await executeMoveViaPipeline(move, hadSelection, playerKey, adapter, pipeline);
        if (pipelineSnapshot) {
            comparePipelineSnapshot(pipelineSnapshot, cardState, gameState);
        }

    } catch (error) {
        console.error('[CRITICAL] Error in executeMove:', error);
        setMoveExecutorProcessing(false);
    } finally {
        const safeIsProcessing = readMoveExecutorProcessing();
        const safeIsCardAnimating = readMoveExecutorCardAnimating();
        debugMoveExecutorLog('[DEBUG][executeMove] exit', { isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, gameStateCurrentPlayer: gameState && gameState.currentPlayer });
    }
}

async function executeMoveViaPipeline(move: any, hadSelection: boolean, playerKey: string, adapter: any, pipeline: any) {
    const actionManager = resolveMoveExecutorActionManager();
    const actionApi = actionManager && actionManager.ActionManager ? actionManager.ActionManager : actionManager;
    const action = (actionApi && typeof actionApi.createAction === 'function')
        ? actionApi.createAction('place', playerKey, { row: move.row, col: move.col })
        : { type: 'place', row: move.row, col: move.col };

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        (action as any).turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);

    // Single Writer: network mode ではローカル実行がスキップされている
    if (res.skippedLocalExecution === true) {
        const publishPromise = getMoveExecutorPublishPromise(res);
        if (!publishPromise) {
            setMoveExecutorProcessing(false);
            return;
        }
        // サーバー応答の applySnapshot が state 更新と playback を担当する。
        // 応答が来るまでは入力ロックを維持して、重複 placement publish を防ぐ。
        setMoveExecutorProcessing(true);
        try {
            await Promise.resolve(publishPromise);
        } finally {
            setMoveExecutorProcessing(false);
            emitMoveExecutorBoardUpdate();
        }
        return;
    }

    // Check if action was rejected (explicit false check, not truthy check)
    if (res.ok === false) {
        console.warn('[MoveExecutor] Action rejected:', res.rejectedReason, 'events:', JSON.stringify(res.events || res, null, 2));
        // Do not record, do not increment turnIndex
        // Important: reset processing state to allow auto-loop to continue
        setMoveExecutorProcessing(false);
        emitMoveExecutorBoardUpdate();
        return;
    }

    if (actionApi) {
        try {
            if (typeof actionApi.recordAction === 'function') actionApi.recordAction(action);
            if (typeof actionApi.incrementTurnIndex === 'function') actionApi.incrementTurnIndex();
        } catch (e) {
            console.warn('[MoveExecutor] Failed to record action:', e);
        }
    }

    // Update canonical states. Preserve existing object references where possible so
    // modules that keep a reference to the old cardState object see updates immediately.
    assignMoveExecutorGameState(res.nextGameState);
    const hasPlaybackEvents = Array.isArray(res.playbackEvents) && res.playbackEvents.length > 0;
    const hasHandRemovePlayback = Array.isArray(res.playbackEvents)
        ? res.playbackEvents.some((ev: any) => ev && ev.type === 'hand_remove')
        : false;
    const shouldSyncVisibleChargeDisplaysNow = !!(
        res.nextCardState
        && hasPlaybackEvents
        && didMoveExecutorVisibleChargeValuesChange(cardState, res.nextCardState)
    );
    if (res.nextCardState) {
        try {
            const applied = applyMoveExecutorCardStateSnapshot(res.nextCardState);
            if (!applied) {
                assignMoveExecutorCardState(res.nextCardState);
            }
        } catch (e) {
            assignMoveExecutorCardState(res.nextCardState);
        }
        if (shouldSyncVisibleChargeDisplaysNow) {
            syncMoveExecutorVisibleChargeDisplaysNow();
        }
        if (!hasPlaybackEvents) {
            let cardStateNotified = false;
            cardStateNotified = emitMoveExecutorCardStateChange();
            if (!hasHandRemovePlayback && !cardStateNotified) {
                if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
                cardState.presentationEvents.push({ type: 'cardAnimation', animationType: 'handSync', payload: { reason: 'move-executor:no-playback-fallback' } });
            }
        }
    }

    const safeIsProcessing = readMoveExecutorProcessing();
    const safeIsCardAnimating = readMoveExecutorCardAnimating();
    debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] after apply', { gameStateCurrentPlayer: gameState.currentPlayer, playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });

    const phases = res.phases || {};
    const effects = res.placementEffects || {};
    const immediate = res.immediate || {};

    emitMoveExecutorPlaybackHandoffBeforeStateChange(res.playbackEvents, { move, phases, effects, immediate });

    const humanMode = isHumanVsHumanModeEnabled();
    const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 200;
    const handoff = resolveMoveExecutorNetworkTurnHandoff();
    const finalizeTurn = (handoff && typeof handoff.finalizeNetworkTurnHandoff === 'function')
        ? handoff.finalizeNetworkTurnHandoff
        : null;

    if (typeof finalizeTurn === 'function') {
        await finalizeTurn({
            playerKey,
            actionType: (action && (action as any).type) ? (action as any).type : 'place',
            action,
            playbackEvents: Array.isArray(res.playbackEvents) ? res.playbackEvents : [],
            humanMode,
            cpuDelayMs: safeCpuDelay,
            resultOrder: 'beforePublish',
            setProcessing: (nextValue: boolean) => { setMoveExecutorProcessing(nextValue); },
            afterTurnStart: () => {
                try {
                    const now = getTimeNow();
                    if (typeof now === 'number') writeMoveExecutorRuntimeValue('__lastMoveCompletedAt', now);
                } catch (e) { /* ignore environments without runtime writer */ }
                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] after onTurnStart', { gameStateCurrentPlayer: gameState.currentPlayer, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });
            },
            publishSnapshot: publishNetworkSnapshot,
            onTurnStart: onTurnStartLogic,
            scheduleCpuTurn: ({ delayMs, expectedTurnNumber, nextPlayerKey }: any) => {
                const scheduleFn = (__uiImpl_move_executor && typeof __uiImpl_move_executor.scheduleCpuTurn === 'function')
                    ? __uiImpl_move_executor.scheduleCpuTurn
                    : null;
                const processScheduledCpuTurn = getMoveExecutorCpuTurnProcessor();
                if (!scheduleFn || !processScheduledCpuTurn) {
                    debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] CPU scheduling dependency missing', {
                        hasScheduleCpuTurn: !!scheduleFn,
                        hasProcessCpuTurn: !!processScheduledCpuTurn
                    });
                    return false;
                }
                const expectedCpuSchedule = {
                    playerKey: nextPlayerKey || 'white',
                    turnNumber: expectedTurnNumber
                };
                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] scheduling CPU', { CPU_DELAY: delayMs });
                scheduleFn(delayMs, () => {
                    if (!shouldRunScheduledCpuTurn(expectedCpuSchedule)) {
                        setMoveExecutorProcessing(false);
                        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] skip stale scheduled CPU callback', expectedCpuSchedule);
                        return;
                    }
                    debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] scheduled CPU callback firing, isProcessing, isCardAnimating', { isProcessing: readMoveExecutorProcessing(), isCardAnimating: readMoveExecutorCardAnimating() });
                    setMoveExecutorProcessing(false);
                    try { processScheduledCpuTurn(); } catch (e) {
                        setMoveExecutorProcessing(false);
                        debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] processCpuTurn threw', e);
                    }
                });
                return true;
            },
            onHumanTurnReady: ({ nextPlayerKey }: any) => {
                if (nextPlayerKey === 'white' && humanMode) {
                    debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] human-vs-human mode: skip CPU scheduling');
                }
                emitMoveExecutorBoardUpdate();
            }
        });
        emitMoveExecutorBoardUpdate();
        return;
    }

    if (typeof WHITE !== 'undefined' && gameState.currentPlayer === WHITE && humanMode) {
        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] human-vs-human mode: skip CPU scheduling');
    }
    // In local mode (no finalizeTurn), onTurnStart for the next player must be called
    // to trigger card draw, effect ticks, game-over checks, and turn logging.
    // The pipeline runs with skipTurnStart:true, so turn-start is not handled there.
    try {
        const nextPlayer = gameState.currentPlayer;
        if (typeof nextPlayer !== 'undefined' && nextPlayer !== null) {
            debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] local mode: calling onTurnStart for next player', { nextPlayer });
            if (typeof onTurnStartLogic === 'function') {
                onTurnStartLogic(nextPlayer).catch((err: any) => {
                    debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] onTurnStart failed', err);
                });
            }
        }
    } catch (e) {
        debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] error calling onTurnStart', e);
    }
    setMoveExecutorProcessing(false);
    emitMoveExecutorBoardUpdate();
}

let deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));
if (typeof require === 'function') {
  try { deepClone = require('../utils/deepClone'); } catch (e) { /* ignore in browser-like env */ }
}

function runPipelineDebugSnapshot(move: any, playerKey: string) {
    try {
        const action = { type: 'place', row: move.row, col: move.col };
        return TurnPipeline.applyTurn(deepClone(cardState), deepClone(gameState), playerKey, action);
    } catch (e) { return null; }
}

function comparePipelineSnapshot(snapshot: any, actualCardState: any, actualGameState: any) { }

async function onTurnStartLogic(player: any) {
    if (typeof onTurnStart === 'function') return await onTurnStart(player);
    return null;
}

export = {
    executeMove,
    executeMoveViaPipeline,
    setUIImpl,
    setMoveExecutorTimerService
};
