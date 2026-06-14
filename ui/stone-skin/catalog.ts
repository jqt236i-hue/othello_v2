/**
 * @file catalog.ts
 * @description Normal stone skin catalog
 */

interface StoneSkinItem {
  id: string;
  label: string;
  note: string;
  blackImagePath: string;
  whiteImagePath: string;
}

const BASE_STONE_SKINS: readonly StoneSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'default',
    label: '既定石',
    note: '初期所持',
    blackImagePath: 'assets/images/stones/normal_stone-black.png',
    whiteImagePath: 'assets/images/stones/normal_stone-white.png'
  }),
  Object.freeze({
    id: 'o-stone',
    label: 'O石',
    note: '初期所持',
    blackImagePath: 'assets/images/stone-skin/o-stone/black.png',
    whiteImagePath: 'assets/images/stone-skin/o-stone/white.png'
  })
]);

const STONE_SKINS = BASE_STONE_SKINS.slice();
const DEFAULT_STONE_SKIN_ID = BASE_STONE_SKINS[0].id;

function cloneSkin(skin: StoneSkinItem): StoneSkinItem {
  return { ...skin };
}

function normalizeCatalogStoneSkinId(value: unknown): string {
  return String(value || '').trim();
}

function getAllStoneSkins(): StoneSkinItem[] {
  return STONE_SKINS.map(cloneSkin);
}

function listOwnedStoneSkinIds(): string[] {
  return STONE_SKINS.map((skin) => skin.id);
}

function isStoneSkinOwned(_rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogStoneSkinId(skinId);
  return STONE_SKINS.some((skin) => skin.id === normalized);
}

function getOwnedStoneSkins(): StoneSkinItem[] {
  return getAllStoneSkins();
}

function normalizeStoneSkinId(value: unknown): string {
  const normalized = normalizeCatalogStoneSkinId(value);
  return STONE_SKINS.some((skin) => skin.id === normalized) ? normalized : DEFAULT_STONE_SKIN_ID;
}

function getStoneSkinDefinition(skinId: string): StoneSkinItem | null {
  const normalized = normalizeStoneSkinId(skinId);
  const found = STONE_SKINS.find((skin) => skin.id === normalized) || STONE_SKINS[0] || null;
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
