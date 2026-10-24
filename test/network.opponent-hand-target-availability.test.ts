const TargetAvailabilityAuthority = require('../utils/match-authority');
const TargetAvailabilityCards = require('../game/logic/cards');
const TargetAvailabilityRuntime = require('../scripts/local-match-runtime');
const TargetAvailabilityCanonical = require('../ui/network/snapshot-canonical');

function createHandTargetRuntime(playerKey: string, cardId: string, opponentHand: string[]) {
  const runtime = TargetAvailabilityRuntime.createRuntime({ seed: 16 });
  const room = runtime.getRoom();
  const shot = room.snapshot;
  const opponent = playerKey === 'black' ? 'white' : 'black';
  shot.gameState.currentPlayer = playerKey === 'black' ? 1 : -1;
  shot.gameState.turnNumber = 18;
  shot.cardState.turnIndex = 19;
  shot.cardState.hands[playerKey] = [cardId];
  shot.cardState.hands[opponent] = opponentHand.slice();
  shot.cardState.charge[playerKey] = 99;
  shot.cardState.debugNoDraw = true;
  shot.cardState.prevOpponentTurnDestroyedStonesByPlayer[playerKey] = [{ owner: playerKey, row: 1, col: 1 }];
  return runtime;
}

function usable(snapshot: any, playerKey: string, cardId: string, options?: any) {
  return TargetAvailabilityCards.getUsableCardIds(snapshot.cardState, snapshot.gameState, playerKey, options).includes(cardId);
}

describe('seat-projected opponent hand target availability', () => {
  for (const playerKey of ['black', 'white']) {
    describe(playerKey, () => {
      test.each(['observer_will_01', 'condemn_01', 'execution_01'])('%s matches authority for private special, normal, mixed, and empty hands', (cardId) => {
        for (const opponentHand of [['theory_incarnation_01'], ['silver_stone'], ['theory_incarnation_01', 'silver_stone'], []]) {
          const runtime = createHandTargetRuntime(playerKey, cardId, opponentHand);
          const room = runtime.getRoom();
          const opponent = playerKey === 'black' ? 'white' : 'black';
          const privateBefore = JSON.stringify(room.snapshot);
          const projected = TargetAvailabilityAuthority.buildPublicSnapshot(room, playerKey);
          const expected = opponentHand.includes('silver_stone');
          expect(projected.cardState.opponentHandTargetAvailability).toEqual({ playerKey, hasTargetableCard: expected });
          expect(projected.cardState.hands[opponent]).toEqual(opponentHand.map((_, index) => `__hidden_hand__:${opponent}:${index}`));
          expect(JSON.stringify(room.snapshot)).toBe(privateBefore);
          expect(projected._meta.projectedSnapshotHash).toBe(TargetAvailabilityAuthority.computeProjectedSnapshotHash(JSON.parse(JSON.stringify(projected))));
          const prepared = TargetAvailabilityCanonical.prepareIncomingAuthoritativeSnapshot(projected, { localSeatKey: playerKey, currentAppliedVersion: -1 });
          expect(prepared.ok).toBe(true);
          expect(usable(room.snapshot, playerKey, cardId)).toBe(expected);
          expect(usable(prepared.snapshot, playerKey, cardId)).toBe(expected);
          // Card interaction uses the same query with this network-specific option.
          expect(usable(prepared.snapshot, playerKey, cardId, { skipCostAndTurnLimit: true })).toBe(expected);
          const action = { type: 'use_card', playerKey, useCardId: cardId, useCardOwnerKey: playerKey, turnIndex: 19 };
          const response = runtime.applyCommand({
            seatKey: playerKey, playerKey, actor: playerKey, baseVersion: 0,
            operationId: `availability_${cardId}_${opponentHand.length}`, actionType: 'use_card',
            params: { useCardId: cardId, useCardOwnerKey: playerKey }, turnIndex: 19, action
          });
          expect(response.ok).toBe(expected);
          if (!expected) expect(response.rejectedReason).toBe('CARD_USE_FAILED');
        }
      });
    });
  }

  test('each seat receives only its own boolean and spectators receive neither hint', () => {
    const room = createHandTargetRuntime('black', 'observer_will_01', ['theory_incarnation_01']).getRoom();
    room.snapshot.cardState.hands.black.push('silver_stone');
    expect(TargetAvailabilityAuthority.buildPublicSnapshot(room, 'black').cardState.opponentHandTargetAvailability)
      .toEqual({ playerKey: 'black', hasTargetableCard: false });
    expect(TargetAvailabilityAuthority.buildPublicSnapshot(room, 'white').cardState.opponentHandTargetAvailability)
      .toEqual({ playerKey: 'white', hasTargetableCard: true });
    const spectator = TargetAvailabilityAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'availability' });
    expect(spectator.cardState.opponentHandTargetAvailability).toBeUndefined();
    expect(spectator.cardState.hands.white).toEqual(['theory_incarnation_01']);
    expect(room.snapshot.cardState.opponentHandTargetAvailability).toBeUndefined();
  });

  test.each(['observer_will_01', 'condemn_01', 'execution_01'])('%s does not infer targets from hidden IDs without a matching authority hint', (cardId) => {
    const room = createHandTargetRuntime('black', cardId, ['silver_stone']).getRoom();
    const projected = TargetAvailabilityAuthority.buildPublicSnapshot(room, 'black');
    delete projected.cardState.opponentHandTargetAvailability;
    expect(usable(projected, 'black', cardId)).toBe(false);
    projected.cardState.opponentHandTargetAvailability = { playerKey: 'white', hasTargetableCard: true };
    expect(usable(projected, 'black', cardId)).toBe(false);
  });

  test('the target hint does not bypass cost, observer timing, or execution history', () => {
    const observerRoom = createHandTargetRuntime('black', 'observer_will_01', ['silver_stone']).getRoom();
    const observer = TargetAvailabilityAuthority.buildPublicSnapshot(observerRoom, 'black');
    observer.gameState.turnNumber = 17;
    expect(usable(observer, 'black', 'observer_will_01')).toBe(false);
    const executionRoom = createHandTargetRuntime('black', 'execution_01', ['silver_stone']).getRoom();
    const execution = TargetAvailabilityAuthority.buildPublicSnapshot(executionRoom, 'black');
    execution.cardState.prevOpponentTurnDestroyedStonesByPlayer.black = [];
    expect(usable(execution, 'black', 'execution_01')).toBe(false);
    const condemnRoom = createHandTargetRuntime('black', 'condemn_01', ['silver_stone']).getRoom();
    const condemn = TargetAvailabilityAuthority.buildPublicSnapshot(condemnRoom, 'black');
    condemn.cardState.charge.black = 0;
    expect(usable(condemn, 'black', 'condemn_01')).toBe(false);
  });

  test('fully visible local hands ignore a stale projection hint', () => {
    const room = createHandTargetRuntime('black', 'observer_will_01', ['silver_stone']).getRoom();
    room.snapshot.cardState.opponentHandTargetAvailability = { playerKey: 'black', hasTargetableCard: false };
    expect(usable(room.snapshot, 'black', 'observer_will_01')).toBe(true);
    room.snapshot.cardState.hands.white = ['theory_incarnation_01'];
    room.snapshot.cardState.opponentHandTargetAvailability.hasTargetableCard = true;
    expect(usable(room.snapshot, 'black', 'observer_will_01')).toBe(false);
  });
});
