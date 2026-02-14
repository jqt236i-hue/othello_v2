/**
 * @file cpu-decision.js
 * @description CPU意思決定モジュール
 * 
 * AISystemを利用してレベル別のCPU行動を実行する。
 */

// AISystemの存在確認 (lightweight helper used throughout CPU decision logic)
function isAISystemAvailable() {
    return (typeof AISystem !== 'undefined' && AISystem && typeof AISystem === 'object');
}

function isCpuDebugEnabled() {
    try {
        if (typeof isDebugLogAvailable === 'function') return !!isDebugLogAvailable();
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.DEBUG_CPU_LOG === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function cpuDebugLog() {
    if (!isCpuDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, arguments); } catch (e) { /* ignore */ }
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
function setCpuRng(rng) { cpuRng = rng || cpuRng; }

let CpuPolicyCore = null;
if (typeof require === 'function') {
    try { CpuPolicyCore = require('./ai/cpu-policy-core'); } catch (e) { /* ignore */ }
}
let CpuPolicyTableRuntime = null;
if (typeof require === 'function') {
    try { CpuPolicyTableRuntime = require('./ai/policy-table-runtime'); } catch (e) { /* ignore */ }
}
let CpuPolicyOnnxRuntime = null;
if (typeof require === 'function') {
    try { CpuPolicyOnnxRuntime = require('./ai/policy-onnx-runtime'); } catch (e) { /* ignore */ }
}

function resolvePolicyTableRuntime() {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.CpuPolicyTableRuntime &&
            (
                typeof globalThis.CpuPolicyTableRuntime.chooseMove === 'function' ||
                typeof globalThis.CpuPolicyTableRuntime.getActionScoreForKey === 'function'
            )
        ) {
            CpuPolicyTableRuntime = globalThis.CpuPolicyTableRuntime;
            return CpuPolicyTableRuntime;
        }
    } catch (e) { /* ignore */ }
    if (
        CpuPolicyTableRuntime &&
        (
            typeof CpuPolicyTableRuntime.chooseMove === 'function' ||
            typeof CpuPolicyTableRuntime.getActionScoreForKey === 'function'
        )
    ) return CpuPolicyTableRuntime;
    return null;
}

function resolvePolicyOnnxRuntime() {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.CpuPolicyOnnxRuntime &&
            (
                typeof globalThis.CpuPolicyOnnxRuntime.chooseMove === 'function' ||
                typeof globalThis.CpuPolicyOnnxRuntime.chooseCard === 'function'
            )
        ) {
            CpuPolicyOnnxRuntime = globalThis.CpuPolicyOnnxRuntime;
            return CpuPolicyOnnxRuntime;
        }
    } catch (e) { /* ignore */ }
    if (
        CpuPolicyOnnxRuntime &&
        (
            typeof CpuPolicyOnnxRuntime.chooseMove === 'function' ||
            typeof CpuPolicyOnnxRuntime.chooseCard === 'function'
        )
    ) return CpuPolicyOnnxRuntime;
    return null;
}

function resolvePendingType(playerKey) {
    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getPendingEffectType === 'function') {
            return CardLogic.getPendingEffectType(cardState, playerKey);
        }
    } catch (e) { /* ignore */ }
    try {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        return pending && pending.type ? pending.type : null;
    } catch (e) { /* ignore */ }
    return null;
}

function getHandCardIdsForPlayer(playerKey) {
    const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
        ? cardState.hands[playerKey]
        : [];
    return hand.slice();
}

function buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, usableCardIds) {
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    return {
        playerKey,
        level,
        board: gameState && gameState.board,
        pendingType: resolvePendingType(playerKey),
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        ownCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey])) ? cardState.charge[playerKey] : 0,
        oppCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[opponentKey])) ? cardState.charge[opponentKey] : 0,
        deckCount: (cardState && cardState.deck && Number.isFinite(cardState.deck.length)) ? cardState.deck.length : 0,
        handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : getHandCardIdsForPlayer(playerKey),
        usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null
    };
}

function selectMoveFromLearnedPolicy(candidateMoves, playerKey, level) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    try {
        return runtime.chooseMove(candidateMoves, {
            playerKey,
            level,
            board: gameState && gameState.board,
            pendingType: resolvePendingType(playerKey),
            legalMovesCount: candidateMoves.length
        });
    } catch (e) {
        console.warn('[CPU] policy-table runtime failed, fallback to default policy', e);
        return null;
    }
}

function createLearnedScoreFn(playerKey, level, legalMovesCount) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScore !== 'function') return null;
    return function scoreMove(move) {
        try {
            const s = runtime.getActionScore(move, {
                playerKey,
                level,
                board: gameState && gameState.board,
                pendingType: resolvePendingType(playerKey),
                legalMovesCount
            });
            return Number.isFinite(s) ? s : 0;
        } catch (e) {
            return 0;
        }
    };
}

async function selectMoveFromOnnxPolicyAsync(candidateMoves, playerKey, level) {
    const runtime = resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    try {
        const handCardIds = getHandCardIdsForPlayer(playerKey);
        return await runtime.chooseMove(
            candidateMoves,
            buildOnnxContext(playerKey, level, candidateMoves.length, handCardIds, null)
        );
    } catch (e) {
        console.warn('[CPU] policy-onnx runtime failed, fallback to default policy', e);
        return null;
    }
}

async function selectCardFromOnnxPolicyAsync(playerKey, level, legalMovesCount, usableCardIds) {
    const runtime = resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseCard !== 'function') return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    try {
        const handCardIds = getHandCardIdsForPlayer(playerKey);
        const selectedCardId = await runtime.chooseCard(
            usableCardIds,
            buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, usableCardIds)
        );
        if (!selectedCardId) {
            // ONNX model can explicitly choose "hold card" via no-card head output.
            if (typeof runtime.getStatus === 'function') {
                const status = runtime.getStatus() || {};
                if (status.loaded === true && status.hasCardHead === true && status.noCardSupported === true && !status.lastError) {
                    return { hold: true };
                }
            }
            return null;
        }
        const cardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
            ? CardLogic.getCardDef(selectedCardId)
            : null;
        return { cardId: selectedCardId, cardDef };
    } catch (e) {
        console.warn('[CPU] policy-onnx card runtime failed, fallback to default policy', e);
        return null;
    }
}

function selectCardFromLearnedPolicy(playerKey, level, legalMovesCount, usableCardIds) {
    const runtime = resolvePolicyTableRuntime();
    if (!runtime || typeof runtime.getActionScoreForKey !== 'function') return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;

    let bestCardId = null;
    let bestScore = -Infinity;
    for (const cardId of usableCardIds) {
        const actionKey = `use_card:${cardId}`;
        let score = null;
        try {
            score = runtime.getActionScoreForKey(actionKey, {
                playerKey,
                level,
                board: gameState && gameState.board,
                pendingType: resolvePendingType(playerKey),
                legalMovesCount
            });
        } catch (e) { score = null; }
        if (!Number.isFinite(score)) continue;
        if (score > bestScore) {
            bestScore = score;
            bestCardId = cardId;
        }
    }
    if (!bestCardId) return null;
    const cardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? CardLogic.getCardDef(bestCardId)
        : null;
    return { cardId: bestCardId, cardDef };
}

function emitPresentationEventForCpu(ev) {
    try {
        if (typeof require === 'function') {
            const pres = require('./logic/presentation');
            if (pres && typeof pres.emitPresentationEvent === 'function') {
                return !!pres.emitPresentationEvent(cardState, ev);
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof BoardOps !== 'undefined' && BoardOps && typeof BoardOps.emitPresentationEvent === 'function') {
            BoardOps.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof PresentationHelper !== 'undefined' && PresentationHelper && typeof PresentationHelper.emitPresentationEvent === 'function') {
            PresentationHelper.emitPresentationEvent(cardState, ev);
            return true;
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

function emitCpuSelectionStateChange() {
    if (typeof emitCardStateChange === 'function') emitCardStateChange();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    if (typeof emitGameStateChange === 'function') emitGameStateChange();
}

function resolveTurnPipelineAdapter() {
    try {
        if (typeof TurnPipelineUIAdapter !== 'undefined' && TurnPipelineUIAdapter) return TurnPipelineUIAdapter;
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') return require('./turn/pipeline_ui_adapter');
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter) return globalThis.TurnPipelineUIAdapter;
    } catch (e) { /* ignore */ }
    return null;
}

function resolveTurnPipeline() {
    try {
        if (typeof TurnPipeline !== 'undefined' && TurnPipeline) return TurnPipeline;
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') return require('./turn/turn_pipeline');
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.TurnPipeline) return globalThis.TurnPipeline;
    } catch (e) { /* ignore */ }
    return null;
}

function runCpuPendingSelectionViaPipeline(playerKey, actionPayload, pendingType) {
    const adapter = resolveTurnPipelineAdapter();
    const pipeline = resolveTurnPipeline();
    if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('place', playerKey, actionPayload || {})
        : Object.assign({ type: 'place' }, actionPayload || {});
    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
    if (!res || res.ok === false) {
        return { ok: false, res };
    }

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;
    if (res.playbackEvents && res.playbackEvents.length) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: res.playbackEvents,
            meta: { source: 'cpu_pending_selection', pendingType: pendingType || null }
        });
    }
    emitCpuSelectionStateChange();
    return { ok: true, res };
}

function resolveAppliedCardMeta(playerKey, fallbackCardId, fallbackCardDef) {
    const appliedCardId = (cardState && cardState.lastUsedCardByPlayer && cardState.lastUsedCardByPlayer[playerKey])
        ? cardState.lastUsedCardByPlayer[playerKey]
        : fallbackCardId;
    const appliedCardDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
        ? (CardLogic.getCardDef(appliedCardId) || fallbackCardDef || null)
        : (fallbackCardDef || null);
    const appliedCardCost = (appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null;
    const appliedCardName = (appliedCardDef && appliedCardDef.name) ? appliedCardDef.name : null;
    return { appliedCardId, appliedCardDef, appliedCardCost, appliedCardName };
}

function normalizeCardUsePlaybackEvents(playbackEvents, playerKey, cardMeta) {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    const meta = cardMeta || {};
    return events.map((ev) => {
        if (!ev || ev.type !== 'card_use_animation') return ev;
        const targets = Array.isArray(ev.targets) ? ev.targets : [];
        const normalizedTargets = targets.length > 0
            ? targets.map((t) => Object.assign({}, t, {
                cardId: meta.appliedCardId,
                cost: meta.appliedCardCost,
                name: meta.appliedCardName
            }))
            : [{
                player: playerKey,
                owner: playerKey,
                cardId: meta.appliedCardId,
                cost: meta.appliedCardCost,
                name: meta.appliedCardName
            }];
        return Object.assign({}, ev, { targets: normalizedTargets });
    });
}

function emitCpuCardUseLog(playerKey, level, cardDefOrNull, cardIdOrNull) {
    const shownName = cardDefOrNull ? cardDefOrNull.name : cardIdOrNull;
    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用 - ${shownName}`);
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})がカードを使用: ${shownName}`);
    }
}

function runCpuCardUseViaPipeline(playerKey, cardId, cardDef) {
    const adapter = resolveTurnPipelineAdapter();
    const pipeline = resolveTurnPipeline();
    if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

    const actionPayload = {
        useCardId: cardId,
        useCardOwnerKey: playerKey
    };
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('use_card', playerKey, actionPayload)
        : Object.assign({ type: 'use_card' }, actionPayload);

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
    if (!res || res.ok === false) {
        return { ok: false, res };
    }

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;

    const cardMeta = resolveAppliedCardMeta(playerKey, cardId, cardDef);

    let emittedCardUsePlayback = false;
    if (res.playbackEvents && res.playbackEvents.length) {
        const normalizedPlaybackEvents = normalizeCardUsePlaybackEvents(res.playbackEvents, playerKey, cardMeta);
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: normalizedPlaybackEvents,
            meta: { source: 'cpu_card_use_pipeline', cardId: cardMeta.appliedCardId || null }
        });
        emittedCardUsePlayback = true;
    }

    if (!emittedCardUsePlayback) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: [{
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardMeta.appliedCardId,
                    cost: cardMeta.appliedCardCost,
                    name: cardMeta.appliedCardName
                }]
            }],
            meta: { source: 'cpu_card_use_pipeline_fallback' }
        });
    }

    emitCpuSelectionStateChange();
    return {
        ok: true,
        res,
        emittedCardUsePlayback,
        appliedCardId: cardMeta.appliedCardId,
        appliedCardDef: cardMeta.appliedCardDef,
        appliedCardCost: cardMeta.appliedCardCost,
        appliedCardName: cardMeta.appliedCardName
    };
}

function emitCpuEffectLog(message) {
    if (!message) return;
    if (typeof emitEffectLog === 'function') {
        emitEffectLog(message);
        return;
    }
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(message, 'effect');
    }
}

function getTargetAwareUsableCardIds(playerKey) {
    if (typeof CardLogic === 'undefined' || !CardLogic) return [];
    if (!cardState || !gameState) return [];
    if (typeof CardLogic.getUsableCardIds === 'function') {
        try {
            return CardLogic.getUsableCardIds(cardState, gameState, playerKey) || [];
        } catch (e) { /* ignore */ }
    }
    if (typeof CardLogic.hasUsableCard === 'function' && CardLogic.hasUsableCard(cardState, gameState, playerKey)) {
        // Fallback when only boolean API is available.
        const hand = (cardState.hands && cardState.hands[playerKey]) ? cardState.hands[playerKey] : [];
        return hand.slice();
    }
    if (typeof CardLogic.canUseCard === 'function') {
        const hand = (cardState.hands && cardState.hands[playerKey]) ? cardState.hands[playerKey] : [];
        return hand.filter((id) => {
            try { return !!CardLogic.canUseCard(cardState, playerKey, id); } catch (e) { return false; }
        });
    }
    return [];
}

function countBoardStatsForPlayer(playerValue) {
    if (!gameState || !Array.isArray(gameState.board)) {
        return { discDiff: 0, empties: 0 };
    }
    let own = 0;
    let opp = 0;
    let empties = 0;
    for (let r = 0; r < gameState.board.length; r++) {
        const row = Array.isArray(gameState.board[r]) ? gameState.board[r] : [];
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
            else if (v === 0) empties += 1;
        }
    }
    return { discDiff: own - opp, empties };
}

function buildCardUseDecisionContext(playerKey, level, legalMovesCount) {
    const playerValue = playerKey === 'black'
        ? (typeof BLACK !== 'undefined' ? BLACK : 1)
        : (typeof WHITE !== 'undefined' ? WHITE : -1);
    const stats = countBoardStatsForPlayer(playerValue);
    const ownCharge = cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey])
        ? cardState.charge[playerKey]
        : 0;
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const oppCharge = cardState && cardState.charge && Number.isFinite(cardState.charge[opponentKey])
        ? cardState.charge[opponentKey]
        : 0;
    const handSize = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
        ? cardState.hands[playerKey].length
        : 0;

    return {
        level,
        playerValue,
        legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
        discDiff: stats.discDiff,
        empties: stats.empties,
        ownCharge,
        oppCharge,
        handSize,
        forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0
    };
}

function isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, cardId, prebuiltContext) {
    if (!cardId) return false;
    if (!CpuPolicyCore || typeof CpuPolicyCore.scoreCardUseDecision !== 'function' || typeof CardLogic === 'undefined' || !CardLogic) {
        return true;
    }
    try {
        const context = prebuiltContext || buildCardUseDecisionContext(playerKey, level, legalMovesCount);
        const decision = CpuPolicyCore.scoreCardUseDecision(
            cardId,
            CardLogic.getCardCost,
            CardLogic.getCardDef,
            context
        );
        if (!decision) return true;
        return decision.shouldUse === true;
    } catch (e) {
        return true;
    }
}

function _isCpuTrapOnlyModeEnabled(playerKey) {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        if (!root) return false;
        const qs = String((root.location && root.location.search) || '');
        const debugEnabled =
            /[?&]debug=(1|true)\b/i.test(qs) ||
            root.DEBUG_UNLIMITED_USAGE === true;
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

function _findTrapCardIdInCatalog() {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        const defs = (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS))
            ? CARD_DEFS
            : (root && Array.isArray(root.CARD_DEFS) ? root.CARD_DEFS : []);
        const def = defs.find(c => c && c.type === 'TRAP_WILL' && c.enabled !== false);
        return def ? def.id : null;
    } catch (e) {
        return null;
    }
}

function _prepareCpuTrapOnlyCard(playerKey) {
    if (!_isCpuTrapOnlyModeEnabled(playerKey)) return null;
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return null;
    if (typeof CardLogic === 'undefined' || !CardLogic) return null;

    const hand = cardState.hands[playerKey];
    let trapId = null;
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

function selectCardFallback(cardState, gameState, playerKey, level, legalMoves) {
    if (typeof cardState === 'undefined' || !cardState) return null;
    if (typeof CardLogic === 'undefined') return null;
    const usable = getTargetAwareUsableCardIds(playerKey);
    if (!usable.length) return null;
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount);

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
function selectCardToUse(playerKey) {
    // Pure decision: returns a candidate { cardId, cardDef } or null but does NOT apply it.
    const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness[playerKey] !== 'undefined') ? cpuSmartness[playerKey] : 1;
    const player = playerKey === 'black' ? (typeof BLACK !== 'undefined' ? BLACK : (typeof global !== 'undefined' ? global.BLACK : 1)) : (typeof WHITE !== 'undefined' ? WHITE : (typeof global !== 'undefined' ? global.WHITE : -1));
    const protection = (typeof getActiveProtectionForPlayer === 'function') ? getActiveProtectionForPlayer(player) : null;
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
    const legalMoves = (typeof getLegalMoves === 'function') ? getLegalMoves(safeGameState, protection, perma) : [];
    const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
    const decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount);

    // Debug-only accelerator: CPU uses Trap Will preferentially.
    const trapId = _prepareCpuTrapOnlyCard(playerKey);
    if (trapId) {
        const usableNow = getTargetAwareUsableCardIds(playerKey);
        if (usableNow.includes(trapId)) {
            const trapDef = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function')
                ? CardLogic.getCardDef(trapId)
                : null;
            return { cardId: trapId, cardDef: trapDef };
        }
    }

    // Always prefer using an affordable card in the provisional CPU behavior.
    if (typeof CardLogic !== 'undefined') {
        const usable = getTargetAwareUsableCardIds(playerKey);
        if (usable.length) {
            const learnedChoice = selectCardFromLearnedPolicy(playerKey, level, legalMoves.length, usable);
            if (learnedChoice && isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, learnedChoice.cardId, decisionContext)) {
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
                if (selected) return selected;
            }
            if (CpuPolicyCore && typeof CpuPolicyCore.chooseHighestCostCard === 'function') {
                const fallback = CpuPolicyCore.chooseHighestCostCard(usable, CardLogic.getCardCost, CardLogic.getCardDef);
                if (fallback && isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, fallback.cardId, decisionContext)) {
                    return fallback;
                }
            }
            const choiceId = usable[0];
            const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
            if (isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choiceId, decisionContext)) {
                return { cardId: choiceId, cardDef };
            }
        }
    }

    // Try AISystem via safe wrapper
    let cardChoice = null;
    if (isAISystemAvailable() && typeof AISystem.selectCardToUse === 'function') {
        try {
            const safeGameState = (typeof gameState !== 'undefined') ? gameState : null;
            cardChoice = AISystem.selectCardToUse(cardState, safeGameState, playerKey, level, legalMoves, null);
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
    if (cardChoice && !isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, cardChoice.cardId, decisionContext)) {
        return null;
    }
    return cardChoice || null;
}

/**
 * Apply a chosen card. Performs state changes and emits UI hooks.
 * Side-effectful: mutates cardState/gameState and triggers emitters.
 * Returns true on success, false if application failed or card not in hand.
 */
function applyCardChoice(playerKey, cardChoice) {
    // Side-effectful application: applies the chosen card and updates UI/state
    if (!cardChoice) return false;
    const { cardId, cardDef } = cardChoice;
    if (cardState.hands[playerKey].indexOf(cardId) === -1) return false;
    const fallbackCardCost = (cardDef && Number.isFinite(cardDef.cost)) ? cardDef.cost : null;
    const fallbackCardName = (cardDef && cardDef.name) ? cardDef.name : null;
    const pipelineResult = runCpuCardUseViaPipeline(playerKey, cardId, cardDef);
    if (pipelineResult && pipelineResult.ok) {
        const appliedCardId = pipelineResult.appliedCardId || cardId;
        const appliedCardDef = pipelineResult.appliedCardDef || cardDef;
        const appliedCardCost = Number.isFinite(pipelineResult.appliedCardCost)
            ? pipelineResult.appliedCardCost
            : ((appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null);
        const appliedCardName = pipelineResult.appliedCardName || (appliedCardDef && appliedCardDef.name) || null;

        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.playCardUseHandAnimation === 'function') {
                if (globalThis.VisualPlaybackActive !== true) {
                    globalThis.playCardUseHandAnimation({
                        player: playerKey,
                        owner: playerKey,
                        cardId: appliedCardId,
                        cost: appliedCardCost,
                        name: appliedCardName
                    }).catch(() => {});
                }
            }
        } catch (e) { /* ignore */ }

        const level = cpuSmartness[playerKey] || 1;
        emitCpuCardUseLog(playerKey, level, appliedCardDef, appliedCardId);
        return true;
    }
    if (pipelineResult && pipelineResult.ok === false) {
        const level = cpuSmartness[playerKey] || 1;
        const rejectedReason = pipelineResult.res && pipelineResult.res.rejectedReason
            ? pipelineResult.res.rejectedReason
            : 'PIPELINE_REJECTED';
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用拒否(${rejectedReason}) - ${cardDef ? cardDef.name : cardId}`);
        return false;
    }

    if (typeof CardLogic === 'undefined' || !CardLogic.applyCardUsage) {
        console.warn('[CPU] CardLogic.applyCardUsage not available, skipping card use');
        return false;
    }
    const ok = CardLogic.applyCardUsage(cardState, gameState, playerKey, cardId);
    if (!ok) return false;

    // Normalize CPU card-use visuals through PlaybackEvents so CPU/AUTO and manual use
    // the same animation path.
    let emittedCardUsePlayback = false;
    try {
        if (
            typeof CardLogic.flushPresentationEvents === 'function' &&
            typeof TurnPipelineUIAdapter !== 'undefined' &&
            TurnPipelineUIAdapter &&
            typeof TurnPipelineUIAdapter.mapToPlaybackEvents === 'function'
        ) {
            const pres = CardLogic.flushPresentationEvents(cardState) || [];
            const playback = TurnPipelineUIAdapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
            if (playback.length > 0) {
                emitPresentationEventForCpu({ type: 'PLAYBACK_EVENTS', events: playback, meta: { source: 'cpu_card_use' } });
                emittedCardUsePlayback = true;
            } else {
                for (const ev of pres) emitPresentationEventForCpu(ev);
            }
        }
    } catch (e) {
        // Keep game flow even if animation conversion fails.
    }
    if (!emittedCardUsePlayback) {
        emitPresentationEventForCpu({
            type: 'PLAYBACK_EVENTS',
            events: [{
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardId,
                    cost: fallbackCardCost,
                    name: fallbackCardName
                }]
            }],
            meta: { source: 'cpu_card_use_fallback' }
        });
    }

    // Browser safety fallback: if playback wiring misses in this build/order, play once directly.
    // Duplicate calls are suppressed in playCardUseHandAnimation via timestamp guard.
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.playCardUseHandAnimation === 'function') {
            if (globalThis.VisualPlaybackActive !== true) {
                globalThis.playCardUseHandAnimation({
                    player: playerKey,
                    owner: playerKey,
                    cardId: cardId,
                    cost: fallbackCardCost,
                    name: fallbackCardName
                }).catch(() => {});
            }
        }
    } catch (e) { /* ignore */ }

    const level = cpuSmartness[playerKey] || 1;
    emitCpuCardUseLog(playerKey, level, cardDef || null, cardId || null);

    if (typeof emitCardStateChange === 'function') emitCardStateChange();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();

    return true;
}

function cpuMaybeUseCardWithPolicy(playerKey) {
    // Backwards-compatible wrapper that selects then applies; preserves original behavior
    if (typeof cardState === 'undefined' || !cardState || !cardState.hasUsedCardThisTurnByPlayer) {
        // Defensive: in some browser load orders cardState may not be initialized yet
        console.warn('[CPU] cardState not initialized; skipping card use');
        return false;
    }
    if (cardState.hasUsedCardThisTurnByPlayer[playerKey]) return false;

    const level = cpuSmartness && cpuSmartness[playerKey] ? cpuSmartness[playerKey] : 1;
    const cardChoice = selectCardToUse(playerKey);
    if (!cardChoice) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カードスキップ (no candidate)`);
        return false;
    }

    if (applyCardChoice(playerKey, cardChoice)) return true;

    // Try other usable cards as fallback (preserve original retry behavior)
    if (typeof CardLogic !== 'undefined') {
        const usable = getTargetAwareUsableCardIds(playerKey);
        for (const id of usable) {
            if (id === (cardChoice && cardChoice.cardId)) continue;
            const def = CardLogic.getCardDef ? CardLogic.getCardDef(id) : null;
            if (applyCardChoice(playerKey, { cardId: id, cardDef: def })) return true;
        }
    }

    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用に失敗`);
    return false;
}

/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
function selectCpuMoveWithPolicy(candidateMoves, playerKey) {
    const level = cpuSmartness[playerKey] || 1;

    // 人間プレイヤーの場合はエラー（このコードは呼ばれてはいけない）
    if (level < 0) {
        console.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }

    const aiSelector = isAISystemAvailable() && typeof AISystem.selectMove === 'function'
        ? (moves, lv) => AISystem.selectMove(gameState, cardState, moves, lv, null)
        : null;

    const learnedMove = (level >= 6) ? selectMoveFromLearnedPolicy(candidateMoves, playerKey, level) : null;
    if (learnedMove) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 学習選択 (${learnedMove.row}, ${learnedMove.col}) - 反転${learnedMove.flips.length}枚`);
        return learnedMove;
    }
    const learnedScoreFn = createLearnedScoreFn(playerKey, level, candidateMoves.length);

    if (CpuPolicyCore && typeof CpuPolicyCore.chooseMove === 'function') {
        const selected = CpuPolicyCore.chooseMove(candidateMoves, level, cpuRng, aiSelector, {
            enableHeuristic: level >= 3,
            scoreMove: learnedScoreFn
        });
        if (selected) {
            cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selected.row}, ${selected.col}) - 反転${selected.flips.length}枚`);
            return selected;
        }
    }

    if (!isAISystemAvailable() || typeof AISystem.selectMove !== 'function') {
        // フォールバック: ランダム (injectable via setCpuRng)
        console.warn('[CPU] AISystem not available, using random');
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }
    try {
        const selectedMove = AISystem.selectMove(gameState, cardState, candidateMoves, level, null);
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 選択 (${selectedMove.row}, ${selectedMove.col}) - 反転${selectedMove.flips.length}枚`);
        return selectedMove;
    } catch (e) {
        console.warn('[CPU] AISystem.selectMove failed, falling back to random', e);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }
}

/**
 * 破壊対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectDestroyWithPolicy(playerKey) {
    const level = cpuSmartness[playerKey] || 1;
    const opponent = playerKey === 'black' ? WHITE : BLACK;
    const targets = [];

    // 破壊可能な敵の石を収集
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === opponent) {
                const flipBlockers = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
                const isPermaProtected = flipBlockers.some(
                    p => p.row === r && p.col === c
                );
                if (!isPermaProtected) {
                    targets.push({ row: r, col: c });
                }
            }
        }
    }

    if (targets.length === 0) {
        cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    // レベルに応じた選択
    let target;

    if (level >= 4) {
        // Lv4+: 角や辺の石を優先的に破壊
        const cornerTargets = targets.filter(t => (t.row === 0 || t.row === 7) && (t.col === 0 || t.col === 7));
        const edgeTargets = targets.filter(t => t.row === 0 || t.row === 7 || t.col === 0 || t.col === 7);

        if (cornerTargets.length > 0) {
            target = cornerTargets[Math.floor(cpuRng.random() * cornerTargets.length)];
        } else if (edgeTargets.length > 0) {
            target = edgeTargets[Math.floor(cpuRng.random() * edgeTargets.length)];
        } else {
            target = targets[Math.floor(cpuRng.random() * targets.length)];
        }
    } else {
        // Lv1-3: ランダム
        target = targets[Math.floor(cpuRng.random() * targets.length)];
    }

    cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { destroyTarget: { row: target.row, col: target.col } },
        'DESTROY_ONE_STONE'
    );
    if (pipelineResult) return;

    // CPU must bypass UI lock-based handlers and apply effect directly.
    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyDestroyEffect === 'function') {
        const applied = !!CardLogic.applyDestroyEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }
    // Fallback for legacy environments.
    if (typeof handleDestroySelection === 'function') {
        await handleDestroySelection(target.row, target.col, playerKey);
    }
}

/**
 * 強風の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectStrongWindWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 強風対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 強風ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { strongWindTarget: { row: target.row, col: target.col } },
        'STRONG_WIND_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyStrongWindWill === 'function') {
        const res = CardLogic.applyStrongWindWill(cardState, gameState, playerKey, target.row, target.col, cpuRng);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 生贄の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSacrificeWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 生贄対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 生贄ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { sacrificeTarget: { row: target.row, col: target.col } },
        'SACRIFICE_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySacrificeWill === 'function') {
        const res = CardLogic.applySacrificeWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handleSacrificeSelection === 'function') {
        await handleSacrificeSelection(target.row, target.col, playerKey);
    }
}

/**
 * 売却の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSellCardWillWithPolicy(playerKey) {
    const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
        ? cardState.hands[playerKey].slice()
        : [];
    if (!hand.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 売却対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    let targetCardId = hand[0];
    let bestCost = -Infinity;
    for (const cardId of hand) {
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(cardId) || 0)
            : 0;
        if (cost > bestCost) {
            bestCost = cost;
            targetCardId = cardId;
        }
    }
    cpuDebugLog(`[CPU] ${playerKey}: 売却カード ${targetCardId} (cost=${bestCost})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { sellCardId: targetCardId },
        'SELL_CARD_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySellCardWill === 'function') {
        const res = CardLogic.applySellCardWill(cardState, playerKey, targetCardId);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 天の恵み 候補選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectHeavenBlessingWithPolicy(playerKey) {
    const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 天の恵み候補なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    let targetCardId = offers[0];
    let bestCost = -Infinity;
    for (const cardId of offers) {
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(cardId) || 0)
            : 0;
        if (cost > bestCost) {
            bestCost = cost;
            targetCardId = cardId;
        }
    }
    cpuDebugLog(`[CPU] ${playerKey}: 天の恵み選択 ${targetCardId} (cost=${bestCost})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { heavenBlessingCardId: targetCardId },
        'HEAVEN_BLESSING'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyHeavenBlessingChoice === 'function') {
        const res = CardLogic.applyHeavenBlessingChoice(cardState, playerKey, targetCardId);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
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
async function cpuSelectCondemnWillWithPolicy(playerKey) {
    const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
    const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
    if (!offers.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 断罪候補なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    let target = offers[0];
    let bestCost = -Infinity;
    for (const offer of offers) {
        if (!offer || !offer.cardId) continue;
        const cost = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardCost === 'function')
            ? (CardLogic.getCardCost(offer.cardId) || 0)
            : 0;
        if (cost > bestCost) {
            bestCost = cost;
            target = offer;
        }
    }
    if (!target || !Number.isInteger(target.handIndex)) {
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }
    cpuDebugLog(`[CPU] ${playerKey}: 断罪選択 index=${target.handIndex} card=${target.cardId} (cost=${bestCost})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { condemnTargetIndex: target.handIndex },
        'CONDEMN_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCondemnWill === 'function') {
        const res = CardLogic.applyCondemnWill(cardState, playerKey, target.handIndex);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 交換の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectSwapWithEnemyWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 交換対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 交換ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { swapTarget: { row: target.row, col: target.col } },
        'SWAP_WITH_ENEMY'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applySwapEffect === 'function') {
        const applied = !!CardLogic.applySwapEffect(cardState, gameState, playerKey, target.row, target.col);
        if (!applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handleSwapSelection === 'function') {
        await handleSwapSelection(target.row, target.col, playerKey);
    }
}

/**
 * 入替の意志 対象選択（2段階）
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectPositionSwapWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 入替対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 入替ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { positionSwapTarget: { row: target.row, col: target.col } },
        'POSITION_SWAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyPositionSwapWill === 'function') {
        const res = CardLogic.applyPositionSwapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handlePositionSwapSelection === 'function') {
        await handlePositionSwapSelection(target.row, target.col, playerKey);
    }
}

/**
 * 罠の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTrapWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 罠対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 罠ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { trapTarget: { row: target.row, col: target.col } },
        'TRAP_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTrapWill === 'function') {
        const res = CardLogic.applyTrapWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 守る意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectGuardWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 守る対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 守るターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { guardTarget: { row: target.row, col: target.col } },
        'GUARD_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyGuardWill === 'function') {
        const res = CardLogic.applyGuardWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }
}

/**
 * 時限爆弾 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTimeBombWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getTimeBombTargets === 'function')
        ? CardLogic.getTimeBombTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { bombTarget: { row: target.row, col: target.col } },
        'TIME_BOMB'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTimeBombWill === 'function') {
        const res = CardLogic.applyTimeBombWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
    }
}

/**
 * 誘惑の意志 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectTemptWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        cpuDebugLog(`[CPU] ${playerKey}: 誘惑対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    cpuDebugLog(`[CPU] ${playerKey}: 誘惑ターゲット (${target.row}, ${target.col})`);

    const pipelineResult = runCpuPendingSelectionViaPipeline(
        playerKey,
        { temptTarget: { row: target.row, col: target.col } },
        'TEMPT_WILL'
    );
    if (pipelineResult) return;

    if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyTemptWill === 'function') {
        const res = CardLogic.applyTemptWill(cardState, gameState, playerKey, target.row, target.col);
        if (!res || !res.applied) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        emitCpuSelectionStateChange();
        return;
    }

    if (typeof handleTemptSelection === 'function') {
        await handleTemptSelection(target.row, target.col, playerKey);
    }
}

// UI-level exposure is handled by UI layer; Node/CommonJS consumers should use module.exports.


// Compute a CPU action WITHOUT side effects. Returns an action descriptor object:
// { type: 'move', move }
// { type: 'useCard', cardId, cardDef }
// { type: 'pass' }
function computeCpuAction(playerKey) {
    const level = cpuSmartness[playerKey] || 1;
    const player = playerKey === 'black' ? BLACK : WHITE;
    const protection = getActiveProtectionForPlayer(player);
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const legalMoves = getLegalMoves(gameState, protection, perma);

    if (!legalMoves.length) {
        // ask the centralized selector for a candidate
        let cardChoice = null;
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
        cpuMaybeUseCardWithPolicy,
        selectCardToUse,
        applyCardChoice,
        selectCpuMoveWithPolicy,
        selectMoveFromOnnxPolicyAsync,
        selectCardFromOnnxPolicyAsync,
        isCardChoiceAllowedByRisk,
        buildCardUseDecisionContext,
        cpuSelectDestroyWithPolicy,
        cpuSelectSacrificeWillWithPolicy,
        cpuSelectSellCardWillWithPolicy,
        cpuSelectHeavenBlessingWithPolicy,
        cpuSelectCondemnWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
        cpuSelectPositionSwapWillWithPolicy,
        cpuSelectTrapWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectTimeBombWithPolicy,
        cpuSelectTemptWillWithPolicy,
        computeCpuAction,
        setCpuRng
    };
}

// Expose to global for environments that rely on global symbols (e.g., browser concatenation)
if (typeof global !== 'undefined') { global.computeCpuAction = computeCpuAction; global.selectCardToUse = selectCardToUse; global.applyCardChoice = applyCardChoice; }
// Register via UIBootstrap when available, fallback to globalThis for legacy global access
try {
    const uiBootstrap = require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ computeCpuAction });
} catch (e) { /* ignore */ }
try { if (typeof globalThis !== 'undefined') globalThis.computeCpuAction = computeCpuAction; } catch (e) {}

