import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, Browser } from 'playwright';

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

async function launchChrome(): Promise<Browser> {
  return chromium.launch({ channel: 'chrome', headless: true });
}

async function main(): Promise<void> {
  const rootDir = findRepoRoot(__dirname);
  const server = createStaticServer(rootDir);
  let browser: Browser | null = null;
  try {
    const appUrl = await listen(server, '127.0.0.1', 0);
    console.log(`[playback-board-writer-check] app=${appUrl}`);
    browser = await launchChrome();
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (typeof message.type === 'function' && message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error && (error as any).message ? String((error as any).message) : String(error));
    });
    await page.goto(`${appUrl}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      return !!(
        (window as any).renderBoard
        && (window as any).require
        && (window as any).RenderScheduler
      );
    }, null, { timeout: 30000 });
    await page.waitForFunction(() => {
      const root = window as any;
      let timeline: any = null;
      try {
        timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
          ? root.NetworkPresentationTimeline.getDiagnostics()
          : null;
      } catch (_e) {
        timeline = null;
      }
      return root.isProcessing !== true
        && root.isCardAnimating !== true
        && root.VisualPlaybackActive !== true
        && !(root.AnimationEngine && root.AnimationEngine.isPlaying === true)
        && (!timeline || (
          timeline.playing !== true
          && timeline.paused !== true
          && Number(timeline.pendingFrameCount || 0) === 0
        ));
    }, null, { timeout: 30000 });

    const evidence = await page.evaluate(async () => {
      const root = window as any;
      const boardRenderer = root.require('ui/board-renderer');
      const diffRenderer = root.require('ui/diff-renderer');
      const boardUpdateSyncRuntime = root.require('ui/board-update-sync-runtime');
      if (!boardRenderer || typeof boardRenderer.renderBoardFull !== 'function') {
        throw new Error('ui/board-renderer.renderBoardFull is unavailable');
      }
      if (!boardUpdateSyncRuntime || typeof boardUpdateSyncRuntime.armBoardUpdateSyncContext !== 'function') {
        throw new Error('ui/board-update-sync-runtime is unavailable');
      }
      const row = 2;
      const col = 2;
      const flipRow = 2;
      const flipCol = 3;
      const black = Number.isFinite(Number(root.BLACK)) ? Number(root.BLACK) : 1;
      const white = Number.isFinite(Number(root.WHITE)) ? Number(root.WHITE) : -1;
      const empty = Number.isFinite(Number(root.EMPTY)) ? Number(root.EMPTY) : 0;
      const board = Array.from({ length: 8 }, () => Array(8).fill(empty));
      board[row][col] = white;
      root.gameState = root.gameState || {};
      root.gameState.currentPlayer = black;
      root.gameState.board = board;
      root.cardState = root.cardState || {};
      root.cardState.markers = [];
      root.cardState.pendingEffectByPlayer = { black: null, white: null };
      root.cardState.presentationEvents = [];
      root.cardState._presentationEventsPersist = [];

      const readCellAt = (targetRow: number, targetCol: number) => {
        const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`) as HTMLElement | null;
        const disc = cell ? cell.querySelector('.disc') as HTMLElement | null : null;
        return {
          hasCell: !!cell,
          hasDisc: !!disc,
          cellClass: cell ? cell.className : '',
          discClass: disc ? disc.className : ''
        };
      };
      const readCell = () => readCellAt(row, col);
      const records: any[] = [];
      const record = (label: string) => {
        records.push({ label, cell: readCell() });
      };
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const armBypassContext = (reason: string) => {
        boardUpdateSyncRuntime.armBoardUpdateSyncContext({
          allowBoardUpdateDuringPlayback: true,
          source: 'playback-board-writer-browser-check',
          reason
        });
      };

      boardRenderer.renderBoardFull();
      record('initial-render');
      if (!readCell().hasDisc) {
        throw new Error(`initial target disc was not rendered: ${JSON.stringify(records)}`);
      }

      root.gameState.board[row][col] = empty;
      root.cardState.presentationEvents = [
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1, targets: [{ r: row, col }] }] }
      ];
      root.cardState._presentationEventsPersist = [
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1, targets: [{ r: row, col }] }] }
      ];

      armBypassContext('direct_renderBoard_probe');
      root.renderBoard();
      record('after-renderBoard-during-playback');

      armBypassContext('scheduler_ignore_probe');
      root.RenderScheduler.requestBoardRender({
        source: 'playback-board-writer-browser-check',
        reason: 'scheduler_ignore_probe'
      });
      root.RenderScheduler.flushVisualUpdates({ ignorePlayback: true });
      record('after-scheduler-ignore-during-playback');

      if (diffRenderer && typeof diffRenderer.renderBoardDiff === 'function') {
        armBypassContext('direct_diff_probe');
        diffRenderer.renderBoardDiff(document.getElementById('board'));
        record('after-renderBoardDiff-during-playback');
      }

      const duringLabels = records.filter((entry) => (
        entry.label !== 'initial-render'
        && entry.label !== 'after-final-idle-render'
      ));
      const missingDuringPlayback = duringLabels.filter((entry) => !entry.cell || entry.cell.hasDisc !== true);
      if (missingDuringPlayback.length > 0) {
        throw new Error(`target disc disappeared during pending playback: ${JSON.stringify(records)}`);
      }

      root.cardState.presentationEvents = [];
      root.cardState._presentationEventsPersist = [];
      boardUpdateSyncRuntime.clearBoardUpdateSyncContext();
      root.renderBoard();
      record('after-final-idle-render');
      await wait(700);
      record('after-final-idle-settle');

      const finalCell = readCell();
      if (finalCell.hasDisc) {
        throw new Error(`final idle render did not remove target disc: ${JSON.stringify(records)}`);
      }
      const flipEvents = root.require('ui/animation-flip-events');
      if (!flipEvents || typeof flipEvents.handleFlipEvent !== 'function') {
        throw new Error('ui/animation-flip-events.handleFlipEvent is unavailable');
      }
      const flipRecords: any[] = [];
      const readFlipCell = () => readCellAt(flipRow, flipCol);
      const recordFlip = (label: string) => {
        flipRecords.push({ label, cell: readFlipCell() });
      };
      if (diffRenderer && typeof diffRenderer.resetRenderStats === 'function') {
        diffRenderer.resetRenderStats();
      }
      root.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(empty));
      root.cardState.markers = [];
      root.cardState.presentationEvents = [];
      root.cardState._presentationEventsPersist = [];
      root.gameState.board[flipRow][flipCol] = black;
      boardRenderer.renderBoardFull();
      recordFlip('flip-initial-render');
      if (!readFlipCell().hasDisc) {
        throw new Error(`initial flip target disc was not rendered: ${JSON.stringify(flipRecords)}`);
      }
      const flipAnimationShared = {
        triggerFlip: (disc: HTMLElement | null | undefined) => {
          if (disc && disc.classList) disc.classList.add('flip');
        },
        removeFlip: (disc: HTMLElement | null | undefined) => {
          if (disc && disc.classList) disc.classList.remove('flip');
        }
      };

      await flipEvents.handleFlipEvent({
        type: 'flip',
        targets: [{ r: flipRow, col: flipCol, ownerBefore: 'black', after: { color: white } }]
      }, {
        eventTypes: { FLIP: 'flip' },
        flipMs: 20,
        fadeOutMs: 10,
        isNoAnim: () => false,
        getCellEl: (r: number, c: number) => document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`),
        resolveOwnerColorFromBefore: () => black,
        resolveOwnerClassFromColor: () => 'black',
        syncDiscVisual: (disc: HTMLElement, state: any) => {
          disc.classList.toggle('black', state && state.color === black);
          disc.classList.toggle('white', state && state.color === white);
        },
        runWithEffectTargetHighlight: (_cell: Element, _eventType: string, _target: unknown, runner: () => Promise<void>) => runner(),
        sleep: () => Promise.resolve(),
        animationShared: flipAnimationShared
      });
      recordFlip('after-playback-flip');

      const afterPlaybackFlipCell = readFlipCell();
      if (!afterPlaybackFlipCell.hasDisc || !afterPlaybackFlipCell.discClass.split(/\s+/).includes('white')) {
        throw new Error(`playback flip did not leave a white disc: ${JSON.stringify(flipRecords)}`);
      }

      root.gameState.board[flipRow][flipCol] = white;
      diffRenderer.renderBoardDiff(document.getElementById('board'));
      recordFlip('after-final-flip-sync');

      const finalFlipCell = readFlipCell();
      if (!finalFlipCell.hasDisc || !finalFlipCell.discClass.split(/\s+/).includes('white')) {
        throw new Error(`final flip sync did not keep the white disc: ${JSON.stringify(flipRecords)}`);
      }
      const replayedFlip = flipRecords.some((entry) => (
        entry.label === 'after-final-flip-sync'
        && entry.cell
        && typeof entry.cell.discClass === 'string'
        && entry.cell.discClass.split(/\s+/).includes('flip')
      ));
      if (replayedFlip) {
        throw new Error(`final flip sync replayed fallback flip: ${JSON.stringify(flipRecords)}`);
      }
      return {
        records,
        flipRecords
      };
    });

    console.log(JSON.stringify({
      evidence,
      consoleErrors,
      pageErrors
    }, null, 2));
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      throw new Error(`browser errors detected: ${JSON.stringify({ consoleErrors, pageErrors })}`);
    }
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(`[playback-board-writer-check] failed: ${error && (error as any).message ? String((error as any).message) : String(error)}`);
  process.exit(1);
});
