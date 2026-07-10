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
 * The authority core owns command selection; runtimes supply only execution.
 * Worker and local adapters can implement this port without importing each other.
 */
export interface MatchCommandRuntimePort<TResult = MatchRuntimeCommandResult> {
  execute(command: MatchRuntimeCommand): TResult;
}
