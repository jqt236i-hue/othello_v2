/**
 * @file catalog.ts
 * @description Board surface skin catalog
 */

interface BoardSkinItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

interface BoardFrameSkinItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

const BASE_BOARD_SKINS: readonly BoardSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'emerald-stone',
    label: '翠石盤',
    note: '暗いエメラルド石板の盤面下地',
    imagePath: 'assets/images/board/board-surface-emerald-v1.png'
  }),
  Object.freeze({
    id: 'moss-stone',
    label: '苔石盤',
    note: '控えめな苔色の石板下地',
    imagePath: 'assets/images/board/board-surface-moss-v1.png'
  }),
  Object.freeze({
    id: 'soft-felt',
    label: '深緑布盤',
    note: '目に優しい深緑フェルトの盤面下地',
    imagePath: 'assets/images/board/board-surface-soft-felt-v1.png'
  }),
  Object.freeze({
    id: 'woven-felt',
    label: '織翠布盤',
    note: '控えめな織り模様を持つ深緑フェルト下地',
    imagePath: 'assets/images/board/board-surface-woven-felt-v1.png'
  }),
  Object.freeze({
    id: 'stone-inlay',
    label: '象嵌石盤',
    note: '沈んだ幾何意匠を含む緑石の盤面下地',
    imagePath: 'assets/images/board/board-surface-stone-inlay-v1.png'
  }),
  Object.freeze({
    id: 'brushed-lacquer',
    label: '刷毛漆盤',
    note: '刷毛跡を抑えた黒緑漆の盤面下地',
    imagePath: 'assets/images/board/board-surface-brushed-lacquer-v1.png'
  }),
  Object.freeze({
    id: 'mica-washi',
    label: '雲母和紙盤',
    note: '淡い雲母感を含む和紙調の緑下地',
    imagePath: 'assets/images/board/board-surface-mica-washi-v1.png'
  }),
  Object.freeze({
    id: 'aged-board',
    label: '古緑遊盤',
    note: '使い込まれた遊戯盤の緑パティナ下地',
    imagePath: 'assets/images/board/board-surface-aged-board-v1.png'
  }),
  Object.freeze({
    id: 'teal-jade',
    label: '青碧盤',
    note: '青緑の翡翠質感を抑えた下地',
    imagePath: 'assets/images/board/board-surface-teal-jade-v1.png'
  }),
  Object.freeze({
    id: 'black-green-lacquer',
    label: '黒緑漆盤',
    note: '暗い黒緑の漆石風下地',
    imagePath: 'assets/images/board/board-surface-black-green-lacquer-v1.png'
  }),
  Object.freeze({
    id: 'cyan-obsidian',
    label: '蒼黒曜盤',
    note: '黒曜石に青緑光が走る幻想下地',
    imagePath: 'assets/images/board/board-surface-cyan-obsidian-v1.png'
  }),
  Object.freeze({
    id: 'verdigris-jade',
    label: '緑青翡翠盤',
    note: '緑青と翡翠の装飾感ある下地',
    imagePath: 'assets/images/board/board-surface-verdigris-jade-v1.png'
  }),
  Object.freeze({
    id: 'celestial-green-stone',
    label: '星翠盤',
    note: '星雲のような緑石の下地',
    imagePath: 'assets/images/board/board-surface-celestial-green-v1.png'
  })
]);

const BOARD_SKINS = BASE_BOARD_SKINS.slice();
const DEFAULT_BOARD_SKIN_ID = 'woven-felt';

const BASE_BOARD_FRAME_SKINS: readonly BoardFrameSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'black-gold-lacquer',
    label: '黒金漆枠',
    note: '黒漆と金装飾の盤面外フレーム',
    imagePath: 'assets/images/board/board-frame-black-gold-lacquer-v1.png'
  }),
  Object.freeze({
    id: 'compact-brass-clean-corners',
    label: '重厚黒金枠',
    note: '黒鉄と古金金具の角が干渉しない盤面外フレーム',
    imagePath: 'assets/images/board/board-frame-compact-brass-clean-corners-v3.png'
  }),
  Object.freeze({
    id: 'compact-iron-clean-corners',
    label: '黒鉄鋲留枠',
    note: '黒鉄の鋲留めと直線内枠の盤面外フレーム',
    imagePath: 'assets/images/board/board-frame-compact-iron-clean-corners-v3.png'
  }),
  Object.freeze({
    id: 'compact-gold-clean-corners',
    label: '黒金装飾枠',
    note: '黒漆と金装飾を抑えた盤面外フレーム',
    imagePath: 'assets/images/board/board-frame-compact-gold-clean-corners-v3.png'
  })
]);

const BOARD_FRAME_SKINS = BASE_BOARD_FRAME_SKINS.slice();
const DEFAULT_BOARD_FRAME_SKIN_ID = 'black-gold-lacquer';

function cloneSkin(skin: BoardSkinItem): BoardSkinItem {
  return { ...skin };
}

function cloneFrameSkin(skin: BoardFrameSkinItem): BoardFrameSkinItem {
  return { ...skin };
}

function normalizeCatalogBoardSkinId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeCatalogBoardFrameSkinId(value: unknown): string {
  return String(value || '').trim();
}

function getAllBoardSkins(): BoardSkinItem[] {
  return BOARD_SKINS.map(cloneSkin);
}

function listOwnedBoardSkinIds(): string[] {
  return BOARD_SKINS.map((skin) => skin.id);
}

function isBoardSkinOwned(_rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogBoardSkinId(skinId);
  return BOARD_SKINS.some((skin) => skin.id === normalized);
}

function getOwnedBoardSkins(): BoardSkinItem[] {
  return getAllBoardSkins();
}

function normalizeBoardSkinId(value: unknown): string {
  const normalized = normalizeCatalogBoardSkinId(value);
  return BOARD_SKINS.some((skin) => skin.id === normalized) ? normalized : DEFAULT_BOARD_SKIN_ID;
}

function getBoardSkinDefinition(skinId: string): BoardSkinItem | null {
  const normalized = normalizeBoardSkinId(skinId);
  const found = BOARD_SKINS.find((skin) => skin.id === normalized) || BOARD_SKINS[0] || null;
  return found ? cloneSkin(found) : null;
}

function getAllBoardFrameSkins(): BoardFrameSkinItem[] {
  return BOARD_FRAME_SKINS.map(cloneFrameSkin);
}

function listOwnedBoardFrameSkinIds(): string[] {
  return BOARD_FRAME_SKINS.map((skin) => skin.id);
}

function isBoardFrameSkinOwned(_rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogBoardFrameSkinId(skinId);
  return BOARD_FRAME_SKINS.some((skin) => skin.id === normalized);
}

function getOwnedBoardFrameSkins(): BoardFrameSkinItem[] {
  return getAllBoardFrameSkins();
}

function normalizeBoardFrameSkinId(value: unknown): string {
  const normalized = normalizeCatalogBoardFrameSkinId(value);
  return BOARD_FRAME_SKINS.some((skin) => skin.id === normalized) ? normalized : DEFAULT_BOARD_FRAME_SKIN_ID;
}

function getBoardFrameSkinDefinition(skinId: string): BoardFrameSkinItem | null {
  const normalized = normalizeBoardFrameSkinId(skinId);
  const found = BOARD_FRAME_SKINS.find((skin) => skin.id === normalized) || BOARD_FRAME_SKINS[0] || null;
  return found ? cloneFrameSkin(found) : null;
}

export = {
  BASE_BOARD_SKINS,
  BOARD_SKINS,
  DEFAULT_BOARD_SKIN_ID,
  BASE_BOARD_FRAME_SKINS,
  BOARD_FRAME_SKINS,
  DEFAULT_BOARD_FRAME_SKIN_ID,
  normalizeCatalogBoardSkinId,
  normalizeCatalogBoardFrameSkinId,
  getAllBoardSkins,
  listOwnedBoardSkinIds,
  isBoardSkinOwned,
  getOwnedBoardSkins,
  normalizeBoardSkinId,
  getBoardSkinDefinition,
  getAllBoardFrameSkins,
  listOwnedBoardFrameSkinIds,
  isBoardFrameSkinOwned,
  getOwnedBoardFrameSkins,
  normalizeBoardFrameSkinId,
  getBoardFrameSkinDefinition
};
