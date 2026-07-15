/**
 * @file storage.ts
 * @description Browser-local storage and object URL cache for custom cosmetic skins
 */

type CustomSkinKind = 'background' | 'board' | 'board-frame' | 'stone';

interface CustomSkinRecord {
  id: string;
  kind: CustomSkinKind;
  label: string;
  backgroundImage?: Blob;
  boardImage?: Blob;
  boardFrameImage?: Blob;
  blackImage?: Blob;
  whiteImage?: Blob;
  contentFingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomSkinDefinitionBase {
  id: string;
  label: string;
  note: string;
  contentFingerprint: string;
}

interface CustomBackgroundSkinDefinition extends CustomSkinDefinitionBase {
  kind: 'background';
  imagePath: string;
}

interface CustomBoardSkinDefinition extends CustomSkinDefinitionBase {
  kind: 'board';
  imagePath: string;
}

interface CustomBoardFrameSkinDefinition extends CustomSkinDefinitionBase {
  kind: 'board-frame';
  imagePath: string;
}

interface CustomStoneSkinDefinition extends CustomSkinDefinitionBase {
  kind: 'stone';
  blackImagePath: string;
  whiteImagePath: string;
}

type CustomSkinDefinition =
  | CustomBackgroundSkinDefinition
  | CustomBoardSkinDefinition
  | CustomBoardFrameSkinDefinition
  | CustomStoneSkinDefinition;

interface SaveCustomSkinInput {
  id?: string;
  kind: CustomSkinKind;
  label?: string;
  backgroundImage?: Blob;
  boardImage?: Blob;
  boardFrameImage?: Blob;
  blackImage?: Blob;
  whiteImage?: Blob;
}

interface CustomSkinStorageState {
  records: Map<string, CustomSkinRecord>;
  definitions: Map<string, CustomSkinDefinition>;
  objectUrls: Map<string, string[]>;
  objectUrlResources: Map<string, CustomSkinObjectUrlResource>;
  objectUrlLeases: Map<number, CustomSkinObjectUrlLeaseRecord>;
  nextObjectUrlLeaseId: number;
  listeners: Set<() => void>;
  hydrated: boolean;
  hydratePromise: Promise<void> | null;
}

interface CustomSkinObjectUrlResource {
  skinId: string;
  leaseCount: number;
  pendingRevoke: boolean;
}

interface CustomSkinObjectUrlLeaseRecord {
  id: number;
  skinId: string;
  urls: readonly string[];
}

interface CustomSkinObjectUrlLease {
  readonly id: number;
  readonly skinId: string;
  readonly urls: readonly string[];
  release(): boolean;
}

type CustomSkinImageRole = 'background' | 'board' | 'board-frame' | 'black-stone' | 'white-stone';

interface CustomSkinImageSourceDescriptor {
  readonly role: CustomSkinImageRole;
  readonly url: string;
  readonly blob: Blob;
}

interface CustomSkinResourceDescriptor {
  readonly id: string;
  readonly kind: CustomSkinKind;
  readonly contentFingerprint: string;
  readonly images: readonly CustomSkinImageSourceDescriptor[];
}

interface CustomSkinStorageError extends Error {
  code?: string;
}

const DB_NAME = 'card-reversi-custom-skins';
const DB_VERSION = 1;
const STORE_NAME = 'skins';
const CUSTOM_SKIN_ID_PREFIX = 'custom:';
const MAX_CUSTOM_SKIN_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CUSTOM_SKIN_NAME_LENGTH = 24;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const states = new WeakMap<object, CustomSkinStorageState>();

function resolveRootRef(rootRef: any): any {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
  } catch (e) { /* ignore */ }
  return null;
}

function getState(rootRef: any): CustomSkinStorageState | null {
  const root = resolveRootRef(rootRef);
  if (!root || typeof root !== 'object') return null;
  let state = states.get(root);
  if (!state) {
    state = {
      records: new Map(),
      definitions: new Map(),
      objectUrls: new Map(),
      objectUrlResources: new Map(),
      objectUrlLeases: new Map(),
      nextObjectUrlLeaseId: 1,
      listeners: new Set(),
      hydrated: false,
      hydratePromise: null
    };
    states.set(root, state);
  }
  return state;
}

function getIndexedDb(rootRef: any): IDBFactory | null {
  const root = resolveRootRef(rootRef);
  try {
    if (root && root.indexedDB) return root.indexedDB as IDBFactory;
  } catch (e) { /* ignore */ }
  try {
    if (typeof indexedDB !== 'undefined') return indexedDB;
  } catch (e) { /* ignore */ }
  return null;
}

function getUrlApi(rootRef: any): any {
  const root = resolveRootRef(rootRef);
  try {
    if (root && root.URL) return root.URL;
  } catch (e) { /* ignore */ }
  try {
    if (typeof URL !== 'undefined') return URL;
  } catch (e) { /* ignore */ }
  return null;
}

function createError(message: string, code: string): CustomSkinStorageError {
  const error = new Error(message) as CustomSkinStorageError;
  error.code = code;
  return error;
}

function normalizeKind(value: unknown): CustomSkinKind | null {
  const normalized = String(value || '').trim();
  if (normalized === 'background' || normalized === 'board' || normalized === 'board-frame' || normalized === 'stone') return normalized;
  return null;
}

function normalizeLabel(value: unknown): string {
  const normalized = String(value || '').trim();
  return Array.from(normalized || 'マイスキン').slice(0, MAX_CUSTOM_SKIN_NAME_LENGTH).join('');
}

function isCustomSkinId(value: unknown, kind?: CustomSkinKind): boolean {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith(CUSTOM_SKIN_ID_PREFIX)) return false;
  if (!kind) return true;
  return normalized.startsWith(`${CUSTOM_SKIN_ID_PREFIX}${kind}:`);
}

function createSkinId(kind: CustomSkinKind, rootRef: any): string {
  const root = resolveRootRef(rootRef);
  try {
    if (root && root.crypto && typeof root.crypto.randomUUID === 'function') {
      return `${CUSTOM_SKIN_ID_PREFIX}${kind}:${root.crypto.randomUUID()}`;
    }
  } catch (e) { /* ignore */ }
  return `${CUSTOM_SKIN_ID_PREFIX}${kind}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isBlobLike(value: unknown): value is Blob {
  return !!value
    && typeof value === 'object'
    && typeof (value as Blob).size === 'number'
    && typeof (value as Blob).type === 'string';
}

function validateImage(value: unknown, fieldName: string): Blob {
  if (!isBlobLike(value)) throw createError(`${fieldName}を選択してください`, 'image-required');
  if (!ACCEPTED_IMAGE_TYPES.has(String(value.type || '').toLowerCase())) {
    throw createError(`${fieldName}はPNG、JPEG、WebPのいずれかを選択してください`, 'image-type');
  }
  if (value.size <= 0) throw createError(`${fieldName}が空です`, 'image-empty');
  if (value.size > MAX_CUSTOM_SKIN_IMAGE_BYTES) {
    throw createError(`${fieldName}は8MiB以下にしてください`, 'image-too-large');
  }
  return value;
}

function validateInput(input: SaveCustomSkinInput): { kind: CustomSkinKind; label: string } {
  const kind = normalizeKind(input && input.kind);
  if (!kind) throw createError('保存対象のスキン種別が不正です', 'invalid-kind');
  if (kind === 'background') validateImage(input.backgroundImage, '背景画像');
  if (kind === 'board') validateImage(input.boardImage, '盤面画像');
  if (kind === 'board-frame') validateImage(input.boardFrameImage, '盤面フレーム画像');
  if (kind === 'stone') {
    validateImage(input.blackImage, '黒石画像');
    validateImage(input.whiteImage, '白石画像');
  }
  return { kind, label: normalizeLabel(input.label) };
}

function cloneRecord(record: CustomSkinRecord): CustomSkinRecord {
  return { ...record };
}

function fnv1a32Text(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function fingerprintBlob(blob: Blob, fallbackSalt: string): Promise<string> {
  try {
    if (blob && typeof blob.arrayBuffer === 'function') {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let hash = 2166136261;
      for (let index = 0; index < bytes.length; index += 1) {
        hash ^= bytes[index];
        hash = Math.imul(hash, 16777619);
      }
      return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${blob.size}:${String(blob.type || '').toLowerCase()}`;
    }
  } catch (e) { /* fall through to a stable legacy-browser fingerprint */ }
  return fnv1a32Text(`${fallbackSalt}|${blob.size}|${String(blob.type || '').toLowerCase()}`);
}

async function computeRecordContentFingerprint(record: CustomSkinRecord): Promise<string> {
  const sources: Array<[string, Blob | undefined]> = [
    ['background', record.backgroundImage],
    ['board', record.boardImage],
    ['board-frame', record.boardFrameImage],
    ['black-stone', record.blackImage],
    ['white-stone', record.whiteImage]
  ];
  const parts: string[] = [record.kind];
  for (const [role, blob] of sources) {
    if (!blob) continue;
    parts.push(`${role}:${await fingerprintBlob(blob, `${record.updatedAt}|${role}`)}`);
  }
  return fnv1a32Text(parts.join('|'));
}

function fallbackRecordContentFingerprint(record: CustomSkinRecord): string {
  const sources = [
    record.backgroundImage,
    record.boardImage,
    record.boardFrameImage,
    record.blackImage,
    record.whiteImage
  ].filter((blob): blob is Blob => !!blob);
  return fnv1a32Text([
    record.kind,
    record.updatedAt,
    ...sources.map((blob) => `${blob.size}:${String(blob.type || '').toLowerCase()}`)
  ].join('|'));
}

function revokeObjectUrlNow(rootRef: any, url: string, state: CustomSkinStorageState): void {
  const urlApi = getUrlApi(rootRef);
  if (urlApi && typeof urlApi.revokeObjectURL === 'function') {
    try { urlApi.revokeObjectURL(url); } catch (e) { /* ignore */ }
  }
  state.objectUrlResources.delete(url);
}

function requestObjectUrlRevoke(rootRef: any, url: string, state: CustomSkinStorageState): void {
  const resource = state.objectUrlResources.get(url);
  if (!resource) return;
  resource.pendingRevoke = true;
  if (resource.leaseCount === 0) revokeObjectUrlNow(rootRef, url, state);
}

function revokeObjectUrls(rootRef: any, skinId: string, state: CustomSkinStorageState): void {
  const urls = state.objectUrls.get(skinId) || [];
  state.objectUrls.delete(skinId);
  urls.forEach((url) => requestObjectUrlRevoke(rootRef, url, state));
}

function createObjectUrl(rootRef: any, blob: Blob, skinId: string, state: CustomSkinStorageState): string {
  const urlApi = getUrlApi(rootRef);
  if (!urlApi || typeof urlApi.createObjectURL !== 'function') {
    throw createError('画像を表示できるブラウザ機能がありません', 'object-url-unavailable');
  }
  const url = String(urlApi.createObjectURL(blob) || '').trim();
  if (!url) throw createError('画像URLを作成できませんでした', 'object-url-failed');
  if (state.objectUrlResources.has(url)) {
    // A conforming URL API returns a unique value. If an injected/broken API
    // collides, preserving the already-leased resource is safer than revoking
    // the shared string while it may still back the visible texture.
    throw createError('画像URLが重複しました', 'object-url-collision');
  }
  state.objectUrlResources.set(url, {
    skinId,
    leaseCount: 0,
    pendingRevoke: false
  });
  return url;
}

function createDefinition(rootRef: any, record: CustomSkinRecord, state: CustomSkinStorageState): CustomSkinDefinition {
  const previousUrls = (state.objectUrls.get(record.id) || []).slice();
  const nextUrls: string[] = [];
  const base = {
    id: record.id,
    label: record.label,
    note: '個人保存',
    contentFingerprint: String(record.contentFingerprint || fallbackRecordContentFingerprint(record)),
  };
  let definition: CustomSkinDefinition;
  try {
    if (record.kind === 'background' && record.backgroundImage) {
      const imagePath = createObjectUrl(rootRef, record.backgroundImage, record.id, state);
      nextUrls.push(imagePath);
      definition = { ...base, kind: 'background', imagePath };
    } else if (record.kind === 'board' && record.boardImage) {
      const imagePath = createObjectUrl(rootRef, record.boardImage, record.id, state);
      nextUrls.push(imagePath);
      definition = { ...base, kind: 'board', imagePath };
    } else if (record.kind === 'board-frame' && record.boardFrameImage) {
      const imagePath = createObjectUrl(rootRef, record.boardFrameImage, record.id, state);
      nextUrls.push(imagePath);
      definition = { ...base, kind: 'board-frame', imagePath };
    } else if (record.kind === 'stone' && record.blackImage && record.whiteImage) {
      const blackImagePath = createObjectUrl(rootRef, record.blackImage, record.id, state);
      nextUrls.push(blackImagePath);
      const whiteImagePath = createObjectUrl(rootRef, record.whiteImage, record.id, state);
      nextUrls.push(whiteImagePath);
      definition = {
        ...base,
        kind: 'stone',
        blackImagePath,
        whiteImagePath
      };
    } else {
      throw createError('保存済み画像の内容が不正です', 'invalid-record');
    }
  } catch (error) {
    nextUrls.forEach((url) => requestObjectUrlRevoke(rootRef, url, state));
    throw error;
  }
  state.objectUrls.set(record.id, nextUrls);
  previousUrls.forEach((url) => requestObjectUrlRevoke(rootRef, url, state));
  return definition;
}

function replaceCachedRecord(rootRef: any, record: CustomSkinRecord, state: CustomSkinStorageState): CustomSkinDefinition {
  const definition = createDefinition(rootRef, record, state);
  state.records.set(record.id, cloneRecord(record));
  state.definitions.set(record.id, definition);
  return definition;
}

function notify(state: CustomSkinStorageState): void {
  Array.from(state.listeners).forEach((listener) => {
    try { listener(); } catch (e) { /* keep other listeners alive */ }
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function openDatabase(rootRef: any): Promise<IDBDatabase> {
  const factory = getIndexedDb(rootRef);
  if (!factory || typeof factory.open !== 'function') {
    return Promise.reject(createError('このブラウザでは個人保存を利用できません', 'indexeddb-unavailable'));
  }
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || createError('個人保存を開けませんでした', 'indexeddb-open-failed'));
    request.onblocked = () => reject(createError('個人保存が別の画面で使用中です', 'indexeddb-blocked'));
  });
}

async function readAllRecords(rootRef: any): Promise<CustomSkinRecord[]> {
  const db = await openDatabase(rootRef);
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const result = await requestToPromise<unknown[]>(transaction.objectStore(STORE_NAME).getAll());
    return (Array.isArray(result) ? result : []).filter((record): record is CustomSkinRecord => {
      const kind = normalizeKind(record && (record as CustomSkinRecord).kind);
      return !!record && isCustomSkinId((record as CustomSkinRecord).id, kind || undefined) && !!kind;
    });
  } finally {
    db.close();
  }
}

async function putRecord(rootRef: any, record: CustomSkinRecord): Promise<void> {
  const db = await openDatabase(rootRef);
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).put(record));
  } finally {
    db.close();
  }
}

async function deleteRecord(rootRef: any, skinId: string): Promise<void> {
  const db = await openDatabase(rootRef);
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(skinId));
  } finally {
    db.close();
  }
}

async function loadCustomSkins(rootRef: any): Promise<CustomSkinDefinition[]> {
  const root = resolveRootRef(rootRef);
  const state = getState(root);
  if (!state) return [];
  if (state.hydrated) return Array.from(state.definitions.values()).map((definition) => ({ ...definition }));
  if (state.hydratePromise) {
    await state.hydratePromise;
    return Array.from(state.definitions.values()).map((definition) => ({ ...definition }));
  }
  state.hydratePromise = (async () => {
    const records = await readAllRecords(root);
    const previousSkinIds = new Set(state.objectUrls.keys());
    state.records.clear();
    state.definitions.clear();
    for (const persistedRecord of records) {
      try {
        const record = cloneRecord(persistedRecord);
        if (!String(record.contentFingerprint || '').trim()) {
          record.contentFingerprint = await computeRecordContentFingerprint(record);
        }
        replaceCachedRecord(root, record, state);
        previousSkinIds.delete(record.id);
      } catch (e) { /* ignore corrupted records */ }
    }
    previousSkinIds.forEach((skinId) => revokeObjectUrls(root, skinId, state));
    state.hydrated = true;
    notify(state);
  })();
  try {
    await state.hydratePromise;
  } finally {
    state.hydratePromise = null;
  }
  return Array.from(state.definitions.values()).map((definition) => ({ ...definition }));
}

function getCustomSkinDefinitions(rootRef: any, kind?: CustomSkinKind): CustomSkinDefinition[] {
  const state = getState(rootRef);
  if (!state) return [];
  return Array.from(state.definitions.values())
    .filter((definition) => !kind || definition.kind === kind)
    .map((definition) => ({ ...definition }));
}

function getCustomSkinRecord(rootRef: any, skinId: string): CustomSkinRecord | null {
  const state = getState(rootRef);
  const record = state && state.records.get(String(skinId || '').trim());
  return record ? cloneRecord(record) : null;
}

function getCustomSkinResourceDescriptor(rootRef: any, skinId: string): CustomSkinResourceDescriptor | null {
  const state = getState(rootRef);
  const normalizedId = String(skinId || '').trim();
  const record = state && state.records.get(normalizedId);
  const definition = state && state.definitions.get(normalizedId);
  if (!record || !definition) return null;
  const images: CustomSkinImageSourceDescriptor[] = [];
  if (record.kind === 'background' && record.backgroundImage && definition.kind === 'background') {
    images.push(Object.freeze({ role: 'background', url: definition.imagePath, blob: record.backgroundImage }));
  } else if (record.kind === 'board' && record.boardImage && definition.kind === 'board') {
    images.push(Object.freeze({ role: 'board', url: definition.imagePath, blob: record.boardImage }));
  } else if (record.kind === 'board-frame' && record.boardFrameImage && definition.kind === 'board-frame') {
    images.push(Object.freeze({ role: 'board-frame', url: definition.imagePath, blob: record.boardFrameImage }));
  } else if (record.kind === 'stone' && record.blackImage && record.whiteImage && definition.kind === 'stone') {
    images.push(Object.freeze({ role: 'black-stone', url: definition.blackImagePath, blob: record.blackImage }));
    images.push(Object.freeze({ role: 'white-stone', url: definition.whiteImagePath, blob: record.whiteImage }));
  } else {
    return null;
  }
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    contentFingerprint: String(definition.contentFingerprint || fallbackRecordContentFingerprint(record)),
    images: Object.freeze(images)
  });
}

function acquireCustomSkinObjectUrlLease(
  rootRef: any,
  skinId: string,
  expectedUrls?: readonly string[]
): CustomSkinObjectUrlLease | null {
  const root = resolveRootRef(rootRef);
  const state = getState(root);
  const normalizedId = String(skinId || '').trim();
  if (!state || !isCustomSkinId(normalizedId)) return null;
  const currentUrls = (state.objectUrls.get(normalizedId) || []).slice();
  const requestedUrls = Array.from(new Set(
    (Array.isArray(expectedUrls) ? expectedUrls : currentUrls)
      .map((url) => String(url || '').trim())
      .filter(Boolean)
  ));
  if (requestedUrls.length === 0) {
    throw createError('カスタムスキン画像URLが見つかりません', 'object-url-missing');
  }
  for (const url of requestedUrls) {
    const resource = state.objectUrlResources.get(url);
    if (!currentUrls.includes(url) || !resource || resource.skinId !== normalizedId || resource.pendingRevoke) {
      throw createError('カスタムスキン画像URLが更新済みです', 'object-url-stale');
    }
  }
  requestedUrls.forEach((url) => {
    const resource = state.objectUrlResources.get(url)!;
    resource.leaseCount += 1;
  });
  const id = state.nextObjectUrlLeaseId++;
  const urls = Object.freeze(requestedUrls.slice());
  state.objectUrlLeases.set(id, { id, skinId: normalizedId, urls });
  return Object.freeze({
    id,
    skinId: normalizedId,
    urls,
    release: () => releaseCustomSkinObjectUrlLease(root, id)
  });
}

function releaseCustomSkinObjectUrlLease(rootRef: any, leaseOrId: CustomSkinObjectUrlLease | number): boolean {
  const root = resolveRootRef(rootRef);
  const state = getState(root);
  const id = typeof leaseOrId === 'number' ? leaseOrId : Number(leaseOrId && leaseOrId.id);
  const lease = state && state.objectUrlLeases.get(id);
  if (!state || !lease) return false;
  state.objectUrlLeases.delete(id);
  lease.urls.forEach((url) => {
    const resource = state.objectUrlResources.get(url);
    if (!resource) return;
    resource.leaseCount = Math.max(0, resource.leaseCount - 1);
    if (resource.pendingRevoke && resource.leaseCount === 0) revokeObjectUrlNow(root, url, state);
  });
  return true;
}

function getCustomSkinObjectUrlLeaseDiagnostics(rootRef: any): Readonly<{
  activeLeaseCount: number;
  retainedUrlCount: number;
  pendingRevokeCount: number;
}> {
  const state = getState(rootRef);
  if (!state) return Object.freeze({ activeLeaseCount: 0, retainedUrlCount: 0, pendingRevokeCount: 0 });
  let pendingRevokeCount = 0;
  state.objectUrlResources.forEach((resource) => {
    if (resource.pendingRevoke) pendingRevokeCount += 1;
  });
  return Object.freeze({
    activeLeaseCount: state.objectUrlLeases.size,
    retainedUrlCount: state.objectUrlResources.size,
    pendingRevokeCount
  });
}

async function saveCustomSkin(rootRef: any, input: SaveCustomSkinInput): Promise<CustomSkinDefinition> {
  const root = resolveRootRef(rootRef);
  const state = getState(root);
  if (!state) throw createError('個人保存を利用できません', 'storage-unavailable');
  const validated = validateInput(input);
  const existingId = String(input.id || '').trim();
  const existing = existingId ? state.records.get(existingId) : undefined;
  if (existingId && (!existing || existing.kind !== validated.kind || !isCustomSkinId(existingId, validated.kind))) {
    throw createError('更新対象のカスタムスキンが見つかりません', 'missing-record');
  }
  const now = new Date().toISOString();
  const record: CustomSkinRecord = {
    ...(existing || {}),
    id: existing ? existing.id : createSkinId(validated.kind, root),
    kind: validated.kind,
    label: validated.label,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  if (validated.kind === 'background') record.backgroundImage = input.backgroundImage;
  if (validated.kind === 'board') record.boardImage = input.boardImage;
  if (validated.kind === 'board-frame') record.boardFrameImage = input.boardFrameImage;
  if (validated.kind === 'stone') {
    record.blackImage = input.blackImage;
    record.whiteImage = input.whiteImage;
  }
  record.contentFingerprint = await computeRecordContentFingerprint(record);
  await putRecord(root, record);
  const definition = replaceCachedRecord(root, record, state);
  state.hydrated = true;
  notify(state);
  return { ...definition };
}

async function deleteCustomSkin(rootRef: any, skinId: string): Promise<boolean> {
  const root = resolveRootRef(rootRef);
  const state = getState(root);
  const normalizedId = String(skinId || '').trim();
  if (!state || !isCustomSkinId(normalizedId)) return false;
  if (!state.records.has(normalizedId)) return false;
  await deleteRecord(root, normalizedId);
  revokeObjectUrls(root, normalizedId, state);
  state.records.delete(normalizedId);
  state.definitions.delete(normalizedId);
  notify(state);
  return true;
}

function subscribeCustomSkins(rootRef: any, listener: () => void): () => void {
  const state = getState(rootRef);
  if (!state || typeof listener !== 'function') return () => undefined;
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function isCustomSkin(value: unknown, kind?: CustomSkinKind): boolean {
  return isCustomSkinId(value, kind);
}

export = {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  CUSTOM_SKIN_ID_PREFIX,
  MAX_CUSTOM_SKIN_IMAGE_BYTES,
  MAX_CUSTOM_SKIN_NAME_LENGTH,
  ACCEPTED_IMAGE_TYPES,
  normalizeKind,
  normalizeLabel,
  isCustomSkin,
  loadCustomSkins,
  getCustomSkinDefinitions,
  getCustomSkinRecord,
  getCustomSkinResourceDescriptor,
  acquireCustomSkinObjectUrlLease,
  releaseCustomSkinObjectUrlLease,
  getCustomSkinObjectUrlLeaseDiagnostics,
  saveCustomSkin,
  deleteCustomSkin,
  subscribeCustomSkins
};
