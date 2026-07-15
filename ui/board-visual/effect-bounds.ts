import type { BoardWorldWindow } from './types';

export const MAX_BOARD_LOCAL_EFFECT_EXTENT_CELLS = 2;

export type BoardVisualEffectRoute = 'board-local' | 'global-dom';
export type BoardVisualEffectEdge = 'top' | 'right' | 'bottom' | 'left';
export type BoardVisualEffectCellExtent = number | 'unbounded';

export interface BoardVisualEffectCellExtents {
  readonly top: BoardVisualEffectCellExtent;
  readonly right: BoardVisualEffectCellExtent;
  readonly bottom: BoardVisualEffectCellExtent;
  readonly left: BoardVisualEffectCellExtent;
}

export interface BoardVisualEffectBoundsEntry {
  readonly family: string;
  readonly route: BoardVisualEffectRoute;
  readonly extentCells: BoardVisualEffectCellExtents;
}

export interface BoardVisualEffectMaterializationGutter {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

type EffectBoundsManifestInput = Readonly<Record<string, {
  readonly route: unknown;
  readonly extentCells: unknown;
}>>;

const EDGES = Object.freeze([
  'top',
  'right',
  'bottom',
  'left'
] as const);

const ZERO_GUTTER = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function localExtent(value: number): Readonly<Record<BoardVisualEffectEdge, number>> {
  return Object.freeze({ top: value, right: value, bottom: value, left: value });
}

const UNBOUNDED_EXTENT = Object.freeze({
  top: 'unbounded',
  right: 'unbounded',
  bottom: 'unbounded',
  left: 'unbounded'
} as const);

/**
 * Visual-family inventory fixed from the Phase 0 presentation surface.
 *
 * A presentation event can use more than one family. For example, DESTROY's
 * target fragment is board-local while a projectile/beam travelling from a
 * source cell remains a mutually-exclusive global DOM overlay.
 */
const RAW_EFFECT_BOUNDS_MANIFEST = Object.freeze({
  place: { route: 'board-local', extentCells: localExtent(0.5) },
  flip: { route: 'board-local', extentCells: localExtent(0.5) },
  destroy: { route: 'board-local', extentCells: localExtent(2) },
  spawn: { route: 'board-local', extentCells: localExtent(1) },
  move: { route: 'board-local', extentCells: localExtent(1) },
  status: { route: 'board-local', extentCells: localExtent(1) },
  board_expansion: { route: 'board-local', extentCells: localExtent(1) },
  board_shrink: { route: 'board-local', extentCells: localExtent(1) },
  crossfade_stone: { route: 'board-local', extentCells: localExtent(0.5) },
  protection_expire: { route: 'board-local', extentCells: localExtent(1) },
  legacy_fade_out: { route: 'board-local', extentCells: localExtent(0.5) },
  legacy_strong_will_apply: { route: 'board-local', extentCells: localExtent(1) },
  legacy_hyperactive_move: { route: 'board-local', extentCells: localExtent(1) },
  legacy_sacrifice_absorb_pulse: { route: 'board-local', extentCells: localExtent(2) },
  theory_incarnation_spawn_roulette: { route: 'board-local', extentCells: localExtent(1.5) },
  manifest_ending_board: { route: 'board-local', extentCells: localExtent(2) },
  observer_bubble: { route: 'global-dom', extentCells: UNBOUNDED_EXTENT },
  'source-to-board': { route: 'global-dom', extentCells: UNBOUNDED_EXTENT },
  fullscreen: { route: 'global-dom', extentCells: UNBOUNDED_EXTENT }
} as const);

export type BoardVisualEffectFamily = keyof typeof RAW_EFFECT_BOUNDS_MANIFEST;

export class BoardVisualEffectBoundsError extends Error {
  readonly code: 'invalid_effect_bounds_manifest' | 'unknown_effect_family' | 'global_effect_not_materializable';
  readonly family: string | null;

  constructor(
    code: BoardVisualEffectBoundsError['code'],
    message: string,
    family: unknown = null
  ) {
    super(message);
    this.name = 'BoardVisualEffectBoundsError';
    this.code = code;
    this.family = typeof family === 'string' ? family : null;
  }
}

function invalidManifest(family: unknown, reason: string): never {
  const normalizedFamily = typeof family === 'string' && family ? family : null;
  throw new BoardVisualEffectBoundsError(
    'invalid_effect_bounds_manifest',
    normalizedFamily
      ? `Invalid board visual effect bounds for ${normalizedFamily}: ${reason}`
      : `Invalid board visual effect bounds manifest: ${reason}`,
    normalizedFamily
  );
}

function validateExtent(
  family: string,
  route: BoardVisualEffectRoute,
  edge: BoardVisualEffectEdge,
  value: unknown
): BoardVisualEffectCellExtent {
  if (value === 'unbounded') {
    if (route === 'board-local') invalidManifest(family, `${edge} cannot be unbounded for board-local effects`);
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    invalidManifest(family, `${edge} must be a finite non-negative cell extent or unbounded`);
  }
  if (route === 'board-local' && value > MAX_BOARD_LOCAL_EFFECT_EXTENT_CELLS) {
    invalidManifest(
      family,
      `${edge} extent ${value} exceeds the ${MAX_BOARD_LOCAL_EFFECT_EXTENT_CELLS}-cell board-local limit`
    );
  }
  return value;
}

/** Validates without clamping and returns a detached, deeply frozen manifest. */
export function validateBoardVisualEffectBoundsManifest(
  input: unknown
): Readonly<Record<string, BoardVisualEffectBoundsEntry>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidManifest(null, 'expected an object');
  const source = input as EffectBoundsManifestInput;
  const families = Object.keys(source);
  if (!families.length) invalidManifest(null, 'at least one family is required');

  const validated: Record<string, BoardVisualEffectBoundsEntry> = {};
  for (const family of families) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(family)) invalidManifest(family, 'family id is not stable');
    const candidate = source[family];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      invalidManifest(family, 'entry must be an object');
    }
    const route = candidate.route;
    if (route !== 'board-local' && route !== 'global-dom') {
      invalidManifest(family, 'route must be board-local or global-dom');
    }
    const rawExtents = candidate.extentCells;
    if (!rawExtents || typeof rawExtents !== 'object' || Array.isArray(rawExtents)) {
      invalidManifest(family, 'extentCells must be an object');
    }
    const extentRecord = rawExtents as Record<string, unknown>;
    const extentKeys = Object.keys(extentRecord);
    if (extentKeys.length !== EDGES.length || extentKeys.some((edge) => !EDGES.includes(edge as BoardVisualEffectEdge))) {
      invalidManifest(family, 'extentCells must define exactly top/right/bottom/left');
    }
    const extentCells = Object.freeze({
      top: validateExtent(family, route, 'top', extentRecord.top),
      right: validateExtent(family, route, 'right', extentRecord.right),
      bottom: validateExtent(family, route, 'bottom', extentRecord.bottom),
      left: validateExtent(family, route, 'left', extentRecord.left)
    });
    validated[family] = Object.freeze({ family, route, extentCells });
  }
  return Object.freeze(validated);
}

export const BOARD_VISUAL_EFFECT_BOUNDS_MANIFEST = validateBoardVisualEffectBoundsManifest(
  RAW_EFFECT_BOUNDS_MANIFEST
) as Readonly<Record<BoardVisualEffectFamily, BoardVisualEffectBoundsEntry>>;

export const BOARD_LOCAL_EFFECT_FAMILIES = Object.freeze(
  Object.values(BOARD_VISUAL_EFFECT_BOUNDS_MANIFEST)
    .filter((entry) => entry.route === 'board-local')
    .map((entry) => entry.family as BoardVisualEffectFamily)
);

export const GLOBAL_DOM_EFFECT_FAMILIES = Object.freeze(
  Object.values(BOARD_VISUAL_EFFECT_BOUNDS_MANIFEST)
    .filter((entry) => entry.route === 'global-dom')
    .map((entry) => entry.family as BoardVisualEffectFamily)
);

export const PHASE0_PRESENTATION_EFFECT_FAMILY_INVENTORY = Object.freeze({
  PLACE: Object.freeze(['place', 'source-to-board'] as const),
  FLIP: Object.freeze(['flip'] as const),
  DESTROY: Object.freeze(['destroy', 'source-to-board'] as const),
  SPAWN: Object.freeze(['spawn'] as const),
  MOVE: Object.freeze(['move'] as const),
  STATUS: Object.freeze(['status'] as const),
  BOARD_EXPANSION: Object.freeze(['board_expansion'] as const),
  BOARD_SHRINK: Object.freeze(['board_shrink'] as const),
  THEORY_INCARNATION: Object.freeze(['theory_incarnation_spawn_roulette'] as const),
  OBSERVER_WILL: Object.freeze(['observer_bubble'] as const),
  MANIFEST: Object.freeze(['manifest_ending_board', 'fullscreen'] as const)
});

/**
 * Concrete Phase 3 playback/global event coverage. Empty arrays are explicit:
 * those events update DOM UI, sound, or logs but do not own a board visual.
 */
export const PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY = Object.freeze({
  place: Object.freeze(['place'] as const),
  flip: Object.freeze(['flip'] as const),
  destroy: Object.freeze(['destroy', 'source-to-board'] as const),
  spawn: Object.freeze(['spawn'] as const),
  move: Object.freeze(['move'] as const),
  status_applied: Object.freeze(['status'] as const),
  status_removed: Object.freeze(['status'] as const),
  crossfade_stone: Object.freeze(['crossfade_stone'] as const),
  protection_expire: Object.freeze(['protection_expire'] as const),
  legacy_fade_out: Object.freeze(['legacy_fade_out'] as const),
  legacy_strong_will_apply: Object.freeze(['legacy_strong_will_apply'] as const),
  legacy_hyperactive_move: Object.freeze(['legacy_hyperactive_move'] as const),
  legacy_sacrifice_absorb_pulse: Object.freeze(['legacy_sacrifice_absorb_pulse'] as const),
  observer_bubble: Object.freeze(['observer_bubble'] as const),
  theory_incarnation_spawn_roulette: Object.freeze(['theory_incarnation_spawn_roulette'] as const),
  manifest_ending: Object.freeze(['manifest_ending_board', 'fullscreen'] as const),
  place_hand_animation: Object.freeze(['source-to-board'] as const),
  hand_add: Object.freeze([] as const),
  capture_to_hand_animation: Object.freeze(['source-to-board'] as const),
  hand_remove: Object.freeze([] as const),
  card_use_animation: Object.freeze(['source-to-board'] as const),
  special_card_cinematic: Object.freeze(['fullscreen'] as const),
  round_bonus_banner: Object.freeze(['fullscreen'] as const),
  sound_effect: Object.freeze([] as const),
  log: Object.freeze([] as const)
});

export function getBoardVisualEffectBounds(family: unknown): BoardVisualEffectBoundsEntry {
  if (typeof family !== 'string' || !Object.prototype.hasOwnProperty.call(BOARD_VISUAL_EFFECT_BOUNDS_MANIFEST, family)) {
    throw new BoardVisualEffectBoundsError(
      'unknown_effect_family',
      `Unknown board visual effect family: ${String(family)}`,
      family
    );
  }
  return BOARD_VISUAL_EFFECT_BOUNDS_MANIFEST[family as BoardVisualEffectFamily];
}

function materializationGutterForEntries(
  entries: readonly BoardVisualEffectBoundsEntry[]
): BoardVisualEffectMaterializationGutter {
  const gutter: Record<BoardVisualEffectEdge, number> = { ...ZERO_GUTTER };
  for (const entry of entries) {
    if (entry.route !== 'board-local') {
      throw new BoardVisualEffectBoundsError(
        'global_effect_not_materializable',
        `Global DOM effect family cannot expand the Pixi materialization window: ${entry.family}`,
        entry.family
      );
    }
    for (const edge of EDGES) {
      const extent = entry.extentCells[edge];
      if (typeof extent !== 'number') {
        invalidManifest(entry.family, `${edge} board-local extent is not finite`);
      }
      gutter[edge] = Math.max(gutter[edge], Math.ceil(extent));
    }
  }
  return Object.freeze(gutter);
}

/** Returns the integer cell gutter required by every board-local family. */
export function getMaxBoardLocalEffectGutterCells(): BoardVisualEffectMaterializationGutter {
  return materializationGutterForEntries(
    BOARD_LOCAL_EFFECT_FAMILIES.map((family) => getBoardVisualEffectBounds(family))
  );
}

/** Returns the integer cell gutter for a selected set of board-local families. */
export function getBoardVisualEffectMaterializationGutter(
  families: readonly (BoardVisualEffectFamily | string)[] = BOARD_LOCAL_EFFECT_FAMILIES
): BoardVisualEffectMaterializationGutter {
  if (!Array.isArray(families)) {
    invalidManifest(null, 'materialization families must be an array');
  }
  return materializationGutterForEntries(families.map((family) => getBoardVisualEffectBounds(family)));
}

function validateWorldWindow(bounds: BoardWorldWindow): BoardWorldWindow {
  if (!bounds || typeof bounds !== 'object') invalidManifest(null, 'materialization bounds must be an object');
  const values = [bounds.minRow, bounds.maxRow, bounds.minCol, bounds.maxCol];
  if (!values.every((value) => Number.isInteger(value))) {
    invalidManifest(null, 'materialization bounds must contain integer world coordinates');
  }
  if (bounds.minRow > bounds.maxRow || bounds.minCol > bounds.maxCol) {
    invalidManifest(null, 'materialization bounds are inverted');
  }
  return bounds;
}

/** Expands a world window by the selected families' integer materialization gutter. */
export function expandBoardVisualEffectMaterializationBounds(
  bounds: BoardWorldWindow,
  families: readonly (BoardVisualEffectFamily | string)[] = BOARD_LOCAL_EFFECT_FAMILIES
): BoardWorldWindow {
  const source = validateWorldWindow(bounds);
  const gutter = getBoardVisualEffectMaterializationGutter(families);
  return Object.freeze({
    minRow: source.minRow - gutter.top,
    maxRow: source.maxRow + gutter.bottom,
    minCol: source.minCol - gutter.left,
    maxCol: source.maxCol + gutter.right
  });
}
