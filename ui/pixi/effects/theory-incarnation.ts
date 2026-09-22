import { playPixiReincarnation } from './reincarnation';
import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackEffectHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  interpolate,
  normalizePlaybackCoordinate
} from './common';
import type { PixiBoardEffectProjection } from './types';

const THEORY_ROULETTE_BASE_DURATION_MS = 2500;
const THEORY_ROULETTE_DELAYS_MS = Object.freeze([
  62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5,
  125, 125, 125, 125, 125, 125, 125,
  250, 250, 375, 250
]);

interface TheoryCandidate {
  readonly row: number;
  readonly col: number;
  readonly value: number | null;
}

interface TheoryCandidateEffect {
  readonly candidate: TheoryCandidate;
  readonly handle: PixiPlaybackEffectHandle;
}

function durationMs(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : fallback;
}

function normalizeCandidate(value: unknown): TheoryCandidate | null {
  const coordinate = normalizePlaybackCoordinate(value);
  if (!coordinate) return null;
  const numeric = Number(value && typeof value === 'object' ? (value as any).value : null);
  return Object.freeze({
    ...coordinate,
    value: Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null
  });
}

function candidatesForTarget(target: any): readonly TheoryCandidate[] {
  const seen = new Set<string>();
  const candidates: TheoryCandidate[] = [];
  for (const raw of Array.isArray(target?.candidateCells) ? target.candidateCells : []) {
    const candidate = normalizeCandidate(raw);
    if (!candidate) continue;
    const key = `${candidate.row},${candidate.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  const selected = normalizeCandidate(target?.selectedCell || target);
  if (selected && !seen.has(`${selected.row},${selected.col}`)) candidates.push(selected);
  return Object.freeze(candidates);
}

function selectedIndex(candidates: readonly TheoryCandidate[], target: any): number {
  const selected = normalizePlaybackCoordinate(target?.selectedCell || target);
  if (!selected) return 0;
  const index = candidates.findIndex((candidate) => (
    candidate.row === selected.row && candidate.col === selected.col
  ));
  return Math.max(0, index);
}

function scaledDelays(totalDurationMs: number): readonly number[] {
  if (totalDurationMs === THEORY_ROULETTE_BASE_DURATION_MS) return THEORY_ROULETTE_DELAYS_MS;
  const scale = THEORY_ROULETTE_BASE_DURATION_MS > 0
    ? totalDurationMs / THEORY_ROULETTE_BASE_DURATION_MS
    : 0;
  let used = 0;
  return Object.freeze(THEORY_ROULETTE_DELAYS_MS.map((delay, index) => {
    if (index === THEORY_ROULETTE_DELAYS_MS.length - 1) return Math.max(0, totalDurationMs - used);
    const scaled = Math.max(1, Math.round(delay * scale));
    used += scaled;
    return scaled;
  }));
}

function rouletteStep(delays: readonly number[], elapsedMs: number): number {
  let boundary = 0;
  for (let index = 0; index < delays.length; index += 1) {
    boundary += delays[index];
    if (elapsedMs < boundary) return index;
  }
  return Math.max(0, delays.length - 1);
}

function activeCandidateIndex(
  size: number,
  selected: number,
  step: number,
  stepCount: number,
  previous: number | null
): number {
  if (size <= 1) return 0;
  if (step >= stepCount - 1) return selected;
  const remaining = stepCount - 1 - step;
  let index = ((selected - remaining) % size + size) % size;
  if (step === 0 && index === selected) index = (index - 1 + size) % size;
  if (previous !== null && index === previous) index = (index + 1) % size;
  return index;
}

async function playTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const candidates = candidatesForTarget(target);
  const selectedCoordinate = normalizePlaybackCoordinate(target?.selectedCell || target);
  if (!selectedCoordinate) return;
  const rouletteDurationMs = durationMs(event?.durationMs, projection.timings.theoryRouletteMs);
  const materializeDurationMs = durationMs(event?.materializeMs, projection.timings.theoryMaterializeMs);
  const selected = selectedIndex(candidates, target);
  const delays = scaledDelays(rouletteDurationMs);
  const candidateEffects: TheoryCandidateEffect[] = [];
  let materializedGhost: PixiPlaybackGhostHandle | null = null;
  let previousActive: number | null = null;
  const releaseCandidates = () => {
    while (candidateEffects.length) projection.releaseEffect(candidateEffects.pop()!.handle);
  };
  const releaseGhost = () => {
    if (!materializedGhost) return;
    const owned = materializedGhost;
    materializedGhost = null;
    projection.releaseGhost(owned);
  };
  try {
    await projection.timeline.run({
      durationMs: rouletteDurationMs,
      effectFamily: 'theory-incarnation-roulette',
      event,
      onStart: () => {
        projection.setProjectedStone(selectedCoordinate.row, selectedCoordinate.col, null);
        for (const candidate of candidates) {
          const handle = projection.acquireEffect({
            row: candidate.row,
            col: candidate.col,
            family: 'theory_incarnation_spawn_roulette',
            kind: 'roulette',
            tone: 'purple',
            label: candidate.value
          });
          projection.updateEffect(handle, { alpha: 0.18, scale: 0.96 });
          candidateEffects.push(Object.freeze({ candidate, handle }));
        }
      },
      onUpdate: (progress, frame) => {
        if (!candidateEffects.length) return;
        const step = frame.noAnimation
          ? delays.length - 1
          : rouletteStep(delays, frame.elapsedMs);
        const active = activeCandidateIndex(
          candidateEffects.length,
          selected,
          step,
          delays.length,
          previousActive
        );
        if (active !== previousActive) {
          for (let index = 0; index < candidateEffects.length; index += 1) {
            projection.updateEffect(candidateEffects[index].handle, {
              alpha: index === active ? 1 : (index === previousActive ? 0.34 : 0.16),
              scale: index === active ? 1.08 : 0.96
            });
          }
          previousActive = active;
        }
        if (progress >= 1) releaseCandidates();
      }
    });

    const finalVisual = createPlaybackStoneVisual(
      target?.after,
      target?.ownerAfter,
      target?.owner,
      event?.owner
    );
    await projection.timeline.run({
      durationMs: materializeDurationMs,
      effectFamily: 'theory-incarnation-materialize',
      event,
      onStart: () => {
        if (!finalVisual) return;
        materializedGhost = projection.acquireTransientGhost(
          selectedCoordinate.row,
          selectedCoordinate.col,
          finalVisual
        );
        projection.updateGhost(materializedGhost, {
          alpha: projection.noAnimation ? 1 : 0,
          scaleX: projection.noAnimation ? 1 : 0.68,
          scaleY: projection.noAnimation ? 1 : 0.68
        });
      },
      onUpdate: (progress) => {
        if (materializedGhost) projection.updateGhost(materializedGhost, {
          alpha: progress,
          scaleX: interpolate(0.68, 1, progress),
          scaleY: interpolate(0.68, 1, progress)
        });
        if (progress >= 1) {
          releaseGhost();
          projection.setProjectedStone(selectedCoordinate.row, selectedCoordinate.col, finalVisual);
        }
      }
    });
  } finally {
    releaseCandidates();
    releaseGhost();
  }
}

export async function playPixiTheoryIncarnationEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  for (const target of Array.isArray(event?.targets) ? event.targets : []) {
    if (target?.reincarnation === true) await playPixiReincarnation(event, target, projection);
    else await playTarget(event, target, projection);
  }
}

export const PIXI_THEORY_ROULETTE_DELAYS_MS = THEORY_ROULETTE_DELAYS_MS;
