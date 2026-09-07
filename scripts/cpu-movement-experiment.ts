/** Runs only in disposable comparison pages, never the production CPU. */
export function installMovementExperiment(options: { color: string }) {
    const root = window as any;
    const req = root.require;
    const policy = req('game/ai/cpu-policy-pending-targets');
    const cards = req('game/logic/cards');
    const system = req('card-system');
    const core = req('game/logic/core');
    const authority = req('utils/match-authority');
    const prng = req('game/schema/prng');
    const runtime = req('game/ai/othello-onnx-runtime');
    const boardUtils = req('shared/shared-board-utils');
    const clone = (v: any) => JSON.parse(JSON.stringify(v));
    const snapshot = () => JSON.stringify({ gameState: root.gameState, cardState: root.cardState, rng: system.getGamePrng().getState() });
    root.__cardHoldEvents = [];
    const original = policy.choosePendingTargetWithPolicyAsync;
    policy.choosePendingTargetWithPolicyAsync = async function(player: string, type: string, targets: any[], ...rest: any[]) {
        try {
        const baseline = await original.call(this, player, type, targets, ...rest);
        const method = type === 'SUPER_BUOYANCY_WILL' ? 'applySuperBuoyancyWill' : type === 'SUPER_GRAVITY_WILL' ? 'applySuperGravityWill' : null;
        if (player !== options.color || !method || !baseline || targets.length <= 1) return baseline;
        if (!boardUtils.isStandardBoard8x8(boardUtils.createBoardContext(root.gameState, root.cardState))) return baseline;
        const started = performance.now();
        const before = snapshot();
        const view = authority.projectSnapshotForViewer({ gameState: clone(root.gameState), cardState: clone(root.cardState) }, player);
        for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete view.cardState[key];
        const sign = player === 'black' ? 1 : -1;
        const same = (a: any, b: any) => a.row === b.row && a.col === b.col;
        const alternatives: any[] = [];
        const rejected: any[] = [];
        for (const target of targets) {
            const state = clone(view);
            state.cardState._boardOpsRandomSource = prng.createPRNG(19073300);
            state.cardState._defaultRandomSource = state.cardState._boardOpsRandomSource;
            const effect = cards[method](state.cardState, state.gameState, player, target.row, target.col);
            if (state.cardState._boardOpsRandomSource.getState().calls > 0) { rejected.push({ target, reason: 'random_secondary_effect' }); continue; }
            if (!effect?.applied) { rejected.push({ target, reason: effect?.reason }); continue; }
            const counts = core.countDiscs(state.gameState);
            const material = sign * (counts.black - counts.white);
            const moves = core.getLegalMoves(state.gameState, sign, { ...cards.getCardContext(state.cardState), cardState: state.cardState });
            alternatives.push({ target, state, material, legalMovesCount: moves.length });
        }
        // Keep baseline and at most 15 material-ranked alternatives; fixed work bound.
        alternatives.sort((a, b) => Number(same(b.target, baseline)) - Number(same(a.target, baseline)) || b.material - a.material || a.target.row - b.target.row || a.target.col - b.target.col);
        let best = baseline;
        let bestValue = -Infinity;
        const evaluated: any[] = [];
        const skipped = !alternatives.some(a => same(a.target, baseline)) ? 'baseline_effect_unresolved' : null;
        for (const option of skipped ? [] : alternatives.slice(0, 16)) {
            const value = await runtime.evaluatePosition({ board: option.state.gameState.board, playerKey: player, level: 6, legalMovesCount: option.legalMovesCount });
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Movement value model unavailable');
            evaluated.push({ target: option.target, value, material: option.material, legalMovesCount: option.legalMovesCount });
            if (value > bestValue) { bestValue = value; best = option.target; }
        }
        const liveUnchanged = before === snapshot();
        if (!liveUnchanged) throw new Error('Movement simulation changed live state');
        root.__cardHoldEvents.push({ player, pending: type, changed: !same(best, baseline), before: baseline, after: best,
            extraMs: performance.now() - started, liveUnchanged, targetCount: targets.length, evaluated, skipped, rejected });
        return best;
        } catch (error) {
            root.__cardHoldEvents.push({ player, pending: type, error: String(error) });
            throw error;
        }
    };
}
