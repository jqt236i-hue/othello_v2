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
    id: 'ordinary_turn_handoff',
    expectedReasons: ['standard_place', 'standard_flip'],
    publishAction: { type: 'place', playerKey: 'black', row: 2, col: 3 },
    buildSnapshot() {
      const gameState = Core.createGameState();
      const prng = SeededPRNG.createPRNG(23);
      const cardState = CardLogic.createCardState(prng);
      gameState.currentPlayer = Core.BLACK;
      gameState.turnNumber = 1;
      return { gameState, cardState };
    }
  },
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
      const location = typeof message.location === 'function' ? message.location() : null;
      const sourceUrl = location && location.url ? String(location.url) : '';
      seat.consoleErrors.push(sourceUrl ? `${message.text()} (${sourceUrl})` : message.text());
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
    const capturePlaybackEvents = (playbackEvents: any) => {
      try {
        if (Array.isArray(playbackEvents) && playbackEvents.length > 0) {
          (window as any).__turnStartBrowserCheckPayloads.push(JSON.parse(JSON.stringify(playbackEvents)));
          return true;
        }
      } catch (_e) {
        // ignore
      }
      return false;
    };
    const attachBoardOpsWrapper = () => {
      const boardOps = (window as any).BoardOps;
      if (!boardOps || typeof boardOps.emitPresentationEvent !== 'function') {
        return false;
      }
      if (boardOps.__turnStartBrowserCheckWrapped) return true;
      const original = boardOps.emitPresentationEvent.bind(boardOps);
      boardOps.emitPresentationEvent = function wrappedEmitPresentationEvent(state: any, ev: any) {
        try {
          if (ev && ev.type === 'PLAYBACK_EVENTS' && Array.isArray(ev.events)) {
            capturePlaybackEvents(ev.events);
          }
        } catch (_e) {
          // ignore
        }
        return original(state, ev);
      };
      boardOps.__turnStartBrowserCheckWrapped = true;
      return true;
    };
    const wrapDispatcher = (dispatcher: any) => {
      if (
        !dispatcher
        || typeof dispatcher.dispatchNetworkPlaybackEvents !== 'function'
      ) {
        return false;
      }
      if (dispatcher.__turnStartBrowserCheckWrapped) return true;
      const original = dispatcher.dispatchNetworkPlaybackEvents.bind(dispatcher);
      dispatcher.dispatchNetworkPlaybackEvents = async function wrappedDispatchNetworkPlaybackEvents(playbackEvents: any, options?: any) {
        capturePlaybackEvents(playbackEvents);
        return original(playbackEvents, options);
      };
      dispatcher.__turnStartBrowserCheckWrapped = true;
      return true;
    };
    let dispatcherValue = (window as any).NetworkPlaybackDispatcher;
    const dispatcherDescriptor = Object.getOwnPropertyDescriptor(window, 'NetworkPlaybackDispatcher');
    if (!dispatcherDescriptor || dispatcherDescriptor.configurable === true) {
      Object.defineProperty(window, 'NetworkPlaybackDispatcher', {
        configurable: true,
        enumerable: true,
        get: () => dispatcherValue,
        set: (nextValue) => {
          dispatcherValue = nextValue;
          wrapDispatcher(dispatcherValue);
        }
      });
    }
    const attachDispatcherWrapper = () => wrapDispatcher((window as any).NetworkPlaybackDispatcher);
    const attachWrappers = () => {
      const boardOpsAttached = attachBoardOpsWrapper();
      const dispatcherAttached = attachDispatcherWrapper();
      return boardOpsAttached && dispatcherAttached;
    };
    if (!attachWrappers()) {
      const intervalId = setInterval(() => {
        if (attachWrappers()) clearInterval(intervalId);
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
    const requireFn = (window as any).require;
    const matchMode = typeof requireFn === 'function'
      ? requireFn('ui/handlers/match-mode')
      : null;
    if (!matchMode || typeof matchMode.setMode !== 'function') {
      throw new Error('match mode controller unavailable');
    }
    await matchMode.setMode('network', {
      skipReset: true,
      silentLog: true,
      suppressStatus: true
    });
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
    const requireFn = (window as any).require;
    const matchMode = typeof requireFn === 'function'
      ? requireFn('ui/handlers/match-mode')
      : null;
    if (!matchMode || typeof matchMode.setMode !== 'function') {
      throw new Error('match mode controller unavailable');
    }
    await matchMode.setMode('network', {
      skipReset: true,
      silentLog: true,
      suppressStatus: true
    });
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

async function leaveSeat(seat: Seat): Promise<void> {
  await seat.page.evaluate(async () => {
    const client = (window as any).NetworkMatchClient;
    if (client && typeof client.leaveRoom === 'function') {
      try {
        await client.leaveRoom();
      } catch (_e) {
        // A cleanup failure here must not hide the scenario result.
      }
    }
  });
  await delay(50);
}

async function cleanupScenarioSessions(chromeSeat: Seat, edgeSeat: Seat): Promise<void> {
  await Promise.all([leaveSeat(chromeSeat), leaveSeat(edgeSeat)]);
  await Promise.all([chromeSeat, edgeSeat].map((seat) => seat.page.evaluate(() => {
    try {
      localStorage.removeItem('card_reversi_player_identity_v1');
    } catch (_e) {
      // The local harness resets its authority identity store between scenarios.
    }
  })));
  resetRoomsForTests();
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

async function waitForVisualSettlement(seat: Seat): Promise<void> {
  await seat.page.evaluate(async () => {
    const requireFn = (window as any).require;
    const playbackState = typeof requireFn === 'function'
      ? requireFn('ui/playback-state-manager')
      : (window as any).PlaybackStateManager;
    if (playbackState && typeof playbackState.waitForVisualPlaybackDrain === 'function') {
      await playbackState.waitForVisualPlaybackDrain({
        cardState: (window as any).cardState,
        root: window,
        disableTimeout: true
      });
    }
  });
  await seat.page.waitForFunction(() => {
    const requireFn = (window as any).require;
    const playbackState = typeof requireFn === 'function'
      ? requireFn('ui/playback-state-manager')
      : (window as any).PlaybackStateManager;
    const selectionFlow = typeof requireFn === 'function'
      ? requireFn('game/card-effects/selection-flow')
      : (window as any).PendingSelectionFlow;
    const playbackIdle = !playbackState || (
      (typeof playbackState.getPlaybackActive !== 'function' || playbackState.getPlaybackActive() !== true)
      && (typeof playbackState.hasPendingVisualPlayback !== 'function'
        || playbackState.hasPendingVisualPlayback((window as any).cardState) !== true)
    );
    const selectionIdle = !selectionFlow
      || typeof selectionFlow.isSelectionSettlementLocked !== 'function'
      || selectionFlow.isSelectionSettlementLocked() !== true;
    return playbackIdle && selectionIdle;
  }, null, { timeout: 30000 });
}

async function playFirstLegalMoveThroughUi(seat: Seat, expectedPlayerKey: string): Promise<any> {
  await waitForVisualSettlement(seat);
  const attempt = await seat.page.evaluate(async ({ expectedPlayer }) => {
    const client = (window as any).NetworkMatchClient;
    const gameState = (window as any).gameState;
    const cardState = (window as any).cardState;
    const playerValue = Number(gameState && gameState.currentPlayer);
    const actualPlayer = playerValue === -1 ? 'white' : 'black';
    if (actualPlayer !== expectedPlayer) {
      throw new Error(`follow-up turn mismatch expected=${expectedPlayer} actual=${actualPlayer}`);
    }
    const requireFn = (window as any).require;
    const moveGenerator = typeof requireFn === 'function'
      ? requireFn('game/move-generator')
      : null;
    if (!moveGenerator || typeof moveGenerator.generateMovesForPlayerInState !== 'function') {
      throw new Error('follow-up state-aware legal move resolver unavailable');
    }
    const playerKey = playerValue === -1 ? 'white' : 'black';
    const pending = cardState
      && cardState.pendingEffectByPlayer
      && cardState.pendingEffectByPlayer[playerKey]
      ? cardState.pendingEffectByPlayer[playerKey]
      : null;
    const legalMoves = moveGenerator.generateMovesForPlayerInState(
      gameState,
      cardState,
      playerValue,
      pending,
      [],
      []
    );
    const move = Array.isArray(legalMoves) ? legalMoves[0] : null;
    if (!move || !Number.isInteger(Number(move.row)) || !Number.isInteger(Number(move.col))) {
      const core = (window as any).Core || (window as any).CoreLogic;
      const coreMoves = core && typeof core.getLegalMoves === 'function'
        ? core.getLegalMoves(gameState, playerValue)
        : [];
      throw new Error(`follow-up legal move unavailable: ${JSON.stringify({
        playerKey,
        pending,
        stateAwareCount: Array.isArray(legalMoves) ? legalMoves.length : null,
        coreCount: Array.isArray(coreMoves) ? coreMoves.length : null,
        coreFirst: Array.isArray(coreMoves) ? coreMoves[0] : null,
        boardExpansion: gameState && gameState.boardExpansion
      })}`);
    }
    const handler = (window as any).handleCellClick;
    if (typeof handler !== 'function') {
      throw new Error('follow-up board input handler unavailable');
    }
    const stateBefore = client.getState();
    const handlerResult = await Promise.resolve(handler(Number(move.row), Number(move.col)));
    const turnManager = typeof requireFn === 'function'
      ? requireFn('game/turn-manager')
      : null;
    const turnManagerImpl = turnManager && typeof turnManager.getUIImpl === 'function'
      ? turnManager.getUIImpl()
      : null;
    return {
      move: { row: Number(move.row), col: Number(move.col) },
      stateVersionBefore: Number(stateBefore && stateBefore.stateVersion),
      handlerResult: typeof handlerResult === 'undefined' ? null : handlerResult,
      matchMode: turnManagerImpl && typeof turnManagerImpl.readMatchMode === 'function'
        ? turnManagerImpl.readMatchMode()
        : null,
      seatKey: turnManagerImpl && typeof turnManagerImpl.readNetworkSeatKey === 'function'
        ? turnManagerImpl.readNetworkSeatKey()
        : null,
      effectiveMoveCount: legalMoves.length
    };
  }, { expectedPlayer: expectedPlayerKey });
  try {
    await seat.page.waitForFunction((versionBefore) => {
      const client = (window as any).NetworkMatchClient;
      const state = client && typeof client.getState === 'function' ? client.getState() : null;
      return Number(state && state.stateVersion) > Number(versionBefore);
    }, attempt.stateVersionBefore, { timeout: 30000 });
  } catch (error: any) {
    const diagnostics = await seat.page.evaluate(() => {
      const playbackState = (window as any).PlaybackStateManager;
      const selectionFlow = (window as any).PendingSelectionFlow;
      const client = (window as any).NetworkMatchClient;
      const requireFn = (window as any).require;
      const turnManager = typeof requireFn === 'function'
        ? requireFn('game/turn-manager')
        : null;
      const turnManagerImpl = turnManager && typeof turnManager.getUIImpl === 'function'
        ? turnManager.getUIImpl()
        : null;
      return {
        currentPlayer: (window as any).gameState && (window as any).gameState.currentPlayer,
        globalMatchMode: (window as any).MATCH_MODE,
        currentMatchMode: typeof (window as any).getCurrentMatchMode === 'function'
          ? (window as any).getCurrentMatchMode()
          : null,
        turnManagerMatchMode: turnManagerImpl && typeof turnManagerImpl.readMatchMode === 'function'
          ? turnManagerImpl.readMatchMode()
          : null,
        turnManagerSeatKey: turnManagerImpl && typeof turnManagerImpl.readNetworkSeatKey === 'function'
          ? turnManagerImpl.readNetworkSeatKey()
          : null,
        handleCellClickAvailable: typeof (window as any).handleCellClick === 'function',
        executeMoveAvailable: typeof (window as any).executeMove === 'function',
        isProcessing: (window as any).isProcessing,
        isCardAnimating: (window as any).isCardAnimating,
        visualPlaybackActive: (window as any).VisualPlaybackActive,
        managedProcessing: playbackState && typeof playbackState.getProcessing === 'function'
          ? playbackState.getProcessing()
          : null,
        managedCardAnimating: playbackState && typeof playbackState.getCardAnimating === 'function'
          ? playbackState.getCardAnimating()
          : null,
        managedPlaybackActive: playbackState && typeof playbackState.getPlaybackActive === 'function'
          ? playbackState.getPlaybackActive()
          : null,
        pendingVisualPlayback: playbackState && typeof playbackState.hasPendingVisualPlayback === 'function'
          ? playbackState.hasPendingVisualPlayback((window as any).cardState)
          : null,
        selectionSettlementLocked: selectionFlow && typeof selectionFlow.isSelectionSettlementLocked === 'function'
          ? selectionFlow.isSelectionSettlementLocked()
          : null,
        clientState: client && typeof client.getState === 'function' ? client.getState() : null
      };
    });
    throw new Error(
      `follow-up UI placement did not publish: attempt=${JSON.stringify(attempt)} diagnostics=${JSON.stringify(diagnostics)}`
    );
  }
  return seat.page.evaluate((input) => {
    const state = (window as any).NetworkMatchClient.getState();
    return {
      move: input.move,
      stateVersionBefore: Number(input.stateVersionBefore),
      stateVersionAfter: Number(state && state.stateVersion)
    };
  }, attempt);
}

async function runScenario(scenario: Scenario, chromeSeat: Seat, edgeSeat: Seat, matchUrl: string) {
  await cleanupScenarioSessions(chromeSeat, edgeSeat);
  await Promise.all([resetPlaybackEvidence(chromeSeat), resetPlaybackEvidence(edgeSeat)]);
  let roomId = '';
  try {
    const created = await createRoom(chromeSeat, matchUrl);
    if (!created || created.ok !== true) {
      throw new Error(`create room failed: ${JSON.stringify(created || {})}`);
    }
    roomId = String(created.roomId || '');
    const joined = await joinRoom(edgeSeat, matchUrl, roomId);
    if (!joined || joined.ok !== true) {
      throw new Error(`join room failed: ${JSON.stringify(joined || {})}`);
    }
    patchRoomScenario(roomId, scenario);
    await syncBoth(chromeSeat, edgeSeat);
    await publishAction(chromeSeat, 'black', scenario.publishAction);
    await syncBoth(chromeSeat, edgeSeat);
    await Promise.all([
      waitForVisualSettlement(chromeSeat),
      waitForVisualSettlement(edgeSeat)
    ]);

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
    const followupPlacement = scenario.id === 'ordinary_turn_handoff'
      ? await playFirstLegalMoveThroughUi(edgeSeat, 'white')
      : null;
    if (followupPlacement) {
      await syncBoth(chromeSeat, edgeSeat);
      await Promise.all([
        waitForVisualSettlement(chromeSeat),
        waitForVisualSettlement(edgeSeat)
      ]);
    }

    return {
      id: scenario.id,
      roomId,
      expectedReasons: scenario.expectedReasons,
      chromeReasons: chromeEvidence.reasons,
      edgeReasons: edgeEvidence.reasons,
      followupPlacement
    };
  } finally {
    await cleanupScenarioSessions(chromeSeat, edgeSeat);
  }
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

    const scenarioArgIndex = process.argv.indexOf('--scenario');
    const requestedScenario = scenarioArgIndex >= 0 && scenarioArgIndex + 1 < process.argv.length
      ? String(process.argv[scenarioArgIndex + 1] || '').trim()
      : '';
    const scenarios = requestedScenario
      ? SCENARIOS.filter((scenario) => scenario.id === requestedScenario)
      : SCENARIOS;
    if (requestedScenario && scenarios.length === 0) {
      throw new Error(`unknown scenario: ${requestedScenario}`);
    }
    for (const scenario of scenarios) {
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
