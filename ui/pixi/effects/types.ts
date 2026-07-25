import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  BoardSourceTrajectoryPrimitive,
  BoardSourceTrajectoryProfileKey,
  BoardSourceTrajectoryRequest
} from '../../board-visual/source-trajectory';
import type { BoardVisualFrame } from '../../board-visual/types';
import type {
  PixiBoardScene,
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackCellHighlightTone,
  PixiPlaybackEffectHandle,
  PixiPlaybackEffectOptions,
  PixiPlaybackEffectUpdate,
  PixiPlaybackGhostHandle,
  PixiPlaybackGhostUpdate,
  PixiPlaybackProjectionScope,
  PixiSourceTrajectoryTextureLease
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
  readonly strongWillApplyMs: number;
  readonly sacrificeAbsorbMs: number;
  readonly theoryRouletteMs: number;
  readonly theoryMaterializeMs: number;
  readonly manifestEndingMs: number;
}

export interface PixiBoardEffectProjection {
  readonly frame: BoardVisualFrame;
  /** Complete immutable planner scope used only to derive presentation geometry. */
  readonly phaseEvents: readonly PresentationPlaybackEvent[];
  readonly scene: PixiBoardScene;
  readonly scope: PixiPlaybackProjectionScope;
  readonly timeline: PixiTimeline;
  readonly timings: PixiBoardEffectTimings;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
  /** Debug diagnostics only; must not drive presentation or canonical state. */
  record?(event: string, detail?: unknown): void;
  /** Backend-local gate over raw source trajectories for this visual target. */
  waitForSourceTrajectories(event: PresentationPlaybackEvent, target: unknown): Promise<void>;
  /** Render a post-timeline terminal write without creating another clock run. */
  render(): void;
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
  acquireEffect(options: PixiPlaybackEffectOptions): PixiPlaybackEffectHandle;
  updateEffect(handle: PixiPlaybackEffectHandle, update: PixiPlaybackEffectUpdate): void;
  retainEffect(row: number, col: number, handle: PixiPlaybackEffectHandle): void;
  releaseEffect(handle: PixiPlaybackEffectHandle): void;
}

export type PixiBoardEffectPlayer = (
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
) => Promise<void>;

export interface PixiSourceTrajectoryProjection {
  readonly scene: PixiBoardScene;
  readonly scope: PixiPlaybackProjectionScope;
  readonly timeline: PixiTimeline;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
  acquireStoneTextureLease(owner: 'black' | 'white'): PixiSourceTrajectoryTextureLease;
}

export interface PixiSourceTrajectoryRuntimeCounter {
  readonly started: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly aborted: number;
  readonly noObject: number;
  readonly offscreenNoObject: number;
}

export interface PixiSourceTrajectoryRendererDiagnostics {
  readonly activeRunCount: number;
  readonly activeTextureLeaseCount: number;
  readonly startedRunCount: number;
  readonly completedRunCount: number;
  readonly failedRunCount: number;
  readonly abortedRunCount: number;
  readonly noObjectRunCount: number;
  readonly offscreenNoObjectRunCount: number;
  readonly byProfile: Readonly<Record<BoardSourceTrajectoryProfileKey, PixiSourceTrajectoryRuntimeCounter>>;
  readonly byPrimitive: Readonly<Record<BoardSourceTrajectoryPrimitive, PixiSourceTrajectoryRuntimeCounter>>;
}

export interface PixiSourceTrajectoryBatchRun<T = void> {
  readonly requests: readonly BoardSourceTrajectoryRequest[];
  readonly trajectoryById: ReadonlyMap<string, Promise<void>>;
  readonly boardResult: Promise<T>;
  readonly settlement: Promise<void>;
}
