// @ts-nocheck

function applyCommandToSnapshot(room, body, playerKey, deps) {
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
