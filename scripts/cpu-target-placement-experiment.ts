/** Runs only in disposable comparison pages, never the production CPU. */
export function installTargetPlacementExperiment(options: { color: string }) {
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
            const entry = req('game/logic/cards-internal/pending-selection-registry').getPendingSelectionEntry(type);
            if (player !== options.color || !baseline || targets.length <= 1 || !entry?.action?.field || entry.turnOutcome !== 'continue_turn') return baseline;
            const started = performance.now(), before = snapshot();
            const view = authority.projectSnapshotForViewer({ gameState: clone(root.gameState), cardState: clone(root.cardState) }, player);
            const sign = player === 'black' ? 1 : -1;
            const strip = (state: any) => {
                for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete state.cardState[key];
                return state;
            };
            strip(view);
            const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
            let steps = 0;
            const apply = (input: any, action: any) => {
                steps++;
                const state = strip(clone(input)), rng = prng.createPRNG(19075000);
                const result = pipeline.applyTurnSafe(state.cardState, state.gameState, player, action, rng, { skipTurnStart: true });
                // Exclude outcomes depending on sampled hidden/random consequences.
                if (!result.ok || rng.getState().calls > 0) return null;
                return strip({ gameState: result.gameState, cardState: result.cardState });
            };
            const rejected: any[] = [], alternatives: any[] = [];
            const ordered = [baseline, ...targets.filter(t => !same(t, baseline))].slice(0, 32);
            for (const target of ordered) {
                const state = apply(view, { type: 'place', [entry.action.field]: clone(target) });
                if (!state || state.cardState.pendingEffectByPlayer[player] || state.gameState.currentPlayer !== sign) {
                    rejected.push({target, reason:'unresolved_or_random'}); continue;
                }
                alternatives.push({ target, state, immediate: evaluate(state.gameState, state.cardState, sign) });
            }
            alternatives.sort((a, b) => Number(same(b.target, baseline)) - Number(same(a.target, baseline)) || b.immediate - a.immediate);
            const evaluated: any[] = [];
            let best = baseline, bestValue = -Infinity;
            let skipped: string | null = alternatives.some(a => same(a.target, baseline)) ? null : 'baseline_unresolved';
            for (const option of skipped ? [] : alternatives.slice(0, 4)) {
                const {gameState: gs, cardState: cs} = option.state;
                const board = boardUtils.createBoardContext(gs, cs);
                const moves = core.getLegalMoves(gs, sign, { ...cards.getCardContext(cs), cardState: cs });
                moves.sort((a: any,b: any) => placementPolicy.scoreMoveHeuristic(b,6,board) - placementPolicy.scoreMoveHeuristic(a,6,board) || a.row-b.row || a.col-b.col);
                let value = -Infinity, followingMove: any = null;
                for (const move of moves.slice(0,4)) {
                    const state = apply(option.state, {type:'place',row:move.row,col:move.col});
                    if (!state || state.cardState.pendingEffectByPlayer[player]) continue;
                    const score = evaluate(state.gameState,state.cardState,sign);
                    if (score > value) { value = score; followingMove = {row:move.row,col:move.col}; }
                }
                // No comparable complete placement: do not substitute an immediate score.
                if (!Number.isFinite(value)) { rejected.push({target:option.target,reason:'no_deterministic_placement'}); continue; }
                evaluated.push({target:option.target,value,followingMove});
                if (value > bestValue) {bestValue=value;best=option.target;}
            }
            if (!evaluated.some(e=>same(e.target,baseline))) {best=baseline;skipped=skipped||'baseline_placement_unresolved';}
            const liveUnchanged=before===snapshot();
            if (!liveUnchanged) throw new Error('Target placement simulation changed live state');
            root.__cardHoldEvents.push({player,pending:type,before:baseline,after:best,changed:!same(best,baseline),evaluated,rejected,skipped,steps,liveUnchanged,extraMs:performance.now()-started});
            return best;
        } catch(error) {
            root.__cardHoldEvents.push({player,pending:type,error:String(error)}); throw error;
        }
    };
}
