// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

/**
 * @file policy-onnx-runtime-v2.js
 * @description ONNX runtime helper for CNN+ResNet v2 models with hand encoder and WDL head.
 *
 * Inputs:
 *   board: (1, 5, 10, 10) float32
 *   aux:   (1, 16) float32
 *   hand:  (1, 5, 11) float32  [card_id_idx, cost_norm, type_onehot(9)]
 *
 * Outputs:
 *   place_logits: (1, 100) float32
 *   wdl_logits:   (1, 3)  float32  [Win, Draw, Loss]
 *   card_logits:  (1, card_action_dim) float32 (optional)
 */



const ort = require('onnxruntime-node');

let _session = null;
let _meta = null;
let _lastError = null;

const CARD_DISPLAY_TYPES = [
    '執行', '守護', '戦闘', '採掘', '殲滅', '特殊', '禁忌', '繁栄', '観測'
];
const NUM_DISPLAY_TYPES = CARD_DISPLAY_TYPES.length;
const HAND_SIZE = 5;
const HAND_FEATURE_DIM = 1 + 1 + NUM_DISPLAY_TYPES; // card_id_idx + cost + onehot(9)

// Card catalog cache (loaded lazily)
let _cardCatalog = null;
let _cardIdToIdx = {};
let _cardIdList = [];

function _loadCardCatalog() {
    if (_cardCatalog) return _cardCatalog;
    try {
        const fs = require('fs');
        const path = require('path');
        const catalogPath = path.join(__dirname, '..', '..', 'cards', 'catalog.json');
        const data = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        _cardCatalog = {};
        const cards = data.cards || [];
        for (const card of cards) {
            if (card && card.id) {
                _cardCatalog[card.id] = card;
            }
        }
        _cardIdList = Object.keys(_cardCatalog).sort();
        _cardIdToIdx = {};
        for (let i = 0; i < _cardIdList.length; i++) {
            _cardIdToIdx[_cardIdList[i]] = i;
        }
    } catch (e) {
        console.error('[policy-onnx-runtime-v2] Failed to load card catalog:', e);
        _cardCatalog = {};
    }
    return _cardCatalog;
}

function _cardIdToIndex(cardId) {
    if (!cardId) return _cardIdList.length;
    return _cardIdToIdx[cardId] !== undefined ? _cardIdToIdx[cardId] : _cardIdList.length;
}

function _displayTypeToOnehot(displayType) {
    const vec = new Array(NUM_DISPLAY_TYPES).fill(0.0);
    if (!displayType) return vec;
    const idx = CARD_DISPLAY_TYPES.indexOf(displayType.trim());
    if (idx >= 0) vec[idx] = 1.0;
    return vec;
}

function _encodeCardFeatures(cardId) {
    if (!cardId) return [0.0, ...new Array(NUM_DISPLAY_TYPES).fill(0.0)];
    const catalog = _loadCardCatalog();
    const card = catalog[cardId];
    if (!card) return [0.0, ...new Array(NUM_DISPLAY_TYPES).fill(0.0)];
    const costNorm = (card.cost || 0) / 99.0;
    const onehot = _displayTypeToOnehot(card.display_type_ja);
    return [costNorm, ...onehot];
}

function buildHandTensor(handCardIds) {
    /** Build (1, 5, 11) hand tensor from card ID list. */
    const hand = [];
    for (let i = 0; i < HAND_SIZE; i++) {
        const cardId = (handCardIds && handCardIds[i]) || null;
        const cardIdIdx = _cardIdToIndex(cardId);
        const features = _encodeCardFeatures(cardId);
        hand.push([cardIdIdx, ...features]);
    }
    return new ort.Tensor('float32', new Float32Array(hand.flat()), [1, HAND_SIZE, HAND_FEATURE_DIM]);
}

function buildBoardTensor(board, playerKey) {
    /** Build (1, 5, 10, 10) board tensor.
     *
     * Channels:
     *   0: own stones
     *   1: opponent stones
     *   2: corner mask
     *   3: edge mask
     *   4: empty mask
     */
    const size = 10;
    const tensor = new Array(5).fill(null).map(() => new Array(size).fill(null).map(() => new Array(size).fill(0.0)));

    const ownChar = playerKey === 'black' ? 'B' : 'W';
    const oppChar = playerKey === 'black' ? 'W' : 'B';

    if (Array.isArray(board)) {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const ch = board[r] && board[r][c] ? board[r][c] : '';
                if (ch === ownChar) {
                    tensor[0][r][c] = 1.0;
                } else if (ch === oppChar) {
                    tensor[1][r][c] = 1.0;
                } else {
                    tensor[4][r][c] = 1.0;
                }
            }
        }
    }

    // Channel 2: corner mask
    const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
    for (const [r, c] of corners) {
        tensor[2][r][c] = 1.0;
    }

    // Channel 3: edge mask (non-corner)
    for (let i = 1; i < size - 1; i++) {
        tensor[3][0][i] = 1.0;
        tensor[3][size - 1][i] = 1.0;
        tensor[3][i][0] = 1.0;
        tensor[3][i][size - 1] = 1.0;
    }

    return new ort.Tensor('float32', new Float32Array(tensor.flat(2)), [1, 5, size, size]);
}

function buildAuxVector(context) {
    /** Build (1, 16) auxiliary vector. */
    const ctx = context || {};
    const legalMoves = Number(ctx.legalMovesCount || 0) / 60.0;
    const discDiff = Number(ctx.discDiff || 0) / 64.0;
    const ownCharge = Number(ctx.ownCharge || 0) / 99.0;
    const oppCharge = Number(ctx.oppCharge || 0) / 99.0;
    const deckCount = Number(ctx.deckCount || 0) / 60.0;
    const pendingFlag = ctx.pendingType ? 1.0 : 0.0;
    const ownCorners = Number(ctx.ownCornersBefore || 0) / 4.0;
    const oppCorners = Number(ctx.oppCornersBefore || 0) / 4.0;
    const ownEdges = Number(ctx.ownEdgesBefore || 0) / 24.0;
    const oppEdges = Number(ctx.oppEdgesBefore || 0) / 24.0;
    const hasCornerMove = Number(ctx.hasCornerMoveNow || 0) > 0.5 ? 1.0 : 0.0;
    const hasEdgeMove = Number(ctx.hasEdgeMoveNow || 0) > 0.5 ? 1.0 : 0.0;
    const cornerEmergency = Number(ctx.cornerEmergency || 0) > 0.5 ? 1.0 : 0.0;
    const cornerHoldMode = Number(ctx.cornerHoldMode || 0) > 0.5 ? 1.0 : 0.0;
    const highBonusMove = Number(ctx.highBonusMoveAvailable || 0) > 0.5 ? 1.0 : 0.0;
    const maxLegalBonus = Math.max(0, Math.min(1, Number(ctx.maxLegalMoveBonus || 0) / 5.0));

    const vec = [
        legalMoves, discDiff, ownCharge, oppCharge, deckCount, pendingFlag,
        ownCorners, oppCorners, ownEdges, oppEdges,
        hasCornerMove, hasEdgeMove, cornerEmergency, cornerHoldMode,
        highBonusMove, maxLegalBonus
    ];
    return new ort.Tensor('float32', new Float32Array(vec), [1, 16]);
}

async function loadModel(modelPath, metaPath) {
    /** Load ONNX model and metadata. */
    _session = await ort.InferenceSession.create(modelPath);
    if (metaPath) {
        try {
            const fs = require('fs');
            _meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch (e) {
            _meta = null;
        }
    }
    return { session: _session, meta: _meta };
}

async function evaluate(context) {
    /** Run inference and return {policy, wdl, card, value}.
     *
     * policy: Map<moveIndex, probability>
     * wdl: {win, draw, loss} probabilities
     * card: Map<cardIndex, probability> (optional)
     * value: scalar expected value (-1 to 1)
     */
    if (!_session) {
        throw new Error('Model not loaded');
    }

    const ctx = context || {};
    const boardTensor = buildBoardTensor(ctx.board, ctx.playerKey || 'black');
    const auxTensor = buildAuxVector(ctx);
    const handTensor = buildHandTensor(ctx.handCardIds);

    const feeds = {
        board: boardTensor,
        aux: auxTensor,
        hand: handTensor
    };

    const results = await _session.run(feeds);

    // Parse outputs
    const placeOut = results.place_logits;
    const wdlOut = results.wdl_logits;
    const cardOut = results.card_logits;

    const policy = new Map();
    if (placeOut && placeOut.data) {
        const data = placeOut.data;
        // Apply softmax
        let sum = 0;
        const expScores = [];
        for (let i = 0; i < data.length; i++) {
            const expScore = Math.exp(data[i]);
            expScores.push(expScore);
            sum += expScore;
        }
        for (let i = 0; i < data.length; i++) {
            policy.set(i, sum > 0 ? expScores[i] / sum : 0);
        }
    }

    let wdl = { win: 0.33, draw: 0.33, loss: 0.33 };
    let value = 0.0;
    if (wdlOut && wdlOut.data) {
        const data = wdlOut.data;
        // Softmax
        let sum = 0;
        const expScores = [];
        for (let i = 0; i < data.length; i++) {
            const expScore = Math.exp(data[i]);
            expScores.push(expScore);
            sum += expScore;
        }
        const probs = expScores.map(s => sum > 0 ? s / sum : 0);
        wdl = { win: probs[0], draw: probs[1], loss: probs[2] };
        value = wdl.win * 1.0 + wdl.draw * 0.0 + wdl.loss * (-1.0);
    }

    let card = null;
    if (cardOut && cardOut.data) {
        card = new Map();
        const data = cardOut.data;
        let sum = 0;
        const expScores = [];
        for (let i = 0; i < data.length; i++) {
            const expScore = Math.exp(data[i]);
            expScores.push(expScore);
            sum += expScore;
        }
        for (let i = 0; i < data.length; i++) {
            card.set(i, sum > 0 ? expScores[i] / sum : 0);
        }
    }

    return { policy, wdl, card, value };
}

async function chooseMove(candidateMoves, context) {
    /** Choose best move from candidate moves. */
    if (!candidateMoves || candidateMoves.length === 0) return null;

    try {
        const result = await evaluate(context);
        const policy = result.policy;

        let bestMove = null;
        let bestScore = -Infinity;
        for (const move of candidateMoves) {
            const idx = move.row * 10 + move.col;
            const score = policy.get(idx) || -Infinity;
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove;
    } catch (err) {
        _lastError = err;
        return null;
    }
}

async function chooseCard(usableCardIds, context) {
    /** Choose best card from usable cards. */
    if (!usableCardIds || usableCardIds.length === 0) return null;

    try {
        const result = await evaluate(context);
        const cardProbs = result.card;
        if (!cardProbs) return null;

        let bestCard = null;
        let bestScore = -Infinity;
        for (const cardId of usableCardIds) {
            const idx = _cardIdToIndex(cardId);
            const score = cardProbs.get(idx) || -Infinity;
            if (score > bestScore) {
                bestScore = score;
                bestCard = cardId;
            }
        }
        return bestCard;
    } catch (err) {
        _lastError = err;
        return null;
    }
}

function getLastError() {
    return _lastError;
}

export = {
    loadModel,
    evaluate,
    chooseMove,
    chooseCard,
    getLastError,
    buildBoardTensor,
    buildAuxVector,
    buildHandTensor
};
