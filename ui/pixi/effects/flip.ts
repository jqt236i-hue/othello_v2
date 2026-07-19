import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  interpolate,
  isZombieInfectionTarget,
  normalizePlaybackCoordinate
} from './common';
import { resolvePlaybackHighlightTone } from './highlight';
import type { PixiBoardEffectProjection } from './types';

function targetKey(target: unknown): string | null {
  const coordinate = normalizePlaybackCoordinate(target);
  return coordinate ? `${coordinate.row},${coordinate.col}` : null;
}

function mergeFlipTarget(previous: any, next: any): any {
  const merged = { ...(previous || {}), ...(next || {}) };
  if (previous && typeof previous === 'object') {
    if (typeof merged.ownerBefore === 'undefined') merged.ownerBefore = previous.ownerBefore;
    if (typeof merged.specialBefore === 'undefined') merged.specialBefore = previous.specialBefore;
    if (typeof merged.timerBefore === 'undefined') merged.timerBefore = previous.timerBefore;
  }
  if (previous?.meta && next?.meta) merged.meta = { ...previous.meta, ...next.meta };
  return merged;
}

function recordTargetStage(
  projection: PixiBoardEffectProjection,
  stage: 'impact-start' | 'commit',
  target: any,
  row: number,
  col: number
): void {
  projection.record?.(`pixi-playback:target-${stage}`, {
    eventType: 'flip',
    row,
    col,
    profileKey: isZombieInfectionTarget(target) ? 'zombieBite' : null
  });
}

export function dedupePixiFlipTargets(targets: readonly unknown[]): readonly any[] {
  const output: any[] = [];
  const indexByKey = new Map<string, number>();
  for (const target of Array.from(targets || [])) {
    const key = targetKey(target);
    if (!key || !indexByKey.has(key)) {
      if (key) indexByKey.set(key, output.length);
      output.push(target);
      continue;
    }
    const index = indexByKey.get(key)!;
    output[index] = mergeFlipTarget(output[index], target);
  }
  return Object.freeze(output);
}

async function playFlipTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate) return;
  const sourceTrajectoryGate = projection.waitForSourceTrajectories(event, target);
  recordTargetStage(projection, 'impact-start', target, coordinate.row, coordinate.col);
  const tone = resolvePlaybackHighlightTone(event.type, target, projection.noAnimation);
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  if (target?.meta?.blockedByGhost === true) {
    try {
      await Promise.all([
        projection.timeline.run({
          durationMs: Math.max(
            Math.max(120, Math.floor(projection.timings.flipMs / 2)),
            tone ? projection.timings.positiveHighlightMinimumMs : 0
          ),
          effectFamily: 'flip-blocked',
          event,
          onStart: () => {
            if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
          },
          onUpdate: (progress) => {
            if (progress >= 1) releaseHighlight();
          }
        }),
        sourceTrajectoryGate
      ]);
    } finally {
      releaseHighlight();
    }
    recordTargetStage(projection, 'commit', target, coordinate.row, coordinate.col);
    return;
  }

  const current = projection.getProjectedStone(coordinate.row, coordinate.col);
  const before = current || createPlaybackStoneVisual(
    target && target.before,
    target && target.ownerBefore,
    target && target.owner,
    event && event.owner
  );
  const after = createPlaybackStoneVisual(
    target && target.after,
    target && target.ownerAfter,
    target && target.owner,
    event && event.owner
  );
  const missingSource = current === null;
  const zombie = isZombieInfectionTarget(target);
  const baseDurationMs = missingSource
    ? projection.timings.fadeOutMs
    : zombie
      ? (projection.reducedMotion ? 0 : projection.timings.zombieBiteMs)
      : projection.timings.flipMs;
  const durationMs = Math.max(
    baseDurationMs,
    tone ? projection.timings.positiveHighlightMinimumMs : 0
  );
  let ghost: PixiPlaybackGhostHandle | null = null;
  let finalApplied = false;
  const releaseGhost = () => {
    if (!ghost) return;
    const owned = ghost;
    ghost = null;
    projection.releaseGhost(owned);
  };
  const showGhost = (visual: typeof before, scaleX = 1) => {
    releaseGhost();
    if (!visual) return;
    ghost = projection.acquireTransientGhost(coordinate.row, coordinate.col, visual);
    projection.updateGhost(ghost, { scaleX });
  };
  const applyFinal = () => {
    if (finalApplied) return;
    releaseGhost();
    // The legacy missing-source branch fades ownerBefore and remains empty
    // until the final local/committed model synchronization.
    projection.setProjectedStone(
      coordinate.row,
      coordinate.col,
      missingSource ? null : after
    );
    finalApplied = true;
  };
  try {
    const targetAnimation = projection.timeline.run({
      durationMs,
      effectFamily: zombie ? 'flip-zombie' : (missingSource ? 'flip-missing-source' : 'flip'),
      event,
      onStart: () => {
        projection.setProjectedStone(coordinate.row, coordinate.col, null);
        if (!projection.noAnimation) showGhost(missingSource || zombie ? before : after);
        if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);
      },
      onUpdate: (progress, frame) => {
        if (missingSource) {
          const visualProgress = frame.noAnimation
            ? 1
            : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.fadeOutMs));
          if (ghost) projection.updateGhost(ghost, { alpha: 1 - visualProgress });
        } else if (zombie) {
          const visualProgress = frame.noAnimation || frame.reducedMotion
            ? 1
            : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.zombieBiteMs));
          const pulse = visualProgress < 0.68
            ? 1
            : visualProgress < 0.82
              ? interpolate(1, 0.88, (visualProgress - 0.68) / 0.14)
              : interpolate(0.88, 1, (visualProgress - 0.82) / 0.18);
          if (ghost) projection.updateGhost(ghost, { scaleX: pulse, scaleY: 2 - pulse });
        } else {
          const visualProgress = frame.noAnimation
            ? 1
            : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.flipMs));
          const scaleX = visualProgress <= 0.5
            ? interpolate(1, 0.05, visualProgress * 2)
            : interpolate(0.05, 1, (visualProgress - 0.5) * 2);
          if (ghost) projection.updateGhost(ghost, { scaleX });
        }
        if (progress >= 1) {
          releaseHighlight();
        }
      }
    });
    await Promise.all([targetAnimation, sourceTrajectoryGate]);
    if (!finalApplied) {
      // Membership, not the merged target's final profile, owns the gate. A
      // deduped normal target can still carry an earlier raw zombie request.
      applyFinal();
      projection.render();
    }
  } finally {
    releaseGhost();
    releaseHighlight();
  }
  recordTargetStage(projection, 'commit', target, coordinate.row, coordinate.col);
}

export async function playPixiFlipEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const targets = dedupePixiFlipTargets(event.targets || []);
  await Promise.all(targets.map((target) => playFlipTarget(event, target, projection)));
}
