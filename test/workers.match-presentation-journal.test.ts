import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource: string) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'presentation journal runner failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
}

function runAcceptedPublishJournalScenario() {
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
    "  const storage = new Map();",
    "  const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key) } };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(19);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'JRN1',",
    "    playerName: 'くろ',",
    "    seed: 19,",
    "    snapshot: {",
    "      gameState,",
    "      cardState",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_journal_place_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 1,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }",
    "  });",
    "  const publishPayload = await publishResponse.json();",
    "  const replayResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_journal_place_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 1,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }",
    "  });",
    "  const replayPayload = await replayResponse.json();",
    "  const stateResponse = await durableObject.fetch(new Request(`https://room/api/match/state?roomId=JRN1&seatKey=black&seatToken=${createPayload.seatToken}`));",
    "  const statePayload = await stateResponse.json();",
    "  const recoveryResponse = await durableObject.fetch(new Request(`https://room/api/match/presentation-journal?roomId=JRN1&seatKey=black&seatToken=${createPayload.seatToken}&afterVisualSeq=0`));",
    "  const recoveryPayload = await recoveryResponse.json();",
    "  process.stdout.write(JSON.stringify({",
    "    createPayload,",
    "    publishStatus: publishResponse.status,",
    "    publishPayload,",
    "    replayStatus: replayResponse.status,",
    "    replayPayload,",
    "    stateStatus: stateResponse.status,",
    "    statePayload,",
    "    recoveryStatus: recoveryResponse.status,",
    "    recoveryPayload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('worker presentation journal', () => {
  test('accepted publish exposes one presentation frame and advances visual cursor', () => {
    const result = runAcceptedPublishJournalScenario();
    expect(result.publishStatus).toBe(200);
    expect(result.publishPayload).toMatchObject({
      ok: true,
      presentationCursor: { visualSeq: 1, stateVersion: result.publishPayload.stateVersion }
    });
    expect(result.publishPayload.presentationFrames).toHaveLength(1);
    expect(result.publishPayload.presentationFrames[0]).toMatchObject({
      visualSeq: 1,
      stateVersionFrom: result.createPayload.stateVersion,
      stateVersionTo: result.publishPayload.stateVersion,
      operationId: 'op_journal_place_1',
      actorSeatKey: 'black',
      actionType: 'place'
    });
    expect(result.publishPayload.presentationFrames[0].snapshotAfter).toBeTruthy();
    expect(result.stateStatus).toBe(200);
    expect(result.statePayload.presentationCursor).toMatchObject({ visualSeq: 1, stateVersion: result.publishPayload.stateVersion });
    expect(result.statePayload.presentationFrames).toHaveLength(1);
    expect(result.statePayload.presentationFrames[0].playbackDigest).toBe(result.publishPayload.presentationFrames[0].playbackDigest);
    expect(result.statePayload.presentationFrames[0].playbackEvents).toEqual(result.publishPayload.playbackEvents);
  });

  test('idempotent replay response returns the original presentation frame bundle', () => {
    const result = runAcceptedPublishJournalScenario();
    expect(result.replayStatus).toBe(200);
    expect(result.replayPayload).toMatchObject({
      ok: true,
      idempotentReplay: true,
      stateVersion: result.publishPayload.stateVersion,
      presentationCursor: { visualSeq: 1, stateVersion: result.publishPayload.stateVersion }
    });
    expect(result.replayPayload.playbackEvents).toEqual(result.publishPayload.playbackEvents);
    expect(result.replayPayload.playbackDigest).toBe(result.publishPayload.playbackDigest);
    expect(result.replayPayload.presentationFrames).toHaveLength(1);
    expect(result.replayPayload.presentationFrames[0].playbackDigest).toBe(result.publishPayload.presentationFrames[0].playbackDigest);
  });

  test('presentation journal recovery returns base snapshot and frames after cursor', () => {
    const result = runAcceptedPublishJournalScenario();
    const recoveryPayload = result.recoveryPayload;
    expect(result.recoveryStatus).toBe(200);
    expect(recoveryPayload).toMatchObject({
      ok: true,
      roomId: 'JRN1',
      baseVisualSeq: 0,
      presentationCursor: { visualSeq: 1, stateVersion: result.publishPayload.stateVersion }
    });
    expect(recoveryPayload.baseSnapshot.stateVersion).toBe(result.createPayload.stateVersion);
    expect(recoveryPayload.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([1]);
    expect(recoveryPayload.presentationFrames[0].snapshotAfter.stateVersion).toBe(result.publishPayload.stateVersion);
  });
});
