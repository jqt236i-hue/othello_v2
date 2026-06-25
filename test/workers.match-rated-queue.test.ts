import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__RATED_QUEUE_WORKER_RESULT__';

function runRatedQueueScenario(runnerSource: string) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'rated queue worker runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'rated queue worker runner did not emit result marker');
  }
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runAutoMatchScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  function makeState() {",
    "    const storage = new Map();",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, value),",
    "        delete: async (key) => storage.delete(key),",
    "        setAlarm: async (value) => { storage.set('__alarm__', value); },",
    "        deleteAlarm: async () => { storage.delete('__alarm__'); }",
    "      }",
    "    };",
    "  }",
    "  const roomObjects = new Map();",
    "  let lobby = null;",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (name) => String(name),",
    "      get: (id) => ({",
    "        fetch: async (request) => {",
    "          if (String(id) === '__match_lobby__') return lobby.fetch(request);",
    "          let room = roomObjects.get(String(id));",
    "          if (!room) {",
    "            room = new MatchRoomDurableObject(makeState(), env);",
    "            roomObjects.set(String(id), room);",
    "          }",
    "          return room.fetch(request);",
    "        }",
    "      })",
    "    }",
    "  };",
    "  lobby = new MatchRoomDurableObject(makeState(), env);",
    "  const postJson = async (pathname, body) => {",
    "    const response = await lobby.fetch(new Request('https://lobby' + pathname, {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json' },",
    "      body: JSON.stringify(body || {})",
    "    }));",
    "    return { status: response.status, data: await response.json() };",
    "  };",
    "  const first = await postJson('/api/match/rated/queue', {",
    "    playerId: 'p_worker_black',",
    "    playerName: 'くろ'",
    "  });",
    "  const second = await postJson('/api/match/rated/queue', {",
    "    playerId: 'p_worker_white',",
    "    playerName: 'しろ'",
    "  });",
    "  const firstPoll = await postJson('/api/match/rated/poll', {",
    "    playerId: 'p_worker_black'",
    "  });",
    "  const listResponse = await lobby.fetch(new Request('https://lobby/api/match/list'));",
    "  const list = { status: listResponse.status, data: await listResponse.json() };",
    "  const roomId = second.data && second.data.match && second.data.match.roomId;",
    "  const room = roomObjects.get(String(roomId));",
    "  if (room && typeof room.loadRoom === 'function') await room.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    first,",
    "    second,",
    "    firstPoll,",
    "    list,",
    "    roomMatchType: room && room.room ? room.room.matchType : '',",
    "    roomAutoEnabled: room && room.room ? room.room.networkAutoEnabled === true : null,",
    "    roomBoardConfig: room && room.room ? room.room.roomBoardConfig : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runRatedQueueScenario(runner);
}

describe('MatchRoomDurableObject rated queue', () => {
  test('2人がレート戦キューに入ると8x8固定AUTO無効の部屋へ自動マッチし通常ロビーに出ない', () => {
    const result = runAutoMatchScenario();

    expect(result.first).toEqual(expect.objectContaining({
      status: 200,
      data: expect.objectContaining({
        ok: true,
        status: 'waiting',
        remainingMs: 600000
      })
    }));
    expect(result.second).toEqual(expect.objectContaining({
      status: 200,
      data: expect.objectContaining({
        ok: true,
        status: 'matched',
        seatKey: 'white',
        match: expect.objectContaining({
          roomId: expect.any(String),
          seatKey: 'white',
          payload: expect.objectContaining({
            seatKey: 'white',
            roomName: 'レート戦',
            networkAutoEnabled: false,
            roomBoardConfig: expect.objectContaining({ rows: 8, cols: 8, standard8x8: true }),
            ratedMatch: expect.objectContaining({
              pool: 'card_ranked_v1',
              systemVersion: 1,
              matchId: expect.stringMatching(/^rated_/)
            })
          })
        })
      })
    }));
    expect(result.firstPoll).toEqual(expect.objectContaining({
      status: 200,
      data: expect.objectContaining({
        ok: true,
        status: 'matched',
        seatKey: 'black',
        roomId: result.second.data.roomId,
        match: expect.objectContaining({
          payload: expect.objectContaining({
            seatKey: 'black',
            networkAutoEnabled: false,
            roomBoardConfig: expect.objectContaining({ rows: 8, cols: 8, standard8x8: true }),
            ratedMatch: expect.objectContaining({
              pool: 'card_ranked_v1',
              systemVersion: 1,
              matchId: expect.stringMatching(/^rated_/)
            })
          })
        })
      })
    }));
    expect(result.list).toEqual(expect.objectContaining({
      status: 200,
      data: expect.objectContaining({ ok: true, rooms: [] })
    }));
    expect(result.roomMatchType).toBe('rated');
    expect(result.roomAutoEnabled).toBe(false);
    expect(result.roomBoardConfig).toEqual(expect.objectContaining({ rows: 8, cols: 8, standard8x8: true }));
  });
});
