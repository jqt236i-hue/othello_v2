import Authority = require('../../utils/match-authority');
import Presentation = require('../../shared/presentation-queue');
import { LV10_POSITION_LIMITS, type Lv10Observation, type Lv10Player, type Lv10Position } from './cpu-lv10-position';

/** The only ingress from a live match. Keep authority projection on the game
 * thread: a Worker receives only the result of the existing reveal rules. */
export function observeLv10Position(state: Lv10Position, player: Lv10Player): Lv10Observation {
    if (player !== 'black' && player !== 'white') throw new Error('Invalid Lv10 viewer');
    const view = Authority.projectSnapshotForViewer({ gameState: state.gameState, cardState: state.cardState }, player);
    const projectedCardState: any = view.cardState;
    if (!projectedCardState) throw new Error('Lv10 observation requires a card state');
    Presentation.clearPresentationQueues(projectedCardState);
    for (const key of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta', 'prngState']) delete projectedCardState[key];
    const observation: Lv10Observation = { schema: 'cpu_lv10_observation.v1', player,
        gameState: view.gameState, cardState: view.cardState };
    if (JSON.stringify(observation).length > LV10_POSITION_LIMITS.maxSerializedChars) throw new Error('Lv10 observation exceeds budget');
    return observation;
}
