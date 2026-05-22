describe('deterministic seeds', () => {
  function runTurnStart(seed) {
    const SeededPRNG = require('../game/schema/prng.js');
    const CardLogic = require('../game/logic/cards.js');
    const Core = require('../game/logic/core.js');
    const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');
    const StateHash = require('../shared/state-hash.js');

    const prng = SeededPRNG.createPRNG(seed);
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    const events = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    return {
      cardState,
      gameState,
      events,
      hash: StateHash.computeStableHash({
        cardState,
        gameState,
        events
      })
    };
  }

  test('same seed reproduces the same turn-start state and events', () => {
    const first = runTurnStart(17);
    const second = runTurnStart(17);

    expect(first.hash).toBe(second.hash);
    expect(first.events).toEqual(second.events);
    expect(first.cardState.hands).toEqual(second.cardState.hands);
  });

  test('different seeds diverge in the shuffled card state', () => {
    const first = runTurnStart(17);
    const second = runTurnStart(18);

    expect(first.hash).not.toBe(second.hash);
    expect(first.cardState.decks).not.toEqual(second.cardState.decks);
  });
});
