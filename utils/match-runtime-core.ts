import { executeMatchRuntimeCommand } from './match-command-runtime';
import type {
    MatchCommandRuntimePort,
    MatchRuntimeCommand,
    MatchRuntimeCommandResult
} from './match-runtime-ports';

interface MatchRuntimeTurnPipeline {
    applyTurnSafe: (...args: unknown[]) => unknown;
}

interface MatchRuntimeCoreDeps {
    TurnPipeline?: MatchRuntimeTurnPipeline | null;
    applyCommandPublishToSnapshot?: (
        room: Record<string, unknown>,
        body: Record<string, unknown>,
        playerKey: string
    ) => MatchRuntimeCommandResult;
    [key: string]: unknown;
}

function applyCommandToSnapshot(
    room: Record<string, unknown>,
    body: Record<string, unknown>,
    playerKey: string,
    deps?: MatchRuntimeCoreDeps | null
): MatchRuntimeCommandResult {
    const runtimeDeps = (deps && typeof deps === 'object') ? deps : {};
    if (!runtimeDeps.TurnPipeline || typeof runtimeDeps.TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }
    const commandPort: MatchCommandRuntimePort<MatchRuntimeCommandResult> | null =
        typeof runtimeDeps.applyCommandPublishToSnapshot === 'function'
            ? {
                execute(command: MatchRuntimeCommand): MatchRuntimeCommandResult {
                    return runtimeDeps.applyCommandPublishToSnapshot!(
                        command.room,
                        command.body,
                        command.playerKey
                    );
                }
            }
            : null;
    return executeMatchRuntimeCommand({ room, body, playerKey }, commandPort);
}

export = {
    applyCommandToSnapshot
};
