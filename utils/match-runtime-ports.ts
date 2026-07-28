export type MatchCommandPlayerKey = 'black' | 'white';
export type MatchCommandRecord = Record<string, unknown>;

export interface MatchCommandSnapshot extends MatchCommandRecord {
  gameState: MatchCommandRecord;
  cardState: MatchCommandRecord;
}

export interface MatchCommandSeatMap<T> {
  black?: T;
  white?: T;
}

export interface MatchCommandInitialDeckOptions {
  initialDeckCardIdsByPlayer?: MatchCommandSeatMap<readonly string[]>;
  initialDeckSpecByPlayer?: MatchCommandSeatMap<unknown>;
  initialDeckSpec?: unknown;
  boardConfig?: unknown;
}

export interface MatchCommandAuthorityContext {
  snapshot: MatchCommandSnapshot;
  playerKey: MatchCommandPlayerKey;
  roomSeed: number;
  stateVersion: number;
  initialDeckOptions: MatchCommandInitialDeckOptions;
  networkDebugEnabled: boolean;
  networkAutoEnabled: boolean;
}

export interface MatchCommandSnapshotCapabilities {
  cloneSnapshot: (snapshot: MatchCommandSnapshot) => MatchCommandSnapshot;
  stripTransientChargeDeltaState: (snapshot: MatchCommandSnapshot) => unknown;
  stripTransientPresentationState: (snapshot: MatchCommandSnapshot) => unknown;
  restoreMissingChargeDeltaEvents: (
    previousSnapshot: MatchCommandSnapshot,
    nextSnapshot: MatchCommandSnapshot
  ) => unknown;
}

export interface MatchCommandSchemaCapabilities {
  buildAction: (
    input: MatchCommandRecord,
    fallbackActor: MatchCommandPlayerKey,
    fallbackTurnIndex: number
  ) => {
    actor?: unknown;
    action?: unknown;
  } | null | undefined;
}

export interface MatchAutoCommandCapabilities {
  isAutoTurnPublishBody: (body: MatchCommandRecord) => boolean;
  resolveAutoTurnPublishBody: (options: {
    body: MatchCommandRecord;
    snapshot: MatchCommandSnapshot;
    playerKey: MatchCommandPlayerKey;
    planningPlayerKey: MatchCommandPlayerKey;
  }) => {
    ok?: boolean;
    body?: MatchCommandRecord;
    rejectedReason?: unknown;
  } | null | undefined;
}

export interface MatchCommandDebugCapabilities {
  isDebugFillHandPayload: (body: MatchCommandRecord) => boolean;
  resolveDebugFillHandOptions: (body: MatchCommandRecord) => MatchCommandRecord;
  fillDebugHand: (
    cardState: MatchCommandRecord,
    options: MatchCommandRecord
  ) => unknown;
}

export interface MatchCommandPrng {
  random?: () => number;
  getState?: () => unknown;
  [key: string]: unknown;
}

export interface MatchCommandRandomCapabilities {
  createActionPrng: (
    context: MatchCommandAuthorityContext,
    snapshot: MatchCommandSnapshot
  ) => MatchCommandPrng;
  createTurnStartPrng: (
    context: MatchCommandAuthorityContext,
    snapshot: MatchCommandSnapshot,
    playerKey: MatchCommandPlayerKey
  ) => MatchCommandPrng;
}

export interface MatchCommandPipelineResult {
  ok?: boolean;
  rejectedReason?: unknown;
  errorMessage?: unknown;
  gameState?: unknown;
  cardState?: unknown;
  events?: unknown;
  [key: string]: unknown;
}

export interface MatchCommandPipelineCapabilities {
  applyTurnSafe: (
    cardState: MatchCommandRecord,
    gameState: MatchCommandRecord,
    playerKey: MatchCommandPlayerKey,
    action: unknown,
    prng: MatchCommandPrng,
    options: MatchCommandRecord
  ) => MatchCommandPipelineResult | null | undefined;
}

export interface MatchCommandTurnStartCapabilities {
  isGameOver: (gameState: MatchCommandRecord) => boolean;
  createCardState: (
    prng: MatchCommandPrng,
    initialDeckOptions: MatchCommandInitialDeckOptions
  ) => MatchCommandRecord;
  mergeWithDefaultShape: (
    defaultValue: MatchCommandRecord,
    overrideValue: MatchCommandRecord
  ) => MatchCommandRecord;
  applyTurnStartPhase: (
    cardLogic: unknown,
    coreLogic: unknown,
    cardState: MatchCommandRecord,
    gameState: MatchCommandRecord,
    playerKey: MatchCommandPlayerKey,
    events: unknown[],
    prng: MatchCommandPrng
  ) => unknown;
  cardLogic: unknown;
  coreLogic: unknown;
}

export interface MatchCommandPendingValidation {
  ok?: unknown;
  pendingEffectId?: unknown;
  rejectedReason?: unknown;
}

export interface MatchCommandAuthorityCapabilities {
  normalizePlayerKey: (value: unknown) => unknown;
  parsePlayerKeyOptional: (value: unknown) => MatchCommandPlayerKey | null;
  getCurrentPlayerKey: (gameState: unknown) => MatchCommandPlayerKey;
  parseHiddenHandToken: (value: unknown) => {
    ownerKey?: unknown;
    handIndex?: unknown;
  } | null | undefined;
  validatePendingSelectionPublish: (
    snapshot: MatchCommandSnapshot,
    playerKey: MatchCommandPlayerKey,
    action: unknown
  ) => MatchCommandPendingValidation | null | undefined;
  sanitizePendingSelectionActionForAuthority: (
    snapshot: MatchCommandSnapshot,
    playerKey: MatchCommandPlayerKey,
    action: unknown
  ) => unknown;
  validateAuthoritativePendingSelectionResult: (
    action: unknown,
    rawEvents: readonly unknown[]
  ) => {
    ok?: unknown;
    rejectedReason?: unknown;
  } | null | undefined;
  isSubPlacementTurnActive?: (
    cardState: MatchCommandRecord,
    playerKey: MatchCommandPlayerKey
  ) => unknown;
}

export interface MatchCommandPlaybackAssembly {
  playbackEvents?: readonly unknown[];
  presentationEvents?: readonly unknown[];
  diagnostics?: unknown;
  playerKey?: unknown;
  [key: string]: unknown;
}

export interface MatchCommandPresentationCapabilities {
  collectActionPlaybackEvents: (options: {
    result: MatchCommandPipelineResult;
    rawEvents: readonly unknown[];
    snapshot: MatchCommandSnapshot;
    playerKey: MatchCommandPlayerKey;
  }) => MatchCommandPlaybackAssembly | null | undefined;
  collectTurnStartPlaybackEvents: (options: {
    rawEvents: readonly unknown[];
    snapshot: MatchCommandSnapshot;
    playerKey: MatchCommandPlayerKey;
  }) => MatchCommandPlaybackAssembly | null | undefined;
  buildActionEffectLogs: (
    action: unknown,
    playerKey: MatchCommandPlayerKey,
    rawEvents: readonly unknown[],
    presentationEvents: readonly unknown[]
  ) => readonly string[];
  collectTurnStartEffectLogs: (
    rawEvents: readonly unknown[],
    presentationEvents: readonly unknown[],
    playerKey: MatchCommandPlayerKey
  ) => readonly string[];
  appendTurnStartDrawPlaybackEvents: (options: {
    playbackAssembly: MatchCommandPlaybackAssembly;
    snapshot: MatchCommandSnapshot;
    handState: {
      playerKey: MatchCommandPlayerKey;
      hand: readonly unknown[];
    };
  }) => MatchCommandPlaybackAssembly;
  appendPlaybackEventsAfter: (
    actionEvents: readonly unknown[],
    turnStartEvents: readonly unknown[]
  ) => readonly unknown[];
  appendEffectLogMessages: (
    actionLogs: readonly string[],
    turnStartLogs: readonly string[]
  ) => readonly string[];
  reportPlaybackAssemblyDiagnostics: (
    context: string,
    diagnostics: unknown,
    options: { networkDebugEnabled: boolean }
  ) => void;
  toDebugPlaybackDiagnostics: (
    diagnostics: unknown,
    networkDebugEnabled: boolean
  ) => unknown | null;
}

export interface MatchCommandExecutionCapabilities {
  snapshot: MatchCommandSnapshotCapabilities;
  schema: MatchCommandSchemaCapabilities;
  autoCommand?: MatchAutoCommandCapabilities | null;
  debug?: MatchCommandDebugCapabilities | null;
  random: MatchCommandRandomCapabilities;
  pipeline: MatchCommandPipelineCapabilities;
  turnStart: MatchCommandTurnStartCapabilities;
  authority: MatchCommandAuthorityCapabilities;
  presentation: MatchCommandPresentationCapabilities;
}

export interface MatchCommandRuntimePreflightCapabilities {
  schemaAvailable: boolean;
  pipelineAvailable: boolean;
  turnStartAvailable: boolean;
  presentationAvailable: boolean;
  autoCommandAvailable: boolean;
  debugAvailable: boolean;
}

export interface PreparedMatchCommandExecution {
  context: MatchCommandAuthorityContext;
  preActionSnapshot: MatchCommandSnapshot;
  commandBody: MatchCommandRecord;
  currentTurnIndex: number;
  currentCardState: MatchCommandRecord;
  resolvedAction: unknown;
  pendingValidation: MatchCommandPendingValidation;
  prng: MatchCommandPrng;
  skipTurnStart: boolean;
}

export interface AppliedMatchCommandExecution extends PreparedMatchCommandExecution {
  pipelineResult: MatchCommandPipelineResult;
  nextSnapshot: MatchCommandSnapshot;
  rawEvents: readonly unknown[];
}

export interface MatchCommandPresentationAssembly {
  snapshot: MatchCommandSnapshot;
  rawEvents: readonly unknown[];
  playbackEvents: readonly unknown[];
  presentationEvents: readonly unknown[];
  effectLogs: readonly string[];
  diagnostics: unknown | null;
  actionChargeDeltaEvents: readonly unknown[];
  shouldReconcileTurnStart: boolean;
}

export interface TurnStartReconciliationResult {
  snapshot: MatchCommandSnapshot;
  rawEvents: readonly unknown[];
  playbackEvents: readonly unknown[];
  presentationEvents: readonly unknown[];
  effectLogs: readonly string[];
  diagnostics: unknown | null;
  playerKey: MatchCommandPlayerKey | null;
}

export interface MatchCommandExecutionSuccess {
  ok: true;
  snapshot: MatchCommandSnapshot;
  rawEvents: readonly unknown[];
  playbackEvents: readonly unknown[];
  playbackDiagnostics: unknown | null;
  effectLogs: readonly string[];
  action: unknown;
  pendingEffectId: string | null;
}

export interface MatchCommandExecutionFailure {
  ok: false;
  rejectedReason: string;
  errorMessage?: string | null;
  rawEvents?: readonly unknown[];
}

export type MatchCommandExecutionResult =
  | MatchCommandExecutionSuccess
  | MatchCommandExecutionFailure;

export type MatchCommandPrepareResult =
  | {
    kind: 'terminal';
    result: MatchCommandExecutionResult;
  }
  | {
    kind: 'prepared';
    value: PreparedMatchCommandExecution;
  };

export interface MatchRuntimeCommand {
  room: Record<string, unknown>;
  body: Record<string, unknown>;
  playerKey: string;
}

export interface MatchRuntimeCommandResult {
  ok: boolean;
  rejectedReason?: string;
  errorMessage?: string | null;
  snapshot?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Compatibility-only port retained until both runtime facades use the shared
 * synchronous executor directly.
 */
export interface MatchCommandRuntimePort<TResult = MatchRuntimeCommandResult> {
  execute(command: MatchRuntimeCommand): TResult;
}
