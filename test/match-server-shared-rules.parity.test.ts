import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import {
  createLocalMatchServer,
  patchRoomSnapshotForTests,
  resetRoomsForTests
} from '../scripts/local-match-server.js';

// Cross-runtime parity for the server rules shared by the Worker (Durable Object) and the local
// match server (R18). The same fixture goes through both adapters and the observable results must
// match; runtime-specific payload decoration is characterized explicitly instead of hidden.

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runWorkerScenario(body: string, input: unknown): any {
  const runner = [
    '(async () => {',
    '  const modulePath = process.argv[1];',
    '  const input = JSON.parse(process.argv[2]);',
    '  const { MatchRoomDurableObject } = await import(modulePath);',
    '  const makeDurableObject = () => {',
    '    const storage = new Map();',
    '    const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => undefined, deleteAlarm: async () => undefined } };',
    '    return new MatchRoomDurableObject(state);',
    '  };',
    '  const durableObject = makeDurableObject();',
    '  const board = Array.from({ length: 8 }, () => Array(8).fill(0));',
    '  board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;',
    '  const baseSnapshot = { gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 }, cardState: {} };',
    '  const out = {};',
    body,
    '  process.stdout.write(JSON.stringify(out));',
    '})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });'
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, JSON.stringify(input)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'worker runner failed');
  return JSON.parse(String(result.stdout || '{}'));
}

function requestJson(port: number, method: string, urlPath: string, payload?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

async function withLocalServer<T>(fn: (port: number) => Promise<T>): Promise<T> {
  const server = createLocalMatchServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
  try {
    return await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resetRoomsForTests();
  }
}

function normalizeTimer(timer: any) {
  return {
    limitSeconds: timer.limitSeconds,
    active: timer.active,
    turnSeatKey: timer.turnSeatKey,
    hasStart: Number.isFinite(Number(timer.turnStartedAt)),
    spanMs: Number.isFinite(Number(timer.turnDeadlineAt)) && Number.isFinite(Number(timer.turnStartedAt))
      ? Number(timer.turnDeadlineAt) - Number(timer.turnStartedAt)
      : null,
    remainingWithinSpan: timer.remainingMs === null
      ? null
      : Number(timer.remainingMs) >= 0 && Number(timer.remainingMs) <= Number(timer.turnDeadlineAt) - Number(timer.turnStartedAt)
  };
}

const TIMER_FIXTURES: unknown[] = [3, 1, 'abc', 99999, 45];

describe('Worker / local server shared turn-timer rules', () => {
  test('create (paused) and join (active) timers match for every limit fixture', async () => {
    const worker = runWorkerScenario([
      '  out.cases = [];',
      '  for (const [index, turnTimeSeconds] of input.entries()) {',
      "    const roomId = 'TMP' + index;",
      '    const room = makeDurableObject();',
      "    const created = await (await room.handleInternalCreate(new URL('https://room/internal/create'), { roomId, playerName: 'くろ', seed: 1, turnTimeSeconds, snapshot: JSON.parse(JSON.stringify(baseSnapshot)) })).json();",
      "    const joined = await (await room.handleJoin({ seatKey: 'white', playerName: 'しろ' })).json();",
      '    out.cases.push({ create: created.turnTimer, join: joined.turnTimer });',
      '  }'
    ].join('\n'), TIMER_FIXTURES);

    const local = await withLocalServer(async (port) => {
      const cases: any[] = [];
      for (const turnTimeSeconds of TIMER_FIXTURES) {
        const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ', turnTimeSeconds });
        const joined = await requestJson(port, 'POST', '/api/match/join', { roomId: created.data.roomId, seatKey: 'white', playerName: 'しろ' });
        cases.push({ create: created.data.turnTimer, join: joined.data.turnTimer });
      }
      return cases;
    });

    const normalize = (cases: any[]) => cases.map((entry) => ({ create: normalizeTimer(entry.create), join: normalizeTimer(entry.join) }));
    expect(normalize(local)).toEqual(normalize(worker.cases));
    expect(normalize(local).map((entry) => entry.join.limitSeconds)).toEqual([3, 3, 120, 1800, 45]);
    expect(normalize(local).every((entry) => entry.create.active === false && entry.join.active === true)).toBe(true);
    expect(normalize(local).map((entry) => entry.join.spanMs)).toEqual([3000, 3000, 120000, 1800000, 45000]);
  });

  test('both adapters delegate timer rules to the shared module instead of carrying their own body', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const adapterSources = [
      'scripts/local-match-server.ts',
      'workers/match-worker.ts',
      'workers/match-worker-turn-timer.ts',
      'workers/match-worker-turn-timer-controller.ts'
    ].map((file) => fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    // Deadline arithmetic and the timer equality comparison exist only in utils/match-turn-timer-rules.ts.
    for (const source of adapterSources) {
      expect(source).not.toMatch(/turnDeadlineAt:\s*\w+\s*\+\s*\(?\s*\w+\s*\*\s*1000/);
      expect(source).not.toMatch(/leftDeadline\s*===\s*rightDeadline/);
    }
    expect(fs.readFileSync(path.join(repoRoot, 'utils/match-turn-timer-rules.ts'), 'utf8')).toMatch(/turnDeadlineAt: startedAt \+ \(limitSeconds \* 1000\)/);
  });
});

function buildJournalSnapshot() {
  const Core = require('../game/logic/core.js');
  const CardLogic = require('../game/logic/cards.js');
  const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');
  const SeededPRNG = require('../game/schema/prng.js');
  const gameState = Core.createGameState();
  const prng = SeededPRNG.createPRNG(19);
  const cardState = CardLogic.createCardState(prng);
  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);
  return { gameState, cardState };
}

function placeBody(seatToken: string, baseVersion: number) {
  return {
    seatKey: 'black',
    playerKey: 'black',
    seatToken,
    baseVersion,
    operationId: 'op_parity_journal_place_1',
    actionType: 'place',
    actor: 'black',
    params: { row: 2, col: 3 },
    turnIndex: 1,
    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }
  };
}

function normalizeJournal(result: any) {
  const createVersion = Number(result.create.stateVersion);
  const frame = (entry: any) => ({
    visualSeq: entry.visualSeq,
    versionDelta: Number(entry.stateVersionTo) - Number(entry.stateVersionFrom),
    fromCreate: Number(entry.stateVersionFrom) === createVersion,
    operationId: entry.operationId,
    actorSeatKey: entry.actorSeatKey,
    actionType: entry.actionType,
    playbackDigest: entry.playbackDigest,
    playbackEvents: entry.playbackEvents,
    effectLogs: entry.effectLogs,
    snapshotAfterVersionDelta: Number(entry.snapshotAfter && entry.snapshotAfter.stateVersion) - createVersion,
    snapshotAfterBoard: entry.snapshotAfter && entry.snapshotAfter.gameState && entry.snapshotAfter.gameState.board
  });
  const cursor = (value: any) => ({ visualSeq: value.visualSeq, versionDelta: Number(value.stateVersion) - createVersion });
  return {
    publish: { cursor: cursor(result.publish.presentationCursor), frames: result.publish.presentationFrames.map(frame) },
    replay: { idempotentReplay: result.replay.idempotentReplay, cursor: cursor(result.replay.presentationCursor), frames: result.replay.presentationFrames.map(frame) },
    state: { cursor: cursor(result.state.presentationCursor), frames: result.state.presentationFrames.map(frame) },
    recovery: {
      baseVisualSeq: result.recovery.baseVisualSeq,
      baseSnapshotFromCreate: Number(result.recovery.baseSnapshot.stateVersion) === createVersion,
      baseBoard: result.recovery.baseSnapshot.gameState.board,
      cursor: cursor(result.recovery.presentationCursor),
      frames: result.recovery.presentationFrames.map(frame)
    }
  };
}

describe('Worker / local server shared presentation-journal rules', () => {
  test('accepted publish, idempotent replay, state, and journal recovery expose the same frames', async () => {
    const snapshot = buildJournalSnapshot();
    const worker = runWorkerScenario([
      "  const created = await (await durableObject.handleInternalCreate(new URL('https://room/internal/create'), { roomId: 'JPAR', playerName: 'くろ', seed: 19, snapshot: input.snapshot })).json();",
      '  const body = Object.assign({}, input.body, { seatToken: created.seatToken, baseVersion: created.stateVersion });',
      '  out.create = created;',
      '  out.publish = await (await durableObject.handlePublish(body)).json();',
      '  out.replay = await (await durableObject.handlePublish(body)).json();',
      "  out.state = await (await durableObject.fetch(new Request('https://room/api/match/state?roomId=JPAR&seatKey=black&seatToken=' + created.seatToken))).json();",
      "  out.recovery = await (await durableObject.fetch(new Request('https://room/api/match/presentation-journal?roomId=JPAR&seatKey=black&seatToken=' + created.seatToken + '&afterVisualSeq=0'))).json();"
    ].join('\n'), { snapshot, body: placeBody('', 0) });

    const local = await withLocalServer(async (port) => {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      patchRoomSnapshotForTests(roomId, (room: any) => {
        room.seed = 19;
        room.snapshot = JSON.parse(JSON.stringify(snapshot));
        delete room.initialSnapshotByViewer;
      });
      const body = Object.assign({ roomId }, placeBody(created.data.seatToken, created.data.stateVersion));
      const publish = await requestJson(port, 'POST', '/api/match/publish', body);
      const replay = await requestJson(port, 'POST', '/api/match/publish', body);
      const state = await requestJson(port, 'GET', `/api/match/state?roomId=${roomId}&seatKey=black&seatToken=${created.data.seatToken}`);
      const recovery = await requestJson(port, 'GET', `/api/match/presentation-journal?roomId=${roomId}&seatKey=black&seatToken=${created.data.seatToken}&afterVisualSeq=0`);
      return { create: created.data, publish: publish.data, replay: replay.data, state: state.data, recovery: recovery.data };
    });

    const normalizedLocal = normalizeJournal(local);
    expect(normalizedLocal).toEqual(normalizeJournal(worker));
    expect(normalizedLocal.publish.cursor).toEqual({ visualSeq: 1, versionDelta: normalizedLocal.publish.frames[0].versionDelta });
    expect(normalizedLocal.recovery.frames.map((entry) => entry.visualSeq)).toEqual([1]);
    expect(normalizedLocal.replay.idempotentReplay).toBe(true);
  });

  test('both adapters delegate journal assembly to the shared module instead of carrying their own body', () => {
    const repoRoot = path.resolve(__dirname, '..');
    for (const file of ['scripts/local-match-server.ts', 'workers/match-worker.ts']) {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      expect(source).not.toMatch(/room\.initialSnapshotByViewer\s*=\s*\{/);
      expect(source).not.toMatch(/payloadByViewer:\s*\{/);
    }
  });
});

const CHAT_CASES = [
  { label: 'valid message is trimmed and newlines folded', seat: 'black', token: 'own', message: '  hi\r\nthere  ' },
  { label: 'too long', seat: 'white', token: 'own', message: 'x'.repeat(21) },
  { label: 'surrogate pairs count as one character', seat: 'white', token: 'own', message: '😀'.repeat(20) },
  { label: 'empty', seat: 'black', token: 'own', message: '  \n ' },
  { label: 'wrong token', seat: 'black', token: 'wrong', message: 'hello' },
  { label: 'missing token', seat: 'black', token: '', message: 'hello' }
];

function normalizeChatResponse(entry: any) {
  const data = entry.data || {};
  return {
    status: entry.status,
    ok: data.ok,
    reason: data.reason,
    maxLength: data.maxLength,
    message: data.message ? { id: data.message.id, seatKey: data.message.seatKey, text: data.message.text } : undefined
  };
}

function normalizeHistory(messages: any[]) {
  return messages.map((entry) => ({ id: entry.id, seatKey: entry.seatKey, text: entry.text }));
}

describe('Worker / local server shared chat rules', () => {
  test('authentication, validation, and history append match; known runtime differences are explicit', async () => {
    const input = { cases: CHAT_CASES, burst: 41 };
    const worker = runWorkerScenario([
      "  const created = await (await durableObject.handleInternalCreate(new URL('https://room/internal/create'), { roomId: 'CHAT', playerName: 'くろ', seed: 1, snapshot: baseSnapshot })).json();",
      "  const lonely = makeDurableObject();",
      "  const lonelyCreated = await (await lonely.handleInternalCreate(new URL('https://room/internal/create'), { roomId: 'LONE', playerName: 'くろ', seed: 1, snapshot: JSON.parse(JSON.stringify(baseSnapshot)) })).json();",
      "  const respond = async (target, body) => { const response = await target.handleChat(body); return { status: response.status, data: await response.json() }; };",
      "  out.disabled = await respond(lonely, { seatKey: 'black', seatToken: lonelyCreated.seatToken, message: 'hi' });",
      "  out.notJoined = await respond(lonely, { seatKey: 'white', seatToken: 'anything', message: 'hi' });",
      "  const joined = await (await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' })).json();",
      "  const tokens = { black: created.seatToken, white: joined.seatToken };",
      "  out.cases = [];",
      "  for (const item of input.cases) {",
      "    const token = item.token === 'own' ? tokens[item.seat] : item.token === 'wrong' ? 'not-the-token' : '';",
      "    out.cases.push(await respond(durableObject, { seatKey: item.seat, seatToken: token, message: item.message }));",
      "  }",
      "  out.burst = [];",
      "  for (let i = 0; i < input.burst; i += 1) out.burst.push(await respond(durableObject, { seatKey: i % 2 ? 'white' : 'black', seatToken: i % 2 ? tokens.white : tokens.black, message: 'm' + i }));",
      "  out.history = durableObject.room.chatMessages;"
    ].join('\n'), input);

    const local = await withLocalServer(async (port) => {
      const lonely = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const disabled = await requestJson(port, 'POST', '/api/match/chat', { roomId: lonely.data.roomId, seatKey: 'black', seatToken: lonely.data.seatToken, message: 'hi' });
      const notJoined = await requestJson(port, 'POST', '/api/match/chat', { roomId: lonely.data.roomId, seatKey: 'white', seatToken: 'anything', message: 'hi' });
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, seatKey: 'white', playerName: 'しろ' });
      const tokens: Record<string, string> = { black: created.data.seatToken, white: joined.data.seatToken };
      const cases: any[] = [];
      for (const item of CHAT_CASES) {
        const token = item.token === 'own' ? tokens[item.seat] : item.token === 'wrong' ? 'not-the-token' : '';
        cases.push(await requestJson(port, 'POST', '/api/match/chat', { roomId, seatKey: item.seat, seatToken: token, message: item.message }));
      }
      const burst: any[] = [];
      for (let i = 0; i < 41; i += 1) {
        burst.push(await requestJson(port, 'POST', '/api/match/chat', { roomId, seatKey: i % 2 ? 'white' : 'black', seatToken: i % 2 ? tokens.white : tokens.black, message: 'm' + i }));
      }
      let history: any[] = [];
      patchRoomSnapshotForTests(roomId, (room: any) => { history = room.chatMessages; });
      return { disabled, notJoined, cases, burst, history };
    });

    // Missing seat token: the Worker classifies it (SEAT_TOKEN_REQUIRED) while the local server keeps
    // its historical SEAT_TOKEN_MISMATCH. Both reject with 403; the reason codes are kept as-is.
    const missingTokenIndex = CHAT_CASES.findIndex((item) => item.label === 'missing token');
    expect(normalizeChatResponse(local.cases[missingTokenIndex])).toMatchObject({ status: 403, ok: false, reason: 'SEAT_TOKEN_MISMATCH' });
    expect(normalizeChatResponse(worker.cases[missingTokenIndex])).toMatchObject({ status: 403, ok: false, reason: 'SEAT_TOKEN_REQUIRED' });
    const comparable = (cases: any[]) => cases.filter((_entry, index) => index !== missingTokenIndex).map(normalizeChatResponse);

    expect(comparable(local.cases)).toEqual(comparable(worker.cases));
    expect(comparable(local.cases).map((entry: any) => [entry.status, entry.reason || entry.message.text])).toEqual([
      [200, 'hi there'],
      [400, 'MESSAGE_TOO_LONG'],
      [200, '😀'.repeat(20)],
      [400, 'MESSAGE_REQUIRED'],
      [403, 'SEAT_TOKEN_MISMATCH']
    ]);
    expect(normalizeChatResponse(local.disabled)).toEqual(normalizeChatResponse(worker.disabled));
    expect(normalizeChatResponse(local.disabled)).toMatchObject({ status: 409, reason: 'CHAT_DISABLED' });
    expect(normalizeChatResponse(local.notJoined)).toEqual(normalizeChatResponse(worker.notJoined));
    expect(normalizeChatResponse(local.notJoined)).toMatchObject({ status: 403, reason: 'SEAT_NOT_JOINED' });
    expect(local.burst.map(normalizeChatResponse)).toEqual(worker.burst.map(normalizeChatResponse));
    expect(normalizeHistory(local.history)).toEqual(normalizeHistory(worker.history));
    expect(local.history).toHaveLength(40);
    expect(local.history[0].id).toBe(4);
    expect(local.history[39].id).toBe(43);

    // Runtime-specific decoration stays in each adapter: the Worker adds the turn timer and server
    // time to every chat response, the local server attaches roomDeck and only the public seats.
    expect(worker.cases[1].data).toHaveProperty('turnTimer');
    expect(local.cases[1].data).not.toHaveProperty('turnTimer');
    expect(local.cases[0].data).toHaveProperty('roomDeck');
  });

  test('both adapters delegate chat rules to the shared module instead of carrying their own body', () => {
    const repoRoot = path.resolve(__dirname, '..');
    for (const file of ['scripts/local-match-server.ts', 'workers/match-worker-chat-controller.ts', 'workers/match-worker.ts']) {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      expect(source).not.toMatch(/room\.chatSeq\s*\+=\s*1/);
      expect(source).not.toMatch(/chatMessages\.splice\(0,/);
      expect(source).not.toMatch(/replace\(\/\[\\r\\n\]\+\/g, ' '\)/);
    }
  });
});
