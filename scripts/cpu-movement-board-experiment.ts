/** Runs only in disposable comparison pages, never the production CPU. */
export function installMovementBoardExperiment(options: { color: string }) {
    const root = window as any;
    const req = root.require;
    const policy = req('game/ai/cpu-policy-pending-targets');
    const cards = req('game/logic/cards');
    const system = req('card-system');
    const core = req('game/logic/core');
    const authority = req('utils/match-authority');
    const prng = req('game/schema/prng');
    const pipeline = req('game/turn/turn_pipeline');
    const placementPolicy = req('game/ai/cpu-policy-core');
    const boardUtils = req('shared/shared-board-utils');
    const evaluate = (gs: any, cs: any, sign: number) => {
        const board = boardUtils.createBoardContext(gs, cs);
        const inBoard = (b: any, r: number, c: number) => boardUtils.hasPlayableCell(b, r, c);
        const getLegalMovesBasic = (_b: any, p: number) => core.getLegalMoves(gs, p, { ...cards.getCardContext(cs), cardState: cs });
        const features = req('game/ai/cpu-policy-board-features').createCpuPolicyBoardFeatures({
            SharedBoardUtils: boardUtils, inBoard, getLegalMovesBasic,
            isCorner: boardUtils.isCornerCell, isXSquare: boardUtils.isXSquare, isCSquare: boardUtils.isCSquare,
            hasOwnedAdjacentCorner: (b: any, r: number, c: number, p: number) => boardUtils.getCornerCells(b).some((corner: any) => Math.abs(corner.row - r) <= 1 && Math.abs(corner.col - c) <= 1 && boardUtils.getCellValue(b, corner.row, corner.col) === p)
        });
        const parity = req('game/ai/cpu-policy-lookahead-parity').createCpuPolicyLookaheadParity({ SharedBoardUtils: boardUtils, inBoard });
        const evaluator = req('game/ai/cpu-policy-lookahead-evaluation').createCpuPolicyLookaheadEvaluation({
            ...features, ...parity, SharedBoardUtils: boardUtils, inBoard, getLegalMovesBasic,
            isCorner: boardUtils.isCornerCell, isEdge: boardUtils.isEdgeCell,
            countBoardDiscsForPlayer: (b: any, p: number) => {
                const values = boardUtils.collectBoardCoordinates(b).map((cell: any) => boardUtils.getCellValue(b, cell.row, cell.col));
                return { own: values.filter((v: number) => v === p).length, opp: values.filter((v: number) => v === -p).length, empties: values.filter((v: number) => v === 0).length };
            }
        });
        return core.isGameOver(gs) ? evaluator.evaluateTerminalBoardForLookahead(board, sign) : evaluator.evaluateBoardForLookahead(board, sign);
    };
    const clone = (v: any) => JSON.parse(JSON.stringify(v));
    const snapshot = () => JSON.stringify({ gameState: root.gameState, cardState: root.cardState, rng: system.getGamePrng().getState() });
    root.__cardHoldEvents = [];
    const original = policy.choosePendingTargetWithPolicyAsync;
    policy.choosePendingTargetWithPolicyAsync = async function(player: string, type: string, targets: any[], ...rest: any[]) {
        try {
        const baseline = await original.call(this, player, type, targets, ...rest);
        const method = type === 'SUPER_BUOYANCY_WILL' ? 'applySuperBuoyancyWill' : type === 'SUPER_GRAVITY_WILL' ? 'applySuperGravityWill' : null;
        if (player !== options.color || !method || !baseline || targets.length <= 1) return baseline;
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
            const board = boardUtils.createBoardContext(option.state.gameState, option.state.cardState);
            const moves = core.getLegalMoves(option.state.gameState, sign, { ...cards.getCardContext(option.state.cardState), cardState: option.state.cardState });
            moves.sort((a: any, b: any) => placementPolicy.scoreMoveHeuristic(b, 6, board) - placementPolicy.scoreMoveHeuristic(a, 6, board) || a.row - b.row || a.col - b.col);
            let value = -Infinity;
            let followingMove: any = null;
            for (const move of moves.slice(0, 4)) {
                const state = clone(option.state);
                const rng = prng.createPRNG(19073300);
                state.cardState._boardOpsRandomSource = rng;
                state.cardState._defaultRandomSource = rng;
                const result = pipeline.applyTurnSafe(state.cardState, state.gameState, player, { type: 'place', row: move.row, col: move.col }, rng, { skipTurnStart: true });
                if (!result.ok || rng.getState().calls > 0) continue;
                const score = evaluate(result.gameState, result.cardState, sign);
                if (score > value) { value = score; followingMove = { row: move.row, col: move.col }; }
            }
            if (!Number.isFinite(value)) value = evaluate(option.state.gameState, option.state.cardState, sign);
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Movement board evaluation unavailable');
            evaluated.push({ target: option.target, value, followingMove, material: option.material, legalMovesCount: option.legalMovesCount });
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
