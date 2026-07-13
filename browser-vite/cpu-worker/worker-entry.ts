import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  CpuWorkerProtocolError,
  type CpuWorkerErrorResponse,
  type CpuWorkerRequest,
  type CpuWorkerResponse,
  type CpuWorkerSuccessResponse,
  type CpuCandidateScoringPayload,
  type OnnxCreateSessionPayload,
  type OnnxReleaseSessionPayload,
  type OnnxRunSessionPayload,
  collectTransferableBuffers,
  isSupportedNumericTypedArray,
  parseCpuWorkerCancel,
  parseCpuWorkerRequest
} from './protocol';
import { scoreCpuCandidateRequest } from '../../game/ai/cpu-candidate-scoring';

type OrtModule = {
  env?: {
    logLevel?: string;
    wasm?: {
      wasmPaths?: string | Record<string, string>;
      proxy?: boolean;
    };
  };
  Tensor: new (type: string, data: unknown, dims: number[]) => any;
  InferenceSession: {
    create(model: string | Uint8Array, options: { executionProviders: string[] }): Promise<any>;
  };
};

export interface CpuWorkerRuntimeOptions {
  ortLoader?: (options: { scriptUrl: string; executionProviders: string[] }) => Promise<OrtModule>;
  fetchImpl?: typeof fetch;
}

interface WorkerOnnxSession {
  session: any;
  inputNames: string[];
  outputNames: string[];
  executionProviders: string[];
}

async function defaultOrtLoader(options: { scriptUrl: string; executionProviders: string[] }): Promise<OrtModule> {
  const scope: any = typeof self !== 'undefined' ? self : null;
  if (!scope || typeof scope.importScripts !== 'function') {
    throw new Error('classic Dedicated Worker script loading is unavailable');
  }
  scope.importScripts(options.scriptUrl);
  return scope.ort as OrtModule;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error || 'unknown CPU Worker error'));
}

function sanitizeErrorMessage(error: unknown): string {
  const message = normalizeError(error).message || 'CPU Worker operation failed';
  return message.length > 2048 ? message.slice(0, 2048) : message;
}

function resolveRedirectUrl(sourceUrl: string, redirectUrl: unknown): string {
  const target = String(redirectUrl || '').trim();
  if (!target) throw new Error(`invalid ONNX asset redirect: ${sourceUrl}`);
  return new URL(target, sourceUrl).href;
}

function looksLikeJson(bytes: Uint8Array): boolean {
  for (let index = 0; index < Math.min(bytes.length, 64); index += 1) {
    const value = bytes[index];
    if (value === 9 || value === 10 || value === 13 || value === 32) continue;
    return value === 123 || value === 91;
  }
  return false;
}

function parseJsonManifest(bytes: Uint8Array): Record<string, any> | null {
  if (!looksLikeJson(bytes)) return null;
  try {
    const value = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (error) {
    return null;
  }
}

async function fetchBytes(fetchImpl: typeof fetch, url: string): Promise<Uint8Array> {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response || response.ok !== true) throw new Error(`failed to fetch ONNX asset: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function concatBytes(chunks: Uint8Array[], sourceBytes: unknown): Uint8Array {
  const actualLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const requestedLength = Number(sourceBytes);
  const outputLength = Number.isSafeInteger(requestedLength) && requestedLength >= actualLength
    ? requestedLength
    : actualLength;
  const out = new Uint8Array(outputLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return offset === out.length ? out : out.subarray(0, offset);
}

async function inflateGzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('gzip ONNX asset requires DecompressionStream support');
  }
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([source]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function loadOnnxModelSource(fetchImpl: typeof fetch, modelUrl: string): Promise<Uint8Array> {
  const bytes = await fetchBytes(fetchImpl, modelUrl);
  const manifest = parseJsonManifest(bytes);
  if (!manifest || typeof manifest.assetType !== 'string') return bytes;
  if (manifest.assetType === 'policy_table.chunks.v1') {
    if (!Array.isArray(manifest.chunks) || manifest.chunks.length <= 0) {
      throw new Error(`empty ONNX chunk manifest: ${modelUrl}`);
    }
    const chunks: Uint8Array[] = [];
    for (const chunk of manifest.chunks) {
      chunks.push(await fetchBytes(fetchImpl, resolveRedirectUrl(modelUrl, chunk && chunk.url)));
    }
    return concatBytes(chunks, manifest.sourceBytes);
  }
  if (manifest.assetType === 'policy_table.redirect.v1') {
    if (manifest.compression !== 'gzip') throw new Error(`unsupported ONNX redirect manifest: ${modelUrl}`);
    const compressed = await fetchBytes(fetchImpl, resolveRedirectUrl(modelUrl, manifest.url));
    return inflateGzipBytes(compressed);
  }
  throw new Error(`unsupported ONNX asset manifest: ${modelUrl}`);
}

async function loadMeta(fetchImpl: typeof fetch, metaUrl: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchImpl(metaUrl, { cache: 'no-store' });
    if (!response || response.ok !== true) return null;
    const value = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch (error) {
    return null;
  }
}

function makeSuccessResponse(request: CpuWorkerRequest, result: CpuWorkerSuccessResponse['result']): CpuWorkerSuccessResponse {
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    kind: 'response',
    ok: true,
    requestId: request.requestId,
    operation: request.operation,
    decisionEpoch: request.decisionEpoch,
    stateVersion: request.stateVersion,
    turnNumber: request.turnNumber,
    result
  };
}

function makeErrorResponse(request: CpuWorkerRequest, error: unknown): CpuWorkerErrorResponse {
  const protocolError = error instanceof CpuWorkerProtocolError;
  const operationErrorCode = request.operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES
    ? 'CPU_WORKER_SCORING_ERROR'
    : (String(request.operation).startsWith('onnx.') ? 'CPU_WORKER_ONNX_ERROR' : 'CPU_WORKER_OPERATION_ERROR');
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    kind: 'response',
    ok: false,
    requestId: request.requestId,
    operation: request.operation,
    decisionEpoch: request.decisionEpoch,
    stateVersion: request.stateVersion,
    turnNumber: request.turnNumber,
    error: {
      code: protocolError ? error.code : operationErrorCode,
      message: sanitizeErrorMessage(error),
      recoverable: !protocolError
    }
  };
}

async function releaseOrtSession(session: any): Promise<void> {
  if (!session) return;
  try {
    if (typeof session.release === 'function') await session.release();
    else if (typeof session.dispose === 'function') await session.dispose();
  } catch (error) { /* release is best-effort */ }
}

export function createCpuWorkerRuntime(options: CpuWorkerRuntimeOptions = {}) {
  const ortLoader = options.ortLoader || defaultOrtLoader;
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const sessions = new Map<string, WorkerOnnxSession>();
  const activeRequests = new Set<string>();
  const cancelledRequests = new Set<string>();
  let ortPromise: Promise<OrtModule> | null = null;

  const readOrt = async (wasmPathsUrl?: string, executionProviders?: string[]): Promise<OrtModule> => {
    if (!ortPromise) {
      if (!wasmPathsUrl || !Array.isArray(executionProviders) || executionProviders.length <= 0) {
        throw new Error('ORT Worker asset location is unavailable');
      }
      const scriptName = executionProviders[0] === 'webgpu' ? 'ort.webgpu.min.js' : 'ort.min.js';
      const scriptUrl = new URL(scriptName, wasmPathsUrl).href;
      ortPromise = Promise.resolve(ortLoader({
        scriptUrl,
        executionProviders: executionProviders.slice()
      })).catch((error) => {
        ortPromise = null;
        throw error;
      });
    }
    const ort = await ortPromise;
    if (!ort || typeof ort.Tensor !== 'function' || !ort.InferenceSession || typeof ort.InferenceSession.create !== 'function') {
      throw new Error('onnxruntime-web Worker module is unavailable');
    }
    if (ort.env) {
      try { ort.env.logLevel = 'error'; } catch (error) { /* ignore */ }
    }
    return ort;
  };

  const configureWasm = (ort: OrtModule, wasmPathsUrl: string) => {
    if (!ort.env || !ort.env.wasm) return;
    try { ort.env.wasm.wasmPaths = wasmPathsUrl; } catch (error) { /* ignore */ }
    try { ort.env.wasm.proxy = false; } catch (error) { /* ignore */ }
  };

  const createSession = async (payload: OnnxCreateSessionPayload) => {
    if (!fetchImpl) throw new Error('fetch is unavailable in the CPU Worker');
    let ort: OrtModule;
    try {
      ort = await readOrt(payload.wasmPathsUrl, payload.executionProviders);
    } catch (error) {
      throw new Error(`failed to load Worker ORT: ${sanitizeErrorMessage(error)}`);
    }
    configureWasm(ort, payload.wasmPathsUrl);
    let modelSource: Uint8Array;
    try {
      modelSource = await loadOnnxModelSource(fetchImpl, payload.modelUrl);
    } catch (error) {
      throw new Error(`failed to load Worker ONNX model: ${sanitizeErrorMessage(error)}`);
    }
    let session: any;
    try {
      session = await ort.InferenceSession.create(modelSource, {
        executionProviders: payload.executionProviders.slice()
      });
    } catch (error) {
      throw new Error(`failed to create Worker ONNX session: ${sanitizeErrorMessage(error)}`);
    }
    const next: WorkerOnnxSession = {
      session,
      inputNames: Array.isArray(session.inputNames) ? session.inputNames.slice() : [],
      outputNames: Array.isArray(session.outputNames) ? session.outputNames.slice() : [],
      executionProviders: payload.executionProviders.slice()
    };
    const previous = sessions.get(payload.sessionKey);
    sessions.set(payload.sessionKey, next);
    if (previous && previous.session !== session) void releaseOrtSession(previous.session);
    const meta = await loadMeta(fetchImpl, payload.metaUrl);
    return {
      sessionKey: payload.sessionKey,
      inputNames: next.inputNames,
      outputNames: next.outputNames,
      meta,
      executionProviders: next.executionProviders
    };
  };

  const runSession = async (payload: OnnxRunSessionPayload) => {
    const stored = sessions.get(payload.sessionKey);
    if (!stored) throw new Error(`ONNX session is not available: ${payload.sessionKey}`);
    const ort = await readOrt();
    const tensor = new ort.Tensor(payload.input.type, payload.input.data, payload.input.dims);
    const outputs = await stored.session.run({ [payload.input.name]: tensor });
    const serialized = Object.keys(outputs || {}).map((name) => {
      const output = outputs[name];
      if (!output || !isSupportedNumericTypedArray(output.data)) {
        throw new Error(`ONNX output tensor is unsupported: ${name}`);
      }
      const dims = Array.isArray(output.dims) ? output.dims.map((one: unknown) => Number(one)) : [output.data.length];
      return {
        name,
        type: typeof output.type === 'string' && output.type ? output.type : 'float32',
        data: output.data,
        dims
      };
    });
    return { sessionKey: payload.sessionKey, outputs: serialized };
  };

  const releaseSession = async (payload: OnnxReleaseSessionPayload) => {
    const stored = sessions.get(payload.sessionKey);
    const released = sessions.delete(payload.sessionKey);
    if (stored) await releaseOrtSession(stored.session);
    return { sessionKey: payload.sessionKey, released };
  };

  const handleRequest = async (request: CpuWorkerRequest): Promise<CpuWorkerSuccessResponse['result']> => {
    if (request.operation === CPU_WORKER_OPERATIONS.PING) {
      return { ready: true };
    }
    if (request.operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES) {
      return scoreCpuCandidateRequest((request.payload as CpuCandidateScoringPayload).request);
    }
    if (request.operation === CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION) {
      return createSession(request.payload as OnnxCreateSessionPayload);
    }
    if (request.operation === CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION) {
      return runSession(request.payload as OnnxRunSessionPayload);
    }
    return releaseSession(request.payload as OnnxReleaseSessionPayload);
  };

  const handleMessage = async (raw: unknown): Promise<CpuWorkerResponse | null> => {
    if (raw && typeof raw === 'object' && (raw as any).kind === 'cancel') {
      const cancel = parseCpuWorkerCancel(raw);
      if (activeRequests.has(cancel.requestId)) cancelledRequests.add(cancel.requestId);
      return null;
    }
    const request = parseCpuWorkerRequest(raw);
    activeRequests.add(request.requestId);
    try {
      const result = await handleRequest(request);
      if (cancelledRequests.has(request.requestId)) return null;
      return makeSuccessResponse(request, result);
    } catch (error) {
      if (cancelledRequests.has(request.requestId)) return null;
      return makeErrorResponse(request, error);
    } finally {
      activeRequests.delete(request.requestId);
      cancelledRequests.delete(request.requestId);
    }
  };

  const dispose = async () => {
    const existing = Array.from(sessions.values());
    sessions.clear();
    await Promise.all(existing.map((entry) => releaseOrtSession(entry.session)));
  };

  return {
    handleMessage,
    dispose,
    getStatus: () => ({
      sessionKeys: Array.from(sessions.keys()),
      activeRequests: activeRequests.size,
      cancelledRequests: cancelledRequests.size,
      ortLoaded: !!ortPromise
    })
  };
}

function installDedicatedWorkerRuntime(): void {
  const scope: any = typeof self !== 'undefined' ? self : null;
  if (!scope || typeof document !== 'undefined' || typeof scope.postMessage !== 'function') return;
  const runtime = createCpuWorkerRuntime();
  scope.onmessage = (event: MessageEvent) => {
    void runtime.handleMessage(event && event.data).then((response) => {
      if (!response) return;
      const transfer = response.ok ? collectTransferableBuffers(response.result) : [];
      scope.postMessage(response, transfer);
    }).catch((error) => {
      scope.postMessage({
        protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
        kind: 'protocol-error',
        message: sanitizeErrorMessage(error)
      });
    });
  };
}

installDedicatedWorkerRuntime();
