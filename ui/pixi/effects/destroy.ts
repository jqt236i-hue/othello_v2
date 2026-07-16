import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import { createPlaybackStoneVisual, normalizePlaybackCoordinate } from './common';
import {
  resolveDestroyHighlightMinimumMs,
  resolvePlaybackHighlightTone
} from './highlight';
import type { PixiBoardEffectProjection } from './types';

async function playDestroyTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate) return;
  const meta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
  const preserveStone = meta.blockedByGhost === true
    || meta.proliferated === true
    || meta.regenerated === true;
  const tone = resolvePlaybackHighlightTone(event.type, target, projection.noAnimation);
  const explicitMinimumMs = resolveDestroyHighlightMinimumMs(target, projection.timings.moveMs);
  const highlightMinimumMs = tone
    ? Math.max(projection.timings.positiveHighlightMinimumMs, explicitMinimumMs)
    : 0;
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  let ghost: PixiPlaybackGhostHandle | null = null;
  let ghostReleased = false;
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  const releaseGhost = () => {
    if (!ghost) return;
    const owned = ghost;
    ghost = null;
    ghostReleased = true;
    projection.releaseGhost(owned);
  };

  if (preserveStone) {
    try {
      await projection.timeline.run({
        durationMs: Math.max(
          Math.max(120, Math.floor(projection.timings.fadeOutMs / 2)),
          highlightMinimumMs
        ),
        effectFamily: 'destroy-preserved',
        event,
        onStart: () => {
          if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
        },
        onUpdate: (progress) => {
          if (progress >= 1) releaseHighlight();
        }
      });
    } finally {
      releaseHighlight();
    }
    return;
  }

  const phaseSource = projection.getPhaseSourceStone(coordinate.row, coordinate.col);
  const current = projection.getProjectedStone(coordinate.row, coordinate.col);
  const before = phaseSource || current || createPlaybackStoneVisual(
      target && target.before,
      target && target.ownerBefore,
      target && target.owner,
      event && event.owner
    );
  // Parallel FLIP/DESTROY launches can mutate the same projection. Duration
  // parity is determined from the immutable phase-boundary visual, never from
  // whichever launch happened to write first.
  const hasLiveSource = phaseSource !== null;
  if (!before && !tone) return;
  try {
    await projection.timeline.run({
      // DOM destroy uses a 500 ms visual fade plus its 200 ms safety settle.
      // A snapshot whose canonical source is already empty instead replays the
      // event-owned ghost for exactly the 500 ms visual duration.
      durationMs: Math.max(
        hasLiveSource
          ? projection.timings.destroySettlementMs
          : projection.timings.fadeOutMs,
        highlightMinimumMs
      ),
      effectFamily: 'destroy',
      event,
      onStart: () => {
        projection.setProjectedStone(coordinate.row, coordinate.col, null);
        if (before) ghost = projection.acquireTransientGhost(coordinate.row, coordinate.col, before);
        if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
      },
      onUpdate: (progress, frame) => {
        const visualProgress = frame.noAnimation
          ? 1
          : frame.reducedMotion
            ? 1
            : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.fadeOutMs));
        if (ghost) projection.updateGhost(ghost, { alpha: 1 - visualProgress });
        if (visualProgress >= 1 && !ghostReleased) releaseGhost();
        if (progress >= 1) {
          // A shorter parallel FLIP can install its final retained stone after
          // DESTROY's onStart. Reassert the completed destroy only on normal
          // timeline completion; abort/recovery remains checkpoint-owned.
          projection.setProjectedStone(coordinate.row, coordinate.col, null);
          releaseHighlight();
        }
      }
    });
  } finally {
    releaseGhost();
    releaseHighlight();
  }
}

export async function playPixiDestroyEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const targets: readonly unknown[] = event.targets || [];
  await Promise.all(targets.map((target) => playDestroyTarget(event, target, projection)));
}
