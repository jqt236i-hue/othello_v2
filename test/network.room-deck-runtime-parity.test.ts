import * as http from 'http';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import * as DeckSpecHelpers from '../shared/deck-spec.js';
import * as DeckCodecModule from '../shared/deck-codec.js';
import {
  MATCH_ROOM_DECK_PRIVATE_FIELDS,
  MATCH_ROOM_DECK_RAW_PROJECTION_FIXTURES
} from './helpers/match-room-deck-contract-fixtures';

const {
  createLocalMatchServer,
  patchRoomSnapshotForTests,
  resetRoomsForTests
} = require('../scripts/local-match-server');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const WORKER_RESULT_MARKER = '__ROOM_DECK_PARITY_RESULT__';

type JsonResponse = { status: number; data: any };

function requestJson(port: number, method: string, requestPath: string, payload?: unknown): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error(`room-deck characterization request timed out: ${method} ${requestPath}`));
    });
    if (typeof payload !== 'undefined') req.write(JSON.stringify(payload));
    req.end();
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      resolve(address && typeof address === 'object' ? address.port : 0);
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  });
}

function inventorySizes(cardState: any) {
  const count = (seatKey: 'black' | 'white') => {
    const deck = cardState && cardState.decks && Array.isArray(cardState.decks[seatKey])
      ? cardState.decks[seatKey]
      : [];
    const hand = cardState && cardState.hands && Array.isArray(cardState.hands[seatKey])
      ? cardState.hands[seatKey]
      : [];
    return deck.length + hand.length;
  };
  return { black: count('black'), white: count('white') };
}

async function collectLocalCharacterization() {
  const server = createLocalMatchServer();
  const port = await listen(server);
  const zeroDeckCode = DeckCodecModule.encodeDeckSpec(
    DeckSpecHelpers.createDeckSpecFromCardIds([], { requireFullDeck: false })
  );

  try {
    const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
    const joined = await requestJson(port, 'POST', '/api/match/join', {
      roomId: created.data.roomId,
      playerName: 'しろ'
    });
    expect(created.status).toBe(200);
    expect(joined.status).toBe(200);

    const rawProjections = [] as Array<{ name: string; roomDeck: unknown }>;
    for (const fixture of MATCH_ROOM_DECK_RAW_PROJECTION_FIXTURES) {
      const patched = patchRoomSnapshotForTests(created.data.roomId, (room) => {
        room.roomDeck = fixture.roomDeck === null
          ? null
          : JSON.parse(JSON.stringify(fixture.roomDeck));
        room.turnTimer = null;
        room.snapshot = Object.assign({}, room.snapshot, {
          cardState: Object.assign({}, room.snapshot && room.snapshot.cardState, {
            initialDeckSizeByPlayer: fixture.initialDeckSizeByPlayer,
            initialDeckSize: fixture.initialDeckSize
          })
        });
      });
      expect(patched).toBe(true);
      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(created.data.roomId)}&seatKey=black&seatToken=${encodeURIComponent(created.data.seatToken)}`
      );
      expect(state.status).toBe(200);
      rawProjections.push({ name: fixture.name, roomDeck: state.data.roomDeck });
    }

    const zeroCreated = await requestJson(port, 'POST', '/api/match/create', {
      playerName: 'zero-black',
      deckCode: zeroDeckCode
    });
    const zeroJoined = await requestJson(port, 'POST', '/api/match/join', {
      roomId: zeroCreated.data.roomId,
      playerName: 'default-white'
    });
    const zeroState = await requestJson(
      port,
      'GET',
      `/api/match/state?roomId=${encodeURIComponent(zeroCreated.data.roomId)}&seatKey=black&seatToken=${encodeURIComponent(zeroCreated.data.seatToken)}`
    );
    let zeroInternalCardState = null;
    expect(patchRoomSnapshotForTests(zeroCreated.data.roomId, (room) => {
      zeroInternalCardState = JSON.parse(JSON.stringify(room.snapshot.cardState));
    })).toBe(true);

    const emptyCreated = await requestJson(port, 'POST', '/api/match/create', { playerName: 'empty-black' });
    const emptyJoined = await requestJson(port, 'POST', '/api/match/join', {
      roomId: emptyCreated.data.roomId,
      playerName: 'empty-white'
    });
    expect(patchRoomSnapshotForTests(emptyCreated.data.roomId, (room) => {
      room.initialDeckCardIdsByPlayer = { black: [], white: [' ', ''] };
      room.initialDeckSpec = null;
      room.initialDeckSpecByPlayer = null;
      room.roomDeck = null;
      room.stateVersion = 5;
      room.snapshot = {
        gameState: {
          board: Array.from({ length: 8 }, () => Array(8).fill(1)),
          currentPlayer: 1,
          consecutivePasses: 0,
          turnNumber: 60
        },
        cardState: {}
      };
    })).toBe(true);
    const emptyReset = await requestJson(port, 'POST', '/api/match/publish', {
      roomId: emptyCreated.data.roomId,
      seatKey: 'white',
      playerKey: 'white',
      seatToken: emptyJoined.data.seatToken,
      operationId: 'local-empty-array-characterization',
      baseVersion: 5,
      actionType: 'reset_game',
      snapshot: {
        gameState: {
          board: Array.from({ length: 8 }, () => Array(8).fill(-1)),
          currentPlayer: 1,
          consecutivePasses: 0,
          turnNumber: 0
        },
        cardState: {}
      }
    });
    let emptyInternalCardState = null;
    expect(patchRoomSnapshotForTests(emptyCreated.data.roomId, (room) => {
      emptyInternalCardState = JSON.parse(JSON.stringify(room.snapshot.cardState));
    })).toBe(true);

    return {
      rawProjections,
      zeroDeckCode,
      zero: {
        createStatus: zeroCreated.status,
        joinStatus: zeroJoined.status,
        stateStatus: zeroState.status,
        createRoomDeck: zeroCreated.data.roomDeck,
        joinRoomDeck: zeroJoined.data.roomDeck,
        stateRoomDeck: zeroState.data.roomDeck,
        initialDeckSizeByPlayer: zeroInternalCardState.initialDeckSizeByPlayer,
        inventorySizes: inventorySizes(zeroInternalCardState),
        publicPayloads: [zeroCreated.data, zeroJoined.data, zeroState.data]
      },
      emptyArrays: {
        resetStatus: emptyReset.status,
        initialDeckSizeByPlayer: emptyInternalCardState.initialDeckSizeByPlayer,
        inventorySizes: inventorySizes(emptyInternalCardState)
      }
    };
  } finally {
    resetRoomsForTests();
    await closeServer(server);
  }
}

function collectWorkerCharacterization() {
  const runner = String.raw`
    (async () => {
      const modulePath = process.argv[1];
      const fixtures = JSON.parse(process.argv[2]);
      const workerModule = await import(modulePath);
      const worker = workerModule.default;
      const { MatchRoomDurableObject } = workerModule;
      const DeckSpecHelpers = require('./shared/deck-spec');
      const DeckCodecModule = require('./shared/deck-codec');
      const zeroDeckCode = DeckCodecModule.encodeDeckSpec(
        DeckSpecHelpers.createDeckSpecFromCardIds([], { requireFullDeck: false })
      );

      function createStateStore() {
        const storage = new Map();
        return {
          storage: {
            get: async (key) => storage.get(key),
            put: async (key, value) => storage.set(key, value),
            delete: async (key) => storage.delete(key)
          }
        };
      }

      const rooms = new Map();
      const env = {
        MATCH_ROOM: {
          idFromName: (roomId) => roomId,
          get: (roomId) => {
            if (!rooms.has(roomId)) rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));
            return { fetch: (request) => rooms.get(roomId).fetch(request) };
          }
        }
      };

      async function request(pathname, method = 'GET', body) {
        const response = await worker.fetch(new Request('https://worker' + pathname, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: typeof body === 'undefined' ? undefined : JSON.stringify(body)
        }), env);
        return { status: response.status, data: await response.json() };
      }

      function inventorySizes(cardState) {
        const count = (seatKey) => {
          const deck = cardState && cardState.decks && Array.isArray(cardState.decks[seatKey]) ? cardState.decks[seatKey] : [];
          const hand = cardState && cardState.hands && Array.isArray(cardState.hands[seatKey]) ? cardState.hands[seatKey] : [];
          return deck.length + hand.length;
        };
        return { black: count('black'), white: count('white') };
      }

      const created = await request('/api/match/create', 'POST', { playerName: 'くろ' });
      const joined = await request('/api/match/join', 'POST', { roomId: created.data.roomId, playerName: 'しろ' });
      const room = rooms.get(created.data.roomId);
      await room.loadRoom();
      const rawProjections = [];
      for (const fixture of fixtures) {
        room.room.roomDeck = fixture.roomDeck === null ? null : JSON.parse(JSON.stringify(fixture.roomDeck));
        room.room.turnTimer = null;
        room.room.snapshot = Object.assign({}, room.room.snapshot, {
          cardState: Object.assign({}, room.room.snapshot && room.room.snapshot.cardState, {
            initialDeckSizeByPlayer: fixture.initialDeckSizeByPlayer,
            initialDeckSize: fixture.initialDeckSize
          })
        });
        await room.saveRoom();
        const state = await request(
          '/api/match/state?roomId=' + encodeURIComponent(created.data.roomId)
            + '&seatKey=black&seatToken=' + encodeURIComponent(created.data.seatToken)
        );
        rawProjections.push({ name: fixture.name, roomDeck: state.data.roomDeck });
      }

      const zeroCreated = await request('/api/match/create', 'POST', { playerName: 'zero-black', deckCode: zeroDeckCode });
      const zeroJoined = await request('/api/match/join', 'POST', { roomId: zeroCreated.data.roomId, playerName: 'default-white' });
      const zeroState = await request(
        '/api/match/state?roomId=' + encodeURIComponent(zeroCreated.data.roomId)
          + '&seatKey=black&seatToken=' + encodeURIComponent(zeroCreated.data.seatToken)
      );
      const zeroRoom = rooms.get(zeroCreated.data.roomId);
      await zeroRoom.loadRoom();
      const zeroInternalCardState = JSON.parse(JSON.stringify(zeroRoom.room.snapshot.cardState));

      const emptyCreated = await request('/api/match/create', 'POST', { playerName: 'empty-black' });
      const emptyJoined = await request('/api/match/join', 'POST', { roomId: emptyCreated.data.roomId, playerName: 'empty-white' });
      const emptyRoom = rooms.get(emptyCreated.data.roomId);
      await emptyRoom.loadRoom();
      emptyRoom.room.initialDeckCardIdsByPlayer = { black: [], white: [' ', ''] };
      emptyRoom.room.initialDeckSpec = null;
      emptyRoom.room.initialDeckSpecByPlayer = null;
      emptyRoom.room.roomDeck = null;
      emptyRoom.room.stateVersion = 5;
      emptyRoom.room.snapshot = {
        gameState: {
          board: Array.from({ length: 8 }, () => Array(8).fill(1)),
          currentPlayer: 1,
          consecutivePasses: 0,
          turnNumber: 60
        },
        cardState: {}
      };
      await emptyRoom.saveRoom();
      const emptyReset = await request('/api/match/publish', 'POST', {
        roomId: emptyCreated.data.roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: emptyJoined.data.seatToken,
        operationId: 'worker-empty-array-characterization',
        baseVersion: 5,
        actionType: 'reset_game',
        snapshot: {
          gameState: {
            board: Array.from({ length: 8 }, () => Array(8).fill(-1)),
            currentPlayer: 1,
            consecutivePasses: 0,
            turnNumber: 0
          },
          cardState: {}
        }
      });
      await emptyRoom.loadRoom();
      const emptyInternalCardState = JSON.parse(JSON.stringify(emptyRoom.room.snapshot.cardState));

      process.stdout.write('${WORKER_RESULT_MARKER}' + JSON.stringify({
        rawProjections,
        zeroDeckCode,
        zero: {
          createStatus: zeroCreated.status,
          joinStatus: zeroJoined.status,
          stateStatus: zeroState.status,
          createRoomDeck: zeroCreated.data.roomDeck,
          joinRoomDeck: zeroJoined.data.roomDeck,
          stateRoomDeck: zeroState.data.roomDeck,
          initialDeckSizeByPlayer: zeroInternalCardState.initialDeckSizeByPlayer,
          inventorySizes: inventorySizes(zeroInternalCardState),
          publicPayloads: [zeroCreated.data, zeroJoined.data, zeroState.data]
        },
        emptyArrays: {
          resetStatus: emptyReset.status,
          initialDeckSizeByPlayer: emptyInternalCardState.initialDeckSizeByPlayer,
          inventorySizes: inventorySizes(emptyInternalCardState)
        }
      }));
      process.exit(0);
    })().catch((error) => {
      console.error(error && error.stack ? error.stack : String(error));
      process.exit(1);
    });
  `;

  const child = spawnSync(process.execPath, [
    '-e',
    runner,
    workerModulePath,
    JSON.stringify(MATCH_ROOM_DECK_RAW_PROJECTION_FIXTURES)
  ], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 60_000
  });
  if (child.status !== 0) {
    throw new Error(child.stderr || child.stdout || 'Worker room-deck characterization failed');
  }
  const output = String(child.stdout || '');
  const markerIndex = output.lastIndexOf(WORKER_RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'Worker characterization emitted no result');
  return JSON.parse(output.slice(markerIndex + WORKER_RESULT_MARKER.length));
}

function expectNoPrivateDeckFields(payloads: unknown[]) {
  for (const payload of payloads) {
    const serialized = JSON.stringify(payload);
    for (const field of MATCH_ROOM_DECK_PRIVATE_FIELDS) {
      expect(serialized).not.toContain(`\"${field}\"`);
    }
  }
}

function expectRuntimeCharacterization(result: any, runtime: 'worker' | 'local') {
  MATCH_ROOM_DECK_RAW_PROJECTION_FIXTURES.forEach((fixture, index) => {
    expect(result.rawProjections[index]).toEqual({
      name: fixture.name,
      roomDeck: runtime === 'worker' ? fixture.expectedWorker : fixture.expectedLocal
    });
  });

  const zeroDeckCode = DeckCodecModule.encodeDeckSpec(
    DeckSpecHelpers.createDeckSpecFromCardIds([], { requireFullDeck: false })
  );
  expect(result.zeroDeckCode).toBe(zeroDeckCode);
  expect(result.zero).toMatchObject({
    createStatus: 200,
    joinStatus: 200,
    stateStatus: 200,
    initialDeckSizeByPlayer: { black: 0, white: 30 },
    inventorySizes: { black: 0, white: 30 }
  });
  expect(result.zero.createRoomDeck).toMatchObject({
    mode: 'perPlayer',
    deckCodeByPlayer: { black: zeroDeckCode, white: '' },
    deckSizeByPlayer: { black: 0, white: 30 }
  });
  expect(result.zero.joinRoomDeck).toEqual(result.zero.stateRoomDeck);
  expect(result.zero.stateRoomDeck).toMatchObject({
    mode: 'perPlayer',
    deckCodeByPlayer: { black: zeroDeckCode, white: '' },
    deckSizeByPlayer: { black: 0, white: 30 }
  });
  expectNoPrivateDeckFields(result.zero.publicPayloads);

  expect(result.emptyArrays).toEqual(runtime === 'worker'
    ? {
      resetStatus: 200,
      initialDeckSizeByPlayer: { black: 30, white: 30 },
      inventorySizes: { black: 30, white: 30 }
    }
    : {
      resetStatus: 200,
      initialDeckSizeByPlayer: { black: 0, white: 0 },
      inventorySizes: { black: 0, white: 0 }
    });
}

describe('Worker/local room-deck runtime characterization', () => {
  jest.setTimeout(120_000);

  test('local supported projections and raw compatibility remain characterized', async () => {
    const localResult = await collectLocalCharacterization();
    expectRuntimeCharacterization(localResult, 'local');
  });

  test('Worker supported projections and raw normalization remain characterized', () => {
    const workerResult = collectWorkerCharacterization();
    expectRuntimeCharacterization(workerResult, 'worker');
  });
});
