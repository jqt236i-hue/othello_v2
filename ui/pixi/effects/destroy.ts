import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackEffectHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import PresentationEffectProfiles = require('../../../shared/presentation-effect-profiles');
import {
  createPlaybackStoneVisual,
  interpolate,
  normalizePlaybackCoordinate,
  playbackTargetCause,
  playbackTargetMeta,
  playbackTargetReason,
  resolveMoveDurationScale
} from './common';
import {
  resolveDestroyHighlightMinimumMs,
  resolvePlaybackHighlightTone
} from './highlight';
import type { PixiBoardEffectProjection } from './types';

function specialProfileKey(target: any): string | null {
  return PresentationEffectProfiles.getSpecialDestroyTargetProfileKey(target);
}

function isSuperCrushTarget(target: any): boolean {
  return Object.values(PresentationEffectProfiles.SUPER_CRUSH_DESTROY_TARGET_PROFILES)
    .some((profile: any) => PresentationEffectProfiles.matchesCauseReasonProfile(target, profile));
}

function superCrushDelayMs(target: any, projection: PixiBoardEffectProjection): number {
  if (!isSuperCrushTarget(target)) return 0;
  const progress = Number(playbackTargetMeta(target).collisionProgress);
  if (!Number.isFinite(progress)) return 0;
  const duration = Math.max(1, Math.round(
    projection.timings.moveMs * resolveMoveDurationScale(target)
  ));
  return Math.max(0, Math.round(duration * Math.max(0, Math.min(0.88, progress))));
}

function impactProfile(profileKey: string | null, target: any): Readonly<{
  family: string;
  tone: 'blue' | 'purple' | 'red' | 'white';
  durationMs: number;
}> | null {
  switch (profileKey) {
    case 'lightningDestroyed':
    case 'udgDestroyed':
      return Object.freeze({ family: 'lightning-impact', tone: 'blue', durationMs: 330 });
    case 'destroyDragonBreath':
      return Object.freeze({ family: 'destroy-dragon-impact', tone: 'red', durationMs: 440 });
    case 'meteorGodBlackBeam':
      return Object.freeze({ family: 'meteor-god-impact', tone: 'purple', durationMs: 430 });
    case 'willHunterKingSlash':
      return Object.freeze({ family: 'will-hunter-king-slash', tone: 'white', durationMs: 280 });
    default:
      return isSuperCrushTarget(target)
        ? Object.freeze({ family: 'super-crush-impact', tone: 'red', durationMs: 220 })
        : null;
  }
}

async function playTargetImpact(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection,
  profile: ReturnType<typeof impactProfile>
): Promise<void> {
  if (!profile) return;
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate) return;
  let effect: PixiPlaybackEffectHandle | null = null;
  const release = () => {
    if (!effect) return;
    const owned = effect;
    effect = null;
    projection.releaseEffect(owned);
  };
  try {
    await projection.timeline.run({
      durationMs: profile.durationMs,
      effectFamily: profile.family,
      event,
      onStart: () => {
        effect = projection.acquireEffect({
          ...coordinate,
          family: profile.family,
          kind: 'impact',
          tone: profile.tone
        });
      },
      onUpdate: (progress) => {
        if (effect) projection.updateEffect(effect, {
          alpha: 1 - progress,
          scale: interpolate(0.28, 1.72, progress),
          rotation: progress * Math.PI * 0.36
        });
        if (progress >= 1) release();
      }
    });
  } finally {
    release();
  }
}

async function playDestroyTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate) return;
  const profileKey = specialProfileKey(target);
  const destroyCause = playbackTargetCause(target);
  const destroyReason = playbackTargetReason(target);
  const isGluttonousReplacement = profileKey === 'gluttonousEat'
    || (destroyCause === 'GLUTTONOUS_WILL' && destroyReason.startsWith('gluttonous_eat'));
  if (isGluttonousReplacement) {
    // Its paired MOVE in the same phase owns both the transient and terminal
    // stone pixels. DESTROY remains an ordered semantic event only.
    return;
  }
  const delayMs = superCrushDelayMs(target, projection);
  if (delayMs > 0) {
    await projection.timeline.run({
      durationMs: delayMs,
      effectFamily: 'destroy-collision-delay',
      event,
      onUpdate: () => undefined
    });
  }
  const impact = impactProfile(profileKey, target);
  const impactPromise = playTargetImpact(event, target, projection, impact);
  await Promise.all([
    projection.waitForSourceTrajectories(event, target),
    impactPromise
  ]);
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

  if (profileKey === 'robotVacuumSuck') {
    projection.setProjectedStone(coordinate.row, coordinate.col, null);
    return;
  }

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
