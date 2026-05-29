import * as Shared from '../shared-constants.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as SeededPRNG from '../game/schema/prng.js';
import { applyCommandPublishToSnapshot } from '../scripts/local-match-server';

function buildPublishBody(snapshot: any) {
  const legalMoves = Core.getLegalMoves(
    snapshot.gameState,
    Shared.BLACK,
    CardLogic.getCardContext(snapshot.cardState, snapshot.gameState, 'black')
  );
  const move = legalMoves[0];
  return {
    actionType: 'place',
    actor: 'black',
    params: { row: move.row, col: move.col },
    turnIndex: snapshot.cardState.turnIndex,
    action: {
      type: 'place',
      playerKey: 'black',
      row: move.row,
      col: move.col,
      turnIndex: snapshot.cardState.turnIndex
    }
  };
}

function buildRoomWithObserver(seed: number, markerOwner: 'black' | 'white', row: number, col: number) {
  const prng = SeededPRNG.createPRNG(seed);
  const gameState = Core.createGameState();
  const cardState = CardLogic.createCardState(prng);

  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);
  cardState.lastTurnStartedFor = null;
  cardState.markers.push({
    id: `observer_${markerOwner}_${row}_${col}`,
    kind: 'specialStone',
    row,
    col,
    owner: markerOwner,
    data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
  });
  cardState.prngState = prng.getState();

  return {
    room: {
      stateVersion: 0,
      snapshot: { gameState, cardState }
    },
    callsBefore: cardState.prngState.calls
  };
}

describe('local match server observer PRNG persistence', () => {
  test('current-turn observer advances persisted prngState through publish', () => {
    const { room, callsBefore } = buildRoomWithObserver(123, 'black', 4, 3);

    const result = applyCommandPublishToSnapshot(room, buildPublishBody(room.snapshot), 'black');

    expect(result.ok).toBe(true);
    expect(result.snapshot.cardState.charge.black).toBeGreaterThan(0);
    expect(result.snapshot.cardState.prngState.calls).toBeGreaterThan(callsBefore);
  });

  test('post-action turn-start observer also advances persisted prngState', () => {
    const { room, callsBefore } = buildRoomWithObserver(123, 'white', 4, 4);

    const result = applyCommandPublishToSnapshot(room, buildPublishBody(room.snapshot), 'black');

    expect(result.ok).toBe(true);
    expect(result.snapshot.cardState.charge.white).toBeGreaterThan(0);
    expect(result.snapshot.cardState.prngState.calls).toBeGreaterThan(callsBefore);
  });
});
