import Phases = require('./turn_pipeline_phases');

/** Turn-start completion includes the persisted RNG checkpoint. Browser and
 * headless callers must finish both before obtaining the next observation. */
export function applyTurnStartAndCheckpoint(cardLogic: any, core: any, cardState: any, gameState: any,
    player: any, events: any[], prng: any, boardOps?: any): any {
    const result = Phases.applyTurnStartPhase(cardLogic, core, cardState, gameState, player, events, prng, boardOps);
    if (prng && typeof prng.getState === 'function') cardState.prngState = prng.getState();
    return result;
}
