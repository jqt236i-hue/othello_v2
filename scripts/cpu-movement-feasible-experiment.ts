/** Restrict only deterministic, non-completing movement selections in a test page. */
export function installMovementFeasibleExperiment(options: { color: string }) {
    const root = window as any, req = root.require;
    const policy = req('game/ai/cpu-policy-pending-targets');
    const system = req('card-system');
    const authority = req('utils/match-authority');
    const pipeline = req('game/turn/turn_pipeline');
    const prng = req('game/schema/prng');
    const clone = (v: any) => JSON.parse(JSON.stringify(v));
    const snapshot = () => JSON.stringify({ gameState: root.gameState, cardState: root.cardState, rng: system.getGamePrng().getState() });
    root.__cardHoldEvents = [];
    const original = policy.choosePendingTargetWithPolicyAsync;
    policy.choosePendingTargetWithPolicyAsync = async function(player: string, type: string, targets: any[], ...rest: any[]) {
        try {
            const baseline = await original.call(this, player, type, targets, ...rest);
            const field = type === 'SUPER_BUOYANCY_WILL' ? 'superBuoyancyTarget' : type === 'SUPER_GRAVITY_WILL' ? 'superGravityTarget' : null;
            if (player !== options.color || !field || !baseline || targets.length <= 1) return baseline;
            const started = performance.now(), before = snapshot();
            const view = authority.projectSnapshotForViewer({ gameState: clone(root.gameState), cardState: clone(root.cardState) }, player);
            for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete view.cardState[key];
            const evaluated: any[] = [];
            const same = (a: any, b: any) => a.row === b.row && a.col === b.col;
            const simulate = (target: any) => {
                const state = clone(view), rng = prng.createPRNG(19074000);
                const result = pipeline.applyTurnSafe(state.cardState, state.gameState, player, { type: 'place', [field]: { row: target.row, col: target.col } }, rng, { skipTurnStart: true });
                const deterministic = rng.getState().calls === 0;
                const completed = result.ok && !result.cardState.pendingEffectByPlayer[player];
                evaluated.push({ target, deterministic, completed, rejectedReason: result.rejectedReason || null });
                return { deterministic, completed };
            };
            const first = simulate(baseline);
            let selected = baseline;
            let skipped: string | null = first.completed ? 'baseline_completes' : !first.deterministic ? 'random_secondary_effect' : null;
            if (!skipped) {
                const viable = targets.filter(t => !same(t, baseline)).slice(0, 63).filter(target => {
                    const result = simulate(target);
                    return result.deterministic && result.completed;
                });
                if (viable.length) {
                    selected = await original.call(this, player, type, viable, ...rest);
                    if (!selected || !viable.some(t => same(t, selected))) throw new Error('Feasibility correction returned an invalid target');
                } else skipped = 'no_completed_alternative';
            }
            const liveUnchanged = before === snapshot();
            if (!liveUnchanged) throw new Error('Feasibility simulation changed live state');
            root.__cardHoldEvents.push({ player, pending: type, before: baseline, after: selected, changed: !same(baseline, selected),
                liveUnchanged, extraMs: performance.now() - started, evaluated, rejected: [], skipped });
            return selected;
        } catch (error) {
            root.__cardHoldEvents.push({ player, pending: type, error: String(error) });
            throw error;
        }
    };
}
