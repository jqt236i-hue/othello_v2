'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const STORAGE_KEY = 'othello.gacha.progress.v1';
const STATE_VERSION = 3;
const DEFAULT_OWNED_HAND_SKIN_IDS = Object.freeze(['default']);
const DEFAULT_OWNED_BACKGROUND_SKIN_IDS = Object.freeze(['default', 'unobserved-night']);
const DEFAULT_OWNED_PLACEMENT_SOUND_IDS = Object.freeze(['default']);
const OWNED_KIND_CONFIG = Object.freeze({
  hand_skin: Object.freeze({
    stateKey: 'ownedHandSkinIds',
    defaultIds: DEFAULT_OWNED_HAND_SKIN_IDS,
    sourceKeys: Object.freeze(['ownedHandSkinIds', 'ownedSkins', 'unlockedHandSkinIds'])
  }),
  background_skin: Object.freeze({
    stateKey: 'ownedBackgroundSkinIds',
    defaultIds: DEFAULT_OWNED_BACKGROUND_SKIN_IDS,
    sourceKeys: Object.freeze(['ownedBackgroundSkinIds', 'unlockedBackgroundSkinIds'])
  }),
  placement_sound: Object.freeze({
    stateKey: 'ownedPlacementSoundIds',
    defaultIds: DEFAULT_OWNED_PLACEMENT_SOUND_IDS,
    sourceKeys: Object.freeze(['ownedPlacementSoundIds', 'unlockedPlacementSoundIds'])
  })
} as any);
const OWNED_KIND_ORDER = Object.freeze(['hand_skin', 'background_skin', 'placement_sound']);

let ObservationGachaCatalogSharedModule: any = null;
if (typeof _require === 'function') {
  try {
    ObservationGachaCatalogSharedModule = _require('../../shared/observation-gacha-catalog-shared.js');
  } catch (e) { /* ignore */ }
}
if (!ObservationGachaCatalogSharedModule) {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogSharedModule) {
      ObservationGachaCatalogSharedModule = (globalThis as any).ObservationGachaCatalogSharedModule;
    }
  } catch (e) { /* ignore */ }
}

function toNonNegativeInteger(value: any, fallback: any): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.floor(Number(fallback) || 0));
  return Math.max(0, Math.floor(numeric));
}

function normalizeOwnedCatalogItemId(value: any): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (ObservationGachaCatalogSharedModule && typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemId === 'function') {
    return ObservationGachaCatalogSharedModule.normalizeCatalogItemId(normalized);
  }
  return normalized;
}

function normalizeCatalogItemKind(value: any): string {
  if (ObservationGachaCatalogSharedModule && typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemKind === 'function') {
    return ObservationGachaCatalogSharedModule.normalizeCatalogItemKind(value);
  }
  return String(value || '').trim().toLowerCase();
}

function getOwnedKindConfig(kind: any): any {
  const normalizedKind = normalizeCatalogItemKind(kind);
  return normalizedKind && Object.prototype.hasOwnProperty.call(OWNED_KIND_CONFIG, normalizedKind)
    ? (OWNED_KIND_CONFIG as any)[normalizedKind]
    : null;
}

function normalizeOwnedIds(value: any, defaultIds: any): Record<string, boolean> {
  const owned: Record<string, boolean> = {};
  (Array.isArray(defaultIds) ? defaultIds : []).forEach((itemId: any) => {
    const normalizedDefaultId = normalizeOwnedCatalogItemId(itemId);
    if (!normalizedDefaultId) return;
    owned[normalizedDefaultId] = true;
  });

  if (Array.isArray(value)) {
    value.forEach((itemId: any) => {
      const normalized = normalizeOwnedCatalogItemId(itemId);
      if (!normalized) return;
      owned[normalized] = true;
    });
    return owned;
  }

  if (!value || typeof value !== 'object') return owned;

  Object.entries(value).forEach(([itemId, flag]) => {
    const normalized = normalizeOwnedCatalogItemId(itemId);
    if (!normalized) return;
    owned[normalized] = owned[normalized] === true || flag === true;
  });
  (Array.isArray(defaultIds) ? defaultIds : []).forEach((itemId: any) => {
    const normalizedDefaultId = normalizeOwnedCatalogItemId(itemId);
    if (!normalizedDefaultId) return;
    owned[normalizedDefaultId] = true;
  });
  return owned;
}

function resolveOwnedValueFromSource(source: any, config: any): any {
  const sourceRef = (source && typeof source === 'object') ? source : {};
  const safeConfig = (config && typeof config === 'object') ? config : null;
  const sourceKeys = safeConfig && Array.isArray(safeConfig.sourceKeys) ? safeConfig.sourceKeys : [];
  for (let index = 0; index < sourceKeys.length; index += 1) {
    const key = sourceKeys[index];
    if (Object.prototype.hasOwnProperty.call(sourceRef, key)) {
      return (sourceRef as any)[key];
    }
  }
  return null;
}

function createDefaultState(): any {
  const state: any = {
    version: STATE_VERSION,
    observationStones: 0,
    totalPullCount: 0,
    totalObservationEarned: 0
  };
  (OWNED_KIND_ORDER as any).forEach((kind: string) => {
    const config = (OWNED_KIND_CONFIG as any)[kind];
    state[config.stateKey] = normalizeOwnedIds(null, config.defaultIds);
  });
  return state;
}

function normalizeState(rawState: any): any {
  const source = (rawState && typeof rawState === 'object') ? rawState : {};
  const normalized: any = {
    version: STATE_VERSION,
    observationStones: toNonNegativeInteger(source.observationStones, 0),
    totalPullCount: toNonNegativeInteger(source.totalPullCount, 0),
    totalObservationEarned: toNonNegativeInteger(source.totalObservationEarned, 0)
  };
  (OWNED_KIND_ORDER as any).forEach((kind: string) => {
    const config = (OWNED_KIND_CONFIG as any)[kind];
    normalized[config.stateKey] = normalizeOwnedIds(resolveOwnedValueFromSource(source, config), config.defaultIds);
  });
  return normalized;
}

function resolveStorage(rootRef: any): Storage | null {
  try {
    if (rootRef && rootRef.localStorage) return rootRef.localStorage;
  } catch (e) { /* ignore */ }

  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* ignore */ }

  return null;
}

function exposeStorageModule(rootRef: any): void {
  try {
    if (!rootRef || typeof rootRef !== 'object') return;
    if (!rootRef.GachaProgressStorage) rootRef.GachaProgressStorage = GachaProgressStorage;
    if (!rootRef.GachaProgressStorageModule) rootRef.GachaProgressStorageModule = GachaProgressStorage;
  } catch (e) { /* ignore */ }
}

function readState(rootRef: any): any {
  exposeStorageModule(rootRef);
  const storage = resolveStorage(rootRef);
  if (!storage) return createDefaultState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    return createDefaultState();
  }
}

function writeState(rootRef: any, nextState: any): any {
  exposeStorageModule(rootRef);
  const normalized = normalizeState(nextState);
  const storage = resolveStorage(rootRef);
  if (!storage) return normalized;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) { /* ignore */ }
  return normalized;
}

function getObservationStones(rootRef: any): number {
  return readState(rootRef).observationStones;
}

function listOwnedIds(rootRef: any, kind: any): string[] {
  const config = getOwnedKindConfig(kind);
  if (!config) return [];
  const state = readState(rootRef);
  return Object.keys(state[config.stateKey]).filter((itemId: string) => state[config.stateKey][itemId] === true);
}

function listOwnedHandSkinIds(rootRef: any): string[] {
  return listOwnedIds(rootRef, 'hand_skin');
}

function listOwnedPlacementSoundIds(rootRef: any): string[] {
  return listOwnedIds(rootRef, 'placement_sound');
}

function listOwnedBackgroundSkinIds(rootRef: any): string[] {
  return listOwnedIds(rootRef, 'background_skin');
}

function isOwnedId(rootRef: any, kind: any, itemId: any): boolean {
  const config = getOwnedKindConfig(kind);
  if (!config) return false;
  const normalized = normalizeOwnedCatalogItemId(itemId);
  if (!normalized) return false;
  const state = readState(rootRef);
  return state[config.stateKey][normalized] === true;
}

function isHandSkinOwned(rootRef: any, skinId: any): boolean {
  return isOwnedId(rootRef, 'hand_skin', skinId);
}

function isPlacementSoundOwned(rootRef: any, soundId: any): boolean {
  return isOwnedId(rootRef, 'placement_sound', soundId);
}

function isBackgroundSkinOwned(rootRef: any, skinId: any): boolean {
  return isOwnedId(rootRef, 'background_skin', skinId);
}

function awardObservationStones(rootRef: any, amount: any): any {
  const add = toNonNegativeInteger(amount, 0);
  const state = readState(rootRef);
  state.observationStones += add;
  state.totalObservationEarned += add;
  return writeState(rootRef, state);
}

function spendObservationStones(rootRef: any, amount: any): any {
  const cost = toNonNegativeInteger(amount, 0);
  const state = readState(rootRef);
  if (state.observationStones < cost) {
    return {
      ok: false,
      state,
      missing: cost - state.observationStones
    };
  }

  state.observationStones -= cost;
  return {
    ok: true,
    state: writeState(rootRef, state)
  };
}

function unlockOwnedIds(rootRef: any, kind: any, itemIds: any): any {
  const config = getOwnedKindConfig(kind);
  if (!config) {
    return {
      state: readState(rootRef),
      newlyUnlockedIds: [],
      alreadyOwnedIds: []
    };
  }
  const state = readState(rootRef);
  const newlyUnlockedIds: string[] = [];
  const alreadyOwnedIds: string[] = [];
  const ownedRecord = state[config.stateKey];

  (Array.isArray(itemIds) ? itemIds : []).forEach((itemId: any) => {
    const normalized = normalizeOwnedCatalogItemId(itemId);
    if (!normalized) return;
    if (ownedRecord[normalized] === true) {
      alreadyOwnedIds.push(normalized);
      return;
    }
    ownedRecord[normalized] = true;
    newlyUnlockedIds.push(normalized);
  });

  return {
    state: writeState(rootRef, state),
    newlyUnlockedIds,
    alreadyOwnedIds
  };
}

function unlockHandSkinIds(rootRef: any, skinIds: any): any {
  return unlockOwnedIds(rootRef, 'hand_skin', skinIds);
}

function unlockPlacementSoundIds(rootRef: any, soundIds: any): any {
  return unlockOwnedIds(rootRef, 'placement_sound', soundIds);
}

function unlockBackgroundSkinIds(rootRef: any, skinIds: any): any {
  return unlockOwnedIds(rootRef, 'background_skin', skinIds);
}

function resolveOwnedRecordForKind(state: any, kind: any): any {
  const config = getOwnedKindConfig(kind);
  return config
    ? {
      ownedRecord: state[config.stateKey],
      normalizeId: normalizeOwnedCatalogItemId
    }
    : null;
}

function applyPullResults(rootRef: any, pulls: any): any {
  const state = readState(rootRef);
  const newlyUnlockedIds: string[] = [];
  const alreadyOwnedIds: string[] = [];
  const safePulls = Array.isArray(pulls) ? pulls : [];

  state.totalPullCount += safePulls.length;
  safePulls.forEach((pull: any) => {
    const item = pull && pull.item && typeof pull.item === 'object' ? pull.item : null;
    const kind = normalizeCatalogItemKind(item && item.kind);
    const candidateId = pull && pull.item ? pull.item.id : pull && pull.id;
    const target = resolveOwnedRecordForKind(state, kind);
    if (!target) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[gacha-progress] ignored pull result for unknown cosmetic kind', kind, candidateId);
      }
      return;
    }
    const normalized = target.normalizeId(candidateId);
    if (!normalized) return;
    const targetOwned = target.ownedRecord;
    if (targetOwned[normalized] === true) {
      alreadyOwnedIds.push(normalized);
      return;
    }
    targetOwned[normalized] = true;
    newlyUnlockedIds.push(normalized);
  });

  return {
    state: writeState(rootRef, state),
    newlyUnlockedIds,
    alreadyOwnedIds
  };
}

const GachaProgressStorage = {
  STORAGE_KEY,
  STATE_VERSION,
  DEFAULT_OWNED_HAND_SKIN_IDS,
  DEFAULT_OWNED_BACKGROUND_SKIN_IDS,
  createDefaultState,
  normalizeState,
  readState,
  writeState,
  getObservationStones,
  listOwnedHandSkinIds,
  listOwnedBackgroundSkinIds,
  listOwnedPlacementSoundIds,
  isHandSkinOwned,
  isBackgroundSkinOwned,
  isPlacementSoundOwned,
  awardObservationStones,
  spendObservationStones,
  unlockHandSkinIds,
  unlockBackgroundSkinIds,
  unlockPlacementSoundIds,
  applyPullResults
};

export = GachaProgressStorage;
