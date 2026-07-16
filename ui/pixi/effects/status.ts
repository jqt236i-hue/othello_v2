import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  normalizePlaybackCoordinate,
  type PixiPlaybackStoneVisual
} from './common';
import { resolveStatusHighlightTone } from './highlight';
import type { PixiBoardEffectProjection } from './types';

type StatusVisualMode =
  | 'tick'
  | 'freeze-fade'
  | 'crossfade'
  | 'hole-push'
  | 'immediate';

function eventMeta(event: PresentationPlaybackEvent): Readonly<Record<string, any>> {
  return event?.meta && typeof event.meta === 'object'
    ? event.meta as Readonly<Record<string, any>>
    : Object.freeze({});
}

function upper(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function lower(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isPlayableCoordinate(
  projection: PixiBoardEffectProjection,
  row: number,
  col: number
): boolean {
  return projection.frame.model.topology.playableKeys.includes(`${row},${col}`);
}

function isCausalReplayCellRestoration(event: PresentationPlaybackEvent): boolean {
  const meta = eventMeta(event);
  return upper(meta.cellRestorationCause) === 'CAUSAL_REPLAY_WILL'
    || (lower(meta.reason || event?.reason) === 'causal_replay_selected'
      && lower(meta.restoredAs) === 'normal_empty_cell');
}

function isBoardShrinkHole(event: PresentationPlaybackEvent, target: any): boolean {
  const meta = eventMeta(event);
  const targetMeta = target?.meta && typeof target.meta === 'object' ? target.meta : {};
  return upper(
    targetMeta.visualVariant
      || meta.visualVariant
      || target?.after?.visualVariant
  ) === 'BOARD_FRAME';
}

function resolveStatusSpecial(event: PresentationPlaybackEvent, target: any): string {
  const meta = eventMeta(event);
  return upper(meta.special || target?.after?.special);
}

function isPoisonStatus(special: string): boolean {
  return special === 'POISONED' || special === 'POISON_CELL';
}

function resolveStatusAfterVisual(
  event: PresentationPlaybackEvent,
  target: any,
  current: PixiPlaybackStoneVisual | null,
  special: string
): PixiPlaybackStoneVisual | null {
  if (special === 'METEOR_HOLE') return null;
  // The DOM executor updates poison timers only on STATUS_TICK. Apply/remove
  // events leave the live disc alone; DESTROY/final frame owns any removal.
  if (isPoisonStatus(special) && upper(event?.rawType) !== 'STATUS_TICK') {
    return current;
  }
  if (special === 'BLOCKADE' || special === 'POISON_CELL') {
    return current;
  }
  if (special === 'FREEZE') {
    const color = Number(target?.after?.color);
    return (color === 1 || color === -1)
      ? (createPlaybackStoneVisual(target?.after) || current)
      : current;
  }
  const meta = eventMeta(event);
  const resolved = createPlaybackStoneVisual(
    target?.after,
    target?.owner,
    meta.owner,
    event?.owner
  );
  return resolved;
}

function resolveStatusMode(
  event: PresentationPlaybackEvent,
  target: any,
  special: string
): StatusVisualMode {
  const meta = eventMeta(event);
  const rawType = upper(event?.rawType);
  if (rawType === 'STATUS_TICK') return 'tick';
  const reason = lower(meta.reason || event?.reason);
  const isRemoved = lower(event?.type) === 'status_removed';
  if (isRemoved && special === 'FREEZE' && reason === 'duration_end' && !target?.after?.special) {
    return 'freeze-fade';
  }
  if (isPoisonStatus(special) || isCausalReplayCellRestoration(event)) return 'immediate';
  if (upper(target?.after?.special) === 'METEOR_HOLE') {
    return isBoardShrinkHole(event, target) ? 'hole-push' : 'immediate';
  }
  if (special === 'BLOCKADE') return 'immediate';
  return 'crossfade';
}

function resolveVisualDurationMs(
  event: PresentationPlaybackEvent,
  target: any,
  mode: StatusVisualMode,
  projection: PixiBoardEffectProjection
): number {
  if (mode === 'tick' || mode === 'immediate') return 0;
  if (mode === 'hole-push') {
    return Math.max(180, Math.min(360, Math.round(projection.timings.fadeOutMs * 0.55)));
  }
  const meta = eventMeta(event);
  const reason = lower(meta.reason || event?.reason);
  if (lower(event?.type) === 'status_removed'
    && meta.special === 'REGEN'
    && reason === 'regen_consumed') {
    return target?.after?.special
      ? projection.timings.overlayCrossfadeMs
      : projection.timings.regenConsumeFadeMs;
  }
  return projection.timings.overlayCrossfadeMs;
}

async function playStatusTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const coordinate = normalizePlaybackCoordinate(target);
  if (!coordinate || !isPlayableCoordinate(projection, coordinate.row, coordinate.col)) return;
  const special = resolveStatusSpecial(event, target);
  const mode = resolveStatusMode(event, target, special);
  const beforeColor = Number(target?.before?.color);
  const eventBefore = (beforeColor === 1 || beforeColor === -1)
    ? createPlaybackStoneVisual(target.before)
    : null;
  const current = eventBefore
    || projection.getProjectedStone(coordinate.row, coordinate.col);
  const after = resolveStatusAfterVisual(event, target, current, special);
  const tone = resolveStatusHighlightTone(event, target, projection.noAnimation);
  const visualDurationMs = resolveVisualDurationMs(event, target, mode, projection);
  const durationMs = Math.max(
    visualDurationMs,
    tone ? projection.timings.positiveHighlightMinimumMs : 0
  );
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  let outgoingGhost: PixiPlaybackGhostHandle | null = null;
  let incomingGhost: PixiPlaybackGhostHandle | null = null;
  let finalApplied = false;
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  const releaseOutgoingGhost = () => {
    if (!outgoingGhost) return;
    const owned = outgoingGhost;
    outgoingGhost = null;
    projection.releaseGhost(owned);
  };
  const releaseIncomingGhost = () => {
    if (!incomingGhost) return;
    const owned = incomingGhost;
    incomingGhost = null;
    projection.releaseGhost(owned);
  };
  const releaseGhosts = () => {
    releaseOutgoingGhost();
    releaseIncomingGhost();
  };
  const applyFinal = () => {
    if (finalApplied) return;
    releaseGhosts();
    projection.setProjectedStone(coordinate.row, coordinate.col, after);
    finalApplied = true;
  };

  try {
    await projection.timeline.run({
      durationMs,
      effectFamily: `status-${mode}`,
      event,
      onStart: () => {
        if (tone) highlight = projection.acquireHighlight(coordinate.row, coordinate.col, tone);

        if (mode === 'tick' || mode === 'immediate') {
          applyFinal();
          return;
        }

        if (mode === 'freeze-fade') {
          // The DOM path removes the live freeze overlay first and fades only
          // its clone. Retain the settled state underneath the outgoing ghost.
          projection.setProjectedStone(coordinate.row, coordinate.col, after);
          finalApplied = true;
          if (current) outgoingGhost = projection.acquireTransientGhost(
            coordinate.row,
            coordinate.col,
            current
          );
          return;
        }

        projection.setProjectedStone(coordinate.row, coordinate.col, null);
        if (current) outgoingGhost = projection.acquireTransientGhost(
          coordinate.row,
          coordinate.col,
          current
        );
        if (mode === 'crossfade' && after) {
          incomingGhost = projection.acquireTransientGhost(coordinate.row, coordinate.col, after);
          projection.updateGhost(incomingGhost, { alpha: 0 });
        }
      },
      onUpdate: (progress, frame) => {
        const visualProgress = frame.noAnimation || visualDurationMs <= 0
          ? 1
          : Math.min(1, frame.elapsedMs / visualDurationMs);
        if (mode === 'freeze-fade') {
          if (outgoingGhost) projection.updateGhost(outgoingGhost, { alpha: 1 - visualProgress });
        } else if (mode === 'hole-push') {
          if (outgoingGhost) projection.updateGhost(outgoingGhost, {
            alpha: 1 - visualProgress,
            scaleX: 1 - visualProgress * 0.18,
            scaleY: 1 - visualProgress * 0.18
          });
        } else if (mode === 'crossfade') {
          if (outgoingGhost) projection.updateGhost(outgoingGhost, { alpha: 1 - visualProgress });
          if (incomingGhost) projection.updateGhost(incomingGhost, { alpha: visualProgress });
        }
        if (visualProgress >= 1) applyFinal();
        if (progress >= 1) releaseHighlight();
      }
    });
  } finally {
    releaseGhosts();
    releaseHighlight();
  }
}

export async function playPixiStatusEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const targets: readonly unknown[] = Array.isArray(event?.targets) ? event.targets : [];
  await Promise.all(targets.map((target) => playStatusTarget(event, target, projection)));
}
