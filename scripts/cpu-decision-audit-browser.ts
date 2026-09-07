/** Read-only instrumentation installed only in a disposable benchmark page. */
export function installCpuDecisionAudit(options: { maxRecords: number }) {
    const root = window as any;
    const req = root.require;
    const cardSystem = req('card-system');
    const prngApi = req('game/schema/prng');
    const pipeline = req('game/turn/turn_pipeline');
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const canonical = (value: any): string => JSON.stringify(value, (_key, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    });
    const records: any[] = [];
    const decisions: any[] = [];
    const snapshot = () => clone({ gameState: root.gameState, cardState: root.cardState,
        prngState: cardSystem.getGamePrng().getState() });
    const resultState = (result: any, rng: any) => clone({ gameState: result.gameState,
        cardState: result.cardState, prngState: rng.getState(), ok: result.ok,
        rejectedReason: result.rejectedReason });
    const originalApply = pipeline.applyTurnSafe;
    pipeline.applyTurnSafe = function(cs: any, gs: any, player: any, action: any, rng: any, opts: any) {
        if (records.length >= options.maxRecords || !rng?.getState) return originalApply(cs, gs, player, action, rng, opts);
        const before = clone({ gameState: gs, cardState: cs, prngState: rng.getState() });
        const savedAction = clone(action), savedOptions = clone(opts || {});
        const randomValues: number[] = [];
        const originalRandom = rng.random;
        rng.random = function() { const value = originalRandom.call(this); randomValues.push(value); return value; };
        let result: any;
        try { result = originalApply(cs, gs, player, action, rng, opts); }
        finally { rng.random = originalRandom; }
        const after = resultState(result, rng);
        const liveBeforeReplay = snapshot();
        const replayRng = prngApi.fromState(before.prngState);
        const replay = originalApply(clone(before.cardState), clone(before.gameState), player,
            clone(savedAction), replayRng, clone(savedOptions));
        records.push({ player, before, action: savedAction, options: savedOptions, after, randomValues,
            liveStateUnchanged: canonical(liveBeforeReplay) === canonical(snapshot()),
            replayMatched: canonical(after) === canonical(resultState(replay, replayRng)) });
        return result;
    };
    const selected = (result: any) => result ? { row: result.row, col: result.col,
        cardId: result.cardId, type: result.type } : null;
    function wrap(owner: any, key: string, label: string) {
        const original = owner?.[key];
        if (typeof original !== 'function') return;
        owner[key] = function(...args: any[]) {
            if (decisions.length >= options.maxRecords) return original.apply(this, args);
            const before = snapshot();
            const first = original.apply(this, args);
            const finish = (result: any, replay: any) => {
                decisions.push({ label, before, inputs: label === 'current-othello' ? clone(args) : undefined,
                    selected: selected(result), replay: selected(replay),
                    replayMatched: canonical(selected(result)) === canonical(selected(replay)),
                    stateUnchanged: canonical(before) === canonical(snapshot()) });
                return result;
            };
            if (first && typeof first.then === 'function') {
                return first.then(async (result: any) => finish(result, await original.apply(this, args)));
            }
            return finish(first, original.apply(this, args));
        };
    }
    wrap(req('game/ai/othello-onnx-runtime'), 'chooseMove', 'current-othello');
    wrap(root, 'selectCpuMoveWithPolicy', 'current-placement');
    wrap(root, 'selectMoveFromOnnxPolicyAsync', 'current-async-placement');
    wrap(req('game/ai/cpu-policy-core'), 'chooseCardWithRiskProfile', 'current-card-risk');
    root.__cpuDecisionAudit = { records, decisions };
}
