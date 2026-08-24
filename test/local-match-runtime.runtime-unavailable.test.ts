import { createCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';

const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const MatchAuthority = require('../utils/match-authority');
const LocalMatchRuntime = require('../scripts/local-match-runtime');

describe('local match runtime unavailable rejection', () => {
  test('keeps snapshot, version, operation history, and journal unchanged', () => {
    const runtime = LocalMatchRuntime.createRuntime({ seed: 17, roomId: 'runtime-failure' });
    const room = runtime.getRoom();
    room.snapshot.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
    room.snapshot.gameState.board[0][0] = Shared.EMPTY;
    room.snapshot.gameState.currentPlayer = Shared.BLACK;
    room.snapshot.gameState.consecutivePasses = 0;
    room.snapshot.gameState.turnNumber = 3;
    room.snapshot.cardState.hands.black = [];
    room.snapshot.cardState.charge.black = 0;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    const turnIndex = room.snapshot.cardState.turnIndex;
    const before = JSON.stringify(room);
    const original = CardLogic.hasUsableCard;
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    CardLogic.hasUsableCard = () => { throw unavailable; };

    try {
      const result = runtime.applyCommand({
        seatKey: 'black',
        playerKey: 'black',
        actor: 'black',
        actionType: 'pass',
        operationId: 'op_local_runtime_failure_1',
        baseVersion: room.stateVersion,
        turnIndex,
        action: {
          type: 'pass',
          playerKey: 'black',
          turnIndex,
          autoNoActionPass: true
        }
      });

      expect(result).toMatchObject({
        ok: false,
        rejectedReason: 'RUNTIME_UNAVAILABLE',
        stateVersion: room.stateVersion
      });
      expect(JSON.stringify(room)).toBe(before);
    } finally {
      CardLogic.hasUsableCard = original;
    }
  });

  test('AUTO planner query failure cannot become a pass or mutate authority state', () => {
    const runtime = LocalMatchRuntime.createRuntime({ seed: 23, roomId: 'runtime-auto-failure' });
    const room = runtime.getRoom();
    room.networkAutoEnabled = true;
    room.snapshot.cardState.hands.black = [];
    room.snapshot.cardState.charge.black = 0;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    const before = JSON.stringify(room);
    const original = CardLogic.hasUsableCard;
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    CardLogic.hasUsableCard = () => { throw unavailable; };

    try {
      const result = runtime.applyCommand({
        seatKey: 'black',
        playerKey: 'black',
        actor: 'black',
        actionType: 'auto_turn',
        operationId: 'op_local_runtime_auto_failure_1',
        baseVersion: room.stateVersion,
        turnIndex: room.snapshot.cardState.turnIndex,
        action: { type: 'auto_turn' }
      });

      expect(result).toMatchObject({
        ok: false,
        rejectedReason: 'RUNTIME_UNAVAILABLE',
        stateVersion: room.stateVersion
      });
      expect(JSON.stringify(room)).toBe(before);
    } finally {
      CardLogic.hasUsableCard = original;
    }
  });
});
