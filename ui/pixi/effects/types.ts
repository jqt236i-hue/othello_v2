import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type { BoardVisualFrame } from '../../board-visual/types';
import type {
  PixiBoardScene,
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackCellHighlightTone,
  PixiPlaybackGhostHandle,
  PixiPlaybackGhostUpdate,
  PixiPlaybackProjectionScope
} from '../board-scene';
import type { PixiTimeline } from '../timeline';
import type { PixiPlaybackStoneVisual } from './common';

export interface PixiBoardEffectTimings {
  readonly flipMs: number;
  readonly fadeOutMs: number;
  readonly destroySettlementMs: number;
  readonly breedingSpawnFadeMs: number;
  readonly moveMs: number;
  readonly overlayCrossfadeMs: number;
  readonly regenConsumeFadeMs: number;
  readonly positiveHighlightMinimumMs: number;
  readonly zombieBiteMs: number;
  readonly teleportPulseMs: number;
}

export interface PixiBoardEffectProjection {
  readonly frame: BoardVisualFrame;
  readonly scene: PixiBoardScene;
  readonly scope: PixiPlaybackProjectionScope;
  readonly timeline: PixiTimeline;
  readonly timings: PixiBoardEffectTimings;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
  /** Stone visible at the planner phase-scope boundary, before parallel writes. */
  getPhaseSourceStone(row: number, col: number): PixiPlaybackStoneVisual | null;
  getProjectedStone(row: number, col: number): PixiPlaybackStoneVisual | null;
  setProjectedStone(row: number, col: number, visual: PixiPlaybackStoneVisual | null): void;
  acquireTransientGhost(
    row: number,
    col: number,
    visual: PixiPlaybackStoneVisual
  ): PixiPlaybackGhostHandle;
  updateGhost(handle: PixiPlaybackGhostHandle, update: PixiPlaybackGhostUpdate): void;
  releaseGhost(handle: PixiPlaybackGhostHandle): void;
  acquireHighlight(
    row: number,
    col: number,
    tone: PixiPlaybackCellHighlightTone
  ): PixiPlaybackCellHighlightHandle;
  releaseHighlight(handle: PixiPlaybackCellHighlightHandle): void;
}

export type PixiBoardEffectPlayer = (
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
) => Promise<void>;
