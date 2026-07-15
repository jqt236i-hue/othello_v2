import PixiRuntimeContract = require('./runtime-contract');

export type PixiTextureSourceKind = 'built-in' | 'custom' | 'procedural';
export type PixiPreparedTextureSetState = 'prepared' | 'active' | 'released';

export interface PixiTextureUpload {
  readonly texture: unknown;
  readonly width?: number;
  readonly height?: number;
  /** Whether the manager may destroy this upload when its last lease ends. */
  readonly owned?: boolean;
  readonly destroy?: () => void;
}

export interface PixiTextureBitmap {
  readonly width: number;
  readonly height: number;
  close?: () => void;
}

/**
 * Narrow boundary over Pixi v8 and browser bitmap APIs. Tests deliberately use
 * this contract instead of constructing a WebGL context.
 */
export interface PixiTextureManagerRuntime {
  loadTexture(absoluteUrl: string, purpose: string): Promise<PixiTextureUpload>;
  createTextureFromBitmap(
    bitmap: PixiTextureBitmap,
    purpose: string
  ): Promise<PixiTextureUpload> | PixiTextureUpload;
  createProceduralTexture(purpose: string, fallbackId: string): Promise<PixiTextureUpload> | PixiTextureUpload;
  createImageBitmap(
    source: Blob | PixiTextureBitmap,
    options?: Readonly<Record<string, unknown>>
  ): Promise<PixiTextureBitmap>;
  destroyTexture?(texture: unknown): void;
  closeImageBitmap?(bitmap: PixiTextureBitmap): void;
  /** Return gl.getParameter(gl.MAX_TEXTURE_SIZE) for the active renderer. */
  getMaxTextureSize?(): number;
}

export interface PixiTextureFallbackDescriptor {
  readonly kind: 'built-in' | 'procedural';
  readonly url?: string | null;
  readonly id?: string | null;
  readonly contentFingerprint?: string | null;
}

export interface PixiTextureRequest {
  readonly purpose: string;
  readonly kind?: PixiTextureSourceKind;
  readonly url?: string | null;
  readonly sourceBlob?: Blob | null;
  readonly contentFingerprint?: string | null;
  readonly maxPhysicalWidth?: number | null;
  readonly maxPhysicalHeight?: number | null;
  readonly fallback?: PixiTextureFallbackDescriptor | null;
}

export interface PixiTextureSourceLease {
  release(): boolean | void;
}

export interface PixiTexturePrepareOptions {
  /**
   * Ownership transfers to the prepared set. It is released only after every
   * texture derived from the set has released its final manager lease.
   */
  readonly sourceLease?: PixiTextureSourceLease | null;
}

export interface PixiManagedTexture {
  readonly key: string;
  readonly sourceKey: string;
  readonly purpose: string;
  readonly requestedUrl: string | null;
  readonly resolvedUrl: string | null;
  readonly sourceKind: PixiTextureSourceKind;
  readonly texture: unknown;
  readonly width: number | null;
  readonly height: number | null;
  readonly usedFallback: boolean;
  readonly downsampled: boolean;
}

export interface PixiCommittedTextureSet {
  readonly id: string;
  readonly generation: number;
  readonly resources: readonly PixiManagedTexture[];
  get(purpose: string): PixiManagedTexture | null;
}

export interface PixiPreparedTextureSet {
  readonly id: string;
  readonly state: PixiPreparedTextureSetState;
  readonly resources: readonly PixiManagedTexture[];
  get(purpose: string): PixiManagedTexture | null;
  release(): boolean;
}

export interface PixiTextureLease {
  readonly resource: PixiManagedTexture;
  readonly released: boolean;
  release(): boolean;
}

export interface PixiTextureManagerDiagnostics {
  readonly state: 'ready' | 'destroyed';
  readonly baseUri: string | null;
  readonly maxTextureSize: number;
  readonly cacheEntryCount: number;
  readonly readyResourceCount: number;
  readonly pendingLoadCount: number;
  readonly referenceCount: number;
  readonly preparedSetCount: number;
  readonly activeSetId: string | null;
  readonly externalLeaseCount: number;
  readonly sourceLeaseCount: number;
  readonly loadStartCount: number;
  readonly dedupeHitCount: number;
  readonly uploadCount: number;
  readonly fallbackCount: number;
  readonly failureCount: number;
  readonly derivedBitmapCount: number;
  readonly downsampledBitmapCount: number;
  readonly closedBitmapCount: number;
  readonly destroyedTextureCount: number;
  readonly destroyFailureCount: number;
  readonly commitCount: number;
  readonly lastFailureCode: string | null;
}

export interface PixiTextureManagerOptions {
  readonly runtime?: PixiTextureManagerRuntime;
  readonly pixiRuntime?: any;
  readonly root?: Record<string, any> | null;
  readonly documentRef?: Pick<Document, 'baseURI' | 'createElement'> | null;
  readonly baseUri?: string | null;
  /**
   * Physical upload ceiling supplied by the board backend from its active
   * renderer. The manager still takes the minimum with runtime MAX_TEXTURE_SIZE.
   */
  readonly maxTextureSize?: number | null;
}

export interface PixiTextureManager {
  prepare(
    id: string,
    requests: readonly PixiTextureRequest[],
    options?: PixiTexturePrepareOptions
  ): Promise<PixiPreparedTextureSet>;
  commit(
    prepared: PixiPreparedTextureSet,
    apply?: (next: PixiCommittedTextureSet) => void
  ): PixiCommittedTextureSet;
  getActive(): PixiCommittedTextureSet | null;
  acquireActive(purpose: string): PixiTextureLease;
  releaseActive(): boolean;
  getDiagnostics(): PixiTextureManagerDiagnostics;
  destroy(): void;
}

export class PixiTextureManagerError extends Error {
  readonly code: string;
  readonly detail: unknown;

  constructor(message: string, code: string, detail?: unknown) {
    super(message);
    this.name = 'PixiTextureManagerError';
    this.code = code;
    this.detail = detail;
  }
}

interface NormalizedRequest {
  readonly purpose: string;
  readonly kind: PixiTextureSourceKind;
  readonly absoluteUrl: string | null;
  readonly sourceBlob: Blob | null;
  readonly contentFingerprint: string;
  readonly maxPhysicalWidth: number;
  readonly maxPhysicalHeight: number;
  readonly fallback: PixiTextureFallbackDescriptor | null;
}

interface LoadedResource {
  readonly texture: unknown;
  readonly width: number | null;
  readonly height: number | null;
  readonly downsampled: boolean;
  destroy(): void;
}

interface CacheEntry {
  readonly key: string;
  readonly promise: Promise<LoadedResource>;
  refCount: number;
  state: 'loading' | 'ready' | 'failed' | 'destroyed';
  resource: LoadedResource | null;
}

interface PreparedBinding {
  readonly entry: CacheEntry;
  readonly resource: PixiManagedTexture;
}

interface BatchRecord {
  readonly id: string;
  readonly bindings: readonly PreparedBinding[];
  readonly publicSet: PixiPreparedTextureSet;
  readonly resourcesByPurpose: ReadonlyMap<string, PixiManagedTexture>;
  sourceLease: PixiTextureSourceLease | null;
  sourceLeaseReleased: boolean;
  externalRefCount: number;
  resourcesReleased: boolean;
  state: PixiPreparedTextureSetState;
  generation: number;
  committedSnapshot: PixiCommittedTextureSet | null;
}

interface ExternalLeaseRecord {
  readonly entry: CacheEntry;
  readonly batch: BatchRecord;
  readonly publicLease: PixiTextureLease;
  released: boolean;
}

const DEFAULT_MAX_TEXTURE_SIZE = 4096;

function errorOf(error: unknown, fallbackCode: string, message: string): PixiTextureManagerError {
  if (error instanceof PixiTextureManagerError) return error;
  const detailMessage = error instanceof Error ? String(error.message || '').trim() : '';
  return new PixiTextureManagerError(
    detailMessage ? `${message}: ${detailMessage}` : message,
    fallbackCode,
    error
  );
}

function positiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.floor(numeric));
}

function optionalDimension(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizePurpose(value: unknown): string {
  const purpose = String(value || '').trim();
  if (!purpose) throw new PixiTextureManagerError('texture purpose is required', 'texture-purpose-required');
  return purpose;
}

function resolveDocument(options: PixiTextureManagerOptions): Pick<Document, 'baseURI' | 'createElement'> | null {
  if (options.documentRef) return options.documentRef;
  if (options.root && options.root.document) return options.root.document as Document;
  try {
    if (typeof document !== 'undefined' && document) return document;
  } catch (_error) { /* an explicit document is preferred */ }
  return null;
}

function resolveBaseUri(options: PixiTextureManagerOptions): string | null {
  const explicit = String(options.baseUri || '').trim();
  if (explicit) return explicit;
  const documentRef = resolveDocument(options);
  const documentBaseUri = String(documentRef && documentRef.baseURI || '').trim();
  return documentBaseUri || null;
}

/** Resolve catalog paths against the document, never against a JS chunk URL. */
export function resolvePixiTextureAssetUrl(rawUrl: unknown, baseUri: string | null): string {
  const source = String(rawUrl || '').trim();
  if (!source) throw new PixiTextureManagerError('texture URL is empty', 'texture-url-empty');
  if (/^url\s*\(/i.test(source)) {
    throw new PixiTextureManagerError('CSS url() is not a texture descriptor', 'texture-css-url-unsupported');
  }
  if (/^(?:blob:|data:)/i.test(source)) return source;
  if (!baseUri) {
    throw new PixiTextureManagerError('document.baseURI is unavailable', 'texture-base-uri-unavailable');
  }
  try {
    return new URL(source, baseUri).href;
  } catch (error) {
    throw new PixiTextureManagerError('texture URL is invalid', 'texture-url-invalid', error);
  }
}

function createDefaultRuntime(options: PixiTextureManagerOptions): PixiTextureManagerRuntime {
  const pixi = options.pixiRuntime || PixiRuntimeContract.getPixiRuntime();
  const root = options.root || (() => {
    try { return typeof globalThis !== 'undefined' ? globalThis as unknown as Record<string, any> : null; }
    catch (_error) { return null; }
  })();
  const documentRef = resolveDocument(options);

  function requirePixi(): any {
    if (!pixi) throw new PixiTextureManagerError('Pixi runtime is unavailable', 'texture-pixi-runtime-unavailable');
    return pixi;
  }

  return {
    async loadTexture(absoluteUrl: string): Promise<PixiTextureUpload> {
      const runtime = requirePixi();
      if (!runtime.Assets || typeof runtime.Assets.load !== 'function') {
        throw new PixiTextureManagerError('Pixi Assets.load is unavailable', 'texture-loader-unavailable');
      }
      const texture = await runtime.Assets.load(absoluteUrl);
      if (!texture) throw new PixiTextureManagerError('Pixi returned an empty texture', 'texture-load-empty');
      return {
        texture,
        width: optionalDimension(texture.width) || optionalDimension(texture.source && texture.source.width) || undefined,
        height: optionalDimension(texture.height) || optionalDimension(texture.source && texture.source.height) || undefined,
        destroy: () => {
          if (runtime.Assets && typeof runtime.Assets.unload === 'function') {
            const pending = runtime.Assets.unload(absoluteUrl);
            if (pending && typeof pending.catch === 'function') pending.catch(() => undefined);
            return;
          }
          if (texture && typeof texture.destroy === 'function') texture.destroy(true);
        }
      };
    },
    createTextureFromBitmap(bitmap: PixiTextureBitmap): PixiTextureUpload {
      const runtime = requirePixi();
      if (!runtime.Texture || typeof runtime.Texture.from !== 'function') {
        throw new PixiTextureManagerError('Pixi Texture.from is unavailable', 'texture-factory-unavailable');
      }
      const texture = runtime.Texture.from(bitmap as any);
      return { texture, width: bitmap.width, height: bitmap.height };
    },
    createProceduralTexture(_purpose: string, _fallbackId: string): PixiTextureUpload {
      const runtime = requirePixi();
      if (runtime.Texture && runtime.Texture.WHITE) {
        return { texture: runtime.Texture.WHITE, width: 1, height: 1, owned: false };
      }
      if (!documentRef || typeof documentRef.createElement !== 'function'
        || !runtime.Texture || typeof runtime.Texture.from !== 'function') {
        throw new PixiTextureManagerError('procedural texture factory is unavailable', 'texture-procedural-unavailable');
      }
      const canvas = documentRef.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new PixiTextureManagerError('procedural canvas context is unavailable', 'texture-procedural-context');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 1, 1);
      return { texture: runtime.Texture.from(canvas), width: 1, height: 1 };
    },
    async createImageBitmap(source, bitmapOptions): Promise<PixiTextureBitmap> {
      const creator = root && root.createImageBitmap;
      if (typeof creator !== 'function') {
        throw new PixiTextureManagerError('createImageBitmap is unavailable', 'texture-bitmap-unavailable');
      }
      return creator.call(root, source, bitmapOptions) as Promise<PixiTextureBitmap>;
    },
    destroyTexture(texture: unknown): void {
      if (texture && typeof (texture as any).destroy === 'function') (texture as any).destroy(true);
    },
    closeImageBitmap(bitmap: PixiTextureBitmap): void {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    }
  };
}

function stablePart(value: unknown): string {
  return encodeURIComponent(String(value || ''));
}

function isThenable(value: unknown): boolean {
  return !!value && (typeof value === 'object' || typeof value === 'function')
    && typeof (value as any).then === 'function';
}

export function createPixiTextureManager(options: PixiTextureManagerOptions = {}): PixiTextureManager {
  const runtime = options.runtime || createDefaultRuntime(options);
  const baseUri = resolveBaseUri(options);
  const runtimeMax = typeof runtime.getMaxTextureSize === 'function'
    ? runtime.getMaxTextureSize()
    : DEFAULT_MAX_TEXTURE_SIZE;
  const runtimeTextureLimit = positiveInteger(runtimeMax, DEFAULT_MAX_TEXTURE_SIZE);
  const configuredTextureLimit = positiveInteger(options.maxTextureSize, runtimeTextureLimit);
  const maxTextureSize = Math.min(runtimeTextureLimit, configuredTextureLimit);
  const cache = new Map<string, CacheEntry>();
  const batches = new Set<BatchRecord>();
  const batchByPublic = new WeakMap<object, BatchRecord>();
  const externalLeases = new Set<ExternalLeaseRecord>();
  let managerState: PixiTextureManagerDiagnostics['state'] = 'ready';
  let activeBatch: BatchRecord | null = null;
  let generation = 0;
  let pendingLoadCount = 0;
  let loadStartCount = 0;
  let dedupeHitCount = 0;
  let uploadCount = 0;
  let fallbackCount = 0;
  let failureCount = 0;
  let derivedBitmapCount = 0;
  let downsampledBitmapCount = 0;
  let closedBitmapCount = 0;
  let destroyedTextureCount = 0;
  let destroyFailureCount = 0;
  let commitCount = 0;
  let lastFailureCode: string | null = null;

  function assertReady(): void {
    if (managerState !== 'ready') {
      throw new PixiTextureManagerError('texture manager is destroyed', 'texture-manager-destroyed');
    }
  }

  function recordFailure(error: unknown, fallbackCode: string): PixiTextureManagerError {
    const typed = errorOf(error, fallbackCode, 'texture operation failed');
    failureCount += 1;
    lastFailureCode = typed.code;
    return typed;
  }

  function closeBitmap(bitmap: PixiTextureBitmap | null): void {
    if (!bitmap) return;
    try {
      if (typeof runtime.closeImageBitmap === 'function') runtime.closeImageBitmap(bitmap);
      else if (typeof bitmap.close === 'function') bitmap.close();
    } finally {
      closedBitmapCount += 1;
    }
  }

  function normalizeUpload(upload: PixiTextureUpload, code: string): PixiTextureUpload {
    if (!upload || typeof upload !== 'object' || !('texture' in upload) || upload.texture == null) {
      throw new PixiTextureManagerError('texture upload is empty', code);
    }
    return upload;
  }

  function makeLoadedResource(
    upload: PixiTextureUpload,
    downsampled: boolean,
    bitmap: PixiTextureBitmap | null = null
  ): LoadedResource {
    const normalized = normalizeUpload(upload, 'texture-upload-empty');
    let destroyed = false;
    return {
      texture: normalized.texture,
      width: optionalDimension(normalized.width),
      height: optionalDimension(normalized.height),
      downsampled,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        try {
          if (normalized.owned !== false) {
            if (typeof normalized.destroy === 'function') normalized.destroy();
            else if (typeof runtime.destroyTexture === 'function') runtime.destroyTexture(normalized.texture);
          }
          destroyedTextureCount += normalized.owned === false ? 0 : 1;
        } finally {
          closeBitmap(bitmap);
        }
      }
    };
  }

  function normalizeRequest(request: PixiTextureRequest): NormalizedRequest {
    if (!request || typeof request !== 'object') {
      throw new PixiTextureManagerError('texture request is required', 'texture-request-required');
    }
    const purpose = normalizePurpose(request.purpose);
    const inferredKind: PixiTextureSourceKind = request.kind
      || (request.sourceBlob ? 'custom' : 'built-in');
    if (inferredKind !== 'built-in' && inferredKind !== 'custom' && inferredKind !== 'procedural') {
      throw new PixiTextureManagerError('texture source kind is invalid', 'texture-source-kind-invalid');
    }
    const absoluteUrl = inferredKind === 'procedural'
      ? null
      : resolvePixiTextureAssetUrl(request.url, baseUri);
    return Object.freeze({
      purpose,
      kind: inferredKind,
      absoluteUrl,
      sourceBlob: request.sourceBlob || null,
      contentFingerprint: String(request.contentFingerprint || ''),
      maxPhysicalWidth: positiveInteger(request.maxPhysicalWidth, maxTextureSize),
      maxPhysicalHeight: positiveInteger(request.maxPhysicalHeight, maxTextureSize),
      fallback: request.fallback || null
    });
  }

  function sourceKey(request: NormalizedRequest, proceduralId?: string): string {
    if (request.kind === 'procedural') {
      return `procedural:${stablePart(proceduralId || request.purpose)}`;
    }
    if (request.kind === 'custom') {
      return [
        'custom', stablePart(request.absoluteUrl), stablePart(request.contentFingerprint),
        request.maxPhysicalWidth, request.maxPhysicalHeight, maxTextureSize
      ].join(':');
    }
    // Purpose is intentionally absent: the same decoded/uploaded URL is shared
    // by board roles. The public binding key below still includes its purpose.
    return ['built-in', stablePart(request.absoluteUrl)].join(':');
  }

  async function loadBuiltIn(request: NormalizedRequest): Promise<LoadedResource> {
    if (!request.absoluteUrl) throw new PixiTextureManagerError('built-in texture URL is unavailable', 'texture-url-empty');
    const upload = await runtime.loadTexture(request.absoluteUrl, request.purpose);
    uploadCount += 1;
    return makeLoadedResource(upload, false);
  }

  async function loadCustom(request: NormalizedRequest): Promise<LoadedResource> {
    if (!request.sourceBlob) {
      throw new PixiTextureManagerError('custom texture source Blob is unavailable', 'texture-custom-blob-unavailable');
    }
    let decoded: PixiTextureBitmap | null = null;
    let uploadBitmap: PixiTextureBitmap | null = null;
    try {
      decoded = await runtime.createImageBitmap(request.sourceBlob);
      derivedBitmapCount += 1;
      const sourceWidth = positiveInteger(decoded && decoded.width, 0);
      const sourceHeight = positiveInteger(decoded && decoded.height, 0);
      if (!sourceWidth || !sourceHeight) {
        throw new PixiTextureManagerError('custom texture dimensions are invalid', 'texture-custom-dimensions-invalid');
      }
      const widthLimit = Math.min(request.maxPhysicalWidth, maxTextureSize);
      const heightLimit = Math.min(request.maxPhysicalHeight, maxTextureSize);
      const scale = Math.min(1, widthLimit / sourceWidth, heightLimit / sourceHeight);
      const targetWidth = Math.max(1, Math.min(widthLimit, Math.floor(sourceWidth * scale)));
      const targetHeight = Math.max(1, Math.min(heightLimit, Math.floor(sourceHeight * scale)));
      const downsampled = targetWidth !== sourceWidth || targetHeight !== sourceHeight;
      if (downsampled) {
        uploadBitmap = await runtime.createImageBitmap(decoded, {
          resizeWidth: targetWidth,
          resizeHeight: targetHeight,
          resizeQuality: 'high'
        });
        derivedBitmapCount += 1;
        downsampledBitmapCount += 1;
        closeBitmap(decoded);
        decoded = null;
        if (positiveInteger(uploadBitmap && uploadBitmap.width, 0) !== targetWidth
          || positiveInteger(uploadBitmap && uploadBitmap.height, 0) !== targetHeight) {
          throw new PixiTextureManagerError(
            'custom texture derivative dimensions are invalid',
            'texture-custom-derivative-dimensions-invalid'
          );
        }
      } else {
        uploadBitmap = decoded;
        decoded = null;
      }
      const upload = await runtime.createTextureFromBitmap(uploadBitmap, request.purpose);
      uploadCount += 1;
      const resource = makeLoadedResource({
        ...upload,
        width: optionalDimension(upload.width) || uploadBitmap.width,
        height: optionalDimension(upload.height) || uploadBitmap.height
      }, downsampled, uploadBitmap);
      uploadBitmap = null;
      return resource;
    } catch (error) {
      closeBitmap(uploadBitmap);
      closeBitmap(decoded);
      throw errorOf(error, 'texture-custom-derivative-failed', 'custom texture derivative failed');
    }
  }

  async function loadProcedural(request: NormalizedRequest, fallbackId: string): Promise<LoadedResource> {
    const upload = await runtime.createProceduralTexture(request.purpose, fallbackId);
    uploadCount += 1;
    return makeLoadedResource(upload, false);
  }

  function destroyEntryResource(entry: CacheEntry): void {
    if (entry.state !== 'ready' || !entry.resource) return;
    try {
      entry.resource.destroy();
    } catch (error) {
      destroyFailureCount += 1;
      lastFailureCode = errorOf(error, 'texture-destroy-failed', 'texture destroy failed').code;
    }
    entry.resource = null;
    entry.state = 'destroyed';
    if (cache.get(entry.key) === entry) cache.delete(entry.key);
  }

  function createEntry(key: string, loader: () => Promise<LoadedResource>): CacheEntry {
    let entry!: CacheEntry;
    loadStartCount += 1;
    pendingLoadCount += 1;
    const promise = (async () => {
      try {
        const resource = await loader();
        entry.resource = resource;
        entry.state = 'ready';
        if (entry.refCount === 0 || managerState === 'destroyed') destroyEntryResource(entry);
        return resource;
      } catch (error) {
        entry.state = 'failed';
        if (cache.get(key) === entry) cache.delete(key);
        throw error;
      } finally {
        pendingLoadCount -= 1;
      }
    })();
    // A prepare operation observes this rejection. This additional observer
    // prevents an unhandled rejection if destroy races the loader.
    promise.catch(() => undefined);
    entry = { key, promise, refCount: 0, state: 'loading', resource: null };
    cache.set(key, entry);
    return entry;
  }

  async function acquireEntry(
    key: string,
    loader: () => Promise<LoadedResource>
  ): Promise<CacheEntry> {
    assertReady();
    let entry = cache.get(key);
    if (entry) dedupeHitCount += 1;
    else entry = createEntry(key, loader);
    entry.refCount += 1;
    let retained = true;
    try {
      await entry.promise;
      if (managerState !== 'ready') {
        releaseEntry(entry);
        retained = false;
        throw new PixiTextureManagerError('texture manager was destroyed during load', 'texture-manager-destroyed');
      }
      return entry;
    } catch (error) {
      if (retained) releaseEntry(entry);
      throw error;
    }
  }

  function retainEntry(entry: CacheEntry): void {
    if (managerState !== 'ready' || entry.state !== 'ready' || !entry.resource) {
      throw new PixiTextureManagerError('texture resource is unavailable', 'texture-resource-unavailable');
    }
    entry.refCount += 1;
  }

  function releaseEntry(entry: CacheEntry): void {
    if (entry.refCount <= 0) return;
    entry.refCount -= 1;
    if (entry.refCount === 0 && entry.state === 'ready') destroyEntryResource(entry);
  }

  async function acquirePrimary(
    request: NormalizedRequest,
    proceduralId?: string
  ): Promise<{ entry: CacheEntry; sourceKey: string }> {
    const key = sourceKey(request, proceduralId);
    const entry = await acquireEntry(key, () => {
      if (request.kind === 'custom') return loadCustom(request);
      if (request.kind === 'procedural') return loadProcedural(request, proceduralId || request.purpose);
      return loadBuiltIn(request);
    });
    return { entry, sourceKey: key };
  }

  function fallbackRequest(primary: NormalizedRequest): { request: NormalizedRequest; proceduralId?: string } | null {
    const fallback = primary.fallback;
    if (!fallback) return null;
    if (fallback.kind === 'procedural') {
      return {
        request: normalizeRequest({ purpose: primary.purpose, kind: 'procedural' }),
        proceduralId: String(fallback.id || `${primary.purpose}:default`)
      };
    }
    return {
      request: normalizeRequest({
        purpose: primary.purpose,
        kind: 'built-in',
        url: fallback.url,
        contentFingerprint: fallback.contentFingerprint
      })
    };
  }

  function makeBinding(
    requested: NormalizedRequest,
    resolved: NormalizedRequest,
    acquired: { entry: CacheEntry; sourceKey: string },
    usedFallback: boolean
  ): PreparedBinding {
    const loaded = acquired.entry.resource;
    if (!loaded) throw new PixiTextureManagerError('texture resource did not finish loading', 'texture-resource-unavailable');
    const managed: PixiManagedTexture = Object.freeze({
      key: `${stablePart(requested.purpose)}:${acquired.sourceKey}`,
      sourceKey: acquired.sourceKey,
      purpose: requested.purpose,
      requestedUrl: requested.absoluteUrl,
      resolvedUrl: resolved.absoluteUrl,
      sourceKind: resolved.kind,
      texture: loaded.texture,
      width: loaded.width,
      height: loaded.height,
      usedFallback,
      downsampled: loaded.downsampled
    });
    return Object.freeze({ entry: acquired.entry, resource: managed });
  }

  async function acquireBinding(request: NormalizedRequest): Promise<PreparedBinding> {
    try {
      const acquired = await acquirePrimary(request);
      return makeBinding(request, request, acquired, false);
    } catch (primaryError) {
      const primaryFailure = recordFailure(primaryError, 'texture-load-failed');
      if (request.kind === 'procedural') throw primaryFailure;
      fallbackCount += 1;
      const explicit = fallbackRequest(request);
      if (explicit) {
        try {
          const acquired = await acquirePrimary(explicit.request, explicit.proceduralId);
          return makeBinding(request, explicit.request, acquired, true);
        } catch (fallbackError) {
          const fallbackFailure = recordFailure(fallbackError, 'texture-fallback-failed');
          if (explicit.request.kind === 'procedural') throw fallbackFailure;
        }
      }
      const procedural = normalizeRequest({ purpose: request.purpose, kind: 'procedural' });
      try {
        const acquired = await acquirePrimary(procedural, `${request.purpose}:procedural-fallback`);
        return makeBinding(request, procedural, acquired, true);
      } catch (proceduralError) {
        throw recordFailure(proceduralError, 'texture-procedural-fallback-failed');
      }
    }
  }

  function releaseSourceLease(batch: BatchRecord): void {
    if (batch.sourceLeaseReleased || !batch.sourceLease) return;
    batch.sourceLeaseReleased = true;
    const lease = batch.sourceLease;
    batch.sourceLease = null;
    try {
      lease.release();
    } catch (error) {
      destroyFailureCount += 1;
      lastFailureCode = errorOf(error, 'texture-source-lease-release-failed', 'source lease release failed').code;
    }
  }

  function finishRetiredBatch(batch: BatchRecord): void {
    if (batch.resourcesReleased && batch.externalRefCount === 0) releaseSourceLease(batch);
    if (batch.resourcesReleased && batch.externalRefCount === 0) batches.delete(batch);
  }

  function retireBatch(batch: BatchRecord): boolean {
    if (batch.resourcesReleased) return false;
    batch.resourcesReleased = true;
    batch.state = 'released';
    for (const binding of batch.bindings) releaseEntry(binding.entry);
    finishRetiredBatch(batch);
    return true;
  }

  function makePreparedSet(record: Omit<BatchRecord, 'publicSet'>): PixiPreparedTextureSet {
    const publicSet: PixiPreparedTextureSet = Object.freeze({
      id: record.id,
      get state() { return record.state; },
      resources: Object.freeze(record.bindings.map((binding) => binding.resource)),
      get: (purpose: string) => record.resourcesByPurpose.get(String(purpose)) || null,
      release: () => {
        if (record.state !== 'prepared') return false;
        return retireBatch(record as BatchRecord);
      }
    });
    return publicSet;
  }

  async function prepare(
    id: string,
    requests: readonly PixiTextureRequest[],
    prepareOptions: PixiTexturePrepareOptions = {}
  ): Promise<PixiPreparedTextureSet> {
    const bindings: PreparedBinding[] = [];
    let sourceLeaseTransferred = false;
    try {
      assertReady();
      const normalizedId = String(id || '').trim();
      if (!normalizedId) throw new PixiTextureManagerError('texture set id is required', 'texture-set-id-required');
      if (!Array.isArray(requests) || requests.length === 0) {
        throw new PixiTextureManagerError('texture set must contain resources', 'texture-set-empty');
      }
      const normalized = requests.map(normalizeRequest);
      const purposes = new Set<string>();
      normalized.forEach((request) => {
        if (purposes.has(request.purpose)) {
          throw new PixiTextureManagerError('texture purposes must be unique within a set', 'texture-purpose-duplicate');
        }
        purposes.add(request.purpose);
      });
      if (normalized.some((request) => request.kind === 'custom'
        && /^blob:/i.test(String(request.absoluteUrl || '')))
        && !prepareOptions.sourceLease) {
        throw new PixiTextureManagerError(
          'custom Blob texture requires an object URL source lease',
          'texture-custom-source-lease-required'
        );
      }
      for (const request of normalized) {
        // Sequential binding preserves descriptor order. Uploads are still
        // deduped globally, including against other concurrent prepare calls.
        bindings.push(await acquireBinding(request));
      }
      assertReady();
      const resourcesByPurpose = new Map(bindings.map((binding) => [binding.resource.purpose, binding.resource]));
      const partial = {
        id: normalizedId,
        bindings: Object.freeze(bindings.slice()),
        resourcesByPurpose,
        sourceLease: prepareOptions.sourceLease || null,
        sourceLeaseReleased: false,
        externalRefCount: 0,
        resourcesReleased: false,
        state: 'prepared' as PixiPreparedTextureSetState,
        generation: 0,
        committedSnapshot: null
      };
      const publicSet = makePreparedSet(partial as Omit<BatchRecord, 'publicSet'>);
      const record = Object.assign(partial, { publicSet }) as BatchRecord;
      batchByPublic.set(publicSet as object, record);
      batches.add(record);
      sourceLeaseTransferred = true;
      return publicSet;
    } catch (error) {
      for (let index = bindings.length - 1; index >= 0; index -= 1) releaseEntry(bindings[index].entry);
      if (!sourceLeaseTransferred && prepareOptions.sourceLease) {
        try { prepareOptions.sourceLease.release(); }
        catch (releaseError) {
          destroyFailureCount += 1;
          lastFailureCode = errorOf(releaseError, 'texture-source-lease-release-failed', 'source lease release failed').code;
        }
      }
      throw error;
    }
  }

  function createCommittedSnapshot(batch: BatchRecord): PixiCommittedTextureSet {
    return Object.freeze({
      id: batch.id,
      generation: batch.generation,
      resources: batch.publicSet.resources,
      get: (purpose: string) => batch.resourcesByPurpose.get(String(purpose)) || null
    });
  }

  function commit(
    prepared: PixiPreparedTextureSet,
    apply?: (next: PixiCommittedTextureSet) => void
  ): PixiCommittedTextureSet {
    assertReady();
    const next = prepared && batchByPublic.get(prepared as object);
    if (!next || next.state !== 'prepared' || next.resourcesReleased) {
      throw new PixiTextureManagerError('prepared texture set is unavailable', 'texture-set-not-prepared');
    }
    const previous = activeBatch;
    next.generation = generation + 1;
    const snapshot = createCommittedSnapshot(next);
    next.committedSnapshot = snapshot;
    activeBatch = next;
    try {
      if (apply) {
        const result = apply(snapshot);
        if (isThenable(result)) {
          throw new PixiTextureManagerError('atomic texture apply must be synchronous', 'texture-apply-async');
        }
      }
    } catch (error) {
      activeBatch = previous;
      next.generation = 0;
      next.committedSnapshot = null;
      throw recordFailure(error, 'texture-apply-failed');
    }
    generation = next.generation;
    next.state = 'active';
    commitCount += 1;
    if (previous && previous !== next) retireBatch(previous);
    return snapshot;
  }

  function getActive(): PixiCommittedTextureSet | null {
    return activeBatch && activeBatch.state === 'active' ? activeBatch.committedSnapshot : null;
  }

  function acquireActive(purpose: string): PixiTextureLease {
    assertReady();
    const batch = activeBatch;
    if (!batch || batch.state !== 'active') {
      throw new PixiTextureManagerError('active texture set is unavailable', 'texture-active-set-unavailable');
    }
    const binding = batch.bindings.find((candidate) => candidate.resource.purpose === String(purpose));
    if (!binding) throw new PixiTextureManagerError('active texture purpose is unavailable', 'texture-active-purpose-unavailable');
    retainEntry(binding.entry);
    batch.externalRefCount += 1;
    let record!: ExternalLeaseRecord;
    const publicLease: PixiTextureLease = Object.freeze({
      resource: binding.resource,
      get released() { return record.released; },
      release: () => {
        if (record.released) return false;
        record.released = true;
        externalLeases.delete(record);
        releaseEntry(record.entry);
        record.batch.externalRefCount = Math.max(0, record.batch.externalRefCount - 1);
        finishRetiredBatch(record.batch);
        return true;
      }
    });
    record = { entry: binding.entry, batch, publicLease, released: false };
    externalLeases.add(record);
    return publicLease;
  }

  function releaseActive(): boolean {
    const batch = activeBatch;
    if (!batch) return false;
    activeBatch = null;
    return retireBatch(batch);
  }

  function getDiagnostics(): PixiTextureManagerDiagnostics {
    let readyResourceCount = 0;
    let referenceCount = 0;
    cache.forEach((entry) => {
      if (entry.state === 'ready' && entry.resource) readyResourceCount += 1;
      referenceCount += entry.refCount;
    });
    let preparedSetCount = 0;
    let sourceLeaseCount = 0;
    batches.forEach((batch) => {
      if (batch.state === 'prepared') preparedSetCount += 1;
      if (batch.sourceLease && !batch.sourceLeaseReleased) sourceLeaseCount += 1;
    });
    return Object.freeze({
      state: managerState,
      baseUri,
      maxTextureSize,
      cacheEntryCount: cache.size,
      readyResourceCount,
      pendingLoadCount,
      referenceCount,
      preparedSetCount,
      activeSetId: activeBatch && activeBatch.state === 'active' ? activeBatch.id : null,
      externalLeaseCount: externalLeases.size,
      sourceLeaseCount,
      loadStartCount,
      dedupeHitCount,
      uploadCount,
      fallbackCount,
      failureCount,
      derivedBitmapCount,
      downsampledBitmapCount,
      closedBitmapCount,
      destroyedTextureCount,
      destroyFailureCount,
      commitCount,
      lastFailureCode
    });
  }

  function destroy(): void {
    if (managerState === 'destroyed') return;
    managerState = 'destroyed';
    activeBatch = null;
    for (const batch of Array.from(batches)) retireBatch(batch);
    for (const lease of Array.from(externalLeases)) lease.publicLease.release();
    // Ready entries with no leases were destroyed by releaseEntry. Loading
    // entries self-destroy when their promises settle under destroyed state.
  }

  return Object.freeze({
    prepare,
    commit,
    getActive,
    acquireActive,
    releaseActive,
    getDiagnostics,
    destroy
  });
}
