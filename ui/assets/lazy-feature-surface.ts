import {
  discardFeatureStylesheet,
  ensureFeatureStylesheet,
  type FeatureStylesheetGroup,
  type FeatureStylesheetLoadResult
} from './feature-stylesheet-loader';

export type LazyFeatureSurfaceStatus = 'idle' | 'pending' | 'ready' | 'failed';

export interface LazyFeatureSurfaceContext {
  readonly id: string;
  readonly document: Document;
  readonly attempt: number;
  readonly signal: AbortSignal;
  addCleanup(cleanup: () => void): void;
  recordDomCreated(count?: number): void;
  recordListenerBinding(count?: number): void;
}

export interface ReadySurface<T = unknown> {
  readonly id: string;
  readonly document: Document;
  readonly attempt: number;
  readonly dom: T;
  readonly stylesheet: FeatureStylesheetLoadResult | null;
  readonly stylesheets: readonly FeatureStylesheetLoadResult[];
}

export interface LazyFeatureSurfaceRegistration<T = unknown> {
  readonly id: string;
  readonly stylesheetGroup?: FeatureStylesheetGroup | null;
  readonly stylesheetGroups?: readonly FeatureStylesheetGroup[];
  readonly ensureDom: (
    context: LazyFeatureSurfaceContext
  ) => T | Promise<T>;
  readonly onReady?: (
    surface: ReadySurface<T>,
    context: LazyFeatureSurfaceContext
  ) => void | Promise<void>;
  readonly onFailure?: (
    error: Error,
    context: LazyFeatureSurfaceContext
  ) => void | Promise<void>;
}

export interface LazyFeatureSurfaceDiagnostics {
  readonly id: string;
  readonly status: LazyFeatureSurfaceStatus;
  readonly ensureCount: number;
  readonly attemptCount: number;
  readonly concurrentJoinCount: number;
  readonly retryCount: number;
  readonly stylesheetEnsureCount: number;
  readonly domEnsureCount: number;
  readonly domCreatedCount: number;
  readonly listenerBindingCount: number;
  readonly cleanupCount: number;
  readonly readyCount: number;
  readonly failureCount: number;
}

interface MutableDiagnostics {
  status: LazyFeatureSurfaceStatus;
  ensureCount: number;
  attemptCount: number;
  concurrentJoinCount: number;
  retryCount: number;
  stylesheetEnsureCount: number;
  domEnsureCount: number;
  domCreatedCount: number;
  listenerBindingCount: number;
  cleanupCount: number;
  readyCount: number;
  failureCount: number;
}

interface DocumentSurfaceState<T = unknown> {
  status: LazyFeatureSurfaceStatus;
  attempt: number;
  promise: Promise<ReadySurface<T>> | null;
  ready: ReadySurface<T> | null;
  diagnostics: MutableDiagnostics | null;
}

const registrations = new Map<string, LazyFeatureSurfaceRegistration<any>>();
const documentStates =
  new WeakMap<Document, Map<string, DocumentSurfaceState<any>>>();

function normalizeId(value: string): string {
  return String(value || '').trim();
}

function resolveDocument(docRef?: Document | null): Document | null {
  if (docRef && docRef.head && typeof docRef.createElement === 'function') {
    return docRef;
  }
  try {
    if (typeof document !== 'undefined') return document;
  } catch (_error) {
    // Headless callers must provide a Document.
  }
  return null;
}

function diagnosticsEnabled(documentRef: Document): boolean {
  try {
    const root = documentRef.defaultView as (Window & {
      DEBUG_MODE_ALLOWED?: boolean;
    }) | null;
    if (root?.DEBUG_MODE_ALLOWED === true) return true;
    const params = new URLSearchParams(root?.location?.search || '');
    return params.get('debug') === '1' && params.get('uxMonitor') === '1';
  } catch (_error) {
    return false;
  }
}

function createDiagnostics(): MutableDiagnostics {
  return {
    status: 'idle',
    ensureCount: 0,
    attemptCount: 0,
    concurrentJoinCount: 0,
    retryCount: 0,
    stylesheetEnsureCount: 0,
    domEnsureCount: 0,
    domCreatedCount: 0,
    listenerBindingCount: 0,
    cleanupCount: 0,
    readyCount: 0,
    failureCount: 0
  };
}

function getDocumentState<T>(
  documentRef: Document,
  id: string,
  create: boolean
): DocumentSurfaceState<T> | null {
  let states = documentStates.get(documentRef);
  if (!states && create) {
    states = new Map();
    documentStates.set(documentRef, states);
  }
  let state = states?.get(id) as DocumentSurfaceState<T> | undefined;
  if (!state && create) {
    state = {
      status: 'idle',
      attempt: 0,
      promise: null,
      ready: null,
      diagnostics: diagnosticsEnabled(documentRef) ? createDiagnostics() : null
    };
    states!.set(id, state);
  }
  return state || null;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(error == null ? fallback : String(error));
}

function runCleanups(
  cleanups: Array<() => void>,
  diagnostics: MutableDiagnostics | null
): void {
  for (let index = cleanups.length - 1; index >= 0; index -= 1) {
    try {
      cleanups[index]();
    } catch (_error) {
      // Cleanup is best-effort; the original preparation error stays authoritative.
    }
    if (diagnostics) diagnostics.cleanupCount += 1;
  }
  cleanups.length = 0;
}

export function registerLazyFeatureSurface<T>(
  registration: LazyFeatureSurfaceRegistration<T>
): void {
  const id = normalizeId(registration?.id);
  if (!id) throw new Error('lazy feature surface id is required');
  if (!registration || typeof registration.ensureDom !== 'function') {
    throw new Error(`lazy feature surface ${id} requires ensureDom`);
  }
  const existing = registrations.get(id);
  if (existing && existing !== registration) {
    throw new Error(`lazy feature surface ${id} is already registered`);
  }
  registrations.set(id, registration);
}

export function ensureLazyFeatureSurface<T = unknown>(
  idValue: string,
  docRef?: Document | null
): Promise<ReadySurface<T>> {
  const id = normalizeId(idValue);
  const registration = registrations.get(id) as
    | LazyFeatureSurfaceRegistration<T>
    | undefined;
  if (!registration) {
    return Promise.reject(new Error(`lazy feature surface ${id || '<empty>'} is not registered`));
  }
  const documentRef = resolveDocument(docRef);
  if (!documentRef) {
    return Promise.reject(new Error(`lazy feature surface ${id} requires a Document`));
  }
  const state = getDocumentState<T>(documentRef, id, true)!;
  const diagnostics = state.diagnostics;
  if (diagnostics) diagnostics.ensureCount += 1;
  if (state.status === 'ready' && state.ready) {
    return Promise.resolve(state.ready);
  }
  if (state.status === 'pending' && state.promise) {
    if (diagnostics) diagnostics.concurrentJoinCount += 1;
    return state.promise;
  }

  state.attempt += 1;
  state.status = 'pending';
  state.ready = null;
  if (diagnostics) {
    diagnostics.status = 'pending';
    diagnostics.attemptCount += 1;
    if (state.attempt > 1) diagnostics.retryCount += 1;
  }

  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  const context: LazyFeatureSurfaceContext = {
    id,
    document: documentRef,
    attempt: state.attempt,
    signal: controller.signal,
    addCleanup(cleanup) {
      if (typeof cleanup !== 'function') {
        throw new Error(`lazy feature surface ${id} cleanup must be a function`);
      }
      cleanups.push(cleanup);
    },
    recordDomCreated(count = 1) {
      if (diagnostics) diagnostics.domCreatedCount += Math.max(0, Number(count) || 0);
    },
    recordListenerBinding(count = 1) {
      if (diagnostics) diagnostics.listenerBindingCount += Math.max(0, Number(count) || 0);
    }
  };

  const stylesheetGroups = Array.from(new Set(
    registration.stylesheetGroups?.length
      ? registration.stylesheetGroups
      : (registration.stylesheetGroup ? [registration.stylesheetGroup] : [])
  ));
  const stylesheetPromise = Promise.all(stylesheetGroups.map((group) => {
    if (diagnostics) diagnostics.stylesheetEnsureCount += 1;
    return ensureFeatureStylesheet(group, documentRef).then((stylesheet) => {
      if (stylesheet.ok !== true) {
        throw new Error(
          stylesheet.warning || `lazy feature surface ${id} stylesheet failed`
        );
      }
      return stylesheet;
    });
  }));
  if (diagnostics) diagnostics.domEnsureCount += 1;
  let domPromise: Promise<T>;
  try {
    domPromise = Promise.resolve(registration.ensureDom(context));
  } catch (error) {
    domPromise = Promise.reject(error);
  }

  const pending = Promise.all([stylesheetPromise, domPromise])
    .then(async ([stylesheets, dom]) => {
      const ready = Object.freeze({
        id,
        document: documentRef,
        attempt: state.attempt,
        dom,
        stylesheet: stylesheets[0] || null,
        stylesheets: Object.freeze(stylesheets.slice())
      }) as ReadySurface<T>;
      if (registration.onReady) await registration.onReady(ready, context);
      state.status = 'ready';
      state.ready = ready;
      if (diagnostics) {
        diagnostics.status = 'ready';
        diagnostics.readyCount += 1;
      }
      return ready;
    })
    .catch(async (failure: unknown) => {
      const error = toError(failure, `lazy feature surface ${id} failed`);
      controller.abort();
      runCleanups(cleanups, diagnostics);
      for (const group of stylesheetGroups) {
        discardFeatureStylesheet(group, documentRef);
      }
      state.status = 'failed';
      state.ready = null;
      if (diagnostics) {
        diagnostics.status = 'failed';
        diagnostics.failureCount += 1;
      }
      if (registration.onFailure) {
        try {
          await registration.onFailure(error, context);
        } catch (_onFailureError) {
          // Failure presentation cannot turn a failed preparation into success.
        }
      }
      throw error;
    })
    .finally(() => {
      if (state.promise === pending) state.promise = null;
    });
  state.promise = pending;
  return pending;
}

export function getLazyFeatureSurfaceDiagnostics(
  idValue: string,
  docRef?: Document | null
): LazyFeatureSurfaceDiagnostics | null {
  const id = normalizeId(idValue);
  const documentRef = resolveDocument(docRef);
  if (!id || !documentRef || !diagnosticsEnabled(documentRef)) return null;
  const state = getDocumentState(documentRef, id, false);
  const diagnostics = state?.diagnostics || createDiagnostics();
  return Object.freeze({
    id,
    status: diagnostics.status,
    ensureCount: diagnostics.ensureCount,
    attemptCount: diagnostics.attemptCount,
    concurrentJoinCount: diagnostics.concurrentJoinCount,
    retryCount: diagnostics.retryCount,
    stylesheetEnsureCount: diagnostics.stylesheetEnsureCount,
    domEnsureCount: diagnostics.domEnsureCount,
    domCreatedCount: diagnostics.domCreatedCount,
    listenerBindingCount: diagnostics.listenerBindingCount,
    cleanupCount: diagnostics.cleanupCount,
    readyCount: diagnostics.readyCount,
    failureCount: diagnostics.failureCount
  });
}

const LazyFeatureSurface = {
  registerLazyFeatureSurface,
  ensureLazyFeatureSurface,
  getLazyFeatureSurfaceDiagnostics
};

export default LazyFeatureSurface;
