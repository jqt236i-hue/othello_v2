/**
 * @file selfplay-runner.js
 * @description Headless self-play runner backed by the production TurnPipeline.
 */

'use strict';

const Core = require('../../game/logic/core');
const CardLogic = require('../../game/logic/cards');
const TurnPipeline = require('../../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../../game/schema/prng');
const deepClone = require('../../utils/deepClone');

const SELFPLAY_SCHEMA_VERSION = 'selfplay.v1';

const TARGET_SELECTION_CARD_TYPES = new Set([
    'DESTROY_ONE_STONE',
    'STRONG_WIND_WILL',
    'SACRIFICE_WILL',
    'SELL_CARD_WILL',
    'SWAP_WITH_ENEMY',
    'INHERIT_WILL',
    'TEMPT_WILL'
]);

const CANDIDATE_CARD_TYPES = new Set([
    'FREE_PLACEMENT',
    'PROTECTED_NEXT_STONE',
    'PERMA_PROTECT_NEXT_STONE',
    'CHAIN_WILL',
    'REGEN_WILL',
    'TIME_BOMB',
    'ULTIMATE_REVERSE_DRAGON',
    'BREEDING_WILL',
    'HYPERACTIVE_WILL',
    'PLUNDER_WILL',
    'WORK_WILL',
    'DOUBLE_PLACE',
    'GOLD_STONE',
    'SILVER_STONE',
    'STEAL_CARD',
    'ULTIMATE_DESTROY_GOD',
    'DESTROY_ONE_STONE',
    'STRONG_WIND_WILL',
    'SACRIFICE_WILL',
    'SELL_CARD_WILL',
    'SWAP_WITH_ENEMY',
    'INHERIT_WILL',
    'TEMPT_WILL'
]);

const POSITION_WEIGHTS = [
    [120, -20, 20, 5, 5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20, 5, 5, 20, -20, 120]
];

function toPlayerKey(playerValue) {
    return playerValue === Core.BLACK ? 'black' : 'white';
}

function toPlayerValue(playerKey) {
    return playerKey === 'black' ? Core.BLACK : Core.WHITE;
}

function getSafeCardContext(cardState) {
    let context = null;
    try {
        const ctxHelper = require('../../game/logic/context');
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(cardState);
        }
    } catch (e) { /* ignore */ }
    if (context) return context;
    try {
        return CardLogic.getCardContext(cardState);
    } catch (e) {
        return {
            protectedStones: [],
            permaProtectedStones: [],
            bombs: []
        };
    }
}

function encodeBoard(board) {
    return board
        .map((row) => row.map((v) => (v === Core.BLACK ? 'B' : (v === Core.WHITE ? 'W' : '.'))).join(''))
        .join('/');
}

function decodeBoard(boardStr) {
    if (!boardStr) return [];
    return boardStr.split('/').map((row) => row.split(''));
}

function transformCoord(row, col, size, t) {
    if (t === 0) return { row, col };
    if (t === 1) return { row: col, col: size - 1 - row };
    if (t === 2) return { row: size - 1 - row, col: size - 1 - col };
    if (t === 3) return { row: size - 1 - col, col: row };
    if (t === 4) return { row, col: size - 1 - col };
    if (t === 5) return { row: size - 1 - col, col: size - 1 - row };
    if (t === 6) return { row: size - 1 - row, col };
    if (t === 7) return { row: col, col: row };
    return { row, col };
}

function transformBoard(board, t) {
    if (!Array.isArray(board) || !board.length) return [];
    const size = board.length;
    const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const next = transformCoord(r, c, size, t);
            out[next.row][next.col] = board[r][c];
        }
    }
    return out;
}

function canonicalizeBoard(board) {
    const raw = encodeBoard(board);
    if (!raw) return { boardKey: raw, transformId: 0 };
    const decoded = decodeBoard(raw);
    let best = null;
    let bestT = 0;
    for (let t = 0; t < 8; t++) {
        const encoded = encodeBoard(transformBoard(decoded, t));
        if (best === null || encoded < best) {
            best = encoded;
            bestT = t;
        }
    }
    return { boardKey: best || raw, transformId: bestT };
}

function isCorner(row, col) {
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

function isEdge(row, col) {
    return row === 0 || row === 7 || col === 0 || col === 7;
}

function isXSquare(row, col) {
    return (row === 1 || row === 6) && (col === 1 || col === 6);
}

function isCSquare(row, col) {
    const nearTopBottom = (row === 0 || row === 7) && (col === 1 || col === 6);
    const nearLeftRight = (col === 0 || col === 7) && (row === 1 || row === 6);
    return nearTopBottom || nearLeftRight;
}

function scoreMove(move, rng) {
    let score = move.flips.length * 100;
    if (isCorner(move.row, move.col)) score += 10000;
    if (isEdge(move.row, move.col)) score += 250;
    if (isXSquare(move.row, move.col)) score -= 600;
    if (isCSquare(move.row, move.col)) score -= 300;
    // Deterministic tie-break jitter.
    score += rng.random() * 0.01;
    return score;
}

function evaluatePositionalDiff(board, playerValue) {
    let own = 0;
    let opp = 0;
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            const cell = board[row][col];
            const w = POSITION_WEIGHTS[row] && Number.isFinite(POSITION_WEIGHTS[row][col]) ? POSITION_WEIGHTS[row][col] : 0;
            if (cell === playerValue) own += w;
            else if (cell === -playerValue) opp += w;
        }
    }
    return own - opp;
}

function countCorners(board, playerValue) {
    if (!Array.isArray(board) || board.length === 0) return 0;
    const n = board.length - 1;
    const points = [[0, 0], [0, n], [n, 0], [n, n]];
    let own = 0;
    let opp = 0;
    for (const p of points) {
        const row = board[p[0]];
        if (!Array.isArray(row)) continue;
        const v = row[p[1]];
        if (v === playerValue) own += 1;
        else if (v === -playerValue) opp += 1;
    }
    return own - opp;
}

function countDiscsByValue(gameState, playerValue) {
    if (isStandardBoard(gameState.board)) {
        const counts = Core.countDiscs(gameState);
        return playerValue === Core.BLACK
            ? (counts.black - counts.white)
            : (counts.white - counts.black);
    }
    let own = 0;
    let opp = 0;
    for (let r = 0; r < gameState.board.length; r++) {
        for (let c = 0; c < gameState.board[r].length; c++) {
            const v = gameState.board[r][c];
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
        }
    }
    return own - opp;
}

function countEmpties(board) {
    let empties = 0;
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === 0) empties += 1;
        }
    }
    return empties;
}

function isStandardBoard(board) {
    if (!Array.isArray(board) || board.length !== 8) return false;
    for (const row of board) {
        if (!Array.isArray(row) || row.length !== 8) return false;
    }
    return true;
}

function evaluateBoardForPlayer(gameState, cardState, playerKey) {
    const playerValue = toPlayerValue(playerKey);
    const context = getSafeCardContext(cardState);
    let mobilityDiff = 0;
    if (isStandardBoard(gameState.board)) {
        const ownMobility = Core.getLegalMoves(gameState, playerValue, context).length;
        const oppMobility = Core.getLegalMoves(gameState, -playerValue, context).length;
        mobilityDiff = ownMobility - oppMobility;
    }
    const cornerDiff = countCorners(gameState.board, playerValue);
    const positionalDiff = evaluatePositionalDiff(gameState.board, playerValue);
    const discDiff = countDiscsByValue(gameState, playerValue);
    const empties = countEmpties(gameState.board);
    const discWeight = empties <= 12 ? 22 : (empties <= 24 ? 10 : 2);

    return (
        (cornerDiff * 350) +
        (mobilityDiff * 18) +
        (positionalDiff * 4) +
        (discDiff * discWeight)
    );
}

function applyMoveForEvaluation(gameState, move, playerValue) {
    const nextState = Core.copyGameState(gameState);
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return nextState;
    nextState.board[move.row][move.col] = playerValue;
    const flips = Array.isArray(move.flips) ? move.flips : [];
    for (const f of flips) {
        if (Array.isArray(f) && f.length >= 2 && Number.isFinite(f[0]) && Number.isFinite(f[1])) {
            nextState.board[f[0]][f[1]] = playerValue;
            continue;
        }
        if (f && Number.isFinite(f.row) && Number.isFinite(f.col)) {
            nextState.board[f.row][f.col] = playerValue;
        }
    }
    nextState.currentPlayer = -playerValue;
    nextState.consecutivePasses = 0;
    nextState.turnNumber = (gameState.turnNumber || 0) + 1;
    return nextState;
}

function scoreTacticalMove(move, context) {
    if (!context || !context.gameState || !context.cardState) return 0;
    const playerKey = context.playerKey === 'black' ? 'black' : 'white';
    const playerValue = toPlayerValue(playerKey);
    const safeContext = getSafeCardContext(context.cardState);
    const nextState = applyMoveForEvaluation(context.gameState, move, playerValue);
    const ownEval = evaluateBoardForPlayer(nextState, context.cardState, playerKey);
    const opponentMoves = isStandardBoard(nextState.board)
        ? Core.getLegalMoves(nextState, -playerValue, safeContext)
        : [];
    let opponentThreat = 0;
    let givesCorner = false;
    for (const oppMove of opponentMoves) {
        const immediate = (oppMove.flips ? oppMove.flips.length : 0) * 80 + evaluatePositionValue(oppMove.row, oppMove.col);
        if (immediate > opponentThreat) opponentThreat = immediate;
        if (isCorner(oppMove.row, oppMove.col)) givesCorner = true;
    }

    return ownEval - (opponentThreat * 8) - (opponentMoves.length * 40) - (givesCorner ? 1800 : 0);
}

function makePolicyStateKey(playerKey, board, pendingType, legalMovesCount) {
    const pending = pendingType || '-';
    const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    return `${playerKey}|${encodeBoard(board)}|${pending}|${legal}`;
}

function makePolicyActionKey(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
    return `place:${move.row}:${move.col}`;
}

function cellType(row, col, size) {
    const n = Number.isFinite(size) && size > 0 ? size : 8;
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
    if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) return 'x';
    const nearTB = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
    const nearLR = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
    if (nearTB || nearLR) return 'c';
    if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
    return 'inner';
}

function makePolicyAbstractActionKey(move, boardSize) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return 'place_cat:unknown';
    return `place_cat:${cellType(move.row, move.col, boardSize)}`;
}

function countEmptiesInBoardKey(boardKey) {
    if (typeof boardKey !== 'string' || !boardKey) return 0;
    let c = 0;
    for (let i = 0; i < boardKey.length; i++) if (boardKey[i] === '.') c++;
    return c;
}

function discDiffFromPlayer(boardKey, playerKey) {
    if (typeof boardKey !== 'string') return 0;
    let b = 0;
    let w = 0;
    for (let i = 0; i < boardKey.length; i++) {
        if (boardKey[i] === 'B') b++;
        if (boardKey[i] === 'W') w++;
    }
    return playerKey === 'black' ? (b - w) : (w - b);
}

function cornerDiffFromPlayer(boardKey, playerKey) {
    const rows = typeof boardKey === 'string' ? boardKey.split('/') : [];
    if (!rows.length) return 0;
    const size = rows.length;
    const own = playerKey === 'black' ? 'B' : 'W';
    const opp = own === 'B' ? 'W' : 'B';
    const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
    let ownCount = 0;
    let oppCount = 0;
    for (const p of corners) {
        const ch = rows[p[0]][p[1]];
        if (ch === own) ownCount++;
        else if (ch === opp) oppCount++;
    }
    return ownCount - oppCount;
}

function toBucket(value, steps) {
    for (let i = 0; i < steps.length; i++) {
        if (value <= steps[i]) return String(steps[i]);
    }
    return `>${steps[steps.length - 1]}`;
}

function makePolicyAbstractStateKey(playerKey, board, pendingType, legalMovesCount) {
    const canonical = canonicalizeBoard(board);
    const boardKey = canonical.boardKey || '';
    const pending = pendingType || '-';
    const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
    const empties = countEmptiesInBoardKey(boardKey);
    const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
    const mobility = toBucket(legal, [0, 2, 4, 6, 10, 20]);
    const disc = toBucket(discDiffFromPlayer(boardKey, playerKey), [-20, -10, -4, 0, 4, 10, 20]);
    const corner = toBucket(cornerDiffFromPlayer(boardKey, playerKey), [-4, -2, -1, 0, 1, 2, 4]);
    return `${playerKey}|${pending}|${phase}|mob:${mobility}|disc:${disc}|corner:${corner}`;
}

function getPolicyScore(options, context, move) {
    if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
    const model = options.policyTableModel;
    if (model.schemaVersion !== SELFPLAY_SCHEMA_VERSION && model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== 'policy_table.v2') return null;

    const schema = model.schemaVersion || 'policy_table.v1';
    const canonical = schema === 'policy_table.v2'
        ? canonicalizeBoard(context.gameState.board)
        : { boardKey: encodeBoard(context.gameState.board), transformId: 0 };
    const key = `${context.playerKey}|${canonical.boardKey}|${context.pendingType || '-'}|${context.legalMovesCount}`;
    let state = model.states[key];
    let isAbstract = false;
    if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = makePolicyAbstractStateKey(
            context.playerKey,
            context.gameState.board,
            context.pendingType || '-',
            context.legalMovesCount
        );
        state = model.abstractStates[abstractKey];
        isAbstract = !!state;
    }
    if (!state || !state.actions) return null;

    const actionKey = (() => {
        if (isAbstract) return makePolicyAbstractActionKey(move, context.gameState.board.length);
        if (schema !== 'policy_table.v2') return makePolicyActionKey(move);
        const mapped = transformCoord(move.row, move.col, context.gameState.board.length, canonical.transformId);
        return `place:${mapped.row}:${mapped.col}`;
    })();
    const stat = state.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = state.bestAction === actionKey ? (isAbstract ? 100_000 : 1_000_000) : 0;
    return bestBonus + visits * 1_000 + avgOutcome;
}

function getPolicyActionScoreByKey(options, context, actionKey) {
    if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
    if (!actionKey || typeof actionKey !== 'string') return null;
    const model = options.policyTableModel;
    if (model.schemaVersion !== SELFPLAY_SCHEMA_VERSION && model.schemaVersion !== 'policy_table.v1' && model.schemaVersion !== 'policy_table.v2') return null;

    const schema = model.schemaVersion || 'policy_table.v1';
    const canonical = schema === 'policy_table.v2'
        ? canonicalizeBoard(context.gameState.board)
        : { boardKey: encodeBoard(context.gameState.board), transformId: 0 };
    const key = `${context.playerKey}|${canonical.boardKey}|${context.pendingType || '-'}|${context.legalMovesCount}`;
    let state = model.states[key];
    if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
        const abstractKey = makePolicyAbstractStateKey(context.playerKey, context.gameState.board, context.pendingType || '-', context.legalMovesCount);
        state = model.abstractStates[abstractKey];
    }
    if (!state || !state.actions) return null;

    const stat = state.actions[actionKey];
    if (!stat) return null;
    const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
    const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
    const bestBonus = state.bestAction === actionKey ? 1_000_000 : 0;
    return bestBonus + visits * 1_000 + avgOutcome;
}

function selectPlacementMove(legalMoves, rng, context, options) {
    const enableTacticalLookahead = !!(options && (options.enableTacticalLookahead || options.policyTableModel));
    let best = null;
    let bestScore = -Infinity;
    for (const move of legalMoves) {
        const heuristic = scoreMove(move, rng);
        const policy = getPolicyScore(options, context, move);
        const tactical = enableTacticalLookahead ? scoreTacticalMove(move, context) : 0;
        const s = heuristic + (policy !== null ? policy : 0) + tactical;
        if (s > bestScore) {
            bestScore = s;
            best = move;
        }
    }
    return best;
}

function evaluatePositionValue(row, col) {
    let score = 0;
    if (isCorner(row, col)) score += 10000;
    else if (isEdge(row, col)) score += 250;
    if (isXSquare(row, col)) score -= 600;
    if (isCSquare(row, col)) score -= 300;
    return score;
}

function getLegalMovesForAction(gameState, cardState, playerKey) {
    const player = toPlayerValue(playerKey);
    const context = getSafeCardContext(cardState);
    const pendingType = CardLogic.getPendingEffectType(cardState, playerKey);

    if (pendingType === 'FREE_PLACEMENT') {
        return Core.getFreePlacementMoves(gameState, player, context);
    }
    return Core.getLegalMoves(gameState, player, context);
}

function getDirectUsableCardIds(cardState, gameState, playerKey) {
    const ids = CardLogic.getUsableCardIds(cardState, gameState, playerKey);
    return ids.filter((cardId) => {
        const t = CardLogic.getCardType(cardId);
        return CANDIDATE_CARD_TYPES.has(t);
    });
}

function selectCardIdToUse(cardState, gameState, playerKey, options, context) {
    const usable = getDirectUsableCardIds(cardState, gameState, playerKey);
    if (!usable.length) return null;

    if (options && options.policyTableModel && context) {
        let bestCardId = null;
        let bestScore = -Infinity;
        for (const cardId of usable) {
            const s = getPolicyActionScoreByKey(options, context, `use_card:${cardId}`);
            if (!Number.isFinite(s)) continue;
            if (s > bestScore) {
                bestScore = s;
                bestCardId = cardId;
            }
        }
        if (bestCardId) return bestCardId;
    }

    usable.sort((a, b) => CardLogic.getCardCost(b) - CardLogic.getCardCost(a));
    return usable[0];
}

function chooseSwapTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const t of targets) {
        // Swap also places on the target cell, so use placement scoring.
        const s = evaluatePositionValue(t.row, t.col) + rng.random() * 0.01;
        if (s > bestScore) {
            bestScore = s;
            best = t;
        }
    }
    return best;
}

function chooseInheritTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const t of targets) {
        const s = evaluatePositionValue(t.row, t.col) + rng.random() * 0.01;
        if (s > bestScore) {
            bestScore = s;
            best = t;
        }
    }
    return best;
}

function chooseDestroyTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    const selfVal = toPlayerValue(playerKey);
    let best = null;
    let bestScore = -Infinity;
    for (const t of targets) {
        const occupant = gameState.board[t.row][t.col];
        const isEnemy = occupant === -selfVal;
        const base = evaluatePositionValue(t.row, t.col);
        // Prefer destroying enemy strategic stones.
        const s = (isEnemy ? 2000 : 0) + base + rng.random() * 0.01;
        if (s > bestScore) {
            bestScore = s;
            best = t;
        }
    }
    return best;
}

function chooseStrongWindTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    return targets[Math.floor(rng.random() * targets.length)];
}

function chooseSacrificeTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    let best = null;
    let bestScore = Infinity;
    for (const t of targets) {
        // Sacrifice low-value stones first.
        const s = evaluatePositionValue(t.row, t.col) + rng.random() * 0.01;
        if (s < bestScore) {
            bestScore = s;
            best = t;
        }
    }
    return best;
}

function chooseTemptTarget(gameState, cardState, playerKey, rng) {
    const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
    if (!targets.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const t of targets) {
        const s = evaluatePositionValue(t.row, t.col) + rng.random() * 0.01;
        if (s > bestScore) {
            bestScore = s;
            best = t;
        }
    }
    return best;
}

function chooseSellCardTarget(cardState, playerKey) {
    const hand = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
        ? cardState.hands[playerKey]
        : [];
    if (!hand.length) return null;
    let bestId = hand[0];
    let bestCost = -Infinity;
    for (const cardId of hand) {
        const cost = CardLogic.getCardCost(cardId) || 0;
        if (cost > bestCost) {
            bestCost = cost;
            bestId = cardId;
        }
    }
    return bestId;
}

function buildPendingSelectionAction(gameState, cardState, playerKey, pendingType, rng) {
    if (pendingType === 'SWAP_WITH_ENEMY') {
        const t = chooseSwapTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', swapTarget: { row: t.row, col: t.col } };
    }
    if (pendingType === 'DESTROY_ONE_STONE') {
        const t = chooseDestroyTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', destroyTarget: { row: t.row, col: t.col } };
    }
    if (pendingType === 'STRONG_WIND_WILL') {
        const t = chooseStrongWindTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', strongWindTarget: { row: t.row, col: t.col } };
    }
    if (pendingType === 'SACRIFICE_WILL') {
        const t = chooseSacrificeTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', sacrificeTarget: { row: t.row, col: t.col } };
    }
    if (pendingType === 'SELL_CARD_WILL') {
        const cardId = chooseSellCardTarget(cardState, playerKey);
        if (!cardId) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', sellCardId: cardId };
    }
    if (pendingType === 'INHERIT_WILL') {
        const t = chooseInheritTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', inheritTarget: { row: t.row, col: t.col } };
    }
    if (pendingType === 'TEMPT_WILL') {
        const t = chooseTemptTarget(gameState, cardState, playerKey, rng);
        if (!t) return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
        return { type: 'place', temptTarget: { row: t.row, col: t.col } };
    }
    return { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } };
}

function clonePrng(rng) {
    if (!rng || typeof rng.getState !== 'function') return rng;
    try {
        return SeededPRNG.fromState(rng.getState());
    } catch (e) {
        return rng;
    }
}

function buildDecisionSnapshot(gameState, cardState, playerKey, rng) {
    const clonedGameState = deepClone(gameState);
    const clonedCardState = deepClone(cardState);
    const previewEvents = [];
    const previewPrng = clonePrng(rng);
    try {
        TurnPipelinePhases.applyTurnStartPhase(
            CardLogic,
            Core,
            clonedCardState,
            clonedGameState,
            playerKey,
            previewEvents,
            previewPrng
        );
    } catch (e) {
        return {
            gameState,
            cardState
        };
    }
    return {
        gameState: clonedGameState,
        cardState: clonedCardState
    };
}

function decideAction(gameState, cardState, playerKey, rng, options, snapshot) {
    const decisionState = snapshot || { gameState, cardState };
    const activeGameState = decisionState.gameState || gameState;
    const activeCardState = decisionState.cardState || cardState;
    const pending = activeCardState.pendingEffectByPlayer[playerKey];
    const legalMoves = getLegalMovesForAction(activeGameState, activeCardState, playerKey);

    if (pending && pending.stage === 'selectTarget') {
        const pendingAction = buildPendingSelectionAction(activeGameState, activeCardState, playerKey, pending.type, rng);
        if (pendingAction) {
            return { action: pendingAction, legalMoves };
        }
        return { action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } }, legalMoves };
    }

    if (options.allowCardUsage && !activeCardState.hasUsedCardThisTurnByPlayer[playerKey]) {
        const cardId = selectCardIdToUse(activeCardState, activeGameState, playerKey, options, {
            gameState: activeGameState,
            cardState: activeCardState,
            playerKey,
            pendingType: pending ? pending.type : null,
            legalMovesCount: legalMoves.length
        });
        const mustUseCardToCreateMove = legalMoves.length === 0;
        const randomUse = rng.random() < options.cardUsageRate;
        if (cardId && (mustUseCardToCreateMove || randomUse)) {
            return { action: { type: 'use_card', useCardId: cardId, useCardOwnerKey: playerKey }, legalMoves };
        }
    }

    if (!legalMoves.length) {
        const strictLegalMoves = Core.getLegalMoves(
            activeGameState,
            toPlayerValue(playerKey),
            getSafeCardContext(activeCardState)
        );
        if (strictLegalMoves.length > 0) {
            const forcedMove = selectPlacementMove(
                strictLegalMoves,
                rng,
                {
                    gameState: activeGameState,
                    cardState: activeCardState,
                    playerKey,
                    pendingType: pending ? pending.type : null,
                    legalMovesCount: strictLegalMoves.length
                },
                options
            );
            return {
                action: { type: 'place', row: forcedMove.row, col: forcedMove.col },
                legalMoves: strictLegalMoves
            };
        }
        return { action: { type: 'pass' }, legalMoves };
    }

    const chosenMove = selectPlacementMove(
        legalMoves,
        rng,
        {
            gameState: activeGameState,
            cardState: activeCardState,
            playerKey,
            pendingType: pending ? pending.type : null,
            legalMovesCount: legalMoves.length
        },
        options
    );
    return {
        action: { type: 'place', row: chosenMove.row, col: chosenMove.col },
        legalMoves
    };
}

function resolveWinner(gameState) {
    const counts = Core.countDiscs(gameState);
    if (counts.black > counts.white) return { winner: 'black', counts };
    if (counts.white > counts.black) return { winner: 'white', counts };
    return { winner: 'draw', counts };
}

function createInitialState(seed) {
    const prng = SeededPRNG.createPRNG(seed);
    const init = CardLogic.initGame(prng);
    return {
        gameState: Core.createGameState(),
        cardState: init.cardState,
        prng,
        stateVersion: 0
    };
}

function normalizeOptions(options) {
    const opts = options || {};
    return {
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        games: Number.isFinite(opts.games) ? Math.max(1, Math.floor(opts.games)) : 10,
        baseSeed: Number.isFinite(opts.baseSeed) ? Math.floor(opts.baseSeed) : 1,
        maxPlies: Number.isFinite(opts.maxPlies) ? Math.max(1, Math.floor(opts.maxPlies)) : 220,
        allowCardUsage: opts.allowCardUsage !== false,
        cardUsageRate: Number.isFinite(opts.cardUsageRate) ? Math.max(0, Math.min(1, opts.cardUsageRate)) : 0.2,
        playerPolicies: opts.playerPolicies || null,
        onRecord: typeof opts.onRecord === 'function' ? opts.onRecord : null,
        onGameEnd: typeof opts.onGameEnd === 'function' ? opts.onGameEnd : null
    };
}

function getPolicyForPlayer(options, playerKey) {
    const base = {
        allowCardUsage: options.allowCardUsage,
        cardUsageRate: options.cardUsageRate,
        enableTacticalLookahead: false
    };
    if (!options.playerPolicies || !options.playerPolicies[playerKey]) return base;
    const override = options.playerPolicies[playerKey];
    return {
        allowCardUsage: override.allowCardUsage !== undefined ? !!override.allowCardUsage : base.allowCardUsage,
        cardUsageRate: Number.isFinite(override.cardUsageRate)
            ? Math.max(0, Math.min(1, override.cardUsageRate))
            : base.cardUsageRate,
        policyTableModel: override.policyTableModel || null,
        enableTacticalLookahead: override.enableTacticalLookahead !== undefined
            ? !!override.enableTacticalLookahead
            : !!override.policyTableModel
    };
}

function createAction(decision, gameIndex, actionCounter, turnIndex) {
    return {
        action: Object.assign({}, decision.action, {
            actionId: `sp-${gameIndex}-${actionCounter}`,
            turnIndex
        }),
        actionType: decision.action.type
    };
}

function applyActionSafe(state, playerKey, action) {
    return TurnPipeline.applyTurnSafe(
        state.cardState,
        state.gameState,
        playerKey,
        action,
        state.prng,
        { currentStateVersion: state.stateVersion }
    );
}

function applyDecisionWithRetry(state, gameIndex, ply, playerKey, options, actionCounterRef) {
    const firstSnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
    const firstDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, options, firstSnapshot);
    actionCounterRef.value += 1;
    const first = createAction(firstDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    let result = applyActionSafe(state, playerKey, first.action);
    if (result.ok) {
        return { decision: firstDecision, action: first.action, result, decisionContext: firstSnapshot };
    }

    // Apply rejected snapshots as the new baseline before retrying.
    state.cardState = result.cardState;
    state.gameState = result.gameState;
    state.stateVersion = result.nextStateVersion;

    const errMsg = String(result.errorMessage || '');
    const illegalPassRejected = first.actionType === 'pass' && errMsg.includes('Illegal pass');
    const canRetry = first.actionType === 'use_card' || result.rejectedReason === 'ILLEGAL_MOVE' || illegalPassRejected;
    if (!canRetry) {
        const msg = result.errorMessage || '';
        throw new Error(`[SELFPLAY] action rejected game=${gameIndex} ply=${ply} action=${first.actionType} reason=${result.rejectedReason || 'UNKNOWN'} ${msg}`);
    }

    const retryOpts = Object.assign({}, options);
    if (first.actionType === 'use_card') retryOpts.allowCardUsage = false;
    const retrySnapshot = buildDecisionSnapshot(state.gameState, state.cardState, playerKey, state.prng);
    const retryDecision = decideAction(state.gameState, state.cardState, playerKey, state.prng, retryOpts, retrySnapshot);
    actionCounterRef.value += 1;
    const retry = createAction(retryDecision, gameIndex, actionCounterRef.value, state.stateVersion);
    result = applyActionSafe(state, playerKey, retry.action);
    if (!result.ok) {
        const msg = result.errorMessage || '';
        throw new Error(`[SELFPLAY] action rejected game=${gameIndex} ply=${ply} action=${retry.actionType} reason=${result.rejectedReason || 'UNKNOWN'} ${msg}`);
    }
    return { decision: retryDecision, action: retry.action, result, decisionContext: retrySnapshot };
}

function runSingleGame(gameIndex, seed, options) {
    const normalizedOptions = normalizeOptions(options);
    const state = createInitialState(seed);
    const gameRecords = [];
    const actionCounterRef = { value: 0 };

    for (let ply = 0; ply < normalizedOptions.maxPlies; ply++) {
        if (Core.isGameOver(state.gameState)) break;

        const playerKey = toPlayerKey(state.gameState.currentPlayer);
        const playerPolicy = getPolicyForPlayer(normalizedOptions, playerKey);

        const execution = applyDecisionWithRetry(state, gameIndex, ply, playerKey, playerPolicy, actionCounterRef);
        const decisionCardState = execution.decisionContext && execution.decisionContext.cardState
            ? execution.decisionContext.cardState
            : state.cardState;
        const decisionGameState = execution.decisionContext && execution.decisionContext.gameState
            ? execution.decisionContext.gameState
            : state.gameState;
        const pendingType = CardLogic.getPendingEffectType(decisionCardState, playerKey);
        const countsBefore = Core.countDiscs(decisionGameState);
        const boardBefore = encodeBoard(decisionGameState.board);
        const turnNumberBefore = decisionGameState.turnNumber || 0;
        const decision = execution.decision;
        const action = execution.action;
        const result = execution.result;

        const record = {
            schemaVersion: normalizedOptions.schemaVersion,
            gameIndex,
            seed,
            ply,
            turnNumber: turnNumberBefore,
            player: playerKey,
            actionType: action.type,
            row: Number.isFinite(action.row) ? action.row : null,
            col: Number.isFinite(action.col) ? action.col : null,
            useCardId: action.useCardId || null,
            legalMoves: decision.legalMoves.length,
            pendingType: pendingType || null,
            handBlack: state.cardState.hands.black.length,
            handWhite: state.cardState.hands.white.length,
            chargeBlack: state.cardState.charge.black || 0,
            chargeWhite: state.cardState.charge.white || 0,
            deckCount: state.cardState.deck.length,
            discardCount: state.cardState.discard.length,
            blackCountBefore: countsBefore.black,
            whiteCountBefore: countsBefore.white,
            board: boardBefore
        };

        state.cardState = result.cardState;
        state.gameState = result.gameState;
        state.stateVersion = result.nextStateVersion;

        const countsAfter = Core.countDiscs(state.gameState);
        record.blackCountAfter = countsAfter.black;
        record.whiteCountAfter = countsAfter.white;

        gameRecords.push(record);
    }

    const maxPlyReached = !Core.isGameOver(state.gameState) && gameRecords.length >= normalizedOptions.maxPlies;
    const resolved = resolveWinner(state.gameState);
    for (const rec of gameRecords) {
        rec.winner = resolved.winner;
        rec.outcome = resolved.winner === 'draw' ? 0 : (rec.player === resolved.winner ? 1 : -1);
    }

    return {
        records: gameRecords,
        summary: {
            schemaVersion: normalizedOptions.schemaVersion,
            gameIndex,
            seed,
            plies: gameRecords.length,
            winner: resolved.winner,
            blackCount: resolved.counts.black,
            whiteCount: resolved.counts.white,
            endedBy: maxPlyReached ? 'max_plies' : 'game_over'
        }
    };
}

function runSelfPlayGames(options) {
    const opts = normalizeOptions(options);
    const allRecords = [];
    const gameSummaries = [];
    const totals = { black: 0, white: 0, draw: 0 };
    let totalPlies = 0;

    for (let i = 0; i < opts.games; i++) {
        const seed = opts.baseSeed + i;
        const one = runSingleGame(i, seed, opts);
        gameSummaries.push(one.summary);
        totals[one.summary.winner] += 1;
        totalPlies += one.summary.plies;

        for (const rec of one.records) {
            if (opts.onRecord) opts.onRecord(rec);
            else allRecords.push(rec);
        }
        if (opts.onGameEnd) opts.onGameEnd(one.summary);
    }

    return {
        records: opts.onRecord ? [] : allRecords,
        gameSummaries,
        summary: {
            schemaVersion: opts.schemaVersion,
            totalGames: opts.games,
            totalPlies,
            avgPlies: opts.games > 0 ? totalPlies / opts.games : 0,
            wins: totals
        }
    };
}

module.exports = {
    SELFPLAY_SCHEMA_VERSION,
    runSelfPlayGames,
    runSingleGame,
    decideAction,
    selectPlacementMove,
    getPolicyActionScoreByKey,
    encodeBoard,
    getPolicyForPlayer
};
