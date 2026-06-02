import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource: string) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker observer PRNG scenario failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runWorkerObserverPrngStateScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const Shared = fromRoot('shared-constants.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const prng = SeededPRNG.createPRNG(123);",
    "  const gameState = Core.createGameState();",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.lastTurnStartedFor = null;",
    "  cardState.markers.push({ id: 'observer_white_44', kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'OBSERVER', remainingOwnerTurns: 5 } });",
    "  cardState.prngState = prng.getState();",
    "  const callsBefore = cardState.prngState.calls;",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'OBS2',",
    "    playerName: 'くろ',",
    "    seed: 123,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const legalMoves = Core.getLegalMoves(gameState, Shared.BLACK, CardLogic.getCardContext(cardState, gameState, 'black'));",
    "  const move = legalMoves[0];",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_observer_prng_state_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: move.row, col: move.col },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedCardState = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot.cardState : null;",
    "  const observerMarker = Array.isArray(storedCardState && storedCardState.markers) ? storedCardState.markers.find((marker) => marker && marker.id === 'observer_white_44') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    callsBefore,",
    "    callsAfter: storedCardState && storedCardState.prngState ? storedCardState.prngState.calls : null,",
    "    chargeWhite: storedCardState && storedCardState.charge ? storedCardState.charge.white : null,",
    "    remainingOwnerTurns: observerMarker && observerMarker.data ? observerMarker.data.remainingOwnerTurns : null,",
    "    payload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('worker observer PRNG persistence', () => {
  test('post-action turn-start observer advances stored prngState', () => {
    const result = runWorkerObserverPrngStateScenario();

    expect(result.status).toBe(200);
    expect(result.callsAfter).toBeGreaterThan(result.callsBefore);
    expect(result.remainingOwnerTurns).toBe(4);
  });
});
