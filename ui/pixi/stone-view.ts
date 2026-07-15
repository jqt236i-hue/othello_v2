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
  drawPixiLine,
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
  'poisoned',
  'breeding-sprout'
]);

function markerSpecialType(markers: readonly BoardMarkerVisual[]): string | null {
  const typeByKind: Readonly<Record<string, string>> = Object.freeze({
    'living-will-aura': 'LIVING_WILL',
    'manifest-aura': 'MANIFEST',
    guard: 'GUARD',
    bomb: 'TIME_BOMB',
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
  add('special', finiteStatusLabel(status, ['remainingOwnerTurns', 'remainingTurns']));
  const specialMarker = markers.find((marker) => marker.kind === 'special');
  if (specialMarker) {
    add('special', finiteStatusLabel(specialMarker.data || {}, ['remainingOwnerTurns', 'remainingTurns']));
  }
  add('regen', finiteStatusLabel(status, ['regenRemaining']));
  add('flip-evade', finiteStatusLabel(status, ['flipEvadeRemaining']));
  add('destroy-evade', finiteStatusLabel(status, ['destroyEvadeRemaining']));

  const markerOrder = ['bomb', 'guard', 'poisoned', 'breeding-sprout'] as const;
  const markerKind = Object.freeze({
    bomb: 'bomb',
    guard: 'guard',
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
    special: [0.78, 0.78],
    regen: [0.78, 0.22],
    'flip-evade': [0.22, 0.78],
    'destroy-evade': [0.22, 0.22],
    bomb: [0.5, 0.14],
    guard: [0.5, 0.86],
    poison: [0.86, 0.5],
    breeding: [0.14, 0.5],
    countdown: [0.5, 0.5]
  });
  const ratio = ratios[kind] || [0.5, 0.5];
  return Object.freeze({ x: cellSize * ratio[0], y: cellSize * ratio[1] });
}

export function createPixiStoneView(runtime: PixiStaticViewRuntime): PixiStoneView {
  const root = createPixiContainer(runtime, 'pixi-stone-view');
  const procedural = createPixiGraphics(runtime, 'pixi-stone-procedural');
  const sprite = createPixiSprite(runtime, 'pixi-stone-texture');
  const specialRing = createPixiGraphics(runtime, 'pixi-stone-special-ring');
  const specialBadge = createPixiText(runtime, 'pixi-stone-special-badge');
  const statusLabelsRoot = createPixiContainer(runtime, 'pixi-stone-status-labels');
  addPixiChild(root, procedural, sprite, specialRing, specialBadge, statusLabelsRoot);
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
    clearPixiGraphics(procedural);
    clearPixiGraphics(specialRing);
    const stone = cell.kind === 'playable' ? cell.stone : null;
    const stoneMarkers = cell.kind === 'playable'
      ? cell.markers.filter((marker) => STONE_MARKER_KINDS.has(marker.kind))
      : [];
    renderedMarkerKinds = stoneMarkers.map((marker) => marker.kind);
    root.visible = !!stone || stoneMarkers.length > 0;
    if (!stone && !stoneMarkers.length) {
      owner = null;
      specialType = null;
      timerLabel = '';
      badgeLabel = '';
      textureBacked = false;
      texturePurpose = null;
      if (sprite) sprite.visible = false;
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
    const radius = cellSize * 0.41;
    const purposes = stoneTexturePurposes(owner, specialType);
    const texture = stone ? resolvePixiStaticTexture(context.textures, purposes) : null;
    texturePurpose = texture ? purposes.find((purpose) => !!resolvePixiStaticTexture(context.textures, [purpose])) || null : null;
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
      sprite.width = radius * 2;
      sprite.height = radius * 2;
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

    if (specialType && stone) {
      drawPixiCircle(specialRing, center, center, radius * 1.03, null, {
        color: context.theme.hintColor,
        alpha: 0.86,
        width: Math.max(1.5, cellSize * 0.035)
      });
      if (specialBadge) {
        specialBadge.text = '◆';
        specialBadge.style = toPixiTextStyle(context.theme.directionHint, cellSize * 0.66, '◆');
        specialBadge.visible = true;
        setPixiAnchor(specialBadge, 0.5);
        setPixiPosition(specialBadge, cellSize * 0.24, cellSize * 0.24);
      }
    } else if (specialBadge) {
      specialBadge.visible = false;
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
      const text = createPixiText(
        runtime,
        `pixi-stone-status:${statusLabel.kind}`,
        statusLabel.value,
        toPixiTextStyle(context.theme.timer, cellSize, statusLabel.value)
      );
      if (!text) continue;
      const labelPosition = statusLabelPosition(statusLabel.kind, cellSize);
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
