import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource: string): any {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'spectator scenario failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker spectator API', () => {
  test('spectate admits four spectators and rejects the fifth', () => {
    const result = runScenario([
      "(async () => {",
      "  const modulePath = process.argv[1];",
      "  const { MatchRoomDurableObject } = await import(modulePath);",
      "  const storage = new Map();",
      "  const durableObject = new MatchRoomDurableObject({",
      "    storage: {",
      "      get: async (key) => storage.get(key),",
      "      put: async (key, value) => storage.set(key, value),",
      "      delete: async (key) => storage.delete(key)",
      "    }",
      "  });",
      "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
      "    roomId: 'SPC',",
      "    playerName: '黒',",
      "    snapshot: {",
      "      gameState: { board: [[0]], currentPlayer: 1 },",
      "      cardState: { hands: { black: [], white: [] } }",
      "    }",
      "  });",
      "  const spectatorPayloads = [];",
      "  for (let index = 0; index < 4; index += 1) {",
      "    const response = await durableObject.handleSpectate({",
      "      roomId: 'SPC',",
      "      spectatorName: `観戦${index + 1}`",
      "    });",
      "    spectatorPayloads.push({ status: response.status, payload: await response.json() });",
      "  }",
      "  const fullResponse = await durableObject.handleSpectate({ roomId: 'SPC', spectatorName: '満員後' });",
      "  console.log(JSON.stringify({",
      "    createStatus: createResponse.status,",
      "    spectatorPayloads,",
      "    full: { status: fullResponse.status, payload: await fullResponse.json() }",
      "  }));",
      "})().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });"
    ].join('\n'));

    expect(result.createStatus).toBe(200);
    expect(result.spectatorPayloads).toHaveLength(4);
    result.spectatorPayloads.forEach((entry: any, index: number) => {
      expect(entry.status).toBe(200);
      expect(entry.payload).toEqual(expect.objectContaining({
        ok: true,
        viewerRole: 'spectator',
        spectatorId: expect.stringMatching(/^spec_/),
        spectatorToken: expect.any(String),
        spectatorCount: index + 1,
        maxSpectators: 4,
        snapshot: expect.any(Object)
      }));
    });
    expect(result.full).toEqual({
      status: 409,
      payload: expect.objectContaining({
        ok: false,
        reason: 'SPECTATOR_FULL'
      })
    });
  });

  test('spectator token cannot publish', () => {
    const result = runScenario([
      "(async () => {",
      "  const modulePath = process.argv[1];",
      "  const { MatchRoomDurableObject } = await import(modulePath);",
      "  const storage = new Map();",
      "  const durableObject = new MatchRoomDurableObject({",
      "    storage: {",
      "      get: async (key) => storage.get(key),",
      "      put: async (key, value) => storage.set(key, value),",
      "      delete: async (key) => storage.delete(key)",
      "    }",
      "  });",
      "  await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
      "    roomId: 'SPP',",
      "    playerName: '黒',",
      "    snapshot: {",
      "      gameState: { board: [[0]], currentPlayer: 1 },",
      "      cardState: { hands: { black: [], white: [] } }",
      "    }",
      "  });",
      "  const spectatePayload = await (await durableObject.handleSpectate({ roomId: 'SPP', spectatorName: '観戦' })).json();",
      "  const publishResponse = await durableObject.handlePublish({",
      "    roomId: 'SPP',",
      "    viewerRole: 'spectator',",
      "    spectatorId: spectatePayload.spectatorId,",
      "    spectatorToken: spectatePayload.spectatorToken,",
      "    action: { type: 'place', row: 0, col: 0 }",
      "  });",
      "  console.log(JSON.stringify({ status: publishResponse.status, payload: await publishResponse.json() }));",
      "})().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });"
    ].join('\n'));

    expect(result.status).toBe(403);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      rejectedReason: expect.stringMatching(/TOKEN|READ_ONLY|SEAT/)
    }));
    expect(result.payload.publishMeta).toEqual(expect.objectContaining({
      kind: 'rejected',
      rejectedReason: expect.stringMatching(/TOKEN|READ_ONLY|SEAT/)
    }));
  });
});
