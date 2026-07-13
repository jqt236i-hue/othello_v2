/**
 * @file catalog.ts
 * @description Normal stone skin catalog
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoneSkinItem {
  id: string;
  label: string;
  note: string;
  blackImagePath: string;
  whiteImagePath: string;
}

interface CustomSkinStorageModule {
  getCustomSkinDefinitions?: (rootRef: Window, kind?: string) => StoneSkinItem[];
}

const BASE_STONE_SKINS: readonly StoneSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'default',
    label: 'クラシック石',
    note: '初期所持',
    blackImagePath: 'assets/images/stone-skin/default/black.png',
    whiteImagePath: 'assets/images/stone-skin/default/white.png'
  }),
  Object.freeze({
    id: 'o-stone',
    label: '既定',
    note: '初期所持',
    blackImagePath: 'assets/images/stone-skin/o-stone/black.png',
    whiteImagePath: 'assets/images/stone-skin/o-stone/white.png'
  }),
  Object.freeze({
    id: 'jade-rim',
    label: '碧縁石',
    note: '青緑盤に合わせた黒曜石と白玉石',
    blackImagePath: 'assets/images/stone-skin/jade-rim/black.png',
    whiteImagePath: 'assets/images/stone-skin/jade-rim/white.png'
  }),
  Object.freeze({
    id: 'pearl-obsidian',
    label: '真珠黒曜石',
    note: '金縁の黒曜石と真珠石',
    blackImagePath: 'assets/images/stone-skin/pearl-obsidian/black.png',
    whiteImagePath: 'assets/images/stone-skin/pearl-obsidian/white.png'
  })
]);

const STONE_SKINS = BASE_STONE_SKINS.slice();
const DEFAULT_STONE_SKIN_ID = 'o-stone';

function resolveCustomSkinStorageModule(rootRef?: Window | null): CustomSkinStorageModule | null {
  try {
    const ctx = rootRef as Window & { CustomSkinStorageModule?: CustomSkinStorageModule };
    if (ctx && ctx.CustomSkinStorageModule) return ctx.CustomSkinStorageModule;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule) {
      return (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../custom-skin/storage');
  } catch (e) { /* ignore */ }
  return null;
}

function resolveCustomSkinRoot(rootRef?: Window | null): Window | null {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis as unknown as Window;
  } catch (e) { /* ignore */ }
  return null;
}

function getCustomStoneSkins(rootRef?: Window | null): StoneSkinItem[] {
  const root = resolveCustomSkinRoot(rootRef);
  const storage = root ? resolveCustomSkinStorageModule(root) : null;
  if (!root || !storage || typeof storage.getCustomSkinDefinitions !== 'function') return [];
  return storage.getCustomSkinDefinitions(root, 'stone')
    .filter((item): item is StoneSkinItem => (
      !!item
      && String(item.blackImagePath || '').trim() !== ''
      && String(item.whiteImagePath || '').trim() !== ''
    ))
    .map((item) => ({ ...item }));
}

function cloneSkin(skin: StoneSkinItem): StoneSkinItem {
  return { ...skin };
}

function normalizeCatalogStoneSkinId(value: unknown): string {
  return String(value || '').trim();
}

function getAllStoneSkins(rootRef?: Window | null): StoneSkinItem[] {
  return STONE_SKINS.map(cloneSkin).concat(getCustomStoneSkins(rootRef));
}

function listOwnedStoneSkinIds(rootRef?: Window | null): string[] {
  return getAllStoneSkins(rootRef).map((skin) => skin.id);
}

function isStoneSkinOwned(rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogStoneSkinId(skinId);
  return getAllStoneSkins(rootRef).some((skin) => skin.id === normalized);
}

function getOwnedStoneSkins(rootRef?: Window | null): StoneSkinItem[] {
  return getAllStoneSkins(rootRef);
}

function normalizeStoneSkinId(value: unknown, rootRef?: Window | null): string {
  const normalized = normalizeCatalogStoneSkinId(value);
  return getAllStoneSkins(rootRef).some((skin) => skin.id === normalized) ? normalized : DEFAULT_STONE_SKIN_ID;
}

function getStoneSkinDefinition(skinId: string, rootRef?: Window | null): StoneSkinItem | null {
  const normalized = normalizeStoneSkinId(skinId, rootRef);
  const found = getAllStoneSkins(rootRef).find((skin) => skin.id === normalized) || STONE_SKINS[0] || null;
  return found ? cloneSkin(found) : null;
}

export = {
  BASE_STONE_SKINS,
  STONE_SKINS,
  DEFAULT_STONE_SKIN_ID,
  normalizeCatalogStoneSkinId,
  getAllStoneSkins,
  listOwnedStoneSkinIds,
  isStoneSkinOwned,
  getOwnedStoneSkins,
  normalizeStoneSkinId,
  getStoneSkinDefinition
};
