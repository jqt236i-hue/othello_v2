import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  isBreedingSpawnTarget,
  normalizePlaybackCoordinate
} from './common';
import {
  resolvePlaybackHighlightTone,
  resolveSpawnHighlightMinimumMs
} from './highlight';
import { playPixiPlacementTarget } from './place';
import type { PixiBoardEffectProjection } from './types';

async function playBreedingSpawnTarget(
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
  const tone = resolvePlaybackHighlightTone(event.type, target, projection.noAnimation);
  const highlightMinimumMs = Math.max(
    tone ? projection.timings.positiveHighlightMinimumMs : 0,
    resolveSpawnHighlightMinimumMs(target, projection.timings.positiveHighlightMinimumMs)
  );
  const durationMs = Math.max(projection.timings.breedingSpawnFadeMs, highlightMinimumMs);
  let ghost: PixiPlaybackGhostHandle | null = null;
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  let finalApplied = false;
  const releaseGhost = () => {
    if (!ghost) return;
    const owned = ghost;
    ghost = null;
    projection.releaseGhost(owned);
  };
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  const applyFinal = () => {
    if (finalApplied) return;
    releaseGhost();
    projection.setProjectedStone(coordinate.row, coordinate.col, visual);
    finalApplied = true;
  };
  try {
    await projection.timeline.run({
      durationMs,
      effectFamily: 'spawn',
      event,
      onStart: () => {
        projection.setProjectedStone(coordinate.row, coordinate.col, null);
        ghost = projection.acquireTransientGhost(coordinate.row, coordinate.col, visual);
        projection.updateGhost(ghost, { alpha: projection.noAnimation ? 1 : 0 });
        if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
      },
      onUpdate: (progress, frame) => {
        const fadeProgress = frame.noAnimation
          ? 1
          : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.breedingSpawnFadeMs));
        if (ghost) projection.updateGhost(ghost, { alpha: fadeProgress });
        if (progress >= 1) {
          applyFinal();
          releaseHighlight();
        }
      }
    });
  } finally {
    releaseGhost();
    releaseHighlight();
  }
}

export async function playPixiSpawnEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const targets: readonly unknown[] = event.targets || [];
  const normalTargets: any[] = [];
  const breedingTargets: any[] = [];
  for (const target of targets) {
    (isBreedingSpawnTarget(target) ? breedingTargets : normalTargets).push(target);
  }
  for (const target of normalTargets) await playPixiPlacementTarget(event, target, projection);
  await Promise.all(breedingTargets.map((target) => playBreedingSpawnTarget(event, target, projection)));
}
