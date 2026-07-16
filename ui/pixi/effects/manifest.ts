import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type { BoardMarkerVisualState } from '../../board-visual/types';
import {
  createPlaybackStoneVisual,
  normalizePlaybackCoordinate,
  type PixiPlaybackStoneVisual
} from './common';
import type { PixiBoardEffectProjection } from './types';

function isManifestMarker(marker: BoardMarkerVisualState): boolean {
  return marker.kind === 'manifest-aura';
}

function normalizeCurrentManifestStone(
  current: PixiPlaybackStoneVisual | null
): PixiPlaybackStoneVisual | null {
  if (!current) return null;
  const status = { ...(current.stone.status || {}) } as Record<string, unknown>;
  delete status.special;
  delete status.specialType;
  delete status.manifestAura;
  delete status.remainingOwnerTurns;
  delete status.remainingTurns;
  delete status.timer;
  return Object.freeze({
    stone: Object.freeze({
      ...current.stone,
      specialType: null,
      status: Object.freeze(status)
    }),
    markers: Object.freeze(current.markers.filter((marker) => !isManifestMarker(marker)))
  });
}

function manifestEndingVisual(
  event: PresentationPlaybackEvent,
  target: any,
  current: PixiPlaybackStoneVisual | null
): PixiPlaybackStoneVisual | null {
  const rawAfter = target?.after && typeof target.after === 'object'
    ? { ...target.after, special: null, manifestAura: null, timer: null }
    : null;
  return (rawAfter
    ? createPlaybackStoneVisual(
      rawAfter,
      target?.ownerAfter,
      target?.owner,
      event?.owner,
      current?.stone.owner
    )
    : null) || normalizeCurrentManifestStone(current);
}

/**
 * The legacy board branch normalises every manifested stone synchronously.
 * Full-screen dimming/BGM teardown remains the concurrently launched global
 * presenter, so the Pixi board branch intentionally adds no extra wait.
 */
export async function playPixiManifestEndingBoardEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  for (const rawTarget of Array.isArray(event?.targets) ? event.targets : []) {
    const target: any = rawTarget;
    const coordinate = normalizePlaybackCoordinate(target);
    if (!coordinate) continue;
    const current = projection.getProjectedStone(coordinate.row, coordinate.col)
      || createPlaybackStoneVisual(
        target?.before,
        target?.ownerBefore,
        target?.owner,
        event?.owner
      );
    projection.setProjectedStone(
      coordinate.row,
      coordinate.col,
      manifestEndingVisual(event, target, current)
    );
  }
}
