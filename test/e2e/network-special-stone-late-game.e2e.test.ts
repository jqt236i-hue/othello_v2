import { chromium } from 'playwright';
import {
  createNetworkSpecialStonePerformanceFixture,
  runHeadlessFixtureTurnStart
} from '../helpers/network-special-stone-performance-fixtures';

declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

const {
  startStaticServer,
  startLocalMatchServer,
  stopStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  closeMaintenanceNoticeIfPresent
} = require('./e2e-runtime-helpers.js');
const LocalMatchServer = require('../../dist/scripts/local-match-server.js');
const MatchAuthority = require('../../utils/match-authority.js');

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBootstrap(page: any): Promise<void> {
  await page.waitForFunction(() => !!(
    (window as any).__uiInitialized === true
    && (window as any).gameState
    && (window as any).cardState
    && (window as any).NetworkMatchClient
    && typeof (window as any).require === 'function'
    && (window as any).__boardVisualDebug?.getBackendKind?.() === 'pixi'
  ), null, { timeout: 20000 });
  await page.evaluate(() => (window as any).__boardVisualDebug.waitForIdle());
}

async function enterRoom(page: any, serverUrl: string, mode: 'create' | 'join' | 'spectate', roomId?: string): Promise<any> {
  const result = await page.evaluate(async ({ url, entryMode, targetRoomId }) => {
    const client = (window as any).NetworkMatchClient;
    client.setServerUrl(url);
    if (entryMode === 'create') return client.createRoom({ serverUrl: url, playerName: '黒主' });
    if (entryMode === 'join') return client.joinRoom(targetRoomId, { serverUrl: url, playerName: '白主' });
    return client.spectateRoom(targetRoomId, { serverUrl: url, playerName: '観測者' });
  }, { url: serverUrl, entryMode: mode, targetRoomId: roomId || '' });
  expect(result && result.ok).toBe(true);
  return result;
}

async function requestJournalReplayWithoutWaiting(page: any): Promise<void> {
  await page.evaluate(() => {
    const root = window as any;
    const client = (window as any).NetworkMatchClient;
    root.__lateSpecialPlaybackProbe = [];
    root.__lateSpecialReplayError = null;
    void (async () => {
      try {
        const result = await client.syncLatestState({ source: 'e2e_late_special_recovery' });
        if (!result || result.ok !== true) {
          throw new Error(`state sync failed: ${JSON.stringify(result)}`);
        }
      } catch (error: any) {
        root.__lateSpecialReplayError = error?.message || String(error);
      }
    })();
  });
}

async function waitForIdle(page: any): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const root = window as any;
      const timeline = root.NetworkPresentationTimeline?.getDiagnostics?.();
      return root.isProcessing !== true
        && root.isCardAnimating !== true
        && root.VisualPlaybackActive !== true
        && (!timeline || (timeline.playing !== true && Number(timeline.pendingFrameCount || 0) === 0))
        && root.__boardVisualDebug?.getWriterMode?.() === 'idle';
    }, null, { timeout: 30000 });
    await page.evaluate(() => (window as any).__boardVisualDebug.waitForIdle());
  } catch (_error) {
    const evidence = await readClientEvidence(page);
    throw new Error(`network journal playback did not settle: ${JSON.stringify(evidence)}`);
  }
}

async function waitForPlaybackStart(page: any): Promise<void> {
  try {
    await page.waitForFunction(() => (
      (window as any).VisualPlaybackActive === true || (window as any).isProcessing === true
    ), null, { timeout: 10000 });
  } catch (_error) {
    const evidence = await readClientEvidence(page);
    throw new Error(`network journal playback did not start: ${JSON.stringify(evidence)}`);
  }
}

async function readClientEvidence(page: any): Promise<any> {
  return page.evaluate(() => {
    const root = window as any;
    const renderSnapshot = root.NetworkVisualStateStore?.peekRenderSnapshot?.()
      || root.NetworkVisualStateStore?.getRenderSnapshot?.()
      || null;
    const hands = root.cardState?.hands || {};
    const debug = root.__boardVisualDebug;
    const renderedCells = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => (
      debug?.getRenderedCell?.(row, col) || null
    )));
    const renderedBoard = renderedCells.map((row: any[]) => row.map((cell: any) => {
      const stone = cell?.stone;
      if (!stone?.visible) return 0;
      if (stone.owner === 'black') return 1;
      if (stone.owner === 'white') return -1;
      return 0;
    }));
    const backendDiagnostics = debug?.getBackendDiagnostics?.() || null;
    const specialVisualCount = renderedCells.flat().filter((cell: any) => {
      const stone = cell?.stone;
      return stone?.visible && !!(
        stone.specialType
        || stone.timerLabel
        || stone.badgeLabel
        || stone.statusLabels?.length
        || stone.renderedMarkerKinds?.length
      );
    }).length;
    const traceEntries = root.__networkDebugTrace?.entries?.() || [];
    return {
      board: root.gameState?.board,
      renderedBoard,
      currentPlayer: root.gameState?.currentPlayer,
      charge: root.cardState?.charge,
      markers: (root.cardState?.markers || []).map((marker: any) => ({
        kind: marker.kind, row: marker.row, col: marker.col, owner: marker.owner,
        type: marker.data?.type, timer: marker.data?.remainingOwnerTurns ?? marker.data?.timer ?? null
      })),
      hands: { black: hands.black, white: hands.white },
      stateVersion: root.NetworkMatchClient?.getStateVersion?.(),
      renderStateVersion: renderSnapshot?.stateVersion,
      playbackDispatches: traceEntries
        .filter((entry: any) => String(entry?.type || '').startsWith('network_playback_dispatcher'))
        .map((entry: any) => ({
          type: entry.type,
          visualSeq: entry.visualSeq,
          playbackEventCount: entry.playbackEventCount
        })),
      probe: root.__lateSpecialPlaybackProbe || [],
      replayError: root.__lateSpecialReplayError || null,
      traceSummary: traceEntries.map((entry: any) => ({
        type: entry?.type, source: entry?.source, visualSeq: entry?.visualSeq,
        playbackEventCount: entry?.playbackEventCount, reason: entry?.reason
      })),
      timeline: root.NetworkPresentationTimeline?.getDiagnostics?.() || null,
      busy: {
        processing: !!root.isProcessing,
        cardAnimating: !!root.isCardAnimating,
        playback: !!root.VisualPlaybackActive
      },
      specialVisualCount,
      visual: {
        backend: debug?.getBackendKind?.() || null,
        digest: debug?.getVisualFrameDigest?.() || null,
        domCellCount: Number(backendDiagnostics?.domCellCount || 0),
        canvasCount: Number(backendDiagnostics?.canvasCount || 0),
        tickerRunning: backendDiagnostics?.tickerRunning === true,
        playback: backendDiagnostics?.playback || null,
        application: backendDiagnostics?.application || null
      }
    };
  });
}

describe('Network late-special-20 playback E2E', () => {
  let staticServer: any;
  let matchServer: any;
  let browser: any;

  beforeAll(async () => {
    staticServer = startStaticServer(0);
    matchServer = startLocalMatchServer(0);
    await wait(500);
    browser = await chromium.launch({ headless: true });
  }, 60000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    await stopStaticServer(matchServer);
    await stopStaticServer(staticServer);
  }, 60000);

  test('two seats and a spectator drain the ordered journal, reconnect, and converge without early final render', async () => {
    const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map((context: any) => context.newPage()));
    const errors: string[][] = [[], [], []];
    pages.forEach((page: any, index: number) => {
      page.on('console', (message: any) => {
        if (message.type() === 'error') errors[index].push(message.text());
      });
      page.on('pageerror', (error: any) => errors[index].push(error?.message || String(error)));
    });
    const staticUrl = `http://127.0.0.1:${staticServer.address().port}/?debug=1&boardRenderer=pixi&matchServer=http://127.0.0.1:${matchServer.address().port}`;
    const matchUrl = `http://127.0.0.1:${matchServer.address().port}`;

    try {
      await Promise.all(pages.map((page: any) => page.goto(staticUrl, { waitUntil: 'domcontentloaded' })));
      await Promise.all(pages.map((page: any) => closeMaintenanceNoticeIfPresent(page)));
      await Promise.all(pages.map(waitForBootstrap));

      const created = await enterRoom(pages[0], matchUrl, 'create');
      const roomId = String(created.roomId);
      await enterRoom(pages[1], matchUrl, 'join', roomId);
      await enterRoom(pages[2], matchUrl, 'spectate', roomId);

      // Freeze the live SSE lane before installing the deterministic journal
      // fixture. Otherwise a stream snapshot can advance one client's visual
      // cursor before the production state-sync recovery reads frame 1.
      await Promise.all(contexts.map((context: any) => context.setOffline(true)));
      await wait(150);

      const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
      fixture.snapshot.cardState.hands = { black: ['chest_01'], white: ['free_01'] };
      const turn = runHeadlessFixtureTurnStart(fixture);
      expect(turn.comparison.playbackDigest).toBe('fnv1a32:a92eff98');
      expect(turn.playbackEvents).toHaveLength(42);
      expect(new Set(turn.playbackEvents.map((event: any) => event.phase)).size).toBe(9);
      const soundKeys = turn.playbackEvents.flatMap((event: any) => {
        const keys: string[] = [];
        if (event?.soundKey) keys.push(String(event.soundKey));
        for (const target of (Array.isArray(event?.targets) ? event.targets : [])) {
          if (target?.soundKey) keys.push(String(target.soundKey));
        }
        return keys;
      });
      expect(soundKeys).toEqual([
        'hyperactive_move', 'hyperactive_move', 'hyperactive_move', 'card_effect_flip', 'hyperactive_move',
        'stone_destroy', 'stone_destroy', 'bomb_explode', 'bomb_explode', 'special_reverted'
      ]);
      let versions: any = null;
      const patched = LocalMatchServer.patchRoomSnapshotForTests(roomId, (room: any) => {
        const before = JSON.parse(JSON.stringify(fixture.snapshot));
        const after = JSON.parse(JSON.stringify(turn.snapshot));
        const fromVersion = Number(room.stateVersion || 0);
        const toVersion = fromVersion + 1;
        before.stateVersion = fromVersion;
        after.stateVersion = toVersion;
        room.snapshot = before;
        room.initialSnapshotByViewer = {
          black: MatchAuthority.buildPublicSnapshot(room, 'black'),
          white: MatchAuthority.buildPublicSnapshot(room, 'white'),
          spectator: MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'e2e' })
        };
        room.presentationJournal = [];
        delete room.presentationJournalBaseVisualSeq;
        delete room.presentationJournalBaseSnapshotByViewer;
        room.visualSeq = 0;
        room.snapshot = after;
        room.stateVersion = toVersion;
        room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(after);
        MatchAuthority.appendPresentationFrame(room, {
          stateVersionFrom: fromVersion,
          stateVersionTo: toVersion,
          operationId: 'e2e-late-special-20',
          actorSeatKey: 'black',
          actionType: 'move',
          payloadByViewer: {
            black: { playbackEvents: turn.playbackEvents, effectLogs: [] },
            white: { playbackEvents: turn.playbackEvents, effectLogs: [] },
            spectator: { playbackEvents: turn.playbackEvents, effectLogs: [] }
          },
          snapshotAfterByViewer: {
            black: MatchAuthority.buildPublicSnapshot(room, 'black'),
            white: MatchAuthority.buildPublicSnapshot(room, 'white'),
            spectator: MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'e2e' })
          }
        });
        versions = { fromVersion, toVersion };
      });
      expect(patched).toBe(true);

      await Promise.all(contexts.map((context: any) => context.route(
        '**/api/match/stream**',
        (route: any) => route.abort('aborted')
      )));
      await Promise.all(contexts.map((context: any) => context.setOffline(false)));

      await Promise.all(pages.map((page: any) => requestJournalReplayWithoutWaiting(page)));
      await Promise.all(pages.map(waitForPlaybackStart));

      await contexts[1].setOffline(true);
      await wait(100);
      const guestWasPlayingDuringReconnect = await pages[1].evaluate(() => (
        (window as any).VisualPlaybackActive === true || (window as any).isProcessing === true
      ));
      expect(guestWasPlayingDuringReconnect).toBe(true);
      const duringPlayback = await Promise.all(pages.map(readClientEvidence));
      for (const evidence of duringPlayback) {
        expect(evidence.stateVersion).toBe(versions.toVersion);
        expect(evidence.board).toEqual(turn.snapshot.gameState.board);
        expect(evidence.renderedBoard).not.toEqual(turn.snapshot.gameState.board);
        expect(evidence.busy.processing || evidence.busy.playback).toBe(true);
        expect(evidence.replayError).toBeNull();
      }
      await contexts[1].setOffline(false);
      await pages[1].evaluate(async () => (window as any).NetworkMatchClient.syncLatestState());

      await Promise.all(pages.map(waitForIdle));
      const [host, guest, spectator] = await Promise.all(pages.map(readClientEvidence));
      expect(guest.board).toEqual(host.board);
      expect(spectator.board).toEqual(host.board);
      expect(guest.charge).toEqual(host.charge);
      expect(spectator.charge).toEqual(host.charge);
      expect(guest.markers).toEqual(host.markers);
      expect(spectator.markers).toEqual(host.markers);
      for (const evidence of [host, guest, spectator]) {
        expect(evidence.playbackDispatches).toEqual([
          expect.objectContaining({
            type: 'network_playback_dispatcher_direct',
            visualSeq: 1
          })
        ]);
      }
      expect(host.hands.black).toContain('chest_01');
      expect(JSON.stringify(host.hands.white)).not.toContain('free_01');
      expect(guest.hands.white).toContain('free_01');
      expect(JSON.stringify(guest.hands.black)).not.toContain('chest_01');
      expect(spectator.hands.black).toContain('chest_01');
      expect(spectator.hands.white).toContain('free_01');
      for (const evidence of [host, guest, spectator]) {
        expect(evidence.renderedBoard).toEqual(evidence.board);
        expect(evidence.specialVisualCount).toBeGreaterThan(0);
        expect(evidence.visual).toEqual(expect.objectContaining({
          backend: 'pixi', domCellCount: 0, canvasCount: 1
        }));
      }
      const unexpectedErrors = errors.map((entries) => entries.filter((message) => (
        !message.includes('net::ERR_INTERNET_DISCONNECTED')
      )));
      expect(unexpectedErrors).toEqual([[], [], []]);

      const reconnectedGuest = await readClientEvidence(pages[1]);
      expect(reconnectedGuest.board).toEqual(host.board);
      expect(reconnectedGuest.markers).toEqual(host.markers);
      expect(reconnectedGuest.playbackDispatches).toHaveLength(1);
    } finally {
      await Promise.all(pages.map((page: any) => stopPlaywrightPage(page, 5000)));
      await Promise.all(contexts.map((context: any) => context.close().catch(() => undefined)));
    }
  }, 60000);
});
