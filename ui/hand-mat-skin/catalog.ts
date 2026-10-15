/** Standard, initially owned hand mat skins (no gacha or custom entries). */
interface HandMatSkinDefinition {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

const BASE_HAND_MAT_SKINS: readonly HandMatSkinDefinition[] = Object.freeze([
  Object.freeze({
    id: 'espresso-leather',
    label: '濃茶の革マット',
    note: '初期所持',
    imagePath: 'assets/images/ui/card-area-espresso-leather-v1.webp'
  }),
  Object.freeze({
    id: 'walnut-felt',
    label: '木枠とフェルト',
    note: '初期所持',
    imagePath: 'assets/images/ui/card-area-walnut-felt-v1.webp'
  }),
  Object.freeze({
    id: 'scholars-oxblood',
    label: '赤茶革の書斎マット',
    note: '初期所持',
    imagePath: 'assets/images/ui/card-area-scholars-oxblood-v1.webp'
  }),
  Object.freeze({
    id: 'midnight-bookcloth',
    label: '青緑の布マット（既定）',
    note: '初期所持',
    imagePath: 'assets/images/ui/card-area-midnight-bookcloth-v1.webp'
  })
]);

const DEFAULT_HAND_MAT_SKIN_ID = 'midnight-bookcloth';

function getAllHandMatSkins(_rootRef?: unknown): HandMatSkinDefinition[] {
  return BASE_HAND_MAT_SKINS.map((item) => ({ ...item }));
}

function normalizeHandMatSkinId(value: unknown, _rootRef?: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return BASE_HAND_MAT_SKINS.some((item) => item.id === normalized) ? normalized : DEFAULT_HAND_MAT_SKIN_ID;
}

function getHandMatSkinDefinition(value: unknown, rootRef?: unknown): HandMatSkinDefinition {
  const normalized = normalizeHandMatSkinId(value, rootRef);
  const found = BASE_HAND_MAT_SKINS.find((item) => item.id === normalized) || BASE_HAND_MAT_SKINS[0];
  return { ...found };
}

export = {
  DEFAULT_HAND_MAT_SKIN_ID,
  BASE_HAND_MAT_SKINS,
  getAllHandMatSkins,
  normalizeHandMatSkinId,
  getHandMatSkinDefinition
};
