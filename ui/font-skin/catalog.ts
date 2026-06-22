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
    id: 'shippori-mincho',
    label: '既定',
    note: '和風・物語調のカード名に合う上品な明朝',
    fontFamily: '"CR-Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
    accentFontFamily: '"CR-Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
    readableFontFamily: '"CR-Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
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
  }),
  Object.freeze({
    id: 'cinzel',
    label: 'Cinzel',
    note: '金属プレートや英字見出し向けの碑文風セリフ',
    fontFamily: '"CR-Cinzel", "Times New Roman", serif',
    accentFontFamily: '"CR-Cinzel", "Times New Roman", serif',
    readableFontFamily: '"Meiryo UI", "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Sans", sans-serif',
    previewText: 'Aa\nあア\n123'
  }),
  Object.freeze({
    id: 'kaisei-tokumin',
    label: 'Kaisei Tokumin',
    note: '幻想感のある太め明朝。強いカード名向け',
    fontFamily: '"CR-Kaisei Tokumin", "Yu Mincho", "Hiragino Mincho ProN", serif',
    accentFontFamily: '"CR-Kaisei Tokumin", "Yu Mincho", "Hiragino Mincho ProN", serif',
    readableFontFamily: '"CR-Kaisei Tokumin", "Yu Mincho", "Hiragino Mincho ProN", serif',
    previewText: 'Aa\nあア\n123'
  }),
  Object.freeze({
    id: 'zen-antique-soft',
    label: 'Zen Antique Soft',
    note: 'レトロで柔らかい和風セリフ',
    fontFamily: '"CR-Zen Antique Soft", "Yu Mincho", "Hiragino Mincho ProN", serif',
    accentFontFamily: '"CR-Zen Antique Soft", "Yu Mincho", "Hiragino Mincho ProN", serif',
    readableFontFamily: '"CR-Zen Antique Soft", "Yu Mincho", "Hiragino Mincho ProN", serif',
    previewText: 'Aa\nあア\n123'
  }),
  Object.freeze({
    id: 'yusei-magic',
    label: 'Yusei Magic',
    note: '軽い手書き感。コミカルなカードや演出向け',
    fontFamily: '"CR-Yusei Magic", "Yu Gothic", "Hiragino Sans", sans-serif',
    accentFontFamily: '"CR-Yusei Magic", "Yu Gothic", "Hiragino Sans", sans-serif',
    readableFontFamily: '"CR-Yusei Magic", "Yu Gothic", "Hiragino Sans", sans-serif',
    previewText: 'Aa\nあア\n123'
  }),
  Object.freeze({
    id: 'rocknroll-one',
    label: 'RocknRoll One',
    note: '太く読みやすいポップ見出し。操作ボタン向け',
    fontFamily: '"CR-RocknRoll One", "Yu Gothic", "Hiragino Sans", sans-serif',
    accentFontFamily: '"CR-RocknRoll One", "Yu Gothic", "Hiragino Sans", sans-serif',
    readableFontFamily: '"CR-RocknRoll One", "Yu Gothic", "Hiragino Sans", sans-serif',
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
  if (normalized === 'default') return DEFAULT_FONT_SKIN_ID;
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
