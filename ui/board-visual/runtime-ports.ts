import type {
  BoardClientRect,
  BoardPlaybackPhaseScope,
  BoardVisualFrame,
  BoardWriterToken
} from './types';

export interface PreparedBoardVisualUpdate {
  readonly controller: BoardVisualControllerPort;
  readonly playbackDeferred: boolean;
  readonly deferredUntilAutoWriter?: true;
  readonly invalidated?: true;
  readonly frame?: BoardVisualFrame;
}

export interface BoardVisualControllerPort {
  readonly ready?: Promise<void>;
  waitUntilReady?(): Promise<void>;
  waitForIdle?(): Promise<void>;
  isReady?(): boolean;
  isIdleSettlementPending?(): boolean;
  getMode?(): string;
  getActiveFrameToken?(): string | null;
  getActiveWriterToken?(): BoardWriterToken | null;
  getBackendKind?(): 'dom' | 'pixi';
  getCellClientRect?(row: number, col: number): BoardClientRect | null;
  submitFrame(frame: BoardVisualFrame): boolean;
  claimWriter(frameToken: string, mode: 'local' | 'network'): BoardWriterToken;
  reclaimWriter?(token: BoardWriterToken, frameToken: string, mode: 'local' | 'network'): BoardWriterToken;
  validatePhase?(
    events: readonly unknown[],
    strictNetworkPlayback: boolean,
    phaseScope?: BoardPlaybackPhaseScope
  ): Promise<void>;
  playPhase?(
    token: BoardWriterToken,
    events: readonly unknown[],
    phaseScope?: BoardPlaybackPhaseScope
  ): Promise<void>;
  abortWriterBeforeHandoff?(token: BoardWriterToken, checkpoint?: BoardVisualFrame): Promise<boolean>;
  cancelWriterAfterHandoff?(token: BoardWriterToken, checkpoint?: BoardVisualFrame): Promise<boolean>;
  settleLocalWriter?(token: BoardWriterToken, finalFrame?: BoardVisualFrame): Promise<boolean>;
  releaseWriter(token: BoardWriterToken, finalFrame?: BoardVisualFrame): boolean;
  beginAwaitingFrameCommit(token: BoardWriterToken): unknown;
  applyCommittedFrame(token: BoardWriterToken, frame: BoardVisualFrame): Promise<boolean>;
  restoreCommittedFrame?(token: BoardWriterToken, frame: BoardVisualFrame): Promise<boolean>;
  enterRecovery(token: BoardWriterToken, error?: unknown): unknown;
  restore?(frame?: BoardVisualFrame): Promise<boolean>;
  invalidate?(): void;
  destroy?(): void;
  subscribeSettledFrame?(listener: (frame: BoardVisualFrame) => void, emitCurrent?: boolean): () => void;
}

export interface BoardVisualRenderPort {
  prepareBoardVisualUpdate(): PreparedBoardVisualUpdate | null;
  renderBoard(preparedVisualUpdate?: PreparedBoardVisualUpdate): void;
  renderBoardFull(): void;
  buildBoardVisualFrame(controller: BoardVisualControllerPort, baseVisualStateOverride?: unknown): BoardVisualFrame;
}

export interface BoardVisualControllerPortApi {
  getBoardVisualController(): BoardVisualControllerPort | null;
  getBoardVisualControllerReady(): Promise<void>;
  getBoardVisualControllerReadyForPresentationDrain(): Promise<void>;
  configureBoardVisualController(
    controller: BoardVisualControllerPort,
    options?: Readonly<{ host?: HTMLElement | null; diagnostics?: unknown }>
  ): BoardVisualControllerPort;
  configureBoardVisualBackendForTest(options?: Readonly<{
    selection?: 'dom' | 'pixi' | null;
    noAnimation?: boolean;
    createDomBackend?: (options: unknown) => unknown;
    createPixiBackend?: (options: unknown) => unknown;
  }> | null): void;
}

export interface BoardVisualInputPort {
  getBoardInputController(): unknown;
  activateBoardInputController(options?: Readonly<{ isInputLocked?: () => boolean }>): unknown;
  deactivateBoardInputController(): void;
  setBoardPresentationPreviewHints(previewHints: unknown, options?: unknown): boolean;
}

export interface BoardVisualWriterPort {
  claimBoardVisualWriter(frameToken: string, mode?: 'local' | 'network'): BoardWriterToken;
  validateBoardVisualPhase(
    events: readonly unknown[],
    phaseScope?: BoardPlaybackPhaseScope,
    strictNetworkPlayback?: boolean
  ): Promise<void>;
  playBoardVisualPhase(
    token: BoardWriterToken,
    events: readonly unknown[],
    phaseScope?: BoardPlaybackPhaseScope
  ): Promise<void>;
  releaseBoardVisualWriter(token: BoardWriterToken, finalFrame?: BoardVisualFrame): boolean;
  abortBoardVisualWriterBeforeHandoff(token: BoardWriterToken, checkpoint?: BoardVisualFrame): Promise<boolean>;
  cancelBoardVisualWriterAfterHandoff(token: BoardWriterToken, checkpoint?: BoardVisualFrame): Promise<boolean>;
  settleBoardVisualWriter(token: BoardWriterToken): Promise<boolean>;
  beginBoardVisualFrameCommit(token: BoardWriterToken): unknown;
  applyCommittedBoardVisualFrame(token: BoardWriterToken, receipt?: unknown): Promise<boolean>;
  enterBoardVisualRecovery(token: BoardWriterToken, error?: unknown): unknown;
  settleAutoBoardVisualWriter(): Promise<boolean>;
}

export interface BoardVisualGeometryPort {
  getBoardCellClientRect(row: number, col: number): BoardClientRect | null;
  syncBoardPixelSizing(boardElement: HTMLElement, shapeInput?: unknown): unknown;
  syncBoardExpansionLayerGeometry(boardElement: HTMLElement, shapeInput?: unknown): unknown;
  resolveBoardExpansionLayerElement(boardElement: HTMLElement, createIfMissing?: boolean): HTMLElement | null;
}

export interface BoardVisualDiagnosticsPort {
  resetBoardVisualRenderSession(): string;
  getBoardVisualInvalidationDiagnostics(): unknown;
  updateOccupancyUI(): void;
}

export interface BoardVisualDomCompatibilityPort {
  applyTimeStopLegalEmphasis(cell: HTMLElement, active: unknown): void;
  collectPendingSelectedTargetHighlightKeys(pending: unknown): Set<string>;
  collectRandomSpawnPreviewHighlightKeys(
    cardState: unknown,
    gameState: unknown,
    playerKey: unknown,
    options?: unknown
  ): Set<string>;
  ensureDiscSkeleton(disc: HTMLElement): Readonly<{
    face: HTMLElement | null;
    base: HTMLElement | null;
    overlay: HTMLElement | null;
    hud: HTMLElement | null;
  }>;
  getDiscHudRoot(disc: HTMLElement): HTMLElement | null;
  applyDiscRenderState(disc: HTMLElement, renderState?: unknown): void;
  setDiscStoneImage(disc: HTMLElement, value: unknown): void;
}

export type BoardRendererFacade = BoardVisualRenderPort
  & BoardVisualControllerPortApi
  & BoardVisualInputPort
  & BoardVisualWriterPort
  & BoardVisualGeometryPort
  & BoardVisualDiagnosticsPort
  & BoardVisualDomCompatibilityPort;
