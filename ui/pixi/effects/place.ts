import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type { PixiPlaybackCellHighlightHandle } from '../board-scene';
import { createPlaybackStoneVisual, normalizePlaybackCoordinate } from './common';
import { resolvePlaybackHighlightTone } from './highlight';
import type { PixiBoardEffectProjection } from './types';

export async function playPixiPlacementTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate) return;
  const visual = createPlaybackStoneVisual(
    target && target.after,
    target && target.owner,
    target && target.player,
    event && event.owner
  );
  if (!visual) return;
  const highlightTarget = !target?.meta && event.meta
    ? { ...target, meta: event.meta }
    : target;
  const tone = resolvePlaybackHighlightTone(event.type, highlightTarget, projection.noAnimation);
  const durationMs = tone ? projection.timings.positiveHighlightMinimumMs : 0;
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  try {
    await projection.timeline.run({
      durationMs,
      effectFamily: 'place',
      event,
      onStart: () => {
        projection.setProjectedStone(coordinate.row, coordinate.col, visual);
        if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
      },
      onUpdate: (progress) => {
        if (progress >= 1) releaseHighlight();
      }
    });
  } finally {
    releaseHighlight();
  }
}

export async function playPixiPlaceEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const targets: readonly unknown[] = event.targets || [];
  // The DOM placement executor intentionally runs targets in DTO order.
  for (const target of targets) await playPixiPlacementTarget(event, target, projection);
}
