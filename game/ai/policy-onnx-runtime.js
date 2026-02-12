/**
 * @file policy-onnx-runtime.js
 * @description Async ONNX runtime helper for browser CPU move selection.
 */

(() => {
'use strict';

const POLICY_ONNX_MODEL_SCHEMA_VERSION = 'policy_onnx.v1';
const DEFAULT_MODEL_URL = 'data/models/policy-net.onnx';
const DEFAULT_META_URL = 'data/models/policy-net.onnx.meta.json';

let _session = null;
let _meta = null;
let _inputName = 'obs';
let _outputName = 'logits';
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
    _outputName = 'logits';
    _lastError = null;
}

function hasModel() {
    return !!_session;
}

function getStatus() {
    return {
        enabled: _config.enabled === true,
        minLevel: _config.minLevel,
        loaded: hasModel(),
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
        _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: 70 };
        _inputName = (_meta && _meta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _outputName = (_meta && _meta.outputName) || (session.outputNames && session.outputNames[0]) || 'logits';
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

function buildInputVector(context) {
    const ctx = context || {};
    const board = Array.isArray(ctx.board) ? ctx.board : [];
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const inputDim = (_meta && Number.isFinite(_meta.inputDim) && _meta.inputDim > 64) ? Math.floor(_meta.inputDim) : 70;
    const out = new Float32Array(inputDim);

    const n = board.length;
    if (n > 0) {
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
    return out;
}

function indexFromMove(move) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return -1;
    if (move.row < 0 || move.row >= 8 || move.col < 0 || move.col >= 8) return -1;
    return (move.row * 8) + move.col;
}

async function chooseMove(candidateMoves, context) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;

    const ortApi = resolveOrtApi(false);
    if (!ortApi) return null;

    try {
        const x = buildInputVector(context || {});
        const feeds = {};
        feeds[_inputName] = new ortApi.Tensor('float32', x, [1, x.length]);
        const outputs = await _session.run(feeds);
        const out = outputs[_outputName] || outputs[Object.keys(outputs)[0]];
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

function __setLoadedForTest(session, meta) {
    _session = session || null;
    _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: 70 };
    _inputName = (_meta && _meta.inputName) || 'obs';
    _outputName = (_meta && _meta.outputName) || 'logits';
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
