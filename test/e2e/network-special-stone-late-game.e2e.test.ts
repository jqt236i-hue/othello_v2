import * as path from 'path';
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
  closeMaintenanceNoticeIfPresent,
  closeSidePanelIfPresent
} = require('./e2e-runtime-helpers.js');
const LocalMatchServer = require('../../dist/scripts/local-match-server.js');
const MatchAuthority = require('../../utils/match-authority.js');

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBootstrap(page: any): Promise<void> {
  await page.waitForFunction(() => !!(
    (window as any).gameState
    && (window as any).cardState
    && (window as any).NetworkMatchClient
    && typeof (window as any).require === 'function'
  ), null, { timeout: 20000 });
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

async function requestJournalReplayWithoutWaiting(page: any, serverUrl: string): Promise<void> {
  await page.evaluate(({ matchBaseUrl }) => {
    const root = window as any;
    const client = (window as any).NetworkMatchClient;
    const publicSession = client.getState();
    const storedSession = JSON.parse(localStorage.getItem('network_match_last_session') || '{}');
    const session = { ...publicSession, ...storedSession };
    const params = new URLSearchParams({ roomId: session.roomId, afterVisualSeq: '0' });
    if (String(session.viewerRole || '') === 'spectator') {
      params.set('viewerRole', 'spectator');
      params.set('spectatorId', session.spectatorId || '');
      params.set('spectatorToken', session.spectatorToken || '');
    } else {
      params.set('seatKey', session.seatKey || '');
      params.set('seatToken', session.seatToken || '');
    }
    root.__lateSpecialPlaybackProbe = [];
    root.__lateSpecialReplayError = null;
    void (async () => {
      try {
        const response = await fetch(`${matchBaseUrl}/api/match/presentation-journal?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || payload.ok !== true) throw new Error(`journal fetch failed: ${JSON.stringify(payload)}`);
        client.applySnapshot(payload.baseSnapshot, {
          force: true,
          source: 'journal_recovery_base',
          playbackEvents: [],
          presentationFrames: []
        });
        const visualStore = root.NetworkVisualStateStore;
        visualStore.setBaseVisualSnapshot(payload.baseSnapshot, {
          visualSeq: 0,
          visualVersion: payload.presentationFrames[0].stateVersionFrom,
          preserveExisting: false,
          source: 'journal_recovery'
        });
        const handler = root.PresentationHandler || root.require('ui/presentation-handler');
        const dispatcherModule = root.require('ui/network/playback-dispatcher');
        const dispatcher = dispatcherModule.createNetworkPlaybackDispatcher({
          root,
          getCardState: () => root.cardState,
          handlePresentationEvent: (event: any) => handler.handlePresentationEvent(event),
          onBoardUpdated: (info: any) => handler.onBoardUpdated(info)
        });
        const originalDispatch = dispatcher.dispatchNetworkPlaybackEvents.bind(dispatcher);
        dispatcher.dispatchNetworkPlaybackEvents = async (events: any[], options: any) => {
          const copied = JSON.parse(JSON.stringify(events));
          const stateHash = root.require('shared/state-hash');
          root.__lateSpecialPlaybackProbe.push({
            eventCount: copied.length,
            phaseCount: new Set(copied.map((event: any) => event.phase)).size,
            digest: stateHash.computeStableHash(copied),
            visualSeq: options?.visualSeq
          });
          return originalDispatch(events, options);
        };
        root.NetworkPlaybackDispatcher = dispatcher;
        const timelineModule = root.require('ui/network/presentation-timeline');
        const timeline = timelineModule.createNetworkPresentationTimeline({
          initialVisualSeq: 0,
          initialVisualVersion: payload.presentationFrames[0].stateVersionFrom,
          playbackDispatcher: dispatcher,
          visualStateStore: visualStore,
          onFrameCommitted: (frame: any) => client.applySnapshot(frame.snapshotAfter, {
            force: true,
            source: 'network_timeline_commit',
            playbackEvents: [],
            presentationFrames: []
          })
        });
        root.NetworkPresentationTimeline = timeline;
        timeline.enqueueFrames(payload.presentationFrames, {
          source: 'journal_recovery',
          allowBaseCursorAdvance: true
        });
        await timeline.drainPlayableFrames(dispatcher);
      } catch (error: any) {
        root.__lateSpecialReplayError = error?.message || String(error);
      }
    })();
  }, { matchBaseUrl: serverUrl });
}

async function waitForIdle(page: any): Promise<void> {
  await page.waitForFunction(() => {
    const root = window as any;
    const timeline = root.NetworkPresentationTimeline?.getDiagnostics?.();
    return root.isProcessing !== true
      && root.isCardAnimating !== true
      && root.VisualPlaybackActive !== true
      && (!timeline || (timeline.playing !== true && Number(timeline.pendingFrameCount || 0) === 0));
  }, null, { timeout: 30000 });
}

async function readClientEvidence(page: any): Promise<any> {
  return page.evaluate(() => {
    const root = window as any;
    const renderSnapshot = root.NetworkVisualStateStore?.peekRenderSnapshot?.()
      || root.NetworkVisualStateStore?.getRenderSnapshot?.()
      || null;
    const hands = root.cardState?.hands || {};
    const domBoard = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => {
      const disc = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"] .disc`);
      if (!disc) return 0;
      if (disc.classList.contains('black')) return 1;
      if (disc.classList.contains('white')) return -1;
      return 0;
    }));
    const traceEntries = root.__networkDebugTrace?.entries?.() || [];
    return {
      board: root.gameState?.board,
      domBoard,
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
      specialVisualCount: document.querySelectorAll('.disc.special-stone, .stone-timer, .bomb-timer').length
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
    const staticUrl = `http://127.0.0.1:${staticServer.address().port}/?debug=1&matchServer=http://127.0.0.1:${matchServer.address().port}`;
    const matchUrl = `http://127.0.0.1:${matchServer.address().port}`;

    try {
      await Promise.all(pages.map((page: any) => page.goto(staticUrl, { waitUntil: 'domcontentloaded' })));
      await Promise.all(pages.map((page: any) => closeMaintenanceNoticeIfPresent(page)));
      await Promise.all(pages.map(waitForBootstrap));

      const created = await enterRoom(pages[0], matchUrl, 'create');
      const roomId = String(created.roomId);
      await enterRoom(pages[1], matchUrl, 'join', roomId);
      await enterRoom(pages[2], matchUrl, 'spectate', roomId);

      const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
      fixture.snapshot.cardState.hands = { black: ['chest_01'], white: ['free_01'] };
      const turn = runHeadlessFixtureTurnStart(fixture);
      expect(turn.comparison.playbackDigest).toBe('fnv1a32:8b758173');
      expect(turn.playbackEvents).toHaveLength(38);
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
        'hyperactive_move', 'hyperactive_move', 'card_effect_flip', 'hyperactive_move', 'hyperactive_move',
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

      await Promise.all(pages.map((page: any) => requestJournalReplayWithoutWaiting(page, matchUrl)));
      await Promise.all(pages.map((page: any) => page.waitForFunction(() => (
        (window as any).VisualPlaybackActive === true || (window as any).isProcessing === true
      ), null, { timeout: 10000 })));

      const duringPlayback = await Promise.all(pages.map(readClientEvidence));
      for (const evidence of duringPlayback) {
        expect(evidence.stateVersion).toBe(versions.fromVersion);
        expect(evidence.board).not.toEqual(turn.snapshot.gameState.board);
        expect(evidence.busy.processing || evidence.busy.playback).toBe(true);
        expect(evidence.replayError).toBeNull();
      }

      await Promise.all(pages.map(waitForIdle));
      const [host, guest, spectator] = await Promise.all(pages.map(readClientEvidence));
      expect(guest.board).toEqual(host.board);
      expect(spectator.board).toEqual(host.board);
      expect(guest.charge).toEqual(host.charge);
      expect(spectator.charge).toEqual(host.charge);
      expect(guest.markers).toEqual(host.markers);
      expect(spectator.markers).toEqual(host.markers);
      for (const evidence of [host, guest, spectator]) {
        expect(evidence.probe).toEqual([
          expect.objectContaining({ visualSeq: 1, eventCount: 38, phaseCount: 9, digest: 'fnv1a32:8b758173' })
        ]);
      }
      expect(host.hands.black).toContain('chest_01');
      expect(JSON.stringify(host.hands.white)).not.toContain('free_01');
      expect(guest.hands.white).toContain('free_01');
      expect(JSON.stringify(guest.hands.black)).not.toContain('chest_01');
      expect(spectator.hands.black).toContain('chest_01');
      expect(spectator.hands.white).toContain('free_01');
      expect(host.specialVisualCount).toBeGreaterThan(0);
      expect(errors).toEqual([[], [], []]);

      await contexts[1].setOffline(true);
      await wait(500);
      await contexts[1].setOffline(false);
      await pages[1].evaluate(async () => (window as any).NetworkMatchClient.syncLatestState());
      await waitForIdle(pages[1]);
      const reconnectedGuest = await readClientEvidence(pages[1]);
      expect(reconnectedGuest.board).toEqual(host.board);
      expect(reconnectedGuest.markers).toEqual(host.markers);
      expect(reconnectedGuest.probe).toHaveLength(1);

      await closeSidePanelIfPresent(pages[0]);
      await pages[0].screenshot({
        path: path.resolve(process.cwd(), 'docs/perf/2026-07-11-network-special-stone-e2e.png'),
        fullPage: true
      });
    } finally {
      await Promise.all(pages.map((page: any) => stopPlaywrightPage(page, 5000)));
      await Promise.all(contexts.map((context: any) => context.close().catch(() => undefined)));
    }
  }, 60000);
});
