const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker leave scenario failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker leave contract', () => {
  test('leave rotates seat token, rejects old token, and closes leaving stream', () => {
    const runner = [
      "(async () => {",
      "  const modulePath = process.argv[1];",
      "  const { MatchRoomDurableObject } = await import(modulePath);",
      "  const storage = new Map();",
      "  const state = {",
      "    storage: {",
      "      get: async (key) => storage.get(key),",
      "      put: async (key, value) => storage.set(key, value),",
      "      delete: async (key) => storage.delete(key)",
      "    }",
      "  };",
      "  const durableObject = new MatchRoomDurableObject(state);",
      "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
      "  board[3][3] = -1;",
      "  board[3][4] = 1;",
      "  board[4][3] = 1;",
      "  board[4][4] = -1;",
      "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
      "    roomId: 'LEAVE1',",
      "    playerName: 'くろ',",
      "    seed: 1,",
      "    snapshot: {",
      "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 },",
      "      cardState: {}",
      "    }",
      "  });",
      "  const createPayload = await createResponse.json();",
      "  const joinWhiteResponse = await durableObject.handleJoin({ roomId: 'LEAVE1', seatKey: 'white', playerName: 'しろ' });",
      "  const joinWhitePayload = await joinWhiteResponse.json();",
      "  const streamResponse = await durableObject.handleStream(new Request(`https://room/api/match/stream?seatKey=black&seatToken=${createPayload.seatToken}`));",
      "  const reader = streamResponse.body.getReader();",
      "  await Promise.race([",
      "    reader.read(),",
      "    new Promise((_, reject) => setTimeout(() => reject(new Error('STREAM_READ_TIMEOUT')), 1000))",
      "  ]);",
      "  const leaveResponse = await durableObject.handleLeave({ seatKey: 'black', seatToken: createPayload.seatToken });",
      "  const leavePayload = await leaveResponse.json();",
      "  const postLeaveRead = await Promise.race([",
      "    reader.read(),",
      "    new Promise((_, reject) => setTimeout(() => reject(new Error('STREAM_CLOSE_TIMEOUT')), 1000))",
      "  ]);",
      "  const staleStateResponse = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=black&seatToken=${createPayload.seatToken}`));",
      "  const staleStatePayload = await staleStateResponse.json();",
      "  const rejoinBlackResponse = await durableObject.handleJoin({ roomId: 'LEAVE1', seatKey: 'black', playerName: 'くろ2' });",
      "  const rejoinBlackPayload = await rejoinBlackResponse.json();",
      "  process.stdout.write(JSON.stringify({",
      "    leaveStatus: leaveResponse.status,",
      "    leaveOk: leavePayload.ok === true,",
      "    joinedWhite: joinWhitePayload.ok === true,",
      "    staleStateStatus: staleStateResponse.status,",
      "    staleStateReason: staleStatePayload.reason,",
      "    oldSeatToken: createPayload.seatToken,",
      "    newSeatToken: rejoinBlackPayload.seatToken,",
      "    streamClosed: postLeaveRead.done === true",
      "  }));",
      "})().catch((error) => {",
      "  console.error(error && error.stack ? error.stack : String(error));",
      "  process.exit(1);",
      "});"
    ].join('\n');

    const result = runScenario(runner);

    expect(result.leaveStatus).toBe(200);
    expect(result.leaveOk).toBe(true);
    expect(result.joinedWhite).toBe(true);
    expect(result.staleStateStatus).toBe(403);
    expect(result.staleStateReason).toBe('SEAT_TOKEN_MISMATCH');
    expect(result.newSeatToken).not.toBe(result.oldSeatToken);
    expect(result.streamClosed).toBe(true);
  });

  test('leave rejects missing and stale seat token without clearing the seat', () => {
    const runner = [
      "(async () => {",
      "  const modulePath = process.argv[1];",
      "  const { MatchRoomDurableObject } = await import(modulePath);",
      "  const storage = new Map();",
      "  const state = {",
      "    storage: {",
      "      get: async (key) => storage.get(key),",
      "      put: async (key, value) => storage.set(key, value),",
      "      delete: async (key) => storage.delete(key)",
      "    }",
      "  };",
      "  const durableObject = new MatchRoomDurableObject(state);",
      "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
      "  board[3][3] = -1;",
      "  board[3][4] = 1;",
      "  board[4][3] = 1;",
      "  board[4][4] = -1;",
      "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
      "    roomId: 'LEAVE2',",
      "    playerName: 'くろ',",
      "    seed: 1,",
      "    snapshot: {",
      "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 },",
      "      cardState: {}",
      "    }",
      "  });",
      "  const createPayload = await createResponse.json();",
      "  const missingLeaveResponse = await durableObject.handleLeave({ seatKey: 'black', seatToken: '' });",
      "  const missingLeavePayload = await missingLeaveResponse.json();",
      "  const staleLeaveResponse = await durableObject.handleLeave({ seatKey: 'black', seatToken: 'stale-token' });",
      "  const staleLeavePayload = await staleLeaveResponse.json();",
      "  const stateResponse = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=black&seatToken=${createPayload.seatToken}`));",
      "  const statePayload = await stateResponse.json();",
      "  await durableObject.loadRoom();",
      "  process.stdout.write(JSON.stringify({",
      "    missingLeaveStatus: missingLeaveResponse.status,",
      "    missingLeaveReason: missingLeavePayload.reason || null,",
      "    staleLeaveStatus: staleLeaveResponse.status,",
      "    staleLeaveReason: staleLeavePayload.reason || null,",
      "    stateStatus: stateResponse.status,",
      "    stateOk: statePayload.ok === true,",
      "    seatStillJoined: !!(durableObject.room && durableObject.room.seats && durableObject.room.seats.black),",
      "    seatTokenUnchanged: !!(durableObject.room && durableObject.room.seatTokens && durableObject.room.seatTokens.black === createPayload.seatToken)",
      "  }));",
      "})().catch((error) => {",
      "  console.error(error && error.stack ? error.stack : String(error));",
      "  process.exit(1);",
      "});"
    ].join('\n');

    const result = runScenario(runner);

    expect(result.missingLeaveStatus).toBe(403);
    expect(result.missingLeaveReason).toBe('SEAT_TOKEN_REQUIRED');
    expect(result.staleLeaveStatus).toBe(403);
    expect(result.staleLeaveReason).toBe('SEAT_TOKEN_MISMATCH');
    expect(result.stateStatus).toBe(200);
    expect(result.stateOk).toBe(true);
    expect(result.seatStillJoined).toBe(true);
    expect(result.seatTokenUnchanged).toBe(true);
  });
});
