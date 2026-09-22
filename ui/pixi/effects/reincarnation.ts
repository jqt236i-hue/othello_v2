import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type { PixiBoardEffectProjection } from './types';
import { createPlaybackStoneVisual, normalizePlaybackCoordinate } from './common';
import { REINCARNATION_CONFIRM_MS, REINCARNATION_SETTLE_MS, reincarnationStepAt } from '../../../constants/reincarnation-animation';

export async function playPixiReincarnation(event: PresentationPlaybackEvent, target: any, projection: PixiBoardEffectProjection): Promise<void> {
    const coordinate = normalizePlaybackCoordinate(target);
    if (!coordinate) return;
    const { row, col } = coordinate;
    const previews = Array.isArray(target.previewStates) ? target.previewStates : [];
    const finalVisual = createPlaybackStoneVisual(target.after, target.ownerAfter, target.owner);
    const highlight = projection.acquireEffect({ row, col, family: 'theory_incarnation_spawn_roulette', kind: 'roulette', tone: 'purple' });
    let previousStep = -1;
    try {
        await projection.timeline.run({
            durationMs: REINCARNATION_CONFIRM_MS,
            effectFamily: 'reincarnation-roulette', event,
            onStart: () => projection.setProjectedStone(row, col, createPlaybackStoneVisual(target.before, target.owner)),
            onUpdate: (progress, frame) => {
                if (progress >= 1 || frame.noAnimation) {
                    projection.setProjectedStone(row, col, finalVisual);
                    return;
                }
                const step = reincarnationStepAt(frame.elapsedMs);
                if (step === previousStep || !previews.length) return;
                previousStep = step;
                projection.setProjectedStone(row, col, createPlaybackStoneVisual(previews[step % previews.length], target.owner));
                projection.updateEffect(highlight, { alpha: 0.8, scale: 1.04 });
            }
        });
        await projection.timeline.run({
            durationMs: REINCARNATION_SETTLE_MS,
            effectFamily: 'reincarnation-confirm', event,
            onStart: () => projection.setProjectedStone(row, col, finalVisual),
            onUpdate: (progress) => projection.updateEffect(highlight, {
                alpha: (1 - progress) * 0.9, scale: 1.12 - 0.12 * progress
            })
        });
    } finally {
        projection.releaseEffect(highlight);
    }
}
