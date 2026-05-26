import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, Browser, Page } from 'playwright';

const LocalMatchServer = require('./local-match-server');
const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const SeededPRNG = require('../game/schema/prng');

const {
  createLocalMatchServer,
  resetRoomsForTests,
  patchRoomSnapshotForTests
} = LocalMatchServer;

type Seat = {
  label: string;
  browser: Browser;
  page: Page;
  consoleErrors: string[];
  pageErrors: string[];
};

type Scenario = {
  id: string;
  expectedReasons: string[];
  publishAction: { type: string; playerKey: string; row: number; col: number };
  buildSnapshot: () => { gameState: any; cardState: any };
};

const SCENARIOS: Scenario[] = [
  {
    id: 'destroy_dragon',
    expectedReasons: ['destroy_dragon_breath'],
    publishAction: { type: 'place', playerKey: 'black', row: 2, col: 3 },
    buildSnapshot() {
      const gameState = Core.createGameState();
      const prng = SeededPRNG.createPRNG(29);
      const cardState = CardLogic.createCardState(prng);
      gameState.currentPlayer = Core.BLACK;
      gameState.turnNumber = 1;
      gameState.board[5][5] = Core.BLACK;
      gameState.board[5][6] = Core.WHITE;
      cardState.markers.push({
        id: 'destroy_dragon_1',
        kind: 'specialStone',
        row: 5,
        col: 5,
        owner: 'black',
        data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
      });
      return { gameState, cardState };
    }
  },
  {
    id: 'lightning',
    expectedReasons: ['lightning_destroyed'],
    publishAction: { type: 'place', playerKey: 'black', row: 2, col: 3 },
    buildSnapshot() {
      const gameState = Core.createGameState();
      const prng = SeededPRNG.createPRNG(31);
      const cardState = CardLogic.createCardState(prng);
      gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
      gameState.currentPlayer = Core.BLACK;
      gameState.turnNumber = 1;
      gameState.board[4][3] = Core.BLACK;
      gameState.board[2][5] = Core.BLACK;
      gameState.board[5][5] = Core.BLACK;
      gameState.board[3][3] = Core.WHITE;
      gameState.board[2][4] = Core.WHITE;
      gameState.board[5][6] = Core.WHITE;
      cardState.markers.push({
        id: 'lightning_1',
        kind: 'specialStone',
        row: 5,
        col: 5,
        owner: 'black',
        data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
      });
      return { gameState, cardState };
    }
  },
  {
    id: 'sniper',
    expectedReasons: ['sniper_shot'],
    publishAction: { type: 'place', playerKey: 'black', row: 2, col: 3 },
    buildSnapshot() {
      const gameState = Core.createGameState();
      const prng = SeededPRNG.createPRNG(43);
      const cardState = CardLogic.createCardState(prng);
      gameState.currentPlayer = Core.BLACK;
      gameState.turnNumber = 1;
      gameState.board[6][6] = Core.BLACK;
      gameState.board[6][7] = Core.WHITE;
      cardState.markers.push({
        id: 'sniper_1',
        kind: 'specialStone',
        row: 6,
        col: 6,
        owner: 'black',
        data: { type: 'SNIPER', remainingOwnerTurns: 5 }
      });
      return { gameState, cardState };
    }
  },
  {
    id: 'robot_vacuum',
    expectedReasons: ['robot_vacuum_move', 'robot_vacuum_suck'],
    publishAction: { type: 'place', playerKey: 'black', row: 2, col: 3 },
    buildSnapshot() {
      const gameState = Core.createGameState();
      const prng = SeededPRNG.createPRNG(47);
      const cardState = CardLogic.createCardState(prng);
      gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
      gameState.currentPlayer = Core.BLACK;
      gameState.turnNumber = 1;
      gameState.board[4][3] = Core.BLACK;
      gameState.board[2][5] = Core.BLACK;
      gameState.board[3][3] = Core.WHITE;
      gameState.board[2][4] = Core.WHITE;
      gameState.board[6][6] = Core.BLACK;
      gameState.board[6][7] = Core.WHITE;
      cardState.markers.push({
        id: 'robot_vacuum_1',
        kind: 'specialStone',
        row: 6,
        col: 6,
        owner: 'black',
        data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
      });
      return { gameState, cardState };
    }
  }
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript';
  if (ext === '.css') return 'text/css';
  if (ext === '.json') return 'application/json';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.onnx') return 'application/octet-stream';
  return 'application/octet-stream';
}

function createStaticServer(rootDir: string): http.Server {
  return http.createServer((req, res) => {
    const rawUrl = String((req && req.url) || '/').split('?')[0] || '/';
    let decoded = '/';
    try {
      decoded = decodeURIComponent(rawUrl === '/' ? '/index.html' : rawUrl);
    } catch (_e) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    const filePath = path.resolve(rootDir, `.${decoded}`);
    const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
    if (filePath !== rootDir && !filePath.startsWith(normalizedRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', resolveMimeType(filePath));
      res.end(data);
    });
  });
}

async function listen(server: http.Server, host: string, port: number): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('error', onError);
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  const address = server.address() as any;
  return `http://${host}:${address.port}`;
}

async function closeServer(server: http.Server | null | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.resolve(startDir);
}

async function launchSeat(channel: string, label: string, appUrl: string): Promise<Seat> {
  const browser = await chromium.launch({ channel, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const seat: Seat = { label, browser, page, consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (typeof message.type === 'function' && message.type() === 'error') {
      seat.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    seat.pageErrors.push(error && (error as any).message ? String((error as any).message) : String(error));
  });
  await page.goto(`${appUrl}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).NetworkMatchClient, null, { timeout: 30000 });
  return seat;
}

async function closeSeat(seat: Seat | null | undefined): Promise<void> {
  if (!seat) return;
  try {
    await seat.browser.close();
  } catch (_e) {
    // ignore
  }
}

async function installPageHelpers(seat: Seat): Promise<void> {
  await seat.page.evaluate(() => {
    (window as any).__turnStartBrowserCheckPayloads = [];
    const attachWrapper = () => {
      const boardOps = (window as any).BoardOps;
      if (!boardOps || typeof boardOps.emitPresentationEvent !== 'function' || boardOps.__turnStartBrowserCheckWrapped) {
        return false;
      }
      const original = boardOps.emitPresentationEvent.bind(boardOps);
      boardOps.emitPresentationEvent = function wrappedEmitPresentationEvent(state: any, ev: any) {
        try {
          if (ev && ev.type === 'PLAYBACK_EVENTS' && Array.isArray(ev.events)) {
            (window as any).__turnStartBrowserCheckPayloads.push(JSON.parse(JSON.stringify(ev.events)));
          }
        } catch (_e) {
          // ignore
        }
        return original(state, ev);
      };
      boardOps.__turnStartBrowserCheckWrapped = true;
      return true;
    };
    if (!attachWrapper()) {
      const intervalId = setInterval(() => {
        if (attachWrapper()) clearInterval(intervalId);
      }, 20);
    }
    (window as any).__turnStartBrowserCheckPayloadsByReason = () => {
      const payloads = Array.isArray((window as any).__turnStartBrowserCheckPayloads)
        ? (window as any).__turnStartBrowserCheckPayloads
        : [];
      const reasons: string[] = [];
      for (const batch of payloads) {
        const events = Array.isArray(batch) ? batch : [];
        for (const ev of events) {
          if (!ev) continue;
          if (ev.meta && ev.meta.reason) reasons.push(String(ev.meta.reason));
          const targets = Array.isArray(ev.targets) ? ev.targets : [];
          for (const target of targets) {
            if (target && target.reason) reasons.push(String(target.reason));
          }
        }
      }
      return {
        payloads,
        reasons
      };
    };
  });
  await delay(250);
}

async function createRoom(chromeSeat: Seat, matchUrl: string): Promise<any> {
  return chromeSeat.page.evaluate(async (serverUrl) => {
    const client = (window as any).NetworkMatchClient;
    client.setServerUrl(serverUrl);
    return client.createRoom({
      serverUrl,
      playerName: 'Chrome',
      networkDebugEnabled: true
    });
  }, matchUrl);
}

async function joinRoom(edgeSeat: Seat, matchUrl: string, roomId: string): Promise<any> {
  return edgeSeat.page.evaluate(async ({ serverUrl, roomId: id }) => {
    const client = (window as any).NetworkMatchClient;
    client.setServerUrl(serverUrl);
    return client.joinRoom(id, {
      serverUrl,
      playerName: 'Edge'
    });
  }, { serverUrl: matchUrl, roomId });
}

async function syncSeat(seat: Seat): Promise<void> {
  await seat.page.evaluate(async () => {
    const client = (window as any).NetworkMatchClient;
    if (client && typeof client.syncLatestState === 'function') {
      await client.syncLatestState();
    }
  });
}

async function syncBoth(chromeSeat: Seat, edgeSeat: Seat): Promise<void> {
  await Promise.all([syncSeat(chromeSeat), syncSeat(edgeSeat)]);
}

async function publishAction(seat: Seat, playerKey: string, action: any): Promise<void> {
  const result = await seat.page.evaluate(async ({ actor, action: nextAction }) => {
    const client = (window as any).NetworkMatchClient;
    return client.publishSnapshot({
      playerKey: actor,
      actionType: nextAction.type,
      action: nextAction,
      playbackEvents: []
    });
  }, { actor: playerKey, action });
  if (!result || result.ok !== true) {
    throw new Error(`${seat.label} publish failed: ${JSON.stringify(result || {})}`);
  }
  await delay(50);
}

function patchRoomScenario(roomId: string, scenario: Scenario): void {
  const patched = patchRoomSnapshotForTests(roomId, (room: any) => {
    const built = scenario.buildSnapshot();
    const nextStateVersion = Number.isFinite(Number(room && room.stateVersion))
      ? Number(room.stateVersion) + 1
      : 1;
    const updatedAt = Date.now();
    room.snapshot = {
      gameState: built.gameState,
      cardState: built.cardState,
      stateVersion: nextStateVersion,
      updatedAt
    };
    room.stateVersion = nextStateVersion;
    room.updatedAt = updatedAt;
    room.lastPlaybackEventsBySeat = { black: [], white: [] };
    room.playbackHistoryByVersion = {};
  });
  if (!patched) {
    throw new Error(`failed to patch room for scenario ${scenario.id}`);
  }
}

async function collectPlaybackEvidence(seat: Seat): Promise<{ payloads: any[]; reasons: string[] }> {
  return seat.page.evaluate(() => {
    return (window as any).__turnStartBrowserCheckPayloadsByReason();
  });
}

async function resetPlaybackEvidence(seat: Seat): Promise<void> {
  await seat.page.evaluate(() => {
    (window as any).__turnStartBrowserCheckPayloads = [];
  });
}

async function runScenario(scenario: Scenario, chromeSeat: Seat, edgeSeat: Seat, matchUrl: string) {
  await Promise.all([resetPlaybackEvidence(chromeSeat), resetPlaybackEvidence(edgeSeat)]);
  const created = await createRoom(chromeSeat, matchUrl);
  if (!created || created.ok !== true) {
    throw new Error(`create room failed: ${JSON.stringify(created || {})}`);
  }
  const roomId = String(created.roomId || '');
  const joined = await joinRoom(edgeSeat, matchUrl, roomId);
  if (!joined || joined.ok !== true) {
    throw new Error(`join room failed: ${JSON.stringify(joined || {})}`);
  }
  patchRoomScenario(roomId, scenario);
  await syncBoth(chromeSeat, edgeSeat);
  await publishAction(chromeSeat, 'black', scenario.publishAction);
  await syncBoth(chromeSeat, edgeSeat);
  await delay(250);

  const chromeEvidence = await collectPlaybackEvidence(chromeSeat);
  const edgeEvidence = await collectPlaybackEvidence(edgeSeat);
  const combinedReasons = [
    ...(Array.isArray(chromeEvidence.reasons) ? chromeEvidence.reasons : []),
    ...(Array.isArray(edgeEvidence.reasons) ? edgeEvidence.reasons : [])
  ];

  const missingReasons = scenario.expectedReasons.filter((reason) => !combinedReasons.includes(reason));
  if (missingReasons.length > 0) {
    throw new Error(
      `${scenario.id} missing reasons ${missingReasons.join(', ')}; reasons=${JSON.stringify(combinedReasons)}`
    );
  }

  return {
    id: scenario.id,
    roomId,
    expectedReasons: scenario.expectedReasons,
    chromeReasons: chromeEvidence.reasons,
    edgeReasons: edgeEvidence.reasons
  };
}

async function main(): Promise<void> {
  const rootDir = findRepoRoot(__dirname);
  const staticServer = createStaticServer(rootDir);
  const matchServer = createLocalMatchServer();
  let chromeSeat: Seat | null = null;
  let edgeSeat: Seat | null = null;
  const results: any[] = [];

  try {
    resetRoomsForTests();
    const appUrl = await listen(staticServer, '127.0.0.1', 0);
    const matchUrl = await listen(matchServer, '127.0.0.1', 0);
    console.log(`[network-turn-start-check] app=${appUrl}`);
    console.log(`[network-turn-start-check] match=${matchUrl}`);

    chromeSeat = await launchSeat('chrome', 'Chrome', appUrl);
    edgeSeat = await launchSeat('msedge', 'Edge', appUrl);
    await Promise.all([installPageHelpers(chromeSeat), installPageHelpers(edgeSeat)]);

    for (const scenario of SCENARIOS) {
      const result = await runScenario(scenario, chromeSeat, edgeSeat, matchUrl);
      results.push(result);
      console.log(`[network-turn-start-check] ok ${scenario.id} reasons=${scenario.expectedReasons.join(',')}`);
    }

    console.log(JSON.stringify({
      results,
      chromeConsoleErrors: chromeSeat.consoleErrors,
      edgeConsoleErrors: edgeSeat.consoleErrors,
      chromePageErrors: chromeSeat.pageErrors,
      edgePageErrors: edgeSeat.pageErrors
    }, null, 2));
  } finally {
    await closeSeat(edgeSeat);
    await closeSeat(chromeSeat);
    await closeServer(matchServer);
    await closeServer(staticServer);
    resetRoomsForTests();
  }
}

main().catch((error) => {
  console.error(`[network-turn-start-check] failed: ${error && (error as any).message ? String((error as any).message) : String(error)}`);
  process.exit(1);
});
