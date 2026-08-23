import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackEffectHandle,
  PixiPlaybackEffectTone,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  interpolate,
  normalizePlaybackCoordinate,
  type PixiPlaybackStoneVisual
} from './common';
import { playPixiMoveEffect } from './move';
import type { PixiBoardEffectProjection } from './types';

function eventCoordinate(event: PresentationPlaybackEvent): Readonly<{ row: number; col: number }> | null {
  return normalizePlaybackCoordinate(event);
}

function eventDuration(event: PresentationPlaybackEvent, fallback: number): number {
  const numeric = Number(event?.durationMs);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : fallback;
}

function toneForEffectKey(effectKey: unknown): PixiPlaybackEffectTone {
  const key = String(effectKey || '').trim().toLowerCase();
  if (key.includes('regen') || key.includes('poison')) return 'green';
  if (key.includes('protect') || key.includes('guard') || key.includes('strong')) return 'gold';
  if (key.includes('freeze') || key.includes('lightning')) return 'blue';
  if (key.includes('manifest') || key.includes('theory')) return 'purple';
  return 'white';
}

function visualWithEventOwner(
  current: PixiPlaybackStoneVisual | null,
  event: PresentationPlaybackEvent
): PixiPlaybackStoneVisual | null {
  const owner = Number(event?.newColor) === 1
    ? 'black'
    : Number(event?.newColor) === -1
      ? 'white'
      : event?.owner;
  if (!current) return createPlaybackStoneVisual({ color: event?.newColor }, owner);
  if (owner !== 'black' && owner !== 'white') return current;
  const value = owner === 'black' ? 1 : -1;
  return Object.freeze({
    stone: Object.freeze({ ...current.stone, owner, value }),
    markers: current.markers
  });
}

async function playPulse(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection,
  options: {
    readonly family: string;
    readonly durationMs: number;
    readonly tone: PixiPlaybackEffectTone;
    readonly scaleFrom?: number;
    readonly scaleTo?: number;
  }
): Promise<void> {
  const coordinate = eventCoordinate(event);
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
      durationMs: options.durationMs,
      effectFamily: options.family,
      event,
      onStart: () => {
        effect = projection.acquireEffect({
          ...coordinate,
          family: options.family,
          kind: 'pulse',
          tone: options.tone
        });
      },
      onUpdate: (progress) => {
        if (effect) projection.updateEffect(effect, {
          alpha: 1 - progress,
          scale: interpolate(options.scaleFrom ?? 0.72, options.scaleTo ?? 1.4, progress)
        });
        if (progress >= 1) release();
      }
    });
  } finally {
    release();
  }
}

export async function playPixiCrossfadeStoneEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = eventCoordinate(event);
  if (!coordinate) return;
  const current = projection.getProjectedStone(coordinate.row, coordinate.col);
  const finalVisual = visualWithEventOwner(current, event);
  const durationMs = eventDuration(event, projection.timings.overlayCrossfadeMs);
  let outgoing: PixiPlaybackGhostHandle | null = null;
  let incoming: PixiPlaybackGhostHandle | null = null;
  let aura: PixiPlaybackEffectHandle | null = null;
  const releaseOutgoing = () => {
    if (!outgoing) return;
    const owned = outgoing;
    outgoing = null;
    projection.releaseGhost(owned);
  };
  const releaseIncoming = () => {
    if (!incoming) return;
    const owned = incoming;
    incoming = null;
    projection.releaseGhost(owned);
  };
  const releaseAura = () => {
    if (!aura) return;
    const owned = aura;
    aura = null;
    projection.releaseEffect(owned);
  };
  try {
    await projection.timeline.run({
      durationMs,
      effectFamily: 'crossfade-stone',
      event,
      onStart: () => {
        projection.setProjectedStone(coordinate.row, coordinate.col, null);
        if (current) outgoing = projection.acquireTransientGhost(coordinate.row, coordinate.col, current);
        if (finalVisual) {
          incoming = projection.acquireTransientGhost(coordinate.row, coordinate.col, finalVisual);
          projection.updateGhost(incoming, { alpha: projection.noAnimation ? 1 : 0 });
        }
        aura = projection.acquireEffect({
          ...coordinate,
          family: 'crossfade_stone',
          kind: 'aura',
          tone: toneForEffectKey(event.effectKey)
        });
      },
      onUpdate: (progress) => {
        if (outgoing) projection.updateGhost(outgoing, { alpha: 1 - progress });
        if (incoming) projection.updateGhost(incoming, { alpha: progress });
        if (aura) projection.updateEffect(aura, {
          alpha: Math.sin(Math.PI * progress),
          scale: interpolate(0.82, 1.12, progress)
        });
        if (progress >= 1) {
          releaseOutgoing();
          releaseIncoming();
          releaseAura();
          projection.setProjectedStone(coordinate.row, coordinate.col, finalVisual);
        }
      }
    });
  } finally {
    releaseOutgoing();
    releaseIncoming();
    releaseAura();
  }
}

export function playPixiProtectionExpireEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  return playPulse(event, projection, {
    family: 'protection-expire',
    durationMs: eventDuration(event, projection.timings.overlayCrossfadeMs),
    tone: 'gold',
    scaleFrom: 0.9,
    scaleTo: 1.45
  });
}

export async function playPixiLegacyFadeOutEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = eventCoordinate(event);
  if (!coordinate) return;
  const options = event?.options && typeof event.options === 'object' ? event.options as any : {};
  const current = projection.getProjectedStone(coordinate.row, coordinate.col);
  const ghostVisual = current || (options.createGhost
    ? createPlaybackStoneVisual({ color: options.color, special: options.special }, options.color)
    : null);
  if (!ghostVisual) return;
  let ghost: PixiPlaybackGhostHandle | null = null;
  const release = () => {
    if (!ghost) return;
    const owned = ghost;
    ghost = null;
    projection.releaseGhost(owned);
  };
  try {
    await projection.timeline.run({
      durationMs: projection.timings.destroySettlementMs,
      effectFamily: 'legacy-fade-out',
      event,
      onStart: () => {
        if (current) projection.setProjectedStone(coordinate.row, coordinate.col, null);
        ghost = projection.acquireTransientGhost(coordinate.row, coordinate.col, ghostVisual);
      },
      onUpdate: (_progress, frame) => {
        const visualProgress = frame.noAnimation
          ? 1
          : Math.min(1, frame.elapsedMs / Math.max(1, projection.timings.fadeOutMs));
        if (ghost) projection.updateGhost(ghost, { alpha: 1 - visualProgress });
        if (visualProgress >= 1) release();
      }
    });
  } finally {
    release();
  }
}

export function playPixiLegacyStrongWillApplyEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  return playPulse(event, projection, {
    family: 'legacy-strong-will-apply',
    durationMs: projection.timings.strongWillApplyMs,
    tone: 'gold',
    scaleFrom: 0.55,
    scaleTo: 1.25
  });
}

export async function playPixiLegacyHyperactiveMoveEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const from = normalizePlaybackCoordinate(event?.from);
  const to = normalizePlaybackCoordinate(event?.to);
  if (!from || !to) return;
  const source = projection.getProjectedStone(to.row, to.col)
    || projection.getProjectedStone(from.row, from.col);
  const after = source
    ? { ...source.stone.status, color: source.stone.value, special: source.stone.specialType }
    : null;
  await playPixiMoveEffect({
    ...event,
    type: 'move',
    targets: [{ from, to, after }]
  }, projection);
}

export function playPixiLegacySacrificeAbsorbPulseEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  return playPulse(event, projection, {
    family: 'legacy-sacrifice-absorb-pulse',
    durationMs: eventDuration(event, projection.timings.sacrificeAbsorbMs),
    tone: 'red',
    scaleFrom: 0.76,
    scaleTo: 1.8
  });
}
