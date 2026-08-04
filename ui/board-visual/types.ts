export type BoardViewerContext = 'black' | 'white' | 'spectator';
export type BoardExpansionSide = 'top' | 'right' | 'bottom' | 'left';
export type BoardBoundaryEdgeKind = 'none' | 'outer' | 'hole';
export type BoardWriterMode = 'idle' | 'playback' | 'awaiting-frame-commit' | 'recovering' | 'destroyed';

export interface BoardWorldCoordinate {
  row: number;
  col: number;
}

export interface BoardWorldWindow {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface BoardCellBoundaryEdges {
  top: BoardBoundaryEdgeKind;
  right: BoardBoundaryEdgeKind;
  bottom: BoardBoundaryEdgeKind;
  left: BoardBoundaryEdgeKind;
}

export interface BoardStoneVisualState {
  owner: 'black' | 'white';
  value: number;
  specialType: string | null;
  status: Readonly<Record<string, unknown>>;
}

export interface BoardMarkerVisualState {
  kind: string;
  owner: 'black' | 'white' | null;
  value: string | number | boolean | null;
  data: Readonly<Record<string, unknown>>;
}

export interface BoardCellInteractionState {
  legal: boolean;
  legalFree: boolean;
  tabooLegal: boolean;
  selectable: boolean;
  interactionLocked: boolean;
  hovered: boolean;
  keyboardCursor: boolean;
  previewKinds: readonly string[];
  selected: boolean;
  selectionKinds: readonly string[];
  directionHints: readonly BoardCellDirectionHint[];
  directionHintIds: readonly string[];
  localPendingHintIds: readonly string[];
}

export type BoardDirectionHintKind =
  | 'board-shrink-god'
  | 'board-shrink-will'
  | 'board-expansion-god'
  | 'board-expansion-will'
  | 'generic';

export interface BoardCellDirectionHint {
  id: string;
  kind: BoardDirectionHintKind;
  directionKey: string;
}

export interface BoardCellVisualState {
  key: string;
  row: number;
  col: number;
  renderRow: number;
  renderCol: number;
  kind: 'playable' | 'hole';
  expansionSide: BoardExpansionSide | null;
  boundaryEdges: BoardCellBoundaryEdges;
  stone: BoardStoneVisualState | null;
  markers: readonly BoardMarkerVisualState[];
  interaction: BoardCellInteractionState;
  /** Aggregate compatibility signature used by frame hashing and diagnostics. */
  visualSignature: string;
  /** Pixi cell-surface semantic dependencies only. */
  surfaceSignature: string;
  /** Static Pixi surface/grid dependencies; excludes retained labels and badges. */
  baseSurfaceSignature: string;
  /** Sparse retained cell marker dependencies only. */
  markerSignature: string;
  /** Pixi stone/status semantic dependencies only. */
  stoneSignature: string;
  /** Pixi hint Graphics semantic dependencies; excludes lock-only input state. */
  hintPaintSignature: string;
  /** Pixi hit-area/cursor/event-mode semantic dependencies only. */
  hintInputSignature: string;
  /** Aggregate Pixi hint/input compatibility signature. */
  interactionSignature: string;
}

export interface MaterializedBoardCellVisualState extends Omit<BoardCellVisualState, 'kind'> {
  kind: 'playable' | 'hole' | 'void';
  ephemeral: boolean;
}

export interface BoardRenderTopologyModel {
  baseShape: 'rectangle' | 'circle';
  baseRows: number;
  baseCols: number;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  renderRowOffset: number;
  renderColOffset: number;
  renderRows: number;
  renderCols: number;
  /** Stable initial-board mask. Expansion cells never become base cells. */
  baseKeys: readonly string[];
  existingKeys: readonly string[];
  playableKeys: readonly string[];
  holeKeys: readonly string[];
}

export interface BoardRenderModel {
  /** Canonical board-content identity produced by SharedBoardUtils.createBoardView. */
  boardDigest: string;
  /** Opaque canonical input identity (pending effect and network visual epoch). */
  inputEpoch: string;
  /** Monotonic identity of the current canonical board-input contract. */
  modelCommitId: number;
  visualRevision: number;
  topology: BoardRenderTopologyModel;
  cells: readonly BoardCellVisualState[];
  keyboardCursorKey: string | null;
  viewerContext: BoardViewerContext;
  currentPlayer: 'black' | 'white';
  canControlCurrentTurn: boolean;
  isHumanTurn: boolean;
}

export interface BoardDirectionHint {
  id: string;
  cellKey: string;
  directionKey: string;
  kind?: BoardDirectionHintKind;
}

export interface BoardPendingHint {
  id: string;
  cellKey: string;
  kind: string;
}

export interface BoardPreviewHint {
  cellKey: string;
  kind: string;
}

export interface BoardPresentationOverlayState {
  hoveredCellKey: string | null;
  keyboardCursorKey: string | null;
  previewCellKeys: readonly string[];
  previewHints: readonly BoardPreviewHint[];
  selectedCellKeys: readonly string[];
  directionHints: readonly BoardDirectionHint[];
  localPendingHints: readonly BoardPendingHint[];
  interactionLocked: boolean;
}

export interface BoardRenderInputs<TBaseVisualState = unknown> {
  baseVisualState: TBaseVisualState;
  presentationOverlayState: BoardPresentationOverlayState;
}

export interface BoardCameraState {
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface BoardViewportLayout {
  revision: number;
  cellSize: number;
  dpr: number;
  stageScale: number;
  cellScale: number;
  orientation: 'normal' | 'rotated-180';
  frameInset: { top: number; right: number; bottom: number; left: number };
  clientOrigin: { x: number; y: number };
  visualViewport: { scale: number; offsetLeft: number; offsetTop: number };
  camera: BoardCameraState;
  logicalWidth: number;
  logicalHeight: number;
  visibleWorldWindow: BoardWorldWindow;
}

export interface BoardClientRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  layoutRevision: number;
}

export interface BoardAppearanceDescriptor {
  boardSkinId: string;
  boardImageUrl: string;
  boardFrameSkinId: string;
  boardFrameLayout: Readonly<Record<string, string | number>>;
  stoneSkinId: string;
  blackStoneImageUrl: string;
  whiteStoneImageUrl: string;
  revision: number;
}

export interface BoardVisualShadowDescriptor {
  offsetXRatio: number;
  offsetYRatio: number;
  blurRatio: number;
  color: string;
}

export interface BoardVisualGlowDescriptor {
  blurRatio: number;
  color: string;
}

export interface BoardVisualTextStyleDescriptor {
  fontFamily: string;
  fontWeight: number;
  fontSizeRatio: number;
  doubleDigitScale: number;
  lineHeight: number;
  color: string;
  shadows: readonly BoardVisualShadowDescriptor[];
  glow: BoardVisualGlowDescriptor | null;
}

export interface BoardVisualHintStyleDescriptor {
  ringColor: string;
  highlightColor: string;
  glowColor: string;
  lineWidthRatio: number;
  glowBlurRatio: number;
}

export interface BoardVisualThemeDescriptor {
  revision: number;
  /** Increments when the selected document font set finishes a loading cycle. */
  fontReadyEpoch: number;
  surfaceColor: string;
  gridColor: string;
  outerBoundaryColor: string;
  contourMetalColor: string;
  contourShadowColor: string;
  holeBoundaryColor: string;
  markerColor: string;
  hintColor: string;
  timerColor: string;
  fontFamily: string;
  gridLineWidth: number;
  boardBonus: BoardVisualTextStyleDescriptor;
  timer: BoardVisualTextStyleDescriptor;
  directionHint: BoardVisualTextStyleDescriptor;
  legalHint: BoardVisualHintStyleDescriptor;
}

export interface BoardVisualFrame {
  model: BoardRenderModel;
  layout: BoardViewportLayout;
  appearance: BoardAppearanceDescriptor;
  theme: BoardVisualThemeDescriptor;
  frameToken: string;
  /**
   * UI-only identity for one rendered match. This is presentation lifecycle
   * state, not canonical game or network authority.
   */
  readonly renderSessionId?: string;
}

/**
 * One planner-owned serial/parallel execution scope. Concurrent board launches
 * share this object so a backend can retain one geometry/overlay context until
 * every launch in the scope has settled.
 */
export interface BoardPlaybackPhaseScope {
  readonly events: readonly unknown[];
  readonly phaseKey?: string;
  readonly stepIndex?: number;
}

export interface BoardPlaybackContext {
  token: BoardWriterToken;
  strictNetworkPlayback: boolean;
  phaseScope?: BoardPlaybackPhaseScope;
  /** Board-only context-loss replay. Global sound/log/DOM effects must not run. */
  recoveryReplay?: boolean;
}

/** Capability-only validation before a board writer is claimed or launched. */
export interface BoardPlaybackValidationContext {
  strictNetworkPlayback: boolean;
  phaseScope?: BoardPlaybackPhaseScope;
}

export interface BoardWriterToken {
  id: number;
  frameToken: string;
  mode: 'local' | 'network';
}

export interface BoardVisualBackendDeps {
  diagnostics?: { record: (event: string, detail?: unknown) => void };
}

export interface BoardVisualBackend {
  readonly kind: 'dom' | 'pixi';
  mount(host: HTMLElement, deps: BoardVisualBackendDeps): void | Promise<void>;
  /** Prepare async resources without making them the visible writer yet. */
  prepareFrame?(frame: BoardVisualFrame): void | Promise<void>;
  applyFrame(frame: BoardVisualFrame): void;
  /** Must not claim a writer, start a ticker, or mutate the rendered scene. */
  validatePhase?(events: readonly unknown[], context: BoardPlaybackValidationContext): void | Promise<void>;
  playPhase(events: readonly unknown[], context: BoardPlaybackContext): Promise<void>;
  /** Resolve only after the requested frame's async visual resources settle. */
  waitForVisualSettlement?(frame?: BoardVisualFrame): void | Promise<void>;
  getRenderedCell?(row: number, col: number): unknown;
  getDiagnostics?(): unknown;
  getDisplayObjectCounts?(): Readonly<Record<string, number>>;
  getTextureLeaseCounts?(): Readonly<Record<string, number>>;
  getCellClientRect(row: number, col: number): BoardClientRect | null;
  resize(layout: BoardViewportLayout): void;
  restore(frame: BoardVisualFrame): void | Promise<void>;
  destroy(): void;
}
