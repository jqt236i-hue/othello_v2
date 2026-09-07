/** Test-page-only connection to the existing card-aware placement correction. */
export function patchPendingPlanRegistry(source: string): string {
    const needle = 'const resolved = deps.resolveCandidateMoveByCoord(prioritizedCandidateMoves, selected) || selected;';
    if (source.split(needle).length !== 2) throw new Error('Pending placement hook must match exactly once');
    return source.replace(needle, 'const resolved = window.__pendingPlanExperiment(deps, prioritizedCandidateMoves, selected, playerKey, level, pendingType);');
}

export function installPendingPlanExperiment(options: { color: string }) {
    const root = window as any;
    root.__cardHoldEvents = [];
    root.__pendingPlanExperiment = (deps: any, candidates: any[], selected: any, player: string, level: number, pending: any) => {
        const original = deps.resolveCandidateMoveByCoord(candidates, selected) || selected;
        const started = performance.now();
        let result = original;
        if (player === options.color && level >= 6 && pending && original && candidates.length > 1) {
            const refined = deps.refineOnnxMoveByTacticalPlan(candidates, original, player, level);
            const legal = deps.resolveCandidateMoveByCoord(candidates, refined);
            if (!legal) throw new Error('Pending correction returned an illegal placement');
            result = legal;
        }
        const changed = !!(original && result && (original.row !== result.row || original.col !== result.col));
        root.__cardHoldEvents.push({ player, level, pending, changed,
            before: original ? { row: original.row, col: original.col } : null,
            after: result ? { row: result.row, col: result.col } : null,
            extraMs: performance.now() - started });
        return result;
    };
}
