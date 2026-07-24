import {
  NETWORK_AUTO_TURN_ACTION,
  isMatchAutoTurnPublishBody,
  resolveMatchAutoTurnPublishBody
} from '../utils/match-auto-command';

describe('match auto command authority', () => {
  test('leaves ordinary publish commands unchanged', () => {
    const body = {
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3 }
    };

    expect(resolveMatchAutoTurnPublishBody({ body })).toEqual({
      ok: true,
      requested: false,
      body
    });
  });

  test('rewrites an auto_turn request with the canonical planned command', () => {
    const planner = {
      planCanonicalCpuNetworkCommand: jest.fn().mockReturnValue({
        actionType: 'use_card',
        action: {
          type: 'use_card',
          playerKey: 'black',
          useCardId: 'hard_01',
          useCardOwnerKey: 'black'
        }
      })
    };
    const snapshot = {
      gameState: { currentPlayer: 1 },
      cardState: { turnIndex: 12 }
    };
    const body = {
      actionType: NETWORK_AUTO_TURN_ACTION,
      actor: 'black',
      action: {
        type: NETWORK_AUTO_TURN_ACTION,
        preferredActionType: 'pass',
        preferredAction: {
          type: 'pass',
          playerKey: 'black',
          autoNoActionPass: true
        }
      }
    };

    expect(isMatchAutoTurnPublishBody(body)).toBe(true);
    expect(resolveMatchAutoTurnPublishBody({
      body,
      snapshot,
      playerKey: 'black',
      CpuNetworkCommandPlanner: planner
    })).toEqual(expect.objectContaining({
      ok: true,
      requested: true,
      actionType: 'use_card',
      body: expect.objectContaining({
        actionType: 'use_card',
        actor: 'black',
        playerKey: 'black',
        turnIndex: 12,
        action: expect.objectContaining({
          type: 'use_card',
          useCardId: 'hard_01'
        })
      })
    }));
    expect(planner.planCanonicalCpuNetworkCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot,
        playerKey: 'black',
        preferredActionType: 'pass',
        preferredAction: expect.objectContaining({ type: 'pass' })
      })
    );
  });

  test('fails closed when the canonical planner is unavailable', () => {
    expect(resolveMatchAutoTurnPublishBody({
      body: {
        actionType: NETWORK_AUTO_TURN_ACTION,
        action: { type: NETWORK_AUTO_TURN_ACTION }
      },
      snapshot: {},
      playerKey: 'white'
    })).toEqual({
      ok: false,
      requested: true,
      rejectedReason: 'AUTO_COMMAND_PLANNER_UNAVAILABLE'
    });
  });

  test('plans for the canonical turn owner while preserving the controller actor', () => {
    const planner = {
      planCanonicalCpuNetworkCommand: jest.fn().mockReturnValue({
        actionType: 'place',
        action: { type: 'place', playerKey: 'white', row: 4, col: 5 }
      })
    };

    const result = resolveMatchAutoTurnPublishBody({
      body: {
        actionType: NETWORK_AUTO_TURN_ACTION,
        actor: 'black',
        playerKey: 'black',
        action: {
          type: NETWORK_AUTO_TURN_ACTION,
          preferredActionType: 'place',
          preferredAction: { type: 'place', playerKey: 'black', row: 2, col: 3 }
        }
      },
      snapshot: {
        gameState: { currentPlayer: -1 },
        cardState: { turnIndex: 20 }
      },
      playerKey: 'black',
      planningPlayerKey: 'white',
      CpuNetworkCommandPlanner: planner
    });

    expect(planner.planCanonicalCpuNetworkCommand).toHaveBeenCalledWith(
      expect.objectContaining({ playerKey: 'white' })
    );
    expect(result.body).toEqual(expect.objectContaining({
      actor: 'black',
      playerKey: 'black',
      action: expect.objectContaining({ playerKey: 'white', row: 4, col: 5 })
    }));
  });
});
