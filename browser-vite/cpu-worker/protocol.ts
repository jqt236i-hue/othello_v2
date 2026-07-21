import {
  isCpuCandidateScoringRequest,
  isCpuCandidateScoringResponse,
  type CpuCandidateScoringRequest,
  type CpuCandidateScoringResponse
} from '../../game/ai/cpu-candidate-scoring';
import {
  parseCpuCardQuiescenceRequest,
  parseCpuCardQuiescenceResponse,
  type CpuCardQuiescenceRequest,
  type CpuCardQuiescenceResponse
} from '../../game/ai/cpu-card-quiescence';

export const CPU_WORKER_PROTOCOL_VERSION = 1 as const;

export const CPU_WORKER_OPERATIONS = Object.freeze({
  PING: 'worker.ping',
  SCORE_CANDIDATES: 'cpu.score-candidates',
  CARD_QUIESCENCE: 'cpu.card-quiescence',
  ONNX_CREATE_SESSION: 'onnx.create-session',
  ONNX_RUN_SESSION: 'onnx.run-session',
  ONNX_RELEASE_SESSION: 'onnx.release-session'
} as const);

export type CpuWorkerOperation = typeof CPU_WORKER_OPERATIONS[keyof typeof CPU_WORKER_OPERATIONS];
export type CpuWorkerStateVersion = string | number | null;

export interface CpuWorkerRequestIdentity {
  protocolVersion: typeof CPU_WORKER_PROTOCOL_VERSION;
  requestId: string;
  operation: CpuWorkerOperation;
  decisionEpoch: number;
  stateVersion: CpuWorkerStateVersion;
  turnNumber: number | null;
}

export interface OnnxCreateSessionPayload {
  sessionKey: string;
  modelUrl: string;
  metaUrl: string;
  wasmPathsUrl: string;
  executionProviders: string[];
}

export interface CpuWorkerPingPayload {
  probe: true;
}

export interface CpuCandidateScoringPayload {
  request: CpuCandidateScoringRequest;
}

export interface CpuCardQuiescencePayload {
  request: CpuCardQuiescenceRequest;
}

export interface OnnxRunSessionPayload {
  sessionKey: string;
  input: {
    name: string;
    type: 'float32';
    data: Float32Array;
    dims: number[];
  };
}

export interface OnnxReleaseSessionPayload {
  sessionKey: string;
}

export type CpuWorkerRequest = CpuWorkerRequestIdentity & {
  kind: 'request';
  payload:
    CpuWorkerPingPayload |
    CpuCandidateScoringPayload |
    CpuCardQuiescencePayload |
    OnnxCreateSessionPayload |
    OnnxRunSessionPayload |
    OnnxReleaseSessionPayload;
};

export interface CpuWorkerCancelMessage {
  protocolVersion: typeof CPU_WORKER_PROTOCOL_VERSION;
  kind: 'cancel';
  requestId: string;
}

export interface OnnxCreateSessionResult {
  sessionKey: string;
  inputNames: string[];
  outputNames: string[];
  meta: Record<string, unknown> | null;
  executionProviders: string[];
}

export interface OnnxOutputTensor {
  name: string;
  type: string;
  data: SupportedNumericTypedArray;
  dims: number[];
}

export interface OnnxRunSessionResult {
  sessionKey: string;
  outputs: OnnxOutputTensor[];
}

export interface OnnxReleaseSessionResult {
  sessionKey: string;
  released: boolean;
}

export interface CpuWorkerPingResult {
  ready: true;
}

export type CpuWorkerResult =
  CpuWorkerPingResult |
  CpuCandidateScoringResponse |
  CpuCardQuiescenceResponse |
  OnnxCreateSessionResult |
  OnnxRunSessionResult |
  OnnxReleaseSessionResult;

export interface CpuWorkerSuccessResponse extends CpuWorkerRequestIdentity {
  kind: 'response';
  ok: true;
  result: CpuWorkerResult;
}

export interface CpuWorkerErrorResponse extends CpuWorkerRequestIdentity {
  kind: 'response';
  ok: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export type CpuWorkerResponse = CpuWorkerSuccessResponse | CpuWorkerErrorResponse;

export type SupportedNumericTypedArray =
  Float32Array |
  Float64Array |
  Int8Array |
  Uint8Array |
  Uint8ClampedArray |
  Int16Array |
  Uint16Array |
  Int32Array |
  Uint32Array;

const MAX_REQUEST_ID_LENGTH = 128;
const MAX_SESSION_KEY_LENGTH = 96;
const MAX_TENSOR_NAME_LENGTH = 256;
const MAX_ERROR_MESSAGE_LENGTH = 2048;
const MAX_META_JSON_LENGTH = 2 * 1024 * 1024;
const MAX_TENSOR_ELEMENTS = 16 * 1024 * 1024;
const ALLOWED_PROVIDERS = new Set(['webgpu', 'wasm']);
const OPERATIONS = new Set<CpuWorkerOperation>(Object.values(CPU_WORKER_OPERATIONS));

export class CpuWorkerProtocolError extends Error {
  readonly code: string;

  constructor(message: string, code = 'CPU_WORKER_PROTOCOL_ERROR') {
    super(message);
    this.name = 'CpuWorkerProtocolError';
    this.code = code;
  }
}

function fail(message: string): never {
  throw new CpuWorkerProtocolError(message);
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readBoundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) fail(`${label} is invalid`);
  return normalized;
}

function readSafeInteger(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) fail(`${label} must be a non-negative safe integer`);
  return Number(value);
}

function readStateVersion(value: unknown): CpuWorkerStateVersion {
  if (value === null) return null;
  if (typeof value === 'string') {
    if (!value || value.length > 256) fail('stateVersion is invalid');
    return value;
  }
  if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
  fail('stateVersion is invalid');
}

function readOperation(value: unknown): CpuWorkerOperation {
  if (typeof value !== 'string' || !OPERATIONS.has(value as CpuWorkerOperation)) {
    fail(`unknown CPU Worker operation: ${String(value || '(empty)')}`);
  }
  return value as CpuWorkerOperation;
}

function readAbsoluteHttpUrl(value: unknown, label: string): string {
  const normalized = readBoundedString(value, label, 4096);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch (error) {
    fail(`${label} must be an absolute URL`);
  }
  if (parsed!.protocol !== 'http:' && parsed!.protocol !== 'https:') {
    fail(`${label} must use http or https`);
  }
  return parsed!.href;
}

function readStringList(value: unknown, label: string, maxItems = 32): string[] {
  if (!Array.isArray(value) || value.length > maxItems) fail(`${label} must be a bounded array`);
  return value.map((item, index) => readBoundedString(item, `${label}[${index}]`, MAX_TENSOR_NAME_LENGTH));
}

function readExecutionProviders(value: unknown): string[] {
  const providers = readStringList(value, 'executionProviders', 2);
  if (providers.length <= 0) fail('executionProviders must not be empty');
  for (const provider of providers) {
    if (!ALLOWED_PROVIDERS.has(provider)) fail(`unsupported execution provider: ${provider}`);
  }
  if (new Set(providers).size !== providers.length) fail('executionProviders must not contain duplicates');
  return providers;
}

function readDims(value: unknown, dataLength: number): number[] {
  if (!Array.isArray(value) || value.length <= 0 || value.length > 8) fail('tensor dims are invalid');
  const dims = value.map((one, index) => {
    if (!Number.isSafeInteger(one) || Number(one) <= 0) fail(`tensor dims[${index}] is invalid`);
    return Number(one);
  });
  const elements = dims.reduce((product, one) => product * one, 1);
  if (!Number.isSafeInteger(elements) || elements > MAX_TENSOR_ELEMENTS || elements !== dataLength) {
    fail('tensor shape does not match its data length');
  }
  return dims;
}

export function isSupportedNumericTypedArray(value: unknown): value is SupportedNumericTypedArray {
  return value instanceof Float32Array ||
    value instanceof Float64Array ||
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array;
}

function readRequestIdentity(value: Record<string, any>): CpuWorkerRequestIdentity {
  if (value.protocolVersion !== CPU_WORKER_PROTOCOL_VERSION) fail('unsupported CPU Worker protocol version');
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    requestId: readBoundedString(value.requestId, 'requestId', MAX_REQUEST_ID_LENGTH),
    operation: readOperation(value.operation),
    decisionEpoch: readSafeInteger(value.decisionEpoch, 'decisionEpoch') as number,
    stateVersion: readStateVersion(value.stateVersion),
    turnNumber: readSafeInteger(value.turnNumber, 'turnNumber', true)
  };
}

function parseCreateSessionPayload(value: unknown): OnnxCreateSessionPayload {
  if (!isRecord(value)) fail('create-session payload must be an object');
  return {
    sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH),
    modelUrl: readAbsoluteHttpUrl(value.modelUrl, 'modelUrl'),
    metaUrl: readAbsoluteHttpUrl(value.metaUrl, 'metaUrl'),
    wasmPathsUrl: readAbsoluteHttpUrl(value.wasmPathsUrl, 'wasmPathsUrl'),
    executionProviders: readExecutionProviders(value.executionProviders)
  };
}

function parsePingPayload(value: unknown): CpuWorkerPingPayload {
  if (!isRecord(value) || value.probe !== true) fail('ping payload is invalid');
  return { probe: true };
}

function parseCandidateScoringPayload(
  value: unknown,
  identity: CpuWorkerRequestIdentity
): CpuCandidateScoringPayload {
  if (!isRecord(value) || !isCpuCandidateScoringRequest(value.request)) {
    fail('candidate-scoring payload is invalid');
  }
  const request = value.request;
  if (
    request.decisionEpoch !== identity.decisionEpoch ||
    request.stateVersion !== identity.stateVersion ||
    request.turnNumber !== identity.turnNumber
  ) {
    fail('candidate-scoring payload identity does not match its Worker envelope');
  }
  return { request };
}

function parseCardQuiescencePayload(
  value: unknown,
  identity: CpuWorkerRequestIdentity
): CpuCardQuiescencePayload {
  if (!isRecord(value)) fail('card-quiescence payload is invalid');
  const request = parseCpuCardQuiescenceRequest(value.request);
  if (
    request.decisionEpoch !== identity.decisionEpoch
    || request.stateVersion !== identity.stateVersion
    || request.turnNumber !== identity.turnNumber
  ) {
    fail('card-quiescence payload identity does not match its Worker envelope');
  }
  return { request };
}

function parseRunSessionPayload(value: unknown): OnnxRunSessionPayload {
  if (!isRecord(value) || !isRecord(value.input)) fail('run-session payload must contain an input tensor');
  if (value.input.type !== 'float32' || !(value.input.data instanceof Float32Array)) {
    fail('run-session input must be a Float32Array tensor');
  }
  if (value.input.data.length > MAX_TENSOR_ELEMENTS) fail('run-session input is too large');
  return {
    sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH),
    input: {
      name: readBoundedString(value.input.name, 'input.name', MAX_TENSOR_NAME_LENGTH),
      type: 'float32',
      data: value.input.data,
      dims: readDims(value.input.dims, value.input.data.length)
    }
  };
}

function parseReleaseSessionPayload(value: unknown): OnnxReleaseSessionPayload {
  if (!isRecord(value)) fail('release-session payload must be an object');
  return { sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH) };
}

export function parseCpuWorkerRequest(value: unknown): CpuWorkerRequest {
  if (!isRecord(value) || value.kind !== 'request') fail('invalid CPU Worker request envelope');
  const identity = readRequestIdentity(value);
  let payload: CpuWorkerRequest['payload'];
  if (identity.operation === CPU_WORKER_OPERATIONS.PING) {
    payload = parsePingPayload(value.payload);
  } else if (identity.operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES) {
    payload = parseCandidateScoringPayload(value.payload, identity);
  } else if (identity.operation === CPU_WORKER_OPERATIONS.CARD_QUIESCENCE) {
    payload = parseCardQuiescencePayload(value.payload, identity);
  } else if (identity.operation === CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION) {
    payload = parseCreateSessionPayload(value.payload);
  } else if (identity.operation === CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION) {
    payload = parseRunSessionPayload(value.payload);
  } else {
    payload = parseReleaseSessionPayload(value.payload);
  }
  return Object.assign({ kind: 'request' as const }, identity, { payload });
}

export function parseCpuWorkerCancel(value: unknown): CpuWorkerCancelMessage {
  if (!isRecord(value) || value.kind !== 'cancel' || value.protocolVersion !== CPU_WORKER_PROTOCOL_VERSION) {
    fail('invalid CPU Worker cancel envelope');
  }
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    kind: 'cancel',
    requestId: readBoundedString(value.requestId, 'requestId', MAX_REQUEST_ID_LENGTH)
  };
}

function parseMeta(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!isRecord(value)) fail('session metadata must be an object or null');
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    fail('session metadata must be JSON-serializable');
  }
  if (json!.length > MAX_META_JSON_LENGTH) fail('session metadata is too large');
  return value;
}

function parseCreateSessionResult(value: unknown): OnnxCreateSessionResult {
  if (!isRecord(value)) fail('create-session result must be an object');
  return {
    sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH),
    inputNames: readStringList(value.inputNames, 'inputNames'),
    outputNames: readStringList(value.outputNames, 'outputNames'),
    meta: parseMeta(value.meta),
    executionProviders: readExecutionProviders(value.executionProviders)
  };
}

function parseOutputTensor(value: unknown, index: number): OnnxOutputTensor {
  if (!isRecord(value) || !isSupportedNumericTypedArray(value.data)) {
    fail(`outputs[${index}] must contain a supported numeric typed array`);
  }
  if (value.data.length > MAX_TENSOR_ELEMENTS) fail(`outputs[${index}] is too large`);
  return {
    name: readBoundedString(value.name, `outputs[${index}].name`, MAX_TENSOR_NAME_LENGTH),
    type: readBoundedString(value.type, `outputs[${index}].type`, 32),
    data: value.data,
    dims: readDims(value.dims, value.data.length)
  };
}

function parseRunSessionResult(value: unknown): OnnxRunSessionResult {
  if (!isRecord(value) || !Array.isArray(value.outputs) || value.outputs.length > 32) {
    fail('run-session result must contain a bounded outputs array');
  }
  return {
    sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH),
    outputs: value.outputs.map(parseOutputTensor)
  };
}

function parseReleaseSessionResult(value: unknown): OnnxReleaseSessionResult {
  if (!isRecord(value) || typeof value.released !== 'boolean') fail('release-session result is invalid');
  return {
    sessionKey: readBoundedString(value.sessionKey, 'sessionKey', MAX_SESSION_KEY_LENGTH),
    released: value.released
  };
}

function parsePingResult(value: unknown): CpuWorkerPingResult {
  if (!isRecord(value) || value.ready !== true) fail('ping result is invalid');
  return { ready: true };
}

function parseCandidateScoringResult(value: unknown): CpuCandidateScoringResponse {
  if (!isCpuCandidateScoringResponse(value)) fail('candidate-scoring result is invalid');
  return value;
}

function parseCardQuiescenceResult(value: unknown): CpuCardQuiescenceResponse {
  return parseCpuCardQuiescenceResponse(value);
}

function parseResponseResult(operation: CpuWorkerOperation, value: unknown): CpuWorkerResult {
  if (operation === CPU_WORKER_OPERATIONS.PING) return parsePingResult(value);
  if (operation === CPU_WORKER_OPERATIONS.SCORE_CANDIDATES) return parseCandidateScoringResult(value);
  if (operation === CPU_WORKER_OPERATIONS.CARD_QUIESCENCE) return parseCardQuiescenceResult(value);
  if (operation === CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION) return parseCreateSessionResult(value);
  if (operation === CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION) return parseRunSessionResult(value);
  return parseReleaseSessionResult(value);
}

export function parseCpuWorkerResponse(value: unknown): CpuWorkerResponse {
  if (!isRecord(value) || value.kind !== 'response' || typeof value.ok !== 'boolean') {
    fail('invalid CPU Worker response envelope');
  }
  const identity = readRequestIdentity(value);
  if (value.ok === true) {
    return Object.assign({ kind: 'response' as const, ok: true as const }, identity, {
      result: parseResponseResult(identity.operation, value.result)
    });
  }
  if (!isRecord(value.error) || typeof value.error.recoverable !== 'boolean') {
    fail('invalid CPU Worker error response');
  }
  return Object.assign({ kind: 'response' as const, ok: false as const }, identity, {
    error: {
      code: readBoundedString(value.error.code, 'error.code', 128),
      message: readBoundedString(value.error.message, 'error.message', MAX_ERROR_MESSAGE_LENGTH),
      recoverable: value.error.recoverable
    }
  });
}

export function sameCpuWorkerIdentity(
  expected: CpuWorkerRequestIdentity,
  actual: CpuWorkerRequestIdentity
): boolean {
  return expected.requestId === actual.requestId &&
    expected.operation === actual.operation &&
    expected.decisionEpoch === actual.decisionEpoch &&
    expected.stateVersion === actual.stateVersion &&
    expected.turnNumber === actual.turnNumber;
}

export function collectTransferableBuffers(value: unknown): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  const seen = new Set<ArrayBuffer>();
  const isArrayBufferValue = (candidate: unknown): candidate is ArrayBuffer => (
    candidate instanceof ArrayBuffer || Object.prototype.toString.call(candidate) === '[object ArrayBuffer]'
  );
  const visit = (current: unknown) => {
    if (!current) return;
    if (ArrayBuffer.isView(current)) {
      const buffer = current.buffer;
      if (isArrayBufferValue(buffer) && !seen.has(buffer)) {
        seen.add(buffer);
        out.push(buffer);
      }
      return;
    }
    if (isArrayBufferValue(current)) {
      if (!seen.has(current)) {
        seen.add(current);
        out.push(current);
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (isRecord(current)) Object.values(current).forEach(visit);
  };
  visit(value);
  return out;
}
