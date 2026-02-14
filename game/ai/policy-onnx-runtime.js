/**
 * @file policy-onnx-runtime.js
 * @description Async ONNX runtime helper for browser CPU move/card selection.
 */

(() => {
'use strict';

const POLICY_ONNX_MODEL_SCHEMA_VERSION = 'policy_onnx.v1';
const DEFAULT_MODEL_URL = 'data/models/policy-net.onnx';
const DEFAULT_META_URL = 'data/models/policy-net.onnx.meta.json';
const BASE_INPUT_DIM = 70;
const MAX_HAND_SIZE = 5;
const NO_CARD_ACTION_ID = '__no_card__';

let _session = null;
let _meta = null;
let _inputName = 'obs';
let _placeOutputName = 'logits';
let _cardOutputName = null;
let _cardActionIds = [];
let _cardActionIndexById = Object.create(null);
let _noCardActionIndex = -1;
let _lastError = null;
let _sourceUrl = DEFAULT_MODEL_URL;
let _metaUrl = DEFAULT_META_URL;
let _config = {
    enabled: true,
    minLevel: 6
};

function configure(config) {
    if (!config || typeof config !== 'object') return getStatus();
    if (typeof config.enabled === 'boolean') _config.enabled = config.enabled;
    if (Number.isFinite(config.minLevel)) _config.minLevel = Math.max(1, Math.floor(config.minLevel));
    if (typeof config.sourceUrl === 'string' && config.sourceUrl.trim()) _sourceUrl = config.sourceUrl.trim();
    if (typeof config.metaUrl === 'string' && config.metaUrl.trim()) _metaUrl = config.metaUrl.trim();
    return getStatus();
}

function clearModel() {
    _session = null;
    _meta = null;
    _inputName = 'obs';
    _placeOutputName = 'logits';
    _cardOutputName = null;
    _cardActionIds = [];
    _cardActionIndexById = Object.create(null);
    _noCardActionIndex = -1;
    _lastError = null;
}

function hasModel() {
    return !!_session;
}

function hasCardHead() {
    return !!(_cardOutputName && _cardActionIds.length > 0);
}

function getStatus() {
    return {
        enabled: _config.enabled === true,
        minLevel: _config.minLevel,
        loaded: hasModel(),
        hasCardHead: hasCardHead(),
        noCardSupported: _noCardActionIndex >= 0,
        cardActionCount: _cardActionIds.length,
        schemaVersion: _meta && _meta.schemaVersion ? _meta.schemaVersion : null,
        sourceUrl: _sourceUrl,
        metaUrl: _metaUrl,
        lastError: _lastError ? _lastError.message : null
    };
}

function resolveOrtApi(requireSession) {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.ort &&
            typeof globalThis.ort.Tensor === 'function' &&
            (
                requireSession !== true ||
                typeof globalThis.ort.InferenceSession === 'function'
            )
        ) return globalThis.ort;
    } catch (e) { /* ignore */ }
    return null;
}

async function loadMetaJson(url, fetchImpl) {
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) return null;
    try {
        const response = await f(url, { cache: 'no-store' });
        if (!response || !response.ok) return null;
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function applyCardActionIds(ids) {
    _cardActionIds = Array.isArray(ids) ? ids.filter((one) => typeof one === 'string' && one.trim()) : [];
    _cardActionIndexById = Object.create(null);
    for (let i = 0; i < _cardActionIds.length; i++) {
        _cardActionIndexById[_cardActionIds[i]] = i;
    }
    _noCardActionIndex = Number.isFinite(_cardActionIndexById[NO_CARD_ACTION_ID])
        ? _cardActionIndexById[NO_CARD_ACTION_ID]
        : -1;
}

function resolveTensorByName(outputs, preferredName, fallbackIndex) {
    if (!outputs || typeof outputs !== 'object') return null;
    if (preferredName && outputs[preferredName] && outputs[preferredName].data) return outputs[preferredName];
    const keys = Object.keys(outputs);
    if (keys.length <= 0) return null;
    const idx = Number.isFinite(fallbackIndex) ? Math.max(0, Math.floor(fallbackIndex)) : 0;
    const key = keys[idx] || keys[0];
    return outputs[key] || null;
}

async function loadFromUrl(modelUrl, metaUrl, fetchImpl) {
    const ortApi = resolveOrtApi(true);
    if (!ortApi) {
        _lastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _sourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _metaUrl;

    try {
        let session = null;
        try {
            session = await ortApi.InferenceSession.create(targetModel, { executionProviders: ['webgpu', 'wasm'] });
        } catch (primaryErr) {
            session = await ortApi.InferenceSession.create(targetModel, { executionProviders: ['wasm'] });
        }
        const meta = await loadMetaJson(targetMeta, fetchImpl);
        _session = session;
        _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM };
        _inputName = (_meta && _meta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _placeOutputName =
            (_meta && (_meta.placeOutputName || _meta.outputName)) ||
            (session.outputNames && session.outputNames[0]) ||
            'logits';
        _cardOutputName =
            (_meta && _meta.cardOutputName) ||
            (session.outputNames && session.outputNames.length > 1 ? session.outputNames[1] : null);
        applyCardActionIds(_meta && _meta.cardActionIds);
        _sourceUrl = targetModel;
        _metaUrl = targetMeta;
        _lastError = null;
        return true;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return false;
    }
}

function perspectiveCell(v, playerKey) {
    if (!Number.isFinite(v)) return 0;
    const sign = playerKey === 'black' ? 1 : -1;
    if (v === sign) return 1;
    if (v === -sign) return -1;
    return 0;
}

function buildCardCounts(cardIds) {
    const counts = Object.create(null);
    if (!Array.isArray(cardIds)) return counts;
    for (const one of cardIds) {
        if (typeof one !== 'string') continue;
        const cardId = one.trim();
        if (!cardId) continue;
        counts[cardId] = (counts[cardId] || 0) + 1;
    }
    return counts;
}

function buildInputVector(context) {
    const ctx = context || {};
    const board = Array.isArray(ctx.board) ? ctx.board : [];
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const inputDim = (_meta && Number.isFinite(_meta.inputDim) && _meta.inputDim > 64) ? Math.floor(_meta.inputDim) : BASE_INPUT_DIM;
    const out = new Float32Array(inputDim);

    if (board.length > 0) {
        let idx = 0;
        for (let r = 0; r < Math.min(8, board.length); r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < 8; c++) {
                out[idx++] = perspectiveCell(row[c], playerKey);
            }
        }
    }

    const legalMoves = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    let blackCount = Number.isFinite(ctx.blackCountBefore) ? ctx.blackCountBefore : 0;
    let whiteCount = Number.isFinite(ctx.whiteCountBefore) ? ctx.whiteCountBefore : 0;
    if ((!Number.isFinite(ctx.blackCountBefore) || !Number.isFinite(ctx.whiteCountBefore)) && Array.isArray(board)) {
        blackCount = 0;
        whiteCount = 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                if (row[c] === 1) blackCount++;
                else if (row[c] === -1) whiteCount++;
            }
        }
    }
    const ownCharge = Number.isFinite(ctx.ownCharge) ? ctx.ownCharge : 0;
    const oppCharge = Number.isFinite(ctx.oppCharge) ? ctx.oppCharge : 0;
    const deckCount = Number.isFinite(ctx.deckCount) ? ctx.deckCount : 0;
    const pendingFlag = ctx.pendingType ? 1 : 0;
    const discDiff = playerKey === 'black' ? (blackCount - whiteCount) : (whiteCount - blackCount);

    if (inputDim > 64) out[64] = legalMoves / 60;
    if (inputDim > 65) out[65] = discDiff / 64;
    if (inputDim > 66) out[66] = ownCharge / 50;
    if (inputDim > 67) out[67] = oppCharge / 50;
    if (inputDim > 68) out[68] = deckCount / 60;
    if (inputDim > 69) out[69] = pendingFlag;

    const cardDim = _cardActionIds.length;
    if (cardDim > 0 && inputDim >= (BASE_INPUT_DIM + (cardDim * 2))) {
        const handCounts = buildCardCounts(ctx.handCardIds);
        const usableFlags = buildCardCounts(ctx.usableCardIds);
        const handOffset = BASE_INPUT_DIM;
        const usableOffset = BASE_INPUT_DIM + cardDim;
        for (const cardId of _cardActionIds) {
            const idx = _cardActionIndexById[cardId];
            const handCount = Number(handCounts[cardId] || 0);
            const usableCount = Number(usableFlags[cardId] || 0);
            out[handOffset + idx] = Math.min(MAX_HAND_SIZE, handCount) / MAX_HAND_SIZE;
            out[usableOffset + idx] = usableCount > 0 ? 1 : 0;
        }
    }

    return out;
}

function indexFromMove(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return -1;
    if (move.row < 0 || move.row >= 8 || move.col < 0 || move.col >= 8) return -1;
    return (move.row * 8) + move.col;
}

async function runInference(context) {
    const ortApi = resolveOrtApi(false);
    if (!ortApi) return null;
    const x = buildInputVector(context || {});
    const feeds = {};
    feeds[_inputName] = new ortApi.Tensor('float32', x, [1, x.length]);
    return _session.run(feeds);
}

async function chooseMove(candidateMoves, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;

    try {
        const outputs = await runInference(context || {});
        const out = resolveTensorByName(outputs, _placeOutputName, 0);
        if (!out || !out.data) return null;
        const scores = out.data;

        let best = null;
        let bestScore = -Infinity;
        for (const move of candidateMoves) {
            const idx = indexFromMove(move);
            if (idx < 0 || idx >= scores.length) continue;
            const score = Number(scores[idx]);
            if (!Number.isFinite(score)) continue;
            if (score > bestScore) {
                bestScore = score;
                best = move;
                continue;
            }
            if (score === bestScore && best) {
                if (move.row < best.row || (move.row === best.row && move.col < best.col)) {
                    best = move;
                }
            }
        }
        return best;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return null;
    }
}

async function chooseCard(usableCardIds, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    if (!hasCardHead()) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;

    try {
        const outputs = await runInference(context || {});
        const out = resolveTensorByName(outputs, _cardOutputName, 1);
        if (!out || !out.data) return null;
        const scores = out.data;

        let bestCardId = null;
        let bestScore = -Infinity;
        for (const cardId of usableCardIds) {
            if (typeof cardId !== 'string') continue;
            const idx = _cardActionIndexById[cardId];
            if (!Number.isFinite(idx) || idx < 0 || idx >= scores.length) continue;
            const score = Number(scores[idx]);
            if (!Number.isFinite(score)) continue;
            if (score > bestScore) {
                bestScore = score;
                bestCardId = cardId;
                continue;
            }
            if (score === bestScore && bestCardId && cardId < bestCardId) {
                bestCardId = cardId;
            }
        }
        const noCardScore = (
            _noCardActionIndex >= 0 &&
            _noCardActionIndex < scores.length &&
            Number.isFinite(Number(scores[_noCardActionIndex]))
        ) ? Number(scores[_noCardActionIndex]) : null;

        if (noCardScore !== null) {
            if (!Number.isFinite(bestScore) || noCardScore >= bestScore) {
                return null;
            }
        }
        return bestCardId;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return null;
    }
}

function __setLoadedForTest(session, meta) {
    _session = session || null;
    _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM };
    _inputName = (_meta && _meta.inputName) || 'obs';
    _placeOutputName = (_meta && (_meta.placeOutputName || _meta.outputName)) || 'logits';
    _cardOutputName = (_meta && _meta.cardOutputName) || null;
    applyCardActionIds(_meta && _meta.cardActionIds);
    _lastError = null;
}

const Api = {
    MODEL_SCHEMA_VERSION: POLICY_ONNX_MODEL_SCHEMA_VERSION,
    DEFAULT_MODEL_URL,
    DEFAULT_META_URL,
    configure,
    getStatus,
    clearModel,
    hasModel,
    loadFromUrl,
    chooseMove,
    chooseCard,
    __setLoadedForTest
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}

try {
    if (typeof globalThis !== 'undefined') {
        globalThis.CpuPolicyOnnxRuntime = Api;
    }
} catch (e) { /* ignore */ }

})();
