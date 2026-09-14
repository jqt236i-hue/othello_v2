import type { MaterializedBoardCellVisualState } from '../board-visual/types';
import StoneStatusSnapshotModule = require('../../shared/stone-status-snapshot');
import {
  addPixiChild,
  clearPixiGraphics,
  createPixiContainer,
  createPixiGraphics,
  createPixiSprite,
  createPixiText,
  destroyPixiDisplayObject,
  drawPixiCircle,
  drawPixiEllipse,
  drawPixiLine,
  drawPixiPolygon,
  drawPixiRect,
  removeAndDestroyPixiChildren,
  removePixiFromParent,
  resolvePixiStaticTexture,
  resolvePixiStaticPrimaryTexture,
  setPixiAnchor,
  setPixiPosition,
  setPixiScale,
  toPixiTextStyle,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime
} from './cell-view';

type BoardMarkerVisual = MaterializedBoardCellVisualState['markers'][number];

interface StoneStatusSnapshotApi {
  createSpecialStoneStatusSnapshot?: (
    input: Readonly<Record<string, unknown>>,
    options: Readonly<Record<string, unknown>>
  ) => Readonly<{
    hasFlipProtection?: boolean;
    timerClass?: string;
  }> | null;
}

type StoneStatusSnapshot = NonNullable<ReturnType<NonNullable<StoneStatusSnapshotApi['createSpecialStoneStatusSnapshot']>>>;

const StoneStatusSnapshot = StoneStatusSnapshotModule as unknown as StoneStatusSnapshotApi;

function setPixiPivot(target: any, x: number, y = x): void {
  if (!target) return;
  if (target.pivot && typeof target.pivot.set === 'function') target.pivot.set(x, y);
  else target.pivot = { x, y };
}

export interface PixiStoneViewDiagnostics {
  readonly updateCount: number;
  readonly staticPrepareCount: number;
  readonly transformApplyCount: number;
  readonly resetCount: number;
  readonly destroyed: boolean;
  readonly key: string | null;
  readonly visible: boolean;
  readonly owner: 'black' | 'white' | null;
  readonly specialType: string | null;
  readonly timerLabel: string;
  readonly badgeLabel: string;
  readonly flipProtectionBadgeVisible: boolean;
  readonly statusLabels: readonly Readonly<{ kind: string; value: string }>[];
  readonly textureBacked: boolean;
  readonly texturePurpose: string | null;
  readonly renderedMarkerKinds: readonly string[];
  readonly position: Readonly<{ x: number; y: number }>;
}

export interface PixiStoneViewTransform {
  readonly x: number;
  readonly y: number;
  readonly pivotX?: number;
  readonly pivotY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotation?: number;
  readonly alpha?: number;
}

export interface PixiStoneView {
  readonly root: any;
  prepareStaticVisual(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
  applyTransform(transform: PixiStoneViewTransform): void;
  update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
  invalidate(): void;
  reset(): void;
  destroy(): void;
  getDiagnostics(): PixiStoneViewDiagnostics;
}

function finiteStatusLabel(
  status: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): string {
  for (const key of keys) {
    const value = status[key];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value.trim();
  }
  return '';
}

function stoneTexturePurposes(owner: 'black' | 'white', specialType: string | null): string[] {
  const purposes: string[] = [];
  if (specialType) {
    const normalized = specialType.trim().toUpperCase();
    purposes.push(
      `special-stone:${normalized}:${owner}`,
      `special-stone:${normalized}`,
      `special-stone:${owner}`,
      'special-stone'
    );
  }
  purposes.push(`${owner}-stone`, `stone:${owner}`);
  return purposes;
}

const STONE_MARKER_KINDS = new Set([
  'special',
  'living-will-aura',
  'manifest-aura',
  'guard',
  'bomb',
  'frozen',
  'poisoned',
  'scorched',
  'breeding-sprout'
]);

const NON_SPECIAL_STONE_MARKER_KINDS = new Set([
  'breeding-sprout'
]);

export function hasPixiStoneVisual(cell: MaterializedBoardCellVisualState): boolean {
  return cell.kind === 'playable' && (
    !!cell.stone || cell.markers.some((marker) => (
      STONE_MARKER_KINDS.has(marker.kind)
      && !NON_SPECIAL_STONE_MARKER_KINDS.has(marker.kind)
    ))
  );
}

function markerSpecialType(markers: readonly BoardMarkerVisual[]): string | null {
  const typeByKind: Readonly<Record<string, string>> = Object.freeze({
    'living-will-aura': 'LIVING_WILL',
    'manifest-aura': 'MANIFEST',
    guard: 'GUARD',
    bomb: 'TIME_BOMB',
    frozen: 'FREEZE',
    poisoned: 'POISONED',
    scorched: 'SCORCHED'
  });
  for (const marker of markers) {
    if (NON_SPECIAL_STONE_MARKER_KINDS.has(marker.kind)) continue;
    const explicit = String(marker.data && marker.data.type || '').trim().toUpperCase();
    if (explicit) return explicit;
    if (typeByKind[marker.kind]) return typeByKind[marker.kind];
  }
  return null;
}

function collectStoneStatusLabels(
  status: Readonly<Record<string, unknown>>,
  markers: readonly BoardMarkerVisual[],
  specialType: string | null,
  snapshot: StoneStatusSnapshot | null
): Array<{ kind: string; value: string }> {
  const labels: Array<{ kind: string; value: string }> = [];
  const add = (kind: string, value: string) => {
    if (!value || labels.some((entry) => entry.kind === kind)) return;
    labels.push({ kind, value });
  };
  const addPositive = (kind: string, value: string) => {
    if (!(Number(value) > 0)) return;
    add(kind, value);
  };
  const specialMarker = markers.find((marker) => marker.kind === 'special');
  const normalizedSpecialType = String(specialType || '').trim().toUpperCase();
  const specialTimerValue = finiteStatusLabel(status, [
    'remainingOwnerTurns',
    'remainingTurns',
    'turnsUntilInfection'
  ]) || finiteStatusLabel(specialMarker?.data || {}, [
    'remainingOwnerTurns',
    'remainingTurns',
    'turnsUntilInfection'
  ]);
  const timerMarkerKindByType: Readonly<Record<string, string>> = Object.freeze({
    GUARD: 'guard',
    TIME_BOMB: 'bomb',
    BOMB: 'bomb',
    FREEZE: 'frozen',
    POISONED: 'poisoned',
    SCORCHED: 'scorched'
  });
  const dedicatedMarkerKind = timerMarkerKindByType[normalizedSpecialType];
  const timerOwnedByDedicatedMarker = !!dedicatedMarkerKind
    && !specialMarker
    && markers.some((marker) => marker.kind === dedicatedMarkerKind);
  if (normalizedSpecialType !== 'REGEN' && !timerOwnedByDedicatedMarker) {
    add(snapshot?.timerClass === 'countdown-timer' ? 'countdown' : 'special', specialTimerValue);
  }
  if (specialMarker) {
    addPositive('regen', finiteStatusLabel(specialMarker.data || {}, ['regenRemaining']));
    addPositive('flip-evade', finiteStatusLabel(specialMarker.data || {}, ['flipEvadeRemaining']));
    addPositive('destroy-evade', finiteStatusLabel(specialMarker.data || {}, ['destroyEvadeRemaining']));
  }
  addPositive('regen', finiteStatusLabel(status, ['regenRemaining']));
  addPositive('flip-evade', finiteStatusLabel(status, ['flipEvadeRemaining']));
  addPositive('destroy-evade', finiteStatusLabel(status, ['destroyEvadeRemaining']));

  const markerOrder = ['bomb', 'guard', 'frozen', 'poisoned', 'scorched'] as const;
  const markerKind = Object.freeze({
    bomb: 'bomb',
    guard: 'guard',
    frozen: 'freeze',
    poisoned: 'poison',
    scorched: 'scorch'
  });
  for (const expectedKind of markerOrder) {
    const marker = markers.find((candidate) => candidate.kind === expectedKind);
    if (!marker) continue;
    add(markerKind[expectedKind], finiteStatusLabel(marker.data || {}, [
      'remainingOwnerTurns',
      'remainingTurns',
      'countdown',
      'timer',
      'count'
    ]));
  }
  if (!labels.some((entry) => (
    entry.kind === 'special'
    || entry.kind === 'countdown'
    || entry.kind === 'bomb'
    || entry.kind === 'guard'
    || entry.kind === 'freeze'
    || entry.kind === 'poison'
    || entry.kind === 'scorch'
  ))) {
    add('countdown', finiteStatusLabel(status, ['countdown', 'timer', 'count']));
  }
  return labels;
}

function createStoneStatusSnapshot(
  specialType: string | null,
  status: Readonly<Record<string, unknown>>,
  markers: readonly BoardMarkerVisual[]
): StoneStatusSnapshot | null {
  if (!specialType || typeof StoneStatusSnapshot?.createSpecialStoneStatusSnapshot !== 'function') {
    return null;
  }
  const nestedSpecial = status.special && typeof status.special === 'object'
    ? status.special as Readonly<Record<string, unknown>>
    : {};
  const specialMarker = markers.find((marker) => marker.kind === 'special');
  const markerData = specialMarker?.data || {};
  return StoneStatusSnapshot.createSpecialStoneStatusSnapshot({
    ...status,
    ...markerData,
    ...nestedSpecial,
    type: specialType,
    hasGuard: specialType === 'GUARD' || markers.some((marker) => marker.kind === 'guard')
  }, { mode: 'raw' });
}

function statusLabelPosition(
  kind: string,
  cellSize: number,
  hasHazardPair = false
): Readonly<{ x: number; y: number }> {
  const ratios: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
    special: [0.5, 0.82],
    regen: [0.14, 0.5],
    'flip-evade': [0.86, 0.14],
    'destroy-evade': [0.14, 0.86],
    bomb: [0.5, 0.86],
    guard: [0.5, 0.1],
    freeze: [0.23, 0.23],
    poison: [hasHazardPair ? 0.39 : 0.5, 0.5],
    scorch: [hasHazardPair ? 0.62 : 0.5, 0.5],
    countdown: [0.5, 0.86]
  });
  const ratio = ratios[kind] || [0.5, 0.5];
  return Object.freeze({ x: cellSize * ratio[0], y: cellSize * ratio[1] });
}

export function createPixiStoneView(runtime: PixiStaticViewRuntime): PixiStoneView {
  const root = createPixiContainer(runtime, 'pixi-stone-view');
  const shadow = createPixiGraphics(runtime, 'pixi-stone-shadow');
  const aura = createPixiGraphics(runtime, 'pixi-stone-aura');
  const procedural = createPixiGraphics(runtime, 'pixi-stone-procedural');
  const sprite = createPixiSprite(runtime, 'pixi-stone-texture');
  const statusOverlay = createPixiGraphics(runtime, 'pixi-stone-status-overlay');
  const markerOverlay = createPixiSprite(runtime, 'pixi-stone-marker-overlay');
  const specialRing = createPixiGraphics(runtime, 'pixi-stone-special-ring');
  const specialBadge = createPixiText(runtime, 'pixi-stone-special-badge');
  const flipProtectionBadge = createPixiText(runtime, 'pixi-stone-flip-protection-badge');
  const statusLabelsRoot = createPixiContainer(runtime, 'pixi-stone-status-labels');
  addPixiChild(
    root,
    shadow,
    aura,
    procedural,
    sprite,
    statusOverlay,
    markerOverlay,
    specialRing,
    specialBadge,
    flipProtectionBadge,
    statusLabelsRoot
  );
  let signature: string | null = null;
  let key: string | null = null;
  let owner: 'black' | 'white' | null = null;
  let specialType: string | null = null;
  let timerLabel = '';
  let badgeLabel = '';
  let flipProtectionBadgeVisible = false;
  let statusLabels: Array<{ kind: string; value: string }> = [];
  let textureBacked = false;
  let texturePurpose: string | null = null;
  let renderedMarkerKinds: string[] = [];
  let updateCount = 0;
  let transformApplyCount = 0;
  let resetCount = 0;
  let destroyed = false;
  let position = { x: 0, y: 0 };

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiStoneView is destroyed');
  }

  function prepareStaticVisual(
    cell: MaterializedBoardCellVisualState,
    context: PixiStaticViewContext
  ): boolean {
    assertAlive();
    const nextSignature = JSON.stringify([
      context.stoneRevisionSignature,
      cell.stoneSignature
    ]);
    if (signature === nextSignature) return false;
    signature = nextSignature;
    key = cell.key;
    updateCount += 1;
    clearPixiGraphics(shadow);
    clearPixiGraphics(aura);
    clearPixiGraphics(procedural);
    clearPixiGraphics(specialRing);
    clearPixiGraphics(statusOverlay);
    const stone = cell.kind === 'playable' ? cell.stone : null;
    const stoneMarkers = cell.kind === 'playable'
      ? cell.markers.filter((marker) => STONE_MARKER_KINDS.has(marker.kind))
      : [];
    renderedMarkerKinds = stoneMarkers.map((marker) => marker.kind);
    root.visible = hasPixiStoneVisual(cell);
    if (!stone && !stoneMarkers.length) {
      owner = null;
      specialType = null;
      timerLabel = '';
      badgeLabel = '';
      flipProtectionBadgeVisible = false;
      textureBacked = false;
      texturePurpose = null;
      if (sprite) sprite.visible = false;
      if (markerOverlay) markerOverlay.visible = false;
      if (specialBadge) specialBadge.visible = false;
      if (flipProtectionBadge) flipProtectionBadge.visible = false;
      statusLabels = [];
      removeAndDestroyPixiChildren(statusLabelsRoot);
      return true;
    }

    owner = stone?.owner || stoneMarkers.find((marker) => marker.owner)?.owner || 'black';
    specialType = stone?.specialType
      ? String(stone.specialType).trim().toUpperCase()
      : markerSpecialType(stoneMarkers);
    const nestedSpecial = (
      stone
      && stone.status
      && stone.status.special
      && typeof stone.status.special === 'object'
    )
      ? stone.status.special as Readonly<Record<string, unknown>>
      : {};
    const normalizedSpecialType = String(specialType || '').trim().toUpperCase();
    const isShinraBanshoGod = normalizedSpecialType === 'SHINRA_BANSHO_GOD';
    const footprintRowOffset = Number(nestedSpecial.footprintRowOffset);
    const footprintColOffset = Number(nestedSpecial.footprintColOffset);
    const isShinraAnchor = !isShinraBanshoGod || (
      footprintRowOffset === 0
      && footprintColOffset === 0
    );
    if (!isShinraAnchor) {
      root.visible = false;
      if (sprite) sprite.visible = false;
      if (markerOverlay) markerOverlay.visible = false;
      if (specialBadge) specialBadge.visible = false;
      if (flipProtectionBadge) flipProtectionBadge.visible = false;
      statusLabels = [];
      removeAndDestroyPixiChildren(statusLabelsRoot);
      textureBacked = false;
      texturePurpose = null;
      timerLabel = '';
      badgeLabel = '';
      flipProtectionBadgeVisible = false;
      return true;
    }
    const cellSize = context.layout.cellSize;
    const stageScale = Math.max(0.01, Number(context.layout.stageScale) || 1);
    const cellScale = Math.max(0.01, Number(context.layout.cellScale) || 1);
    const fixedUiScale = stageScale * cellScale;
    // syncBoardPixelSizing rounds the compatibility disc inset before
    // assigning pixel dimensions. Include the minimum cell border so Pixi and
    // DOM sample the same source-image pixels at DPR 1.
    const cellBorderWidth = Math.max(1, stageScale);
    const discInset = Math.max(1, Math.round(cellSize * 0.0505));
    const discSize = Math.max(1, cellSize - (discInset * 2));
    const discOrigin = cellBorderWidth + discInset;
    const compositeSize = isShinraBanshoGod
      ? Math.max(1, (cellSize * 2) - (discInset * 2))
      : discSize;
    const radius = compositeSize / 2;
    const center = isShinraBanshoGod ? cellSize : discOrigin + (discSize / 2);
    const purposes = stoneTexturePurposes(owner, specialType);
    const basePurposes = [`${owner}-stone`, `stone:${owner}`];
    const specialTexture = stone ? resolvePixiStaticTexture(context.textures, purposes) : null;
    const freezeMarker = stoneMarkers.find((marker) => marker.kind === 'frozen');
    const freezeOverlayOwner = freezeMarker?.owner || owner;
    const freezeOverlayPurposes = stoneTexturePurposes(freezeOverlayOwner, 'FREEZE').slice(0, 4);
    const freezeOverlayTexture = freezeMarker
      ? resolvePixiStaticPrimaryTexture(context.textures, freezeOverlayPurposes)
      : null;
    const texture = stone
      ? (normalizedSpecialType === 'FREEZE'
        ? resolvePixiStaticTexture(context.textures, basePurposes)
        : specialTexture)
      : null;

    if (stone && !isShinraBanshoGod) {
      // Match the two DOM depth layers without applying a per-stone filter.
      // The compatibility writer applies both pseudo-element shadows to every
      // occupied cell, including special stones whose image already owns the
      // visible rim.
      // a shallow contact shadow on the cell and a softer projected shadow
      // from the disc. Both remain comfortably inside the two-cell gutter.
      const drawShadowGradient = (
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
        strength: number
      ) => {
        const bands = [
          [1, 0.018], [0.94, 0.026], [0.84, 0.045],
          [0.7, 0.06], [0.52, 0.075], [0.3, 0.065]
        ] as const;
        for (const [scale, alpha] of bands) {
          drawPixiEllipse(shadow, centerX, centerY, radiusX * scale, radiusY * scale, {
            color: '#000000', alpha: alpha * strength
          });
        }
      };
      drawShadowGradient(
        cellSize * 0.61,
        cellSize * 0.895,
        cellSize * 0.525,
        cellSize * 0.155,
        0.74
      );
      drawShadowGradient(
        cellSize * 0.766,
        cellSize * 0.956,
        cellSize * 0.55,
        cellSize * 0.337,
        1
      );
    }
    texturePurpose = texture
      ? (normalizedSpecialType === 'FREEZE' && freezeOverlayTexture
        ? purposes.find((purpose) => !!resolvePixiStaticTexture(context.textures, [purpose])) || null
        : purposes.find((purpose) => !!resolvePixiStaticTexture(context.textures, [purpose])) || null)
      : null;
    textureBacked = !!texture && !!sprite;
    procedural.visible = !!stone && !textureBacked;
    if (stone && !textureBacked) {
      drawPixiCircle(procedural, center, center, radius, {
        color: owner === 'black' ? '#141414' : '#f4f4f1',
        alpha: 1
      }, {
        color: owner === 'black' ? '#5a5a5a' : '#b9b9b5',
        alpha: 1,
        width: Math.max(1, cellSize * 0.025)
      });
      drawPixiCircle(procedural, center - radius * 0.24, center - radius * 0.28, radius * 0.28, {
        color: owner === 'black' ? '#555555' : '#ffffff',
        alpha: owner === 'black' ? 0.42 : 0.72
      });
    }
    if (sprite) {
      sprite.visible = textureBacked;
      if (textureBacked) sprite.texture = texture;
      setPixiAnchor(sprite, 0.5);
      setPixiPosition(sprite, center, center);
      sprite.width = compositeSize;
      sprite.height = compositeSize;
    }
    if (stone && stoneMarkers.some((marker) => marker.kind === 'poisoned')) {
      drawPixiCircle(statusOverlay, center, center, radius, { color: '#a733c5', alpha: 0.22 });
    }
    if (freezeMarker && !freezeOverlayTexture) {
      drawPixiRect(statusOverlay, cellSize * 0.025, cellSize * 0.025, cellSize * 0.95, cellSize * 0.95, {
        color: '#8dc8ed', alpha: 0.62
      }, {
        color: '#d9f2ff', alpha: 0.78, width: Math.max(1, cellSize * 0.025)
      }, cellSize * 0.035);
      drawPixiLine(statusOverlay, cellSize * 0.08, cellSize * 0.76, cellSize * 0.76, cellSize * 0.08, {
        color: '#eaf8ff', alpha: 0.8, width: Math.max(1, cellSize * 0.025)
      });
      drawPixiLine(statusOverlay, cellSize * 0.3, cellSize * 0.96, cellSize * 0.96, cellSize * 0.3, {
        color: '#4f91c4', alpha: 0.72, width: Math.max(1, cellSize * 0.025)
      });
    }
    if (markerOverlay) {
      markerOverlay.visible = !!freezeOverlayTexture;
      if (freezeOverlayTexture) markerOverlay.texture = freezeOverlayTexture;
      markerOverlay.alpha = 0.62;
      setPixiAnchor(markerOverlay, 0.5);
      setPixiPosition(markerOverlay, cellSize / 2, cellSize / 2);
      markerOverlay.width = cellSize;
      markerOverlay.height = cellSize;
    }

    if (isShinraBanshoGod) {
      const shinraAuraSteps = [
        [1.24, '#ff6a3d', 0.075],
        [1.19, '#5ed9ff', 0.085],
        [1.14, '#65df87', 0.095],
        [1.09, '#f3cf54', 0.105],
        [1.045, '#c7a2ff', 0.12]
      ] as const;
      for (const [scale, color, alpha] of shinraAuraSteps) {
        drawPixiCircle(aura, center, center, radius * scale, {
          color,
          alpha
        });
      }
      drawPixiCircle(aura, center, center, radius * 1.025, null, {
        color: owner === 'white' ? '#f8ffff' : '#a9b8ff',
        alpha: owner === 'white' ? 0.58 : 0.42,
        width: Math.max(1.5, cellSize * 0.055)
      });
    }

    if (stone && renderedMarkerKinds.includes('living-will-aura')) {
      for (const [scale, alpha] of [[1.4, 0.06], [1.3, 0.1], [1.2, 0.18], [1.1, 0.28]] as const) {
        drawPixiCircle(aura, center, center, radius * scale, { color: '#ffdc48', alpha });
      }
      drawPixiCircle(aura, center, center, radius * 1.04, null, {
        color: '#fff082', alpha: 0.82, width: Math.max(1, cellSize * 0.035)
      });
    }
    if (renderedMarkerKinds.includes('manifest-aura')) {
      const whiteAura = owner === 'white';
      const auraColor = whiteAura ? '#effcff' : '#090b10';
      const auraSteps = [
        [2.32, 0.03], [2.12, 0.04], [1.92, 0.045], [1.72, 0.09],
        [1.52, 0.14], [1.37, 0.18], [1.22, 0.28], [1.06, 0.12]
      ] as const;
      for (const [scale, alpha] of auraSteps) {
        drawPixiCircle(aura, center, center, radius * scale, {
          color: auraColor,
          alpha: whiteAura ? alpha : Math.min(0.28, alpha * 1.45)
        });
      }
    }

    const hasBreedingSprout = renderedMarkerKinds.includes('breeding-sprout');
    if (hasBreedingSprout && stone) {
      const stemColor = owner === 'white' ? '#b9f6ca' : '#72d572';
      drawPixiLine(specialRing, center, cellSize * 0.72, center, cellSize * 0.38, {
        color: stemColor,
        alpha: 0.95,
        width: Math.max(1.5, cellSize * 0.035)
      });
      drawPixiCircle(specialRing, cellSize * 0.42, cellSize * 0.43, cellSize * 0.11, {
        color: stemColor,
        alpha: 0.9
      });
      drawPixiCircle(specialRing, cellSize * 0.58, cellSize * 0.37, cellSize * 0.11, {
        color: stemColor,
        alpha: 0.9
      });
    }

    const status = stone?.status || {};
    const stoneStatusSnapshot = createStoneStatusSnapshot(specialType, status, stoneMarkers);

    if (specialBadge) specialBadge.visible = false;
    if (specialType && stone) {
      const normalizedType = specialType.trim().toUpperCase();
      const dedicatedTexture = !!texturePurpose && texturePurpose.startsWith('special-stone:');
      const showSpecialBadge = (glyph: string, x: number, y: number, fill: string, scale = 0.78) => {
        if (!specialBadge) return;
        const baseStyle = toPixiTextStyle(context.theme.directionHint, cellSize * scale, glyph);
        specialBadge.text = glyph;
        specialBadge.style = { ...baseStyle, fill };
        specialBadge.visible = true;
        setPixiAnchor(specialBadge, 0.5);
        setPixiPosition(specialBadge, x, y);
      };
      if ((normalizedType === 'TIME_BOMB' || normalizedType === 'BOMB') && !dedicatedTexture) {
        drawPixiCircle(specialRing, center, center, radius * 1.02, {
          color: '#160d08', alpha: 0.76
        }, {
          color: '#ff7a12', alpha: 0.9, width: Math.max(1.5, cellSize * 0.045)
        });
        drawPixiCircle(specialRing, center, center, radius * 0.76, null, {
          color: '#b71c16', alpha: 0.92, width: Math.max(1, cellSize * 0.03)
        });
        showSpecialBadge('⚠', center, center, '#ff9d22', 0.86);
      } else if (normalizedType === 'ULTIMATE_REVERSE_DRAGON') {
        drawPixiCircle(specialRing, center, center, radius * 0.98, {
          color: '#f6ffff', alpha: owner === 'white' ? 0.82 : 0.08
        });
        drawPixiCircle(specialRing, center, center, radius * 1.02, null, {
          color: '#f4ffff', alpha: owner === 'white' ? 0.88 : 0.34, width: Math.max(1, cellSize * 0.028)
        });
      } else if (!dedicatedTexture && !['POISONED', 'FREEZE', 'LIVING_WILL'].includes(normalizedType)) {
        drawPixiCircle(specialRing, center, center, radius * 1.03, null, {
          color: context.theme.hintColor,
          alpha: 0.86,
          width: Math.max(1.5, cellSize * 0.035)
        });
      }
    }

    flipProtectionBadgeVisible = !!stone
      && !isShinraBanshoGod
      && stoneStatusSnapshot?.hasFlipProtection === true;
    if (flipProtectionBadge) {
      flipProtectionBadge.visible = flipProtectionBadgeVisible;
      if (flipProtectionBadgeVisible) {
        const unscaledBadgeHalfWidth = 9 * stageScale;
        const badgeX = discOrigin + discSize + (2 * stageScale) - unscaledBadgeHalfWidth;
        const badgeY = center;
        const badgeHalfWidth = 9 * fixedUiScale;
        const badgeLowerInset = 5.76 * fixedUiScale;
        const badgeUpperY = badgeY - (2.16 * fixedUiScale);
        const badgePoints = (scale = 1) => Object.freeze([
          Object.freeze({ x: badgeX, y: badgeY - badgeHalfWidth * scale }),
          Object.freeze({ x: badgeX + badgeHalfWidth * scale, y: badgeY + (badgeUpperY - badgeY) * scale }),
          Object.freeze({ x: badgeX + badgeLowerInset * scale, y: badgeY + badgeHalfWidth * scale }),
          Object.freeze({ x: badgeX - badgeLowerInset * scale, y: badgeY + badgeHalfWidth * scale }),
          Object.freeze({ x: badgeX - badgeHalfWidth * scale, y: badgeY + (badgeUpperY - badgeY) * scale })
        ]);
        drawPixiPolygon(specialRing, badgePoints(1.17), { color: '#000000', alpha: 0.08 });
        drawPixiPolygon(specialRing, badgePoints(1.11), { color: '#000000', alpha: 0.12 });
        drawPixiPolygon(specialRing, badgePoints(1.055), { color: '#000000', alpha: 0.16 });
        const baseBadgePoints = badgePoints();
        drawPixiPolygon(specialRing, baseBadgePoints, {
          color: '#5c6068', alpha: 0.86
        }, {
          color: '#e2e6ec', alpha: 0.72, width: Math.max(1, stageScale) * cellScale
        });
        drawPixiPolygon(specialRing, Object.freeze([
          baseBadgePoints[0],
          baseBadgePoints[1],
          Object.freeze({ x: badgeX + badgeLowerInset * 0.65, y: badgeY - badgeHalfWidth * 0.04 }),
          Object.freeze({ x: badgeX - badgeLowerInset * 0.65, y: badgeY - badgeHalfWidth * 0.04 }),
          baseBadgePoints[4]
        ]), { color: '#ffffff', alpha: 0.13 });
        flipProtectionBadge.text = '反';
        flipProtectionBadge.style = {
          ...toPixiTextStyle(context.theme.timer, cellSize, '反'),
          fill: '#f4f6f8',
          fontWeight: 800,
          fontSize: 10 * fixedUiScale,
          lineHeight: 10 * fixedUiScale,
          dropShadow: {
            color: '#000000',
            alpha: 0.72,
            blur: 2 * fixedUiScale,
            distance: fixedUiScale,
            angle: Math.PI / 2
          }
        };
        setPixiAnchor(flipProtectionBadge, 0.5);
        setPixiPosition(flipProtectionBadge, badgeX, badgeY);
      }
    }
    statusLabels = collectStoneStatusLabels(status, stoneMarkers, specialType, stoneStatusSnapshot);
    timerLabel = statusLabels.find((entry) => (
      entry.kind === 'special' || entry.kind === 'countdown' || entry.kind === 'bomb' || entry.kind === 'guard'
    ))?.value || '';
    badgeLabel = statusLabels.find((entry) => (
      entry.kind === 'regen'
      || entry.kind === 'flip-evade'
      || entry.kind === 'destroy-evade'
      || entry.kind === 'poison'
      || entry.kind === 'scorch'
    ))?.value || '';
    removeAndDestroyPixiChildren(statusLabelsRoot);
    const hasHazardPair = statusLabels.some((entry) => entry.kind === 'poison')
      && statusLabels.some((entry) => entry.kind === 'scorch');
    for (const statusLabel of statusLabels) {
      const labelPosition = statusLabel.kind === 'special'
        ? Object.freeze({ x: center, y: discOrigin + discSize - (8 * stageScale) })
        : statusLabel.kind === 'bomb' || statusLabel.kind === 'countdown'
          ? Object.freeze({ x: center, y: discOrigin + discSize - (5 * stageScale) })
          : statusLabel.kind === 'guard'
            ? Object.freeze({ x: center, y: discOrigin + (4 * stageScale) })
            : statusLabelPosition(statusLabel.kind, cellSize, hasHazardPair);
      const isDoubleDigit = statusLabel.value.length >= 2;
      if (statusLabel.kind === 'special') {
        const width = (isDoubleDigit ? 24 : 18) * fixedUiScale;
        const height = 14 * fixedUiScale;
        drawPixiRect(
          specialRing,
          labelPosition.x - width / 2,
          labelPosition.y - height / 2,
          width,
          height,
          { color: '#28563c', alpha: 0.72 },
          { color: '#b8ecd0', alpha: 0.6, width: Math.max(1, stageScale) * cellScale },
          4 * fixedUiScale
        );
        drawPixiRect(
          specialRing,
          labelPosition.x - width / 2 + fixedUiScale,
          labelPosition.y - height / 2 + fixedUiScale,
          Math.max(0, width - fixedUiScale * 2),
          Math.max(0, height * 0.42),
          { color: '#ffffff', alpha: 0.1 },
          null,
          3 * fixedUiScale
        );
      } else if (statusLabel.kind === 'guard') {
        const width = (isDoubleDigit ? 22 : 18) * fixedUiScale;
        const height = 18 * fixedUiScale;
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height / 2 }),
          Object.freeze({ x: labelPosition.x + width / 2, y: labelPosition.y - height * 0.26 }),
          Object.freeze({ x: labelPosition.x + width * 0.34, y: labelPosition.y + height / 2 }),
          Object.freeze({ x: labelPosition.x - width * 0.34, y: labelPosition.y + height / 2 }),
          Object.freeze({ x: labelPosition.x - width / 2, y: labelPosition.y - height * 0.26 })
        ]), {
          color: '#244f8a', alpha: 0.94
        }, {
          color: '#a8d4ff', alpha: 0.72, width: Math.max(1, stageScale) * cellScale
        });
      } else if (statusLabel.kind === 'bomb' || statusLabel.kind === 'countdown') {
        const width = (isDoubleDigit ? 24 : 20) * fixedUiScale;
        const height = 20 * fixedUiScale;
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height / 2 }),
          Object.freeze({ x: labelPosition.x + width / 2, y: labelPosition.y + height / 2 }),
          Object.freeze({ x: labelPosition.x - width / 2, y: labelPosition.y + height / 2 })
        ]), {
          color: '#ac1c1c', alpha: 0.88
        }, {
          color: '#ffb8b8', alpha: 0.72, width: Math.max(1, stageScale) * cellScale
        });
      } else if (statusLabel.kind === 'regen') {
        const width = (isDoubleDigit ? 24 : 20) * fixedUiScale;
        const height = 20 * fixedUiScale;
        const heartColor = normalizedSpecialType === 'ZOMBIE' ? '#8739d6' : '#ff3f98';
        const heartOutline = normalizedSpecialType === 'ZOMBIE' ? '#e8d3ff' : '#ffd2e8';
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y + height * 0.47 }),
          Object.freeze({ x: labelPosition.x - width * 0.46, y: labelPosition.y + height * 0.02 }),
          Object.freeze({ x: labelPosition.x - width * 0.43, y: labelPosition.y - height * 0.26 }),
          Object.freeze({ x: labelPosition.x - width * 0.26, y: labelPosition.y - height * 0.43 }),
          Object.freeze({ x: labelPosition.x - width * 0.08, y: labelPosition.y - height * 0.39 }),
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height * 0.22 }),
          Object.freeze({ x: labelPosition.x + width * 0.08, y: labelPosition.y - height * 0.39 }),
          Object.freeze({ x: labelPosition.x + width * 0.26, y: labelPosition.y - height * 0.43 }),
          Object.freeze({ x: labelPosition.x + width * 0.43, y: labelPosition.y - height * 0.26 }),
          Object.freeze({ x: labelPosition.x + width * 0.46, y: labelPosition.y + height * 0.02 })
        ]), {
          color: heartColor, alpha: 0.96
        }, {
          color: heartOutline, alpha: 0.9, width: Math.max(1, stageScale) * cellScale
        });
      } else if (statusLabel.kind === 'freeze') {
        drawPixiCircle(specialRing, labelPosition.x, labelPosition.y, cellSize * 0.14, {
          color: '#0c2e48', alpha: 0.78
        }, {
          color: '#cbf0ff', alpha: 0.75, width: Math.max(1, cellSize * 0.018)
        });
      } else if (statusLabel.kind === 'flip-evade') {
        const width = (isDoubleDigit ? 22 : 16) * fixedUiScale;
        const height = 16 * fixedUiScale;
        drawPixiEllipse(specialRing, labelPosition.x, labelPosition.y, width / 2, height / 2, {
          color: '#5e3a86', alpha: 0.9
        }, {
          color: '#e2c8ff', alpha: 0.72, width: Math.max(1, cellSize * 0.018)
        });
      } else if (statusLabel.kind === 'destroy-evade') {
        const width = (isDoubleDigit ? 24 : 18) * fixedUiScale;
        const height = 16 * fixedUiScale;
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height / 2 }),
          Object.freeze({ x: labelPosition.x + width / 2, y: labelPosition.y }),
          Object.freeze({ x: labelPosition.x, y: labelPosition.y + height / 2 }),
          Object.freeze({ x: labelPosition.x - width / 2, y: labelPosition.y })
        ]), {
          color: '#972828', alpha: 0.9
        }, {
          color: '#ffd3d3', alpha: 0.75, width: Math.max(1, stageScale) * cellScale
        });
      } else if (statusLabel.kind === 'poison') {
        const width = (isDoubleDigit ? 22 : 18) * fixedUiScale;
        const height = 17 * fixedUiScale;
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height / 2 }),
          Object.freeze({ x: labelPosition.x + width / 2, y: labelPosition.y + height / 2 }),
          Object.freeze({ x: labelPosition.x - width / 2, y: labelPosition.y + height / 2 })
        ]), {
          color: '#6b2b91', alpha: 0.9
        }, {
          color: '#e2c8ff', alpha: 0.74, width: Math.max(1, stageScale) * cellScale
        });
      } else if (statusLabel.kind === 'scorch') {
        const width = (isDoubleDigit ? 23 : 19) * fixedUiScale;
        const height = 19 * fixedUiScale;
        drawPixiPolygon(specialRing, Object.freeze([
          Object.freeze({ x: labelPosition.x, y: labelPosition.y - height / 2 }),
          Object.freeze({ x: labelPosition.x + width * 0.22, y: labelPosition.y - height * 0.16 }),
          Object.freeze({ x: labelPosition.x + width / 2, y: labelPosition.y - height * 0.28 }),
          Object.freeze({ x: labelPosition.x + width * 0.36, y: labelPosition.y + height * 0.08 }),
          Object.freeze({ x: labelPosition.x + width * 0.48, y: labelPosition.y + height * 0.43 }),
          Object.freeze({ x: labelPosition.x, y: labelPosition.y + height * 0.34 }),
          Object.freeze({ x: labelPosition.x - width * 0.48, y: labelPosition.y + height * 0.43 }),
          Object.freeze({ x: labelPosition.x - width * 0.36, y: labelPosition.y + height * 0.08 }),
          Object.freeze({ x: labelPosition.x - width / 2, y: labelPosition.y - height * 0.28 }),
          Object.freeze({ x: labelPosition.x - width * 0.22, y: labelPosition.y - height * 0.16 })
        ]), {
          color: '#bd2d0d', alpha: 0.94
        }, {
          color: '#ffc07d', alpha: 0.8, width: Math.max(1, stageScale) * cellScale
        });
      }
      const text = createPixiText(
        runtime,
        `pixi-stone-status:${statusLabel.kind}`,
        statusLabel.value,
        toPixiTextStyle(context.theme.timer, cellSize, statusLabel.value)
      );
      if (!text) continue;
      if (
        statusLabel.kind === 'special'
        || statusLabel.kind === 'bomb'
        || statusLabel.kind === 'countdown'
        || statusLabel.kind === 'guard'
        || statusLabel.kind === 'regen'
        || statusLabel.kind === 'flip-evade'
        || statusLabel.kind === 'destroy-evade'
        || statusLabel.kind === 'poison'
        || statusLabel.kind === 'scorch'
      ) {
        text.style = {
          ...text.style,
          fill: '#ffffff',
          fontSize: (
            statusLabel.kind === 'special'
              ? (isDoubleDigit ? 9 : 11)
              : (isDoubleDigit ? 8 : 10)
          ) * fixedUiScale,
          lineHeight: (
            statusLabel.kind === 'special'
              ? (isDoubleDigit ? 9 : 11)
              : (isDoubleDigit ? 8 : 10)
          ) * fixedUiScale
        };
      }
      setPixiAnchor(text, 0.5);
      const statusTextOffsetY = statusLabel.kind === 'poison' || statusLabel.kind === 'scorch'
        ? 0
        : statusLabel.kind === 'bomb' || statusLabel.kind === 'countdown'
          ? fixedUiScale * 1.2
          : 0;
      setPixiPosition(text, labelPosition.x, labelPosition.y + statusTextOffsetY);
      addPixiChild(statusLabelsRoot, text);
    }
    return true;
  }

  function applyTransform(transform: PixiStoneViewTransform): void {
    assertAlive();
    const x = Number(transform?.x);
    const y = Number(transform?.y);
    const pivotX = Number(transform?.pivotX);
    const pivotY = Number(transform?.pivotY);
    const scaleX = Number(transform?.scaleX);
    const scaleY = Number(transform?.scaleY);
    const rotation = Number(transform?.rotation);
    const alpha = Number(transform?.alpha);
    setPixiPivot(root, Number.isFinite(pivotX) ? pivotX : 0, Number.isFinite(pivotY) ? pivotY : 0);
    setPixiPosition(root, Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0);
    setPixiScale(root, Number.isFinite(scaleX) ? scaleX : 1, Number.isFinite(scaleY) ? scaleY : 1);
    root.rotation = Number.isFinite(rotation) ? rotation : 0;
    root.alpha = Number.isFinite(alpha) ? alpha : 1;
    transformApplyCount += 1;
  }

  function update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean {
    const changed = prepareStaticVisual(cell, context);
    position = { x: context.sceneX, y: context.sceneY };
    applyTransform({ x: position.x, y: position.y });
    return changed;
  }

  function invalidate(): void {
    if (!destroyed) signature = null;
  }

  function reset(): void {
    if (destroyed) return;
    signature = null;
    key = null;
    owner = null;
    specialType = null;
    timerLabel = '';
    badgeLabel = '';
    flipProtectionBadgeVisible = false;
    statusLabels = [];
    textureBacked = false;
    texturePurpose = null;
    renderedMarkerKinds = [];
    position = { x: 0, y: 0 };
    root.visible = false;
    clearPixiGraphics(shadow);
    clearPixiGraphics(aura);
    clearPixiGraphics(procedural);
    clearPixiGraphics(specialRing);
    clearPixiGraphics(statusOverlay);
    if (sprite) sprite.visible = false;
    if (markerOverlay) markerOverlay.visible = false;
    if (specialBadge) specialBadge.visible = false;
    if (flipProtectionBadge) flipProtectionBadge.visible = false;
    removeAndDestroyPixiChildren(statusLabelsRoot);
    removePixiFromParent(root);
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    destroyPixiDisplayObject(root);
  }

  function getDiagnostics(): PixiStoneViewDiagnostics {
    return Object.freeze({
      updateCount,
      staticPrepareCount: updateCount,
      transformApplyCount,
      resetCount,
      destroyed,
      key,
      visible: !!root.visible,
      owner,
      specialType,
      timerLabel,
      badgeLabel,
      flipProtectionBadgeVisible,
      statusLabels: Object.freeze(statusLabels.map((entry) => Object.freeze({ ...entry }))),
      textureBacked,
      texturePurpose,
      renderedMarkerKinds: Object.freeze(renderedMarkerKinds.slice()),
      position: Object.freeze({ ...position })
    });
  }

  return Object.freeze({
    root,
    prepareStaticVisual,
    applyTransform,
    update,
    invalidate,
    reset,
    destroy,
    getDiagnostics
  });
}
