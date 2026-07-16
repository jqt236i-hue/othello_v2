import type { MaterializedBoardCellVisualState } from '../board-visual/types';
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
  drawPixiRect,
  removeAndDestroyPixiChildren,
  removePixiFromParent,
  resolvePixiStaticTexture,
  setPixiAnchor,
  setPixiPosition,
  toPixiTextStyle,
  type PixiStaticViewContext,
  type PixiStaticViewRuntime
} from './cell-view';

type BoardMarkerVisual = MaterializedBoardCellVisualState['markers'][number];

export interface PixiStoneViewDiagnostics {
  readonly updateCount: number;
  readonly resetCount: number;
  readonly destroyed: boolean;
  readonly key: string | null;
  readonly visible: boolean;
  readonly owner: 'black' | 'white' | null;
  readonly specialType: string | null;
  readonly timerLabel: string;
  readonly badgeLabel: string;
  readonly statusLabels: readonly Readonly<{ kind: string; value: string }>[];
  readonly textureBacked: boolean;
  readonly texturePurpose: string | null;
  readonly renderedMarkerKinds: readonly string[];
  readonly position: Readonly<{ x: number; y: number }>;
}

export interface PixiStoneView {
  readonly root: any;
  update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
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
  'breeding-sprout'
]);

export function hasPixiStoneVisual(cell: MaterializedBoardCellVisualState): boolean {
  return cell.kind === 'playable' && (
    !!cell.stone || cell.markers.some((marker) => STONE_MARKER_KINDS.has(marker.kind))
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
    'breeding-sprout': 'BREEDING'
  });
  for (const marker of markers) {
    const explicit = String(marker.data && marker.data.type || '').trim().toUpperCase();
    if (explicit) return explicit;
    if (typeByKind[marker.kind]) return typeByKind[marker.kind];
  }
  return null;
}

function collectStoneStatusLabels(
  status: Readonly<Record<string, unknown>>,
  markers: readonly BoardMarkerVisual[]
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
  add('special', finiteStatusLabel(status, ['remainingOwnerTurns', 'remainingTurns']));
  const specialMarker = markers.find((marker) => marker.kind === 'special');
  if (specialMarker) {
    add('special', finiteStatusLabel(specialMarker.data || {}, ['remainingOwnerTurns', 'remainingTurns']));
    addPositive('regen', finiteStatusLabel(specialMarker.data || {}, ['regenRemaining']));
    addPositive('flip-evade', finiteStatusLabel(specialMarker.data || {}, ['flipEvadeRemaining']));
    addPositive('destroy-evade', finiteStatusLabel(specialMarker.data || {}, ['destroyEvadeRemaining']));
  }
  addPositive('regen', finiteStatusLabel(status, ['regenRemaining']));
  addPositive('flip-evade', finiteStatusLabel(status, ['flipEvadeRemaining']));
  addPositive('destroy-evade', finiteStatusLabel(status, ['destroyEvadeRemaining']));

  const markerOrder = ['bomb', 'guard', 'frozen', 'poisoned', 'breeding-sprout'] as const;
  const markerKind = Object.freeze({
    bomb: 'bomb',
    guard: 'guard',
    frozen: 'freeze',
    poisoned: 'poison',
    'breeding-sprout': 'breeding'
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
  if (!labels.some((entry) => entry.kind === 'special')) {
    add('countdown', finiteStatusLabel(status, ['countdown', 'timer', 'count']));
  }
  return labels;
}

function statusLabelPosition(kind: string, cellSize: number): Readonly<{ x: number; y: number }> {
  const ratios: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
    special: [0.5, 0.82],
    regen: [0.14, 0.5],
    'flip-evade': [0.86, 0.14],
    'destroy-evade': [0.86, 0.5],
    bomb: [0.5, 0.86],
    guard: [0.5, 0.1],
    freeze: [0.23, 0.23],
    poison: [0.86, 0.5],
    breeding: [0.14, 0.5],
    countdown: [0.5, 0.5]
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
  const markerOverlay = createPixiSprite(runtime, 'pixi-stone-marker-overlay');
  const specialRing = createPixiGraphics(runtime, 'pixi-stone-special-ring');
  const specialBadge = createPixiText(runtime, 'pixi-stone-special-badge');
  const statusLabelsRoot = createPixiContainer(runtime, 'pixi-stone-status-labels');
  addPixiChild(root, shadow, aura, procedural, sprite, markerOverlay, specialRing, specialBadge, statusLabelsRoot);
  let signature: string | null = null;
  let key: string | null = null;
  let owner: 'black' | 'white' | null = null;
  let specialType: string | null = null;
  let timerLabel = '';
  let badgeLabel = '';
  let statusLabels: Array<{ kind: string; value: string }> = [];
  let textureBacked = false;
  let texturePurpose: string | null = null;
  let renderedMarkerKinds: string[] = [];
  let updateCount = 0;
  let resetCount = 0;
  let destroyed = false;
  let position = { x: 0, y: 0 };

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiStoneView is destroyed');
  }

  function update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean {
    assertAlive();
    const nextSignature = `${context.revisionSignature}|${cell.visualSignature}`;
    if (signature === nextSignature) return false;
    signature = nextSignature;
    key = cell.key;
    updateCount += 1;
    position = { x: context.sceneX, y: context.sceneY };
    setPixiPosition(root, position.x, position.y);
    clearPixiGraphics(shadow);
    clearPixiGraphics(aura);
    clearPixiGraphics(procedural);
    clearPixiGraphics(specialRing);
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
      textureBacked = false;
      texturePurpose = null;
      if (sprite) sprite.visible = false;
      if (markerOverlay) markerOverlay.visible = false;
      if (specialBadge) specialBadge.visible = false;
      statusLabels = [];
      removeAndDestroyPixiChildren(statusLabelsRoot);
      return true;
    }

    owner = stone?.owner || stoneMarkers.find((marker) => marker.owner)?.owner || 'black';
    specialType = stone?.specialType
      ? String(stone.specialType).trim().toUpperCase()
      : markerSpecialType(stoneMarkers);
    const cellSize = context.layout.cellSize;
    const center = cellSize / 2;
    // DOM uses --board-disc-size: 89.9% with a 5.05% inset on each side.
    const radius = cellSize * 0.4495;
    const normalizedSpecialType = String(specialType || '').trim().toUpperCase();
    const purposes = stoneTexturePurposes(owner, specialType);
    const basePurposes = [`${owner}-stone`, `stone:${owner}`];
    const specialTexture = stone ? resolvePixiStaticTexture(context.textures, purposes) : null;
    const freezeOverlayTexture = normalizedSpecialType === 'FREEZE'
      ? resolvePixiStaticTexture(context.textures, purposes.slice(0, 4))
      : null;
    const texture = stone
      ? (normalizedSpecialType === 'FREEZE'
        ? resolvePixiStaticTexture(context.textures, basePurposes)
        : specialTexture)
      : null;

    if (stone && !specialType) {
      // Match the two DOM depth layers without applying a per-stone filter:
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
      // CSS background painting lands the disc raster half a device pixel
      // below/right of Pixi's anchored quad at DPR 1. Preserve that sampling
      // origin so native and custom stone skins compare without a one-pixel
      // up/left drift.
      setPixiPosition(sprite, center + 0.5, center + 0.5);
      sprite.width = radius * 2;
      sprite.height = radius * 2;
    }
    if (markerOverlay) {
      markerOverlay.visible = !!freezeOverlayTexture;
      if (freezeOverlayTexture) markerOverlay.texture = freezeOverlayTexture;
      markerOverlay.alpha = 0.62;
      setPixiAnchor(markerOverlay, 0.5);
      setPixiPosition(markerOverlay, center, center);
      markerOverlay.width = cellSize;
      markerOverlay.height = cellSize;
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
    if (hasBreedingSprout && !stone) {
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
      if (normalizedType === 'FREEZE' && !freezeOverlayTexture) {
        drawPixiRect(specialRing, cellSize * 0.025, cellSize * 0.025, cellSize * 0.95, cellSize * 0.95, {
          color: '#8dc8ed',
          alpha: 0.86
        }, {
          color: '#d9f2ff',
          alpha: 0.78,
          width: Math.max(1, cellSize * 0.025)
        }, cellSize * 0.035);
        drawPixiLine(specialRing, cellSize * 0.08, cellSize * 0.76, cellSize * 0.76, cellSize * 0.08, {
          color: '#eaf8ff', alpha: 0.48, width: Math.max(1, cellSize * 0.018)
        });
        drawPixiLine(specialRing, cellSize * 0.3, cellSize * 0.96, cellSize * 0.96, cellSize * 0.3, {
          color: '#4f91c4', alpha: 0.42, width: Math.max(1, cellSize * 0.018)
        });
        showSpecialBadge('❄', center, center, '#f4fcff', 0.9);
      } else if ((normalizedType === 'TIME_BOMB' || normalizedType === 'BOMB') && !dedicatedTexture) {
        drawPixiCircle(specialRing, center, center, radius * 1.02, {
          color: '#160d08', alpha: 0.76
        }, {
          color: '#ff7a12', alpha: 0.9, width: Math.max(1.5, cellSize * 0.045)
        });
        drawPixiCircle(specialRing, center, center, radius * 0.76, null, {
          color: '#b71c16', alpha: 0.92, width: Math.max(1, cellSize * 0.03)
        });
        showSpecialBadge('⚠', center, center, '#ff9d22', 0.86);
      } else if (normalizedType === 'GUARD') {
        drawPixiCircle(specialRing, cellSize * 0.5, cellSize * 0.1, cellSize * 0.14, {
          color: '#244f8a', alpha: 0.94
        }, {
          color: '#a8d4ff', alpha: 0.72, width: Math.max(1, cellSize * 0.018)
        });
      } else if (normalizedType === 'ULTIMATE_REVERSE_DRAGON') {
        drawPixiCircle(specialRing, center, center, radius * 0.98, {
          color: '#f6ffff', alpha: owner === 'white' ? 0.82 : 0.08
        });
        drawPixiCircle(specialRing, center, center, radius * 1.02, null, {
          color: '#f4ffff', alpha: owner === 'white' ? 0.88 : 0.34, width: Math.max(1, cellSize * 0.028)
        });
      } else if (!dedicatedTexture) {
        drawPixiCircle(specialRing, center, center, radius * 1.03, null, {
          color: context.theme.hintColor,
          alpha: 0.86,
          width: Math.max(1.5, cellSize * 0.035)
        });
        showSpecialBadge('◆', cellSize * 0.24, cellSize * 0.24, context.theme.directionHint.color, 0.66);
      }
    }

    const status = stone?.status || {};
    statusLabels = collectStoneStatusLabels(status, stoneMarkers);
    timerLabel = statusLabels.find((entry) => (
      entry.kind === 'special' || entry.kind === 'countdown' || entry.kind === 'bomb' || entry.kind === 'guard'
    ))?.value || '';
    badgeLabel = statusLabels.find((entry) => (
      entry.kind === 'regen'
      || entry.kind === 'flip-evade'
      || entry.kind === 'destroy-evade'
      || entry.kind === 'poison'
    ))?.value || '';
    removeAndDestroyPixiChildren(statusLabelsRoot);
    for (const statusLabel of statusLabels) {
      const labelPosition = statusLabelPosition(statusLabel.kind, cellSize);
      if (statusLabel.kind === 'special') {
        drawPixiRect(
          specialRing,
          labelPosition.x - cellSize * 0.17,
          labelPosition.y - cellSize * 0.1,
          cellSize * 0.34,
          cellSize * 0.2,
          { color: '#28563c', alpha: 0.72 },
          { color: '#b8ecd0', alpha: 0.6, width: Math.max(1, cellSize * 0.018) },
          cellSize * 0.07
        );
      } else if (statusLabel.kind === 'guard') {
        // The shield background is drawn with the guard overlay above.
      } else if (statusLabel.kind === 'bomb') {
        drawPixiCircle(specialRing, labelPosition.x, labelPosition.y, cellSize * 0.14, {
          color: '#ac1c1c', alpha: 0.9
        }, {
          color: '#ffb8b8', alpha: 0.72, width: Math.max(1, cellSize * 0.018)
        });
      } else if (statusLabel.kind === 'freeze') {
        drawPixiCircle(specialRing, labelPosition.x, labelPosition.y, cellSize * 0.14, {
          color: '#0c2e48', alpha: 0.78
        }, {
          color: '#cbf0ff', alpha: 0.75, width: Math.max(1, cellSize * 0.018)
        });
      } else if (statusLabel.kind === 'flip-evade') {
        drawPixiCircle(specialRing, labelPosition.x, labelPosition.y, cellSize * 0.13, {
          color: '#5e3a86', alpha: 0.9
        }, {
          color: '#e2c8ff', alpha: 0.72, width: Math.max(1, cellSize * 0.018)
        });
      }
      const text = createPixiText(
        runtime,
        `pixi-stone-status:${statusLabel.kind}`,
        statusLabel.value,
        toPixiTextStyle(context.theme.timer, cellSize, statusLabel.value)
      );
      if (!text) continue;
      setPixiAnchor(text, 0.5);
      setPixiPosition(text, labelPosition.x, labelPosition.y);
      addPixiChild(statusLabelsRoot, text);
    }
    return true;
  }

  function reset(): void {
    if (destroyed) return;
    signature = null;
    key = null;
    owner = null;
    specialType = null;
    timerLabel = '';
    badgeLabel = '';
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
    if (sprite) sprite.visible = false;
    if (specialBadge) specialBadge.visible = false;
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
      resetCount,
      destroyed,
      key,
      visible: !!root.visible,
      owner,
      specialType,
      timerLabel,
      badgeLabel,
      statusLabels: Object.freeze(statusLabels.map((entry) => Object.freeze({ ...entry }))),
      textureBacked,
      texturePurpose,
      renderedMarkerKinds: Object.freeze(renderedMarkerKinds.slice()),
      position: Object.freeze({ ...position })
    });
  }

  return Object.freeze({ root, update, reset, destroy, getDiagnostics });
}
