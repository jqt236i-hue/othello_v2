import type {
    MatchCommandRuntimePort,
    MatchRuntimeCommand,
    MatchRuntimeCommandResult
} from './match-runtime-ports';

export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult>
): TResult;
export function executeMatchRuntimeCommand(
    command: MatchRuntimeCommand,
    port: null | undefined
): MatchRuntimeCommandResult;
export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult> | null | undefined
): TResult | MatchRuntimeCommandResult;
export function executeMatchRuntimeCommand<TResult>(
    command: MatchRuntimeCommand,
    port: MatchCommandRuntimePort<TResult> | null | undefined
): TResult | MatchRuntimeCommandResult {
    if (!port || typeof port.execute !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }
    return port.execute(command);
}
