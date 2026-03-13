const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'turn timer runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runJoinTimerScenario() {
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
    "",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'TMR1',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 0",
    "      },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    create: {",
    "      turnTimer: createPayload.turnTimer,",
    "      serverTime: createPayload.serverTime",
    "    },",
    "    join: {",
    "      turnTimer: joinPayload.turnTimer,",
    "      serverTime: joinPayload.serverTime",
    "    }",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTimeoutPassScenario() {
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
    "",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'TMR2',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 0",
    "      },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
    "  await joinResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "  durableObject.room.turnTimer.active = true;",
    "  durableObject.room.turnTimer.turnSeatKey = 'black';",
    "  durableObject.room.turnTimer.turnStartedAt = Date.now() - 300000;",
    "  durableObject.room.turnTimer.turnDeadlineAt = Date.now() - 10;",
    "  await durableObject.saveRoom();",
    "",
    "  const stateResponse = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=black&seatToken=${createPayload.seatToken}`));",
    "  const statePayload = await stateResponse.json();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    statePayload,",
    "    status: stateResponse.status",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker turn timer', () => {
  test('2人そろうと120秒手番タイマーが有効化される', () => {
    const result = runJoinTimerScenario();

    expect(result.create.turnTimer.active).toBe(false);

    expect(result.join.turnTimer.active).toBe(true);
    expect(result.join.turnTimer.limitSeconds).toBe(120);
    expect(result.join.turnTimer.turnSeatKey).toBe('black');
    expect(Number(result.join.turnTimer.turnDeadlineAt)).toBeGreaterThan(Number(result.join.serverTime));
  });

  test('手番期限切れ時はサーバー側で自動的に手番が進む', () => {
    const result = runTimeoutPassScenario();

    expect(result.status).toBe(200);
    expect(result.statePayload && result.statePayload.ok).toBe(true);
    expect(result.statePayload.stateVersion).toBe(1);
    expect(result.statePayload.snapshot.gameState.currentPlayer).toBe(-1);
    expect(result.statePayload.snapshot.gameState.consecutivePasses).toBe(1);

    const timer = result.statePayload.turnTimer;
    expect(timer.active).toBe(true);
    expect(timer.limitSeconds).toBe(120);
    expect(timer.turnSeatKey).toBe('white');
    expect(Number(timer.turnDeadlineAt)).toBeGreaterThan(Number(result.statePayload.serverTime));
  });
});
