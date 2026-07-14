import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  CpuWorkerProtocolError,
  type CpuWorkerOperation,
  type CpuWorkerRequest,
  type CpuWorkerRequestIdentity,
  type CpuWorkerResult,
  type CpuWorkerStateVersion,
  type OnnxCreateSessionPayload,
  type OnnxCreateSessionResult,
  type OnnxReleaseSessionResult,
  type OnnxRunSessionResult,
  collectTransferableBuffers,
  parseCpuWorkerRequest,
  parseCpuWorkerResponse,
  sameCpuWorkerIdentity
} from './protocol';
import {
  isCpuCandidateScoringRequest,
  verifyCpuCandidateScoringResponse,
  type CpuCandidateScoringBatch,
  type CpuCandidateScoringRequest,
  type CpuCandidateScoringResponse
} from '../../game/ai/cpu-candidate-scoring';

export interface CpuWorkerTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

export type CpuWorkerFactory = () => CpuWorkerTransport;

export interface CpuWorkerRequestOptions {
  decisionEpoch?: number;
  stateVersion?: CpuWorkerStateVersion;
  turnNumber?: number | null;
  timeoutMs?: number;
  signal?: AbortSignal | null;
  transfer?: Transferable[];
}

export interface CpuWorkerClientOptions {
  workerFactory: CpuWorkerFactory;
  defaultTimeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface CpuWorkerClientStatus {
  workerActive: boolean;
  permanentlyClosed: boolean;
  generation: number;
  pendingRequests: number;
  requestCount: number;
  workerCreatedCount: number;
  restartCount: number;
  lastError: string | null;
}

interface PendingRequest {
  identity: CpuWorkerRequestIdentity;
  generation: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
  abortCleanup: (() => void) | null;
  resolve: (value: CpuWorkerResult) => void;
  reject: (reason: Error) => void;
}

export class CpuWorkerClientError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(message: string, code = 'CPU_WORKER_ERROR', recoverable = true) {
    super(message);
    this.name = 'CpuWorkerClientError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

function normalizeError(value: unknown, fallbackMessage: string, code = 'CPU_WORKER_ERROR'): CpuWorkerClientError {
  if (value instanceof CpuWorkerClientError) return value;
  if (value instanceof Error) return new CpuWorkerClientError(value.message || fallbackMessage, code, false);
  return new CpuWorkerClientError(fallbackMessage, code, false);
}

function normalizeTimeoutMs(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(120000, Math.floor(parsed)));
}

function normalizeStateVersion(value: unknown): CpuWorkerStateVersion {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || Number.isSafeInteger(value)) return value as CpuWorkerStateVersion;
  return null;
}

function normalizeTurnNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function makeWorkerEventError(event: unknown, fallbackMessage: string): CpuWorkerClientError {
  const candidate = event as { message?: unknown; error?: unknown } | null;
  if (candidate && candidate.error instanceof Error) {
    return new CpuWorkerClientError(candidate.error.message || fallbackMessage, 'CPU_WORKER_CRASH', false);
  }
  const message = candidate && typeof candidate.message === 'string' && candidate.message.trim()
    ? candidate.message.trim()
    : fallbackMessage;
  return new CpuWorkerClientError(message, 'CPU_WORKER_CRASH', false);
}

export class CpuWorkerClient {
  private readonly workerFactory: CpuWorkerFactory;
  private readonly defaultTimeoutMs: number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private worker: CpuWorkerTransport | null = null;
  private generation = 0;
  private requestSequence = 0;
  private decisionEpoch = 0;
  private requestCount = 0;
  private workerCreatedCount = 0;
  private restartCount = 0;
  private lastError: Error | null = null;
  private permanentlyClosed = false;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly ignoredRequestIds = new Set<string>();

  constructor(options: CpuWorkerClientOptions) {
    if (!options || typeof options.workerFactory !== 'function') {
      throw new TypeError('CpuWorkerClient requires a workerFactory');
    }
    this.workerFactory = options.workerFactory;
    this.defaultTimeoutMs = normalizeTimeoutMs(options.defaultTimeoutMs, 15000);
    this.setTimeoutFn = (options.setTimeoutFn || setTimeout).bind(globalThis);
    this.clearTimeoutFn = (options.clearTimeoutFn || clearTimeout).bind(globalThis);
  }

  getStatus(): CpuWorkerClientStatus {
    return {
      workerActive: !!this.worker,
      permanentlyClosed: this.permanentlyClosed,
      generation: this.generation,
      pendingRequests: this.pending.size,
      requestCount: this.requestCount,
      workerCreatedCount: this.workerCreatedCount,
      restartCount: this.restartCount,
      lastError: this.lastError ? this.lastError.message : null
    };
  }

  private nextDecisionEpoch(requested: unknown): number {
    if (typeof requested === 'number' && Number.isSafeInteger(requested) && requested >= 0) {
      this.decisionEpoch = Math.max(this.decisionEpoch, requested);
      return requested;
    }
    this.decisionEpoch += 1;
    return this.decisionEpoch;
  }

  private ensureWorker(): CpuWorkerTransport {
    if (this.permanentlyClosed) {
      const error = new CpuWorkerClientError(
        'CPU Worker client is permanently closed',
        'CPU_WORKER_TERMINATED',
        false
      );
      this.lastError = error;
      throw error;
    }
    if (this.worker) return this.worker;
    let worker: CpuWorkerTransport;
    try {
      worker = this.workerFactory();
    } catch (error) {
      const normalized = normalizeError(error, 'failed to create CPU Worker', 'CPU_WORKER_UNAVAILABLE');
      this.lastError = normalized;
      throw normalized;
    }
    if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function') {
      const error = new CpuWorkerClientError('workerFactory returned an invalid Worker', 'CPU_WORKER_UNAVAILABLE', false);
      this.lastError = error;
      throw error;
    }
    this.generation += 1;
    this.workerCreatedCount += 1;
    const workerGeneration = this.generation;
    worker.onmessage = (event: MessageEvent) => this.handleMessage(event, workerGeneration);
    worker.onerror = (event: ErrorEvent) => {
      if (workerGeneration !== this.generation || this.worker !== worker) return;
      this.failWorker(makeWorkerEventError(event, 'CPU Worker crashed'));
    };
    worker.onmessageerror = () => {
      if (workerGeneration !== this.generation || this.worker !== worker) return;
      this.failWorker(new CpuWorkerClientError('CPU Worker returned an unreadable message', 'CPU_WORKER_MESSAGE_ERROR', false));
    };
    this.worker = worker;
    return worker;
  }

  private cleanupPending(pending: PendingRequest): void {
    if (pending.timeoutId !== null) this.clearTimeoutFn(pending.timeoutId);
    if (pending.abortCleanup) pending.abortCleanup();
    pending.timeoutId = null;
    pending.abortCleanup = null;
  }

  private rejectAllPending(error: Error): void {
    const entries = Array.from(this.pending.values());
    this.pending.clear();
    for (const pending of entries) {
      this.cleanupPending(pending);
      pending.reject(error);
    }
  }

  private failWorker(errorInput: unknown): void {
    const error = normalizeError(errorInput, 'CPU Worker failed', 'CPU_WORKER_CRASH');
    this.lastError = error;
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      try { worker.terminate(); } catch (terminateError) { /* ignore */ }
      this.restartCount += 1;
    }
    this.rejectAllPending(error);
  }

  private rememberIgnoredRequest(requestId: string): void {
    this.ignoredRequestIds.add(requestId);
    while (this.ignoredRequestIds.size > 256) {
      const first = this.ignoredRequestIds.values().next().value;
      if (typeof first !== 'string') break;
      this.ignoredRequestIds.delete(first);
    }
  }

  private postCancel(requestId: string): void {
    if (!this.worker) return;
    try {
      this.worker.postMessage({
        protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
        kind: 'cancel',
        requestId
      });
    } catch (error) { /* best-effort cancellation */ }
  }

  private handleMessage(event: MessageEvent, workerGeneration: number): void {
    if (workerGeneration !== this.generation || !this.worker) return;
    let response;
    try {
      response = parseCpuWorkerResponse(event && event.data);
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new CpuWorkerProtocolError('invalid CPU Worker response'));
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      if (this.ignoredRequestIds.delete(response.requestId)) return;
      this.failWorker(new CpuWorkerProtocolError(`unexpected CPU Worker response: ${response.requestId}`));
      return;
    }
    if (pending.generation !== workerGeneration || !sameCpuWorkerIdentity(pending.identity, response)) {
      this.failWorker(new CpuWorkerProtocolError(`stale or mismatched CPU Worker response: ${response.requestId}`));
      return;
    }
    this.pending.delete(response.requestId);
    this.cleanupPending(pending);
    if (response.ok) {
      this.lastError = null;
      pending.resolve(response.result);
      return;
    }
    const error = new CpuWorkerClientError(response.error.message, response.error.code, response.error.recoverable);
    this.lastError = error;
    pending.reject(error);
    if (!response.error.recoverable) this.failWorker(error);
  }

  request(
    operation: CpuWorkerOperation,
    payload: CpuWorkerRequest['payload'],
    options: CpuWorkerRequestOptions = {}
  ): Promise<CpuWorkerResult> {
    let worker: CpuWorkerTransport;
    try {
      worker = this.ensureWorker();
    } catch (error) {
      return Promise.reject(error);
    }
    const requestId = `cpu-${this.generation}-${++this.requestSequence}`;
    const request = parseCpuWorkerRequest({
      protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
      kind: 'request',
      requestId,
      operation,
      decisionEpoch: this.nextDecisionEpoch(options.decisionEpoch),
      stateVersion: normalizeStateVersion(options.stateVersion),
      turnNumber: normalizeTurnNumber(options.turnNumber),
      payload
    });
    const identity: CpuWorkerRequestIdentity = {
      protocolVersion: request.protocolVersion,
      requestId: request.requestId,
      operation: request.operation,
      decisionEpoch: request.decisionEpoch,
      stateVersion: request.stateVersion,
      turnNumber: request.turnNumber
    };
    const timeoutMs = normalizeTimeoutMs(options.timeoutMs, this.defaultTimeoutMs);
    this.requestCount += 1;

    return new Promise<CpuWorkerResult>((resolve, reject) => {
      const pending: PendingRequest = {
        identity,
        generation: this.generation,
        timeoutId: null,
        abortCleanup: null,
        resolve,
        reject
      };
      this.pending.set(requestId, pending);
      const cancelForAbort = () => {
        const current = this.pending.get(requestId);
        if (!current) return;
        this.pending.delete(requestId);
        this.cleanupPending(current);
        this.rememberIgnoredRequest(requestId);
        this.postCancel(requestId);
        current.reject(new CpuWorkerClientError('CPU Worker request was cancelled', 'CPU_WORKER_CANCELLED', true));
      };
      if (options.signal) {
        if (options.signal.aborted) {
          cancelForAbort();
          return;
        }
        options.signal.addEventListener('abort', cancelForAbort, { once: true });
        pending.abortCleanup = () => options.signal!.removeEventListener('abort', cancelForAbort);
      }
      pending.timeoutId = this.setTimeoutFn(() => {
        if (!this.pending.has(requestId)) return;
        this.postCancel(requestId);
        this.failWorker(new CpuWorkerClientError(
          `CPU Worker request timed out after ${timeoutMs}ms`,
          'CPU_WORKER_TIMEOUT',
          true
        ));
      }, timeoutMs);
      try {
        const transfer = options.transfer || collectTransferableBuffers(request.payload);
        worker.postMessage(request, transfer);
      } catch (error) {
        this.failWorker(normalizeError(error, 'failed to post CPU Worker request', 'CPU_WORKER_POST_FAILED'));
      }
    });
  }

  async probe(timeoutMs = 2000): Promise<boolean> {
    const result = await this.request(
      CPU_WORKER_OPERATIONS.PING,
      { probe: true },
      { timeoutMs }
    );
    return !!result && 'ready' in result && result.ready === true;
  }

  terminate(reason = 'CPU Worker client terminated'): void {
    this.permanentlyClosed = true;
    this.failWorker(new CpuWorkerClientError(reason, 'CPU_WORKER_TERMINATED', false));
  }

  invalidateProtocol(reason: string): CpuWorkerClientError {
    const error = new CpuWorkerClientError(reason, 'CPU_WORKER_PROTOCOL_ERROR', false);
    this.failWorker(error);
    return error;
  }
}

export interface CpuCandidateWorkerScorerOptions {
  client: CpuWorkerClient;
  timeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface CpuCandidateWorkerScoreOptions {
  signal?: AbortSignal | null;
}

export class CpuCandidateWorkerScorer {
  private readonly client: CpuWorkerClient;
  private readonly timeoutMs: number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;

  constructor(options: CpuCandidateWorkerScorerOptions) {
    if (!options || !(options.client instanceof CpuWorkerClient)) {
      throw new TypeError('CpuCandidateWorkerScorer requires a CpuWorkerClient');
    }
    this.client = options.client;
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs, 48);
    this.setTimeoutFn = (options.setTimeoutFn || setTimeout).bind(globalThis);
    this.clearTimeoutFn = (options.clearTimeoutFn || clearTimeout).bind(globalThis);
  }

  async score(
    request: CpuCandidateScoringRequest,
    options: CpuCandidateWorkerScoreOptions = {}
  ): Promise<CpuCandidateScoringBatch> {
    if (!isCpuCandidateScoringRequest(request)) {
      throw new CpuWorkerProtocolError('candidate-scoring request is invalid');
    }
    const controller = new AbortController();
    let timeoutFired = false;
    const abortFromCaller = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', abortFromCaller, { once: true });
    }
    const timeoutId = this.setTimeoutFn(() => {
      timeoutFired = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.client.request(
        CPU_WORKER_OPERATIONS.SCORE_CANDIDATES,
        { request },
        {
          decisionEpoch: request.decisionEpoch,
          stateVersion: request.stateVersion,
          turnNumber: request.turnNumber,
          timeoutMs: Math.max(1000, this.timeoutMs * 8),
          signal: controller.signal
        }
      ) as CpuCandidateScoringResponse;
      if (!verifyCpuCandidateScoringResponse(request, response)) {
        throw this.client.invalidateProtocol('candidate-scoring response does not match the request');
      }
      return { request, response };
    } catch (error) {
      if (timeoutFired) {
        throw new CpuWorkerClientError(
          `CPU candidate scoring timed out after ${this.timeoutMs}ms`,
          'CPU_WORKER_SCORE_TIMEOUT',
          true
        );
      }
      throw error;
    } finally {
      this.clearTimeoutFn(timeoutId);
      if (options.signal) options.signal.removeEventListener('abort', abortFromCaller);
    }
  }
}

export function createCpuCandidateWorkerScorer(
  options: CpuCandidateWorkerScorerOptions
): (request: CpuCandidateScoringRequest, scoreOptions?: CpuCandidateWorkerScoreOptions) => Promise<CpuCandidateScoringBatch> {
  const scorer = new CpuCandidateWorkerScorer(options);
  return scorer.score.bind(scorer);
}

export interface OnnxInferenceSessionDescriptor {
  sessionKey: string;
  inputNames: string[];
  outputNames: string[];
}

export interface OnnxWorkerInferenceExecutorOptions {
  client: CpuWorkerClient;
  baseUrl: string;
  wasmPathsUrl: string;
  createTimeoutMs?: number;
  runTimeoutMs?: number;
  allowedExecutionProviders?: Array<'webgpu' | 'wasm'>;
}

interface OnnxSessionRecipe {
  sessionKey: string;
  modelUrl: string;
  metaUrl: string;
  wasmPathsUrl: string;
  executionProviders: string[];
  remoteGeneration: number;
  descriptor: OnnxInferenceSessionDescriptor | null;
  meta: Record<string, unknown> | null;
}

function resolveAbsoluteHttpUrl(value: unknown, baseUrl: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(String(value || ''), baseUrl);
  } catch (error) {
    throw new CpuWorkerClientError(`${label} is not a valid URL`, 'CPU_WORKER_INVALID_URL', false);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CpuWorkerClientError(`${label} must use http or https`, 'CPU_WORKER_INVALID_URL', false);
  }
  return parsed.href;
}

export class OnnxWorkerInferenceExecutor {
  private readonly client: CpuWorkerClient;
  private readonly baseUrl: string;
  private readonly wasmPathsUrl: string;
  private readonly createTimeoutMs: number;
  private readonly runTimeoutMs: number;
  private readonly allowedExecutionProviders: Array<'webgpu' | 'wasm'> | null;
  private readonly recipes = new Map<string, OnnxSessionRecipe>();

  constructor(options: OnnxWorkerInferenceExecutorOptions) {
    if (!options || !(options.client instanceof CpuWorkerClient)) {
      throw new TypeError('OnnxWorkerInferenceExecutor requires a CpuWorkerClient');
    }
    this.client = options.client;
    this.baseUrl = resolveAbsoluteHttpUrl(options.baseUrl, options.baseUrl, 'baseUrl');
    this.wasmPathsUrl = resolveAbsoluteHttpUrl(options.wasmPathsUrl, this.baseUrl, 'wasmPathsUrl');
    this.createTimeoutMs = normalizeTimeoutMs(options.createTimeoutMs, 45000);
    this.runTimeoutMs = normalizeTimeoutMs(options.runTimeoutMs, 5000);
    const providers = Array.isArray(options.allowedExecutionProviders)
      ? options.allowedExecutionProviders.filter((one, index, all) => (
        (one === 'webgpu' || one === 'wasm') && all.indexOf(one) === index
      ))
      : [];
    this.allowedExecutionProviders = providers.length > 0 ? providers : null;
  }

  private async createRemoteSession(recipe: OnnxSessionRecipe): Promise<OnnxCreateSessionResult> {
    const payload: OnnxCreateSessionPayload = {
      sessionKey: recipe.sessionKey,
      modelUrl: recipe.modelUrl,
      metaUrl: recipe.metaUrl,
      wasmPathsUrl: recipe.wasmPathsUrl,
      executionProviders: recipe.executionProviders.slice()
    };
    const result = await this.client.request(
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      payload,
      { timeoutMs: this.createTimeoutMs }
    ) as OnnxCreateSessionResult;
    if (result.sessionKey !== recipe.sessionKey) {
      throw new CpuWorkerProtocolError('Worker created a different ONNX session');
    }
    recipe.remoteGeneration = this.client.getStatus().generation;
    recipe.descriptor = {
      sessionKey: result.sessionKey,
      inputNames: result.inputNames.slice(),
      outputNames: result.outputNames.slice()
    };
    recipe.meta = result.meta;
    return result;
  }

  async createSession(options: {
    sessionKey: string;
    modelUrl: string;
    metaUrl: string;
    executionProviders: string[];
  }): Promise<OnnxInferenceSessionDescriptor & { meta: Record<string, unknown> | null }> {
    const recipe: OnnxSessionRecipe = {
      sessionKey: String(options.sessionKey || '').trim(),
      modelUrl: resolveAbsoluteHttpUrl(options.modelUrl, this.baseUrl, 'modelUrl'),
      metaUrl: resolveAbsoluteHttpUrl(options.metaUrl, this.baseUrl, 'metaUrl'),
      wasmPathsUrl: this.wasmPathsUrl,
      executionProviders: this.allowedExecutionProviders
        ? this.allowedExecutionProviders.slice()
        : (Array.isArray(options.executionProviders) ? options.executionProviders.slice() : ['wasm']),
      remoteGeneration: 0,
      descriptor: null,
      meta: null
    };
    const result = await this.createRemoteSession(recipe);
    this.recipes.set(recipe.sessionKey, recipe);
    return {
      sessionKey: result.sessionKey,
      inputNames: result.inputNames.slice(),
      outputNames: result.outputNames.slice(),
      meta: result.meta
    };
  }

  private async ensureRemoteSession(sessionKey: string): Promise<OnnxSessionRecipe> {
    const recipe = this.recipes.get(sessionKey);
    if (!recipe) throw new CpuWorkerClientError(`unknown ONNX session: ${sessionKey}`, 'CPU_WORKER_UNKNOWN_SESSION', true);
    const status = this.client.getStatus();
    if (!status.workerActive || recipe.remoteGeneration !== status.generation || !recipe.descriptor) {
      await this.createRemoteSession(recipe);
    }
    return recipe;
  }

  async runSession(options: {
    session: OnnxInferenceSessionDescriptor;
    inputName: string;
    type: 'float32';
    data: Float32Array;
    dims: number[];
    decisionEpoch?: number;
    stateVersion?: CpuWorkerStateVersion;
    turnNumber?: number | null;
    signal?: AbortSignal | null;
  }): Promise<Record<string, { type: string; data: unknown; dims: number[] }>> {
    const sessionKey = String(options && options.session && options.session.sessionKey || '').trim();
    const recipe = await this.ensureRemoteSession(sessionKey);
    const copiedData = new Float32Array(options.data);
    const result = await this.client.request(
      CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION,
      {
        sessionKey: recipe.sessionKey,
        input: {
          name: options.inputName,
          type: 'float32',
          data: copiedData,
          dims: options.dims.slice()
        }
      },
      {
        decisionEpoch: options.decisionEpoch,
        stateVersion: options.stateVersion,
        turnNumber: options.turnNumber,
        timeoutMs: this.runTimeoutMs,
        signal: options.signal,
        transfer: [copiedData.buffer]
      }
    ) as OnnxRunSessionResult;
    if (result.sessionKey !== recipe.sessionKey) {
      throw new CpuWorkerProtocolError('Worker returned outputs for a different ONNX session');
    }
    const outputs: Record<string, { type: string; data: unknown; dims: number[] }> = {};
    for (const tensor of result.outputs) {
      outputs[tensor.name] = { type: tensor.type, data: tensor.data, dims: tensor.dims.slice() };
    }
    return outputs;
  }

  async releaseSession(session: OnnxInferenceSessionDescriptor | null | undefined): Promise<boolean> {
    const sessionKey = String(session && session.sessionKey || '').trim();
    if (!sessionKey) return false;
    this.recipes.delete(sessionKey);
    if (!this.client.getStatus().workerActive) return false;
    const result = await this.client.request(
      CPU_WORKER_OPERATIONS.ONNX_RELEASE_SESSION,
      { sessionKey },
      { timeoutMs: Math.min(this.runTimeoutMs, 2000) }
    ) as OnnxReleaseSessionResult;
    return result.sessionKey === sessionKey && result.released;
  }
}

export function createCpuWorkerClient(options: CpuWorkerClientOptions): CpuWorkerClient {
  return new CpuWorkerClient(options);
}

export function createOnnxWorkerInferenceExecutor(
  options: OnnxWorkerInferenceExecutorOptions
): OnnxWorkerInferenceExecutor {
  return new OnnxWorkerInferenceExecutor(options);
}
