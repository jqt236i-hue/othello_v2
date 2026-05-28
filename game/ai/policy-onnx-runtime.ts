import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


const POLICY_ONNX_MODEL_SCHEMA_VERSION = 'policy_onnx.v1';
const DEFAULT_MODEL_URL = 'data/models/policy-net.onnx';
const DEFAULT_META_URL = 'data/models/policy-net.onnx.meta.json';
const DEFAULT_CARD_MODEL_URL = 'data/models/policy-card.onnx';
const DEFAULT_CARD_META_URL = 'data/models/policy-card.onnx.meta.json';
const DEFAULT_TARGET_MODEL_URL = 'data/models/policy-target.onnx';
const DEFAULT_TARGET_META_URL = 'data/models/policy-target.onnx.meta.json';
const DEFAULT_VALUE_MODEL_URL = 'data/models/policy-value.onnx';
const DEFAULT_VALUE_META_URL = 'data/models/policy-value.onnx.meta.json';
const BASE_INPUT_DIM = 80;
const AUX_FEATURE_DIM = 16;
const LEGACY_BOARD_SIZE = 8;
const LEGACY_BOARD_FEATURE_DIM = LEGACY_BOARD_SIZE * LEGACY_BOARD_SIZE;
const MAX_HAND_SIZE = 5;
let SharedBoardUtils: any = null;
try {
    SharedBoardUtils = _require('../../shared/shared-board-utils');
} catch (e: any) { /* ignore */ }
let OnnxAssetLoader: any = null;
try {
    OnnxAssetLoader = _require('./onnx-asset-loader');
} catch (e: any) { /* ignore */ }
const PADDED_BOARD_MIN = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_MIN))
    ? Number(SharedBoardUtils.PADDED_BOARD_MIN)
    : -1;
const PADDED_BOARD_MAX = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_MAX))
    ? Number(SharedBoardUtils.PADDED_BOARD_MAX)
    : 8;
const PADDED_BOARD_SIZE = SharedBoardUtils && Number.isFinite(Number(SharedBoardUtils.PADDED_BOARD_SIZE))
    ? Number(SharedBoardUtils.PADDED_BOARD_SIZE)
    : ((PADDED_BOARD_MAX - PADDED_BOARD_MIN) + 1);
const PADDED_BOARD_FEATURE_DIM = PADDED_BOARD_SIZE * PADDED_BOARD_SIZE;

function resolveChargeMaxNormalizer(): number {
    try {
        const shared = _require('../../shared-constants');
        if (shared && Number.isFinite(Number(shared.CHARGE_MAX))) return Number(shared.CHARGE_MAX);
    } catch (e) { /* ignore */ }
    return 99;
}

const CHARGE_MAX_NORMALIZER = resolveChargeMaxNormalizer();
const NO_CARD_ACTION_ID = '__no_card__';
const LEGACY_DECK_COUNT_NORMALIZER = 60;
const DECK_COUNT_FEATURE_MODE = 'own_deck_ratio_v1';

let _session: any = null;
let _meta: any = null;
let _inputName = 'obs';
let _placeOutputName = 'logits';
let _cardOutputName: any = null;
let _cardActionIds: any = [];
let _cardActionIndexById = Object.create(null);
let _noCardActionIndex = -1;
let _cardSession: any = null;
let _cardMeta: any = null;
let _cardInputName = 'obs';
let _cardHeadOutputName = 'card_logits';
let _cardModelActionIds: any = [];
let _cardModelActionIndexById = Object.create(null);
let _cardModelNoCardActionIndex = -1;
let _targetSession: any = null;
let _targetMeta: any = null;
let _targetInputName = 'obs';
let _targetOutputName = 'target_logits';
let _valueSession: any = null;
let _valueMeta: any = null;
let _valueInputName = 'obs';
let _valueOutputName = 'value';
let _lastError: any = null;
let _cardLastError: any = null;
let _targetLastError: any = null;
let _valueLastError: any = null;
let _sourceUrl = DEFAULT_MODEL_URL;
let _metaUrl = DEFAULT_META_URL;
let _cardSourceUrl = DEFAULT_CARD_MODEL_URL;
let _cardMetaUrl = DEFAULT_CARD_META_URL;
let _targetSourceUrl = DEFAULT_TARGET_MODEL_URL;
let _targetMetaUrl = DEFAULT_TARGET_META_URL;
let _valueSourceUrl = DEFAULT_VALUE_MODEL_URL;
let _valueMetaUrl = DEFAULT_VALUE_META_URL;
let _config = {
    enabled: true,
    minLevel: 6,
    useCardSpecialist: true,
    enableWebGpuExecution: false,
    readQuerySearch: null as any,
    readWebGpuEnabled: null as any,
    ortApi: null as any
};
const LATENCY_SAMPLE_LIMIT = 512;
const LATENCY_OPERATION_KEYS = Object.freeze([
    'chooseMove',
    'chooseCard',
    'choosePendingTarget',
    'evaluatePosition'
]);
let _latencyStats = createLatencyStats();

function createLatencyBucket() {
    return {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
        samples: []
    };
}

function createLatencyStats() {
    const perOperation = Object.create(null);
    for (const key of LATENCY_OPERATION_KEYS) {
        perOperation[key] = createLatencyBucket();
    }
    return {
        overall: createLatencyBucket(),
        perOperation
    };
}

function resetLatencyStats() {
    _latencyStats = createLatencyStats();
}

function nowMs() {
    try {
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
            return Number(performance.now());
        }
    } catch (e) { /* ignore */ }
    return Date.now();
}

function normalizeDurationMs(value: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
}

function pushLatencySample(bucket: any, durationMs: any) {
    if (!bucket || !Array.isArray(bucket.samples)) return;
    bucket.samples.push(durationMs);
    if (bucket.samples.length > LATENCY_SAMPLE_LIMIT) {
        bucket.samples.shift();
    }
}

function recordLatency(operationKey: any, startedAt: any) {
    if (!operationKey) return;
    const bucket = _latencyStats && _latencyStats.perOperation
        ? _latencyStats.perOperation[operationKey]
        : null;
    const durationMs = normalizeDurationMs(nowMs() - startedAt);
    const targets = [bucket, _latencyStats ? _latencyStats.overall : null];
    for (const one of targets) {
        if (!one) continue;
        one.count += 1;
        one.totalMs += durationMs;
        one.lastMs = durationMs;
        if (durationMs > one.maxMs) one.maxMs = durationMs;
        pushLatencySample(one, durationMs);
    }
}

function summarizeLatencyBucket(bucket: any) {
    if (!bucket) {
        return { count: 0, totalMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0, lastMs: 0 };
    }
    const count = Number(bucket.count) || 0;
    const totalMs = Number(bucket.totalMs) || 0;
    const maxMs = Number(bucket.maxMs) || 0;
    const lastMs = Number(bucket.lastMs) || 0;
    let p95Ms = 0;
    if (Array.isArray(bucket.samples) && bucket.samples.length > 0) {
        const sorted = bucket.samples.slice().sort((a: any, b: any) => a - b);
        const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
        p95Ms = Number(sorted[index]) || 0;
    }
    return {
        count,
        totalMs,
        averageMs: count > 0 ? (totalMs / count) : 0,
        p95Ms,
        maxMs,
        lastMs
    };
}

function getLatencyStatus() {
    const perOperation = Object.create(null);
    for (const key of LATENCY_OPERATION_KEYS) {
        perOperation[key] = summarizeLatencyBucket(_latencyStats.perOperation[key]);
    }
    return {
        overall: summarizeLatencyBucket(_latencyStats.overall),
        perOperation
    };
}

function configure(config: any) {
    if (!config || typeof config !== 'object') return getStatus();
    if (typeof config.enabled === 'boolean') _config.enabled = config.enabled;
    if (Number.isFinite(config.minLevel)) _config.minLevel = Math.max(1, Math.floor(config.minLevel));
    if (typeof config.sourceUrl === 'string' && config.sourceUrl.trim()) _sourceUrl = config.sourceUrl.trim();
    if (typeof config.metaUrl === 'string' && config.metaUrl.trim()) _metaUrl = config.metaUrl.trim();
    if (typeof config.cardSourceUrl === 'string' && config.cardSourceUrl.trim()) _cardSourceUrl = config.cardSourceUrl.trim();
    if (typeof config.cardMetaUrl === 'string' && config.cardMetaUrl.trim()) _cardMetaUrl = config.cardMetaUrl.trim();
    if (typeof config.targetSourceUrl === 'string' && config.targetSourceUrl.trim()) _targetSourceUrl = config.targetSourceUrl.trim();
    if (typeof config.targetMetaUrl === 'string' && config.targetMetaUrl.trim()) _targetMetaUrl = config.targetMetaUrl.trim();
    if (typeof config.valueSourceUrl === 'string' && config.valueSourceUrl.trim()) _valueSourceUrl = config.valueSourceUrl.trim();
    if (typeof config.valueMetaUrl === 'string' && config.valueMetaUrl.trim()) _valueMetaUrl = config.valueMetaUrl.trim();
    if (typeof config.useCardSpecialist === 'boolean') _config.useCardSpecialist = config.useCardSpecialist;
    if (typeof config.enableWebGpuExecution === 'boolean') _config.enableWebGpuExecution = config.enableWebGpuExecution;
    if (typeof config.readQuerySearch === 'function') _config.readQuerySearch = config.readQuerySearch;
    if (config.readQuerySearch === null) _config.readQuerySearch = null;
    if (typeof config.readWebGpuEnabled === 'function') _config.readWebGpuEnabled = config.readWebGpuEnabled;
    if (config.readWebGpuEnabled === null) _config.readWebGpuEnabled = null;
    if (Object.prototype.hasOwnProperty.call(config, 'ortApi')) {
        _config.ortApi = config.ortApi || null;
        applyOrtEnvLogLevel(_config.ortApi);
    }
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
    _cardSession = null;
    _cardMeta = null;
    _cardInputName = 'obs';
    _cardHeadOutputName = 'card_logits';
    _cardModelActionIds = [];
    _cardModelActionIndexById = Object.create(null);
    _cardModelNoCardActionIndex = -1;
    _targetSession = null;
    _targetMeta = null;
    _targetInputName = 'obs';
    _targetOutputName = 'target_logits';
    _valueSession = null;
    _valueMeta = null;
    _valueInputName = 'obs';
    _valueOutputName = 'value';
    _lastError = null;
    _cardLastError = null;
    _targetLastError = null;
    _valueLastError = null;
    resetLatencyStats();
}

function hasModel() {
    return !!_session;
}

function hasPrimaryCardHead() {
    return !!(_cardOutputName && _cardActionIds.length > 0);
}

function hasCardSpecialistModel() {
    return !!(_cardSession && _cardHeadOutputName && _cardModelActionIds.length > 0);
}

function hasCardHead() {
    return hasPrimaryCardHead() || hasCardSpecialistModel();
}

function hasTargetModel() {
    return !!_targetSession;
}

function hasValueModel() {
    return !!_valueSession;
}

function getStatus() {
    return {
        enabled: _config.enabled === true,
        minLevel: _config.minLevel,
        loaded: hasModel(),
        cardModelLoaded: hasCardSpecialistModel(),
        targetModelLoaded: hasTargetModel(),
        valueModelLoaded: hasValueModel(),
        useCardSpecialist: _config.useCardSpecialist === true,
        hasCardHead: hasCardHead(),
        hasPrimaryCardHead: hasPrimaryCardHead(),
        noCardSupported: (_noCardActionIndex >= 0) || (_cardModelNoCardActionIndex >= 0),
        cardActionCount: _cardActionIds.length,
        cardModelActionCount: _cardModelActionIds.length,
        schemaVersion: _meta && _meta.schemaVersion ? _meta.schemaVersion : null,
        cardSchemaVersion: _cardMeta && _cardMeta.schemaVersion ? _cardMeta.schemaVersion : null,
        targetSchemaVersion: _targetMeta && _targetMeta.schemaVersion ? _targetMeta.schemaVersion : null,
        valueSchemaVersion: _valueMeta && _valueMeta.schemaVersion ? _valueMeta.schemaVersion : null,
        sourceUrl: _sourceUrl,
        metaUrl: _metaUrl,
        cardSourceUrl: _cardSourceUrl,
        cardMetaUrl: _cardMetaUrl,
        targetSourceUrl: _targetSourceUrl,
        targetMetaUrl: _targetMetaUrl,
        valueSourceUrl: _valueSourceUrl,
        valueMetaUrl: _valueMetaUrl,
        lastError: _lastError ? _lastError.message : null,
        cardLastError: _cardLastError ? _cardLastError.message : null,
        targetLastError: _targetLastError ? _targetLastError.message : null,
        valueLastError: _valueLastError ? _valueLastError.message : null,
        latency: getLatencyStatus()
    };
}

let _ort: any = null;
try { _ort = _require('onnxruntime-web'); } catch (e) { /* ignore */ }
function applyOrtEnvLogLevel(ortApi: any) {
    if (!ortApi || !ortApi.env || typeof ortApi.env !== 'object') return;
    try {
        ortApi.env.logLevel = 'error';
    } catch (e) { /* ignore */ }
}
applyOrtEnvLogLevel(_ort);

function isWebGpuExecutionOptIn() {
    try {
        if (_config.enableWebGpuExecution === true) return true;
        if (typeof _config.readWebGpuEnabled === 'function' && _config.readWebGpuEnabled() === true) return true;
        if (typeof _config.readQuerySearch === 'function') {
            const search = String(_config.readQuerySearch() || '');
            if (/[?&]onnxWebGpu=1(?:&|$)/.test(search)) return true;
            if (/[?&]onnxWebGpu=true(?:&|$)/i.test(search)) return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

async function createInferenceSession(ortApi: any, modelUrl: any) {
    const preferredProviders = isWebGpuExecutionOptIn() ? ['webgpu', 'wasm'] : ['wasm'];
    try {
        return await ortApi.InferenceSession.create(modelUrl, { executionProviders: preferredProviders });
    } catch (primaryErr) {
        if (preferredProviders.length === 1 && preferredProviders[0] === 'wasm') throw primaryErr;
        return await ortApi.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
    }
}

function resolveOrtApi(requireSession: any): any {
    const ortApi = _config.ortApi || _ort;
    if (ortApi && typeof ortApi.Tensor === 'function' &&
        (requireSession !== true || typeof ortApi.InferenceSession === 'function')) {
        return ortApi;
    }
    return null;
}

async function loadMetaJson(url: any, fetchImpl: any) {
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

function applyCardActionIds(ids: any) {
    _cardActionIds = Array.isArray(ids) ? ids.filter((one) => typeof one === 'string' && one.trim()) : [];
    _cardActionIndexById = Object.create(null);
    for (let i = 0; i < _cardActionIds.length; i++) {
        _cardActionIndexById[_cardActionIds[i]] = i;
    }
    _noCardActionIndex = Number.isFinite(_cardActionIndexById[NO_CARD_ACTION_ID])
        ? _cardActionIndexById[NO_CARD_ACTION_ID]
        : -1;
}

function applyCardModelActionIds(ids: any) {
    _cardModelActionIds = Array.isArray(ids) ? ids.filter((one) => typeof one === 'string' && one.trim()) : [];
    _cardModelActionIndexById = Object.create(null);
    for (let i = 0; i < _cardModelActionIds.length; i++) {
        _cardModelActionIndexById[_cardModelActionIds[i]] = i;
    }
    _cardModelNoCardActionIndex = Number.isFinite(_cardModelActionIndexById[NO_CARD_ACTION_ID])
        ? _cardModelActionIndexById[NO_CARD_ACTION_ID]
        : -1;
}

function resolveTensorByName(outputs: any, preferredName: any, fallbackIndex: any) {
    if (!outputs || typeof outputs !== 'object') return null;
    if (preferredName && outputs[preferredName] && outputs[preferredName].data) return outputs[preferredName];
    const keys = Object.keys(outputs);
    if (keys.length <= 0) return null;
    const idx = Number.isFinite(fallbackIndex) ? Math.max(0, Math.floor(fallbackIndex)) : 0;
    const key = keys[idx] || keys[0];
    return outputs[key] || null;
}

async function loadFromUrl(modelUrl: any, metaUrl: any, fetchImpl: any) {
    const ortApi = resolveOrtApi(true);
    if (!ortApi) {
        _lastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _sourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _metaUrl;

    try {
        let modelSource = targetModel;
        if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
            try {
                modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
            } catch (assetErr) {
                modelSource = targetModel;
            }
        }
        const session = await createInferenceSession(ortApi, modelSource);
        const meta = await loadMetaJson(targetMeta, fetchImpl);
        _session = session;
        _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
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

async function loadCardModelFromUrl(modelUrl: any, metaUrl: any, fetchImpl: any) {
    const ortApi = resolveOrtApi(true);
    if (!ortApi) {
        _cardLastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _cardSourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _cardMetaUrl;

    try {
        let modelSource = targetModel;
        if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
            try {
                modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
            } catch (assetErr) {
                modelSource = targetModel;
            }
        }
        const session = await createInferenceSession(ortApi, modelSource);
        const meta = await loadMetaJson(targetMeta, fetchImpl);
        _cardSession = session;
        _cardMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
        _cardInputName = (_cardMeta && _cardMeta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _cardHeadOutputName =
            (_cardMeta && _cardMeta.cardOutputName) ||
            (session.outputNames && session.outputNames.length > 1 ? session.outputNames[1] : (session.outputNames && session.outputNames[0])) ||
            'card_logits';
        applyCardModelActionIds((_cardMeta && _cardMeta.cardActionIds) || _cardActionIds);
        _cardSourceUrl = targetModel;
        _cardMetaUrl = targetMeta;
        _cardLastError = null;
        return true;
    } catch (err) {
        _cardLastError = err instanceof Error ? err : new Error(String(err));
        _cardSession = null;
        _cardMeta = null;
        _cardInputName = 'obs';
        _cardHeadOutputName = 'card_logits';
        applyCardModelActionIds([]);
        return false;
    }
}

async function loadTargetModelFromUrl(modelUrl: any, metaUrl: any, fetchImpl: any) {
    const ortApi = resolveOrtApi(true);
    if (!ortApi) {
        _targetLastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _targetSourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _targetMetaUrl;

    try {
        let modelSource = targetModel;
        if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
            try {
                modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
            } catch (assetErr) {
                modelSource = targetModel;
            }
        }
        const session = await createInferenceSession(ortApi, modelSource);
        const meta = await loadMetaJson(targetMeta, fetchImpl);
        _targetSession = session;
        _targetMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
        _targetInputName = (_targetMeta && _targetMeta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _targetOutputName =
            (_targetMeta && (_targetMeta.targetOutputName || _targetMeta.outputName)) ||
            (session.outputNames && session.outputNames[0]) ||
            'target_logits';
        _targetSourceUrl = targetModel;
        _targetMetaUrl = targetMeta;
        _targetLastError = null;
        return true;
    } catch (err) {
        _targetLastError = err instanceof Error ? err : new Error(String(err));
        _targetSession = null;
        _targetMeta = null;
        _targetInputName = 'obs';
        _targetOutputName = 'target_logits';
        return false;
    }
}

async function loadValueModelFromUrl(modelUrl: any, metaUrl: any, fetchImpl: any) {
    const ortApi = resolveOrtApi(true);
    if (!ortApi) {
        _valueLastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _valueSourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _valueMetaUrl;

    try {
        let modelSource = targetModel;
        if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
            try {
                modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
            } catch (assetErr) {
                modelSource = targetModel;
            }
        }
        const session = await createInferenceSession(ortApi, modelSource);
        const meta = await loadMetaJson(targetMeta, fetchImpl);
        _valueSession = session;
        _valueMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
        _valueInputName = (_valueMeta && _valueMeta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _valueOutputName =
            (_valueMeta && (_valueMeta.valueOutputName || _valueMeta.outputName)) ||
            (session.outputNames && session.outputNames[0]) ||
            'value';
        _valueSourceUrl = targetModel;
        _valueMetaUrl = targetMeta;
        _valueLastError = null;
        return true;
    } catch (err) {
        _valueLastError = err instanceof Error ? err : new Error(String(err));
        _valueSession = null;
        _valueMeta = null;
        _valueInputName = 'obs';
        _valueOutputName = 'value';
        return false;
    }
}

function perspectiveCell(v: any, playerKey: any) {
    if (!Number.isFinite(v)) return 0;
    const sign = playerKey === 'black' ? 1 : -1;
    if (v === sign) return 1;
    if (v === -sign) return -1;
    return 0;
}

function buildCardCounts(cardIds: any) {
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

function toBinaryFlag(raw: any) {
    if (raw === true) return 1;
    if (raw === false || raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n > 0 ? 1 : 0;
}

function sigmoidDelta(delta: any) {
    const n = Number(delta);
    if (!Number.isFinite(n)) return 0.5;
    const capped = Math.max(-12, Math.min(12, n));
    return 1 / (1 + Math.exp(-capped));
}

function getBoardCoordinates(board: any) {
    if (!Array.isArray(board)) return [];
    if (SharedBoardUtils && typeof SharedBoardUtils.collectBoardCoordinates === 'function') {
        return SharedBoardUtils.collectBoardCoordinates(board);
    }
    const out = [];
    for (let row = 0; row < Math.min(LEGACY_BOARD_SIZE, board.length); row++) {
        const cells = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < Math.min(LEGACY_BOARD_SIZE, cells.length); col++) {
            out.push({ row, col });
        }
    }
    return out;
}

function getBoardCellValue(board: any, row: any, col: any) {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function') {
        return SharedBoardUtils.getCellValue(board, row, col);
    }
    if (!Array.isArray(board) || !Array.isArray(board[row])) return null;
    return board[row][col];
}

function isCornerMoveForBoard(move: any, board: any) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return false;
    if (SharedBoardUtils && typeof SharedBoardUtils.isCornerCell === 'function') {
        return SharedBoardUtils.isCornerCell(Number(move.row), Number(move.col), board);
    }
    return (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
}

function isEdgeMoveForBoard(move: any, board: any) {
    if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return false;
    if (SharedBoardUtils && typeof SharedBoardUtils.isEdgeCell === 'function') {
        return SharedBoardUtils.isEdgeCell(Number(move.row), Number(move.col), board);
    }
    return move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7;
}

function isPaddedActionSpace(modelMeta: any, outputDimHint: any) {
    const paddedSize = modelMeta && Number.isFinite(Number(modelMeta.paddedBoardSize))
        ? Math.floor(Number(modelMeta.paddedBoardSize))
        : 0;
    if (paddedSize > LEGACY_BOARD_SIZE) return true;
    const actionSpace = modelMeta && typeof modelMeta.actionSpace === 'string'
        ? modelMeta.actionSpace
        : '';
    if (actionSpace.indexOf('padded') >= 0) return true;
    if (Number.isFinite(outputDimHint) && Number(outputDimHint) > LEGACY_BOARD_FEATURE_DIM) return true;
    return false;
}

function supportsPaddedBoardFeatures(modelMeta: any) {
    const metaBase = modelMeta && Number.isFinite(Number(modelMeta.baseInputDim))
        ? Math.floor(Number(modelMeta.baseInputDim))
        : null;
    return isPaddedActionSpace(modelMeta, modelMeta && modelMeta.outputDim) ||
        (Number.isFinite(metaBase) && (metaBase as number) >= (PADDED_BOARD_FEATURE_DIM + AUX_FEATURE_DIM));
}

function resolveBoardFeatureDim(modelMeta: any, baseInputDim: any) {
    if (supportsPaddedBoardFeatures(modelMeta)) {
        return PADDED_BOARD_FEATURE_DIM;
    }
    if (Number.isFinite(baseInputDim) && baseInputDim >= (PADDED_BOARD_FEATURE_DIM + AUX_FEATURE_DIM)) {
        return PADDED_BOARD_FEATURE_DIM;
    }
    return LEGACY_BOARD_FEATURE_DIM;
}

function resolveActionGrid(modelMeta: any, outputDimHint: any) {
    if (isPaddedActionSpace(modelMeta, outputDimHint)) {
        return {
            minCoord: PADDED_BOARD_MIN,
            size: PADDED_BOARD_SIZE
        };
    }
    return {
        minCoord: 0,
        size: LEGACY_BOARD_SIZE
    };
}

function actionIndexFromCoord(row: any, col: any, modelMeta: any, outputDimHint: any) {
    if (!Number.isFinite(row) || !Number.isFinite(col)) return -1;
    const grid = resolveActionGrid(modelMeta, outputDimHint);
    const normalizedRow = Number(row);
    const normalizedCol = Number(col);
    const maxCoord = grid.minCoord + grid.size - 1;
    if (normalizedRow < grid.minCoord || normalizedRow > maxCoord) return -1;
    if (normalizedCol < grid.minCoord || normalizedCol > maxCoord) return -1;
    if (grid.minCoord === PADDED_BOARD_MIN && grid.size === PADDED_BOARD_SIZE) {
        if (SharedBoardUtils && typeof SharedBoardUtils.toPaddedBoardIndex === 'function') {
            return SharedBoardUtils.toPaddedBoardIndex(normalizedRow, normalizedCol);
        }
        return ((normalizedRow - PADDED_BOARD_MIN) * PADDED_BOARD_SIZE) + (normalizedCol - PADDED_BOARD_MIN);
    }
    return (normalizedRow * grid.size) + normalizedCol;
}

function estimateDiscDiffFromBoard(board: any, playerKey: any) {
    if (!Array.isArray(board)) return 0;
    const own = playerKey === 'black' ? 1 : -1;
    const opp = -own;
    let ownCount = 0;
    let oppCount = 0;
    for (const cell of getBoardCoordinates(board)) {
        const value = getBoardCellValue(board, cell.row, cell.col);
        if (value === own) ownCount += 1;
        else if (value === opp) oppCount += 1;
    }
    return ownCount - oppCount;
}

function resolveCardUseProbabilityThreshold(context: any) {
    const ctx = context || {};
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? Number(ctx.legalMovesCount) : 0;
    if (legalMovesCount <= 0) return 0.5;

    let threshold = 0.62;
    const hasCornerMoveNow = toBinaryFlag(ctx.hasCornerMoveNow) > 0;
    const cornerEmergency = toBinaryFlag(ctx.cornerEmergency) > 0;
    const highBonusMoveAvailable = toBinaryFlag(ctx.highBonusMoveAvailable) > 0;

    if (hasCornerMoveNow) threshold += 0.08;
    if (cornerEmergency) threshold -= 0.07;
    if (highBonusMoveAvailable) threshold += 0.04;

    const handSize = Array.isArray(ctx.handCardIds)
        ? ctx.handCardIds.length
        : (Number.isFinite(ctx.handSize) ? Number(ctx.handSize) : 0);
    if (handSize >= 5) threshold -= 0.06;
    else if (handSize >= 4) threshold -= 0.04;

    const discDiff = Number.isFinite(ctx.discDiff)
        ? Number(ctx.discDiff)
        : estimateDiscDiffFromBoard(ctx.board, ctx.playerKey === 'black' ? 'black' : 'white');
    if (discDiff >= 10) threshold += 0.05;
    else if (discDiff <= -10) threshold -= 0.03;

    return Math.max(0.5, Math.min(0.8, threshold));
}

function countCornerEdgeControl(board: any, playerKey: any) {
    const out = { ownCorners: 0, oppCorners: 0, ownEdges: 0, oppEdges: 0 };
    if (!Array.isArray(board)) return out;
    const own = playerKey === 'black' ? 1 : -1;
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        const cornerControl = SharedBoardUtils.countCornerControl(board, own);
        out.ownCorners = Number(cornerControl && cornerControl.ownCorners) || 0;
        out.oppCorners = Number(cornerControl && cornerControl.oppCorners) || 0;
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.countEdgeControl === 'function') {
        const edgeControl = SharedBoardUtils.countEdgeControl(board, own);
        out.ownEdges = Number(edgeControl && edgeControl.ownEdges) || 0;
        out.oppEdges = Number(edgeControl && edgeControl.oppEdges) || 0;
        return out;
    }
    const opp = -own;
    for (const cell of getBoardCoordinates(board)) {
        const value = getBoardCellValue(board, cell.row, cell.col);
        const isCorner = isCornerMoveForBoard(cell, board);
        const isEdge = !isCorner && isEdgeMoveForBoard(cell, board);
        if (isCorner) {
            if (value === own) out.ownCorners += 1;
            else if (value === opp) out.oppCorners += 1;
        } else if (isEdge) {
            if (value === own) out.ownEdges += 1;
            else if (value === opp) out.oppEdges += 1;
        }
    }
    return out;
}

function getContextBoardBonusAtCell(ctx: any, row: any, col: any) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const key = `${row},${col}`;
    if (ctx.boardBonusConsumedByCell && ctx.boardBonusConsumedByCell[key] === true) return 0;
    const raw = Number(ctx.boardBonusByCell && ctx.boardBonusByCell[key] ? ctx.boardBonusByCell[key] : 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getCornerPlanFeatures(ctx: any, board: any, playerKey: any) {
    const control = countCornerEdgeControl(board, playerKey);
    const ownCorners = Number.isFinite(Number(ctx.ownCornersBefore)) ? Number(ctx.ownCornersBefore) : control.ownCorners;
    const oppCorners = Number.isFinite(Number(ctx.oppCornersBefore)) ? Number(ctx.oppCornersBefore) : control.oppCorners;
    const ownEdges = Number.isFinite(Number(ctx.ownEdgesBefore)) ? Number(ctx.ownEdgesBefore) : control.ownEdges;
    const oppEdges = Number.isFinite(Number(ctx.oppEdgesBefore)) ? Number(ctx.oppEdgesBefore) : control.oppEdges;

    const moves = Array.isArray(ctx.candidateMoves) ? ctx.candidateMoves : [];
    const hasCornerMoveNow = Number.isFinite(Number(ctx.hasCornerMoveNow))
        ? toBinaryFlag(ctx.hasCornerMoveNow)
        : (moves.some((move: any) => isCornerMoveForBoard(move, board)) ? 1 : 0);
    const hasEdgeMoveNow = Number.isFinite(Number(ctx.hasEdgeMoveNow))
        ? toBinaryFlag(ctx.hasEdgeMoveNow)
        : (moves.some((move: any) => isEdgeMoveForBoard(move, board) && !isCornerMoveForBoard(move, board)) ? 1 : 0);

    let maxLegalMoveBonus = Number.isFinite(Number(ctx.maxLegalMoveBonus)) ? Number(ctx.maxLegalMoveBonus) : 0;
    if (maxLegalMoveBonus <= 0 && moves.length > 0) {
        for (const move of moves) {
            if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) continue;
            const b = getContextBoardBonusAtCell(ctx, move.row, move.col);
            if (b > maxLegalMoveBonus) maxLegalMoveBonus = b;
        }
    }
    const highBonusMoveAvailable = Number.isFinite(Number(ctx.highBonusMoveAvailable))
        ? toBinaryFlag(ctx.highBonusMoveAvailable)
        : (maxLegalMoveBonus >= 3 ? 1 : 0);
    const cornerEmergency = Number.isFinite(Number(ctx.cornerEmergency))
        ? toBinaryFlag(ctx.cornerEmergency)
        : ((oppCorners > ownCorners || (hasCornerMoveNow <= 0 && oppCorners > 0)) ? 1 : 0);
    const cornerHoldMode = Number.isFinite(Number(ctx.cornerHoldMode))
        ? toBinaryFlag(ctx.cornerHoldMode)
        : ((cornerEmergency <= 0 && ownCorners > 0 && ownCorners >= oppCorners && ownEdges >= oppEdges) ? 1 : 0);

    return {
        ownCorners,
        oppCorners,
        ownEdges,
        oppEdges,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        cornerHoldMode,
        highBonusMoveAvailable,
        maxLegalMoveBonus
    };
}

function resolveBaseInputDim(modelMeta: any, inputDim: any, cardDim: any): number {
    const metaBase = modelMeta && Number.isFinite(modelMeta.baseInputDim) ? Math.floor(modelMeta.baseInputDim) : null;
    if (Number.isFinite(metaBase) && (metaBase as number) >= 64 && (metaBase as number) <= inputDim) return metaBase as number;
    if (Number.isFinite(cardDim) && cardDim > 0) {
        const inferred = inputDim - (cardDim * 2);
        if (inferred >= 64 && inferred <= inputDim) return inferred;
    }
    return Math.min(BASE_INPUT_DIM, inputDim);
}

function resolveDeckCountScalar(ctx: any, modelMeta: any) {
    const legacyDeckCount = Number.isFinite(ctx.deckCount) ? ctx.deckCount : 0;
    if (modelMeta && modelMeta.deckCountFeature === DECK_COUNT_FEATURE_MODE) {
        const ownDeckCount = Number.isFinite(ctx.ownDeckCount) ? ctx.ownDeckCount : legacyDeckCount;
        const initialDeckSize = Number.isFinite(ctx.initialDeckSize) && ctx.initialDeckSize > 0
            ? ctx.initialDeckSize
            : LEGACY_DECK_COUNT_NORMALIZER;
        return ownDeckCount / initialDeckSize;
    }
    return legacyDeckCount / LEGACY_DECK_COUNT_NORMALIZER;
}

function buildInputVector(context: any, metaOverride: any, actionIdsOverride: any) {
    const ctx = context || {};
    const board = Array.isArray(ctx.board) ? ctx.board : [];
    const playerKey = ctx.playerKey === 'black' ? 'black' : 'white';
    const modelMeta = metaOverride || _meta;
    const actionIds = Array.isArray(actionIdsOverride) ? actionIdsOverride : _cardActionIds;
    const inputDim = (modelMeta && Number.isFinite(modelMeta.inputDim) && modelMeta.inputDim > 0)
        ? Math.floor(modelMeta.inputDim)
        : BASE_INPUT_DIM;
    const cardDim = actionIds.length;
    const baseInputDim = resolveBaseInputDim(modelMeta, inputDim, cardDim);
    const boardFeatureDim = resolveBoardFeatureDim(modelMeta, baseInputDim);
    const out = new Float32Array(inputDim);

    if (board.length > 0) {
        if (boardFeatureDim > LEGACY_BOARD_FEATURE_DIM) {
            let idx = 0;
            for (let row = PADDED_BOARD_MIN; row <= PADDED_BOARD_MAX; row++) {
                for (let col = PADDED_BOARD_MIN; col <= PADDED_BOARD_MAX; col++) {
                    out[idx++] = perspectiveCell(getBoardCellValue(board, row, col), playerKey);
                }
            }
        } else {
            let idx = 0;
            for (let row = 0; row < LEGACY_BOARD_SIZE; row++) {
                for (let col = 0; col < LEGACY_BOARD_SIZE; col++) {
                    out[idx++] = perspectiveCell(getBoardCellValue(board, row, col), playerKey);
                }
            }
        }
    }

    const legalMoves = Number.isFinite(ctx.legalMovesCount) ? ctx.legalMovesCount : 0;
    let blackCount = Number.isFinite(ctx.blackCountBefore) ? ctx.blackCountBefore : 0;
    let whiteCount = Number.isFinite(ctx.whiteCountBefore) ? ctx.whiteCountBefore : 0;
    if ((!Number.isFinite(ctx.blackCountBefore) || !Number.isFinite(ctx.whiteCountBefore)) && Array.isArray(board)) {
        blackCount = 0;
        whiteCount = 0;
        for (const cell of getBoardCoordinates(board)) {
            const value = getBoardCellValue(board, cell.row, cell.col);
            if (value === 1) blackCount++;
            else if (value === -1) whiteCount++;
        }
    }
    const ownCharge = Number.isFinite(ctx.ownCharge) ? ctx.ownCharge : 0;
    const oppCharge = Number.isFinite(ctx.oppCharge) ? ctx.oppCharge : 0;
    const deckCountScalar = resolveDeckCountScalar(ctx, modelMeta);
    const pendingFlag = ctx.pendingType ? 1 : 0;
    const discDiff = playerKey === 'black' ? (blackCount - whiteCount) : (whiteCount - blackCount);
    const planFeatures = getCornerPlanFeatures(ctx, board, playerKey);
    const scalarOffset = boardFeatureDim;

    if (baseInputDim > (scalarOffset + 0)) out[scalarOffset + 0] = legalMoves / 60;
    if (baseInputDim > (scalarOffset + 1)) out[scalarOffset + 1] = discDiff / 64;
    if (baseInputDim > (scalarOffset + 2)) out[scalarOffset + 2] = ownCharge / CHARGE_MAX_NORMALIZER;
    if (baseInputDim > (scalarOffset + 3)) out[scalarOffset + 3] = oppCharge / CHARGE_MAX_NORMALIZER;
    if (baseInputDim > (scalarOffset + 4)) out[scalarOffset + 4] = deckCountScalar;
    if (baseInputDim > (scalarOffset + 5)) out[scalarOffset + 5] = pendingFlag;
    if (baseInputDim > (scalarOffset + 6)) out[scalarOffset + 6] = planFeatures.ownCorners / 4;
    if (baseInputDim > (scalarOffset + 7)) out[scalarOffset + 7] = planFeatures.oppCorners / 4;
    if (baseInputDim > (scalarOffset + 8)) out[scalarOffset + 8] = planFeatures.ownEdges / 24;
    if (baseInputDim > (scalarOffset + 9)) out[scalarOffset + 9] = planFeatures.oppEdges / 24;
    if (baseInputDim > (scalarOffset + 10)) out[scalarOffset + 10] = planFeatures.hasCornerMoveNow;
    if (baseInputDim > (scalarOffset + 11)) out[scalarOffset + 11] = planFeatures.hasEdgeMoveNow;
    if (baseInputDim > (scalarOffset + 12)) out[scalarOffset + 12] = planFeatures.cornerEmergency;
    if (baseInputDim > (scalarOffset + 13)) out[scalarOffset + 13] = planFeatures.cornerHoldMode;
    if (baseInputDim > (scalarOffset + 14)) out[scalarOffset + 14] = planFeatures.highBonusMoveAvailable;
    if (baseInputDim > (scalarOffset + 15)) out[scalarOffset + 15] = Math.max(0, Math.min(1, planFeatures.maxLegalMoveBonus / 5));

    if (cardDim > 0 && inputDim >= (baseInputDim + (cardDim * 2))) {
        const handCounts = buildCardCounts(ctx.handCardIds);
        const usableFlags = buildCardCounts(ctx.usableCardIds);
        const handOffset = baseInputDim;
        const usableOffset = baseInputDim + cardDim;
        for (let idx = 0; idx < actionIds.length; idx++) {
            const cardId = actionIds[idx];
            const handCount = Number(handCounts[cardId] || 0);
            const usableCount = Number(usableFlags[cardId] || 0);
            out[handOffset + idx] = Math.min(MAX_HAND_SIZE, handCount) / MAX_HAND_SIZE;
            out[usableOffset + idx] = usableCount > 0 ? 1 : 0;
        }
    }

    const pendingTypes = modelMeta && Array.isArray(modelMeta.pendingTypes)
        ? modelMeta.pendingTypes.filter((one: any) => typeof one === 'string' && one.trim())
        : [];
    if (pendingTypes.length > 0) {
        const fullCardOffset = baseInputDim + (cardDim * 2);
        const pendingOffset = inputDim >= (fullCardOffset + pendingTypes.length)
            ? fullCardOffset
            : (inputDim >= (baseInputDim + pendingTypes.length) ? baseInputDim : -1);
        if (pendingOffset >= 0) {
            const pendingType = typeof ctx.pendingType === 'string' ? ctx.pendingType.trim() : '';
            const pendingIndex = pendingTypes.indexOf(pendingType);
            if (pendingIndex >= 0 && pendingOffset + pendingIndex < out.length) {
                out[pendingOffset + pendingIndex] = 1;
            }
        }
    }

    return out;
}

function indexFromMove(move: any, modelMeta: any, outputDimHint: any) {
    if (!move) return -1;
    return actionIndexFromCoord(move.row, move.col, modelMeta, outputDimHint);
}

function isStandardOnnxBoard(board: any) {
    if (SharedBoardUtils && typeof SharedBoardUtils.isStandardBoard8x8 === 'function') {
        return SharedBoardUtils.isStandardBoard8x8(board);
    }
    return false;
}

function hasOnlySupportedMoveIndexes(moves: any, modelMeta: any, outputDimHint: any) {
    if (!Array.isArray(moves)) return true;
    for (const move of moves) {
        if (indexFromMove(move, modelMeta, outputDimHint) < 0) return false;
    }
    return true;
}

function isSupportedOnnxContext(context: any, candidateMoves: any, modelMeta: any, outputDimHint: any) {
    const board = Array.isArray(context && context.board) ? context.board : null;
    if (supportsPaddedBoardFeatures(modelMeta)) {
        if (!Array.isArray(board) || board.length <= 0) return false;
    } else if (!isStandardOnnxBoard(board)) {
        return false;
    }
    if (!hasOnlySupportedMoveIndexes(candidateMoves, modelMeta, outputDimHint)) return false;
    const pendingTarget = context && context.pendingTarget;
    if (pendingTarget && indexFromMove(pendingTarget, modelMeta, outputDimHint) < 0) return false;
    return true;
}

async function runInferenceForSession(session: any, inputName: any, context: any, metaOverride: any, actionIdsOverride: any) {
    if (!session) return null;
    const ortApi = resolveOrtApi(false);
    if (!ortApi) return null;
    const x = buildInputVector(context || {}, metaOverride, actionIdsOverride);
    const feeds: any = {};
    feeds[inputName] = new ortApi.Tensor('float32', x, [1, x.length]);
    return session.run(feeds);
}

async function runInference(context: any) {
    return runInferenceForSession(_session, _inputName, context, _meta, _cardActionIds);
}

async function chooseMove(candidateMoves: any, context: any) {
    if (!_config.enabled) return null;
    if (!hasModel()) return null;
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    if (!isSupportedOnnxContext(context, candidateMoves, _meta, _meta && _meta.outputDim)) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;
    const startedAt = nowMs();

    try {
        const inferenceContext = Object.assign({}, context || {}, { candidateMoves });
        const outputs = await runInference(inferenceContext);
        const out = resolveTensorByName(outputs, _placeOutputName, 0);
        if (!out || !out.data) return null;
        const scores = out.data;

        let best: any = null;
        let bestScore = -Infinity;
        for (const move of candidateMoves) {
            const idx = indexFromMove(move, _meta, scores.length);
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
    } finally {
        recordLatency('chooseMove', startedAt);
    }
}

async function chooseCard(usableCardIds: any, context: any) {
    if (!_config.enabled) return null;
    if (!hasModel() && !hasCardSpecialistModel()) return null;
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    if (!hasCardHead()) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;
    const startedAt = nowMs();

    try {
        const useCardSpecialist = _config.useCardSpecialist === true && hasCardSpecialistModel();
        const activeSession = useCardSpecialist ? _cardSession : _session;
        const activeInputName = useCardSpecialist ? _cardInputName : _inputName;
        const activeMeta = useCardSpecialist ? _cardMeta : _meta;
        if (!isSupportedOnnxContext(context, null, activeMeta, activeMeta && activeMeta.outputDim)) return null;
        const activeOutputName = useCardSpecialist ? _cardHeadOutputName : _cardOutputName;
        const activeActionIndexById = useCardSpecialist ? _cardModelActionIndexById : _cardActionIndexById;
        const activeNoCardIndex = useCardSpecialist ? _cardModelNoCardActionIndex : _noCardActionIndex;
        const activeActionIds = useCardSpecialist ? _cardModelActionIds : _cardActionIds;
        const outputs = await runInferenceForSession(activeSession, activeInputName, context || {}, activeMeta, activeActionIds);
        const out = resolveTensorByName(outputs, activeOutputName, 1);
        if (!out || !out.data) return null;
        const scores = out.data;

        let bestCardId: any = null;
        let bestScore = -Infinity;
        for (const cardId of usableCardIds) {
            if (typeof cardId !== 'string') continue;
            const idx = activeActionIndexById[cardId];
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
            activeNoCardIndex >= 0 &&
            activeNoCardIndex < scores.length &&
            Number.isFinite(Number(scores[activeNoCardIndex]))
        ) ? Number(scores[activeNoCardIndex]) : null;

        if (noCardScore !== null) {
            if (!Number.isFinite(bestScore)) {
                return null;
            }
            const cardUseProb = sigmoidDelta(bestScore - noCardScore);
            const requiredProb = resolveCardUseProbabilityThreshold(context);
            if (cardUseProb < requiredProb) {
                return null;
            }
        }
        return bestCardId;
    } catch (err) {
        _lastError = err instanceof Error ? err : new Error(String(err));
        return null;
    } finally {
        recordLatency('chooseCard', startedAt);
    }
}

async function choosePendingTarget(candidateTargets: any, context: any) {
    if (!_config.enabled) return null;
    if (!hasTargetModel()) return null;
    if (!Array.isArray(candidateTargets) || candidateTargets.length === 0) return null;
    if (!isSupportedOnnxContext(context, candidateTargets, _targetMeta, _targetMeta && _targetMeta.outputDim)) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;
    const startedAt = nowMs();

    try {
        const outputs = await runInferenceForSession(_targetSession, _targetInputName, context || {}, _targetMeta, _targetMeta && _targetMeta.cardActionIds);
        const out = resolveTensorByName(outputs, _targetOutputName, 0);
        if (!out || !out.data) return null;
        const scores = out.data;

        let best: any = null;
        let bestScore = -Infinity;
        for (const target of candidateTargets) {
            const idx = indexFromMove(target, _targetMeta, scores.length);
            if (idx < 0 || idx >= scores.length) continue;
            const score = Number(scores[idx]);
            if (!Number.isFinite(score)) continue;
            if (score > bestScore) {
                bestScore = score;
                best = target;
                continue;
            }
            if (score === bestScore && best) {
                if (target.row < best.row || (target.row === best.row && target.col < best.col)) {
                    best = target;
                }
            }
        }
        return best;
    } catch (err) {
        _targetLastError = err instanceof Error ? err : new Error(String(err));
        return null;
    } finally {
        recordLatency('choosePendingTarget', startedAt);
    }
}

async function evaluatePosition(context: any) {
    if (!_config.enabled) return null;
    if (!hasValueModel()) return null;
    if (!isSupportedOnnxContext(context, null, _valueMeta, _valueMeta && _valueMeta.outputDim)) return null;

    const level = Number.isFinite(context && context.level) ? context.level : 1;
    if (level < _config.minLevel) return null;
    const startedAt = nowMs();

    try {
        const outputs = await runInferenceForSession(_valueSession, _valueInputName, context || {}, _valueMeta, _valueMeta && _valueMeta.cardActionIds);
        const out = resolveTensorByName(outputs, _valueOutputName, 0);
        if (!out || !out.data || out.data.length <= 0) return null;
        const value = Number(out.data[0]);
        return Number.isFinite(value) ? value : null;
    } catch (err) {
        _valueLastError = err instanceof Error ? err : new Error(String(err));
        return null;
    } finally {
        recordLatency('evaluatePosition', startedAt);
    }
}

function __setLoadedForTest(session: any, meta: any) {
    _session = session || null;
    _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
    _inputName = (_meta && _meta.inputName) || 'obs';
    _placeOutputName = (_meta && (_meta.placeOutputName || _meta.outputName)) || 'logits';
    _cardOutputName = (_meta && _meta.cardOutputName) || null;
    applyCardActionIds(_meta && _meta.cardActionIds);
    _lastError = null;
}

function __setCardModelForTest(session: any, meta: any) {
    _cardSession = session || null;
    _cardMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
    _cardInputName = (_cardMeta && _cardMeta.inputName) || 'obs';
    _cardHeadOutputName = (_cardMeta && (_cardMeta.cardOutputName || _cardMeta.outputName)) || 'card_logits';
    applyCardModelActionIds((_cardMeta && _cardMeta.cardActionIds) || _cardActionIds);
    _cardLastError = null;
}

function __setTargetModelForTest(session: any, meta: any) {
    _targetSession = session || null;
    _targetMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
    _targetInputName = (_targetMeta && _targetMeta.inputName) || 'obs';
    _targetOutputName = (_targetMeta && (_targetMeta.targetOutputName || _targetMeta.outputName)) || 'target_logits';
    _targetLastError = null;
}

function __setValueModelForTest(session: any, meta: any) {
    _valueSession = session || null;
    _valueMeta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
    _valueInputName = (_valueMeta && _valueMeta.inputName) || 'obs';
    _valueOutputName = (_valueMeta && (_valueMeta.valueOutputName || _valueMeta.outputName)) || 'value';
    _valueLastError = null;
}

const Api = {
    MODEL_SCHEMA_VERSION: POLICY_ONNX_MODEL_SCHEMA_VERSION,
    DEFAULT_MODEL_URL,
    DEFAULT_META_URL,
    DEFAULT_TARGET_MODEL_URL,
    DEFAULT_TARGET_META_URL,
    DEFAULT_VALUE_MODEL_URL,
    DEFAULT_VALUE_META_URL,
    configure,
    getStatus,
    clearModel,
    hasModel,
    hasTargetModel,
    hasValueModel,
    loadFromUrl,
    loadCardModelFromUrl,
    loadTargetModelFromUrl,
    loadValueModelFromUrl,
    chooseMove,
    chooseCard,
    choosePendingTarget,
    evaluatePosition,
    __setLoadedForTest,
    __setCardModelForTest,
    __setTargetModelForTest,
    __setValueModelForTest
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}

export = Api;

