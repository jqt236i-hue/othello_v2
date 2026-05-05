"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
/**
 * @file mcts-policy.js
 * @description Neural-guided MCTS integration for CPU Lv6 (Phase 1).
 *
 * In Phase 1 MCTS explores **placement moves only**.  Card usage is decided
 * once at the root node by the neural-network card head and then fixed for
 * the remainder of the tree search.  This keeps the search tree manageable
 * while still giving the network a strong positional evaluation role.
 *
 * The module exposes ``searchWithMcts()`` which returns the best action
 * after the requested number of simulations.
 */
const { MCTSTree } = require('./mcts-core');
const { GumbelMCTS } = require('./gumbel-mcts');
let CoreLogic = null;
try {
    CoreLogic = _require('../logic/core');
}
catch (e) { /* ignore */ }
let CardLogic = null;
try {
    CardLogic = _require('../logic/cards');
}
catch (e) { /* ignore */ }
let CpuPolicyOnnxRuntime = null;
try {
    CpuPolicyOnnxRuntime = _require('./policy-onnx-runtime');
}
catch (e) { /* ignore */ }
function getPlayerValue(playerKey) {
    if (CoreLogic && CoreLogic.BLACK !== undefined) {
        return playerKey === 'black' ? CoreLogic.BLACK : CoreLogic.WHITE;
    }
    return playerKey === 'black' ? 1 : -1;
}
function copyGameState(state) {
    if (CoreLogic && typeof CoreLogic.copyGameState === 'function') {
        return CoreLogic.copyGameState(state);
    }
    // Fallback deep clone for headless self-play
    return JSON.parse(JSON.stringify(state));
}
function copyCardState(cardState) {
    if (!cardState)
        return null;
    return JSON.parse(JSON.stringify(cardState));
}
function boardToString(board) {
    if (!Array.isArray(board))
        return '';
    try {
        return JSON.stringify(board);
    }
    catch (e) {
        return '';
    }
}
// ---------------------------------------------------------------------------
// Game interface injected into MCTSTree
// ---------------------------------------------------------------------------
const _gameInterface = {
    copyState: copyGameState,
    copyCardState: copyCardState,
    hashState(state, cardState, playerKey) {
        const boardStr = boardToString(state && state.board);
        const chargeStr = (cardState && cardState.charge)
            ? JSON.stringify(cardState.charge)
            : '';
        return `${boardStr}|${chargeStr}|${playerKey}`;
    },
    hashAfterAction(parentHash, action) {
        return `${parentHash}>${action.type}:${action.row ?? '_'}:${action.col ?? '_'}:${action.cardId ?? '_'}`;
    },
    listActions(state, cardState, playerKey) {
        const actions = [];
        if (!CoreLogic || typeof CoreLogic.getLegalMoves !== 'function') {
            return actions;
        }
        const playerValue = getPlayerValue(playerKey);
        const legalMoves = CoreLogic.getLegalMoves(state, playerValue);
        for (const move of legalMoves) {
            if (move && Number.isFinite(move.row) && Number.isFinite(move.col)) {
                actions.push({ type: 'place', row: move.row, col: move.col });
            }
        }
        return actions;
    },
    applyAction(state, cardState, action, playerKey) {
        const nextState = copyGameState(state);
        const nextCardState = copyCardState(cardState);
        const nextPlayer = playerKey === 'black' ? 'white' : 'black';
        if (action.type === 'place') {
            if (CoreLogic && typeof CoreLogic.applyMove === 'function') {
                try {
                    CoreLogic.applyMove(nextState, { row: action.row, col: action.col });
                }
                catch (e) {
                    // If applyMove fails, return original state (should not happen for legal moves)
                }
            }
            if (CoreLogic && CoreLogic.BLACK !== undefined) {
                nextState.currentPlayer = getPlayerValue(nextPlayer);
            }
        }
        // Phase 1: card actions are not expanded inside the tree
        return { state: nextState, cardState: nextCardState, nextPlayer };
    },
    isTerminal(state, cardState) {
        if (!CoreLogic) {
            return { isTerminal: false, value: 0 };
        }
        // Simple terminal heuristic: no legal moves for either player or board full
        const blackVal = CoreLogic.BLACK !== undefined ? CoreLogic.BLACK : 1;
        const whiteVal = CoreLogic.WHITE !== undefined ? CoreLogic.WHITE : -1;
        const blackMoves = CoreLogic.getLegalMoves ? CoreLogic.getLegalMoves(state, blackVal).length : 0;
        const whiteMoves = CoreLogic.getLegalMoves ? CoreLogic.getLegalMoves(state, whiteVal).length : 0;
        if (blackMoves > 0 || whiteMoves > 0) {
            return { isTerminal: false, value: 0 };
        }
        // Game over – compute winner
        let blackCount = 0;
        let whiteCount = 0;
        if (typeof CoreLogic.countDiscs === 'function') {
            const counts = CoreLogic.countDiscs(state);
            blackCount = counts.black || 0;
            whiteCount = counts.white || 0;
        }
        else if (Array.isArray(state.board)) {
            for (const row of state.board) {
                if (!Array.isArray(row))
                    continue;
                for (const cell of row) {
                    if (cell === blackVal)
                        blackCount++;
                    else if (cell === whiteVal)
                        whiteCount++;
                }
            }
        }
        const currentPlayer = (state.currentPlayer === blackVal) ? 'black' : 'white';
        let value = 0;
        if (blackCount > whiteCount)
            value = currentPlayer === 'black' ? 1 : -1;
        else if (whiteCount > blackCount)
            value = currentPlayer === 'white' ? 1 : -1;
        return { isTerminal: true, value };
    },
    nextPlayer(playerKey) {
        return playerKey === 'black' ? 'white' : 'black';
    },
    actionToKey(action) {
        if (action.type === 'place') {
            return `place:${action.row}:${action.col}`;
        }
        return JSON.stringify(action);
    },
};
// ---------------------------------------------------------------------------
// Neural-network wrapper injected into MCTSTree
// ---------------------------------------------------------------------------
function _buildOnnxContext(state, cardState, playerKey, legalMoves) {
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const board = Array.isArray(state && state.board) ? state.board : [];
    const charge = (cardState && cardState.charge) || {};
    const deckMetrics = _resolveDeckMetrics(cardState, playerKey);
    let hasCornerMove = false;
    let hasEdgeMove = false;
    let maxLegalBonus = 0;
    for (const move of legalMoves) {
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col))
            continue;
        if (!hasCornerMove && (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)) {
            hasCornerMove = true;
        }
        if (!hasEdgeMove && !hasCornerMove &&
            (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7)) {
            hasEdgeMove = true;
        }
    }
    return {
        playerKey,
        level: 6,
        board,
        legalMovesCount: legalMoves.length,
        ownCharge: Number.isFinite(charge[playerKey]) ? charge[playerKey] : 0,
        oppCharge: Number.isFinite(charge[opponentKey]) ? charge[opponentKey] : 0,
        deckCount: Number.isFinite(deckMetrics.legacyDeckCount) ? deckMetrics.legacyDeckCount : 0,
        ownDeckCount: Number.isFinite(deckMetrics.ownDeckCount) ? deckMetrics.ownDeckCount : 0,
        initialDeckSize: Number.isFinite(deckMetrics.initialDeckSize) ? deckMetrics.initialDeckSize : 0,
        handCardIds: _getHandCardIds(cardState, playerKey),
        usableCardIds: _getUsableCardIds(cardState, playerKey),
        candidateMoves: legalMoves,
        hasCornerMoveNow: hasCornerMove,
        hasEdgeMoveNow: hasEdgeMove,
        maxLegalMoveBonus: maxLegalBonus,
        highBonusMoveAvailable: maxLegalBonus >= 3,
    };
}
function _resolveDeckMetrics(cardState, playerKey) {
    const legacyDeckCount = (cardState && Array.isArray(cardState.deck)) ? cardState.deck.length : 0;
    const ownDeckCount = (cardState && cardState.decks && Array.isArray(cardState.decks[playerKey]))
        ? cardState.decks[playerKey].length
        : legacyDeckCount;
    const initialDeckSizeByPlayer = (cardState && cardState.initialDeckSizeByPlayer)
        ? cardState.initialDeckSizeByPlayer
        : null;
    const initialDeckSize = initialDeckSizeByPlayer && Number.isFinite(initialDeckSizeByPlayer[playerKey])
        ? initialDeckSizeByPlayer[playerKey]
        : ((cardState && Number.isFinite(cardState.initialDeckSize)) ? cardState.initialDeckSize : ownDeckCount);
    return { legacyDeckCount, ownDeckCount, initialDeckSize };
}
function _getHandCardIds(cardState, playerKey) {
    if (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])) {
        return cardState.hands[playerKey].slice();
    }
    return [];
}
function _getUsableCardIds(cardState, playerKey) {
    if (!CardLogic || typeof CardLogic.getUsableCards !== 'function')
        return [];
    try {
        return CardLogic.getUsableCards(cardState, playerKey);
    }
    catch (e) {
        return [];
    }
}
const _network = {
    async evaluate(state, cardState, playerKey) {
        if (!CpuPolicyOnnxRuntime) {
            return { policy: new Map(), value: 0 };
        }
        const legalMoves = _gameInterface.listActions(state, cardState, playerKey);
        const context = _buildOnnxContext(state, cardState, playerKey, legalMoves);
        let outputs;
        try {
            outputs = await CpuPolicyOnnxRuntime.runInference(context);
        }
        catch (e) {
            return { policy: new Map(), value: 0 };
        }
        // ---- Policy ----
        const policy = new Map();
        const placeOut = outputs && (outputs.place_logits || outputs[Object.keys(outputs)[0]]);
        if (placeOut && placeOut.data) {
            const scores = placeOut.data;
            let maxScore = -Infinity;
            for (const move of legalMoves) {
                const idx = ((move.row + 1) * 10) + (move.col + 1); // padded 10x10
                if (idx >= 0 && idx < scores.length) {
                    const s = Number(scores[idx]);
                    if (Number.isFinite(s) && s > maxScore)
                        maxScore = s;
                }
            }
            // Softmax over legal moves
            let sumExp = 0;
            const entries = [];
            for (const move of legalMoves) {
                const idx = ((move.row + 1) * 10) + (move.col + 1);
                let prob = 0;
                if (idx >= 0 && idx < scores.length) {
                    const s = Number(scores[idx]);
                    if (Number.isFinite(s)) {
                        prob = Math.exp(s - maxScore);
                    }
                }
                entries.push({ move, prob });
                sumExp += prob;
            }
            for (const entry of entries) {
                const key = _gameInterface.actionToKey(entry.move);
                policy.set(key, sumExp > 0 ? entry.prob / sumExp : (1.0 / legalMoves.length));
            }
        }
        // ---- Value ----
        let value = 0;
        const keys = outputs ? Object.keys(outputs) : [];
        const valueOut = outputs && (outputs.value || (keys.length > 1 ? outputs[keys[1]] : null));
        if (valueOut && valueOut.data && valueOut.data.length > 0) {
            const v = Number(valueOut.data[0]);
            if (Number.isFinite(v))
                value = v;
        }
        return { policy, value };
    },
};
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Run a lightweight MCTS search and return the most visited action.
 *
 * @param {object} state
 * @param {object|null} cardState
 * @param {string} playerKey
 * @param {object} [opts]
 * @param {number} [opts.numSimulations]
 * @param {number} [opts.temperature]
 * @returns {Promise<object|null>}  Best action or null on failure.
 */
async function searchWithMcts(state, cardState, playerKey, opts) {
    const options = opts || {};
    const numSimulations = Number.isFinite(options.numSimulations)
        ? Math.max(1, Math.floor(options.numSimulations))
        : 100; // intentionally small for browser latency
    const useGumbel = options.useGumbel === true;
    try {
        let result;
        if (useGumbel) {
            const tree = new GumbelMCTS({
                gameInterface: _gameInterface,
                network: _network,
                numSimulations,
                maxActions: Number.isFinite(options.maxActions) ? options.maxActions : 8,
            });
            result = await tree.search(state, cardState, playerKey);
        }
        else {
            const tree = new MCTSTree({
                gameInterface: _gameInterface,
                network: _network,
                numSimulations,
                c_puct: 1.5,
                temperature: 1.0,
                fpuReduction: 0.2,
            });
            result = await tree.search(state, cardState, playerKey);
        }
        if (!Array.isArray(result) || result.length === 0)
            return null;
        result.sort((a, b) => b.visitCount - a.visitCount);
        return result[0].action;
    }
    catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[MCTS] search failed, fallback to direct policy', e);
        }
        return null;
    }
}
// Browser global
if (typeof globalThis !== 'undefined') {
    globalThis.CpuMctsPolicy = { searchWithMcts, _gameInterface, _network }; // @compat - backward-compat export
}
;
module.exports = { searchWithMcts, _gameInterface, _network };
//# sourceMappingURL=mcts-policy.js.map