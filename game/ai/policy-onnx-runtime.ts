import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


const POLICY_ONNX_MODEL_SCHEMA_VERSION = 'policy_onnx.v1';
const DEFAULT_MODEL_URL = 'data/models/policy-net.onnx';
const DEFAULT_META_URL = 'data/models/policy-net.onnx.meta.json';
const DEFAULT_TARGET_MODEL_URL = 'data/models/policy-target.onnx';
const DEFAULT_TARGET_META_URL = 'data/models/policy-target.onnx.meta.json';
const DEFAULT_VALUE_MODEL_URL = 'data/models/policy-value.onnx';
const DEFAULT_VALUE_META_URL = 'data/models/policy-value.onnx.meta.json';
const BASE_INPUT_DIM = 80;
const AUX_FEATURE_DIM = 16;
const LEGACY_BOARD_SIZE = 8;
const LEGACY_BOARD_FEATURE_DIM = LEGACY_BOARD_SIZE * LEGACY_BOARD_SIZE;
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
let PolicyFeatureVector: any = null;
try {
    PolicyFeatureVector = _require('./policy-feature-vector');
} catch (e) {
    // Built/test runtime may load this module before generated output exists.
}

let _session: any = null;
let _meta: any = null;
let _inputName = 'obs';
let _placeOutputName = 'logits';
let _cardActionIds: any = [];
let _targetSession: any = null;
let _targetMeta: any = null;
let _targetInputName = 'obs';
let _targetOutputName = 'target_logits';
let _valueSession: any = null;
let _valueMeta: any = null;
let _valueInputName = 'obs';
let _valueOutputName = 'value';
let _lastError: any = null;
let _targetLastError: any = null;
let _valueLastError: any = null;
let _sourceUrl = DEFAULT_MODEL_URL;
let _metaUrl = DEFAULT_META_URL;
let _targetSourceUrl = DEFAULT_TARGET_MODEL_URL;
let _targetMetaUrl = DEFAULT_TARGET_META_URL;
let _valueSourceUrl = DEFAULT_VALUE_MODEL_URL;
let _valueMetaUrl = DEFAULT_VALUE_META_URL;
let _config = {
    enabled: true,
    minLevel: 6,
    enableWebGpuExecution: false,
    readQuerySearch: null as any,
    readWebGpuEnabled: null as any,
    nowMs: null as any,
    ortApi: null as any,
    inferenceExecutor: null as any
};
const LATENCY_SAMPLE_LIMIT = 512;
const LATENCY_OPERATION_KEYS = Object.freeze([
    'chooseMove',
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
    if (typeof _config.nowMs === 'function') {
        const value = Number(_config.nowMs());
        if (Number.isFinite(value)) return value;
    }
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
    if (typeof config.targetSourceUrl === 'string' && config.targetSourceUrl.trim()) _targetSourceUrl = config.targetSourceUrl.trim();
    if (typeof config.targetMetaUrl === 'string' && config.targetMetaUrl.trim()) _targetMetaUrl = config.targetMetaUrl.trim();
    if (typeof config.valueSourceUrl === 'string' && config.valueSourceUrl.trim()) _valueSourceUrl = config.valueSourceUrl.trim();
    if (typeof config.valueMetaUrl === 'string' && config.valueMetaUrl.trim()) _valueMetaUrl = config.valueMetaUrl.trim();
    if (typeof config.enableWebGpuExecution === 'boolean') _config.enableWebGpuExecution = config.enableWebGpuExecution;
    if (typeof config.readQuerySearch === 'function') _config.readQuerySearch = config.readQuerySearch;
    if (config.readQuerySearch === null) _config.readQuerySearch = null;
    if (typeof config.readWebGpuEnabled === 'function') _config.readWebGpuEnabled = config.readWebGpuEnabled;
    if (config.readWebGpuEnabled === null) _config.readWebGpuEnabled = null;
    if (Object.prototype.hasOwnProperty.call(config, 'nowMs')) {
        _config.nowMs = typeof config.nowMs === 'function' ? config.nowMs : null;
    }
    if (Object.prototype.hasOwnProperty.call(config, 'ortApi')) {
        _config.ortApi = config.ortApi || null;
        applyOrtEnvLogLevel(_config.ortApi);
    }
    if (Object.prototype.hasOwnProperty.call(config, 'inferenceExecutor')) {
        const executor = config.inferenceExecutor;
        _config.inferenceExecutor = executor &&
            typeof executor.createSession === 'function' &&
            typeof executor.runSession === 'function'
            ? executor
            : null;
    }
    return getStatus();
}

function releaseInjectedSession(session: any) {
    const executor = _config.inferenceExecutor;
    if (!session || !executor || typeof executor.releaseSession !== 'function') return;
    try {
        Promise.resolve(executor.releaseSession(session)).catch(() => undefined);
    } catch (e) { /* best-effort release */ }
}

function clearModel() {
    releaseInjectedSession(_session);
    releaseInjectedSession(_targetSession);
    releaseInjectedSession(_valueSession);
    _session = null;
    _meta = null;
    _inputName = 'obs';
    _placeOutputName = 'logits';
    _cardActionIds = [];
    _targetSession = null;
    _targetMeta = null;
    _targetInputName = 'obs';
    _targetOutputName = 'target_logits';
    _valueSession = null;
    _valueMeta = null;
    _valueInputName = 'obs';
    _valueOutputName = 'value';
    _lastError = null;
    _targetLastError = null;
    _valueLastError = null;
    resetLatencyStats();
}

function hasModel() {
    return !!_session;
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
        targetModelLoaded: hasTargetModel(),
        valueModelLoaded: hasValueModel(),
        schemaVersion: _meta && _meta.schemaVersion ? _meta.schemaVersion : null,
        targetSchemaVersion: _targetMeta && _targetMeta.schemaVersion ? _targetMeta.schemaVersion : null,
        valueSchemaVersion: _valueMeta && _valueMeta.schemaVersion ? _valueMeta.schemaVersion : null,
        sourceUrl: _sourceUrl,
        metaUrl: _metaUrl,
        targetSourceUrl: _targetSourceUrl,
        targetMetaUrl: _targetMetaUrl,
        valueSourceUrl: _valueSourceUrl,
        valueMetaUrl: _valueMetaUrl,
        lastError: _lastError ? _lastError.message : null,
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

async function createInjectedInferenceSession(sessionKey: string, modelUrl: string, metaUrl: string) {
    const executor = _config.inferenceExecutor;
    if (!executor || typeof executor.createSession !== 'function') return null;
    const preferredProviders = isWebGpuExecutionOptIn() ? ['webgpu', 'wasm'] : ['wasm'];
    try {
        return await executor.createSession({
            sessionKey,
            modelUrl,
            metaUrl,
            executionProviders: preferredProviders
        });
    } catch (primaryErr) {
        if (preferredProviders.length === 1 && preferredProviders[0] === 'wasm') throw primaryErr;
        return executor.createSession({
            sessionKey,
            modelUrl,
            metaUrl,
            executionProviders: ['wasm']
        });
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
    const executor = _config.inferenceExecutor;
    const ortApi = executor ? null : resolveOrtApi(true);
    if (!executor && !ortApi) {
        _lastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _sourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _metaUrl;

    try {
        let session: any;
        let meta: any;
        if (executor) {
            session = await createInjectedInferenceSession('policy-placement', targetModel, targetMeta);
            meta = session && session.meta;
        } else {
            let modelSource = targetModel;
            if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
                try {
                    modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
                } catch (assetErr) {
                    modelSource = targetModel;
                }
            }
            session = await createInferenceSession(ortApi, modelSource);
            meta = await loadMetaJson(targetMeta, fetchImpl);
        }
        _session = session;
        _meta = meta || { schemaVersion: POLICY_ONNX_MODEL_SCHEMA_VERSION, inputDim: BASE_INPUT_DIM, baseInputDim: BASE_INPUT_DIM };
        _inputName = (_meta && _meta.inputName) || (session.inputNames && session.inputNames[0]) || 'obs';
        _placeOutputName =
            (_meta && (_meta.placeOutputName || _meta.outputName)) ||
            (session.outputNames && session.outputNames[0]) ||
            'logits';
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

async function loadTargetModelFromUrl(modelUrl: any, metaUrl: any, fetchImpl: any) {
    const executor = _config.inferenceExecutor;
    const ortApi = executor ? null : resolveOrtApi(true);
    if (!executor && !ortApi) {
        _targetLastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _targetSourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _targetMetaUrl;

    try {
        let session: any;
        let meta: any;
        if (executor) {
            session = await createInjectedInferenceSession('policy-target', targetModel, targetMeta);
            meta = session && session.meta;
        } else {
            let modelSource = targetModel;
            if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
                try {
                    modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
                } catch (assetErr) {
                    modelSource = targetModel;
                }
            }
            session = await createInferenceSession(ortApi, modelSource);
            meta = await loadMetaJson(targetMeta, fetchImpl);
        }
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
    const executor = _config.inferenceExecutor;
    const ortApi = executor ? null : resolveOrtApi(true);
    if (!executor && !ortApi) {
        _valueLastError = new Error('onnxruntime-web is not available');
        return false;
    }

    const targetModel = (typeof modelUrl === 'string' && modelUrl.trim()) ? modelUrl.trim() : _valueSourceUrl;
    const targetMeta = (typeof metaUrl === 'string' && metaUrl.trim()) ? metaUrl.trim() : _valueMetaUrl;

    try {
        let session: any;
        let meta: any;
        if (executor) {
            session = await createInjectedInferenceSession('policy-value', targetModel, targetMeta);
            meta = session && session.meta;
        } else {
            let modelSource = targetModel;
            if (OnnxAssetLoader && typeof OnnxAssetLoader.loadOnnxAssetSource === 'function') {
                try {
                    modelSource = await OnnxAssetLoader.loadOnnxAssetSource(targetModel, fetchImpl);
                } catch (assetErr) {
                    modelSource = targetModel;
                }
            }
            session = await createInferenceSession(ortApi, modelSource);
            meta = await loadMetaJson(targetMeta, fetchImpl);
        }
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

function buildInputVector(context: any, metaOverride: any, actionIdsOverride: any) {
    const modelMeta = metaOverride || _meta;
    const actionIds = Array.isArray(actionIdsOverride) ? actionIdsOverride : _cardActionIds;
    if (!PolicyFeatureVector || typeof PolicyFeatureVector.buildPolicyFeatureVector !== 'function') {
        PolicyFeatureVector = _require('./policy-feature-vector');
    }
    return PolicyFeatureVector.buildPolicyFeatureVector(context || {}, modelMeta, actionIds);
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
    const x = buildInputVector(context || {}, metaOverride, actionIdsOverride);
    const executor = _config.inferenceExecutor;
    if (executor && typeof executor.runSession === 'function') {
        return executor.runSession({
            session,
            inputName,
            type: 'float32',
            data: x,
            dims: [1, x.length],
            decisionEpoch: context && context.decisionEpoch,
            stateVersion: context && context.stateVersion,
            turnNumber: context && context.turnNumber,
            signal: context && context.abortSignal
        });
    }
    const ortApi = resolveOrtApi(false);
    if (!ortApi) return null;
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
    applyCardActionIds(_meta && _meta.cardActionIds);
    _lastError = null;
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
    loadTargetModelFromUrl,
    loadValueModelFromUrl,
    runInference,
    chooseMove,
    choosePendingTarget,
    evaluatePosition,
    __setLoadedForTest,
    __setTargetModelForTest,
    __setValueModelForTest
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}

export = Api;

