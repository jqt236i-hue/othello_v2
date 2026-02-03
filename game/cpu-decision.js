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

if (!isAISystemAvailable()) {
    console.error('[CPU] AISystem is not loaded. Please include game/ai/level-system.js');
}

/**
 * フォールバック: レベルやハンド状況に基づいて使用候補を返す
 */
// CPU RNG injection (default deterministic to avoid random calls in game layer)
let cpuRng = { random: () => 0.5 };
function setCpuRng(rng) { cpuRng = rng || cpuRng; }

function selectCardFallback(cardState, gameState, playerKey, level, legalMoves) {
    if (typeof cardState === 'undefined' || !cardState) return null;
    if (typeof CardLogic === 'undefined' || !CardLogic.canUseCard) return null;
    const hand = cardState.hands[playerKey] || [];
    const usable = hand.filter(id => CardLogic.canUseCard(cardState, playerKey, id));
    if (!usable.length) return null;

    // レベルに応じた使用確率（高レベルほど高確率でカードを使う）
    const probs = {1:0.15, 2:0.25, 3:0.35, 4:0.55, 5:0.75, 6:0.9, 7:1.0};
    const p = probs[level] || 0.2;
    if (cpuRng.random() > p) return null;

    // 優先するカードタイプ
    const prefTypes = new Set(['DESTROY_ONE_STONE','INHERIT_WILL','TEMPT_WILL','SWAP_WITH_ENEMY','FREE_PLACEMENT','DOUBLE_PLACE','PLUNDER_WILL','GOLD_STONE','SILVER_STONE']);
    const pref = usable.filter(id => {
        const def = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(id) : null;
        return def && prefTypes.has(def.type);
    });

    const choiceId = (pref.length ? pref[Math.floor(cpuRng.random()*pref.length)] : usable[Math.floor(cpuRng.random()*usable.length)]);
    const cardDef = (typeof CardLogic.getCardDef === 'function') ? CardLogic.getCardDef(choiceId) : null;
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
    const handIndex = cardState.hands[playerKey].indexOf(cardId);
    if (handIndex === -1) return false;
    if (typeof CardLogic === 'undefined' || !CardLogic.applyCardUsage) {
        console.warn('[CPU] CardLogic.applyCardUsage not available, skipping card use');
        return false;
    }
    const ok = CardLogic.applyCardUsage(cardState, gameState, playerKey, cardId);
    if (!ok) return false;

    const level = cpuSmartness[playerKey] || 1;
    console.log(`[CPU] Lv${level} ${playerKey}: カード使用 - ${cardDef ? cardDef.name : cardId}`);
    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})がカードを使用: ${cardDef ? cardDef.name : cardId}`);
    }

    if (typeof emitCardStateChange === 'function') emitCardStateChange();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();

    if (typeof isCardAnimating !== 'undefined') {
        // Keep existing contract: briefly toggle to signal animation-driven UI if needed
        isCardAnimating = true;
        isCardAnimating = false;
    }

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
        console.log(`[CPU] Lv${level} ${playerKey}: カードスキップ (no candidate)`);
        return false;
    }

    if (applyCardChoice(playerKey, cardChoice)) return true;

    // Try other usable cards as fallback (preserve original retry behavior)
    if (typeof CardLogic !== 'undefined' && CardLogic.canUseCard) {
        const hand = cardState.hands[playerKey] || [];
        const usable = hand.filter(id => CardLogic.canUseCard(cardState, playerKey, id));
        for (const id of usable) {
            if (id === (cardChoice && cardChoice.cardId)) continue;
            const def = CardLogic.getCardDef ? CardLogic.getCardDef(id) : null;
            if (applyCardChoice(playerKey, { cardId: id, cardDef: def })) return true;
        }
    }

    console.log(`[CPU] Lv${level} ${playerKey}: カード使用に失敗`);
    return false;
}

/**
 * CPU手選択
 * @param {Array} candidateMoves - 合法手リスト
 * @param {string} playerKey - 'black' または 'white'
 * @returns {Object} 選択された手
 */
function selectCpuMoveWithPolicy(candidateMoves, playerKey) {
    if (!isAISystemAvailable() || typeof AISystem.selectMove !== 'function') {
        // フォールバック: ランダム (injectable via setCpuRng)
        console.warn('[CPU] AISystem not available, using random');
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }

    const level = cpuSmartness[playerKey] || 1;
    // 人間プレイヤーの場合はエラー（このコードは呼ばれてはいけない）
    if (level < 0) {
        console.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
        return candidateMoves[Math.floor(cpuRng.random() * candidateMoves.length)];
    }
    try {
        const selectedMove = AISystem.selectMove(gameState, cardState, candidateMoves, level, null);
        console.log(`[CPU] Lv${level} ${playerKey}: 選択 (${selectedMove.row}, ${selectedMove.col}) - 反転${selectedMove.flips.length}枚`);
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
        console.log(`[CPU] Lv${level} ${playerKey}: 破壊対象なし`);
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

    console.log(`[CPU] Lv${level} ${playerKey}: 破壊ターゲット (${target.row}, ${target.col})`);

    // 破壊実行
    if (typeof handleDestroySelection === 'function') {
        handleDestroySelection(target.row, target.col, playerKey);
    }
}

/**
 * 意志の継承 対象選択
 * @param {string} playerKey - 'black' または 'white'
 */
async function cpuSelectInheritWillWithPolicy(playerKey) {
    const targets = (typeof CardLogic !== 'undefined' && typeof CardLogic.getSelectableTargets === 'function')
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];

    if (!targets.length) {
        console.log(`[CPU] ${playerKey}: 継承対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    console.log(`[CPU] ${playerKey}: 継承ターゲット (${target.row}, ${target.col})`);

    if (typeof handleInheritSelection === 'function') {
        handleInheritSelection(target.row, target.col, playerKey);
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
        console.log(`[CPU] ${playerKey}: 交換対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    console.log(`[CPU] ${playerKey}: 交換ターゲット (${target.row}, ${target.col})`);

    if (typeof handleSwapSelection === 'function') {
        handleSwapSelection(target.row, target.col, playerKey);
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
        console.log(`[CPU] ${playerKey}: 誘惑対象なし`);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return;
    }

    const target = targets[Math.floor(cpuRng.random() * targets.length)];
    console.log(`[CPU] ${playerKey}: 誘惑ターゲット (${target.row}, ${target.col})`);

    if (typeof handleTemptSelection === 'function') {
        handleTemptSelection(target.row, target.col, playerKey);
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
        cpuSelectDestroyWithPolicy,
        cpuSelectInheritWithPolicy: cpuSelectInheritWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
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
