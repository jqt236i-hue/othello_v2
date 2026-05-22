interface MatchRuntimeCommandResult {
    ok: boolean;
    rejectedReason?: string;
    errorMessage?: string | null;
    snapshot?: Record<string, unknown>;
    [key: string]: unknown;
}

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
    if (typeof runtimeDeps.applyCommandPublishToSnapshot === 'function') {
        return runtimeDeps.applyCommandPublishToSnapshot(room, body, playerKey);
    }
    return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
}

export = {
    applyCommandToSnapshot
};
