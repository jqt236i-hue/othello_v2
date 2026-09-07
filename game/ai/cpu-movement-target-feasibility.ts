import Pipeline = require('../turn/turn_pipeline');
import Authority = require('../../utils/match-authority');
const Prng = require('../schema/prng');

type Target = { row: number; col: number; [key: string]: unknown };
type Input = { gameState: any; cardState: any; playerKey: 'black' | 'white'; pendingType: string; targets: Target[]; selected: Target; simulationSeed?: number };

/** Read-only CPU safeguard: do not repeatedly choose a deterministic, unfinished selection. */
export function filterCompletableMovementTargets(input: Input): { targets: Target[]; reason: string; inspected: number } {
    const { targets, selected, playerKey } = input;
    const field = input.pendingType === 'SUPER_BUOYANCY_WILL' ? 'superBuoyancyTarget' : input.pendingType === 'SUPER_GRAVITY_WILL' ? 'superGravityTarget' : null;
    if (!field || !selected || !Array.isArray(targets) || targets.length <= 1 || !input.gameState || !input.cardState) return { targets, reason: 'not_applicable', inspected: 0 };
    const clone = (value: any) => JSON.parse(JSON.stringify(value));
    const view: any = Authority.projectSnapshotForViewer(clone({ gameState: input.gameState, cardState: input.cardState }), playerKey);
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'presentationEvents', '_presentationEventsPersist', 'chargeDeltaEvents']) delete view.cardState[key];
    let inspected = 0;
    const simulate = (target: Target) => {
        inspected++;
        const state = clone(view), rng = Prng.createPRNG(input.simulationSeed ?? 19074000);
        const result = Pipeline.applyTurnSafe(state.cardState, state.gameState, playerKey,
            { type: 'place', [field]: { row: target.row, col: target.col } }, rng, { skipTurnStart: true });
        return { deterministic: rng.getState().calls === 0, completed: !!(result.ok && result.cardState && !result.cardState.pendingEffectByPlayer[playerKey]) };
    };
    const baseline = simulate(selected);
    if (baseline.completed || !baseline.deterministic) return { targets, reason: baseline.completed ? 'baseline_completes' : 'random_effect', inspected };
    const viable = targets.filter(target => target.row !== selected.row || target.col !== selected.col).slice(0, 63).filter(target => {
        const result = simulate(target);
        return result.deterministic && result.completed;
    });
    return { targets: viable.length ? viable : targets, reason: viable.length ? 'filtered' : 'no_completed_alternative', inspected };
}
