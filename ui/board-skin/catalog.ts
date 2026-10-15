/**
 * @file catalog.ts
 * @description Board surface skin catalog
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

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
  layout?: BoardFrameSkinLayout;
}

interface BoardFrameSkinLayout {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  artOverhangTop?: number;
  artOverhangBottom?: number;
  artOffsetY?: number;
}

interface CustomSkinStorageModule {
  getCustomSkinDefinitions?: (rootRef: Window, kind?: string) => Array<BoardSkinItem | BoardFrameSkinItem>;
}

const BASE_BOARD_SKINS: readonly BoardSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'bluegreen-felt',
    label: '既定',
    note: '青みを帯びた静かな布目の下地',
    imagePath: 'assets/images/board/board-surface-bluegreen-felt-v1.webp'
  }),
  Object.freeze({
    id: 'study-forest-baize',
    label: 'S1 深緑フェルト',
    note: '書斎に合う、落ち着いた深緑の布地',
    imagePath: 'assets/images/board/board-surface-study-forest-baize-v1.webp'
  }),
  Object.freeze({
    id: 'study-jade-slate',
    label: 'S2 翡翠スレート',
    note: '石が見分けやすい、少し明るい青緑の石肌',
    imagePath: 'assets/images/board/board-surface-study-jade-slate-v1.webp'
  }),
  Object.freeze({
    id: 'study-olive-leather',
    label: 'S3 オリーブレザー',
    note: '木机になじむ、暖かみのあるオリーブ色の革地',
    imagePath: 'assets/images/board/board-surface-study-olive-leather-v1.webp'
  })
]);

const BOARD_SKINS = BASE_BOARD_SKINS.slice();
const DEFAULT_BOARD_SKIN_ID = 'bluegreen-felt';

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

function getCustomBoardSkins(rootRef?: Window | null): BoardSkinItem[] {
  const root = resolveCustomSkinRoot(rootRef);
  const storage = root ? resolveCustomSkinStorageModule(root) : null;
  if (!root || !storage || typeof storage.getCustomSkinDefinitions !== 'function') return [];
  return storage.getCustomSkinDefinitions(root, 'board')
    .filter((item): item is BoardSkinItem => !!item && String(item.imagePath || '').trim() !== '')
    .map((item) => ({ ...item }));
}

function getCustomBoardFrameSkins(rootRef?: Window | null): BoardFrameSkinItem[] {
  const root = resolveCustomSkinRoot(rootRef);
  const storage = root ? resolveCustomSkinStorageModule(root) : null;
  if (!root || !storage || typeof storage.getCustomSkinDefinitions !== 'function') return [];
  return storage.getCustomSkinDefinitions(root, 'board-frame')
    .filter((item): item is BoardFrameSkinItem => !!item && String(item.imagePath || '').trim() !== '')
    .map((item) => ({ ...item }));
}

const BASE_BOARD_FRAME_SKINS: readonly BoardFrameSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'submerged-wood',
    label: '沈木枠',
    note: '濡れた沈木色のCSS外周フレーム',
    imagePath: 'assets/images/board/board-frame-submerged-wood-v1.webp',
    layout: Object.freeze({
      paddingTop: 15,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      artOffsetY: 2
    })
  }),
  Object.freeze({
    id: 'default-midnight-teal',
    label: '青緑ミニマル枠',
    note: '青緑の内縁と落ち着いた金属の枠',
    imagePath: 'assets/images/board/board-frame-default-midnight-teal-v1.webp',
    layout: Object.freeze({
      paddingTop: 50, paddingRight: 50, paddingBottom: 50, paddingLeft: 50,
      artOffsetY: 0
    })
  }),
  Object.freeze({
    id: 'default-classic-walnut',
    label: 'クラシック木枠',
    note: '胡桃材に細い真鍮の縁を添えた定番の木枠',
    imagePath: 'assets/images/board/board-frame-default-classic-walnut-v1.webp',
    layout: Object.freeze({
      paddingTop: 36, paddingRight: 36, paddingBottom: 36, paddingLeft: 36,
      artOffsetY: 0
    })
  }),
  Object.freeze({
    id: 'default-quiet-slate',
    label: '静かな石枠',
    note: '青灰色の石に控えめな青緑の細縁',
    imagePath: 'assets/images/board/board-frame-default-quiet-slate-v1.webp',
    layout: Object.freeze({
      paddingTop: 38, paddingRight: 38, paddingBottom: 38, paddingLeft: 38,
      artOffsetY: 0
    })
  }),
  Object.freeze({
    id: 'study-walnut-brass',
    label: 'F1 胡桃真鍮枠',
    note: '温かい胡桃材に、細い真鍮の縁取り',
    imagePath: 'assets/images/board/board-frame-study-walnut-brass-v1.webp',
    layout: Object.freeze({
      paddingTop: 28, paddingRight: 28, paddingBottom: 28, paddingLeft: 28,
      artOffsetY: 0
    })
  }),
  Object.freeze({
    id: 'study-ebony-jade',
    label: 'F2 黒檀翡翠枠',
    note: '黒檀に細い真鍮の縁を添えた、ほどよい幅の直線枠',
    imagePath: 'assets/images/board/board-frame-study-ebony-jade-v2.webp',
    layout: Object.freeze({
      paddingTop: 28, paddingRight: 28, paddingBottom: 28, paddingLeft: 28,
      artOverhangTop: 0, artOverhangBottom: 0,
      artOffsetY: 0
    })
  }),
  Object.freeze({
    id: 'study-grimoire-leather',
    label: 'F3 古書レザー枠',
    note: '古書の革表紙に、金色の蔓葉装飾',
    imagePath: 'assets/images/board/board-frame-study-grimoire-leather-v1.webp',
    layout: Object.freeze({
      paddingTop: 25, paddingRight: 25, paddingBottom: 25, paddingLeft: 25,
      artOffsetY: 0
    })
  })
]);

const BOARD_FRAME_SKINS = BASE_BOARD_FRAME_SKINS.slice();
const DEFAULT_BOARD_FRAME_SKIN_ID = 'submerged-wood';

function cloneSkin(skin: BoardSkinItem): BoardSkinItem {
  return { ...skin };
}

function cloneFrameSkin(skin: BoardFrameSkinItem): BoardFrameSkinItem {
  return {
    ...skin,
    layout: skin.layout ? { ...skin.layout } : undefined
  };
}

function normalizeCatalogBoardSkinId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeCatalogBoardFrameSkinId(value: unknown): string {
  return String(value || '').trim();
}

function getAllBoardSkins(rootRef?: Window | null): BoardSkinItem[] {
  return BOARD_SKINS.map(cloneSkin).concat(getCustomBoardSkins(rootRef));
}

function listOwnedBoardSkinIds(rootRef?: Window | null): string[] {
  return getAllBoardSkins(rootRef).map((skin) => skin.id);
}

function isBoardSkinOwned(rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogBoardSkinId(skinId);
  return getAllBoardSkins(rootRef).some((skin) => skin.id === normalized);
}

function getOwnedBoardSkins(rootRef?: Window | null): BoardSkinItem[] {
  return getAllBoardSkins(rootRef);
}

function normalizeBoardSkinId(value: unknown, rootRef?: Window | null): string {
  const normalized = normalizeCatalogBoardSkinId(value);
  return getAllBoardSkins(rootRef).some((skin) => skin.id === normalized) ? normalized : DEFAULT_BOARD_SKIN_ID;
}

function getBoardSkinDefinition(skinId: string, rootRef?: Window | null): BoardSkinItem | null {
  const normalized = normalizeBoardSkinId(skinId, rootRef);
  const found = getAllBoardSkins(rootRef).find((skin) => skin.id === normalized) || BOARD_SKINS[0] || null;
  return found ? cloneSkin(found) : null;
}

function getAllBoardFrameSkins(rootRef?: Window | null): BoardFrameSkinItem[] {
  return BOARD_FRAME_SKINS.map(cloneFrameSkin).concat(getCustomBoardFrameSkins(rootRef));
}

function listOwnedBoardFrameSkinIds(rootRef?: Window | null): string[] {
  return getAllBoardFrameSkins(rootRef).map((skin) => skin.id);
}

function isBoardFrameSkinOwned(rootRef: Window, skinId: string): boolean {
  const normalized = normalizeCatalogBoardFrameSkinId(skinId);
  return getAllBoardFrameSkins(rootRef).some((skin) => skin.id === normalized);
}

function getOwnedBoardFrameSkins(rootRef?: Window | null): BoardFrameSkinItem[] {
  return getAllBoardFrameSkins(rootRef);
}

function normalizeBoardFrameSkinId(value: unknown, rootRef?: Window | null): string {
  const normalized = normalizeCatalogBoardFrameSkinId(value);
  return getAllBoardFrameSkins(rootRef).some((skin) => skin.id === normalized) ? normalized : DEFAULT_BOARD_FRAME_SKIN_ID;
}

function getBoardFrameSkinDefinition(skinId: string, rootRef?: Window | null): BoardFrameSkinItem | null {
  const normalized = normalizeBoardFrameSkinId(skinId, rootRef);
  const found = getAllBoardFrameSkins(rootRef).find((skin) => skin.id === normalized) || BOARD_FRAME_SKINS[0] || null;
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
