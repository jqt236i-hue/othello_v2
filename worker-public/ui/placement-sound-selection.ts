'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PLACEMENT_SOUND_STORAGE_KEY = 'othello.placementSound';
const DEFAULT_PLACEMENT_SOUND_ID = 'default';
const DEFAULT_PLACEMENT_SOUND_DEFINITION = Object.freeze({
  id: 'default',
  label: '既定配置音',
  kind: 'placement_sound',
  assetPath: 'assets/audio/sound-effect-skin/default.mp3',
  soundPath: 'assets/audio/sound-effect-skin/default.mp3',
  previewImagePath: '',
  note: '既定の石置き音'
});
let selectedPlacementSoundId = DEFAULT_PLACEMENT_SOUND_ID;

function resolveRootRef(rootRef: any): any {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveStorage(rootRef: any): Storage | null {
  const ctx = resolveRootRef(rootRef);
  try {
    if (ctx && ctx.localStorage) return ctx.localStorage;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveObservationCatalogAccessModule(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.ObservationGachaCatalogAccessModule) {
    return ctx.ObservationGachaCatalogAccessModule;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogAccessModule) {
      return (globalThis as any).ObservationGachaCatalogAccessModule;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('./gacha/catalog-access.js');
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaProgressStorageModule(rootRef: any): any {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.GachaProgressStorageModule) return ctx.GachaProgressStorageModule;
  if (ctx && ctx.GachaProgressStorage) return ctx.GachaProgressStorage;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaProgressStorageModule) {
      return (globalThis as any).GachaProgressStorageModule;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaProgressStorage) {
      return (globalThis as any).GachaProgressStorage;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('./storage/gacha-progress.js');
  } catch (e) { /* ignore */ }
  return null;
}

function normalizePlacementSoundId(value: any): string {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_PLACEMENT_SOUND_ID;
}

function clonePlacementSoundDefinition(definition?: any): any {
  const source = definition && typeof definition === 'object'
    ? definition
    : DEFAULT_PLACEMENT_SOUND_DEFINITION;
  const assetPath = String(source.assetPath || source.soundPath || (DEFAULT_PLACEMENT_SOUND_DEFINITION as any).assetPath).trim();
  return {
    id: normalizePlacementSoundId(source.id),
    label: String(source.label || '').trim() || '配置音',
    kind: 'placement_sound',
    assetPath,
    soundPath: String(source.soundPath || assetPath).trim() || assetPath,
    previewImagePath: String(source.previewImagePath || source.imagePath || '').trim(),
    note: String(source.note || '').trim()
  };
}

function getDefaultPlacementSoundDefinition(): any {
  return clonePlacementSoundDefinition(DEFAULT_PLACEMENT_SOUND_DEFINITION);
}

function createPlacementSoundDefinitionFromCatalogItem(item: any): any {
  const kind = String(item && item.kind || '').trim().toLowerCase();
  if (kind !== 'placement_sound') return null;
  const assetPath = String(item && (item.assetPath || item.soundPath) || '').trim();
  if (!assetPath) return null;
  return clonePlacementSoundDefinition({
    id: item.id,
    label: item.label,
    assetPath,
    soundPath: assetPath,
    previewImagePath: item.previewImagePath || item.imagePath || '',
    note: item.note || ''
  });
}

function readStoredPlacementSoundId(rootRef: any): string {
  const storage = resolveStorage(rootRef);
  if (storage && typeof storage.getItem === 'function') {
    try {
      const stored = String(storage.getItem(PLACEMENT_SOUND_STORAGE_KEY) || '').trim();
      if (stored) return stored;
    } catch (e) { /* ignore */ }
  }
  return selectedPlacementSoundId;
}

function writeStoredPlacementSoundId(rootRef: any, soundId: string): string {
  selectedPlacementSoundId = normalizePlacementSoundId(soundId);
  const storage = resolveStorage(rootRef);
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(PLACEMENT_SOUND_STORAGE_KEY, selectedPlacementSoundId);
    } catch (e) { /* ignore */ }
  }
  return selectedPlacementSoundId;
}

function listSelectablePlacementSounds(options: any = {}): any[] {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = resolveRootRef(opts.root);
  const definitions: any[] = [getDefaultPlacementSoundDefinition()];
  const seenIds = new Set([DEFAULT_PLACEMENT_SOUND_ID]);
  const ownedIds = new Set([DEFAULT_PLACEMENT_SOUND_ID]);
  const storageModule = resolveGachaProgressStorageModule(rootRef);
  if (storageModule && typeof storageModule.listOwnedPlacementSoundIds === 'function') {
    try {
      storageModule.listOwnedPlacementSoundIds(rootRef).forEach((soundId: string) => {
        ownedIds.add(normalizePlacementSoundId(soundId));
      });
    } catch (e) { /* ignore */ }
  }

  const catalogAccessModule = resolveObservationCatalogAccessModule(rootRef);
  if (catalogAccessModule && typeof catalogAccessModule.getObservationCatalogItemsByKind === 'function') {
    const catalogItems = catalogAccessModule.getObservationCatalogItemsByKind('placement_sound', { root: rootRef });
    (Array.isArray(catalogItems) ? catalogItems : []).forEach((item: any) => {
      const definition = createPlacementSoundDefinitionFromCatalogItem(item);
      if (!definition) return;
      if (!ownedIds.has(definition.id) || seenIds.has(definition.id)) return;
      seenIds.add(definition.id);
      definitions.push(definition);
    });
  }

  return definitions;
}

function isPlacementSoundOwned(soundId: string, options: any = {}): boolean {
  const normalized = normalizePlacementSoundId(soundId);
  if (normalized === DEFAULT_PLACEMENT_SOUND_ID) return true;
  return listSelectablePlacementSounds(options).some((definition) => definition.id === normalized);
}

function getSelectedPlacementSoundId(options: any = {}): string {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = resolveRootRef(opts.root);
  const normalized = normalizePlacementSoundId(readStoredPlacementSoundId(rootRef));
  if (isPlacementSoundOwned(normalized, { root: rootRef })) {
    return normalized;
  }
  return setSelectedPlacementSoundId(DEFAULT_PLACEMENT_SOUND_ID, { root: rootRef });
}

function setSelectedPlacementSoundId(soundId: string, options: any = {}): string {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = resolveRootRef(opts.root);
  const normalized = normalizePlacementSoundId(soundId);
  const nextId = isPlacementSoundOwned(normalized, { root: rootRef })
    ? normalized
    : DEFAULT_PLACEMENT_SOUND_ID;
  return writeStoredPlacementSoundId(rootRef, nextId);
}

function getSelectedPlacementSoundDefinition(options: any = {}): any {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = resolveRootRef(opts.root);
  const selectedId = Object.prototype.hasOwnProperty.call(opts, 'soundId')
    ? normalizePlacementSoundId(opts.soundId)
    : getSelectedPlacementSoundId({ root: rootRef });
  const definitions = listSelectablePlacementSounds({ root: rootRef });
  return definitions.find((definition) => definition.id === selectedId)
    || definitions[0]
    || getDefaultPlacementSoundDefinition();
}

function resolveSelectedPlacementSoundFilePath(options: any = {}): string {
  return getSelectedPlacementSoundDefinition(options).assetPath;
}

const PlacementSoundSelection = {
  PLACEMENT_SOUND_STORAGE_KEY,
  DEFAULT_PLACEMENT_SOUND_ID,
  DEFAULT_PLACEMENT_SOUND_DEFINITION,
  normalizePlacementSoundId,
  getDefaultPlacementSoundDefinition,
  listSelectablePlacementSounds,
  isPlacementSoundOwned,
  readStoredPlacementSoundId,
  writeStoredPlacementSoundId,
  getSelectedPlacementSoundId,
  setSelectedPlacementSoundId,
  getSelectedPlacementSoundDefinition,
  resolveSelectedPlacementSoundFilePath
};

export = PlacementSoundSelection;
