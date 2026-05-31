/**
 * @file catalog.ts
 * @description Font skin catalog
 */

interface FontSkinItem {
  id: string;
  label: string;
  note: string;
  fontFamily: string;
  accentFontFamily?: string;
  readableFontFamily?: string;
  previewText?: string;
}

const BASE_FONT_SKINS: readonly FontSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'default',
    label: '既定フォント',
    note: '初期設定',
    fontFamily: '"Segoe UI", serif',
    accentFontFamily: '"Meiryo UI", "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Sans", sans-serif',
    readableFontFamily: '"Meiryo UI", "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Sans", sans-serif',
    previewText: 'Aa\nあア\n123'
  }),
  Object.freeze({
    id: 'dot-gothic',
    label: 'DotGothic16',
    note: '同梱ドット文字（小本文・漢字名は可読優先）',
    fontFamily: '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace',
    accentFontFamily: '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace',
    readableFontFamily: '"Meiryo UI", "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Sans", sans-serif',
    previewText: 'Aa\nあア\n123'
  })
]);

const FONT_SKINS = BASE_FONT_SKINS.slice();
const DEFAULT_FONT_SKIN_ID = BASE_FONT_SKINS[0].id;

function normalizeCatalogFontSkinId(value: unknown): string {
  return String(value || '').trim();
}

function getAllFontSkins(): FontSkinItem[] {
  return FONT_SKINS.map((item) => ({ ...item }));
}

function listOwnedFontSkinIds(): string[] {
  return FONT_SKINS.map((item) => item.id);
}

function isFontSkinOwned(_rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogFontSkinId(skinId);
  return FONT_SKINS.some((item) => item.id === normalized);
}

function getOwnedFontSkins(): FontSkinItem[] {
  return getAllFontSkins();
}

function normalizeFontSkinId(value: unknown): string {
  const normalized = normalizeCatalogFontSkinId(value);
  return FONT_SKINS.some((item) => item.id === normalized) ? normalized : DEFAULT_FONT_SKIN_ID;
}

function getFontSkinDefinition(skinId: string): FontSkinItem | null {
  const normalized = normalizeFontSkinId(skinId);
  const found = FONT_SKINS.find((item) => item.id === normalized) || FONT_SKINS[0] || null;
  return found ? { ...found } : null;
}

export = {
  BASE_FONT_SKINS,
  FONT_SKINS,
  DEFAULT_FONT_SKIN_ID,
  normalizeCatalogFontSkinId,
  getAllFontSkins,
  listOwnedFontSkinIds,
  isFontSkinOwned,
  getOwnedFontSkins,
  normalizeFontSkinId,
  getFontSkinDefinition
};
