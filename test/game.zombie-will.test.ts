import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as SpecialStoneRegistry from '../shared/special-stone-registry';
import * as EvasionStatus from '../shared/evasion-status';
import * as ZombieWill from '../game/logic/cards/zombie_will';

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createState(randomValue = 0, board, cardStateOverrides = {}) {
  const prng = createPrng(randomValue);
  const cardState = Object.assign({
    markers: [],
    _nextMarkerId: 1,
    _nextCreatedSeq: 1,
    presentationEvents: []
  }, cardStateOverrides);
  const defaultBoard = board || [
    [0, 0, 0, 0],
    [0, 1, -1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const gameState = { board: defaultBoard };
  return { cardState, gameState, prng };
}

describe('ZOMBIE special stone registry', () => {
  test('ZOMBIE_WILL maps to a true special stone body', () => {
    expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard('ZOMBIE_WILL')).toBe('ZOMBIE');
    expect(SpecialStoneRegistry.getSpecialStoneDisplayName('ZOMBIE')).toBe('屍石');
    expect(SpecialStoneRegistry.countsAsSpecialStone('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('ZOMBIE')).toBe('true_special_stone');
  });

  test('ZOMBIE has one flip and one destroy evasion by default', () => {
    expect(EvasionStatus.getFlipEvadeDefault('ZOMBIE')).toBe(1);
    expect(EvasionStatus.getDestroyEvadeDefault('ZOMBIE')).toBe(1);
  });

  test('ZOMBIE markers do not get pruned when both evasions are depleted', () => {
    expect(EvasionStatus.shouldPruneEvasionMarker({ type: 'ZOMBIE', flipEvadeRemaining: 0, destroyEvadeRemaining: 0 })).toBe(false);
  });
});

describe('ZOMBIE infection logic', () => {
  test('third owner turn start infects one adjacent enemy normal stone', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-1',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
      }],
      _nextMarkerId: 2,
      _nextCreatedSeq: 2
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result.infected).toEqual([{ row: 1, col: 2 }]);
    expect(gameState.board[1][2]).toBe(Shared.BLACK);
    const infectedMarker = cardState.markers.find((m) => m.row === 1 && m.col === 2 && m.owner === 'black');
    expect(infectedMarker).toBeTruthy();
    expect(infectedMarker.data.type).toBe('ZOMBIE');
    expect(infectedMarker.data.turnsUntilInfection).toBe(3);
    expect(infectedMarker.data.flipEvadeRemaining).toBe(1);
    expect(infectedMarker.data.destroyEvadeRemaining).toBe(1);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(3);
  });

  test('non-triggering owner turn only decrements infection counter', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-2',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 3, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
      }],
      _nextMarkerId: 2,
      _nextCreatedSeq: 2
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(Shared.WHITE);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(2);
  });

  test('infection ignores stones protected by GUARD status markers', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [
        {
          id: 'zombie-3',
          kind: 'specialStone',
          row: 1,
          col: 1,
          owner: 'black',
          createdSeq: 1,
          data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
        },
        {
          id: 'guard-1',
          kind: 'specialStone',
          row: 1,
          col: 2,
          owner: 'white',
          createdSeq: 2,
          data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }
      ],
      _nextMarkerId: 3,
      _nextCreatedSeq: 3
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(Shared.WHITE);
  });

  test('createZombieMarkerData produces marker data with type ZOMBIE and the expected evade counts', () => {
    const data = ZombieWill.createZombieMarkerData('white');
    expect(data.type).toBe('ZOMBIE');
    expect(data.ownerColor).toBe(Shared.WHITE);
    expect(data.turnsUntilInfection).toBe(ZombieWill.ZOMBIE_INFECTION_INTERVAL);
    expect(data.flipEvadeRemaining).toBe(1);
    expect(data.destroyEvadeRemaining).toBe(1);
  });
});